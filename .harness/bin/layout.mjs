import fs from 'node:fs';
import path from 'node:path';

export const ROLES = Object.freeze(['planner', 'executor', 'reviewer', 'designer', 'qa', 'refactor']);
export const DEFAULT_LAYOUT = Object.freeze({ roles: Object.freeze(['planner', 'executor', 'reviewer']) });
export const AGENTS = Object.freeze(['claude', 'pi']);
// The executor is the Claude Code role; every other role defaults to Pi.
export const defaultAgent = role => role === 'executor' ? 'claude' : 'pi';
const MAX_BYTES = 16 * 1024;

// Older layout.json files also carry a backstage `panes` order; it is ignored because only the console shows role panes.
// `agents` maps each selected role to the CLI that runs it; roles without an entry (older files) get their default.
export function validateLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout) || !Array.isArray(layout.roles) || layout.roles.length < 1 ||
      layout.roles.some(role => !ROLES.includes(role)) || new Set(layout.roles).size !== layout.roles.length) throw new Error('Invalid role/layout configuration.');
  const given = layout.agents ?? {};
  if (typeof given !== 'object' || Array.isArray(given) || Object.entries(given).some(([role, agent]) => !layout.roles.includes(role) || !AGENTS.includes(agent))) throw new Error('Invalid agent configuration.');
  return { roles: [...layout.roles], agents: Object.fromEntries(layout.roles.map(role => [role, given[role] ?? defaultAgent(role)])) };
}

// 'planner=claude,reviewer=pi' (the --agents flag) → { planner: 'claude', reviewer: 'pi' }.
export function parseAgents(text) {
  const agents = {};
  for (const item of text.split(',')) {
    const [role, agent, ...extra] = item.split('=');
    if (!ROLES.includes(role) || !AGENTS.includes(agent) || extra.length || Object.hasOwn(agents, role)) throw new Error(`Invalid --agents entry: ${item || '(empty)'}; use role=claude|pi.`);
    agents[role] = agent;
  }
  return agents;
}

function safePaths(root) {
  const base = path.resolve(root), dir = path.join(base, '.harness'), file = path.join(dir, 'layout.json');
  for (const target of [dir, file]) {
    try { if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Layout config paths must not be symlinks.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { dir, file };
}

export function readLayout(root) {
  const { file } = safePaths(root);
  let data, fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Layout config is not a bounded regular file.');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > MAX_BYTES) throw new Error('Layout config is too large.');
    data = buffer.subarray(0, size).toString('utf8');
  } catch (error) { if (error.code === 'ENOENT') return validateLayout(DEFAULT_LAYOUT); throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  return validateLayout(JSON.parse(data));
}

export function writeLayout(root, layout) {
  const valid = validateLayout(layout), { dir, file } = safePaths(root);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Layout config paths must not be symlinks.');
  const temp = path.join(dir, `.layout-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(valid, null, 2)}\n`);
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Layout config paths must not be symlinks.');
    fs.renameSync(temp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return valid;
}
