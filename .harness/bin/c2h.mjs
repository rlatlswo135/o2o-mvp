#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as runtime from './runtime.mjs';
import { start, runRole, liveRoles } from './launch.mjs';
import { validateLayout, readLayout, parseAgents } from './layout.mjs';
import { boardState, showBoard, focusRole } from './board.mjs';
import { codexUsage, recordUsage } from './usage.mjs';
import { runTool, nextPrompt, dispatched } from './claude-role.mjs';

// Protocol writers hold the lock only inside synchronous transactions. With a listener registered, a termination signal
// is handled after the running transaction has released the lock; without one the process can die holding it.
// Interactive commands keep the default signal behavior.
const INTERACTIVE = ['start', 'run', 'board', 'focus-role'];

export async function main(argv = process.argv.slice(2), { signals = false } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    project: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    from: { type: 'string' }, to: { type: 'string' }, story: { type: 'string' }, message: { type: 'string' },
    summary: { type: 'string' }, 'summary-hash': { type: 'string' },
    answers: { type: 'string' }, contract: { type: 'string' }, 'qa-hash': { type: 'string' }, criterion: { type: 'string' }, outcome: { type: 'string' }, evidence: { type: 'string' },
    review: { type: 'string' }, qa: { type: 'string' }, 'story-hash': { type: 'string' }, timeout: { type: 'string' }, note: { type: 'string' },
    approved: { type: 'boolean', default: false }, again: { type: 'boolean', default: false }, recheck: { type: 'boolean', default: false }, attach: { type: 'boolean', default: false }, since: { type: 'string' },
    'needs-planning': { type: 'boolean', default: false }, carry: { type: 'boolean', default: false }, watch: { type: 'boolean', default: false }, console: { type: 'boolean', default: false },
    roles: { type: 'string' }, agents: { type: 'string' }, agent: { type: 'string' }, state: { type: 'string' }, tool: { type: 'string' }, at: { type: 'string' }, choice: { type: 'string' }, percent: { type: 'string' }, args: { type: 'string' }, request: { type: 'string' }, explicit: { type: 'boolean', default: false }, headers: { type: 'string' }, design: { type: 'string' }, preview: { type: 'string' }, 'design-hash': { type: 'string' }, 'preview-hash': { type: 'string' },
  } });
  // activity-append, live-set, context-set and usage-record are hook/extension plumbing and stay out of the help list:
  // role models read this list and must not write the console's display records themselves.
  if (values.help || !positionals.length) return { usage: 'node .harness/bin/c2h.mjs [--project ROOT] COMMAND', commands: ['start [--attach] [--roles LIST] [--agents ROLE=claude|pi,...]', 'run ROLE [--agent claude|pi]', 'inbox ROLE', 'send --from ROLE --to ROLE --story ID --message TEXT', 'ack ROLE ID', 'handoff STORY --approved', 'checkpoint STORY PHASE --note TEXT [--approved]', 'resume ROLE', 'roles', 'status', 'review STORY [--again] [--approved]', 'cancel-review REQUEST --approved --note REASON', 'reply REQUEST --review PATH [--qa PATH]', 'wait REQUEST [--timeout SECONDS]', 'listen ROLE [--timeout SECONDS]', 'next ROLE [--explicit] [--request TEXT]', 'tool c2h_NAME [--args JSON | JSON on stdin]', 'design-direction STORY (--choice LABEL --note DETAILS | --carry) --story-hash HASH', 'design-ready STORY --design PATH --preview PATH [--needs-planning]', 'design-status STORY', 'quality STORY [--again|--recheck] [--roles LIST] [--approved]', 'changes STORY [--since approval|review]', 'submit-check REQUEST --from ROLE --review REPORT', 'quality-status REQUEST', 'compact-story STORY --summary PATH --approved', 'qa-interview STORY --answers JSON --story-hash HASH', 'qa-ready STORY --contract PATH', 'qa-status STORY', 'qa-result REQUEST --criterion ID --outcome pass|fail|blocked --evidence PATH', 'qa-amend STORY --approved --note REASON', 'activity ROLE', 'live ROLE', 'board [--watch] [--console]', 'board-state', 'diagnose', 'unlock --approved', 'restore-approved STORY --approved', 'verification-workspace REQUEST', 'focus-role ROLE'] };
  const root = fs.realpathSync(values.project ?? process.cwd());
  const [command, first, second] = positionals;
  const arities = { board: 1, 'live-set': 2, 'context-set': 2, 'usage-record': 2, live: 2, 'board-state': 1, 'activity-append': 2, activity: 2, diagnose: 1, unlock: 1, 'restore-approved': 2, changes: 2, 'verification-workspace': 2, 'focus-role': 2, 'qa-interview': 2, 'qa-ready': 2, 'qa-status': 2, 'qa-result': 2, 'qa-amend': 2, 'compact-story': 2, quality: 2, 'submit-check': 2, 'quality-status': 2, 'design-direction': 2, 'design-ready': 2, 'design-status': 2, start: 1, run: 2, inbox: 2, send: 1, ack: 3, handoff: 2, checkpoint: 3, resume: 2, roles: 1, status: 1, review: 2, 'cancel-review': 2, reply: 2, wait: 2, listen: 2, next: 2, tool: 2 };
  if (!arities[command] || positionals.length !== arities[command]) throw new Error('Unknown command or wrong arguments; use --help.');
  if (signals && !INTERACTIVE.includes(command)) for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => process.exit(128 + os.constants.signals[signal]));
  const timeout = values.timeout === undefined ? undefined : Number(values.timeout);
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) throw new Error('Invalid timeout.');
  switch (command) {
    case 'activity-append': return runtime.appendActivity(root, first, values.message ?? '');
    case 'activity': return runtime.roleActivity(root, first);
    case 'board': await showBoard(root, { watch: values.watch, consoleMode: values.console }); return undefined;
    case 'live-set': return runtime.setLive(root, first, values.state, { tool: values.tool, at: values.at === undefined ? undefined : Number(values.at), source: 'pi' });
    case 'live': return runtime.liveState(root, first);
    case 'board-state': return boardState(root);
    case 'context-set': {
      if (values.percent === undefined || !values.percent.trim()) throw new Error('Context percent required.');
      return runtime.setContext(root, first, Number(values.percent), { at: values.at === undefined ? undefined : Number(values.at), source: 'pi' });
    }
    // Account usage from provider response headers; only the parsed percentages and reset times are stored.
    case 'usage-record': {
      if (first !== 'codex') throw new Error('Only codex usage is recorded from headers.');
      const usage = codexUsage(JSON.parse(values.headers ?? 'null'), values.at === undefined ? Date.now() : Number(values.at));
      return { recorded: usage ? recordUsage({ ...usage, source: 'headers' }) : false };
    }
    case 'diagnose': return runtime.diagnose(root);
    case 'unlock': return runtime.unlock(root, { approved: values.approved });
    case 'restore-approved': return runtime.restoreApproved(root, first, { approved: values.approved });
    case 'changes': return runtime.changes(root, first, { since: values.since });
    case 'verification-workspace': return runtime.verificationWorkspace(root, first);
    case 'focus-role': return { pane: focusRole(root, first) };
    case 'qa-interview': return runtime.qaInterview(root, first, JSON.parse(values.answers ?? 'null'), { expectedStoryHash: values['story-hash'] });
    case 'qa-ready': return runtime.qaReady(root, first, values.contract);
    case 'qa-status': return { ready: runtime.qaStatus(root, first) };
    case 'qa-result': return runtime.qaResult(root, first, values.criterion, values.outcome, values.evidence);
    case 'qa-amend': return runtime.qaAmend(root, first, { approved: values.approved, note: values.note });
    case 'compact-story': return runtime.compactStory(root, first, { summary: values.summary, approved: values.approved, expectedSummaryHash: values['summary-hash'] });
    case 'design-direction': return runtime.designDirection(root, first, { choice: values.choice, note: values.note, expectedStoryHash: values['story-hash'], carry: values.carry });
    case 'design-ready': return runtime.designReady(root, first, { design: values.design, preview: values.preview, needsPlanning: values['needs-planning'] });
    case 'design-status': return runtime.designStatus(root, first);
    case 'start': {
      const layout = values.roles === undefined && values.agents === undefined ? undefined
        : validateLayout({ roles: values.roles === undefined ? readLayout(root).roles : values.roles.split(','), agents: values.agents === undefined ? undefined : parseAgents(values.agents) });
      return start(root, { attach: values.attach, layout, interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY), pickRoles: layout === undefined });
    }
    case 'run': runRole(root, first, values.agent); return undefined;
    case 'inbox': return runtime.inbox(root, first);
    case 'send': return { id: runtime.send(root, values.from, values.to, values.story, values.message) };
    case 'ack': { const acked = runtime.ack(root, first, second); return acked.closed ? { closed: acked.closed, id: second } : { archived: second }; }
    case 'handoff': return { id: runtime.handoff(root, first, { approved: values.approved, expectedStoryHash: values['story-hash'], sender: values.from,
      design: values.design, preview: values.preview, expectedDesignHash: values['design-hash'], expectedPreviewHash: values['preview-hash'], expectedQaHash: values['qa-hash'] }) };
    case 'checkpoint': return runtime.checkpoint(root, first, second, values.note ?? '', { approved: values.approved });
    case 'resume': return runtime.resume(root, first);
    case 'roles': return { roles: liveRoles(root) };
    case 'status': return runtime.status(root);
    case 'quality': {
      const state = runtime.resume(root, 'executor');
      if (state.busy || state.action === 'blocked') throw new Error(`Cannot request quality checks: ${JSON.stringify(state)}`);
      if (state.request && ['reviewing', 'review_ready', 'review_decision'].includes(state.phase) && !values.again) {
        if (state.story !== first) throw new Error('A different story review is active.');
        if (!state.request.checks) return { id: runtime.requestReview(root, first), checks: ['reviewer'], pending: state.response ? [] : ['reviewer'] };
        const quality = runtime.qualityStatus(root, state.request.id);
        return { id: quality.request.id, checks: quality.checks, pending: quality.pending, ...(quality.recovery ? { recovery: quality.recovery } : {}) };
      }
      const live = liveRoles(root), selected = readLayout(root).roles;
      // --roles narrows a repeat check; it never adds an unselected role. A recheck of verified fixes is the reviewer's
      // (plus QA under a QA contract): it reviews only what the fixes changed.
      if (values.recheck && values.roles !== undefined) throw new Error('--recheck chooses its own roles; drop --roles.');
      const subset = values.recheck ? ['reviewer', ...(state.checkpoint?.verification ? ['qa'] : [])] : values.roles === undefined ? null : values.roles.split(',');
      if (subset && !values.recheck && (!values.again || !subset.length || subset.some(role => !['reviewer', 'designer', 'qa'].includes(role)))) throw new Error('--roles needs --again and a list of reviewer, designer, qa.');
      const checks = ['reviewer', 'designer', 'qa'].filter(role => selected.includes(role) && live.includes(role) && (role !== 'designer' || state.checkpoint?.design) && (!subset || subset.includes(role)));
      if (state.checkpoint?.verification && !checks.includes('qa')) throw new Error('Required QA role is unavailable; restart that role explicitly. Missing QA is not PASS.');
      if (!checks.length) throw new Error('No selected quality-check role is running; start reviewer/QA or an approved-design designer.');
      return { id: runtime.requestReview(root, first, { again: values.again || values.recheck, recheck: values.recheck, extra: values.approved, checks }), checks };
    }
    case 'submit-check': return runtime.submitCheck(root, first, values.from, values.review);
    case 'quality-status': return runtime.qualityStatus(root, first);
    case 'review': return { id: runtime.requestReview(root, first, { again: values.again, extra: values.approved }) };
    case 'cancel-review': return runtime.cancelReview(root, first, { approved: values.approved, note: values.note });
    case 'reply': {
      const response = runtime.replyReview(root, first, values.review, values.qa);
      return typeof response === 'string' ? { id: response } : response;
    }
    case 'wait': return runtime.waitReview(root, first, { timeout: timeout ?? 1800 });
    case 'listen': {
      runtime.registerWaiter(root, first);
      try { return await runtime.waitInbox(root, first, { timeout: timeout ?? 0, skip: first === 'executor' ? undefined : dispatched(root, first) }); }
      finally { runtime.releaseWaiter(root, first); }
    }
    // Claude roles only: the delivery prompt and c2h_* tools that the Pi extension provides (see claude-role.mjs).
    case 'next': {
      const found = nextPrompt(root, first, { explicit: values.explicit, request: values.request ?? '' });
      return found.none ? `처리할 요청 없음 (${found.action}). ${found.note}` : [`[c2h next] 역할 ${found.role}${found.story ? ` · 스토리 ${found.story}` : ''}${found.message_id ? ` · 메시지 ${found.message_id}` : ''}`, ...found.instructions].join('\n');
    }
    case 'tool': {
      let given = values.args;
      if (given === undefined && !process.stdin.isTTY) { try { given = fs.readFileSync(0, 'utf8'); } catch { /* no stdin: the tool takes no arguments */ } }
      return runTool(root, first, given?.trim() ? JSON.parse(given) : {});
    }
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(undefined, { signals: true }).then(result => { if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2)); })
    .catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
}
