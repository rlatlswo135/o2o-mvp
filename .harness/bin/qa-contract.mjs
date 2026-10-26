import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const hash = data => createHash('sha256').update(data).digest('hex');
const text = value => typeof value === 'string' && value.trim() && value.length <= 4000;
const answers = ['values', 'failures', 'oracle', 'boundaries', 'environment'];

function file(root, relative) {
  root = fs.realpathSync(root);
  const target = path.resolve(root, relative), rel = path.relative(root, target);
  check(rel && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel), 'QA path must stay inside project.');
  let current = root;
  for (const segment of rel.split(path.sep)) {
    current = path.join(current, segment);
    check(!fs.lstatSync(current).isSymbolicLink(), 'Symlink not allowed in QA evidence.');
  }
  const stat = fs.statSync(target);
  check(stat.isFile() && stat.size <= 131072, 'Invalid or oversized QA evidence file.');
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { return fs.readFileSync(fd); } finally { fs.closeSync(fd); }
}

export function interviewRecord(storyHash, input) {
  check(input && answers.every(key => text(input[key])) && Object.keys(input).every(key => answers.includes(key)), 'QA interview requires values, failures, oracle, boundaries and nonproduction environment.');
  return { version: 1, story_hash: storyHash, answers: input };
}

export function verificationContract(root, story, storyHash, contractFile) {
  const folder = `.harness/stories/${story}/`;
  check(contractFile === folder + 'qa-contract.json', 'QA contract must be qa-contract.json inside story.');
  const interviewFile = folder + 'qa-values.json', interviewBytes = file(root, interviewFile), interview = JSON.parse(interviewBytes);
  check(interview.version === 1 && interview.story_hash === storyHash, 'QA interview story revision changed; ask user again.');
  interviewRecord(storyHash, interview.answers);
  const content = file(root, contractFile), contract = JSON.parse(content);
  check(contract.version === 1 && Array.isArray(contract.criteria) && contract.criteria.length > 0 && contract.criteria.length <= 30, 'QA contract needs 1–30 criteria.');
  const ids = new Set(), tests = {};
  for (const criterion of contract.criteria) {
    check(criterion && typeof criterion.id === 'string' && /^[A-Z][A-Z0-9_-]{0,31}$/.test(criterion.id) && !ids.has(criterion.id), 'QA criterion IDs must be unique.'); ids.add(criterion.id);
    check(['value', 'condition', 'oracle'].every(key => text(criterion[key])) && typeof criterion.required === 'boolean' && typeof criterion.irreversible === 'boolean' && Array.isArray(criterion.cases) && criterion.cases.length > 0 && criterion.cases.length <= 20 && criterion.cases.every(text), 'QA criterion needs value, condition, independent oracle, cases and explicit risk flags.');
    check(criterion.method === undefined || ['browser', 'test'].includes(criterion.method), 'QA criterion method must be browser or test.');
    const browser = criterion.method === 'browser';
    check(Array.isArray(criterion.tests) && (browser || criterion.tests.length > 0) && criterion.tests.length <= 20 && new Set(criterion.tests).size === criterion.tests.length, 'QA criterion needs executable independent tests unless its method is browser.');
    for (const test of criterion.tests) {
      check(typeof test === 'string' && test.startsWith(folder + 'acceptance/') && path.relative(root, path.resolve(root, test)).split(path.sep).join('/') === test, 'QA tests must stay in story acceptance directory.');
      tests[test] = hash(file(root, test));
    }
  }
  check(contract.criteria.some(item => item.required), 'QA contract must include a required criterion.');
  return { story_hash: storyHash, file: contractFile, hash: hash(content), interview: { file: interviewFile, hash: hash(interviewBytes) }, tests,
    ...(contract.criteria.some(item => item.required && item.method === 'browser') ? { browser: true } : {}) };
}

export function validateVerification(root, story, record) {
  check(record && typeof record.file === 'string' && /^[a-f0-9]{64}$/.test(record.story_hash), 'Invalid QA verification contract.');
  const actual = verificationContract(root, story, record.story_hash, record.file);
  check(JSON.stringify(actual) === JSON.stringify(record), 'QA verification contract, interview or acceptance test changed after readiness/approval.');
  return JSON.parse(file(root, record.file));
}

export function qaResults(root, story, request, verification, record, { complete = false, passing = false } = {}) {
  const contract = validateVerification(root, story, verification);
  check(record?.request_id === request.id && record.baseline === request.baseline && record.contract_hash === verification.hash && record.criteria && typeof record.criteria === 'object' && !Array.isArray(record.criteria), 'QA results do not match frozen request and contract.');
  for (const [id, result] of Object.entries(record.criteria)) {
    check(contract.criteria.some(item => item.id === id) && ['pass', 'fail', 'blocked'].includes(result?.outcome), 'Invalid QA criterion result.');
    check(typeof result.evidence === 'string' && result.evidence.startsWith(`.harness/stories/${story}/`) && hash(file(root, result.evidence)) === result.hash, 'QA result evidence changed or is outside story.');
  }
  if (complete) for (const criterion of contract.criteria.filter(item => item.required)) {
    check(record.criteria[criterion.id], `QA results missing required criterion ${criterion.id}.`);
    if (passing) check(record.criteria[criterion.id].outcome === 'pass', `Required QA criterion ${criterion.id} is ${record.criteria[criterion.id].outcome}, not PASS.`);
  }
  return record;
}
