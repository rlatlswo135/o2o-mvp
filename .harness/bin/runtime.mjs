import * as fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export const ROLES = Object.freeze(['planner', 'executor', 'reviewer']);
const PHASES = ['planning', 'implementing', 'implementation_done', 'reviewing', 'review_ready', 'review_decision', 'fixing', 'done', 'blocked'];
const ID = /^\d{8}T\d{12}Z-[a-f0-9]{12}$/;
const STORY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_FILE = 131072;
const fail = message => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const roleCheck = role => check(ROLES.includes(role), 'Invalid role.');
const idCheck = id => check(matches(ID, id), 'Invalid message ID.');
const storyCheck = story => check(matches(STORY, story), 'Invalid story ID.');
const textCheck = (value, max, label) => check(typeof value === 'string' && value.trim() && [...value].length <= max, `${label} must contain 1–${max} characters.`);
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

function projectRoot(root) {
  const resolved = fs.realpathSync(root);
  check(fs.statSync(resolved).isDirectory(), 'Project must be a directory.');
  return resolved;
}

// Protocol paths never traverse symlinks, even symlinks pointing inside the project.
function safe(root, ...parts) {
  root = projectRoot(root);
  const file = path.resolve(root, ...parts);
  const rel = path.relative(root, file);
  check(rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), 'Path must stay inside the project.');
  let current = root;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (exists(current)) check(!fs.lstatSync(current).isSymbolicLink(), `Symlink not allowed: ${current}`);
  }
  return file;
}

function bytes(file, max = MAX_FILE) {
  const stat = fs.lstatSync(file);
  check(stat.isFile() && stat.size <= max, `Invalid or oversized file: ${file}`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const current = fs.fstatSync(fd);
    check(current.isFile() && current.size <= max, `Invalid file: ${file}`);
    const data = fs.readFileSync(fd);
    check(data.length <= max, `Oversized file: ${file}`);
    return data;
  } finally { fs.closeSync(fd); }
}

function json(file) {
  const data = JSON.parse(bytes(file).toString('utf8'));
  check(object(data), `Message must be a JSON object: ${path.basename(file)}`);
  return data;
}

function syncDirectory(folder) {
  const fd = fs.openSync(folder, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function atomic(root, file, data) {
  file = safe(root, file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = safe(root, `${file}.${randomBytes(6).toString('hex')}.tmp`);
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try {
    fs.renameSync(temp, file);
    syncDirectory(path.dirname(file));
  } finally { if (exists(temp)) fs.unlinkSync(temp); }
}
const encode = data => JSON.stringify(data, null, 2) + '\n';

function transaction(root, operation) {
  root = projectRoot(root);
  const file = safe(root, '.harness/.runtime.lock');
  // ponytail: one project lock; split only if protocol contention becomes measurable.
  // Never steal a stale lock: after a killed writer, inspect records before removing it.
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('Protocol lock busy; retry. Inspect interrupted writes before removing a stale lock.'); throw error; }
  try {
    fs.writeFileSync(fd, encode({ pid: process.pid, created: new Date().toISOString() }));
    fs.fsyncSync(fd);
    return operation(root);
  } finally { fs.closeSync(fd); fs.unlinkSync(file); }
}

export function storyDirectory(root, story) {
  storyCheck(story);
  return safe(root, '.harness/stories', story);
}
const storyHash = (root, story) => hash(bytes(safe(root, storyDirectory(root, story), 'story.md')));

export function sourceFingerprint(root, format = 'files-v1') {
  root = projectRoot(root);
  check(['files-v1', 'git-v1'].includes(format), 'Unknown source fingerprint format.');
  const digest = createHash('sha256'), names = new Map();
  if (format === 'files-v1') {
    digest.update('files-v1\0');
    const prefix = Buffer.from(root + path.sep);
    const visit = (folder, relative = Buffer.alloc(0)) => {
      for (const entry of fs.readdirSync(folder, { encoding: 'buffer', withFileTypes: true })) {
        const label = entry.name.toString();
        // Worktrees/submodules use a regular .git file; all representations are metadata.
        if (label === '.git' || !relative.length && label === '.harness' ||
          label === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink())) continue;
        const name = Buffer.concat([relative, entry.name]);
        if (entry.isDirectory()) visit(Buffer.concat([prefix, name]), Buffer.concat([name, Buffer.from('/')]));
        else names.set(name.toString('hex'), name);
      }
    };
    visit(Buffer.from(root));
  } else {
    // Unversioned historical requests keep their exact Git baseline, never a fallback snapshot.
    const git = (...args) => {
      try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }); }
      catch (error) { if (error.code === 'ENOENT') fail('Legacy review requires Git; restore it or explicitly cancel the unanswered review.'); throw error; }
    };
    check(projectRoot(git('rev-parse', '--show-toplevel').toString().trim()) === root, 'Use the Git repository root as project for legacy review.');
    let head;
    try { head = git('rev-parse', '--verify', 'HEAD'); } catch { head = null; }
    digest.update(head ?? 'UNBORN\n');
    digest.update(git('diff', '--cached', '--binary', ...(head ? ['HEAD'] : []), '--', '.', ':(exclude).harness/**'));
    const listing = git('ls-files', '-z', '--cached', '--others', '--exclude-standard');
    let start = 0;
    for (let i = 0; i < listing.length; i++) if (listing[i] === 0) {
      const name = listing.subarray(start, i); names.set(name.toString('hex'), name); start = i + 1;
    }
  }
  for (const name of [...names.values()].sort(Buffer.compare)) {
    if (!name.length || name.subarray(0, 9).equals(Buffer.from('.harness/'))) continue;
    const prefix = Buffer.from(root + path.sep);
    for (let i = 0; i < name.length; i++) if (name[i] === 47) {
      const parent = Buffer.concat([prefix, name.subarray(0, i)]);
      if (exists(parent)) check(!fs.lstatSync(parent).isSymbolicLink(), 'Source path traverses a symlink directory.');
    }
    const file = Buffer.concat([prefix, name]);
    digest.update(name).update('\0');
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!stat) digest.update('deleted');
    else if (stat.isSymbolicLink()) digest.update('link:').update(fs.readlinkSync(file, { encoding: 'buffer' }));
    else if (stat.isFile()) {
      digest.update(String(stat.mode)).update('\0');
      const content = createHash('sha256');
      const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        const chunk = Buffer.alloc(1024 * 1024);
        let n;
        while ((n = fs.readSync(fd, chunk, 0, chunk.length, null))) content.update(chunk.subarray(0, n));
      } finally { fs.closeSync(fd); }
      digest.update(content.digest());
    } else fail(`Cannot freeze directory/submodule: ${name}`);
    digest.update('\0');
  }
  return digest.digest('hex');
}

const reviewFingerprint = (root, request) => sourceFingerprint(root, request.fingerprint ?? 'git-v1');

function envelope(data, file) {
  idCheck(data.id); roleCheck(data.sender); roleCheck(data.target); storyCheck(data.story);
  textCheck(data.message, 16000, 'Message');
  check(!file || path.basename(file) === `${data.id}.json`, 'Mismatched envelope filename.');
  const kind = data.kind ?? 'message'; // Legacy generic notifications omitted kind.
  check(['message', 'implementation_request', 'review_request', 'review_result', 'planning_request'].includes(kind), 'Invalid message kind.');
  if (kind === 'implementation_request') {
    check(data.sender === 'planner' && data.target === 'executor' && data.approved === true && matches(HASH, data.story_hash), 'Invalid implementation request approval envelope.');
  } else if (kind === 'planning_request') {
    check(data.sender === 'executor' && data.target === 'planner' && data.approved === true && matches(HASH, data.story_hash) && matches(HASH, data.baseline) && data.fingerprint === 'files-v1', 'Invalid planning request completion envelope.');
  } else if (kind === 'review_request' || kind === 'review_result') {
    check(data.sender === (kind === 'review_request' ? 'executor' : 'reviewer') && data.target === (kind === 'review_request' ? 'reviewer' : 'executor') && matches(HASH, data.baseline), 'Invalid review envelope.');
    if (kind === 'review_result') idCheck(data.reply_to);
  }
  if (data.reply_to !== undefined) idCheck(data.reply_to);
  if (data.baseline !== undefined) check(matches(HASH, data.baseline), 'Invalid baseline.');
  if (data.fingerprint !== undefined) check(['files-v1', 'git-v1'].includes(data.fingerprint), 'Unknown source fingerprint format.');
  return data;
}

export function readMessage(file) {
  file = path.resolve(file);
  check(fs.realpathSync(path.dirname(file)) === path.dirname(file), 'Symlink message directory not allowed.');
  return envelope(json(file), file);
}

function messages(root, role, archived = false) {
  roleCheck(role);
  const folder = safe(root, '.harness/inbox', role, ...(archived ? ['processed'] : []));
  if (archived && !exists(folder)) return [];
  return fs.readdirSync(folder).filter(name => name.endsWith('.json')).sort().map(name => {
    const data = readMessage(safe(root, folder, name));
    check(data.target === role, 'Mismatched inbox target.');
    return data;
  });
}
export function inbox(root, role) { return messages(root, role); }
const allMessages = (root, role) => [...messages(root, role), ...messages(root, role, true)];

function locate(root, role, id) {
  roleCheck(role); idCheck(id);
  let file = safe(root, '.harness/inbox', role, `${id}.json`);
  if (!exists(file)) file = safe(root, '.harness/inbox', role, 'processed', `${id}.json`);
  let data;
  try { data = readMessage(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A concurrent ack can move the pending file between lookup and read.
    data = readMessage(safe(root, '.harness/inbox', role, 'processed', `${id}.json`));
  }
  check(data.target === role, 'Mismatched inbox target.');
  return data;
}

function deliver(root, sender, target, story, message, options = {}) {
  roleCheck(sender); roleCheck(target); storyCheck(story);
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', '000Z');
  const id = `${stamp}-${randomBytes(6).toString('hex')}`;
  const data = envelope({ ...options, id, sender, target, story, message, kind: options.kind ?? 'message' });
  const folder = safe(root, '.harness/inbox', target);
  check(fs.statSync(folder).isDirectory(), 'Run init first.');
  const encoded = encode(data); check(Buffer.byteLength(encoded) <= MAX_FILE, 'Message envelope too large.');
  atomic(root, safe(root, folder, `${id}.json`), encoded);
  return id;
}

export function send(root, sender, target, story, message, options = {}) {
  roleCheck(sender); roleCheck(target); storyCheck(story); textCheck(message, 16000, 'Message');
  check(object(options), 'Invalid send options.');
  // Typed messages must pass their stateful protocol gates, not merely schema checks.
  if (options.kind === 'review_request') {
    check(sender === 'executor' && target === 'reviewer' && matches(HASH, options.baseline), 'Invalid review request envelope.');
    return requestReview(root, story, options);
  }
  if (options.kind === 'review_result') {
    const request = reviewRequest(root, options.reply_to);
    check(sender === 'reviewer' && target === 'executor' && story === request.story && options.baseline === request.baseline &&
      (options.fingerprint === undefined || options.fingerprint === (request.fingerprint ?? 'git-v1')), 'Mismatched review response envelope.');
    const reports = JSON.parse(message);
    return replyReview(root, request.id, reports.review, reports.qa);
  }
  check(!options.kind || options.kind === 'message', 'Use approved handoff for implementation requests.');
  check(Object.keys(options).every(key => ['kind', 'reply_to', 'baseline'].includes(key)), 'Unsupported send option.');
  return transaction(root, root => deliver(root, sender, target, story, message, options));
}

function archive(root, role, id) {
  const data = locate(root, role, id);
  const folder = safe(root, '.harness/inbox', role);
  const from = safe(root, folder, `${id}.json`);
  if (exists(from)) {
    const to = safe(root, folder, 'processed', `${id}.json`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    check(!exists(to), 'Duplicate pending and processed message.');
    fs.renameSync(from, to);
    syncDirectory(path.dirname(to)); syncDirectory(folder);
  }
  return data;
}
export function ack(root, role, id) { return transaction(root, root => archive(root, role, id)); }

export function reviewRequest(root, id) {
  const data = locate(root, 'reviewer', id);
  check(data.kind === 'review_request', 'Invalid review request envelope.');
  storyDirectory(root, data.story);
  return data;
}

function responses(root, request) {
  const result = allMessages(root, 'executor').filter(data => data.kind === 'review_result' && data.reply_to === request.id);
  for (const data of result) check(data.story === request.story && data.baseline === request.baseline, 'Mismatched review response envelope.');
  check(result.length <= 1, 'Duplicate review responses.');
  return result;
}
function openReviews(root) {
  return allMessages(root, 'reviewer').filter(data => data.kind === 'review_request' && !data.cancelled && !responses(root, data).length);
}

function reportInfo(root, story, filename) {
  check(typeof filename === 'string' && filename.length <= 4096, 'Report path must be a string.');
  const file = safe(root, filename);
  const rel = path.relative(storyDirectory(root, story), file);
  check(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel) && path.extname(file) === '.md', 'Review and QA reports must be Markdown files inside the story directory.');
  return [path.relative(projectRoot(root), file).split(path.sep).join('/'), hash(bytes(file))];
}
function verifyResponse(root, request, response, checkSource = true) {
  if (checkSource) check(reviewFingerprint(root, request) === request.baseline, 'Source changed since the review request; ask for a new review.');
  const reports = JSON.parse(response.message);
  check(object(reports) && object(reports.hashes), 'Invalid review report envelope.');
  for (const key of ('qa' in reports ? ['review', 'qa'] : ['review'])) {
    const [file, digest] = reportInfo(root, request.story, reports[key]);
    check(reports.hashes[file] === digest, 'Review report changed after delivery; request a new briefing.');
  }
  return response;
}

const checkpointText = state => `# c2h checkpoint\n\nScope revision, explicit approval and workflow evidence. Do not edit this generated record.\n\n\`\`\`json\n${encode(state)}\`\`\`\n`;
function loadState(root) {
  const file = safe(root, '.harness/active.json');
  if (!exists(file)) {
    const stories = safe(root, '.harness/stories');
    if (exists(stories)) for (const entry of fs.readdirSync(stories, { withFileTypes: true })) {
      if (entry.isDirectory()) check(!exists(safe(root, stories, entry.name, 'checkpoint.md')), 'Missing active.json for existing Markdown checkpoint.');
    }
    check(!ROLES.some(role => allMessages(root, role).some(data => data.kind === 'implementation_request')), 'Missing active checkpoint for recorded approval.');
    return null;
  }
  const state = json(file);
  storyCheck(state.story);
  check(PHASES.includes(state.phase) && matches(HASH, state.story_hash), 'Invalid active checkpoint.');
  textCheck(state.note, 16000, 'Checkpoint note');
  check(bytes(safe(root, storyDirectory(root, state.story), 'checkpoint.md')).toString() === checkpointText(state), 'Checkpoint Markdown contradicts active.json.');
  if (state.phase !== 'planning' || state.approval) check(storyHash(root, state.story) === state.story_hash, 'Story scope revision changed; resolve approval before continuing.');
  if (state.approval) {
    check(object(state.approval) && state.approval.story_hash === state.story_hash && ['handoff', 'implementation', 'fix'].includes(state.approval.kind), 'Invalid recorded approval.');
    if (state.approval.kind === 'handoff') {
      const message = locate(root, 'executor', state.approval.message_id);
      check(message.kind === 'implementation_request' && message.story === state.story && message.story_hash === state.story_hash, 'Mismatched approval envelope.');
    }
  }
  if (state.request_id) {
    const request = reviewRequest(root, state.request_id);
    check(request.story === state.story, 'Mismatched checkpoint review request.');
  }
  if (state.approval?.kind === 'fix') {
    const response = locate(root, 'executor', state.approval.response_id);
    const request = reviewRequest(root, response.reply_to);
    check(response.kind === 'review_result' && response.story === state.story && response.baseline === request.baseline, 'Mismatched fix approval response.');
    verifyResponse(root, request, response, false);
  }
  if (state.verified_baseline !== undefined) check(matches(HASH, state.verified_baseline), 'Invalid verified implementation baseline.');
  if (state.completion) validateCompletion(root, state);
  if (state.planning_from) {
    const message = locate(root, 'planner', state.planning_from);
    const completed = completionCheckpoint(root, message.story);
    check(completed.completion.message_id === message.id, 'Mismatched predecessor planning request.');
  }
  const old = legacy(root);
  check(!old || old.story === state.story || state.phase === 'done', 'CURRENT contradicts active story.');
  return state;
}
function validateCompletion(root, state) {
  check(state.phase === 'done' && object(state.completion) && matches(HASH, state.completion.baseline) && ['reviewed', 'user_verified_fixes'].includes(state.completion.basis), 'Invalid completion record.');
  const message = locate(root, 'planner', state.completion.message_id);
  check(message.kind === 'planning_request' && message.story === state.story && message.story_hash === state.story_hash && message.baseline === state.completion.baseline, 'Mismatched planning request completion.');
  const request = reviewRequest(root, state.request_id), response = responses(root, request)[0];
  check(request.story === state.story && response && !request.cancelled, 'Missing or invalid completed review result.');
  verifyResponse(root, request, response, false);
}

function completionCheckpoint(root, story) {
  const text = bytes(safe(root, storyDirectory(root, story), 'checkpoint.md')).toString();
  const encoded = text.match(/\n```json\n([\s\S]*)```\n$/)?.[1];
  check(encoded, 'Missing generated completion checkpoint.');
  const state = JSON.parse(encoded);
  check(object(state) && state.story === story && state.story_hash === storyHash(root, story) && checkpointText(state) === text, 'Invalid generated completion checkpoint.');
  validateCompletion(root, state);
  return state;
}

function recoverCompletion(root, story) {
  // Explicit approved retry only: finish an already recorded completion, never infer approval.
  const saved = completionCheckpoint(root, story), before = json(safe(root, '.harness/active.json'));
  const expected = { ...before, phase: 'done', note: saved.note, completion: saved.completion, updated: saved.updated };
  delete expected.planning_from;
  check(before.story === story && ['implementation_done', 'review_decision'].includes(before.phase) && encode(expected) === encode(saved), 'Completion recovery does not match the preceding checkpoint.');
  check(sourceFingerprint(root) === saved.completion.baseline, 'Source changed since recorded completion; do not recover automatically.');
  const manual = before.phase === 'implementation_done';
  check(!manual || before.approval?.kind === 'fix' && before.verified_baseline === saved.completion.baseline, 'Missing verified fixes for completion recovery.');
  const request = reviewRequest(root, saved.request_id);
  verifyResponse(root, request, responses(root, request)[0], !manual);
  check(!openReviews(root).length && !messages(root, 'executor').some(data => data.story === story && ['implementation_request', 'review_result'].includes(data.kind)), 'Unresolved messages block completion recovery.');
  return saveState(root, saved);
}

function guardStory(state, story) {
  check(!state || state.story === story || state.phase === 'done', 'Another active story must be resolved first.');
}
const completionChoices = state => state.approval?.kind === 'fix' && ['implementation_done', 'review_decision'].includes(state.phase);
const CURRENT_NEXT = {
  planning: ['planner', '계획을 정리하고 c2h_plan_next에서 handoff / refine / discuss를 선택한다.'],
  implementing: ['executor', '승인된 범위만 구현·검증하고 implementation.md에 증거를 기록한다.'],
  implementation_done: ['executor', '구현 완료. review / refine / discuss를 선택한다. 자동 인계 금지.'],
  reviewing: ['reviewer', '기존 요청으로 코드 리뷰를 진행한다. 소스 수정 금지.'],
  review_ready: ['reviewer', '저장된 리뷰 초안을 확인하고 send / discuss를 선택한다. 자동 회신 금지.'],
  review_decision: ['executor', '리뷰 결과를 검증·브리핑하고 AskUserQuestion으로 accept / feedback을 선택한다. 수정은 개별 수정안 승인 필요.'],
  fixing: ['executor', '명시적으로 승인된 지적만 수정·검증한다.'],
  completion_choices: ['executor', 'AskUserQuestion으로 확인 완료 · 스토리 종료 / 문제 있음 · 논의·수정 / 추가 리뷰 요청을 선택한다. 선택 전 완료·수정·재리뷰 금지.'],
  done: ['planner', '사용자 확인으로 스토리 완료. 완료 인계를 검증하고 다음 스토리 계획만 시작한다. 구현은 별도 승인 필요.'],
  blocked: ['사용자', '작업 중단. checkpoint의 원인과 필요한 결정을 확인한다.'],
};

function saveState(root, state, updated = new Date().toISOString()) {
  const saved = { ...state, updated };
  const markdown = checkpointText(saved), encoded = encode(saved);
  check(Buffer.byteLength(markdown) <= MAX_FILE && Buffer.byteLength(encoded) <= MAX_FILE, 'Checkpoint record too large.');
  const pointerFile = safe(root, '.harness/CURRENT.md');
  let pointer = exists(pointerFile) ? bytes(pointerFile).toString() : '# 현재 작업 포인터\n';
  const field = /^([ \t]*[-*]?[ \t]*(?:현재 스토리|current story|story)[ \t]*:[ \t]*).*$/im;
  pointer = field.test(pointer) ? pointer.replace(field, `$1${state.story}`) : `${pointer}\n- 현재 스토리: ${state.story}\n`;
  pointer = pointer.replace(/^([ \t]*[-*]?[ \t]*스토리 문서[ \t]*:[ \t]*).*$/m, `$1.harness/stories/${state.story}/story.md`);
  // Only the leading summary is managed; user sections (even same-named fields) stay intact.
  const section = pointer.search(/^#{2,6}[ \t]/m);
  let summary = section < 0 ? pointer : pointer.slice(0, section);
  const guidance = section < 0 ? '' : pointer.slice(section);
  const [role, action] = CURRENT_NEXT[completionChoices(state) ? 'completion_choices' : state.phase];
  for (const [label, value] of [['다음 담당 역할', role], ['이번 작업 초점', `${state.story} / ${state.phase}`], ['다음 행동', action]]) {
    const field = new RegExp(`^([ \\t]*[-*]?[ \\t]*${label}[ \\t]*:[ \\t]*).*`, 'gm');
    summary = field.test(summary) ? summary.replace(field, (_line, prefix) => prefix + value) : `${summary.trimEnd()}\n- ${label}: ${value}\n\n`;
  }
  pointer = summary + guidance;
  check(currentStoryId(pointer) === state.story && Buffer.byteLength(pointer) <= MAX_FILE, 'CURRENT contains conflicting custom pointers; resolve them before switching stories.');
  atomic(root, safe(root, storyDirectory(root, state.story), 'checkpoint.md'), markdown);
  atomic(root, safe(root, '.harness/active.json'), encoded);
  atomic(root, pointerFile, pointer);
  return saved;
}
function legacyEvidence(root, old = legacy(root)) {
  if (old?.phase === 'done') return null;
  const requests = openReviews(root);
  check(requests.length <= 1, 'Multiple open review requests.');
  if (requests.length) {
    check(!old || old.story === requests[0].story, 'Legacy story contradicts review request.');
    return { request: requests[0] };
  }
  const results = (old ? allMessages(root, 'executor').filter(data => data.story === old.story) : messages(root, 'executor'))
    .filter(data => data.kind === 'review_result').sort((a, b) => a.id.localeCompare(b.id));
  check(new Set(results.map(data => data.story)).size <= 1, 'Multiple legacy review stories; set CURRENT explicitly.');
  if (results.length) {
    const response = results.at(-1), request = reviewRequest(root, response.reply_to);
    check(request.story === response.story && !request.cancelled, 'Legacy review response contradicts request.');
    responses(root, request); verifyResponse(root, request, response, false);
    return { request, response };
  }
  check(!old?.recorded || !['REVIEW', 'REVIEWING', 'REVIEW_READY', 'REVIEW_DECISION', 'FIX', 'FIXING'].includes(old.recorded), 'Legacy review state is missing its request/result envelope; inspect records instead of approving anew.');
  return null;
}

function baseState(root, story, state) {
  const old = state ? null : legacy(root);
  guardStory(state ?? old, story);
  if (state?.story === story) return { ...state, ...(!state.approval && state.phase === 'planning' ? { story_hash: storyHash(root, story) } : {}) };
  const recovered = state ? null : legacyEvidence(root, old);
  check(!recovered || recovered.request.story === story, 'Another active story must be resolved first.');
  return { story, story_hash: storyHash(root, story),
    ...(state?.completion && messages(root, 'planner').some(data => data.id === state.completion.message_id) ? { planning_from: state.completion.message_id } : {}),
    ...(recovered ? {
    phase: recovered.response ? 'review_decision' : 'reviewing', request_id: recovered.request.id,
  } : {}) };
}

export function handoff(root, story, { approved = false, expectedStoryHash } = {}) {
  check(approved === true, 'Explicit approval is required for handoff.');
  return transaction(root, root => {
    let state = baseState(root, story, loadState(root));
    if (expectedStoryHash !== undefined) check(matches(HASH, expectedStoryHash) && state.story_hash === expectedStoryHash, 'Story changed since approval selection; ask again.');
    check(!openReviews(root).length, 'A review is still open; do not change source.');
    if (state.approval?.kind === 'handoff') return state.approval.message_id;
    check(!state.phase || ['planning', 'blocked'].includes(state.phase), 'Handoff cannot restart completed or in-progress implementation.');
    const pending = messages(root, 'executor').filter(data => data.kind === 'implementation_request');
    check(pending.every(data => data.story === story && data.story_hash === state.story_hash) && pending.length <= 1, 'A different approval scope is pending.');
    const id = pending[0]?.id ?? deliver(root, 'planner', 'executor', story, 'Implement this explicitly approved story revision.', { kind: 'implementation_request', approved: true, story_hash: state.story_hash });
    state = { ...state, phase: 'implementing', note: 'User explicitly approved planner handoff.', approval: { kind: 'handoff', story_hash: state.story_hash, message_id: id } };
    saveState(root, state);
    return id;
  });
}

export function requestReview(root, story, expected = {}) {
  check(object(expected) && (expected.again === undefined || typeof expected.again === 'boolean'), 'Invalid review options.');
  const checkExpected = request => {
    if ('baseline' in expected) check(expected.baseline === request.baseline &&
      (expected.fingerprint === undefined || expected.fingerprint === (request.fingerprint ?? 'git-v1')), 'Invalid review request envelope.');
  };
  return transaction(root, root => {
    const state = baseState(root, story, loadState(root));
    bytes(safe(root, storyDirectory(root, story), 'implementation.md'));
    if (state.request_id && ['reviewing', 'review_ready', 'review_decision'].includes(state.phase)) {
      const request = reviewRequest(root, state.request_id);
      check(!request.cancelled, 'Review request was cancelled; inspect interrupted cancellation.');
      check(reviewFingerprint(root, request) === request.baseline, 'Source changed during pending review.');
      const response = responses(root, request)[0];
      if (response) verifyResponse(root, request, response);
      check(state.phase !== 'review_decision' || response, 'Missing review result envelope.');
      checkExpected(request);
      if (!expected.again || state.phase !== 'review_decision') return request.id;
      check(completionChoices(state), 'Only post-fix completion choices allow another review of a delivered result.');
      check(!messages(root, 'executor').some(data => data.id === response.id), 'Brief and acknowledge the previous result before another review.');
    }
    check(!state.phase || state.phase === 'implementation_done' || expected.again && completionChoices(state), 'Complete implementation before requesting review.');
    const pending = openReviews(root);
    check(pending.length <= 1 && pending.every(data => data.story === story), 'A review request is still pending for another story.');
    const baseline = pending.length ? reviewFingerprint(root, pending[0]) : sourceFingerprint(root);
    if (pending.length) check(pending[0].baseline === baseline, 'Source changed during pending review.');
    const snapshot = pending[0] ?? { kind: 'review_request', baseline, fingerprint: 'files-v1' };
    checkExpected(snapshot);
    const id = pending[0]?.id ?? deliver(root, 'executor', 'reviewer', story, 'Review the frozen implementation; save draft before explicit reply.', snapshot);
    if (state.request_id !== id) saveState(root, { ...state, phase: 'reviewing', note: 'Frozen implementation sent for review.', request_id: id });
    return id;
  });
}

export function replyReview(root, id, review, qa) {
  return transaction(root, root => {
    const request = reviewRequest(root, id);
    check(!request.cancelled, 'Review request was cancelled.');
    const state = baseState(root, request.story, loadState(root));
    check(!state.request_id || state.request_id === id, 'A different review request is active.');
    const reports = { review: reportInfo(root, request.story, review) };
    if (qa !== undefined && qa !== null) reports.qa = reportInfo(root, request.story, qa);
    let response = responses(root, request)[0];
    if (response) {
      verifyResponse(root, request, response);
      const sent = JSON.parse(response.message);
      check(Object.entries(reports).every(([key, [file]]) => sent[key] === file) && ('qa' in sent) === ('qa' in reports), 'Sent reports are immutable; retry with original report paths.');
    } else {
      check(reviewFingerprint(root, request) === request.baseline, 'Source changed during review; request a new review.');
      const message = JSON.stringify({ ...Object.fromEntries(Object.entries(reports).map(([key, info]) => [key, info[0]])), hashes: Object.fromEntries(Object.values(reports)) });
      const responseId = deliver(root, 'reviewer', 'executor', request.story, message, { kind: 'review_result', reply_to: id, baseline: request.baseline });
      response = locate(root, 'executor', responseId);
    }
    if (!state.request_id || ['reviewing', 'review_ready'].includes(state.phase)) saveState(root, { ...state, phase: 'review_decision', note: 'Review sent; brief findings and wait for explicit fix selection.', request_id: id });
    archive(root, 'reviewer', id);
    return response.id;
  });
}

export function cancelReview(root, id, { approved = false, note } = {}) {
  check(approved === true, 'Explicit approval is required to cancel review.');
  textCheck(note, 16000, 'Cancellation note');
  return transaction(root, root => {
    const request = reviewRequest(root, id);
    const state = baseState(root, request.story, loadState(root));
    check(state.request_id === id && !responses(root, request).length, 'Only the active unanswered review can be cancelled.');
    const record = { ...request, cancelled: true, cancel_note: note };
    const folder = safe(root, '.harness/inbox/reviewer');
    const pending = safe(root, folder, `${id}.json`);
    atomic(root, exists(pending) ? pending : safe(root, folder, 'processed', `${id}.json`), encode(record));
    archive(root, 'reviewer', id);
    const { request_id, ...rest } = state;
    // Cancelling re-review must not discard or broaden the preceding selected-fix approval.
    if (state.approval?.kind === 'fix') rest.request_id = locate(root, 'executor', state.approval.response_id).reply_to;
    return saveState(root, { ...rest, phase: state.approval ? 'implementation_done' : 'blocked', note });
  });
}

export function checkpoint(root, story, phase, note, { approved = false } = {}) {
  check(PHASES.includes(phase), 'Invalid checkpoint phase.'); textCheck(note, 16000, 'Checkpoint note');
  check(typeof approved === 'boolean', 'Approval must be a boolean.');
  return transaction(root, root => {
    let state;
    try { state = baseState(root, story, loadState(root)); }
    catch (error) {
      if (phase === 'done' && approved && error.message === 'Checkpoint Markdown contradicts active.json.') return recoverCompletion(root, story);
      throw error;
    }
    const allowed = {
      planning: ['planning', 'implementing', 'blocked'],
      implementing: ['implementing', 'implementation_done', 'blocked'],
      implementation_done: ['implementing', 'fixing', 'implementation_done', 'done', 'blocked'],
      reviewing: ['reviewing', 'review_ready', 'blocked'],
      review_ready: ['reviewing', 'review_ready', 'blocked'],
      review_decision: ['review_decision', 'fixing', 'done', 'blocked'],
      fixing: ['fixing', 'implementation_done', 'blocked'],
      done: ['done'], blocked: PHASES,
    };
    check(!state.phase || allowed[state.phase].includes(phase), `Invalid checkpoint transition: ${state.phase} → ${phase}.`);
    if (phase === 'done' || state.phase === 'blocked' && phase !== 'blocked') check(approved, 'Explicit approval is required for completion or blocked recovery.');
    const open = openReviews(root);
    check(!open.length || (open.length === 1 && open[0].story === story && ['reviewing', 'review_ready', 'blocked'].includes(phase)), 'An open review prevents this transition.');
    if (['implementing', 'fixing'].includes(phase)) {
      let continuingFix = false;
      check(!['reviewing', 'review_ready'].includes(state.phase), 'Review states do not allow source changes.');
      if (phase === 'fixing') {
        check(state.request_id, 'Fix approval requires a recorded review.');
        const request = reviewRequest(root, state.request_id);
        const response = responses(root, request)[0];
        check(response, 'Fix approval requires a review result.');
        const sameFix = state.approval?.kind === 'fix' && state.approval.response_id === response.id;
        continuingFix = ['fixing', 'blocked'].includes(state.phase) && sameFix;
        const completedFix = state.phase === 'implementation_done' && sameFix;
        check(approved || continuingFix, 'Explicit fix approval is required.');
        if (approved && continuingFix && state.phase === 'fixing') check(note === state.approval.note, 'In-progress fix scope cannot be replaced; finish verification before approving a different scope.');
        if (completedFix) check(state.verified_baseline && sourceFingerprint(root) === state.verified_baseline, 'Source changed since implementation verification; verify before approving new fixes.');
        verifyResponse(root, request, response, !continuingFix && !completedFix);
      } else {
        check(!state.request_id && state.approval?.kind !== 'fix', 'After review use explicit fix approval, not implementing.');
        check(approved || state.approval, 'Recorded implementation approval is required.');
      }
      if (approved && !continuingFix) state = { ...state, approval: {
        kind: phase === 'fixing' ? 'fix' : 'implementation', story_hash: state.story_hash, note,
        ...(phase === 'fixing' ? { response_id: responses(root, reviewRequest(root, state.request_id))[0].id } : {}),
      } };
    }
    if (['reviewing', 'review_ready', 'review_decision'].includes(phase)) {
      check(state.request_id, 'Missing review request; request review first.');
      const request = reviewRequest(root, state.request_id);
      check(reviewFingerprint(root, request) === request.baseline, 'Source changed during review.');
      if (phase === 'review_decision') check(responses(root, request).length, 'Missing review result.');
      else check(!responses(root, request).length, 'Sent review cannot return to draft.');
    }
    if (phase === 'done') {
      if (state.phase === 'done') return saveState(root, state, state.updated); // Refresh CURRENT without changing the settled checkpoint pair or delivery.
      check(['implementation_done', 'review_decision'].includes(state.phase), 'Complete and verify implementation before final completion.');
      check(state.request_id, 'Final completion requires a reviewed implementation.');
      const request = reviewRequest(root, state.request_id), response = responses(root, request)[0];
      check(response, 'Final completion requires a review result.');
      const manualFixes = state.phase === 'implementation_done';
      if (manualFixes) {
        check(state.approval?.kind === 'fix' && state.verified_baseline, 'Verified review-based fixes are required for manual completion.');
        check(sourceFingerprint(root) === state.verified_baseline, 'Source changed since implementation verification; verify again before user confirmation.');
      }
      verifyResponse(root, request, response, !manualFixes);
      bytes(safe(root, storyDirectory(root, story), 'implementation.md'));
      check(!messages(root, 'executor').some(data => data.story === story && ['implementation_request', 'review_result'].includes(data.kind)), 'Brief and acknowledge all typed handoffs/results before completion.');
      const baseline = sourceFingerprint(root);
      const pending = allMessages(root, 'planner').filter(data => data.kind === 'planning_request' && data.story === story);
      check(pending.length <= 1 && pending.every(data => data.story_hash === state.story_hash && data.baseline === baseline), 'Conflicting planning request; inspect interrupted completion.');
      const id = pending[0]?.id ?? deliver(root, 'executor', 'planner', story, 'User confirmed story completion. Plan the next story; implementation requires separate approval.', { kind: 'planning_request', approved: true, story_hash: state.story_hash, baseline, fingerprint: 'files-v1' });
      state = { ...state, completion: { baseline, message_id: id, basis: manualFixes ? 'user_verified_fixes' : 'reviewed' } };
      delete state.planning_from;
    }
    if (phase === 'implementation_done') {
      check(state.approval, 'Recorded implementation approval is required.');
      state = { ...state, verified_baseline: sourceFingerprint(root) };
    }
    return saveState(root, { ...state, phase, note });
  });
}

function currentStoryId(text) {
  const ids = new Set([...text.matchAll(/(?:현재 스토리|current story|story)\s*:\s*`?([A-Za-z0-9][A-Za-z0-9_-]{0,63})|\.harness\/stories\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})\/story\.md/gi)].map(match => match[1] || match[2]).filter(id => !['none', 'null'].includes(id.toLowerCase())));
  check(ids.size <= 1, 'Contradictory legacy CURRENT story pointers.');
  return [...ids][0] ?? null;
}

function legacy(root) {
  const file = safe(root, '.harness/CURRENT.md');
  if (!exists(file)) return null;
  const story = currentStoryId(bytes(file).toString());
  if (!story) return null;
  const markdown = bytes(safe(root, storyDirectory(root, story), 'story.md')).toString();
  const state = markdown.match(/(?:현재(?:\s*상태)?|상태|status|phase)\s*:\s*`?([A-Z_]+)/i)?.[1]?.toUpperCase();
  return { story, phase: state === 'DONE' ? 'done' : 'planning', legacy: true, recorded: state };
}

function resumed(root, role) {
  roleCheck(role);
  const state = loadState(root);
  const pending = messages(root, role);
  if (!state) {
    const old = legacy(root), recovered = legacyEvidence(root, old);
    if (recovered) {
      const { request, response } = recovered;
      check(reviewFingerprint(root, request) === request.baseline, 'Source changed during review.');
      if (response) {
        const action = role === 'executor' ? (pending.some(data => data.id === response.id) ? 'brief' : 'review_decision') : 'wait';
        return { story: request.story, phase: 'review_decision', action, checkpoint: null, request, message: response };
      }
      return { story: request.story, phase: 'reviewing', action: role === 'reviewer' ? 'review' : 'wait', checkpoint: null, request };
    }
    return { story: old?.story ?? null, phase: old?.phase ?? null, action: old?.phase === 'done' ? 'done' : role === 'planner' ? 'plan' : role === 'reviewer' ? 'wait' : 'select_story', checkpoint: null };
  }
  let request, response;
  if (state.request_id) {
    request = reviewRequest(root, state.request_id);
    response = responses(root, request)[0];
    const frozen = ['reviewing', 'review_ready', 'review_decision'].includes(state.phase);
    if (frozen) check(reviewFingerprint(root, request) === request.baseline, 'Source changed since the review request.');
    if (response) verifyResponse(root, request, response, frozen);
    if (state.phase === 'review_decision') check(response, 'Missing review result envelope.');
  }
  const open = openReviews(root);
  check(open.length <= 1 && open.every(item => item.id === state.request_id && ['reviewing', 'review_ready', 'blocked'].includes(state.phase)), 'Open review contradicts checkpoint.');
  let action = 'wait';
  if (state.phase === 'blocked') action = 'blocked';
  else if (state.phase === 'done') action = role === 'planner' && state.completion && pending.some(data => data.id === state.completion.message_id) ? 'plan_next' : 'done';
  else if (state.phase === 'planning') action = role === 'planner' ? (state.planning_from && pending.some(data => data.id === state.planning_from) ? 'plan_next' : 'plan') : 'select_story';
  else if (role === 'executor') {
    if (['implementing', 'fixing'].includes(state.phase)) {
      check(state.approval, 'Missing recorded approval.'); action = 'implement';
    } else if (state.phase === 'implementation_done') action = completionChoices(state) ? 'completion_choices' : 'implementation_choices';
    else if (response) action = pending.some(data => data.id === response.id) ? 'brief' : completionChoices(state) ? 'completion_choices' : 'review_decision';
  } else if (role === 'reviewer') {
    if (state.phase === 'implementation_done' && !completionChoices(state) || state.phase === 'reviewing' && !response) action = 'review';
    if (state.phase === 'review_ready' && !response) action = 'review_choices';
  }
  const message = action === 'plan_next' ? pending.find(data => data.id === (state.completion?.message_id ?? state.planning_from)) : action === 'brief' ? response : pending.find(data => data.kind === 'implementation_request' && data.story === state.story && data.story_hash === state.story_hash);
  return { story: state.story, phase: state.phase, action, checkpoint: state, ...(request ? { request } : {}), ...(message ? { message } : {}),
    ...(['blocked', 'implementation_done'].includes(state.phase) && state.verified_baseline && sourceFingerprint(root) !== state.verified_baseline
      ? { reverification_required: true } : {}) };
}

export function resume(root, role) {
  roleCheck(role);
  // Readers must not diagnose a writer's partially installed checkpoint as corruption.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const busy = () => exists(safe(root, '.harness/.runtime.lock'));
      const waiting = { story: null, phase: null, action: 'wait', checkpoint: null, busy: true };
      if (busy()) return waiting;
      const state = resumed(root, role);
      return busy() ? waiting : state;
    } catch (error) {
      if (attempt) return { story: null, phase: 'blocked', action: 'blocked', checkpoint: null, error: error.message };
    }
  }
}

// Resource maintenance is not blocked recovery or implementation approval.
export function maintenanceUpgrade(root, apply) {
  return transaction(root, root => {
    const state = loadState(root);
    check(state?.phase === 'blocked' && state.approval?.kind === 'fix' && state.verified_baseline && state.request_id,
      'Maintenance requires a blocked, verified review-based implementation.');
    for (const role of ROLES) {
      resumed(root, role); // Validate envelopes, frozen scope and report integrity under the lock.
      check(messages(root, role).length === 0, 'A pending message blocks maintenance; accept it first.');
    }
    check(openReviews(root).length === 0, 'An open review blocks maintenance.');
    const before = sourceFingerprint(root);
    check(before === state.verified_baseline, 'Unverified source changes block maintenance.');
    const receipt = safe(root, storyDirectory(root, state.story), 'maintenance.json');
    const result = apply();
    const after = sourceFingerprint(root);
    const maintenance = { story: state.story, before, after_resources: after,
      reverification_required: before !== after, updated: new Date().toISOString(),
      note: 'Harness maintenance only. Existing approval/checkpoint preserved. Reverify changed source before completion; resume recomputes drift, including later document migrations. This receipt is not approval or QA evidence.' };
    atomic(root, receipt, encode(maintenance));
    return { ...result, maintenance };
  });
}

export function status(root) {
  const errors = [], roles = {}, queues = {};
  for (const role of ROLES) {
    roles[role] = resume(root, role);
    if (roles[role].error) errors.push(`${role}: ${roles[role].error}`);
    try {
      queues[role] = inbox(root, role);
      for (const message of [...queues[role], ...messages(root, role, true)]) if (message.kind === 'review_result') {
        const request = reviewRequest(root, message.reply_to);
        responses(root, request);
        verifyResponse(root, request, message, false);
      }
    } catch (error) { queues[role] ??= []; errors.push(`${role} inbox: ${error.message}`); }
  }
  const state = roles.executor;
  return { story: state.story, phase: state.phase, checkpoint: state.checkpoint, roles, inbox: queues, errors };
}

function timeoutCheck(timeout, allowZero) {
  check(typeof timeout === 'number' && Number.isFinite(timeout) && (allowZero ? timeout >= 0 : timeout > 0) && timeout <= 3600, `Timeout must be ${allowZero ? 'at least 0' : 'greater than 0'} and at most 3600 seconds.`);
}
export async function waitReview(root, id, { timeout = 1800 } = {}) {
  timeoutCheck(timeout, false);
  const deadline = performance.now() + timeout * 1000;
  while (true) {
    const request = reviewRequest(root, id);
    check(!request.cancelled, 'Review request was cancelled.');
    const response = responses(root, request)[0];
    if (response) return verifyResponse(root, request, response);
    check(reviewFingerprint(root, request) === request.baseline, 'Source changed during review.');
    const remaining = deadline - performance.now();
    check(remaining > 0, 'Review wait timed out. Request remains in inbox; do not resend blindly.');
    await sleep(Math.min(500, remaining));
  }
}

export async function waitInbox(root, role, { timeout = 0 } = {}) {
  roleCheck(role); timeoutCheck(timeout, true);
  const deadline = timeout ? performance.now() + timeout * 1000 : Infinity;
  const kinds = role === 'executor' ? ['implementation_request', 'review_result'] : role === 'reviewer' ? ['review_request'] : ['planning_request'];
  while (true) {
    const state = resume(root, role);
    check(state.action !== 'blocked', state.error || 'Workflow blocked; inspect status.');
    // ponytail: full source verification while frozen; optimize quiet polling if large repos make it costly.
    for (const message of state.busy ? [] : inbox(root, role).filter(data => kinds.includes(data.kind))) {
      if (message.kind === 'planning_request') {
        if (state.action !== 'plan_next' || state.message?.id !== message.id) continue;
        return message;
      }
      check(message.story === state.story, 'Typed message contradicts active story.');
      if (message.kind === 'implementation_request') {
        check(message.story_hash === storyHash(root, message.story), 'Approval scope revision changed.');
        // An unacked old handoff must not wake implementation again after review starts.
        if (state.action !== 'implement') continue;
      } else if (message.kind === 'review_result') {
        if (state.action !== 'brief') continue;
        verifyResponse(root, reviewRequest(root, message.reply_to), message);
        check(state.request?.id === message.reply_to, 'Mismatched active review response.');
      } else check(state.request?.id === message.id, 'Mismatched active review request.');
      return message;
    }
    const remaining = deadline - performance.now();
    check(remaining > 0, 'Inbox wait timed out. Messages remain unacknowledged.');
    await sleep(Math.min(500, remaining));
  }
}
