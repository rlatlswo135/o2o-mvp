import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as runtime from './runtime.mjs';
import { readLayout } from './layout.mjs';
import { liveRoles, sessionName, presentRole, consoleState, tabReturn, captureRole, typeRole } from './launch.mjs';
import { fit, columns, clean } from './terminal.mjs';
import { renderConsole, colorMode } from './console-ui.mjs';
import { roleAlert, roleStatus, pose, pipeline, quietTracker, stallTracker, reviveTracker } from './signals.mjs';
import { displayUsage } from './usage.mjs';
export { fit } from './terminal.mjs';

// Workflow decisions, not detection of native permission dialogs or model activity.
export function workflowHints(status, quality) {
  const alerts = {}, executor = status.roles.executor?.action, planner = status.roles.planner?.action;
  if (status.phase === 'blocked' || executor === 'blocked' || status.errors?.length) return { alerts: { executor: '진행 중단 — 상태·원인 확인 필요' }, next: ['사용자'], reason: 'blocked' };
  if (status.checkpoint?.verification && quality?.request && status.phase === 'implementation_done' && status.checkpoint.verified_baseline !== quality.request.baseline)
    return { alerts: { executor: '수정 재리뷰·QA 재검증 자동 요청 — 이전 PASS 재사용 불가' }, next: ['executor'], reason: 'auto' };
  if (quality?.pending?.length) return { alerts, next: quality.pending, reason: 'checks' };
  // select_story (executor) and plan with a planning story (planner) are roles at rest: their pickers open only on a user
  // command or a returned design, and then the native dialog signals. Other roles may be working on the story meanwhile.
  // From implementation to completion the executor moves on its own; these steps alert only when it rests there (signals).
  if (status.roles.executor?.auto_stopped) return { alerts: { executor: status.roles.executor.qa_amendment ? 'QA 테스트 수정안 — 사용자 승인 필요' : '리뷰 한도 도달 — 사용자 선택 필요' }, next: ['사용자'], reason: 'workflow' };
  const completion = { recheck: '반영 검증 — 수정 재리뷰 자동 요청', apply: '재리뷰 회신 — 자동 반영', done: '반영 검증 — 자동 완료' }[status.roles.executor?.auto];
  const steps = { implementation_choices: '구현 완료 — 종합 검토 자동 요청', brief: '리뷰 회신 — 브리핑 후 자동 반영', review_decision: '계획 대비 리뷰 자동 반영', completion_choices: completion };
  if (steps[executor]) alerts.executor = steps[executor];
  if (planner === 'plan_next' && !status.roles.planner.result) alerts.planner = '완료 결과 자동 정리';
  if (alerts.executor && status.checkpoint?.verification) alerts.executor += ' · 완료는 현재 QA PASS 필요';
  if (Object.keys(alerts).length) return { alerts, next: Object.keys(alerts), reason: 'auto' };
  // A compacted story waits for the user's next request to the planner.
  if (planner === 'plan_next') return { alerts, next: ['사용자'], reason: 'workflow' };
  const next = status.phase === 'planning' || status.phase === 'done' ? ['planner'] : status.phase === 'reviewing' || status.phase === 'review_ready' ? ['reviewer'] : ['executor'];
  return { alerts, next, reason: 'workflow' };
}

export function boardState(root, { env = process.env, live = () => liveRoles(root, env) } = {}) {
  const status = runtime.status(root), running = live(), layout = readLayout(root), selected = layout.roles;
  // attention feeds the text board; problems are the console's harness-level lines (not tied to one role card).
  const attention = [...status.errors], problems = [...status.errors], issue = text => { attention.push(text); problems.push(text); };
  if (status.checkpoint?.phase === 'blocked') attention.push(status.checkpoint.note);
  let seen = {}; try { seen = runtime.consoleView(root).seen; } catch {}
  // A compacted story leaves the planner waiting for the user's next story, not summarizing (on a clone the completion
  // request stayed on the other machine, so the planner is simply done).
  const action = role => role === 'planner' && ['plan_next', 'done'].includes(status.roles.planner?.action) && status.roles.planner.result ? 'await_story' : status.roles[role]?.action ?? 'unknown';
  const roles = selected.map(role => ({ role, agent: layout.agents[role], inbox: status.inbox[role]?.length ?? 0, mail: mail(status.inbox[role]), live: running.includes(role), state: action(role), seen: seen[role] ?? 0, ...roleSignals(root, role) }));
  for (const row of roles) if (!row.live && row.inbox) attention.push(`${row.role}: ${row.inbox} pending; role unavailable`);
  for (const role of Object.keys(status.inbox)) if (!selected.includes(role) && status.inbox[role]?.length) issue(`${role}: ${status.inbox[role].length} inbox messages; role not selected`);
  // Review status matters only while reports are being collected: after the review the executor edits source on
  // purpose (fixes, done), so checking the frozen baseline then would raise a false "source changed" problem.
  const request = ['reviewing', 'review_ready', 'review_decision'].includes(status.phase) ? status.checkpoint?.request_id : null;
  let quality;
  if (request) {
    try { quality = runtime.qualityStatus(root, request); if (quality.pending.length) attention.push(`Checks pending: ${quality.pending.join(', ')}`); }
    catch (error) { if (!/Not a batch review request/.test(error.message)) issue(error.message); }
  }
  const hints = workflowHints(status, quality);
  hints.next = [...new Set(hints.next.map(role => role === '사용자' || roles.some(row => row.role === role) ? role : '사용자'))];
  for (const row of roles) { row.alert = hints.alerts[row.role] ?? null; row.hint = row.alert ? hints.reason : null; if (row.alert && hints.reason !== 'auto') attention.unshift(`${row.role}: ${row.alert}`); }
  const diagnostics = runtime.diagnose(root), stories = runtime.storyIndex(root);
  if (diagnostics.error) issue(diagnostics.error);
  if (diagnostics.busy) attention.push(diagnostics.next);
  if (diagnostics.limitation) issue(`Path diagnosis unavailable: ${diagnostics.limitation}`);
  if (diagnostics.baseline && !diagnostics.matched && !diagnostics.drift) issue(diagnostics.next);
  for (const story of stories) if (story.error) issue(`${story.id}: ${story.error}`);
  if (diagnostics.drift) for (const [kind, files] of Object.entries(diagnostics.drift)) if (files.length) issue(`${kind}: ${files.join(', ')}`);
  if (diagnostics.drift && diagnostics.next) issue(diagnostics.next);
  const story = status.story ?? diagnostics.story;
  let designPending = false;
  if (status.story && status.phase === 'planning' && selected.includes('designer')) try { designPending = runtime.designPending(root, status.story); } catch {}
  // While a requested design is still open the planner waits for the designer, so the designer is next.
  if (designPending && hints.reason === 'workflow') hints.next = ['designer'];
  const stage = { designPending, qaPending: Boolean(quality?.pending?.includes('qa')), blocked: status.phase === 'blocked' || hints.reason === 'blocked', started: Boolean(status.checkpoint?.approval) };
  let usage = null; try { usage = displayUsage(env); } catch {}
  // A finished story's result.md headline, "한 일" lines and checks for the complete screen.
  let outcome = null; if (status.phase === 'done' && status.story) try { outcome = runtime.storyOutcome(root, status.story); } catch {}
  return { story, phase: status.phase, outcome, workflow: JSON.stringify(status.checkpoint ?? null), next: hints.next, attention: [...new Set(attention)], problems: [...new Set(problems)], stories, roles, stage, usage, diagnostics, session: sessionName(root), root };
}

// The oldest unread inbox message, named for the console's bubble edge.
const KINDS = { message: '메시지', implementation_request: '구현 요청', review_request: '리뷰 요청', review_result: '리뷰 결과', planning_request: '계획 요청' };
function mail(queue = []) {
  const first = queue[0];
  return first ? { from: first.sender, label: first.target === 'qa' && first.kind === 'review_request' ? 'QA 요청' : KINDS[first.kind] ?? '메시지', count: queue.length } : null;
}

// One line of a reply for display: code blocks dropped, markdown markers stripped, control text removed.
// The first body line wins over a heading such as "## 결과".
export function gist(text) {
  const lines = String(text).replace(/```[\s\S]*?(```|$)/g, '\n').split('\n').map(line => {
    const heading = /^\s*#{1,6}\s/.test(line);
    return { heading, text: clean(line).replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim() };
  }).filter(line => line.text);
  return ((lines.find(line => !line.heading) ?? lines[0])?.text ?? '').slice(0, 200);
}

// Display-only evidence per role: hook/extension live state, the latest assistant reply and context use.
// The activity log is re-read only when its file changes; the console polls every second.
const replies = new Map();
function roleSignals(root, role) {
  let presence = null, lastReply = null, reply = null, ctx = null;
  try { presence = runtime.liveState(root, role); } catch {}
  try { ctx = runtime.contextState(root, role)?.percent ?? null; } catch {}
  try {
    const stat = fs.statSync(path.join(root, '.harness/activity', `${role}.json`), { throwIfNoEntry: false }), key = `${root}\0${role}`, stamp = stat ? `${stat.mtimeMs}:${stat.size}` : '';
    if (replies.get(key)?.stamp !== stamp) {
      const last = stat ? runtime.roleActivity(root, role).messages.at(-1) : null, at = last ? Date.parse(last.at) : null;
      replies.set(key, { stamp, at, reply: last ? { text: gist(last.text), at } : null });
    }
    ({ at: lastReply, reply } = replies.get(key));
  } catch {}
  return { presence, lastReply, reply, ctx };
}

export function renderBoard(state, width = 80, height = Infinity, { color = false } = {}) {
  width = Math.max(1, width); height = Math.max(1, height);
  if (state.detail) return [...JSON.stringify(state.detail, null, 2).split('\n').slice(0, Math.max(0, height - 1)), 'd: back | r: refresh | q: quit'].map(line => fit(line, width)).join('\n');
  const title = `${state.story ?? 'No active story'} | ${state.phase ?? 'planning'}`;
  const lines = [`c2kim harness | ${state.root ? path.basename(state.root) + ' | ' : ''}${title}`, `다음: ${(state.next ?? []).join(' + ') || '상태 확인'}`, '', 'ATTENTION'];
  lines.push(...(state.notice ? [`! ${state.notice}`] : []), ...(state.attention.length ? state.attention.map(item => `! ${item}`) : state.notice ? [] : ['  Clear']));
  lines.push('', 'BOARD');
  const lanes = [['Planning', ['planning']], ['Implementation', ['implementing', 'implementation_done']], ['Review', ['reviewing', 'review_ready', 'review_decision']], ['Fixing', ['fixing']], ['Done', ['done']], ['Blocked', ['blocked']]].map(([label, phases]) => {
    const cards = state.stories.filter(story => phases.includes(story.phase)).sort((a, b) => Number(b.id === state.story) - Number(a.id === state.story)).map(story => `${story.id}${story.id === state.story ? ' *' : ''}`);
    return { label, cards };
  });
  if (width >= 78) {
    const columnWidth = Math.floor((width - 6) / 3);
    const cell = value => { const text = fit(value, columnWidth); return text + ' '.repeat(columnWidth - [...text].reduce((sum, character) => sum + columns(character), 0)); };
    for (let start = 0; start < lanes.length; start += 3) {
      const group = lanes.slice(start, start + 3);
      lines.push(group.map(lane => cell(`${lane.label} (${lane.cards.length})`)).join(' | '));
      lines.push(group.map(lane => cell(lane.cards.slice(0, 2).join(', ') + (lane.cards.length > 2 ? ` +${lane.cards.length - 2}` : '') || '—')).join(' | '));
    }
  } else for (const lane of lanes) if (lane.cards.length) lines.push(`${lane.label}: ${lane.cards.join(' | ')}`);
  if (!state.stories.length) lines.push('  No stories');
  const queue = ['ROLE QUEUES', ...state.roles.flatMap((role, index) => [`${index === (state.selected ?? 0) ? '>' : ' '} ${role.role}: ${role.live ? 'live' : 'offline'} | inbox ${role.inbox} | ${role.state}`, ...(role.alert ? [`  ${role.hint === 'auto' ? '..' : '!!'} ${role.alert}`] : [])])];
  const footer = ['j/k, arrows: role | Enter: pane | d: details | r: refresh | q: quit'];
  return [...lines.slice(0, Math.max(0, height - queue.length - footer.length - 1)), '', ...queue, ...footer].slice(-height).map(line => {
    const text = fit(line, width);
    return color && (line.startsWith('! ') || line.startsWith('  !! ')) ? `\x1b[1;31m${text}\x1b[0m` : text;
  }).join('\n');
}

// Console rows: one alert, a status label, a pose and the context per role, plus the agent, the first line of the
// latest reply and the next inbox message. victory is the finished story whose complete screen is up, and since when.
export function consoleModel(state, { now = Date.now(), cursor = 0, notice = null, victory = null } = {}) {
  const roles = (state.roles ?? []).map(row => {
    const alert = roleAlert(row, now);
    return { role: row.role, status: roleStatus(row, now), alert, ctx: row.ctx ?? null, pose: pose(row, alert, now), agent: row.agent ?? null, reply: row.reply?.text ? row.reply : null, mail: row.mail ?? null };
  });
  // Once its complete screen is closed (Enter), a finished story is history and the board waits for the next one.
  const celebrating = Boolean(victory) && state.phase === 'done' && state.story === victory.story, waiting = state.phase === 'done' && !celebrating;
  return { project: state.root ?? null, story: state.story ?? null, phase: state.phase, waiting, next: state.next ?? [], pipeline: pipeline({ story: state.story, phase: state.phase, roles: roles.map(row => row.role), ...state.stage, waiting }),
    problems: state.problems ?? [], notice, usage: state.usage ?? null, roles, selected: cursor,
    // settled: the planner has turned the story into result.md and waits for the next one; settledAt: since when, in scene time.
    victory: celebrating
      ? { story: state.story, tau: Math.max(0, now - victory.at) / 1000, settled: settled(state), outcome: state.outcome ?? null,
        settledAt: Number.isFinite(victory.settledAt) ? Math.max(0, victory.settledAt - victory.at) / 1000 : null } : null };
}

const settled = state => (state.roles ?? []).find(row => row.role === 'planner')?.state === 'await_story';

// Console keys. There is deliberately no quit key: q, Esc and Ctrl-C do nothing. Enter on the complete screen closes it.
export function reduceConsoleKey(cursor, count, key, { celebrating = false } = {}) {
  if (key === 'r') return { cursor, action: 'refresh' };
  if (celebrating && ['return', 'enter'].includes(key)) return { cursor, action: 'dismiss' };
  if (!count) return { cursor, action: null };
  if (key === 'down' || key === 'j') return { cursor: (cursor + 1) % count, action: 'move' };
  if (key === 'up' || key === 'k') return { cursor: (cursor - 1 + count) % count, action: 'move' };
  if (['tab', 'return', 'enter'].includes(key)) return { cursor, action: 'focus' };
  return { cursor, action: null };
}

// One notification per badge change; alerts already present when the console starts stay silent.
export function alertNotifier(send, env = process.env) {
  let last = null;
  return rows => {
    if (last && env.C2KIM_NOTIFY !== 'off') for (const row of rows) if (row.alert && last[row.role] !== row.alert.kind) try { send(row.role, row.alert.badge); } catch {}
    last = Object.fromEntries(rows.map(row => [row.role, row.alert?.kind ?? null]));
  };
}

const detached = (command, args) => { const child = spawn(command, args, { stdio: 'ignore', detached: true }); child.on('error', () => {}); child.unref(); };
// Terminal bell plus a macOS notification. Role and badge are fixed strings; failures are ignored (display only).
export function notifyUser({ output = process.stdout, platform = process.platform, run = detached } = {}) {
  return (role, badge) => {
    try { output.write('\x07'); } catch {}
    if (platform === 'darwin') try { run('osascript', ['-e', `display notification "${role} · ${badge}" with title "C2KIM"`]); } catch {}
  };
}

const TIMING = { frame: 100, signals: 1000, state: 5000, debounce: 200 };
const TAB_TAKEN = 'Tab 복귀 키 설정 불가 · 기존 tmux 바인딩';

// Left pane of the console. It never exits on its own: there is no quit key and every error becomes a notice
// that the next tick retries. Only the pane going away (stream closed) or an explicit signal ends it.
export async function showConsole(root, { input = process.stdin, output = process.stdout, env = process.env, timing = TIMING, tmux = {}, notify } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') throw new Error('Console requires an interactive terminal.');
  const present = tmux.present ?? ((role, focus) => presentRole(root, role, { focus, env }));
  const where = tmux.state ?? (() => consoleState(root, { env })), live = tmux.roles ?? (() => liveRoles(root, env));
  const track = quietTracker({ capture: tmux.capture ?? (role => captureRole(root, role, { env, history: 0 })) }), stall = stallTracker();
  const revive = reviveTracker({ screen: tmux.screen ?? (role => captureRole(root, role, { env, history: 0, escapes: true })), type: tmux.type ?? ((role, text) => typeRole(root, role, text, { env })) });
  const ping = notify ?? notifyUser({ output }), alerts = alertNotifier(ping, env), color = colorMode(env);
  const errors = {}, timers = [], wasRaw = input.isRaw, wasFlowing = input.readableFlowing === true;
  // painted: rows on screen (null: unknown), so a frame rewrites only the rows that changed. celebrated: the done story at the last refresh.
  let state = { roles: [] }, cursor = 0, painted = null, pending = null, focused = null, legacy = null, tab = null, quiet = {}, stalled = {}, finished = false, done;
  let victory = null, celebrated;
  const cleared = () => { try { return runtime.consoleView(root).cleared; } catch { return null; } };
  const completion = new Promise(resolve => { done = resolve; });
  const roles = () => state.roles.map(row => row.role);
  const attempt = (slot, label, task) => {
    try { const result = task(); delete errors[slot]; return result; }
    catch (error) { errors[slot] = label ? `${label} · ${error.message}` : error.message; }
  };
  const notice = () => legacy ?? ['action', 'refresh', 'signals', 'seen'].map(slot => errors[slot]).find(Boolean) ?? tab;
  const draw = () => {
    if (finished) return;
    const width = output.columns ?? 80, height = output.rows ?? 24, now = Date.now();
    let text;
    try { text = renderConsole(consoleModel(state, { now, cursor, notice: notice(), victory }), width, height, { color, now }); }
    catch (error) { text = fit(`! 화면 그리기 실패 · ${error.message}`, width); }
    // Erase-then-write only the rows that changed: no full clear (no flicker) and no erase after a full-width row.
    const rows = text.split('\n'), before = painted ?? [], below = painted ? painted.length : height;
    const changed = rows.map((line, index) => before[index] === line ? '' : `\x1b[${index + 1};1H\x1b[2K${line}`).join('') + (rows.length < below ? `\x1b[${rows.length + 1};1H\x1b[J` : '');
    painted = rows;
    try { if (changed) output.write(changed); } catch {}
  };
  // Resize, or the periodic state refresh, repaints every row in case something else wrote to the pane.
  const repaint = () => { painted = null; draw(); };
  const refresh = () => attempt('refresh', '상태 갱신 실패', () => {
    const next = boardState(root, { env, live });
    for (const row of next.roles) Object.assign(row, { quiet: quiet[row.role] ?? false, stalled: stalled[row.role] ?? false });
    state = next; cursor = Math.min(cursor, Math.max(0, state.roles.length - 1));
    // The complete screen stays up until the user closes it with Enter, also across console restarts. Only a finish seen
    // while running notifies; a story already done at start just shows the screen.
    const story = state.phase === 'done' ? state.story : null;
    if (!story) victory = null;
    else if (victory?.story !== story && cleared() !== story) {
      victory = { story, at: Date.now() };
      if (celebrated !== undefined && story !== celebrated && env.C2KIM_NOTIFY !== 'off') try { ping(story, '스토리 완료'); } catch {}
    }
    celebrated = story;
    if (victory && settled(state)) victory.settledAt ??= Date.now();
    painted = null;
  });
  const mark = role => attempt('seen', '확인 시각 기록 실패', () => runtime.markSeen(root, role));
  const signals = () => {
    let place = { status: 'missing' }; try { place = where(); } catch {}
    legacy = place.status === 'legacy' ? place.error ?? '세션 재시작 필요' : null;
    // Seen moves only with the user: while they are in the role pane, and once more when they leave it.
    if (focused && place.focus !== focused) mark(focused);
    if (place.focus) mark(place.focus);
    focused = place.focus ?? null;
    if (!pending && roles().includes(place.slot)) cursor = roles().indexOf(place.slot);
    attempt('signals', '역할 신호 갱신 실패', () => {
      const seen = runtime.consoleView(root).seen;
      for (const row of state.roles) Object.assign(row, roleSignals(root, row.role), { seen: seen[row.role] ?? 0 });
      quiet = track(state.roles.map(row => ({ role: row.role, working: row.live && row.presence?.state === 'working' })));
      stalled = stall(state.roles.map(row => ({ role: row.role, key: row.hint === 'auto' && row.live && row.presence?.state === 'idle' ? row.state : null })));
      for (const row of state.roles) Object.assign(row, { quiet: quiet[row.role] ?? false, stalled: stalled[row.role] ?? false });
      for (const role of revive(state.roles)) if (env.C2KIM_NOTIFY !== 'off') try { ping(role, '응답 오류 · 자동 재개'); } catch {}
    });
    try { alerts(consoleModel(state).roles); } catch {}
  };
  const show = (role, focus) => attempt('action', null, () => { present(role, focus); runtime.selectConsoleRole(root, role); });
  const onKey = (text, key = {}) => {
    const name = key.ctrl || key.meta ? null : key.name ?? text, next = reduceConsoleKey(cursor, state.roles.length, name, { celebrating: Boolean(victory) });
    if (next.action === 'dismiss') {
      // Back to the roles with the planner picked: the next story starts there.
      attempt('action', '완료 확인 기록 실패', () => runtime.clearCompletion(root, victory.story));
      victory = null; clearTimeout(pending); pending = null;
      if (roles().includes('planner')) { cursor = roles().indexOf('planner'); show('planner', false); }
      painted = null;
    } else if (next.action === 'move') {
      cursor = next.cursor; clearTimeout(pending);
      const role = roles()[cursor];
      pending = setTimeout(() => { pending = null; show(role, false); draw(); }, timing.debounce);
    } else if (next.action === 'focus') {
      clearTimeout(pending); pending = null;
      if (roles()[cursor]) show(roles()[cursor], true);
    } else if (next.action === 'refresh') { refresh(); signals(); }
    draw();
  };
  const stop = () => { if (!finished) { finished = true; done(); } };
  const tick = task => () => { try { task(); } catch {} };
  try {
    readline.emitKeypressEvents(input); input.setRawMode(true); input.resume();
    output.write('\x1b[?1049h\x1b[?25l\x1b[2J');
    input.on('keypress', onKey); input.on('end', stop); input.on('close', stop); input.on('error', stop);
    output.on('close', stop); output.on('error', stop); output.on('resize', repaint);
    for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) process.on(signal, stop);
    try { tab = (tmux.tab ?? (() => tabReturn({ env })))() === 'taken' ? TAB_TAKEN : null; } catch (error) { tab = `Tab 복귀 키 확인 실패 · ${error.message}`; }
    refresh();
    try { const index = roles().indexOf(runtime.consoleView(root).role); if (index >= 0) cursor = index; } catch {}
    signals(); draw();
    timers.push(setInterval(tick(draw), timing.frame), setInterval(tick(signals), timing.signals), setInterval(tick(refresh), timing.state));
    await completion;
  } finally {
    timers.forEach(clearInterval); clearTimeout(pending);
    input.off('keypress', onKey); input.off('end', stop); input.off('close', stop); input.off('error', stop);
    output.off('close', stop); output.off('error', stop); output.off('resize', repaint);
    for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) process.off(signal, stop);
    try { input.setRawMode(wasRaw ?? false); } catch {}
    if (!wasFlowing) input.pause();
    try { if (!output.destroyed) output.write('\x1b[?25h\x1b[0m\x1b[?1049l'); } catch {}
  }
}

const colorful = () => process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb';

export function reduceBoardKey(state, key) {
  if (['q', 'escape', '\u001b', '\u0003'].includes(key)) return { ...state, quit: true };
  if (key === 'r') return { ...state, refresh: true };
  if (key === 'd') return { ...state, details: true };
  const count = state.roles.length;
  if (count && ['j', 'down', '\u001b[B'].includes(key)) return { ...state, selected: ((state.selected ?? 0) + 1) % count };
  if (count && ['k', 'up', '\u001b[A'].includes(key)) return { ...state, selected: ((state.selected ?? 0) - 1 + count) % count };
  if (['return', 'enter', '\r', '\n'].includes(key)) return { ...state, focus: true };
  return state;
}

export function focusRole(root, role) { return presentRole(root, role, { focus: true }).pane; }

// Text board for a plain terminal (`board --watch`); the tmux console runs showConsole instead.
export async function showBoard(root, { watch = false, consoleMode = false, input = process.stdin, output = process.stdout } = {}) {
  if (watch && consoleMode) return showConsole(root, { input, output });
  if (!watch) { output.write(renderBoard(boardState(root), output.columns ?? 100) + '\n'); return; }
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') throw new Error('Watch mode requires an interactive terminal.');
  let state = { ...boardState(root), selected: 0 }, timer, finished = false, resolve, reject;
  const wasRaw = input.isRaw, wasFlowing = input.readableFlowing === true, completion = new Promise((yes, no) => { resolve = yes; reject = no; });
  const draw = () => output.write('\u001b[2J\u001b[H' + renderBoard(state, output.columns ?? 80, output.rows ?? 24, { color: colorful() }) + '\x1b[?25l');
  const stop = error => { if (finished) return; finished = true; error ? reject(error) : resolve(); };
  const refresh = () => { try { state = { ...state, ...boardState(root) }; draw(); } catch (error) { stop(error); } };
  const onResize = () => { try { draw(); } catch (error) { stop(error); } };
  const onKey = (text, key = {}) => {
    try {
      const next = reduceBoardKey(state, key.ctrl && key.name === 'c' ? '\u0003' : key.name ?? text);
      if (next.quit) return stop();
      if (next.refresh) return refresh();
      if (next.details) {
        const role = state.roles[state.selected]?.role;
        if (state.detail) state.detail = null;
        else if (role) {
          const current = runtime.resume(root, role);
          state.detail = { role, story: current.story, phase: current.phase, action: current.action, note: current.checkpoint?.note, request: current.request?.id,
            inbox: runtime.inbox(root, role).map(message => ({ id: message.id, kind: message.kind, story: message.story })) };
        }
      }
      else if (next.focus) { try { focusRole(root, state.roles[state.selected]?.role); return stop(); } catch (error) { state.notice = error.message; } }
      else state = { ...next, detail: null };
      draw();
    } catch (error) { stop(error); }
  };
  const onEnd = () => stop(), onError = error => stop(error), onSignal = () => stop();
  try {
    readline.emitKeypressEvents(input); input.setRawMode(true); input.resume();
    output.write('\u001b[?1049h\u001b[?25l'); input.on('keypress', onKey); input.on('end', onEnd); input.on('close', onEnd); input.on('error', onError); output.on('close', onEnd); output.on('error', onError); output.on('resize', onResize);
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    draw(); timer = setInterval(() => { if (!state.detail) refresh(); }, 5000);
    await completion;
  } finally {
    clearInterval(timer); input.off('keypress', onKey); input.off('end', onEnd); input.off('close', onEnd); input.off('error', onError); output.off('close', onEnd); output.off('error', onError); output.off('resize', onResize);
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    input.setRawMode(wasRaw ?? false); if (!wasFlowing) input.pause();
    if (!output.destroyed) output.write('\u001b[?25h\u001b[0m\u001b[?1049l');
  }
}
