#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as runtime from './runtime.mjs';
import { start, runRole, rolePrompt } from './launch.mjs';

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    project: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    from: { type: 'string' }, to: { type: 'string' }, story: { type: 'string' }, message: { type: 'string' },
    review: { type: 'string' }, qa: { type: 'string' }, 'story-hash': { type: 'string' }, timeout: { type: 'string' }, note: { type: 'string' },
    approved: { type: 'boolean', default: false }, again: { type: 'boolean', default: false }, attach: { type: 'boolean', default: false },
  } });
  if (values.help || !positionals.length) return { usage: 'node .harness/bin/c2h.mjs [--project ROOT] COMMAND', commands: ['init', 'start [--attach]', 'run ROLE', 'prompt ROLE', 'inbox ROLE', 'send --from ROLE --to ROLE --story ID --message TEXT', 'ack ROLE ID', 'handoff STORY --approved', 'checkpoint STORY PHASE --note TEXT [--approved]', 'resume ROLE', 'status', 'review STORY [--again]', 'cancel-review REQUEST --approved --note REASON', 'reply REQUEST --review PATH [--qa PATH]', 'wait REQUEST [--timeout SECONDS]', 'listen ROLE [--timeout SECONDS]'] };
  const root = fs.realpathSync(values.project ?? process.cwd());
  const [command, first, second] = positionals;
  const arities = { init: 1, start: 1, run: 2, prompt: 2, inbox: 2, send: 1, ack: 3, handoff: 2, checkpoint: 3, resume: 2, status: 1, review: 2, 'cancel-review': 2, reply: 2, wait: 2, listen: 2 };
  if (!arities[command] || positionals.length !== arities[command]) throw new Error('Unknown command or wrong arguments; use --help.');
  const timeout = values.timeout === undefined ? undefined : Number(values.timeout);
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) throw new Error('Invalid timeout.');
  switch (command) {
    case 'init':
      // Project-local init repairs missing runtime directories; setup owns resource installation.
      if (!fs.existsSync(path.join(root, '.harness/WORKFLOW.md'))) throw new Error('Install project resources with node scripts/setup.mjs PROJECT first.');
      for (const role of runtime.ROLES) {
        const folder = path.join(root, '.harness/inbox', role);
        for (const target of [path.join(root, '.harness'), path.join(root, '.harness/inbox'), folder]) {
          try { if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing symlinked runtime directory.'); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        fs.mkdirSync(folder, { recursive: true });
      }
      return { initialized: root };
    case 'start': return start(root, { attach: values.attach });
    case 'run': runRole(root, first); return undefined;
    case 'prompt': return { role: first, prompt: rolePrompt(root, first) };
    case 'inbox': return runtime.inbox(root, first);
    case 'send': return { id: runtime.send(root, values.from, values.to, values.story, values.message) };
    case 'ack': runtime.ack(root, first, second); return { archived: second };
    case 'handoff': return { id: runtime.handoff(root, first, { approved: values.approved, expectedStoryHash: values['story-hash'] }) };
    case 'checkpoint': return runtime.checkpoint(root, first, second, values.note ?? '', { approved: values.approved });
    case 'resume': return runtime.resume(root, first);
    case 'status': return runtime.status(root);
    case 'review': return { id: runtime.requestReview(root, first, { again: values.again }) };
    case 'cancel-review': return runtime.cancelReview(root, first, { approved: values.approved, note: values.note });
    case 'reply': return { id: runtime.replyReview(root, first, values.review, values.qa) };
    case 'wait': return runtime.waitReview(root, first, { timeout: timeout ?? 1800 });
    case 'listen': return runtime.waitInbox(root, first, { timeout: timeout ?? 0 });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => { if (result !== undefined) console.log(JSON.stringify(result, null, 2)); })
    .catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
}
