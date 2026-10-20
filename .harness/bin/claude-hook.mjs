#!/usr/bin/env node
// Claude Code hooks and status line attached only to the harness executor launch (claude --settings).
// Live state is display evidence; questions and permissions are always answered in Claude's own dialog.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import * as runtime from './runtime.mjs';
import { claudeUsage, recordUsage } from './usage.mjs';

const TOOL = /^[A-Za-z0-9_.:-]{1,80}$/, NATIVE = ['permission_prompt', 'elicitation_dialog'];

async function retry(operation, attempts = 40) {
  for (let attempt = 1; ; attempt++) {
    try { return operation(); }
    catch (error) { if (error.code !== 'C2H_LOCK_BUSY' || attempt >= attempts) throw error; await sleep(50); }
  }
}

export async function recordEvent(root, role, event, input, at = Date.now()) {
  const tool = TOOL.test(input.tool_name ?? '') ? input.tool_name : undefined, source = 'claude-hook';
  const set = (state, extra = {}) => runtime.setLive(root, role, state, { at, source, ...extra });
  if (event === 'submit') {
    const launch = typeof input.prompt === 'string' && Boolean(process.env.C2H_BOOTSTRAP) && createHash('sha256').update(input.prompt).digest('hex') === process.env.C2H_BOOTSTRAP;
    try { runtime.setTurn(root, role, launch); } catch {}
    return set('working');
  }
  // 'ask' is the event name older executor settings used for AskUserQuestion.
  if (event === 'pre' || event === 'ask') {
    if (tool === 'AskUserQuestion') return set('native', { tool });
    // PreToolUse precedes PermissionRequest; process start jitter must not hide an open permission dialog.
    let current = null; try { current = runtime.liveState(root, role); } catch {}
    if (current?.state === 'native' && current.tool === tool && Math.abs(at - current.at) < 2000) return current;
    return set('working', { tool });
  }
  if (event === 'post') return set('working', { tool });
  if (event === 'permission') return set('native', { tool });
  if (event === 'notify') return NATIVE.includes(input.notification_type) ? set('native') : input.notification_type === 'idle_prompt' ? set('idle') : null;
  if (event === 'failure') return set('failed');
  if (event === 'stop') {
    const record = set('idle'), text = input.last_assistant_message;
    let launch = false; try { launch = runtime.bootstrapTurn(root, role); } catch {}
    if (!launch && typeof text === 'string' && text.trim()) await retry(() => runtime.appendActivity(root, role, text, { source: 'claude-assistant' }));
    return record;
  }
  return null;
}

// Status line: records account rate limits and this role's context use, then prints one short line.
export function statusLine(root, role, input, at = Date.now()) {
  const parts = [], usage = claudeUsage(input, at), context = input?.context_window?.used_percentage;
  if (typeof context === 'number' && Number.isFinite(context) && context >= 0 && context <= 100) {
    parts.push(`ctx ${Math.round(context)}%`);
    try { runtime.setContext(root, role, context, { at, source: 'claude-statusline' }); } catch {}
  }
  if (usage) {
    parts.push(...usage.windows.map(window => `${window.label} ${Math.round(window.used)}%`));
    try { recordUsage({ ...usage, source: 'statusline' }); } catch {}
  }
  return parts.join(' · ');
}

// Claude non-executor roles only (claude-role.mjs): stdout is the hook reply, so nothing else may print there.
async function roleHook(root, role, event, input) {
  if (role === 'executor') return;
  const claudeRole = await import('./claude-role.mjs');
  if (event === 'snapshot') { claudeRole.snapshot(root, role); return; }
  const { block, notice } = claudeRole.settle(root, role, { stopHookActive: input.stop_hook_active === true });
  if (block) process.stdout.write(JSON.stringify({ decision: 'block', reason: block, ...(notice && notice !== block ? { systemMessage: notice } : {}) }) + '\n');
  else if (notice) process.stdout.write(JSON.stringify({ systemMessage: notice }) + '\n');
}

async function main() {
  // Spawn time, not post-import time: Claude starts hook processes in event order, so startup jitter must not reorder them.
  const event = process.argv[2], at = Math.floor(performance.timeOrigin);
  let text = ''; for await (const chunk of process.stdin) text += chunk;
  let input = {}; try { input = JSON.parse(text || '{}'); } catch { return; }
  const role = process.env.C2H_ROLE ?? 'executor';
  let root; try { root = fs.realpathSync(process.env.C2H_PROJECT ?? input.cwd); } catch { return; }
  try {
    if (event === 'snapshot' || event === 'settle') await roleHook(root, role, event, input);
    else if (event === 'statusline') process.stdout.write(statusLine(root, role, input, Date.now()) + '\n');
    else await recordEvent(root, role, event, input, at);
  } catch (error) { process.stderr.write(`c2h hook ${event}: ${error.message}\n`); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) await main();
