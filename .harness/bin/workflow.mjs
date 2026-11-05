import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
const TYPES = ['c2h_design_request', 'c2h_qa_request', 'c2h_plan_feedback', 'c2h_qa_ready', 'c2h_quality_request'];
const parsed = message => { try { return JSON.parse(message.message); } catch { return null; } };
const frozen = state => ['reviewing', 'review_ready', 'review_decision'].includes(state.phase);
const priority = { refactor_implement: 0, refactor_review: 0, refactor_decision: 0, refactor_cleanup: 0, quality: 1, review: 1, implement: 2, executor_step: 2, complete: 3, plan_feedback: 4, qa_feedback: 2, design_ready: 6, design: 6, qa_contract: 6, qa_notify: 6, refactor_discuss: 7, plan: 8, discussion: 7, blocked: 10 };

const ROLE_CODES = { planner: 'P', executor: 'E', reviewer: 'R', designer: 'D', qa: 'Q', refactor: 'F' };
function orderedRoles(roles) {
  if (!Array.isArray(roles) || roles.some(role => !Object.hasOwn(ROLE_CODES, role))) throw new Error('Unknown workflow role.');
  return Object.keys(ROLE_CODES).filter(role => roles.includes(role));
}
const roleCode = roles => orderedRoles(roles).map(role => ROLE_CODES[role]).join('');

/** Stage responsibility is derived from durable facts, never from layout, delivery receipts or a saved code. */
export function deriveWorkflow({ state = {}, quality = null, preparations = {}, requests = [], messages = [], feedback = [], returnedFeedback = [], reviewResponded = false } = {}) {
  const domain = state.task ? 'refactor' : 'story';
  let phase = state.error ? 'blocked' : state.task?.phase ?? state.phase ?? null;
  if (domain === 'story' && phase === 'review_ready') phase = 'reviewing';
  let participants = [], pending = [];
  if (state.task) {
    const owner = ({ proposed: 'refactor', approved: 'executor', executing: 'executor', fixing: 'executor', reviewing: 'reviewer', reviewed: 'executor', verified: 'executor', done: 'executor' })[phase];
    if (owner) participants = pending = [owner];
  } else if (['reviewing', 'review_ready'].includes(phase)) {
    participants = quality?.request.checks ?? quality?.checks ?? state.request?.checks ?? ['reviewer'];
    pending = quality ? quality.pending : reviewResponded ? [] : participants;
  } else if (['implementing', 'implementation_done', 'fixing', 'review_decision'].includes(phase)) {
    participants = pending = ['executor'];
  } else if (phase === 'done') {
    participants = ['planner'];
    pending = state.result && !state.compaction_pending ? [] : participants;
  } else if (phase === 'planning') {
    const story = state.story ?? state.checkpoint?.story, prep = preparations[story];
    const revision = prep?.revision ?? state.checkpoint?.story_hash;
    const current = [...requests, ...messages].filter(item => item.story === story && parsed(item)?.story_hash === revision);
    const design = prep?.design_requested || current.some(item => parsed(item)?.type === 'c2h_design_request');
    const qa = prep?.qa_requested || Boolean(prep?.qa) || current.some(item => parsed(item)?.type === 'c2h_qa_request');
    const notices = [...feedback, ...messages];
    const answering = notices.some(item => item.story === story && parsed(item)?.type === 'c2h_plan_feedback' && !returnedFeedback.includes(item.id));
    const notice = notices.some(item => item.story === story && item.pending && parsed(item)?.type === 'c2h_qa_ready');
    participants = ['planner', ...(design ? ['designer'] : []), ...(qa ? ['qa'] : [])];
    pending = [...(answering || notice || !design && !(qa && !prep?.qa) ? ['planner'] : []), ...(design && !answering ? ['designer'] : []), ...(qa && !prep?.qa ? ['qa'] : [])];
  }
  participants = orderedRoles(participants); pending = orderedRoles(pending);
  if (pending.some(role => !participants.includes(role))) throw new Error('Pending roles must belong to stage participants.');
  return { domain, phase, participants, pending, code: `${domain === 'refactor' ? 'refactor/' : ''}${phase ?? (state.busy ? 'busy' : 'idle')}-${roleCode(participants) || 'NONE'}` };
}
export function workflowLabel(workflow) {
  return workflow ? `${workflow.code} · 대기 ${roleCode(workflow.pending) || '없음'}` : null;
}

/** One deterministic decision surface for native delivery, resume and the board. No I/O or delivery history. */
export function deriveWork(facts = {}) {
  const { role, state = {}, selected = [], messages = [], preparations = {}, quality = null, returnedFeedback = [], feedback = [], feedbackApplied = [], drafts = [] } = facts;
  const workflow = deriveWorkflow(facts), phase = workflow.phase;
  if (state.busy || !['planner', 'executor', 'reviewer', 'designer', 'qa', 'refactor'].includes(role)) return [];
  const work = [], current = state.story ?? state.checkpoint?.story;
  const add = (kind, fields = {}) => {
    const story = Object.hasOwn(fields, 'story') ? fields.story : current ?? null;
    const revision = Object.hasOwn(fields, 'revision') ? fields.revision : state.checkpoint?.story_hash;
    const baseline = Object.hasOwn(fields, 'baseline') ? fields.baseline : state.request?.baseline;
    const id = fields.id ?? state.task?.delivery_id ?? state.task?.id ?? state.checkpoint?.approval?.response_id ?? state.checkpoint?.approval?.message_id ?? state.message?.id ?? `work-${digest([role, kind, story, revision])}`;
    const stage = fields.stage ?? kind;
    const key = `${role}:${kind}:${digest([id, story, revision, baseline, stage])}`;
    const item = { key, id, role, kind, story, stage, ...(revision ? { revision } : {}), ...(baseline ? { baseline } : {}), status: 'ready', ...fields, key, id, stage };
    if (!selected.includes(role) && item.status === 'ready') Object.assign(item, { status: 'blocked', reason: `Required role ${role} is not selected; the accepted work was not omitted.` });
    if (drafts.length && ['review', 'quality', 'complete', 'refactor_review'].includes(kind)) item.drafts = [...drafts];
    work.push(item);
    return item;
  };
  if (state.error || state.action === 'blocked' || state.phase === 'blocked') {
    add('blocked', { status: 'blocked', reason: state.error ?? state.reason ?? state.checkpoint?.note ?? 'Workflow is blocked.' });
    return work;
  }
  const sealed = phase === 'done' && Boolean(state.result) && !state.compaction_pending;
  const prep = preparations[current];
  const planning = phase === 'planning' && !state.checkpoint?.approval;
  const mutable = planning && !sealed;

  if (state.task) {
    if (workflow.pending.includes(role) && ['refactor_implement', 'refactor_review', 'refactor_decision', 'refactor_discuss', 'refactor_cleanup'].includes(state.action))
      add(state.action, { story: null, request_id: state.task.id, revision: state.task.proposal_hash, baseline: state.task.verified_baseline ?? state.task.baseline, stage: `${state.task.phase}:${state.task.delivery_id ?? ''}`, requires_user: state.action === 'refactor_discuss' });
  } else if (role === 'executor') {
    if (state.reverification_required) add('blocked', { status: 'blocked', reason: 'Source changed after verification; reverify the approved change before review or completion.' });
    else if (state.action === 'implement') add('implement', { stage: state.checkpoint?.approval?.kind ?? 'implement' });
    else if (state.auto) add('executor_step', { stage: state.action === 'brief' ? 'brief' : state.auto, request_id: state.request?.id });
    else if (state.auto_stopped) add('executor_step', { status: 'waiting_user', requires_user: true, stage: 'decision', reason: state.auto_stopped });
    if (quality && !workflow.pending.length && !quality.response) add('executor_step', { id: quality.request.id, request_id: quality.request.id, stage: 'aggregate', baseline: quality.request.baseline });
  }

  if (!state.task && role === 'planner' && phase === 'done' && (!state.result || state.compaction_pending))
    add('complete', { id: state.checkpoint?.completion?.message_id ?? state.message?.id, stage: state.result ? 'cleanup' : 'summary' });

  if (!state.task && ['reviewer', 'designer', 'qa', 'refactor'].includes(role) && quality && workflow.participants.includes(role) && workflow.pending.includes(role)) {
    const id = quality.request.check_requests[role], message = messages.find(item => item.id === id);
    const body = parsed(message ?? {});
    const valid = message?.story === quality.request.story && (role === 'reviewer' ? message.kind === 'review_request' && message.id === quality.request.id
      : message.sender === 'executor' && body?.type === 'c2h_quality_request' && body.request_id === quality.request.id && body.role === role && body.baseline === quality.request.baseline);
    add('quality', { id, story: quality.request.story, request_id: quality.request.id, baseline: quality.request.baseline, message,
      ...(!valid ? { status: 'blocked', reason: 'Quality work lacks its exact correlated participant request.' } : {}) });
  } else if (!state.task && role === 'reviewer' && workflow.pending.includes(role) && state.request && !state.request.checks && ['review', 'review_choices'].includes(state.action)) {
    add('review', { id: state.request.id, request_id: state.request.id });
  }

  // Receipt-only notices remain actionable after approval; otherwise their pending envelope can prevent the result seal.
  if (role === 'planner') for (const message of messages.filter(item => item.pending && item.story === current && parsed(item)?.type === 'c2h_qa_ready')) {
    const body = parsed(message), verification = prep?.qa ?? state.checkpoint?.verification;
    const valid = verification?.hash === body.hash && (prep?.revision ?? state.checkpoint?.story_hash) === body.story_hash;
    add('qa_feedback', { id: message.id, message, revision: body.story_hash, stage: valid ? 'current' : 'outdated', stale: !valid });
  }
  if (role === 'planner' && mutable) {
    for (const message of messages.filter(item => item.story === current && parsed(item)?.type === 'c2h_plan_feedback' && !returnedFeedback.includes(item.id))) {
      const returning = !message.pending && feedbackApplied.includes(message.id);
      add('plan_feedback', { id: message.id, message, stage: returning ? 'return' : 'answer' });
    }
    if (!work.some(item => ['plan_feedback', 'qa_feedback'].includes(item.kind)))
      add('plan', { revision: prep?.revision ?? state.checkpoint?.story_hash, stage: `approval:${digest([state.checkpoint?.updated, prep?.qa?.hash, prep?.design?.ready])}`, requires_user: true,
        ...(prep?.design_requested ? { status: 'waiting_dependency', reason: 'Designer owns the requested revision until requirement feedback or approved handoff.' }
          : prep?.qa_requested && !prep.qa ? { status: 'waiting_dependency', reason: 'QA preparation is unfinished; receiving its request did not complete the contract.' } : {}) });
  }

  for (const [owner, type, kind] of [['designer', 'c2h_design_request', 'design'], ['qa', 'c2h_qa_request', 'qa_contract']]) {
    if (role !== owner || sealed) continue;
    const requests = messages.filter(item => parsed(item)?.type === type).sort((a, b) => b.id.localeCompare(a.id));
    const seen = new Set();
    for (const message of requests) {
      const body = parsed(message), scope = `${message.story}:${body.story_hash}`;
      if (seen.has(scope)) continue;
      seen.add(scope);
      if (state.checkpoint?.approval && message.story === current && body.story_hash === state.checkpoint.story_hash) continue;
      if (!mutable || message.story !== current || body.story_hash !== prep?.revision) {
        if (message.pending || message.story === current && mutable) add(kind, { id: message.id, story: message.story, revision: body.story_hash, message, status: 'waiting_dependency', reason: 'Request scope is no longer the active unapproved revision; planner must confirm the current scope.' });
        continue;
      }
      if (owner === 'qa' && prep.qa) {
        if (!feedback.some(item => item.story === current && parsed(item)?.type === 'c2h_qa_ready' && parsed(item).hash === prep.qa.hash))
          add('qa_notify', { id: message.id, message, revision: prep.revision });
        continue;
      }
      const ready = owner === 'designer' ? prep.design?.ready : null;
      if (ready && (ready.request_id ? ready.request_id !== message.id : body.keep_direction && ready.needs_planning)) {
        add('design', { id: message.id, message, revision: body.story_hash, stage: 'returned_feedback', requires_user: false });
        continue;
      }
      if (ready) {
        const sent = ready.needs_planning && feedback.some(item => item.story === current && parsed(item)?.type === 'c2h_plan_feedback' && parsed(item).story_hash === body.story_hash && parsed(item).design?.hash === ready.design.hash);
        const qaRequired = selected.includes('qa') || Boolean(prep.qa);
        add('design_ready', { id: message.id, message, stage: digest(ready), revision: prep.revision,
          ...(sent ? { status: 'waiting_dependency', reason: 'Designer requirement feedback awaits planner return.' }
            : !ready.needs_planning && qaRequired && (!selected.includes('qa') || !prep.qa?.browser) ? { status: 'waiting_dependency', reason: 'Selected QA needs a pinned required browser criterion before design handoff.' } : {}) });
      } else add(kind, { id: message.id, message, revision: body.story_hash, requires_user: owner === 'designer' && !prep.design?.direction || owner === 'qa' && !prep.qa_interview });
    }
  }

  for (const message of messages.filter(item => item.pending && item.kind === 'message')) {
    const body = parsed(message), type = body?.type;
    if (typeof type === 'string' && type.startsWith('c2h_')) {
      if (!TYPES.includes(type)) add('blocked', { id: message.id, story: message.story, message, status: 'blocked', reason: `Unknown workflow request ${type}; it is not permission to execute.` });
      continue;
    }
    add('discussion', { id: message.id, story: message.story, revision: undefined, baseline: undefined, message,
      ...(frozen(state) || state.task || role === 'executor' && ['implementing', 'fixing', 'implementation_done'].includes(state.phase) ? { status: 'waiting_dependency', reason: 'Finish frozen/source work before handling unrelated discussion.' } : {}) });
  }
  const unique = [...new Map(work.map(item => [item.key, item])).values()];
  return unique.sort((a, b) => (priority[a.kind] ?? 99) - (priority[b.kind] ?? 99) || a.key.localeCompare(b.key));
}

/** Both native adapters receive exactly this semantic briefing; UI/transport never grants approval. */
export function workPrompt(work, state = {}) {
  const cli = 'node .harness/bin/c2h.mjs';
  const story = work.story, request = work.request_id ?? state.request?.id;
  const instructions = {
    plan: `.harness/FLOW.md '계획'. 저장된 story.md 범위를 보강하고 Pi planner는 c2h_plan_review 검토·대응 후 c2h_plan_next(story="${story}")로 사용자 선택을 연다. Claude planner는 기존 계획 선택을 따른다. 이미 저장된 범위를 다시 만들지 않는다.`,
    plan_feedback: `디자인 → 요구사항 재검토. .harness/FLOW.md '디자인 ↔ 플래너 왕복'. 요청 ${work.id}의 사용자 요구와 현재 story.md를 읽는다. ${work.stage === 'return' ? '계획 저장과 요청 수신은 이미 기록됐다. 같은 내용을 다시 수정하지 않는다.' : `필요한 계획을 반영해 checkpoint ${story} planning --note '디자인 피드백 반영'을 저장하고 ack planner ${work.id}로 수신한다.`} Pi planner는 현재 계획을 c2h_plan_review로 검토·대응한 다음 ${cli} feedback-return ${work.id}로 같은 방향을 디자이너에게 되돌린다. c2h_plan_next나 방향 재선택은 하지 않는다.`,
    qa_feedback: `QA 검증 계약 준비 알림: qa-status ${story}와 사용자 가치 답변을 읽는다. ${work.stale ? '이 알림은 이전 revision이다. 현재 준비 완료·PASS로 사용하지 않고 오래된 알림임을 설명한다.' : '현재 계약의 준비 내용을 설명한다.'} ack planner ${work.id}. 준비는 구현 승인이 아니다. ${state.phase === 'planning' ? '현재 의무를 재확인한 뒤 c2h_plan_next에서 사용자 선택을 받는다.' : '이미 계획 이후 단계다. 알림만 수신하고 기존 승인·스토리·검토를 바꾸거나 계획 선택창을 다시 열지 않는다.'}`,

    design: `.harness/FLOW.md '디자인'. 요청 ${work.id}와 현재 story.md를 읽고 ack designer ${work.id}로 수신한다. ack는 완료가 아니다. design-status의 고른 방향을 재사용한다. 방향이 없을 때만 c2h_design_direction으로 2–3개 방향 중 사용자 선택을 받는다. design.md와 preview.html 한 벌을 이어서 작성하고 c2h_design_next(story,design,preview,needsPlanning)로 인계한다. keep_direction 요청은 방향을 다시 묻지 않고 기존 design.md와 preview.html을 그 자리에서 갱신한다.`,
    design_ready: `설계는 이미 저장됐다. design-status ${story}의 기존 design.md·preview.html을 읽고 c2h_design_next(story,design,preview,needsPlanning)로 남은 인계만 수행한다. 방향·설계를 다시 만들지 않는다.`,
    qa_contract: `.harness/FLOW.md 'QA 검증 계약'. 요청 ${work.id}를 읽고 ack qa ${work.id}로 수신한다. 기존 qa-values.json 답변을 재사용하고 미응답만 c2h_qa_interview로 사용자에게 묻는다. test 기준은 독립 acceptance가 필요하다. browser criterion은 별도 acceptance 파일 없이 tests:[] 허용하며 독립 URL·viewport·snapshot·network 증거 기준을 정한다. 현재 qa-contract.json을 이어서 준비하고 c2h_qa_ready로 고정한다. QA 실행은 verification-workspace 복사본에서만 build/start하며 허용된 비운영 데이터를 쓴다. 제품 소스·운영 데이터 변경 금지.`,
    qa_notify: `qa-status ${story}의 기존 QA 계약이 준비됐다. ${cli} reconcile qa로 planner 알림만 복구한다. 계약이나 테스트를 다시 만들지 않는다.`,
    implement: `.harness/FLOW.md '구현과 자동 구간'. resume executor의 승인 범위·기존 implementation.md·변경 파일부터 확인한다. 이미 한 소스 수정을 되돌리거나 반복하지 않는다. 남은 구현·계획된 검증을 수행하고 checkpoint ${story} implementation_done으로 기록한다. 미수신 implementation_request만 ack한다.`,
    executor_step: executorInstruction(work, state, cli),
    quality: qualityInstruction(work, state, cli),
    review: qualityInstruction(work, state, cli),
    complete: work.stage === 'cleanup' ? `${cli} reconcile planner로 이미 봉인된 결과의 파일 정리만 복구한다. 지워진 원본은 재생성하지 않는다.` : `완료 기록 도착. .harness/FLOW.md '완료 정리'. story.md·implementation.md를 읽고 기존 records/result-draft.md를 먼저 확인한다. 이 작업에서 한 일만 정리해 c2h_story_next(story="${story}",summary=".harness/stories/${story}/records/result-draft.md")로 result.md를 확정한다. 다음 스토리는 임의로 만들지 않는다.`,
    discussion: `inbox ${work.role}에서 요청 ${work.id}의 데이터를 읽고 논의·보고한다. 완료 스토리의 메시지도 별도 후속 논의로 처리한다. 소스 수정·새 스토리 활성화·구현 승인으로 해석하지 않는다. 수신 ack 뒤에도 논의 의무는 남는다. 응답을 전달한 뒤 ${cli} work-done ${work.role} ${work.key}로 논의만 종료한다.`,
    refactor_discuss: `독립 수정안 ${state.task?.proposal}를 사용자와 논의하고 c2h_refactor_next(taskId="${state.task?.id}")로 정확한 수정안의 선택을 받는다. 완료 스토리 story.md를 요구하지 않는다.`,
    refactor_implement: `독립 리팩터링 ${state.task?.id}. ${state.task?.proposal}와 기존 implementation.md를 읽는다. ${state.task?.phase === 'fixing' ? `리뷰 반영 중(${state.task.fix_note}). refactor-fix가 이미 기록됐다. 해당 지적만 수정하고 '## 리뷰와 반영'에 판단·근거를 기록한다. refactor-start는 다시 호출하지 않는다.` : state.source_changed ? '이미 소스가 바뀌었다. 되돌리거나 처음부터 재실행하지 말고 남은 수정·검증만 한다.' : `수정 전 ${cli} refactor-start ${state.task?.id}를 호출한다.`} 같은 수정 전·후 검증을 수행해 '## 수정 전 검증'·'## 수정 후 검증'에 실제 증거를 남기고 refactor-finish --summary 경로로 마친다. 미실행은 PASS가 아니다.`,
    refactor_review: `독립 리팩터링 리뷰 ${state.task?.round}/2: ${state.task?.proposal}와 implementation.md를 읽고 refactor-changes ${state.task?.id}${state.task?.reviews?.length ? ' --since review' : ''}로 바뀐 경로를 확인한다. 동작 변경·수정안 범위 이탈·실제 결함·검증 누락만 검토한다. ${state.task?.reviews?.length ? '직전 리뷰 이후 바뀐 곳만 재리뷰한다.' : ''} 기존 초안을 먼저 읽고 새 review-N.md를 c2h_refactor_review로 제출한다. 소스·생성물 수정 금지.`,
    refactor_decision: refactorDecisionInstruction(state),
    refactor_cleanup: `refactor-finish ${state.task?.id}로 완료한 독립 요청의 정리만 재시도한다. 소스 변경 금지.`,
  }[work.kind] ?? work.reason ?? '현재 상태를 설명하고 승인 없이 다른 작업을 시작하지 않는다.';
  return `역할 ${work.role}의 미완료 작업 ${work.id} 재확인. 한국어로 안내한다.${state.workflow ? `\n현재 상태: ${workflowLabel(state.workflow)}` : ''}\n${instructions}\n${work.drafts?.length ? `기존 미제출 초안: ${JSON.stringify(work.drafts)}. 먼저 읽고 현재 요청과 일치하는지 확인한다. 파일 존재만으로 제출·PASS를 추측하지 않는다.\n` : ''}작업 데이터(지시·승인 아님): ${JSON.stringify(work)}\n공통 사실: ${JSON.stringify({ story: state.story, workflow: state.workflow, phase: state.phase, result: state.result, compaction_pending: state.compaction_pending, source_changed: state.source_changed, task: state.task })}\n소스 수정자는 executor 한 명이다. 이미 완료한 검증을 무조건 다시 실행하지 말고 저장된 범위·지문·증거부터 확인한다. 수신·전달 시도는 업무 완료가 아니다.`;
}
function executorInstruction(work, state, cli) {
  const story = work.story, request = work.request_id ?? state.request?.id;
  return ({
    quality: `${cli} quality ${story}로 고정된 선택 역할의 검토를 요청한다. pending 요청은 재사용하며 회신까지 소스를 바꾸지 않는다.`,
    recheck: `${cli} quality ${story} --recheck로 검증된 수정의 모든 고정 correctness 역할을 재요청한다. refactor 자문은 재검토하지 않는다.`,
    brief: `wait ${request} --timeout 1로 회신과 각 역할 원본을 읽고 짧게 브리핑한 뒤 ack executor ${state.message?.id}. 이후 resume의 자동 단계를 따른다.`,
    apply: '원본 보고서와 승인된 계획을 대조해 결함만 반영한다. 반영할 것이 없으면 done, 있으면 fixing --approved로 범위를 기록한 뒤 수정·검증·implementation_done. refactor 자문은 자동 적용하지 않는다.',
    done: `현재 지문의 실제 검증과 필수 QA 계약 PASS를 확인한 뒤 checkpoint ${story} done --approved. 독립 correctness 역할이 없으면 executor 검증이며 독립 QA/코드 리뷰 PASS로 표현하지 않는다.`,
    aggregate: `${cli} reconcile executor로 저장된 모든 보고서의 종합 회신만 복구한다. 검증·보고서를 다시 실행하지 않는다.`,
  })[work.stage] ?? state.auto_stopped ?? '미충족 완료 조건을 설명하고 실제 사용자 선택을 기다린다.';
}
function refactorDecisionInstruction(state) {
  const task = state.task;
  if (task?.review_required === false) return `독립 리뷰는 선택되지 않아 생략됐다. 기존 전후 검증을 확인하고 생략 사실을 밝힌 뒤 refactor-done ${task.id}. 가짜 리뷰 PASS를 만들지 않는다.`;
  return `리뷰 ${task?.reviews?.at(-1)?.report}와 수정안 ${task?.proposal}를 대조한다. 반영할 지적이 없으면 refactor-done ${task?.id}. ${state.reviews_left > 0
    ? `있으면 수정 전에 refactor-fix ${task?.id} --note '반영: 지적 ID·근거'로 범위를 기록한 뒤 수정·같은 검증·refactor-finish.`
    : `한도에 닿았다. 남은 지적은 실제 선택 UI(Claude AskUserQuestion / Pi 선택창)로 '그대로 종료' / '종료 후 새 수정안으로 논의'를 묻는다. 어느 쪽이든 refactor-done ${task?.id}으로 종료하며 추가 수정은 새 수정안·승인 뒤에만 한다.`}`;
}
function qualityInstruction(work, state, cli) {
  const request = work.request_id ?? state.request?.id, role = work.role;
  if (role === 'refactor') return `종합 검토의 구조 자문. quality-status ${request}와 .harness/refactor-prompt.md를 읽고 같은 동결 버전의 story·implementation·관련 소스를 검토한다. 실제 Before → 제안 After(미검증)·이익·위험·검증 방법을 연결하고 실제 지적에만 F1 같은 안정적 ID를 붙인다. 지적이 없으면 예시를 만들지 않는다. 소스·빌드 산출물 수정·제품 테스트/빌드/설치·별도 모델 worker 실행 금지. records/refactor-N.md에 저장하고 c2h_quality_next(requestId="${request}",report="경로")로 명시 제출한다. 자문은 자동 적용하지 않는다. 정확성 PASS가 아니다. 요청 사전 ack 금지.`;
  return `.harness/FLOW.md '${role === 'refactor' ? '구조 개선 검토' : '종합 검토'}'. 요청 ${request}와 정확한 동결 버전을 확인한다. ${state.request?.recheck_of ? '수정 재검토: changes STORY --since review로 바뀐 부분을 우선 본다.' : ''} 승인된 story·design·implementation과 기존 증거·미제출 초안부터 읽는다. QA 역할이고 계약이 있으면 verification-workspace 복사본만 사용하며 고정 기준·지문·기록된 결과를 대조한다. test 기준은 독립 테스트, browser 기준은 실제 브라우저/E2E와 URL·화면 크기·네트워크/화면 증거가 필요하다. 이미 기록된 결과를 현재 버전 PASS로 추측하거나 미실행을 PASS로 만들지 않는다. 계약 없는 QA는 일반 보고서다. designer는 시각 일치만, refactor는 .harness/refactor-prompt.md 사용자 관점을 읽고 구조 자문만 한다. 보고서는 .harness/stories/${work.story}/records/${role === 'reviewer' ? 'review' : role === 'designer' ? 'design-review' : role}-N.md(실제 다음 번호)에 쓴다. ${role === 'reviewer' ? `checkpoint ${work.story} review_ready --note '리뷰 초안 저장' 후 c2h_review_next(requestId="${request}",review="경로")` : `c2h_quality_next(requestId="${request}",report="경로")`}로 명시 제출한다. ${cli} resume ${role}로 현재 의무를 다시 확인한다. 소스 수정·요청 사전 ack 금지.`;
}
