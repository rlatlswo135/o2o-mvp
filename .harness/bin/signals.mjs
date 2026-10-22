import { createHash } from 'node:crypto';

// Display state only. Sources: pane liveness, hook/extension live state, the latest recorded reply, workflow hints.
export const phases = { planning: '계획', implementing: '구현 중', implementation_done: '구현 완료', reviewing: '독립 검증', review_ready: '결과 준비', review_decision: '리뷰 반영', fixing: '수정 중', done: '완료', blocked: '진행 중단' };
export const actions = { plan: '계획·범위 확인', plan_next: '완료 정리', await_story: '다음 스토리 대기', implement: '승인 범위 구현', implementation_choices: '종합 검토 요청', review: '코드 검토', review_choices: '검토 결과', review_decision: '리뷰 반영', completion_choices: '재리뷰·완료', wait: '인계 대기', brief: '결과 브리핑', assist: '보조 요청', blocked: '상태 확인 필요', done: '완료', select_story: '작업 선택' };
export const BADGES = { stop: '멈춤 확인 필요', choice: '선택 필요', reply: '응답 확인 필요' };
const SLEEP = 300000;

// One alert per role. Priority: stopped > waiting for a choice > unread reply.
export function roleAlert(row, now = Date.now()) {
  const presence = row.presence, alert = (kind, since) => ({ kind, badge: BADGES[kind], since });
  if (!row.live) return alert('stop');
  if (row.hint === 'blocked') return alert('stop');
  if (presence?.state === 'failed') return alert('stop', presence.at);
  if (presence?.state === 'working' && row.quiet) return alert('stop', presence.at);
  if (presence?.state === 'native') return alert('choice', presence.at);
  // An automatic step needs no choice; a role resting there past the hand-off between turns has stalled.
  if (row.hint === 'auto' && row.stalled) return alert('stop');
  if (presence?.state === 'idle' && Number.isFinite(row.lastReply) && row.lastReply > (row.seen ?? 0)) return alert('reply', row.lastReply);
  return null;
}

export function roleStatus(row, now = Date.now()) {
  const presence = row.presence;
  if (!row.live) return 'CLI 없음';
  if (presence?.state === 'working') return presence.tool ? `작업 중 · ${presence.tool}` : '작업 중';
  if (presence?.state === 'native') return '선택 창 열림';
  if (presence?.state === 'failed') return '응답 오류';
  if (presence?.state === 'idle' && now - presence.at > SLEEP) return `휴식 · ${elapsed(presence.at, now)}`;
  return actions[row.state] ?? '대기';
}

// Character pose: decoration only, never evidence that a model is generating.
export function pose(row, alert, now = Date.now()) {
  const presence = row.presence;
  if (!row.live) return 'offline';
  if (presence?.state === 'failed') return 'error';
  if (presence?.state === 'working' && row.quiet) return 'quiet';
  if (alert) return 'alert';
  if (presence?.state === 'working') return 'working';
  if (presence?.state === 'idle' && now - presence.at > SLEEP) return 'sleeping';
  return 'idle';
}

const STAGE = { planning: '계획', implementing: '구현', implementation_done: '구현', fixing: '구현', reviewing: '리뷰', review_ready: '리뷰', review_decision: '리뷰' };
// waiting: the finished story's complete screen was closed, so the stages wait for the next story instead of showing it done.
export function pipeline({ story, phase, roles = [], designPending = false, qaPending = false, blocked = false, started = false, waiting = false }) {
  if (!story) return null;
  const names = ['계획', ...(roles.includes('designer') ? ['디자인'] : []), '구현', '리뷰', ...(roles.includes('qa') ? ['QA'] : [])];
  if (phase === 'done') return names.map(name => ({ name, state: waiting ? 'next' : 'done' }));
  let current = phase === 'blocked' ? (started ? '구현' : '계획') : STAGE[phase] ?? '계획';
  if (current === '계획' && designPending && names.includes('디자인')) current = '디자인';
  const index = names.indexOf(current);
  return names.map((name, at) => ({ name, state: at < index ? 'done' : at === index ? (blocked ? 'blocked' : 'current') : name === 'QA' && qaPending ? 'current' : 'next' }));
}

export function elapsed(since, now = Date.now()) {
  if (!Number.isFinite(since)) return '';
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return seconds < 60 ? `${seconds}초` : seconds < 3600 ? `${Math.floor(seconds / 60)}분` : seconds < 86400 ? `${Math.floor(seconds / 3600)}시간` : `${Math.floor(seconds / 86400)}일`;
}

// A working pane whose visible screen stays byte-identical is shown as uncertain (Escape interrupts fire no hook).
// Change detection only: the captured text is hashed, never parsed.
// How long each role has rested at the same automatic step, as seen by this console. A short rest is the gap
// between a finished turn and the next one (a background reply waking the executor); only a longer one is a stall.
export function stallTracker({ window = 60000, now = () => Date.now() } = {}) {
  const seen = new Map();
  return rows => {
    const stalled = {};
    for (const { role, key } of rows) {
      if (!key) { seen.delete(role); continue; }
      const time = now();
      if (seen.get(role)?.key !== key) seen.set(role, { key, since: time });
      stalled[role] = time - seen.get(role).since >= window;
    }
    return stalled;
  };
}

// Claude's input box in a screen captured with escapes: the ❯ line right under a rule. Dim text there is Claude's own
// suggestion; anything else is the user's unsent draft, which typing into the box would mangle.
const SGR = /\x1b\[[0-9;]*m/g;
export function promptEmpty(screen) {
  const lines = String(screen).split('\n'), plain = line => line.replace(SGR, '');
  for (let i = lines.length - 1; i > 0; i--) {
    if (!plain(lines[i]).startsWith('❯') || !/^─{8,}$/.test(plain(lines[i - 1]).trim())) continue;
    return !lines[i].replace(/\x1b\[2m[^\x1b]*/g, '').replace(SGR, '').replace(/^❯/, '').trim();
  }
  return false;
}

// A Claude turn that ended on an API error (StopFailure) leaves the role stopped, usually without its waiter: it hears
// nothing until someone types. After `delay` the console types the resume request for it, once per failure, only into an
// empty input box, and at most `limit` times before the role settles normally again (a lasting outage is not retried forever).
export const REVIVE_TEXT = '이어서 진행 (하네스 자동 재개: 응답 오류로 턴이 끊겼다)';
export function reviveTracker({ screen, type, delay = 20000, limit = 3, now = () => Date.now() }) {
  const tried = new Map();
  return rows => {
    const revived = [];
    for (const { role, agent, live, presence } of rows) {
      if (presence?.state === 'idle') tried.delete(role);
      if (agent !== 'claude' || !live || presence?.state !== 'failed' || now() - presence.at < delay) continue;
      const entry = tried.get(role) ?? { at: null, count: 0 };
      if (entry.at === presence.at || entry.count >= limit) continue;
      try { if (!promptEmpty(screen(role))) continue; type(role, REVIVE_TEXT); } catch { continue; }
      tried.set(role, { at: presence.at, count: entry.count + 1 });
      revived.push(role);
    }
    return revived;
  };
}

export function quietTracker({ capture, window = 30000, interval = 2000, now = () => Date.now() }) {
  const seen = new Map();
  return rows => {
    const quiet = {};
    for (const { role, working } of rows) {
      if (!working) { seen.delete(role); continue; }
      const entry = seen.get(role), time = now();
      if (!entry || time - entry.checked >= interval) {
        let digest;
        try { digest = createHash('sha256').update(capture(role)).digest('hex'); } catch { continue; }
        if (!entry || entry.digest !== digest) seen.set(role, { digest, since: time, checked: time });
        else entry.checked = time;
      }
      quiet[role] = time - seen.get(role).since >= window;
    }
    return quiet;
  };
}
