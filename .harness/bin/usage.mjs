// Account-level token usage readings. Only percentages and reset times are kept; credentials are never read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROVIDERS = ['claude', 'codex'];
const CLAUDE = [['five_hour', '5h'], ['seven_day', '7d']];
const LIMIT = 4096, SAME = 60_000;

export function usageDir(env = process.env) {
  return path.join(env.C2KIM_HOME || path.join(os.homedir(), '.c2kim'), 'usage');
}

function number(value) {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

function span(minutes) {
  return minutes % 1440 === 0 ? `${minutes / 1440}d` : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

export function claudeUsage(input, at = Date.now()) {
  const limits = input?.rate_limits;
  if (!limits || typeof limits !== 'object') return null;
  const windows = [];
  for (const [key, label] of CLAUDE) {
    const used = number(limits[key]?.used_percentage);
    if (used === null) continue;
    const resets = number(limits[key].resets_at);
    windows.push({ label, used, resets: resets === null ? null : resets * 1000 });
  }
  return windows.length ? { provider: 'claude', at, windows } : null;
}

export function codexUsage(headers, at = Date.now()) {
  if (!headers || typeof headers !== 'object') return null;
  const pairs = typeof headers.entries === 'function' ? [...headers.entries()] : Object.entries(headers);
  const lower = Object.fromEntries(pairs.map(([key, value]) => [String(key).toLowerCase(), Array.isArray(value) ? value[0] : value]));
  const found = [];
  for (const slot of ['primary', 'secondary']) {
    const get = name => lower[`x-codex-${slot}-${name}`];
    const used = number(get('used-percent')), minutes = number(get('window-minutes'));
    if (used === null || !minutes) continue;
    const resetAt = number(get('reset-at')), after = number(get('reset-after-seconds'));
    found.push({ minutes, window: { label: span(minutes), used, resets: resetAt !== null ? resetAt * 1000 : after !== null ? at + after * 1000 : null } });
  }
  found.sort((a, b) => a.minutes - b.minutes);
  return found.length ? { provider: 'codex', at, windows: found.map(item => item.window) } : null;
}

function valid(record, provider = record?.provider) {
  if (!record || typeof record !== 'object' || record.provider !== provider || !PROVIDERS.includes(provider)) return null;
  if (number(record.at) === null || typeof record.at !== 'number' || !Array.isArray(record.windows) || !record.windows.length || record.windows.length > 4) return null;
  const windows = [];
  for (const window of record.windows) {
    if (typeof window?.label !== 'string' || !/^\d{1,5}[mhd]$/.test(window.label) || typeof window.used !== 'number' || number(window.used) === null) return null;
    if (window.resets !== null && (typeof window.resets !== 'number' || number(window.resets) === null)) return null;
    windows.push({ label: window.label, used: window.used, resets: window.resets });
  }
  const result = { provider, at: record.at, windows };
  if (record.source !== undefined) {
    if (!['statusline', 'headers', 'rollout'].includes(record.source)) return null;
    result.source = record.source;
  }
  return result;
}

function read(file, provider) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > LIMIT) return null;
    return valid(JSON.parse(fs.readFileSync(file, 'utf8')), provider);
  } catch {
    return null;
  }
}

export function readUsage(env = process.env) {
  const dir = usageDir(env);
  return Object.fromEntries(PROVIDERS.map(provider => [provider, read(path.join(dir, `${provider}.json`), provider)]));
}

export function recordUsage(record, env = process.env) {
  const next = valid(record);
  if (!next) throw new Error('invalid usage reading');
  const dir = usageDir(env), file = path.join(dir, `${next.provider}.json`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const previous = read(file, next.provider);
  if (previous && previous.at >= next.at) return false;
  if (previous && JSON.stringify(previous.windows) === JSON.stringify(next.windows) && next.at - previous.at < SAME) return false;
  const temp = path.join(dir, `.${next.provider}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(next) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
  return true;
}

const TAIL = 262_144, FILES = 5;
let cached = { key: '', reading: null };

function newest(dir, depth) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  if (depth === 0) {
    return names.filter(entry => entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name))
      .map(entry => { const file = path.join(dir, entry.name); try { return { file, stat: fs.statSync(file) }; } catch { return null; } })
      .filter(Boolean).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  }
  const found = [];
  for (const entry of names.filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name)).sort((a, b) => b.name.localeCompare(a.name))) {
    found.push(...newest(path.join(dir, entry.name), depth - 1));
    if (found.length >= FILES) break;
  }
  return found;
}

function lastLimits({ file, stat }) {
  const fd = fs.openSync(file, 'r');
  try {
    const length = Math.min(stat.size, TAIL), buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, stat.size - length);
    const lines = buffer.toString('utf8').split('\n');
    for (let index = lines.length - 1; index >= (stat.size > TAIL ? 1 : 0); index--) {
      if (!lines[index].includes('"rate_limits"')) continue;
      let entry; try { entry = JSON.parse(lines[index]); } catch { continue; }
      const limits = entry?.payload?.rate_limits, at = Date.parse(entry?.timestamp);
      if (!limits || !Number.isFinite(at)) continue;
      const windows = ['primary', 'secondary'].map(slot => limits[slot]).filter(window => window && number(window.used_percent) !== null && number(window.window_minutes))
        .sort((a, b) => a.window_minutes - b.window_minutes)
        .map(window => ({ label: span(window.window_minutes), used: window.used_percent, resets: number(window.resets_at) === null ? null : window.resets_at * 1000 }));
      if (windows.length) return valid({ provider: 'codex', at, source: 'rollout', windows });
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

// Latest rate limits Codex CLI itself logged, used only when no newer reading was recorded.
export function codexRollout(env = process.env) {
  const files = newest(path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions'), 3).slice(0, FILES);
  const key = files.map(({ file, stat }) => `${file}:${stat.mtimeMs}:${stat.size}`).join('|');
  if (key === cached.key) return cached.reading;
  let reading = null;
  for (const item of files) {
    try { reading = lastLimits(item); } catch { reading = null; }
    if (reading) break;
  }
  cached = { key, reading };
  return reading;
}

export function displayUsage(env = process.env) {
  const usage = readUsage(env), history = codexRollout(env);
  if (history && (!usage.codex || history.at > usage.codex.at)) usage.codex = history;
  return usage;
}
