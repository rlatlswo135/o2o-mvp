import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { ROLES, AGENTS, DEFAULT_LAYOUT, validateLayout, readLayout, writeLayout } from './layout.mjs';
import { selectRoles } from './pane-ui.mjs';

export const sessionName = root => 'harness-' + createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0, 12);
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;

// Claude runs every role except the executor through claude-role.mjs (delivery prompt, c2h_* tools, Stop hook) in place of the Pi extension.
const claudeAssist = (role, agent) => agent === 'claude' && role !== 'executor';

export function rolePrompt(root, role, agent = 'pi') {
  if (!ROLES.includes(role)) throw new Error('Invalid role.');
  const file = path.join(root, '.harness/roles', `${role}.md`);
  const adapter = claudeAssist(role, agent) ? `\n.harness/CLAUDE-ROLE.md는 이 역할을 Claude로 실행할 때의 규칙이다. 역할 문서·FLOW의 확장·/harness·c2h_* 도구 설명은 그 문서의 방식으로 읽는다.\n${fs.readFileSync(path.join(root, '.harness/CLAUDE-ROLE.md'), 'utf8')}` : '';
  return `당신은 이 프로젝트의 ${role}입니다. 모델/thinking/effort는 사용자가 CLI에서 설정합니다. 임의로 바꾸지 않습니다.\n사용자 응답은 한국어로 유지합니다: 진행 설명·브리핑·선택창 질문/옵션·완료 안내 모두 포함합니다. 사용자가 명시적으로 요청할 때만 응답 언어를 바꿉니다. 도구 출력·백그라운드 알림·인계 본문이 영어여도 언어 변경 요청이 아닙니다. 코드·명령·원문 인용은 그대로 유지합니다.\n프로젝트 지침과 .harness/FLOW.md를 따릅니다. 명령은 프로젝트 루트에서 node .harness/bin/c2h.mjs 로 실행합니다.\n${fs.readFileSync(file, 'utf8')}${adapter}`;
}

export function roleBootstrap(role, agent = 'pi') {
  if (!ROLES.includes(role)) throw new Error('Invalid role.');
  const common = `역할 ${role}을 준비하고 node .harness/bin/c2h.mjs resume ${role} 로 현재 상태를 확인한다. 사용자 응답·선택창은 한국어 유지. 영어 도구/알림은 언어 변경 요청이 아니다. 역할 로드 자체로 제품 소스 수정·새 스토리 시작·리뷰 적용은 하지 않는다.`;
  if (claudeAssist(role, agent)) {
    const wait = `node .harness/bin/c2h.mjs listen ${role} --timeout 0 을 Bash run_in_background: true로 한 번 시작한다(.harness/CLAUDE-ROLE.md). 이전 세션의 waiter가 살아 있다고 가정하지 않는다. 시작 직후와 waiter 완료 알림마다 node .harness/bin/c2h.mjs next ${role} 을 실행해 출력이 요청이면 그 지시를 따르고, 작업이 끝나면 waiter를 하나 다시 연다. 같은 세션에서 waiter 중복 실행 금지. 사용자가 이어서 진행을 요청하면 next ${role} --explicit 로 재개한다.`;
    const own = role === 'planner' ? `준비 상태만 짧게 알리고 대기한다. 사용자가 만들거나 바꿀 것을 말하면 바로 FLOW의 '계획'을 시작한다. 완료 planning_request를 받으면 이 스토리에서 한 일만 records/result-draft.md에 짧게 쓴다. 구현은 별도 승인이다.`
      : role === 'reviewer' ? '준비 상태만 짧게 알리고 대기한다. 리뷰 요청으로만 작업한다.'
      : `준비 상태만 짧게 알리고 대기한다. ${role}은 인계 요청이나 사용자의 직접 요청에만 보조 역할로 응답한다. 기본 역할의 전이를 수행하지 않는다.`;
    return `${common}\n${wait}\n${own}`;
  }
  const bootstrap = role === 'executor' ? `${common}\n.harness/FLOW.md의 '재개'와 '구현과 자동 구간'을 따른다. node .harness/bin/c2h.mjs listen executor --timeout 0 을 Bash run_in_background: true로 한 번 시작한다. 이전 세션의 대기 작업이 살아 있다고 가정하지 않는다. native background 완료 알림의 요청 ID를 재검증한다. 승인된 스토리 인계면 구현하고, 리뷰 회신이면 브리핑 후 resume의 auto 값에 따라 계획 대비 지적을 자동 반영·검증·완료한다. 취소/권한 거부는 알리고, 사용자가 이어서 진행을 요청하면 resume부터 재개한다. 같은 세션에서 waiter 중복 실행 금지.`
    : role === 'planner' ? `${common}\n준비 상태만 짧게 알리고 대기한다. 사용자가 만들거나 바꿀 것을 말하면 바로 FLOW의 '계획'을 시작한다. 확장이 전달한 완료 planning_request를 받으면 이 스토리에서 한 일만 records/result-draft.md에 짧게 쓴다(저장하면 result.md로 확정되고 나머지 스토리 파일은 지워진다). 그 뒤 사용자의 다음 스토리 요청을 기다린다. 자동 전달이 안 되면 /harness로 재개한다. 구현은 별도 승인이다.`
    : role === 'reviewer' ? `${common}\n준비 상태만 짧게 알리고 대기한다. 확장이 전달한 리뷰 요청으로만 작업하며, 전달이 안 되면 /harness로 재개한다.`
    : `${common}\n준비 상태만 짧게 알리고 대기한다. ${role}은 확장이 전달한 요청이나 사용자의 직접 요청에만 보조 역할로 응답한다. 전달이 안 되면 /harness로 재개한다. 기본 역할의 전이를 수행하지 않는다.`;
  return bootstrap;
}

// Harness-only Claude hooks and status line (every Claude role): display evidence only. Questions and permissions stay in Claude's own dialog.
export function claudeHooks(root, role) {
  const hook = event => [process.execPath, path.join(root, '.harness/bin/claude-hook.mjs'), event].map(quote).join(' ');
  const quick = event => [{ type: 'command', command: hook(event), async: true, timeout: 30 }];
  // Claude non-executor roles: the run boundary and the Stop-time forwarding run synchronously, since Stop can hand the model a reason to continue.
  // Every role: the Stop-time waiter check, so a turn does not end with the role deaf to requests.
  const assist = role !== undefined && role !== 'executor';
  const sync = event => [{ type: 'command', command: hook(event), timeout: 120 }];
  return { statusLine: { type: 'command', command: hook('statusline') }, hooks: {
    UserPromptSubmit: [{ hooks: quick('submit') }, ...(assist ? [{ hooks: sync('snapshot') }] : [])],
    PreToolUse: [{ matcher: '*', hooks: quick('pre') }],
    PostToolUse: [{ matcher: '*', hooks: quick('post') }],
    PermissionRequest: [{ matcher: '*', hooks: quick('permission') }],
    Notification: [{ hooks: quick('notify') }],
    Stop: [{ hooks: quick('stop') }, ...(assist ? [{ hooks: sync('settle') }] : []), ...(role !== undefined ? [{ hooks: sync('waiter') }] : [])],
    StopFailure: [{ hooks: quick('failure') }],
  } };
}

// `agent` is the CLI that runs the role; the saved layout decides when the caller passes none.
export function roleCommand(directory, role, env = process.env, agent) {
  const root = fs.realpathSync(directory);
  agent ??= readLayout(root).agents[role];
  if (!AGENTS.includes(agent)) throw new Error('Invalid agent.');
  const prompt = rolePrompt(root, role, agent);
  const bootstrap = roleBootstrap(role, agent);
  const args = [...(agent === 'claude' ? ['--settings', JSON.stringify(claudeHooks(root, role))] : []), '--append-system-prompt', prompt, bootstrap];
  // Hooks and the Pi extension recognise the launch prompt by hash: its reply is not an unread reply.
  return { command: agent, args, env: { ...env, C2H_ROLE: role, C2H_PROJECT: root, C2H_BOOTSTRAP: createHash('sha256').update(bootstrap).digest('hex') }, cwd: root };
}

export function runRole(root, role, agent) {
  const launch = roleCommand(root, role, process.env, agent);
  // A fresh launch redelivers anything unacknowledged, as a new Pi session does.
  if (claudeAssist(role, agent ?? readLayout(root).agents[role])) for (const name of ['run', 'dispatched']) fs.rmSync(path.join(root, '.harness/live', `${role}-${name}.json`), { force: true });
  const child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env, stdio: 'inherit' });
  // Keep the parent only to relay terminal termination and preserve native CLI exit status.
  let hangup = false;
  for (const signal of ['SIGTERM', 'SIGHUP']) process.on(signal, () => { hangup = true; child.kill(signal); });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
    // tmux (3.7b and master) crashes the whole server when a remain-on-exit pane dies while a queued terminal-query
    // reply is pending; such replies expire within ~0.6s, so the pane outlives a CLI that exits on its own.
    if (!hangup) setTimeout(() => {}, 2000);
  });
  return child;
}

export function sessionExists(directory, env = process.env) {
  const session = sessionName(directory);
  return spawnSync('tmux', ['has-session', '-t', session], { env, stdio: 'ignore' }).status === 0;
}

export function liveRoles(directory, env = process.env) {
  const result = spawnSync('tmux', ['list-panes', '-s', '-t', sessionName(directory), '-F', '#{@harness_role} #{pane_dead}'], { env, encoding: 'utf8', timeout: 5000 });
  if (result.error || result.status !== 0) return [];
  return byLayout(directory, result.stdout.trim().split('\n').filter(row => row.endsWith(' 0')).map(row => row.slice(0, -2)));
}

// Roles in layout order: one role always sits in the console window, so tmux listing order is not the layout order.
function byLayout(directory, found) {
  let order = []; try { order = readLayout(fs.realpathSync(directory)).roles; } catch {}
  const roles = [...new Set(found.filter(role => ROLES.includes(role)))];
  return [...order.filter(role => roles.includes(role)), ...roles.filter(role => !order.includes(role))];
}

function panesIn(root, env) {
  return execFileSync('tmux', ['list-panes', '-s', '-t', sessionName(root), '-F', '#{pane_id}|#{window_id}|#{@harness_role}|#{@harness_view}|#{pane_dead}|#{pane_active}|#{window_active}|#{session_attached}'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }).trim().split('\n').filter(Boolean).map(row => {
    const [pane, window, role, view, dead, active, windowActive, attached, ...extra] = row.split('|');
    if (extra.length || !/^%\d+$/.test(pane) || !/^@\d+$/.test(window) || ![dead, active, windowActive].every(flag => ['0', '1'].includes(flag)) || !/^\d+$/.test(attached)) throw new Error('Malformed session pane metadata.');
    return { pane, window, role, view, dead, focused: active === '1' && windowActive === '1' && attached !== '0' };
  });
}

const LEGACY = '세션 재시작 필요 · 이전 콘솔 배치 (tmux kill-session 후 다시 시작)';
// Console: the board plus one slot pane holding a selected role (or the placeholder before the first swap).
function managedConsole(panes, selected) {
  if (panes.some(p => p.view === 'town' || p.view === 'feed')) throw Object.assign(new Error(LEGACY), { code: 'C2H_LEGACY_CONSOLE' });
  const boards = panes.filter(p => p.view === 'board'), board = boards[0];
  const window = board ? panes.filter(p => p.window === board.window) : [], slot = window.find(p => p.pane !== board?.pane);
  if (boards.length !== 1 || board.role || board.dead !== '0' || window.length !== 2 || !(selected.includes(slot.role) || slot.view === 'slot')) throw new Error('Managed console is missing or malformed.');
  return { board, slot };
}

// A dead pane (remain-on-exit) can still be shown; a live pane wins if a role somehow has both.
function rolePane(panes, role) {
  const owned = panes.filter(p => p.role === role), live = owned.filter(p => p.dead === '0'), matches = live.length ? live : owned;
  if (matches.length !== 1) throw new Error(`Role pane unavailable or ambiguous: ${role}.`);
  return matches[0];
}

export function presentRole(root, role, { focus = false, env = process.env } = {}) {
  if (!ROLES.includes(role)) throw new Error('Invalid role.');
  const selected = readLayout(root).roles;
  if (!selected.includes(role)) throw new Error('Role not selected.');
  const all = panesIn(root, env), target = rolePane(all, role), tmux = (...args) => execFileSync('tmux', args, { env, stdio: 'ignore', timeout: 5000 });
  const console = all.some(p => ['board', 'town', 'feed'].includes(p.view));
  let window = target.window;
  if (console) {
    const { board, slot } = managedConsole(all, selected); window = board.window;
    if (target.pane !== slot.pane) tmux('swap-pane', '-d', '-s', target.pane, '-t', slot.pane);
  }
  if (focus) { tmux('select-window', '-t', window); tmux('select-pane', '-t', target.pane); }
  return { pane: target.pane, console };
}

// What the console shows now: the slot role and whether the user is in that pane (active pane, active window, attached).
export function consoleState(root, { env = process.env } = {}) {
  try {
    const { slot } = managedConsole(panesIn(root, env), readLayout(root).roles), role = slot.role || null;
    return { status: 'ready', slot: role, focus: role && slot.focused ? role : null };
  } catch (error) {
    return { status: error.code === 'C2H_LEGACY_CONSOLE' ? 'legacy' : 'missing', slot: null, focus: null, error: error.message };
  }
}

const TAB_CONDITION = '#{&&:#{@harness_role},#{@harness_console}}';
// Server-wide root binding: Tab in a console role pane returns to the board; anywhere else Tab passes through.
// A root Tab binding that is not the harness one is never replaced.
export function tabReturn({ env = process.env } = {}) {
  const tmux = (...args) => execFileSync('tmux', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  const current = tmux('list-keys', '-T', 'root').split('\n').find(line => /^bind-key\s+(?:-\S+\s+)*-T\s+root\s+Tab\s/.test(line));
  if (current && !current.includes('@harness_console')) return 'taken';
  if (!current) tmux('bind-key', '-n', 'Tab', 'if-shell', '-F', TAB_CONDITION, 'select-pane -L', 'send-keys Tab');
  return 'ready';
}

function livePane(root, role, env) {
  if (!readLayout(root).roles.includes(role)) throw new Error('Role not selected.');
  const matches = panesIn(root, env).filter(pane => pane.role === role && pane.dead === '0');
  if (matches.length !== 1) throw new Error('Role pane unavailable or ambiguous.');
  return matches[0].pane;
}

// history 0 captures only the visible screen; the board hashes it to notice a stalled role. escapes keeps text styling.
export function captureRole(root, role, { env = process.env, history = 300, escapes = false } = {}) {
  return execFileSync('tmux', ['capture-pane', '-p', '-J', ...(escapes ? ['-e'] : []), '-t', livePane(root, role, env), ...(history > 0 ? ['-S', `-${history}`] : [])], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3000, maxBuffer: 512 * 1024 });
}

// Types one line into a role's input and submits it, as the user would. Only the console's automatic resume uses it.
export function typeRole(root, role, text, { env = process.env } = {}) {
  const pane = livePane(root, role, env), tmux = (...args) => execFileSync('tmux', args, { env, stdio: 'ignore', timeout: 3000 });
  tmux('send-keys', '-t', pane, '-l', '--', text);
  // An Enter arriving with the text is taken as part of a paste (a newline), not as submit.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
  tmux('send-keys', '-t', pane, 'Enter');
}

export function start(directory, { layout, attach = false, env = process.env, interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY), pickRoles = false, persistLayout = false } = {}) {
  if (attach && !interactive) throw new Error('Attach requires an interactive terminal; use --no-attach.');
  const root = fs.realpathSync(directory);
  const cli = path.join(root, '.harness/bin/c2h.mjs');
  if (!fs.existsSync(cli)) throw new Error('Run Node setup first.');
  const session = sessionName(root);
  if (layout !== undefined) validateLayout(layout);
  const savedLayout = readLayout(root);
  const tmux = (...args) => execFileSync('tmux', args, { env, encoding: 'utf8' }).trim();
  const exists = sessionExists(root, env);
  const chosen = validateLayout(layout ?? (exists ? DEFAULT_LAYOUT : savedLayout));
  const persistChoice = layout !== undefined || persistLayout;
  if (!exists && layout === undefined && attach && interactive && pickRoles) {
    return selectRoles({ input: process.stdin, output: process.stderr, initial: chosen }).then(selected => {
      validateLayout(selected);
      return start(root, { layout: selected, attach, env, interactive, pickRoles, persistLayout: true });
    });
  }
  if (!exists) {
    const panes = {};
    // The layout file is only written once the session is up, so each pane is told its agent explicitly.
    const command = role => [process.execPath, cli, 'run', role, '--agent', chosen.agents[role]].map(quote).join(' ');
    let created = false;
    try {
      const [first, ...rest] = chosen.roles;
      panes[first] = tmux('new-session', '-d', '-s', session, '-n', 'agents', '-x', '160', '-y', '48', '-c', root, '-e', `PATH=${env.PATH ?? ''}`, '-P', '-F', '#{pane_id}', command(first));
      created = true;
      // Backstage only parks role panes until the console swaps them in, so a plain tiled grid is enough.
      for (const role of rest) {
        panes[role] = tmux('split-window', '-t', panes[first], '-c', root, '-P', '-F', '#{pane_id}', command(role));
        tmux('select-layout', '-t', `${session}:agents`, 'tiled');
      }
      for (const role of chosen.roles) {
        tmux('set-option', '-p', '-t', panes[role], '@harness_role', role);
        tmux('select-pane', '-t', panes[role], '-T', role);
      }
      const windowOptions = name => {
        tmux('set-option', '-w', '-t', `${session}:${name}`, 'remain-on-exit', 'on');
        tmux('set-option', '-w', '-t', `${session}:${name}`, 'pane-border-status', 'top');
        tmux('set-option', '-w', '-t', `${session}:${name}`, 'pane-border-format', ' #{@harness_role}#{@harness_view} ');
      };
      windowOptions('agents');
      // Console: placeholder takes the first role's backstage cell, the role moves into the slot, then the board opens on the left.
      const board = [process.execPath, cli, 'board', '--watch', '--console'].map(quote).join(' ');
      const placeholder = [process.execPath, '-e', 'process.stdout.write("\\n  이 역할은 console 창에 표시 중입니다.\\n"); setInterval(() => {}, 1 << 30);'].map(quote).join(' ');
      const slotPane = tmux('new-window', '-d', '-t', session, '-n', 'console', '-c', root, '-P', '-F', '#{pane_id}', placeholder);
      tmux('set-option', '-p', '-t', slotPane, '@harness_view', 'slot');
      tmux('select-pane', '-t', slotPane, '-T', 'console-slot');
      windowOptions('console');
      tmux('set-option', '-w', '-t', `${session}:console`, '@harness_console', '1');
      tmux('swap-pane', '-d', '-s', panes[chosen.roles[0]], '-t', slotPane);
      const boardPane = tmux('split-window', '-h', '-b', '-l', '50%', '-t', panes[chosen.roles[0]], '-c', root, '-P', '-F', '#{pane_id}', board);
      tmux('set-option', '-p', '-t', boardPane, '@harness_view', 'board');
      if (tmux('list-panes', '-t', `${session}:console`, '-F', '#{pane_id}').split('\n').length !== 2) throw new Error('Console must contain exactly two panes.');
      tmux('select-window', '-t', `${session}:console`);
      tmux('select-pane', '-t', boardPane);
      tabReturn({ env });
      if (persistChoice) writeLayout(root, chosen);
    } catch (error) {
      if (created) spawnSync('tmux', ['kill-session', '-t', session], { env, stdio: 'ignore' });
      throw error;
    }
  }
  const actualRoles = exists ? byLayout(root, tmux('list-panes', '-s', '-t', session, '-F', '#{@harness_role}').split('\n')) : chosen.roles;
  if (attach) {
    const action = env.TMUX ? 'switch-client' : 'attach-session';
    const result = spawnSync('tmux', [action, '-t', session], { env, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`tmux ${action} failed.`);
  }
  return { session, reused: exists, attach: `tmux attach-session -t ${session}`, roles: actualRoles, note: exists ? 'Existing panes preserved; no agents restarted or layout changed.' : 'Role CLIs launched. Login/trust/permission prompts remain interactive.' };
}
