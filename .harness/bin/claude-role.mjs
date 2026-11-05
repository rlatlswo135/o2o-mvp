// Claude Code counterpart of the Pi extension (integrations/reviewer.ts) for planner, reviewer, designer, qa and refactor.
// Pi pushes requests into the pane and opens its own dialogs; Claude cannot be driven that way, so here
//   next     = the delivery prompt the extension would have typed (the role waits with `listen`, then asks `next`),
//   tool     = the extension's c2h_* tools as a CLI; choices are two calls: options first, then the chosen label + token,
//   snapshot / settle = Claude hooks that stand in for before_agent_start / agent_before_settle: forwarding that needs
//              no user choice happens here, anything else is a reminder the hook feeds back to the model.
// The protocol itself stays in the c2h CLI; keep the checks here in step with the extension.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const STORY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, SHA = /^[a-f0-9]{64}$/, REQUEST_ID = /^\d{8}T\d{12}Z-[a-f0-9]{12}$/;
const MAX_FEEDBACK_ROUNDS = 3;
const CHAT_DESIGN = 'Chat about this — 취향·참고 화면부터 논의';
const HOW = 'AskUserQuestion으로 options를 순서·문구 그대로 단일 선택으로 묻는다(텍스트 질문 금지). 고른 라벨을 choice로, 이 token을 token으로 넣어 같은 툴을 다시 호출한다. 답이 없거나 닫히면 승인이 아니다.';

const cli = (root, ...args) => JSON.parse(execFileSync(process.execPath, [path.join(root, '.harness/bin/c2h.mjs'), ...args],
  { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
const done = (action, text) => ({ action, text });
const choose = (title, options, token, extra = {}) => ({ action: 'choose', title, options, token, how: HOW, ...extra });
// Only a choice the user has to make comes back to the model; anything the hook did on its own is a notice.
const outcome = result => ({ notice: result.text, ...(['discuss', 'refine', 'finalized'].includes(result.action) ? { block: result.text } : {}) });

function asRole(root, ...roles) {
  const role = process.env.C2H_ROLE;
  if (!roles.includes(role)) throw new Error(`Use the ${roles.join('/')} pane.`);
  if (process.env.C2H_PROJECT && fs.realpathSync(process.env.C2H_PROJECT) !== root) throw new Error('c2h project mismatch.');
  return role;
}
const storyId = value => { if (typeof value !== 'string' || !STORY_ID.test(value)) throw new Error('Invalid story ID. Pass only the ID, e.g. S001.'); return value; };
function storyFile(root, story) {
  const file = path.join(root, '.harness/stories', storyId(story), 'story.md');
  if (fs.realpathSync(file) !== file) throw new Error('Symlinked story not allowed.');
  return file;
}
// Fixed path: compaction deletes story.md, so this must not go through storyFile.
const resultDraft = story => `.harness/stories/${story}/records/result-draft.md`;

// ---- Run state: what the extension keeps in memory between before_agent_start and agent_before_settle. ----
const liveFile = (root, role, name) => path.join(root, '.harness/live', `${role}-${name}.json`);
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value)); fs.renameSync(temp, file);
}
const readRun = (root, role) => readJson(liveFile(root, role, 'run'), {});
const mark = (root, role, patch) => writeJson(liveFile(root, role, 'run'), { ...readRun(root, role), ...patch });

// ---- Typed role messages (JSON inside a plain message). ----
function typed(message, sender, target, type) {
  if (message?.kind !== 'message' || message.sender !== sender || target && message.target !== target) return;
  let data; try { data = JSON.parse(message.message ?? ''); } catch { return; }
  return data?.type === type ? data : undefined;
}
function pinned(data, keys, label) {
  if (keys.some(key => typeof data[key] !== 'string' || !SHA.test(data[key]))) throw new Error(label);
  return data;
}
const qaHash = message => { const data = typed(message, 'planner', null, 'c2h_qa_request'); return data && pinned(data, ['story_hash'], 'Invalid QA request story hash.').story_hash; };
const planningFeedback = message => { const data = typed(message, 'designer', 'planner', 'c2h_plan_feedback'); return data && pinned(data, ['story_hash'], 'Invalid planning feedback scope.'); };

const reportPattern = role => new RegExp(`^${role === 'reviewer' ? 'review' : role === 'designer' ? 'design-review' : role === 'refactor' ? 'refactor' : 'qa'}-[1-9][0-9]*\\.md$`);
function draftFiles(root, story, role) {
  const folder = path.dirname(storyFile(root, story));
  return Object.fromEntries([folder, path.join(folder, 'records')].filter(dir => fs.existsSync(dir)).flatMap(dir =>
    fs.readdirSync(dir).filter(name => reportPattern(role).test(name)).map(name => {
      const file = path.join(dir, name);
      if (fs.realpathSync(file) !== file || !fs.lstatSync(file).isFile()) throw new Error('Invalid report draft path.');
      return [path.relative(root, file), hash(file)];
    })));
}
// Review drafts of the active independent refactor (its folder holds proposal, report and review-N.md).
function refactorDrafts(root, task) {
  if (typeof task !== 'string' || !REQUEST_ID.test(task)) throw new Error('Invalid refactor task ID.');
  const dir = path.join(root, '.harness/refactor', task);
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(name => reportPattern('reviewer').test(name)).map(name => {
    const file = path.join(dir, name);
    if (fs.realpathSync(file) !== file || !fs.lstatSync(file).isFile()) throw new Error('Invalid report draft path.');
    return [path.relative(root, file), hash(file)];
  }));
}
// Designer → planner requirement rounds for one story; past the limit the designer asks the user instead of looping.
function feedbackRounds(root, story) {
  let rounds = 0;
  for (const folder of ['.harness/inbox/planner', '.harness/inbox/planner/processed']) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^\d{8}T\d{12}Z-[a-f0-9]{12}\.json$/.test(name)) continue;
      try { const message = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); if (message.story === story && planningFeedback(message)) rounds++; } catch { /* unreadable records are not rounds */ }
    }
  }
  return rounds;
}
function planningScope(root, story, role) {
  const state = cli(root, 'resume', role);
  if (state.busy || state.action === 'blocked' || state.phase !== 'planning' || state.checkpoint?.story && state.checkpoint.story !== story)
    throw new Error(`Planning scope unavailable: ${JSON.stringify(state)}`);
  return { state, revision: hash(storyFile(root, story)) };
}

// ---- Tools (c2h_*) ----
function planNext(root, args) {
  const story = storyId(args.story);
  mark(root, 'planner', { planSelectionShown: true });
  const current = cli(root, 'resume', 'planner');
  if (current.story && current.story !== story) throw new Error(`Story ID mismatch: the active story is ${current.story}. Pass only the story ID.`);
  if (current.action !== 'plan' || current.busy) throw new Error(`c2h: ${JSON.stringify(current)}`);
  const file = storyFile(root, story), before = hash(file);
  const designState = cli(root, 'design-status', story), acceptedDesign = designState.ready;
  const designStale = !acceptedDesign && designState.stale === true;
  const verification = cli(root, 'qa-status', story);
  const team = cli(root, 'roles'), roles = team.roles, selectedRoles = team.selected ?? roles;
  const qaRequired = selectedRoles.includes('qa') || Boolean(verification.ready);
  // A running independent refactor owns the source; planning continues but implementation waits for it to finish.
  const refactoring = current.refactor ? ` · 독립 리팩터링 ${current.refactor.id} 진행 중 — 실행자 인계는 끝난 뒤` : '';
  const browserReady = verification.ready?.browser === true;
  const designReady = !qaRequired || browserReady && roles.includes('qa');
  const designHandoffReady = !acceptedDesign || designReady;
  const directLabel = !selectedRoles.includes('designer') && !qaRequired ? '디자인·브라우저 검증 executor 담당 — 구현 승인·실행자에게 넘기기' : '화면·브라우저 검증 불필요 확인 — 구현 승인·실행자에게 넘기기';
  const handoff = !refactoring && !acceptedDesign?.needs_planning && !designStale && roles.includes('executor') && (!qaRequired || roles.includes('qa')) && designHandoffReady ? [{ action: 'handoff', target: 'executor', label: acceptedDesign || browserReady ? `이 범위 구현 승인·실행자에게 넘기기${qaRequired ? '' : ' (브라우저 검증: executor)'}` : directLabel }] : [];
  const design = roles.includes('designer') && designReady ? [{ action: 'design', target: 'designer', label: (designStale ? '디자이너에게 넘기기 (바뀐 스토리로 디자인 재확인 · 이후 구현까지 자동)' : '디자이너에게 넘기기 (방향은 직접 선택 · 이후 설계·구현 인계는 자동)') + (qaRequired ? '' : ' · 브라우저 검증: executor') }] : [];
  const designHold = (roles.includes('designer') && !designReady || acceptedDesign && !designHandoffReady) ? ` · 디자인 인계 불가: ${!browserReady ? '필수 browser QA 계약 없음' : 'QA 역할 미실행'}` : '';
  const choices = [
    ...(roles.includes('qa') && (!verification.ready || (selectedRoles.includes('designer') || acceptedDesign) && !browserReady) ? [{ action: 'qa', target: 'qa', label: 'QA 검증 계약 만들기/보강 (UI는 필수 브라우저 기준)' }] : []),
    ...(acceptedDesign ? [...handoff, ...design] : [...design, ...handoff]),
    { action: 'refine', label: '스토리 검토·보강하기', target: undefined },
    { action: 'discuss', label: '이 내용 논의하기 (chat about this)', target: undefined },
  ];
  // The token stands in for the extension's "changed while choosing" checks: any change to what the choice rests on voids it.
  const token = fingerprint({ before, current, designState, verification, roles, selectedRoles });
  if (args.choice === undefined) return choose(`${story} 계획 완료 — 다음 행동${refactoring}${designStale ? ' · 스토리가 바뀌어 디자인 재확인 필요' : ''}${verification.ready ? ` · 검증 계약: ${verification.ready.file}` : ''}${designHold}`, choices.map(choice => choice.label), token);
  if (args.token !== token) throw new Error('Planning state changed while choosing; show the new scope and ask again.');
  const choice = choices.find(item => item.label === args.choice);
  if (!choice) throw new Error('Unknown choice; pass the option text exactly.');
  if (JSON.stringify(cli(root, 'design-status', story)) !== JSON.stringify(designState) || JSON.stringify(cli(root, 'qa-status', story)) !== JSON.stringify(verification)) throw new Error('Design or QA contract changed while choosing; ask again.');
  if (!choice.target) return done(choice.action, choice.action === 'refine' ? '사용자와 스토리를 검토·보강한다. 구현 승인 아님. 보강한 범위를 보여 준 뒤 c2h_plan_next를 다시 호출해 선택을 연다.' : '사용자와 이 계획을 논의한다. 구현 승인 아님. 논의 후 c2h_plan_next를 다시 호출해 선택을 연다.');
  if (choice.action === 'qa') {
    const sent = cli(root, 'send', '--from', 'planner', '--to', 'qa', '--story', story, '--message', JSON.stringify({ type: 'c2h_qa_request', story_hash: before }));
    return done('qa', `QA 검증 계약 요청 저장: ${sent.id}. 사용자의 가치·허용 불가 실패·정답 기준·경계·비운영 환경을 확인하고 독립 인수 테스트를 준비한다. 구현 승인은 아님.`);
  }
  if (choice.action === 'design') {
    const sent = cli(root, 'send', '--from', 'planner', '--to', 'designer', '--story', story,
      '--message', JSON.stringify({ type: 'c2h_design_request', story_hash: before,
        message: `.harness/stories/${story}/story.md 범위의 화면·상호작용 설계 요청. 사용자와 방향만 고른 뒤 design.md·preview.html 한 벌을 만든다. 요구 변경은 플래너와 자동으로 주고받고, 확정된 설계는 이 스토리 범위 그대로 실행자에게 자동 인계된다. 소스·story.md·checkpoint 변경 금지.` }));
    return done('design', `설계 요청 저장: ${sent.id}. 디자이너가 사용자와 방향을 고른 뒤 설계·미리보기를 만든다. 이후 플래너 재검토와 실행자 인계는 자동이며, 이 선택이 확정 설계의 구현 승인이다.`);
  }
  const designArgs = acceptedDesign ? ['--design', acceptedDesign.design.file, '--preview', acceptedDesign.design.preview,
    '--design-hash', acceptedDesign.design.hash, '--preview-hash', acceptedDesign.design.preview_hash] : [];
  const sent = cli(root, 'handoff', story, '--approved', '--story-hash', before, ...designArgs, ...(verification.ready ? ['--qa-hash', verification.ready.hash] : []));
  return done('handoff', `승인된 스토리 인계 저장: ${sent.id}. 수신·착수는 실행자의 ack/체크포인트로 확인한다. 저장만으로 구현 완료나 수신을 주장하지 않는다.`);
}

// Completion is already recorded by the executor's automatic flow; this only seals the human summary into result.md.
function storyNext(root, args) {
  const story = storyId(args.story), summary = String(args.summary ?? '');
  mark(root, 'planner', { completionSelectionShown: true });
  const state = cli(root, 'resume', 'planner');
  if (state.busy || state.action !== 'plan_next' || state.phase !== 'done' || state.story !== story || state.message?.story !== story || state.result)
    throw new Error('Completion summary requires the current uncompressed DONE handoff.');
  const file = path.resolve(root, summary);
  if (file !== path.join(root, resultDraft(story)) || fs.realpathSync(file) !== file) throw new Error('Save the completion summary as records/result-draft.md in this story.');
  const completed = cli(root, 'compact-story', story, '--summary', summary, '--summary-hash', hash(file), '--approved');
  return done('finalized', `완료 결과 확정: ${completed.result}. 나머지 스토리 파일은 정리됐다. 사용자에게 이 경로와 한 일을 짧게 알리고 다음 스토리 요청을 기다린다. 다음 스토리를 먼저 만들지 않는다. planning_request ${state.message.id}는 다음 스토리의 planning checkpoint 저장 후 ack한다.`);
}

function designDirection(root, args) {
  const story = storyId(args.story);
  mark(root, 'designer', { directionSelectionShown: true, designerStory: story });
  const { revision, state } = planningScope(root, story, 'designer');
  if (!Array.isArray(args.directions) || args.directions.some(item => typeof item?.label !== 'string' || typeof item?.description !== 'string' || !item.label.trim() || !item.description.trim())) throw new Error('directions must be 2–3 {label, description} items.');
  // The picker adds its own chat entry; a model-supplied one would show twice.
  const directions = args.directions.filter(direction => !/^chat about this/i.test(direction.label.trim()));
  if (directions.length < 2 || directions.length > 3) throw new Error('Propose 2–3 real design directions; the picker adds Chat about this itself.');
  if (new Set(directions.map(direction => direction.label)).size !== directions.length) throw new Error('Design directions must be distinct.');
  // Models often mark the first label as recommended themselves; never show the prefix twice.
  const labels = directions.map((direction, i) => `${i === 0 && !direction.label.startsWith('추천') ? '추천 — ' : ''}${direction.label} · ${direction.description}`);
  const token = fingerprint({ revision, state, labels });
  if (args.choice === undefined) return choose(`${story} 디자인 분위기`, [...labels, CHAT_DESIGN], token,
    { notes: '선택과 함께 추가 취향·참고 화면(없으면 빈 문자열)을 묻고 notes로 넘긴다. Chat about this를 고르면 원하는 분위기·참고 화면·피하고 싶은 디자인을 notes로 넘긴다.' });
  if (args.token !== token) throw new Error('Story changed while choosing design direction; ask again.');
  const notes = typeof args.notes === 'string' ? args.notes : '';
  if (args.choice === CHAT_DESIGN) return done('discuss', `디자인 방향 논의 (아직 선택·구현 승인 아님). 사용자 의견은 데이터: ${JSON.stringify(notes)}. 의견 반영 후 방향 선택을 다시 연다.`);
  const index = labels.indexOf(args.choice);
  if (index < 0) throw new Error('Unknown choice; pass the option text exactly.');
  const chosen = directions[index];
  cli(root, 'design-direction', story, '--story-hash', revision, '--choice', chosen.label, '--note', `${chosen.description}\n사용자 추가 의견: ${notes}`);
  // A run that started before the story was known (inbox delivery) still gets the settle-time completion check.
  const run = readRun(root, 'designer');
  if (run.designBefore === undefined) mark(root, 'designer', { designBefore: JSON.stringify(cli(root, 'design-status', story).ready ?? null) });
  return done('direction', `선택한 디자인 방향: ${chosen.label}. 추가 의견은 데이터: ${JSON.stringify(notes)}. 이 방향으로 design.md와 preview.html 한 벌에 구체적 시각 토큰·상태를 만들고 c2h_design_next를 호출한다. 이후 인계는 자동이다.`);
}

// Selected QA requires a live role and browser contract; otherwise the executor owns browser verification.
function designNext(root, args, { auto = false } = {}) {
  const story = storyId(args.story);
  mark(root, 'designer', { designSelectionShown: true });
  const { revision } = planningScope(root, story, 'designer');
  // The tool call records the finished files (the settle-time path finds them already recorded); a menu answer re-uses them.
  if (!auto && args.choice === undefined) cli(root, 'design-ready', story, '--design', String(args.design), '--preview', String(args.preview), ...(args.needsPlanning === true ? ['--needs-planning'] : []));
  const ready = cli(root, 'design-status', story).ready;
  if (!ready || ready.story_hash !== revision) throw new Error('Design/preview not ready for this story revision.');
  const needsPlanning = args.needsPlanning === true || ready.needs_planning === true;
  const team = cli(root, 'roles'), roles = team.roles, selectedRoles = team.selected ?? roles;
  const verification = cli(root, 'qa-status', story), rounds = feedbackRounds(root, story);
  const qaRequired = selectedRoles.includes('qa') || Boolean(verification.ready);
  const browserReady = verification.ready?.browser === true;
  const qaLive = roles.includes('qa');
  const refactor = cli(root, 'resume', 'designer').refactor ?? null;
  const qaPreparing = qaRequired && !verification.ready && (fs.existsSync(path.join(path.dirname(storyFile(root, story)), 'qa-values.json')) ||
    cli(root, 'inbox', 'qa').some(message => message.story === story && qaHash(message)));
  const planning = () => {
    const sent = cli(root, 'send', '--from', 'designer', '--to', 'planner', '--story', story, '--message', JSON.stringify({ type: 'c2h_plan_feedback', story_hash: revision, design: ready.design,
      message: "design.md의 '남은 결정'에 적힌 요구사항·범위 질문을 검토해 story.md에 반영한다. 사용자 결정이 필요한 것만 사용자에게 묻는다. 구현 승인 아님." }));
    return done('planning', `요구사항 재검토 자동 인계: ${sent.id} (${rounds + 1}/${MAX_FEEDBACK_ROUNDS}회차). 플래너가 반영하면 같은 디자인 방향으로 이 pane에 다시 요청이 온다.`);
  };
  const qaReady = !qaRequired || browserReady && qaLive && !qaPreparing;
  const handoff = () => {
    if (qaRequired && (!browserReady || !qaLive)) throw new Error('Design handoff requires a pinned required browser QA criterion and a live QA role.');
    const sent = cli(root, 'handoff', story, '--approved', '--from', 'designer', '--story-hash', revision, '--design', ready.design.file,
      '--preview', ready.design.preview, '--design-hash', ready.design.hash, '--preview-hash', ready.design.preview_hash,
      ...(verification.ready ? ['--qa-hash', verification.ready.hash] : []));
    return done('handoff', `스토리·디자인·미리보기 자동 인계: ${sent.id}. 실행자는 고정된 문서·시안을 읽고 동일 범위만 구현한다. 저장만으로 착수를 주장하지 않는다.`);
  };
  if (needsPlanning && roles.includes('planner') && rounds < MAX_FEEDBACK_ROUNDS) return planning();
  if (!needsPlanning && roles.includes('executor') && qaReady && !refactor) return handoff();
  if (auto) return null;
  const reason = needsPlanning ? (roles.includes('planner') ? `플래너 재검토 ${rounds}회 반복 — 직접 결정 필요` : '플래너 미실행') : [qaRequired && (qaPreparing || !browserReady) ? '필수 browser QA 검증 계약 준비 중' : '', qaRequired && !qaLive ? 'QA 역할 미실행' : '', refactor ? `독립 리팩터링 ${refactor.id} 진행 중 — 끝난 뒤 실행자 인계` : ''].filter(Boolean).join(' · ') || '실행자 미실행';
  const choices = [
    ...(!needsPlanning && !refactor && qaReady && roles.includes('executor') ? [{ action: 'handoff', target: 'executor', label: qaRequired ? '스토리·디자인·browser QA 확인 — 구현 승인·실행자에게 넘기기' : '스토리·디자인 승인 — 브라우저 검증 executor 담당·실행자에게 넘기기' }] : []),
    ...(roles.includes('planner') ? [{ action: 'planning', target: 'planner', label: '요구사항 재검토·플래너에게 보내기' }] : []),
    { action: 'refine', target: undefined, label: '디자인 보강하기' },
    { action: 'discuss', target: undefined, label: 'Chat about this — 디자인 논의하기' },
  ];
  const token = fingerprint({ revision, ready, roles, selectedRoles, verification, rounds, refactor });
  if (args.choice === undefined) return choose(`${story} 디자인 완료 (${reason}) — 미리보기: ${ready.design.preview}`, choices.map(choice => choice.label), token);
  if (args.token !== token) throw new Error('Design scope changed while choosing; present it and ask again.');
  const choice = choices.find(item => item.label === args.choice);
  if (!choice) throw new Error('Unknown choice; pass the option text exactly.');
  if (!choice.target) return done(choice.action, choice.action === 'refine' ? '사용자와 디자인을 보강한다. design.md·preview.html을 갱신한 뒤 c2h_design_next를 다시 호출한다.' : '사용자와 디자인을 논의한다. 구현 승인 아님. 논의 후 c2h_design_next를 다시 호출한다.');
  return choice.action === 'planning' ? planning() : handoff();
}

function reviewNext(root, args) {
  asRole(root, 'reviewer');
  mark(root, 'reviewer', { reportSelectionShown: true });
  const { requestId, review } = args;
  const state = cli(root, 'resume', 'reviewer');
  if (state.busy || state.action !== 'review_choices' || state.request?.id !== requestId || !state.story) throw new Error(`Review draft is not ready or request changed: ${state.action}`);
  const file = path.resolve(root, String(review)), folder = path.dirname(storyFile(root, state.story));
  if (!file.startsWith(folder + path.sep) || path.extname(file) !== '.md' || fs.realpathSync(file) !== file) throw new Error('Invalid review path.');
  const sent = cli(root, 'reply', requestId, '--review', review);
  if (sent.pending?.length) return done('send', `코드 리뷰 보고서 저장. 대기 역할: ${sent.pending.join(', ')}. 모든 보고서 제출 후 실행자에게 종합 회신 한 번만 전달된다.`);
  return done('send', `리뷰 회신 저장: ${sent.id}. 실행자가 계획과 대조해 반영할 지적을 자동으로 고치고 스토리를 완료한다.`);
}

function qualityNext(root, args) {
  const role = asRole(root, 'designer', 'qa', 'refactor');
  mark(root, role, { reportSelectionShown: true });
  const { requestId, report } = args;
  const state = cli(root, 'resume', role);
  if (state.busy || state.action === 'blocked') throw new Error(`c2h: ${JSON.stringify(state)}`);
  const quality = cli(root, 'quality-status', requestId);
  if (!quality.checks.includes(role) || !quality.pending.includes(role) && !quality.recovery) throw new Error('This role has no pending check in the batch.');
  const file = path.resolve(root, String(report)), folder = path.dirname(storyFile(root, quality.request.story));
  if (!file.startsWith(folder + path.sep) || path.extname(file) !== '.md' || fs.realpathSync(file) !== file) throw new Error('Invalid quality report path.');
  const sent = cli(root, 'submit-check', requestId, '--from', role, '--review', report);
  return done('send', sent.pending.length ? `${role} 보고서 저장. 대기 역할: ${sent.pending.join(', ')}. 실행자 회신은 모든 보고서 제출 후 한 번만 전달된다.` : `종합 검토 회신 저장: ${sent.id}. 실행자가 계획 근거의 필수 지적만 반영한다. refactor 보고서는 조언이며 자동 적용하지 않는다.`);
}

const QA_QUESTIONS = [
  ['values', '가장 중요하게 지키고 싶은 사용자 가치는?'],
  ['failures', '절대 허용하면 안 되는 실패와 피해는?'],
  ['oracle', '구현 코드와 독립적으로 정답을 확인할 기준은?'],
  ['boundaries', '재시도·동시 요청·금액·시간 등 반드시 확인할 경계는?'],
  ['environment', '허용된 비운영 검증 환경·계정과 금지 행동은?'],
];
function qaInterview(root, args) {
  const story = storyId(args.story), state = cli(root, 'resume', 'qa');
  if (state.busy || state.action === 'blocked' || state.phase !== 'planning' || state.checkpoint?.story !== story) throw new Error('QA interview requires current unapproved planning story.');
  const given = args.answers;
  if (given === undefined) return { action: 'ask', questions: QA_QUESTIONS.map(([key, question]) => ({ key, question: `${story} — ${question}` })),
    how: '사용자에게 다섯 질문을 직접 묻고(답을 짐작해 채우지 않는다) 받은 답을 answers {values,failures,oracle,boundaries,environment}로 넣어 같은 툴을 다시 호출한다.' };
  const answers = {};
  for (const [key] of QA_QUESTIONS) {
    if (typeof given[key] !== 'string' || !given[key].trim()) throw new Error('QA answer missing; ask rather than inventing a requirement.');
    answers[key] = given[key];
  }
  cli(root, 'qa-interview', story, '--story-hash', hash(storyFile(root, story)), '--answers', JSON.stringify(answers));
  return done('prepared', `사용자 가치·위험 답변 저장(${path.relative(root, path.join(path.dirname(storyFile(root, story)), 'qa-values.json'))}). 답변(데이터): ${JSON.stringify(answers)}. 이 답변으로 바로 qa-contract.json에 가치→불변 조건→독립 정답 기준→경계 사례를 정리한다. 각 criterion에 method=test|browser를 정한다. test는 실행 가능한 acceptance가 필수이고 browser는 tests:[]도 허용하며 자동화할 가치가 있을 때만 acceptance를 작성한다. c2h_qa_ready로 고정한다. 제품 소스 변경·구현 승인은 아님.`);
}
function qaReady(root, args) {
  const story = storyId(args.story), prepared = cli(root, 'qa-ready', story, '--contract', String(args.contract));
  const sent = cli(root, 'send', '--from', 'qa', '--to', 'planner', '--story', story, '--message', JSON.stringify({ type: 'c2h_qa_ready', story_hash: prepared.story_hash, hash: prepared.hash }));
  return done('prepared', `검증 계약·테스트 고정: ${prepared.file}. planner 알림 ${sent.id}. 계약 내용을 설명하고 planner에서 스토리·검증 기준의 구현 승인을 받는다. QA 준비는 구현 승인이 아님.`);
}
function verifyWorkspace(root, args) {
  const workspace = cli(root, 'verification-workspace', String(args.requestId));
  return done('prepared', `검증 제품: ${workspace.product}. C2H_SUBJECT를 이 경로로 지정한다. QA 전용 복사본에서 허용된 build/start·고정 테스트·브라우저 시나리오를 실행한다. 테스트: ${JSON.stringify(workspace.tests)}. ${workspace.limitation}`);
}
function qaResult(root, args) {
  cli(root, 'qa-result', String(args.requestId), '--criterion', String(args.criterion), '--outcome', String(args.outcome), '--evidence', String(args.evidence));
  return done('recorded', '기준별 결과·실행 증거 저장. 필수 기준 누락·FAIL·blocked는 PASS나 완료가 아니다.');
}

// Independent tasks never resolve storyFile: the last story may already be compacted.
function refactorPrompt(root) {
  const file = path.join(root, '.harness/refactor-prompt.md');
  if (!fs.existsSync(file)) return '';
  if (fs.realpathSync(file) !== file || !fs.lstatSync(file).isFile() || fs.statSync(file).size > 131072) throw new Error('Invalid refactor prompt.');
  return fs.readFileSync(file, 'utf8');
}
function refactorScope(root, taskId) {
  const state = cli(root, 'resume', 'refactor'), task = state.task;
  if (state.busy || state.action !== 'refactor_discuss' || !task || task.phase !== 'proposed' || taskId !== undefined && task.id !== taskId)
    throw new Error('Refactor task changed or is not ready.');
  const file = path.resolve(root, task.proposal), folder = path.join(root, '.harness/refactor', task.id);
  if (!REQUEST_ID.test(task.id) || !file.startsWith(folder + path.sep) || fs.realpathSync(file) !== file || !fs.lstatSync(file).isFile() || fs.statSync(file).size > 131072 || hash(file) !== task.proposal_hash)
    throw new Error('Refactor proposal changed; present the current proposal again.');
  const prompt = refactorPrompt(root);
  const team = cli(root, 'roles');
  return { state, task, proposal: fs.readFileSync(file, 'utf8'), prompt, roles: team.roles, selectedRoles: team.selected ?? team.roles };
}
function refactorNext(root, args) {
  // The second call must only revalidate, never replace the proposal whose token the user saw.
  if (args.choice === undefined && args.proposal !== undefined) cli(root, 'refactor-propose', '--summary', String(args.proposal));
  const scope = refactorScope(root, args.taskId), { task, roles } = scope;
  const options = [task.review_required === false ? 'executor에게 넘기기 (독립 리뷰 생략)' : 'executor에게 넘기기', '계속 논의'];
  const token = fingerprint(scope);
  if (args.choice === undefined) return choose(`${task.id} 작은 리팩터링 승인`, options, token, { taskId: task.id, proposal: scope.proposal, prompt: scope.prompt });
  if (args.choice === null) return done('cancel', '취소: 승인·인계 없음.');
  if (args.token !== token) throw new Error('Refactor state changed while choosing; show the proposal and ask again.');
  if (!options.includes(args.choice)) throw new Error('Unknown choice; pass the option text exactly.');
  if (args.choice === options[1]) return done('discuss', '계속 논의한다. 소스 수정·구현 승인 아님.');
  // Legacy tasks without a policy retain mandatory review.
  const missing = ['executor', ...(task.review_required === false ? [] : ['reviewer'])].filter(role => !roles.includes(role));
  if (missing.length) throw new Error(`${missing.join(', ')} is not running; no approval saved.`);
  cli(root, 'refactor-approve', task.id, '--approved', '--proposal-hash', task.proposal_hash, '--baseline', task.baseline);
  return done('handoff', `작은 리팩터링 승인 저장: ${task.id}. executor만 합의 범위를 수정하고, ${task.review_required === false ? '동일 전후 검증 뒤 독립 리뷰 생략을 명시하고 종료한다' : '끝나면 reviewer가 자동으로 리뷰한다'}. 착수·완료로 주장하지 않는다.`);
}
function refactorReview(root, args) {
  asRole(root, 'reviewer');
  mark(root, 'reviewer', { reportSelectionShown: true });
  if (typeof args.taskId !== 'string' || !REQUEST_ID.test(args.taskId)) throw new Error('Invalid refactor task ID.');
  const state = cli(root, 'resume', 'reviewer');
  if (state.busy || state.action !== 'refactor_review' || state.task?.id !== args.taskId) throw new Error(`Refactor review is not pending or the task changed: ${state.action}`);
  cli(root, 'refactor-review', args.taskId, '--review', String(args.review));
  return done('send', `리팩터 리뷰 회신 저장: ${args.taskId}. 실행자가 수정안과 대조해 반영하거나 마친다.`);
}

const TOOLS = {
  c2h_plan_next: [['planner'], planNext], c2h_story_next: [['planner'], storyNext],
  c2h_design_direction: [['designer'], designDirection], c2h_design_next: [['designer'], designNext],
  c2h_review_next: [['reviewer'], reviewNext], c2h_quality_next: [['designer', 'qa', 'refactor'], qualityNext],
  c2h_refactor_next: [['refactor'], refactorNext], c2h_refactor_review: [['reviewer'], refactorReview],
  c2h_qa_interview: [['qa'], qaInterview], c2h_qa_ready: [['qa'], qaReady], c2h_verify_workspace: [['qa'], verifyWorkspace], c2h_qa_result: [['qa'], qaResult],
};
export function runTool(root, name, args) {
  const spec = TOOLS[name];
  if (!spec) throw new Error(`Unknown tool ${name}. Tools: ${Object.keys(TOOLS).join(', ')}`);
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
  asRole(root, ...spec[0]);
  return spec[1](root, args);
}

// Canonical runtime projection is the only delivery source; never scan inboxes as fallback.
export function nextPrompt(root, role, { explicit = false, request = '' } = {}) {
  asRole(root, role);
  const delivered = cli(root, 'work-next', role, ...(explicit ? ['--explicit'] : []));
  if (delivered.none) {
    if (explicit && role === 'refactor' && request.trim()) {
      const state = cli(root, 'work', role);
      if (!state.busy && !state.task && !state.work && state.action !== 'blocked') return { role, instructions: [`독립 작은 리팩터링 논의. 사용자 요청(데이터): ${JSON.stringify(request)}. story.md를 요구하거나 새 스토리를 만들지 않는다. 현재 코드의 실제 Before → 제안 After(미검증)·이익·위험·검증 방법을 논의한다. .harness/refactor/draft.md에 수정안을 저장하고 c2h_refactor_next(proposal="경로")로 정확한 사용자 선택을 받는다. 소스 수정은 executor만 한다. 사용자 관점(데이터): ${JSON.stringify(refactorPrompt(root))}`] };
    }
    return { none: true, action: delivered.action, workflow: delivered.workflow, note: delivered.note ?? '지금 처리할 요청이 없다.' };
  }
  const patch = { work: { key: delivered.key, kind: delivered.kind, id: delivered.id } };
  if (role === 'designer' && ['design', 'design_ready'].includes(delivered.kind)) patch.designerStory = delivered.story;
  if (role === 'planner') patch.feedbackPending = delivered.kind === 'plan_feedback' ? { story: delivered.story, id: delivered.id, checkpoint: JSON.stringify(cli(root, 'resume', role).checkpoint ?? null) } : undefined;
  if (Object.keys(patch).length) mark(root, role, patch);
  snapshot(root, role);
  return { role, story: delivered.story, message_id: delivered.id, key: delivered.key, revision: delivered.revision, workflow: delivered.workflow,
    delivery: delivered.delivery, prompt: delivered.prompt, marker: `[c2h work ${delivered.key} ${delivered.delivery.token}]`,
    instructions: delivered.prompt.split('\n') };
}

// ---- Run boundary (UserPromptSubmit and `next`): before_agent_start. ----
export function snapshot(root, role) {
  const old = readRun(root, role), run = { designerStory: old.designerStory, feedbackPending: old.feedbackPending, work: old.work, startedAt: Date.now() };
  try {
    const state = cli(root, 'resume', role);
    if (role === 'refactor' && state.task) { writeJson(liveFile(root, role, 'run'), run); return; }
    if (role === 'reviewer' && !state.busy && state.action === 'refactor_review') run.refactorBefore = { task: state.task.id, files: refactorDrafts(root, state.task.id) };
    if ((role === 'reviewer' || role === 'designer' || role === 'qa' || role === 'refactor') && !state.busy && state.action !== 'blocked' && state.story && state.checkpoint?.request_id && ['reviewing', 'review_ready'].includes(state.phase ?? ''))
      run.reportBefore = { requestId: state.checkpoint.request_id, story: state.story, files: draftFiles(root, state.story, role) };
    if (role === 'planner') {
      run.planningBefore = JSON.stringify(state.checkpoint ?? null);
      if (!state.busy && state.action === 'plan_next' && state.phase === 'done' && state.story && state.message && !state.result) {
        const file = path.join(root, resultDraft(state.story));
        run.completionBefore = { story: state.story, requestId: state.message.id, digest: fs.existsSync(file) ? hash(file) : undefined };
      }
    }
    if (role === 'designer' && run.designerStory && state.phase === 'planning' && !state.busy && state.action !== 'blocked')
      run.designBefore = JSON.stringify(cli(root, 'design-status', run.designerStory).ready ?? null);
  } catch { /* a role must still start when the protocol cannot be read; resume reports the problem */ }
  writeJson(liveFile(root, role, 'run'), run);
}

// ---- Run end (Stop hook): agent_before_settle. Returns { block?, notice? } for the hook to print. ----
export function settle(root, role, { stopHookActive = false } = {}) {
  const run = readRun(root, role);
  if (run.work) {
    const current = cli(root, 'work', role).obligations?.find(task => task.key === run.work.key);
    if (current && ['waiting_user', 'blocked'].includes(current.status)) return {};
  }
  // One reminder per kind; a run the hook already continued is never continued again.
  const remind = (flag, text) => { if (run[flag] || stopHookActive) return {}; mark(root, role, { [flag]: true }); return { block: text }; };
  if (role === 'planner') {
    if (run.feedbackPending) {
      // Until the designer's question is answered, the planning menu stays closed: this run belongs to the round-trip.
      const state = cli(root, 'resume', 'planner'), pending = run.feedbackPending;
      if (state.busy || state.action !== 'plan' || state.phase !== 'planning' || state.story !== pending.story) return {};
      const unacked = cli(root, 'inbox', 'planner').some(message => message.id === pending.id);
      const obligation = state.obligations?.find(task => task.kind === 'plan_feedback' && task.id === pending.id);
      const unsaved = obligation ? obligation.stage !== 'return' : JSON.stringify(state.checkpoint ?? null) === pending.checkpoint;
      if (unacked || unsaved) {
        const missing = [unsaved ? `checkpoint ${pending.story} planning --note '디자인 피드백 반영: …'` : '', unacked ? `ack planner ${pending.id}` : ''].filter(Boolean).join(' · ');
        return remind('feedbackReminderSent', `디자인 피드백 ${pending.id} 반영이 끝나지 않았다: ${missing}. 사용자에게 결정을 물은 상태라면 답을 기다린다. story.md 반영 후 남은 단계를 마치면 디자이너에게 자동으로 돌아간다.`);
      }
      return outcome(returnToDesigner(root, state, pending));
    }
    if (run.completionBefore && !run.completionSelectionShown) {
      const state = cli(root, 'resume', 'planner'), summary = resultDraft(run.completionBefore.story), file = path.join(root, summary);
      if (state.busy || state.action !== 'plan_next' || state.phase !== 'done' || state.message?.id !== run.completionBefore.requestId || state.result || !fs.existsSync(file) || hash(file) === run.completionBefore.digest) return {};
      return outcome(storyNext(root, { story: run.completionBefore.story, summary }));
    }
    if (!run.planSelectionShown && run.planningBefore !== undefined) {
      const state = cli(root, 'resume', 'planner');
      if (state.busy || state.action !== 'plan' || state.phase !== 'planning' || !state.story || !state.checkpoint || JSON.stringify(state.checkpoint) === run.planningBefore) return {};
      return remind('planReminderSent', `${state.story} 계획이 저장됐지만 다음 행동 선택이 빠졌다. 저장한 범위를 사용자에게 보여 준 뒤 c2h_plan_next(story="${state.story}")를 호출하고, 반환된 선택지를 AskUserQuestion으로 묻는다. 텍스트 질문으로 대체하지 않는다.`);
    }
    return {};
  }
  // A single review draft saved during the run goes back to the executor, as story reviews do.
  if (run.refactorBefore && !run.reportSelectionShown) {
    const before = run.refactorBefore, state = cli(root, 'resume', 'reviewer');
    if (state.busy || state.action !== 'refactor_review' || state.task?.id !== before.task) return {};
    const changed = Object.entries(refactorDrafts(root, before.task)).filter(([file, digest]) => before.files[file] !== digest);
    if (!changed.length) return {};
    if (changed.length !== 1) return remind('reportReminderSent', '바뀐 리팩터링 리뷰 초안이 둘 이상이다. 제출할 리뷰의 정확한 경로로 c2h_refactor_review를 호출한다.');
    return outcome(refactorReview(root, { taskId: before.task, review: changed[0][0] }));
  }
  if (run.reportBefore && !run.reportSelectionShown) {
    const before = run.reportBefore, state = cli(root, 'resume', role);
    if (state.busy || state.action === 'blocked' || state.checkpoint?.request_id !== before.requestId || state.story !== before.story) return {};
    if (role === 'reviewer' && state.action !== 'review_choices') return {};
    if (role !== 'reviewer' && !cli(root, 'quality-status', before.requestId).pending.includes(role)) return {};
    const changed = Object.entries(draftFiles(root, state.story, role)).filter(([file, digest]) => before.files[file] !== digest);
    if (!changed.length) return {};
    if (changed.length !== 1) return remind('reportReminderSent', '바뀐 보고서 초안이 둘 이상이다. 제출할 보고서의 정확한 경로로 완료 툴(c2h_review_next / c2h_quality_next)을 호출한다.');
    const args = role === 'reviewer' ? { requestId: before.requestId, review: changed[0][0] } : { requestId: before.requestId, report: changed[0][0] };
    return outcome(role === 'reviewer' ? reviewNext(root, args) : qualityNext(root, args));
  }
  if (role === 'designer' && run.designerStory && !run.designSelectionShown && run.designBefore !== undefined) {
    const story = run.designerStory, design = cli(root, 'design-status', story);
    if (!design.direction && !run.directionSelectionShown) return remind('directionReminderSent', `디자인 방향 선택이 빠졌습니다. ${story} 스토리·기존 UI를 읽고 추천 방향 2~3개로 c2h_design_direction을 호출한다. 반환된 선택지는 AskUserQuestion으로 묻는다. 텍스트 질문이나 구현으로 대체하지 않는다.`);
    if (!design.ready || JSON.stringify(design.ready) === run.designBefore) {
      // A preview written in this run means the design is drafted; the completion step must not be skipped silently.
      const folder = path.dirname(storyFile(root, story));
      const drafted = fs.readdirSync(folder).some(name => /\.html?$/i.test(name) && fs.statSync(path.join(folder, name)).mtimeMs >= run.startedAt);
      if (!design.direction || !drafted) return {};
      return remind('designNextReminderSent', `디자인 완료 선택이 빠졌습니다. ${story}의 설계 문서와 HTML 미리보기를 확인하고 c2h_design_next(story, design, preview)를 호출한다. 텍스트 안내로 대체하지 않는다.`);
    }
    const result = designNext(root, { story }, { auto: true });
    if (result) return outcome(result);
    return remind('designMenuReminderSent', `${story} 설계가 끝났지만 자동 인계가 막혀 선택이 필요하다. c2h_design_next(story="${story}", design, preview)를 호출하고 반환된 선택지를 AskUserQuestion으로 묻는다.`);
  }
  return {};
}

// The planner has answered a designer's requirement question (story.md + planning checkpoint saved, feedback acked): the
// user's direction is carried to the new story revision and the designer continues without another selection.
function returnToDesigner(root, state, pending) {
  const returned = cli(root, 'feedback-return', pending.id);
  mark(root, 'planner', { feedbackPending: undefined });
  return done('design', `디자이너에게 자동 반환: ${returned.id ?? pending.id}. 같은 디자인 방향으로 진행한다.`);
}
