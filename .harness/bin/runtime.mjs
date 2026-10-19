import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ROLES, readLayout } from './layout.mjs';
import { interviewRecord, verificationContract, validateVerification, qaResults } from './qa-contract.mjs';
import { sourceManifest, diffManifest, copyProduct } from './evidence.mjs';
export { ROLES };
const assistRole = role => role === 'designer' || role === 'qa';
const PHASES = ['planning', 'implementing', 'implementation_done', 'reviewing', 'review_ready', 'review_decision', 'fixing', 'done', 'blocked'];
const ID = /^\d{8}T\d{12}Z-[a-f0-9]{12}$/;
const STORY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const HASH = /^[a-f0-9]{64}$/;
const FORMATS = ['files-v1', 'files-v2', 'files-v3', 'git-v1'];
const SNAPSHOTS = ['files-v1', 'files-v2', 'files-v3']; // Formats a verified or completion baseline may use.
const WORKSPACES = ['files-v2', 'files-v3']; // Formats whose file set a verification copy reproduces exactly.
// files-v2 skips agent tooling and OS metadata: they never change product behavior.
const AGENT_ROOTS = new Set(['.claude', '.pi']);
const EXCLUDED_NAMES = new Set(['AGENTS.md', 'CLAUDE.md', '.DS_Store', 'Thumbs.db']);
const MAX_REVIEW_ROUNDS = 3; // Review requests per story (initial review plus fix rechecks); cancelled ones do not count.
// Records written before files-v2 carry bare files-v1 baselines.
const verifiedFormat = state => state.verified_fingerprint ?? 'files-v1';
const completionFormat = completion => completion.fingerprint ?? 'files-v1';
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

function json(file, max = MAX_FILE) {
  const data = JSON.parse(bytes(file, max).toString('utf8'));
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

// The lock names its writer. A lock whose writer process is gone (killed mid-write) is stale; a live writer, or a lock
// just created and not yet written, is busy. pid reuse can make a stale lock look busy, never the reverse.
function lockOwner(root) {
  const file = safe(root, '.harness/.runtime.lock');
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  let pid;
  try { pid = JSON.parse(fs.readFileSync(file, 'utf8')).pid; } catch {}
  if (!Number.isSafeInteger(pid) || pid <= 0) return { file, stale: Date.now() - stat.mtimeMs > 60_000 };
  try { process.kill(pid, 0); return { file, pid, stale: false }; }
  catch (error) { return { file, pid, stale: error.code === 'ESRCH' }; }
}
const staleLock = lock => `Stale protocol lock: its writer${lock.pid ? ` (pid ${lock.pid})` : ''} stopped mid-write. Remove it with: node .harness/bin/c2h.mjs unlock --approved — then resume; an interrupted write shows up as a blocked record.`;

function transaction(root, operation) {
  root = projectRoot(root);
  const file = safe(root, '.harness/.runtime.lock');
  // ponytail: one project lock; split only if protocol contention becomes measurable.
  // Never steal a stale lock silently: removing it is the explicit unlock command.
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const lock = lockOwner(root);
    if (lock?.stale) throw Object.assign(new Error(staleLock(lock)), { code: 'C2H_LOCK_STALE' });
    throw Object.assign(new Error('Protocol lock busy; retry.'), { code: 'C2H_LOCK_BUSY' });
  }
  try {
    fs.writeFileSync(fd, encode({ pid: process.pid, created: new Date().toISOString() }));
    fs.fsyncSync(fd);
    return operation(root);
  } finally { fs.closeSync(fd); fs.unlinkSync(file); }
}

export function unlock(root, { approved = false } = {}) {
  check(approved === true, 'Explicit approval is required to remove a protocol lock.');
  root = projectRoot(root);
  const lock = lockOwner(root);
  if (!lock) return { unlocked: false, note: 'No protocol lock.' };
  check(lock.stale, `Protocol lock is held by a running writer${lock.pid ? ` (pid ${lock.pid})` : ''}; wait instead of removing it.`);
  fs.rmSync(lock.file, { force: true });
  return { unlocked: true, ...(lock.pid ? { pid: lock.pid } : {}), next: 'Check status and resume ROLE; an interrupted multi-file write shows up there as a blocked record.' };
}

export function storyDirectory(root, story) {
  storyCheck(story);
  return safe(root, '.harness/stories', story);
}
const storyHash = (root, story) => hash(bytes(safe(root, storyDirectory(root, story), 'story.md')));
// Generated workflow records live in records/ so a story folder leads with its human documents; a story that already
// keeps a record at the top level (written before records/ existed) keeps using it there.
function recordFile(root, story, name) {
  const folder = storyDirectory(root, story), legacy = safe(root, folder, name);
  return exists(legacy) ? legacy : safe(root, folder, 'records', name);
}

// files-v3 lists the files Git would offer to add in a fresh repository, so .gitignore'd build output and caches are not
// source. An empty scratch repository supplies no index; only the project's own .gitignore files are read (no global,
// system or info/exclude rules), so every machine lists the same files. Without Git, new baselines use files-v2.
let gitScratch, gitFound;
const gitEnv = () => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull });
function gitAvailable() {
  if (gitFound === undefined) try { execFileSync('git', ['--version'], { stdio: 'ignore', env: gitEnv() }); gitFound = true; } catch { gitFound = false; }
  return gitFound;
}
const currentFormat = () => gitAvailable() ? 'files-v3' : 'files-v2';
const v2Excluded = parts => AGENT_ROOTS.has(parts[0]) || parts[0] === '.harness' || parts.some(part => part === '.git' || part === 'node_modules') || EXCLUDED_NAMES.has(parts.at(-1));
function gitListing(root, relative = Buffer.alloc(0), depth = 0) {
  check(gitAvailable(), 'A files-v3 source baseline requires Git; restore Git, or explicitly cancel the unanswered review.');
  check(depth <= 16, 'Nested repository depth limit exceeded.');
  if (!gitScratch) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'c2h-git-'));
    process.once('exit', () => fs.rmSync(scratch, { recursive: true, force: true }));
    execFileSync('git', ['init', '--bare', '--quiet', '--template=', scratch], { stdio: 'ignore', env: gitEnv() });
    gitScratch = scratch;
  }
  const output = execFileSync('git', ['--git-dir', gitScratch, '--work-tree', path.join(root, relative.toString()), '-c', 'core.ignoreCase=false', '-c', 'core.fsmonitor=false',
    'ls-files', '-z', '--others', '--exclude-per-directory=.gitignore', '--exclude=node_modules', ...(depth ? [] : ['--exclude=/.harness/', '--exclude=/.claude/', '--exclude=/.pi/'])],
  { env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  const names = [];
  let start = 0;
  for (let i = 0; i < output.length; i++) if (output[i] === 0) {
    const name = Buffer.concat([relative, output.subarray(start, i)]); start = i + 1;
    // A nested repository is listed as one directory entry; its files follow the same rules from its own root.
    if (name.at(-1) === 47) names.push(...gitListing(root, name, depth + 1));
    else if (!v2Excluded(name.toString().split('/'))) names.push(name);
  }
  return names;
}

// cache (read-only polling only): reuses a file's content hash while its device, inode, size, times and mode are unchanged.
// Approval and mutation gates never pass one.
export function sourceFingerprint(root, format = currentFormat(), cache) {
  root = projectRoot(root);
  check(FORMATS.includes(format), 'Unknown source fingerprint format.');
  const digest = createHash('sha256'), names = new Map();
  if (format === 'files-v3') {
    digest.update('files-v3\0');
    for (const name of gitListing(root)) names.set(name.toString('hex'), name);
  } else if (format !== 'git-v1') {
    const v2 = format === 'files-v2';
    digest.update(`${format}\0`);
    const prefix = Buffer.from(root + path.sep);
    const visit = (folder, relative = Buffer.alloc(0)) => {
      for (const entry of fs.readdirSync(folder, { encoding: 'buffer', withFileTypes: true })) {
        const label = entry.name.toString();
        // Worktrees/submodules use a regular .git file; all representations are metadata.
        if (label === '.git' || !relative.length && label === '.harness' ||
          label === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink()) ||
          v2 && (!relative.length && AGENT_ROOTS.has(label) || !entry.isDirectory() && EXCLUDED_NAMES.has(label))) continue;
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
      const key = cache && file.toString('hex'), seen = cache?.get(key), version = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.mode}`;
      if (seen?.version === version) digest.update(seen.hash);
      else {
        const content = createHash('sha256');
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          const chunk = Buffer.alloc(1024 * 1024);
          let n;
          while ((n = fs.readSync(fd, chunk, 0, chunk.length, null))) content.update(chunk.subarray(0, n));
        } finally { fs.closeSync(fd); }
        const result = content.digest();
        cache?.set(key, { version, hash: result });
        digest.update(result);
      }
    } else fail(`Cannot freeze directory/submodule: ${name}`);
    digest.update('\0');
  }
  return digest.digest('hex');
}

const reviewFingerprint = (root, request) => sourceFingerprint(root, request.fingerprint ?? 'git-v1');

// Per-path manifest with the same file set as the fingerprint format, so drift lists and verification copies agree with it.
const manifestFor = (root, format) => sourceManifest(root, format === 'files-v3' ? { paths: gitListing(projectRoot(root)) } : {});

function saveSourceManifest(root, baseline, name, format) {
  let files;
  try { files = manifestFor(root, format); }
  catch (error) {
    check(sourceFingerprint(root, format) === baseline, 'Source changed while recording diagnostic baseline.');
    return { unavailable: error.message };
  }
  check(sourceFingerprint(root, format) === baseline, 'Source changed while recording diagnostic baseline.');
  const file = `.harness/baselines/${name}.json`, content = encode({ fingerprint: format, baseline, files });
  if (Buffer.byteLength(content) > 64 * 1024 * 1024) return { unavailable: 'Source diagnostic manifest exceeds size limit.' };
  atomic(root, safe(root, file), content);
  return { file, hash: hash(content) };
}

function readSourceManifest(root, reference, baseline, format) {
  check(object(reference) && matches(/^\.harness\/baselines\/[A-Za-z0-9_-]+\.json$/, reference.file) && matches(HASH, reference.hash), 'Invalid diagnostic manifest reference.');
  const file = safe(root, reference.file), content = bytes(file, 64 * 1024 * 1024);
  check(hash(content) === reference.hash, 'Source diagnostic manifest changed.');
  const record = JSON.parse(content);
  check(record.fingerprint === format && record.baseline === baseline && object(record.files), 'Source manifest baseline mismatch.');
  return record.files;
}

// Source at implementation approval: the base for `changes STORY`. Diagnostic only, so a busy tree never blocks approval.
function approvalSource(root, story) {
  const fingerprint = currentFormat();
  try {
    const baseline = sourceFingerprint(root, fingerprint);
    return { fingerprint, baseline, manifest: saveSourceManifest(root, baseline, `approved-${story}`, fingerprint) };
  } catch (error) { return { fingerprint, unavailable: error.message }; }
}

function envelope(data, file) {
  idCheck(data.id); roleCheck(data.sender); roleCheck(data.target); storyCheck(data.story);
  textCheck(data.message, 16000, 'Message');
  check(!file || path.basename(file) === `${data.id}.json`, 'Mismatched envelope filename.');
  const kind = data.kind ?? 'message'; // Legacy generic notifications omitted kind.
  check(['message', 'implementation_request', 'review_request', 'review_result', 'planning_request'].includes(kind), 'Invalid message kind.');
  if (kind === 'implementation_request') {
    check(['planner', 'designer'].includes(data.sender) && data.target === 'executor', 'Implementation request must go from planner or designer to executor.');
    check(data.approved === true, 'Implementation request lacks explicit approval.');
    check(matches(HASH, data.story_hash), 'Implementation request lacks a pinned story hash.');
    if (data.sender === 'designer') check(object(data.design) && matches(HASH, data.design.hash) && matches(HASH, data.design.preview_hash), 'Designer approval requires pinned design.');
    if (data.verification !== undefined) {
      check(object(data.verification) && matches(HASH, data.verification.hash), 'Invalid QA contract approval envelope.');
      check(data.verification.story_hash === data.story_hash, 'QA contract approval pins a different story revision.');
    }
  } else if (kind === 'planning_request') {
    check(data.sender === 'executor' && data.target === 'planner', 'Planning request must go from executor to planner.');
    check(data.approved === true, 'Planning request lacks recorded completion approval.');
    check(matches(HASH, data.story_hash), 'Planning request lacks a pinned story hash.');
    check(matches(HASH, data.baseline) && SNAPSHOTS.includes(data.fingerprint), 'Planning request lacks a completion source baseline.');
  } else if (kind === 'review_request' || kind === 'review_result') {
    const [sender, target] = kind === 'review_request' ? ['executor', 'reviewer'] : ['reviewer', 'executor'];
    check(data.sender === sender && data.target === target, `A ${kind} must go from ${sender} to ${target}.`);
    check(matches(HASH, data.baseline), `A ${kind} lacks its frozen source baseline.`);
    if (kind === 'review_result') idCheck(data.reply_to);
  }
  if (data.checks !== undefined) {
    check(kind === 'review_request', 'Only review requests carry quality participants.');
    check(Array.isArray(data.checks) && data.checks.length > 0 && data.checks.length <= 3 && new Set(data.checks).size === data.checks.length && data.checks.every(role => ['reviewer', 'designer', 'qa'].includes(role)), 'Invalid quality participants.');
    check(object(data.check_requests) && Object.keys(data.check_requests).every(role => data.checks.includes(role)) && data.checks.every(role => matches(ID, data.check_requests[role])), 'Invalid correlated quality requests.');
    check(!data.checks.includes('reviewer') || data.check_requests.reviewer === data.id, 'The reviewer part of a quality request must be the request itself.');
  }
  if (data.recheck_of !== undefined) { check(kind === 'review_request', 'Only review requests carry a recheck reference.'); idCheck(data.recheck_of); }
  if (data.consolidation_required !== undefined) check(kind === 'planning_request' && data.consolidation_required === true, 'Invalid story consolidation requirement.');
  // Earlier versions sealed with an object ({hash}); such stories still count as finished and get the same cleanup.
  if (data.compacted !== undefined) check(kind === 'planning_request' && (data.compacted === true || object(data.compacted)), 'Invalid compacted completion envelope.');
  if (data.reply_to !== undefined) idCheck(data.reply_to);
  if (data.baseline !== undefined) check(matches(HASH, data.baseline), 'Invalid baseline.');
  if (data.fingerprint !== undefined) check(FORMATS.includes(data.fingerprint), 'Unknown source fingerprint format.');
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
  if ((archived || assistRole(role)) && !exists(folder)) return [];
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
  check(fs.statSync(folder).isDirectory(), 'Run setup first.');
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
  return transaction(root, root => { subrequest(root, sender, target, story, message); return deliver(root, sender, target, story, message, options); });
}

// Typed role requests travel as JSON inside plain messages and the Pi extension acts on them, so their shape and story
// revision are checked when written instead of being skipped by the receiver. [sender, target, required, optional fields]
const SUBREQUESTS = {
  c2h_design_request: ['planner', 'designer', ['story_hash'], ['message', 'keep_direction']],
  c2h_qa_request: ['planner', 'qa', ['story_hash'], []],
  c2h_plan_feedback: ['designer', 'planner', ['story_hash', 'design', 'message'], []],
  c2h_qa_ready: ['qa', 'planner', ['story_hash', 'hash'], []],
};
const FIELDS = {
  story_hash: value => matches(HASH, value), hash: value => matches(HASH, value), keep_direction: value => value === true,
  message: value => typeof value === 'string' && Boolean(value.trim()) && [...value].length <= 8000,
  design: value => object(value) && typeof value.file === 'string' && typeof value.preview === 'string' && matches(HASH, value.hash) && matches(HASH, value.preview_hash),
};
function subrequest(root, sender, target, story, message) {
  let body;
  try { body = JSON.parse(message); } catch { return; }
  if (!object(body) || typeof body.type !== 'string' || !body.type.startsWith('c2h_')) return;
  check(body.type !== 'c2h_quality_request', 'Quality requests are created by the quality command, not sent.');
  check(Object.hasOwn(SUBREQUESTS, body.type), `Unknown typed request ${body.type}.`);
  const [from, to, required, optional] = SUBREQUESTS[body.type];
  check(sender === from && target === to, `${body.type} must go from ${from} to ${to}.`);
  for (const key of Object.keys(body)) check(key === 'type' || required.includes(key) || optional.includes(key), `${body.type} has unknown field ${key}.`);
  for (const key of required) check(FIELDS[key](body[key]), `${body.type} has invalid or missing ${key}.`);
  for (const key of optional) if (key in body) check(FIELDS[key](body[key]), `${body.type} has invalid ${key}.`);
  check(body.story_hash === storyHash(root, story), `${body.type} names a different story revision; re-read story.md and send again.`);
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
export function ack(root, role, id) {
  return transaction(root, root => {
    const message = locate(root, role, id);
    if (message.kind === 'planning_request') {
      const current = loadState(root);
      const completed = completionCheckpoint(root, message.story);
      check(completed.completion.message_id === id, 'Mismatched planning request completion.');
      if (completed.completion.consolidation_required) {
        check(compactedRecord(root, message.story), 'Finalize story consolidation before acknowledging completion.');
        check(!compactionPending(root, message.story), 'Compaction cleanup pending; retry compact-story before acknowledgement.');
        check(current?.story !== message.story && current?.planning_from === id, 'Record the next planning checkpoint before acknowledging completion handoff.');
      }
    }
    return archive(root, role, id);
  });
}

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
  if (compactedRecord(root, request.story)) return response; // Its reports left with the finished story.
  const reports = JSON.parse(response.message);
  check(object(reports) && object(reports.hashes), 'Invalid review report envelope.');
  if (request.checks) {
    check(reports.review === reports.combined, 'Combined quality response does not point at its combined report.');
    for (const role of request.checks) {
      const file = recordFile(root, request.story, `quality-${request.id}-${role}.json`);
      check(exists(file), `Combined quality response lacks the ${role} receipt.`);
      const receipt = json(file);
      if (role === 'qa' && request.verification) validateQaReceipt(root, request, receipt);
      check(receipt.request_id === request.id && receipt.role === role && receipt.baseline === request.baseline, `The ${role} quality receipt belongs to a different request.`);
      check(reports[role] === receipt.report && reports.hashes[receipt.report] === receipt.hash, `Combined quality response names a different ${role} report.`);
      check(reportInfo(root, request.story, receipt.report)[1] === receipt.hash, `The ${role} quality report changed after delivery.`);
    }
    const [file, digest] = reportInfo(root, request.story, reports.combined);
    check(reports.hashes[file] === digest, 'Combined report changed after delivery.');
    return response;
  }
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
      if (entry.isDirectory()) check(!['checkpoint.md', 'records/checkpoint.md', 'result.md'].some(name => exists(safe(root, stories, entry.name, name))), 'Missing active.json for existing completion/checkpoint record.');
    }
    check(!ROLES.some(role => allMessages(root, role).some(data => data.kind === 'implementation_request')), 'Missing active checkpoint for recorded approval.');
    return null;
  }
  const state = json(file);
  storyCheck(state.story);
  check(PHASES.includes(state.phase) && matches(HASH, state.story_hash), 'Invalid active checkpoint.');
  textCheck(state.note, 16000, 'Checkpoint note');
  const compacted = compactedRecord(root, state.story);
  if (compacted) {
    check(state.phase === 'done' && state.completion?.message_id === compacted.id, 'Compacted completion contradicts active.json.');
    return finished(state);
  }
  check(bytes(recordFile(root, state.story, 'checkpoint.md')).toString() === checkpointText(state), 'Checkpoint Markdown contradicts active.json.');
  // An edit to an approved file blocks every role; the message names the way back.
  const pinned = operation => { try { operation(); } catch (error) { if (state.approval) error.message += approvedHint(root, state.story); throw error; } };
  if (state.phase !== 'planning' || state.approval) pinned(() => check(storyHash(root, state.story) === state.story_hash, 'Story scope revision changed after approval.'));
  if (state.design) pinned(() => validateDesign(root, state.story, state.design));
  if (state.verification) pinned(() => { check(state.verification.story_hash === state.story_hash, 'QA contract scope changed.'); validateVerification(root, state.story, state.verification); });
  if (state.approval) {
    check(object(state.approval) && ['handoff', 'implementation', 'fix'].includes(state.approval.kind), 'Invalid recorded approval.');
    check(state.approval.story_hash === state.story_hash, 'Recorded approval is for a different story revision.');
    if (state.approval.kind === 'handoff') {
      const message = locate(root, 'executor', state.approval.message_id);
      check(message.kind === 'implementation_request' && message.story === state.story, "Approval message is not this story's implementation request.");
      check(message.story_hash === state.story_hash, 'Approval message pins a different story revision.');
      check(JSON.stringify(message.design) === JSON.stringify(state.design), 'Approval message pins a different design.');
      check(JSON.stringify(message.verification) === JSON.stringify(state.verification), 'Approval message pins a different QA contract.');
    }
  }
  if (state.request_id) {
    const request = reviewRequest(root, state.request_id);
    check(request.story === state.story, 'Mismatched checkpoint review request.');
    if (state.verification) {
      check(JSON.stringify(request.verification) === JSON.stringify(state.verification) && request.checks?.includes('qa'), 'Review request changed its approved QA verification scope.');
      if (['reviewing', 'review_ready', 'review_decision'].includes(state.phase))
        check(request.baseline === state.verified_baseline && request.fingerprint === state.verified_fingerprint, 'QA request no longer matches verified implementation snapshot.');
    }
  }
  if (state.approval?.kind === 'fix') {
    const response = locate(root, 'executor', state.approval.response_id);
    const request = reviewRequest(root, response.reply_to);
    check(response.kind === 'review_result' && response.story === state.story && response.baseline === request.baseline, 'Mismatched fix approval response.');
    verifyResponse(root, request, response, false);
  }
  if (state.verified_baseline !== undefined) check(matches(HASH, state.verified_baseline), 'Invalid verified implementation baseline.');
  if (state.verified_fingerprint !== undefined) check(state.verified_baseline !== undefined && SNAPSHOTS.includes(state.verified_fingerprint), 'Invalid verified implementation baseline.');
  if (state.completion) validateCompletion(root, state);
  if (state.planning_from) {
    const message = locate(root, 'planner', state.planning_from);
    const completed = completionCheckpoint(root, message.story);
    check(completed.completion.message_id === message.id, 'Mismatched predecessor planning request.');
  }
  return state;
}
function validateCompletion(root, state) {
  check(state.phase === 'done' && object(state.completion), 'Invalid completion record.');
  check(matches(HASH, state.completion.baseline) && (state.completion.fingerprint === undefined || SNAPSHOTS.includes(state.completion.fingerprint)), 'Completion record lacks a valid source baseline.');
  // 'user_verified_fixes' is the older name of 'verified_fixes' (completed after verified fixes without a fresh review).
  check(['reviewed', 'verified_fixes', 'user_verified_fixes'].includes(state.completion.basis), 'Unknown completion basis.');
  check(state.completion.consolidation_required === undefined || state.completion.consolidation_required === true, 'Invalid story consolidation requirement.');
  const message = locate(root, 'planner', state.completion.message_id);
  check((message.consolidation_required === true) === (state.completion.consolidation_required === true), 'Planning request consolidation requirement contradicts completion checkpoint.');
  check(message.kind === 'planning_request' && message.story === state.story, "Completion message is not this story's planning request.");
  check(message.story_hash === state.story_hash, 'Completion message pins a different story revision.');
  check(message.baseline === state.completion.baseline && message.fingerprint === completionFormat(state.completion), 'Completion message pins a different source baseline.');
  const request = reviewRequest(root, state.request_id), response = responses(root, request)[0];
  check(request.story === state.story && !request.cancelled, 'Completed review request is missing or cancelled.');
  check(response, 'Completed review has no result.');
  verifyResponse(root, request, response, false);
}

// At each implementation approval the exact approved story, design and QA files are copied to records/approved/, so an
// accidental edit after approval is undone with restore-approved instead of blocking every role.
const approvedRecord = (root, story) => safe(root, storyDirectory(root, story), 'records', 'approved.json');
const approvedHint = (root, story) => exists(approvedRecord(root, story))
  ? ` Restore the approved files with: node .harness/bin/c2h.mjs restore-approved ${story} --approved (a real scope change needs a new story).`
  : ' This approval predates approved snapshots: restore the exact approved bytes by hand, or plan the change as a new story.';
function pinnedFiles(state) {
  const folder = `.harness/stories/${state.story}/`, files = { [`${folder}story.md`]: state.story_hash };
  if (state.design) Object.assign(files, { [state.design.file]: state.design.hash, [state.design.preview]: state.design.preview_hash });
  if (state.verification) Object.assign(files, { [state.verification.file]: state.verification.hash, [state.verification.interview.file]: state.verification.interview.hash, ...state.verification.tests });
  for (const [file, digest] of Object.entries(files)) check(file.startsWith(folder) && !file.split('/').includes('..') && matches(HASH, digest), 'Approved file outside the story.');
  return files;
}
const approvedCopy = (root, story, file) => { const folder = storyDirectory(root, story); return safe(root, folder, 'records', 'approved', path.relative(folder, safe(root, file))); };
function saveApproved(root, state) {
  const files = pinnedFiles(state), record = approvedRecord(root, state.story);
  if (exists(record) && JSON.stringify(json(record).files) === JSON.stringify(files)) return;
  fs.rmSync(record, { force: true });
  fs.rmSync(safe(root, storyDirectory(root, state.story), 'records', 'approved'), { recursive: true, force: true });
  for (const [file, digest] of Object.entries(files)) {
    const data = bytes(safe(root, file));
    check(hash(data) === digest, 'Approved file changed while recording its snapshot.');
    atomic(root, approvedCopy(root, state.story, file), data);
  }
  atomic(root, record, encode({ version: 1, story_hash: state.story_hash, files }));
}

// Reads active.json directly: loadState is exactly what an edited approved file breaks.
export function restoreApproved(root, story, { approved = false } = {}) {
  storyCheck(story); check(approved === true, 'Explicit approval is required to restore approved files.');
  return transaction(root, root => {
    const active = safe(root, '.harness/active.json');
    check(exists(active), 'No active story.');
    const state = json(active);
    check(state.story === story && object(state.approval), 'Only the active approved story can be restored.');
    const record = approvedRecord(root, story);
    check(exists(record), 'This approval predates approved snapshots: restore the exact approved bytes by hand, or plan the change as a new story.');
    const files = pinnedFiles(state), saved = json(record), restored = [];
    check(saved.story_hash === state.story_hash && JSON.stringify(saved.files) === JSON.stringify(files), 'The approved snapshot belongs to a different approval; restore by hand.');
    for (const [file, digest] of Object.entries(files)) {
      const data = bytes(approvedCopy(root, story, file));
      check(hash(data) === digest, `The approved snapshot of ${file} is damaged; restore by hand.`);
      let same = false;
      try { same = hash(bytes(safe(root, file))) === digest; } catch {}
      if (!same) { atomic(root, safe(root, file), data); restored.push(file); }
    }
    let remaining;
    try { loadState(root); } catch (error) { remaining = error.message; }
    return { story, restored, ...(remaining ? { remaining } : {}) };
  });
}

// A finished story keeps only result.md: what was done, in the planner's words. The planner's completion message, marked
// compacted, is the seal; every other story file, message, baseline and verification copy is removed with the story.
function compactedRecord(root, story) {
  storyCheck(story);
  const sealed = allMessages(root, 'planner').filter(item => item.story === story && item.compacted);
  check(sealed.length <= 1, 'Conflicting compacted completion records.');
  if (!sealed.length) return null;
  check(exists(safe(root, storyDirectory(root, story), 'result.md')), 'Completed story lost its result.md.');
  return sealed[0];
}
const finished = state => ({ story: state.story, story_hash: state.story_hash, phase: 'done', note: state.note,
  completion: { message_id: state.completion.message_id, consolidation_required: true }, updated: state.updated });

function compactionPending(root, story, sealed = compactedRecord(root, story)) {
  return Boolean(sealed) && (fs.readdirSync(storyDirectory(root, story)).some(name => name !== 'result.md') ||
    ROLES.some(role => allMessages(root, role).some(item => item.story === story && item.id !== sealed.id)));
}

// Idempotent: an interrupted cleanup is finished by running compact-story again.
function clearStory(root, story, completionId) {
  const active = safe(root, '.harness/active.json');
  if (exists(active) && json(active).story === story) atomic(root, active, encode(finished(json(active))));
  const owned = ROLES.flatMap(role => allMessages(root, role).filter(item => item.story === story && item.id !== completionId).map(item => ({ role, item })));
  check(owned.every(({ role, item }) => !exists(safe(root, '.harness/inbox', role, `${item.id}.json`))), 'Unresolved pending role messages prevent consolidation.');
  for (const { item } of owned) if (item.kind === 'review_request') {
    if (matches(/^\.harness\/baselines\/[A-Za-z0-9_-]+\.json$/, item.source_manifest?.file)) fs.rmSync(safe(root, item.source_manifest.file), { force: true });
    fs.rmSync(safe(root, '.harness/verification', item.id), { recursive: true, force: true });
  }
  for (const name of [`verified-${story}.json`, `approved-${story}.json`]) fs.rmSync(safe(root, '.harness/baselines', name), { force: true });
  for (const { role, item } of owned) fs.unlinkSync(safe(root, '.harness/inbox', role, 'processed', `${item.id}.json`));
  const folder = storyDirectory(root, story);
  for (const name of fs.readdirSync(folder)) if (name !== 'result.md') fs.rmSync(safe(root, folder, name), { recursive: true, force: true });
  syncDirectory(folder);
  const index = safe(root, '.harness/stories/index.md');
  if (exists(index)) atomic(root, index, bytes(index).toString().replaceAll(`${story}/story.md`, `${story}/result.md`));
}

export function compactStory(root, story, { summary, approved = false, expectedSummaryHash } = {}) {
  storyCheck(story); check(approved === true, 'Explicit approval is required for story consolidation.');
  return transaction(root, root => {
    const result = `.harness/stories/${story}/result.md`, sealed = compactedRecord(root, story);
    if (sealed) { clearStory(root, story, sealed.id); return { story, result }; }
    const state = loadState(root);
    check(state?.story === story && state.phase === 'done' && state.completion?.consolidation_required, 'Only the active completed DONE story can be consolidated.');
    check(!openReviews(root).length && ROLES.every(role => !messages(root, role).some(item => item.story === story && item.id !== state.completion.message_id)), 'Unresolved pending role messages prevent consolidation.');
    const [summaryFile, summaryHash] = reportInfo(root, story, summary);
    check(summaryFile === `.harness/stories/${story}/records/result-draft.md`, 'Completion summary must be records/result-draft.md inside this story.');
    if (expectedSummaryHash !== undefined) check(matches(HASH, expectedSummaryHash) && expectedSummaryHash === summaryHash, 'Completion summary changed while choosing; ask again.');
    const text = bytes(safe(root, summaryFile)).toString(); textCheck(text, 4000, 'Completion summary');
    check(/^# \S/.test(text) && text.split('\n## 한 일\n')[1]?.split('\n## ')[0].trim(), 'Completion summary needs a "# SNNN — title" line and a "## 한 일" section.');
    atomic(root, safe(root, result), `${text.trim()}\n`);
    const message = locate(root, 'planner', state.completion.message_id), folder = safe(root, '.harness/inbox/planner'), pending = safe(root, folder, `${message.id}.json`);
    atomic(root, exists(pending) ? pending : safe(root, folder, 'processed', `${message.id}.json`), encode({ ...message, compacted: true }));
    clearStory(root, story, message.id);
    return { story, result };
  });
}

function completionCheckpoint(root, story) {
  const sealed = compactedRecord(root, story);
  if (sealed) return { story, phase: 'done', completion: { message_id: sealed.id, consolidation_required: true } };
  const text = bytes(recordFile(root, story, 'checkpoint.md')).toString();
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
  check(sourceFingerprint(root, completionFormat(saved.completion)) === saved.completion.baseline, 'Source changed since recorded completion; do not recover automatically.');
  const manual = before.phase === 'implementation_done';
  check(!manual || before.approval?.kind === 'fix' && before.verified_baseline === saved.completion.baseline &&
    verifiedFormat(before) === completionFormat(saved.completion), 'Missing verified fixes for completion recovery.');
  const request = reviewRequest(root, saved.request_id);
  verifyResponse(root, request, responses(root, request)[0], !manual);
  check(!openReviews(root).length && !messages(root, 'executor').some(data => data.story === story && ['implementation_request', 'review_result'].includes(data.kind)), 'Unresolved messages block completion recovery.');
  return saveState(root, saved);
}

function guardStory(state, story) {
  check(!state || state.story === story || state.phase === 'done', 'Another active story must be resolved first.');
}
const completionChoices = state => state.approval?.kind === 'fix' && ['implementation_done', 'review_decision'].includes(state.phase);
function saveState(root, state, updated = new Date().toISOString()) {
  const saved = { ...state, updated };
  const markdown = checkpointText(saved), encoded = encode(saved);
  check(Buffer.byteLength(markdown) <= MAX_FILE && Buffer.byteLength(encoded) <= MAX_FILE, 'Checkpoint record too large.');
  atomic(root, recordFile(root, state.story, 'checkpoint.md'), markdown);
  atomic(root, safe(root, '.harness/active.json'), encoded);
  return saved;
}
function baseState(root, story, state) {
  check(!compactedRecord(root, story), 'Compacted completed stories cannot be reopened; create a new story.');
  if (state?.phase === 'done') {
    const compacted = compactedRecord(root, state.story);
    if (state.story !== story && state.completion?.consolidation_required)
      check(compacted, 'Finalize story consolidation with c2h_story_next before new planning.');
    if (compacted) check(!compactionPending(root, state.story, compacted), 'Compaction cleanup pending; retry compact-story before new planning.');
  }
  guardStory(state, story);
  if (state?.story === story) return { ...state, ...(!state.approval && state.phase === 'planning' ? { story_hash: storyHash(root, story) } : {}) };
  return { story, story_hash: storyHash(root, story),
    ...(state?.completion && messages(root, 'planner').some(data => data.id === state.completion.message_id) ? { planning_from: state.completion.message_id } : {}) };
}

function designAsset(root, story, filename, ext) {
  check(typeof filename === 'string' && filename.length <= 4096, 'Invalid design asset path.');
  const file = safe(root, filename), rel = path.relative(storyDirectory(root, story), file);
  check(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel) && path.extname(file) === ext, `Design ${ext} must be inside story directory.`);
  return { file: path.relative(projectRoot(root), file).split(path.sep).join('/'), hash: hash(bytes(file)) };
}
function validateDesign(root, story, design) {
  check(object(design) && matches(HASH, design.hash) && matches(HASH, design.preview_hash), 'Invalid composite design approval.');
  const d = designAsset(root, story, design.file, '.md'), p = designAsset(root, story, design.preview, '.html');
  check(d.hash === design.hash && p.hash === design.preview_hash, 'Design or preview changed since readiness/approval.');
  return design;
}
function designPlanning(root, story) {
  const state = baseState(root, story, loadState(root));
  check(!state.approval && (!state.phase || state.phase === 'planning') && !openReviews(root).length, 'Design changes require an unapproved planning scope.');
  return state;
}
// carry: the planner revised the story at the designer's request; the direction the user already chose is kept for the
// new revision instead of asking again. Only the stored choice moves forward; nothing new is approved.
export function designDirection(root, story, { choice, note, expectedStoryHash, carry = false } = {}) {
  check(typeof carry === 'boolean', 'Invalid direction carry flag.');
  if (!carry) { textCheck(choice, 200, 'Design choice'); textCheck(note, 4000, 'Design note'); }
  return transaction(root, root => {
    designPlanning(root, story);
    const current = storyHash(root, story), file = recordFile(root, story, 'design-direction.json');
    check(matches(HASH, expectedStoryHash) && current === expectedStoryHash, 'Story changed since direction selection.');
    if (carry) {
      check(exists(file), 'No chosen design direction to carry.');
      ({ choice, note } = json(file));
      textCheck(choice, 200, 'Design choice'); textCheck(note, 4000, 'Design note');
    }
    atomic(root, file, encode({ story_hash: current, choice, note }));
    return designStatus(root, story);
  });
}
export function designReady(root, story, { design, preview, needsPlanning = false } = {}) {
  check(typeof needsPlanning === 'boolean', 'Invalid requirements-review flag.');
  return transaction(root, root => {
    designPlanning(root, story);
    const story_hash = storyHash(root, story);
    const direction = json(recordFile(root, story, 'design-direction.json'));
    check(direction.story_hash === story_hash, 'Choose design direction for current story revision first.');
    textCheck(direction.choice, 200, 'Design choice'); textCheck(direction.note, 4000, 'Design note');
    const d = designAsset(root, story, design, '.md'), p = designAsset(root, story, preview, '.html');
    const record = { story_hash, direction_hash: hash(JSON.stringify(direction)), needs_planning: needsPlanning, design: { ...d, preview: p.file, preview_hash: p.hash } };
    atomic(root, recordFile(root, story, 'design-ready.json'), encode(record));
    return designStatus(root, story);
  });
}
export function designStatus(root, story) {
  const result = {}, current = storyHash(root, story);
  for (const [key, filename] of [['direction', 'design-direction.json'], ['ready', 'design-ready.json']]) {
    const file = recordFile(root, story, filename);
    if (exists(file)) { const record = json(file); if (record.story_hash === current) result[key] = record; else if (key === 'ready') result.stale = true; }
  }
  if (result.direction) { textCheck(result.direction.choice, 200, 'Design choice'); textCheck(result.direction.note, 4000, 'Design note'); }
  if (result.ready) {
    if (!result.direction || result.ready.direction_hash !== hash(JSON.stringify(result.direction))) delete result.ready;
    else {
      check(typeof result.ready.needs_planning === 'boolean', 'Invalid requirements-review flag.');
      // The designer revises design.md/preview.html in place; an edit after readiness reopens the design instead of failing.
      try { validateDesign(root, story, result.ready.design); } catch { delete result.ready; result.stale = true; }
    }
  }
  return result;
}

// Display only: the designer owns the current stage while a request for this exact story text has no ready design.
export function designPending(root, story) {
  const current = storyHash(root, story);
  const requested = allMessages(root, 'designer').some(data => {
    if (data.kind !== 'message' || data.sender !== 'planner' || data.story !== story) return false;
    try { const request = JSON.parse(data.message); return request?.type === 'c2h_design_request' && request.story_hash === current; } catch { return false; }
  });
  return requested && !designStatus(root, story).ready;
}

export function qaInterview(root, story, answers, { expectedStoryHash } = {}) {
  return transaction(root, root => {
    const state = designPlanning(root, story);
    check(matches(HASH, expectedStoryHash) && state.story_hash === expectedStoryHash, 'Story changed during QA interview.');
    const record = interviewRecord(state.story_hash, answers);
    atomic(root, safe(root, storyDirectory(root, story), 'qa-values.json'), encode(record));
    return record;
  });
}

export function qaReady(root, story, contract) {
  return transaction(root, root => {
    const state = designPlanning(root, story), record = verificationContract(root, story, state.story_hash, contract);
    atomic(root, recordFile(root, story, 'qa-ready.json'), encode(record));
    return record;
  });
}

export function qaStatus(root, story) {
  const file = recordFile(root, story, 'qa-ready.json');
  if (!exists(file)) return null;
  const record = json(file);
  if (record.story_hash !== storyHash(root, story)) return null;
  validateVerification(root, story, record);
  return record;
}

function workspaceInfo(root, request, verification) {
  const product = safe(root, '.harness/verification', request.id, 'product');
  return { request_id: request.id, baseline: request.baseline, product, environment: { C2H_SUBJECT: product }, tests: Object.keys(verification?.tests ?? {}).map(file => safe(root, file)),
    limitation: 'Independent files, not an OS sandbox. No dependencies, servers or tests started. Prepare approved nonproduction credentials and environment before execution.' };
}

const qaResultsFile = (root, story, id) => recordFile(root, story, `qa-results-${id}.json`);

function validateQaReceipt(root, request, receipt) {
  const file = qaResultsFile(root, request.story, request.id);
  check(receipt.results_hash === hash(bytes(file)), 'Submitted QA results changed after delivery.');
  return validatedQaResults(root, request, request.verification, { complete: true });
}

function validatedQaResults(root, request, verification, options) {
  const file = qaResultsFile(root, request.story, request.id);
  check(exists(file), 'QA results missing; record each required criterion with evidence.');
  return qaResults(root, request.story, request, verification, json(file), options);
}

export function qaResult(root, id, criterion, outcome, evidence) {
  return transaction(root, root => {
    const state = loadState(root), request = reviewRequest(root, id);
    check(state?.request_id === id && state.verification && request.checks?.includes('qa') && !request.cancelled && ['reviewing', 'review_ready'].includes(state.phase), 'No active QA contract request.');
    check(reviewFingerprint(root, request) === request.baseline, 'Source changed during QA verification.');
    check(validateVerification(root, request.story, state.verification).criteria.some(item => item.id === criterion), 'Invalid QA criterion ID.');
    if (['pass', 'fail'].includes(outcome)) {
      const workspace = workspaceInfo(root, request, state.verification), metadata = safe(root, path.dirname(workspace.product), 'snapshot.json');
      if (exists(workspace.product) || exists(metadata)) {
        check(exists(workspace.product) && exists(metadata) && encode(json(metadata, 8 * 1024 * 1024)) === encode(workspace), 'Verification subject metadata changed; record blocked and preserve evidence.');
        const format = request.fingerprint ?? 'git-v1';
        const before = request.source_manifest?.file ? readSourceManifest(root, request.source_manifest, request.baseline, format) : manifestFor(root, format);
        const drift = diffManifest(before, sourceManifest(workspace.product));
        check(!drift.changed.length && !drift.removed.length, 'Verification subject changed frozen files; record blocked or obtain a fresh verified snapshot.');
      }
    }
    const receipt = recordFile(root, request.story, `quality-${id}-qa.json`);
    check(!exists(receipt), 'Submitted QA results are immutable; request new verification.');
    const file = qaResultsFile(root, request.story, id), record = exists(file) ? json(file) : { request_id: id, baseline: request.baseline, contract_hash: state.verification.hash, criteria: {} };
    const [relative, digest] = reportInfo(root, request.story, evidence);
    record.criteria[criterion] = { outcome, evidence: relative, hash: digest };
    qaResults(root, request.story, request, state.verification, record);
    atomic(root, file, encode(record));
    return record;
  });
}

export function handoff(root, story, { approved = false, expectedStoryHash, design, preview, expectedDesignHash, expectedPreviewHash, expectedQaHash, sender = 'planner' } = {}) {
  check(approved === true, 'Explicit approval is required for handoff.');
  return transaction(root, root => {
    let state = baseState(root, story, loadState(root));
    if (expectedStoryHash !== undefined) check(matches(HASH, expectedStoryHash) && state.story_hash === expectedStoryHash, 'Story changed since approval selection; ask again.');
    check(!openReviews(root).length, 'A review is still open; do not change source.');
    if (state.approval?.kind === 'handoff') return state.approval.message_id;
    check(!state.phase || ['planning', 'blocked'].includes(state.phase), 'Handoff cannot restart completed or in-progress implementation.');
    const pending = messages(root, 'executor').filter(data => data.kind === 'implementation_request');
    check(pending.every(data => data.story === story && data.story_hash === state.story_hash) && pending.length <= 1, 'A different approval scope is pending.');
    roleCheck(sender);
    check(sender === 'planner' || sender === 'designer', 'Invalid handoff sender.');
    let pinned;
    const status = designStatus(root, story), prepared = status.ready;
    // A design made for an earlier story revision is not dropped silently: the designer re-confirms it first.
    check(prepared || !status.stale, 'Story changed after the design was made; the designer must re-confirm the design for this revision.');
    if (design !== undefined || preview !== undefined) {
      const ready = prepared?.design;
      check(ready && !prepared.needs_planning, 'Unresolved requirements need planning feedback before implementation approval.');
      check(ready.file === design && ready.preview === preview && ready.hash === expectedDesignHash && ready.preview_hash === expectedPreviewHash, 'Design approval does not match ready design.');
      pinned = validateDesign(root, story, ready);
    } else check(!prepared, 'Ready design requires explicit composite design/preview approval.');
    if (sender === 'designer') check(pinned, 'Designer handoff requires approved ready design.');
    // A QA contract is optional; when one is ready it is pinned and must be part of the approval.
    const verification = qaStatus(root, story);
    if (verification) check(expectedQaHash === verification.hash, 'QA contract changed or was not included in scope approval; present it and ask again.');
    const id = pending[0]?.id ?? deliver(root, sender, 'executor', story, '명시적으로 승인된 스토리 revision만 구현한다. 사용자 응답과 선택창은 한국어를 유지한다.', { kind: 'implementation_request', approved: true, story_hash: state.story_hash, ...(pinned ? { design: pinned } : {}), ...(verification ? { verification } : {}) });
    check(!pending[0] || pending[0].sender === sender && JSON.stringify(pending[0].design) === JSON.stringify(pinned), 'Pending handoff has a different approved design scope.');
    check(!pending[0] || JSON.stringify(pending[0].verification) === JSON.stringify(verification), 'Pending handoff has different QA verification scope.');
    state = { ...state, ...(pinned ? { design: pinned } : {}), ...(verification ? { verification } : {}), phase: 'implementing', note: `User explicitly approved ${sender} handoff.`, approval: { kind: 'handoff', story_hash: state.story_hash, message_id: id } };
    saveApproved(root, state);
    state.approved_source ??= approvalSource(root, story);
    saveState(root, state);
    return id;
  });
}

const reviewRounds = (root, story) => allMessages(root, 'reviewer').filter(data => data.kind === 'review_request' && data.story === story && !data.cancelled).length;

// recheck: a review of the verified fixes only (recheck_of names the review whose findings were applied).
// extra: the user's explicit choice of another review beyond the per-story round limit.
export function requestReview(root, story, expected = {}) {
  check(object(expected) && ['again', 'recheck', 'extra'].every(key => expected[key] === undefined || typeof expected[key] === 'boolean') && (expected.checks === undefined || Array.isArray(expected.checks) && expected.checks.length > 0 && expected.checks.every(role => ['reviewer', 'designer', 'qa'].includes(role)) && new Set(expected.checks).size === expected.checks.length), 'Invalid review options.');
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
      if (expected.checks && (!expected.again || state.phase !== 'review_decision')) check(JSON.stringify(request.checks) === JSON.stringify(expected.checks), 'Review retry must preserve exact participants.');
      if (!expected.again || state.phase !== 'review_decision') return request.id;
      check(completionChoices(state), 'Only post-fix completion choices allow another review of a delivered result.');
      check(!messages(root, 'executor').some(data => data.id === response.id), 'Brief and acknowledge the previous result before another review.');
    }
    check(!state.phase || state.phase === 'implementation_done' || expected.again && completionChoices(state), 'Complete implementation before requesting review.');
    // Only a new request needs QA; reusing the pending one (a reviewer resuming its part) keeps its participants.
    if (state.verification) check(expected.checks?.includes('qa'), 'QA contract requires QA participation in frozen review.');
    if (expected.checks) {
      check(state.approval && state.verified_baseline && sourceFingerprint(root, verifiedFormat(state)) === state.verified_baseline, 'Verify the approved implementation before requesting combined checks.');
      check(!expected.checks.includes('designer') || state.design, 'Design QA requires an approved design contract.');
    }
    if (expected.recheck) check(state.phase === 'implementation_done' && completionChoices(state) && state.request_id, 'A recheck reviews verified fixes; apply and verify fixes from a delivered review first.');
    const pending = openReviews(root);
    check(pending.length <= 1 && pending.every(data => data.story === story), 'A review request is still pending for another story.');
    if (!pending.length) check(reviewRounds(root, story) < MAX_REVIEW_ROUNDS || expected.extra === true,
      `Review round limit reached: ${MAX_REVIEW_ROUNDS} review requests for this story. Stop and ask the user (FLOW: 자동 완료가 막혔을 때); only the user's extra-review choice runs quality ${story} --again --approved.`);
    const format = currentFormat(), baseline = pending.length ? reviewFingerprint(root, pending[0]) : sourceFingerprint(root, format);
    if (pending.length) check(pending[0].baseline === baseline, 'Source changed during pending review.');
    const snapshot = pending[0] ?? { kind: 'review_request', baseline, fingerprint: format, source_manifest: saveSourceManifest(root, baseline, `review-${randomBytes(12).toString('hex')}`, format),
      ...(state.verification ? { verification: state.verification } : {}), ...(expected.recheck ? { recheck_of: state.request_id } : {}) };
    checkExpected(snapshot);
    if (expected.checks) {
      if (pending.length) check(JSON.stringify(snapshot.checks) === JSON.stringify(expected.checks), 'Review retry must preserve exact participants.');
      for (const role of new Set(['reviewer', ...expected.checks])) check(fs.statSync(safe(root, '.harness/inbox', role)).isDirectory(), 'Run setup first.');
    }
    const id = pending[0]?.id ?? deliver(root, 'executor', 'reviewer', story, 'Review the frozen implementation; save draft before explicit reply.', snapshot);
    if (expected.checks && !pending.length) {
      const created = [['reviewer', id]];
      try {
        const request = locate(root, 'reviewer', id), checks = [...expected.checks];
        const check_requests = checks.includes('reviewer') ? { reviewer: id } : {};
        for (const role of checks) if (role !== 'reviewer') {
          const child = deliver(root, 'executor', role, story, JSON.stringify({ type: 'c2h_quality_request', request_id: id, role, baseline: request.baseline, fingerprint: request.fingerprint ?? 'git-v1' }));
          check_requests[role] = child; created.push([role, child]);
        }
        atomic(root, safe(root, '.harness/inbox/reviewer', `${id}.json`), encode({ ...request, checks, check_requests }));
      } catch (error) {
        for (const [role, message] of created) fs.unlinkSync(safe(root, '.harness/inbox', role, `${message}.json`));
        throw error;
      }
    }
    if (state.request_id !== id) saveState(root, { ...state, phase: 'reviewing', note: 'Frozen implementation sent for review.', request_id: id });
    return id;
  });
}

function batchStatus(root, id, validateSource = true) {
  const request = reviewRequest(root, id);
  check(Array.isArray(request.checks) && object(request.check_requests), 'Not a batch review request.');
  check(!request.cancelled, 'Review request was cancelled.');
  if (validateSource) check(reviewFingerprint(root, request) === request.baseline, 'Source changed since the review request; ask for a new review.');
  const receipts = {};
  for (const role of request.checks) {
    const message = locate(root, role, request.check_requests[role]);
    if (role !== 'reviewer') {
      check(message.kind === 'message' && message.sender === 'executor' && message.story === request.story, `The correlated ${role} request is not an executor message for this story.`);
      const payload = JSON.parse(message.message);
      check(payload.type === 'c2h_quality_request' && payload.request_id === id && payload.role === role, `The correlated ${role} request names a different quality request.`);
      check(payload.baseline === request.baseline && payload.fingerprint === (request.fingerprint ?? 'git-v1'), `The correlated ${role} request pins a different source baseline.`);
    }
    const file = recordFile(root, request.story, `quality-${id}-${role}.json`);
    if (exists(file)) {
      const receipt = json(file), info = reportInfo(root, request.story, receipt.report);
      check(receipt.request_id === id && receipt.role === role && receipt.baseline === request.baseline, `The ${role} quality receipt belongs to a different request.`);
      check(receipt.report === info[0] && receipt.hash === info[1], `The ${role} quality report changed after submission.`);
      if (role === 'qa' && request.verification) validateQaReceipt(root, request, receipt);
      receipts[role] = receipt;
    }
  }
  const response = responses(root, request)[0];
  if (response) verifyResponse(root, request, response, validateSource);
  return { request, checks: request.checks, reports: receipts, pending: request.checks.filter(role => !receipts[role]), ...(response ? { response } : {}) };
}
export function qualityStatus(root, id) {
  const status = batchStatus(root, id), state = loadState(root);
  check(state?.request_id === id && state.story === status.request.story, 'A different quality request is active.');
  return { ...status, ...(!status.pending.length && !status.response ? { recovery: 'All reports saved but aggregate undelivered; retry submit-check with the original request, role and report.' } : {}) };
}
function submitCheckLocked(root, id, role, report) {
  const status = batchStatus(root, id), state = loadState(root);
  check(state?.request_id === id && state.story === status.request.story && ['reviewing', 'review_ready', 'review_decision'].includes(state.phase), 'A different quality request is active or source editing has started.');
  check(status.checks.includes(role), 'Role is not a participant in this review.');
  const info = reportInfo(root, status.request.story, report), current = status.reports[role];
  if (current) check(current.report === info[0] && current.hash === info[1], 'Submitted report is immutable.');
  else {
    if (role === 'qa' && state.verification) validatedQaResults(root, status.request, state.verification, { complete: true });
    atomic(root, recordFile(root, status.request.story, `quality-${id}-${role}.json`), encode({ request_id: id, role, baseline: status.request.baseline, report: info[0], hash: info[1],
      ...(role === 'qa' && state.verification ? { results_hash: hash(bytes(qaResultsFile(root, status.request.story, id))) } : {}) }));
  }
  archive(root, role, status.request.check_requests[role]);
  const refreshed = batchStatus(root, id);
  if (refreshed.pending.length) { saveState(root, state, state.updated); return { pending: refreshed.pending }; }
  let response = refreshed.response;
  if (!response) {
    const combined = recordFile(root, status.request.story, `quality-${id}-combined.md`);
    const text = `# 종합 검토\n\n- 요청: ${id}\n- 고정 소스: ${status.request.baseline}\n- 참여 역할: ${status.checks.join(', ')}\n\n실행자는 모든 원본을 읽고 계획(story.md·design.md·QA 계약)과 대조해 반영할 지적을 고른 뒤 자동으로 수정한다. 계획 밖 취향 제안과 틀린 지적은 이유와 함께 implementation.md에 남긴다.\n\n` + status.checks.map(key => `## ${key}\n\n- 원본: [${path.basename(refreshed.reports[key].report)}](${path.relative(path.dirname(combined), safe(root, refreshed.reports[key].report)).split(path.sep).join('/')})\n- SHA-256: ${refreshed.reports[key].hash}\n`).join('\n');
    atomic(root, combined, text);
    const reportPath = path.relative(projectRoot(root), combined).split(path.sep).join('/');
    const paths = { ...Object.fromEntries(Object.entries(refreshed.reports).map(([key, value]) => [key, value.report])), review: reportPath, combined: reportPath };
    const hashes = Object.fromEntries(Object.values(paths).map(file => [file, hash(bytes(safe(root, file)))]));
    const responseId = deliver(root, 'reviewer', 'executor', status.request.story, JSON.stringify({ ...paths, hashes }), { kind: 'review_result', reply_to: id, baseline: status.request.baseline });
    response = locate(root, 'executor', responseId);
  }
  if (['reviewing', 'review_ready'].includes(state.phase)) saveState(root, { ...state, phase: 'review_decision', note: 'All requested quality reports sent; apply plan-backed findings automatically.' });
  archive(root, 'reviewer', id);
  return { id: response.id, pending: [] };
}
export function submitCheck(root, id, role, report) {
  roleCheck(role);
  return transaction(root, root => submitCheckLocked(root, id, role, report));
}
export function replyReview(root, id, review, qa) {
  const request = reviewRequest(root, id);
  if (request.checks) return submitCheck(root, id, 'reviewer', review);
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
    if (request.checks) for (const role of request.checks) if (role !== 'reviewer') archive(root, role, request.check_requests[role]);
    const { request_id, ...rest } = state;
    // Cancelling re-review must not discard or broaden the preceding selected-fix approval.
    if (state.approval?.kind === 'fix') rest.request_id = locate(root, 'executor', state.approval.response_id).reply_to;
    return saveState(root, { ...rest, phase: state.approval ? 'implementation_done' : 'blocked', note });
  });
}

export function checkpoint(root, story, phase, note, options = {}) {
  check(object(options), 'Invalid checkpoint options.');
  const { approved = false } = options;
  check(PHASES.includes(phase), 'Invalid checkpoint phase.'); textCheck(note, 16000, 'Checkpoint note');
  check(typeof approved === 'boolean', 'Approval must be a boolean.');
  return transaction(root, root => {
    let state;
    try {
      const current = loadState(root);
      if (phase === 'done' && current?.story === story && compactedRecord(root, story)) {
        check(approved, 'Explicit approval is required for completion.'); return current;
      }
      state = baseState(root, story, current);
    }
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
        if (completedFix) check(state.verified_baseline && sourceFingerprint(root, verifiedFormat(state)) === state.verified_baseline, 'Source changed since implementation verification; verify before approving new fixes.');
        verifyResponse(root, request, response, !continuingFix && !completedFix);
      } else {
        check(!state.request_id && state.approval?.kind !== 'fix', 'After review use explicit fix approval, not implementing.');
        check(approved || state.approval, 'Recorded implementation approval is required.');
        if (!state.approval) check(!qaStatus(root, story), 'QA contract requires composite handoff approval; do not bypass with implementing checkpoint.');
        if (!state.approval) { const design = designStatus(root, story); check(!design.ready && !design.stale, 'Ready design requires composite handoff approval for story, design and preview.'); }
      }
      if (approved && !continuingFix) {
        state = { ...state, approval: {
          kind: phase === 'fixing' ? 'fix' : 'implementation', story_hash: state.story_hash, note,
          ...(phase === 'fixing' ? { response_id: responses(root, reviewRequest(root, state.request_id))[0].id } : {}),
        } };
        saveApproved(root, state);
        if (phase === 'implementing') state.approved_source ??= approvalSource(root, story);
      }
    }
    if (['reviewing', 'review_ready', 'review_decision'].includes(phase)) {
      check(state.request_id, 'Missing review request; request review first.');
      const request = reviewRequest(root, state.request_id);
      check(reviewFingerprint(root, request) === request.baseline, 'Source changed during review.');
      if (phase === 'review_decision') check(responses(root, request).length, 'Missing review result.');
      else check(!responses(root, request).length, 'Sent review cannot return to draft.');
    }
    if (phase === 'done') {
      if (state.phase === 'done') return state;
      check(['implementation_done', 'review_decision'].includes(state.phase), 'Complete and verify implementation before final completion.');
      check(state.request_id, 'Final completion requires a reviewed implementation.');
      const request = reviewRequest(root, state.request_id), response = responses(root, request)[0];
      check(response, 'Final completion requires a review result.');
      // Completing straight from implementation_done means the verified fixes were not reviewed again.
      const manualFixes = state.phase === 'implementation_done';
      if (manualFixes) {
        check(state.approval?.kind === 'fix' && state.verified_baseline, 'Completion without a fresh review requires verified review-based fixes.');
        check(sourceFingerprint(root, verifiedFormat(state)) === state.verified_baseline, 'Source changed since implementation verification; verify again before completion.');
      }
      verifyResponse(root, request, response, !manualFixes);
      if (state.verification) {
        check(reviewFingerprint(root, request) === request.baseline, 'QA must verify the current corrected version; request fresh QA after fixes.');
        validatedQaResults(root, request, state.verification, { complete: true, passing: true });
      }
      bytes(safe(root, storyDirectory(root, story), 'implementation.md'));
      check(!messages(root, 'executor').some(data => data.story === story && ['implementation_request', 'review_result'].includes(data.kind)), 'Brief and acknowledge all typed handoffs/results before completion.');
      const pending = allMessages(root, 'planner').filter(data => data.kind === 'planning_request' && data.story === story);
      // Manual completion reuses the verified format so recovery can compare the two baselines.
      const format = pending[0]?.fingerprint ?? (manualFixes ? verifiedFormat(state) : currentFormat());
      const baseline = sourceFingerprint(root, format);
      check(pending.length <= 1 && pending.every(data => data.story_hash === state.story_hash && data.baseline === baseline), 'Conflicting planning request; inspect interrupted completion.');
      const id = pending[0]?.id ?? deliver(root, 'executor', 'planner', story, '스토리 완료가 기록됐다. 이 스토리에서 무슨 작업을 했는지만 records/result-draft.md에 짧게 쓴다(# 제목, ## 한 일, 필요하면 ## 바뀐 파일). 저장하면 result.md로 확정되고 나머지 스토리 파일은 지워진다. 그 뒤 사용자의 다음 스토리 요청을 기다린다. 다음 스토리를 먼저 계획하지 않는다.', { kind: 'planning_request', approved: true, consolidation_required: true, story_hash: state.story_hash, baseline, fingerprint: format });
      state = { ...state, completion: { baseline, fingerprint: format, message_id: id, basis: manualFixes ? 'verified_fixes' : 'reviewed',
        ...(locate(root, 'planner', id).consolidation_required ? { consolidation_required: true } : {}) } };
      delete state.planning_from;
    }
    if (phase === 'implementation_done') {
      check(state.approval, 'Recorded implementation approval is required.');
      const format = currentFormat(), baseline = sourceFingerprint(root, format);
      state = { ...state, verified_baseline: baseline, verified_fingerprint: format, verified_manifest: saveSourceManifest(root, baseline, `verified-${story}`, format) };
    }
    return saveState(root, { ...state, phase, note });
  });
}

function resumed(root, role, fingerprint = sourceFingerprint) {
  roleCheck(role);
  if (assistRole(role)) {
    // Assist messages carry no workflow approval; keep existing integrity gates authoritative.
    const current = resumed(root, 'executor', fingerprint);
    if (current.action === 'blocked') return { ...current, message: undefined };
    const message = messages(root, role)[0];
    return { story: message?.story ?? current.story, phase: current.phase, action: message ? 'assist' : 'wait', checkpoint: current.checkpoint, ...(message ? { message } : {}) };
  }
  const state = loadState(root);
  const pending = messages(root, role);
  if (!state) return { story: null, phase: null, action: role === 'planner' ? 'plan' : role === 'reviewer' ? 'wait' : 'select_story', checkpoint: null };
  let request, response;
  if (state.request_id) {
    request = reviewRequest(root, state.request_id);
    response = responses(root, request)[0];
    const frozen = ['reviewing', 'review_ready', 'review_decision'].includes(state.phase);
    if (frozen) check(fingerprint(root, request.fingerprint ?? 'git-v1') === request.baseline, 'Source changed since the review request.');
    if (response) verifyResponse(root, request, response, false);
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
    if (request?.checks && (!request.checks.includes('reviewer') || !batchStatus(root, request.id, false).pending.includes('reviewer'))) action = 'wait';
  }
  // The executor's automatic next step from implementation to completion; the user is asked only when it fails.
  // Every delivered result is applied against the plan; verified fixes get a fix-only recheck until the round limit.
  const verifiedFixes = role === 'executor' && action === 'completion_choices' && state.phase === 'implementation_done';
  const roundsLeft = verifiedFixes && reviewRounds(root, state.story) < MAX_REVIEW_ROUNDS;
  const auto = role !== 'executor' ? undefined : action === 'implementation_choices' ? 'quality'
    : ['brief', 'review_decision', 'completion_choices'].includes(action) && !verifiedFixes ? 'apply'
    : verifiedFixes ? (roundsLeft ? 'recheck' : state.verification ? undefined : 'done') : undefined;
  const stop = verifiedFixes && !auto ? `Review round limit reached (${MAX_REVIEW_ROUNDS}) and the QA contract needs a current-version PASS; ask the user (FLOW: 자동 완료가 막혔을 때).` : undefined;
  const message = action === 'plan_next' ? pending.find(data => data.id === (state.completion?.message_id ?? state.planning_from)) : action === 'brief' ? response : pending.find(data => data.kind === 'implementation_request' && data.story === state.story && data.story_hash === state.story_hash);
  const completedStory = action === 'plan_next' ? message.story : state.story;
  const result = compactedRecord(root, completedStory) ? `.harness/stories/${completedStory}/result.md` : undefined;
  const cleanupPending = result && compactionPending(root, completedStory);
  return { story: state.story, phase: state.phase, action, ...(auto ? { auto } : {}), ...(stop ? { auto_stopped: stop } : {}), checkpoint: state, ...(result ? { result, ...(cleanupPending ? { compaction_pending: true } : {}) } : {}), ...(request ? { request } : {}), ...(message ? { message } : {}),
    ...(['blocked', 'implementation_done'].includes(state.phase) && state.verified_baseline && fingerprint(root, verifiedFormat(state)) !== state.verified_baseline
      ? { reverification_required: true } : {}) };
}

export function resume(root, role) { return readResume(root, role); }

function readResume(root, role, fingerprint = sourceFingerprint) {
  roleCheck(role);
  // Readers must not diagnose a writer's partially installed checkpoint as corruption.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // A stale lock never clears by waiting; report it as blocked with its recovery command.
      const held = () => {
        const lock = lockOwner(root);
        return lock?.stale ? { story: null, phase: 'blocked', action: 'blocked', checkpoint: null, error: staleLock(lock) }
          : lock ? { story: null, phase: null, action: 'wait', checkpoint: null, busy: true } : null;
      };
      const before = held();
      if (before) return before;
      const state = resumed(root, role, fingerprint);
      return held() ?? state;
    } catch (error) {
      if (attempt) return { story: null, phase: 'blocked', action: 'blocked', checkpoint: null, error: error.message };
    }
  }
}

// Recheck upgrade gates under the same lock used by protocol writers.
export function resourceUpgrade(root, apply, { changed = true } = {}) {
  fs.mkdirSync(safe(root, '.harness'), { recursive: true });
  return transaction(root, root => {
    if (changed) {
      const hasRecords = exists(safe(root, '.harness/active.json')) || exists(safe(root, '.harness/inbox'));
      if (hasRecords) {
        const state = resumed(root, 'executor');
        check(state.action !== 'blocked' && !['reviewing', 'review_ready', 'review_decision'].includes(state.phase), 'Review/workflow state blocks resource upgrades.');
        for (const role of ['executor', 'reviewer']) check(!messages(root, role).some(item => ['review_request', 'review_result'].includes(item.kind) && !item.cancelled), 'Pending review message blocks resource upgrades.');
      }
    }
    return apply();
  }, true);
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
    const format = verifiedFormat(state);
    const before = sourceFingerprint(root, format);
    check(before === state.verified_baseline, 'Unverified source changes block maintenance.');
    const receipt = recordFile(root, state.story, 'maintenance.json');
    const result = apply();
    const after = sourceFingerprint(root, format);
    const maintenance = { story: state.story, fingerprint: format, before, after_resources: after,
      reverification_required: before !== after, updated: new Date().toISOString(),
      note: 'Harness maintenance only. Existing approval/checkpoint preserved. Reverify changed source before completion; resume recomputes drift, including later document migrations. This receipt is not approval or QA evidence.' };
    atomic(root, receipt, encode(maintenance));
    return { ...result, maintenance };
  });
}

export function diagnose(root) {
  let state;
  try {
    root = projectRoot(root);
    const lock = lockOwner(root);
    if (lock?.stale) return { error: staleLock(lock), next: 'Remove the stale lock with unlock --approved, then resume.' };
    if (lock) return { busy: true, next: 'Protocol writer busy; wait and check again.' };
    const active = safe(root, '.harness/active.json');
    if (!exists(active)) return { story: null, available: false, next: 'No active baseline; plan or resume the current role.' };
    state = json(active); storyCheck(state.story);
    const request = state.request_id && ['reviewing', 'review_ready', 'review_decision'].includes(state.phase) ? reviewRequest(root, state.request_id) : null;
    const baseline = request?.baseline ?? state.verified_baseline;
    const format = request?.fingerprint ?? (request ? 'git-v1' : verifiedFormat(state));
    const reference = request?.source_manifest ?? state.verified_manifest;
    if (!baseline) return { story: state.story, available: false, next: 'No implementation verification baseline yet.' };
    const current = sourceFingerprint(root, format), matched = current === baseline;
    const files = reference?.file ? readSourceManifest(root, reference, baseline, format) : null;
    return { story: state.story, baseline, current, matched, available: Boolean(files),
      drift: !matched && files ? diffManifest(files, manifestFor(root, format)) : null,
      next: matched ? 'Source matches recorded baseline; use resume for approval/workflow state.' : request
        ? `Source changed. Inspect paths; explicitly cancel-review ${request.id} if still unanswered, then reverify and request a new review. Never reset approval or repin silently.`
        : 'Source changed. Reverify the approved implementation before completion.',
      ...(!files ? { limitation: reference?.unavailable ?? 'Legacy baseline has no per-path manifest; changed paths cannot be reconstructed.' } : {}) };
  } catch (error) { return { story: matches(STORY, state?.story) ? state.story : null, error: error.message, next: 'Inspect status/inbox and recorded evidence; do not delete locks or regenerate approvals.' }; }
}

// Paths changed since implementation approval, or since the last reviewed version (a recheck compares with the review
// whose findings were applied). Read-only; reads active.json directly so it also works while a pin is broken.
export function changes(root, story, { since = 'approval' } = {}) {
  storyCheck(story); check(['approval', 'review'].includes(since), 'Use --since approval or --since review.');
  root = projectRoot(root);
  const active = safe(root, '.harness/active.json');
  check(exists(active), 'No active story.');
  const state = json(active);
  check(state.story === story, 'Only the active story has recorded change bases.');
  let request, format, baseline, reference;
  if (since === 'approval') {
    const source = state.approved_source;
    if (!object(source)) return { story, since, available: false, limitation: 'This approval predates recorded approval sources.' };
    ({ fingerprint: format, baseline } = source); reference = source.manifest ?? { unavailable: source.unavailable };
  } else {
    check(state.request_id, 'No review is recorded for this story.');
    request = reviewRequest(root, state.request_id);
    if (request.recheck_of) request = reviewRequest(root, request.recheck_of);
    format = request.fingerprint ?? 'git-v1'; baseline = request.baseline; reference = request.source_manifest;
  }
  const base = { story, since, ...(request ? { request: request.id } : {}), fingerprint: format };
  if (!reference?.file) return { ...base, available: false, limitation: reference?.unavailable ?? 'No per-path manifest was recorded for this base.' };
  return { ...base, available: true, ...diffManifest(readSourceManifest(root, reference, baseline, format), manifestFor(root, format)) };
}

export function verificationWorkspace(root, id) {
  return transaction(root, root => {
    const state = loadState(root), request = reviewRequest(root, id);
    check(state?.request_id === id && !request.cancelled && ['reviewing', 'review_ready', 'review_decision'].includes(state.phase), 'No current frozen request for verification workspace.');
    check(reviewFingerprint(root, request) === request.baseline, 'Source changed since review request.');
    const format = request.fingerprint ?? 'git-v1';
    check(WORKSPACES.includes(format), 'Legacy review needs a fresh current-format request before preparing a workspace.');
    const folder = safe(root, '.harness/verification', id), product = safe(root, folder, 'product'), metadata = safe(root, folder, 'snapshot.json');
    const result = workspaceInfo(root, request, state.verification);
    const manifest = () => request.source_manifest?.file ? readSourceManifest(root, request.source_manifest, request.baseline, format) : manifestFor(root, format);
    // Compare the copy with the frozen file list itself: the copy's own .gitignore files must not filter it again.
    const exact = files => Object.values(diffManifest(files, sourceManifest(product))).every(paths => !paths.length);
    if (exists(product)) {
      check(exists(metadata), 'Existing verification workspace lacks its snapshot record; inspect without overwriting.');
      const saved = json(metadata, 8 * 1024 * 1024);
      check(encode(saved) === encode(result) && exact(manifest()), 'Verification workspace or snapshot metadata changed; preserve it and request a fresh verified review.');
      return saved;
    }
    check(!exists(metadata), 'Existing snapshot metadata lacks its product copy; inspect without overwriting.');
    const files = manifest();
    let created = false;
    try {
      copyProduct(root, product, files); created = true;
      check(exact(files) && reviewFingerprint(root, request) === request.baseline, 'Source changed while preparing verification snapshot.');
      atomic(root, metadata, encode(result));
      return result;
    } catch (error) { if (created) fs.rmSync(product, { recursive: true, force: true }); throw error; }
  });
}

export function storyIndex(root) {
  const folder = safe(root, '.harness/stories');
  if (!exists(folder)) return [];
  const names = fs.readdirSync(folder);
  check(names.length <= 5000, 'Story index exceeds scan limit.');
  return names.filter(name => STORY.test(name) && fs.lstatSync(safe(root, folder, name)).isDirectory()).sort().map(id => {
    try {
      if (compactedRecord(root, id)) return { id, phase: 'done' };
      const checkpoint = recordFile(root, id, 'checkpoint.md');
      if (!exists(checkpoint)) return { id, phase: 'planning' };
      const text = bytes(checkpoint).toString(), encoded = text.match(/\n```json\n([\s\S]*)```\n$/)?.[1];
      check(encoded, 'Missing generated checkpoint.');
      const record = JSON.parse(encoded);
      check(record.story === id && PHASES.includes(record.phase) && checkpointText(record) === text, 'Invalid story checkpoint.');
      if (record.phase === 'done') completionCheckpoint(root, id);
      return { id, phase: record.phase };
    } catch (error) { return { id, phase: 'blocked', error: error.message }; }
  });
}

export function status(root) {
  const errors = [], roles = {}, queues = {}, fingerprints = new Map();
  // One read-only status snapshot shares source hashes; approval/mutation APIs never use this cache.
  const fingerprint = (project, format) => {
    if (!fingerprints.has(format)) fingerprints.set(format, sourceFingerprint(project, format));
    return fingerprints.get(format);
  };
  for (const role of ROLES) {
    roles[role] = readResume(root, role, fingerprint);
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
  const kinds = assistRole(role) ? ['message'] : role === 'executor' ? ['implementation_request', 'review_result'] : role === 'reviewer' ? ['review_request'] : ['planning_request'];
  // Quiet polling rehashes only files whose stat changed; every gate that acts on the result verifies without the cache.
  const cache = new Map(), fingerprint = (root, format) => sourceFingerprint(root, format, cache);
  while (true) {
    const state = readResume(root, role, fingerprint);
    check(state.action !== 'blocked', state.error || 'Workflow blocked; inspect status.');
    for (const message of state.busy ? [] : inbox(root, role).filter(data => kinds.includes(data.kind))) {
      if (assistRole(role)) {
        if (state.action === 'assist' && state.message?.id === message.id) return message;
        continue;
      }
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

const activityFile = (root, role) => { roleCheck(role); check(readLayout(root).roles.includes(role), 'Role not selected.'); return safe(root, '.harness/activity', `${role}.json`); };
const ACTIVITY_SOURCES = ['pi-assistant', 'claude-assistant'];
export function appendActivity(root, role, text, { source = 'pi-assistant' } = {}) {
  check(typeof text === 'string' && text.length > 0, 'Activity text required.');
  check(ACTIVITY_SOURCES.includes(source), 'Invalid activity source.');
  const clipped = [...text].length > 16000;
  root = projectRoot(root);
  const file = activityFile(root, role);
  // Display only: a busy protocol writer must not drop or delay the role's transcript.
  return displayLock(root, file, () => {
    const messages = roleActivity(root, role).messages;
    const entry = { text: [...text].slice(0, 16000).join(''), ...(clipped ? { clipped: true } : {}), source, at: new Date().toISOString() };
    messages.push(entry);
    while (messages.length > 20 || Buffer.byteLength(encode({ messages })) > 1_000_000) messages.shift();
    atomic(root, file, encode({ messages })); return entry;
  });
}
export function roleActivity(root, role) { const file = activityFile(root, role); if (!exists(file)) return { messages: [] }; const data = json(file, 2_000_000); check(Array.isArray(data.messages) && data.messages.length <= 20 && data.messages.every(m => object(m) && typeof m.text === 'string' && [...m.text].length <= 16000 && ACTIVITY_SOURCES.includes(m.source) && typeof m.at === 'string' && Number.isFinite(Date.parse(m.at)) && (m.clipped === undefined || typeof m.clipped === 'boolean')), 'Invalid activity log.'); return data; }
function viewFile(root) { return safe(root, '.harness/console/view.json'); }
// Console view: last cursor role plus when the user last looked at each role (drives the unread-reply alert).
export function consoleView(root) {
  const roles = readLayout(root).roles, file = viewFile(root);
  if (!exists(file)) return { role: roles[0], seen: {} };
  const v = json(file, 4096), seen = v.seen ?? {};
  check(roles.includes(v.role) && object(seen) && Object.entries(seen).every(([role, at]) => ROLES.includes(role) && Number.isSafeInteger(at) && at >= 0), 'Invalid console view.');
  return { role: v.role, seen: Object.fromEntries(Object.entries(seen).filter(([role]) => roles.includes(role))) };
}
function saveView(root, view) { atomic(root, viewFile(root), encode(view)); return view; }
function seenAt(view, role, at) { check(Number.isSafeInteger(at) && at >= 0, 'Invalid seen time.'); return { ...view.seen, [role]: Math.max(at, view.seen[role] ?? 0) }; }
export function selectConsoleRole(root, role, at = Date.now()) { check(readLayout(root).roles.includes(role), 'Role not selected.'); const v = consoleView(root); return saveView(root, { role, seen: seenAt(v, role, at) }); }
export function markSeen(root, role, at = Date.now()) { check(readLayout(root).roles.includes(role), 'Role not selected.'); const v = consoleView(root); return saveView(root, { role: v.role, seen: seenAt(v, role, at) }); }
// Context window use per role: display only, newest reading wins.
const CONTEXT_SOURCES = ['pi', 'claude-statusline'];
const contextFile = (root, role) => { roleCheck(role); check(readLayout(root).roles.includes(role), 'Role not selected.'); return safe(root, '.harness/context', `${role}.json`); };
const validContext = (percent, at, source) => typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100 && Number.isSafeInteger(at) && at > 0 && CONTEXT_SOURCES.includes(source);
export function contextState(root, role) {
  const file = contextFile(root, role); if (!exists(file)) return null;
  const v = json(file, 4096);
  check(Object.keys(v).every(key => ['role', 'percent', 'at', 'source'].includes(key)) && v.role === role && validContext(v.percent, v.at, v.source), 'Invalid context state.');
  return v;
}
export function setContext(root, role, percent, { at = Date.now(), source } = {}) {
  const file = contextFile(root, role);
  check(validContext(percent, at, source), 'Invalid context usage.');
  let current = null; try { current = contextState(root, role); } catch {}
  if (current && current.at > at) return current;
  const record = { role, percent, at, source };
  atomic(root, file, encode(record)); return record;
}
// Live state is display evidence only: never workflow authority, so it skips the protocol lock and keeps the newest event.
const LIVE_STATES = ['working', 'idle', 'native', 'failed'], LIVE_SOURCES = ['pi', 'claude-hook'], LIVE_TOOL = /^[A-Za-z0-9_.:-]{1,80}$/;
const liveFile = (root, role) => { roleCheck(role); check(readLayout(root).roles.includes(role), 'Role not selected.'); return safe(root, '.harness/live', `${role}.json`); };
export function liveState(root, role) {
  const file = liveFile(root, role); if (!exists(file)) return null;
  const v = json(file, 4096);
  check(Object.keys(v).every(key => ['role', 'state', 'tool', 'at', 'source'].includes(key)) && v.role === role && LIVE_STATES.includes(v.state) && LIVE_SOURCES.includes(v.source) && Number.isSafeInteger(v.at) && v.at > 0 && (v.tool === undefined || matches(LIVE_TOOL, v.tool)), 'Invalid live state.');
  return v;
}
// Hooks fire as parallel processes: a per-record lock serializes read-compare-write so a slow older event cannot
// overwrite a newer one. Display-only, so a lock left by a killed writer is stolen after 2s.
function displayLock(root, record, operation) {
  const file = record.replace(/\.json$/, '.lock'), pause = new Int32Array(new SharedArrayBuffer(4));
  fs.mkdirSync(path.dirname(file), { recursive: true }); safe(root, path.relative(root, file));
  for (let attempt = 0; ; attempt++) {
    let fd;
    try { fd = fs.openSync(file, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try { if (Date.now() - fs.lstatSync(file).mtimeMs > 2000) { fs.unlinkSync(file); continue; } } catch {}
      check(attempt < 400, 'Display record busy.'); Atomics.wait(pause, 0, 0, 5); continue;
    }
    try { return operation(); } finally { fs.closeSync(fd); try { fs.unlinkSync(file); } catch {} }
  }
}
// Whether the current turn answers the harness's own launch prompt; that reply needs no user check.
const turnFile = (root, role) => { roleCheck(role); check(readLayout(root).roles.includes(role), 'Role not selected.'); return safe(root, '.harness/live', `${role}-turn.json`); };
export function setTurn(root, role, bootstrap) { atomic(root, turnFile(root, role), encode({ bootstrap: bootstrap === true })); }
export function bootstrapTurn(root, role) { const file = turnFile(root, role); return exists(file) && json(file, 256).bootstrap === true; }
export function setLive(root, role, state, { tool, at = Date.now(), source } = {}) {
  check(LIVE_STATES.includes(state), 'Invalid live state.'); check(LIVE_SOURCES.includes(source), 'Invalid live source.');
  check(tool === undefined || matches(LIVE_TOOL, tool), 'Invalid live tool.'); check(Number.isSafeInteger(at) && at > 0, 'Invalid live time.');
  return displayLock(root, liveFile(root, role), () => {
    let current = null; try { current = liveState(root, role); } catch {}
    if (current && current.at > at) return current;
    const record = { role, state, ...(tool ? { tool } : {}), at, source };
    atomic(root, liveFile(root, role), encode(record)); return record;
  });
}
