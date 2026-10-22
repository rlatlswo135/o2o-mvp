// Story-complete card: what the story did first (result.md), then the show — crew, voyage, checks and a WANTED poster for
// the story's MVP. Only data the harness records is shown. After CALM it settles into a quiet loop until Enter closes it.
// Two layouts: 'tall' (islands and sea, poster under the title) and 'compact' (about 26 rows).
import { columns, fit } from './terminal.mjs';
import { MVP, portrait } from './wanted.mjs';
import { BG, ROLE_COLOR, GOLD, mix, hsl, hash, grid, put, px, tput, blit, segments, cheer, castName, catchphrase, pxText, pxWidth } from './sprites.mjs';

export const SCENE_WIDTH = 76;
const W = SCENE_WIDTH, FGT = '#E6E1E8', DIM = '#8A8A94', LINE = '#5C5C66', OK = '#6EE7A0', OK_BG = '#1F9D55';
const clamp01 = p => Math.min(1, Math.max(0, p));
const easeOut = p => 1 - (1 - clamp01(p)) ** 3;
const strW = s => [...s].reduce((n, c) => n + columns(c), 0);
const centerX = (s, x0, w) => x0 + Math.floor((w - strW(s)) / 2);
const fade = (c, p) => mix(BG, c, clamp01(p));
const clip = (s, w) => strW(s) > w ? fit(s, w - 1) + '…' : s;
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

// After CALM the show turns into a quiet idle loop: waves, gulls, the poster's move, a hop or a line now and then and a
// rare firework. The frame stops cycling, since its edge is on every row and would make the board rewrite all of them.
const CALM = 7.0;
const ORDER = ['planner', 'designer', 'executor', 'reviewer', 'qa'];
const STAGE = { planner: '계획', designer: '디자인', executor: '구현', reviewer: '리뷰', qa: 'QA' };
export const crewOf = roles => ORDER.filter(role => roles.includes(role));
// The MVP is a fixed pick per story, so a console restart shows the same poster.
export const mvpOf = (story, crew) => crew[Math.floor(hash([...String(story)].reduce((sum, c) => sum * 31 + c.codePointAt(0) | 0, 7)) * crew.length)];

// ---------- shared drawing ----------
const DOUBLE = { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' }, ROUND = { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯' };
function box(G, x, y, w, h, line, colorAt, reveal = 1) {
  const per = 2 * (w + h) - 4, cell = (cx, cy, ch, at) => { if (at <= reveal * per) put(G, cx, cy, ch, colorAt(at, per)); };
  for (let k = 0; k < w; k++) cell(x + k, y, k === 0 ? line.tl : k === w - 1 ? line.tr : line.h, k);
  for (let r = 1; r < h - 1; r++) { cell(x + w - 1, y + r, line.v, w - 1 + r); cell(x, y + r, line.v, per - r); }
  for (let k = 0; k < w; k++) cell(x + k, y + h - 1, k === 0 ? line.bl : k === w - 1 ? line.br : line.h, w - 1 + h - 1 + (w - 1 - k));
}
// Bursts stop launching at 5.6s, so the sky is clear by the time the card settles; idle ones come every 2.6s after.
function fireworks(G, tau, area) {
  shells(G, tau, area, 0, 0.7, 5.6, 0);
  shells(G, tau, area, CALM + 1, 2.6, Infinity, 101);
}
function shells(G, tau, area, from, every, until, seed) {
  const burst = Math.floor((tau - from) / every);
  for (let n = burst - 2; n <= burst + 1; n++) {
    const a = tau - from - n * every, j = n + seed; if (n < 0 || n * every > until || a > 1.4 || a < -0.35) continue;
    const cx = area.x + hash(j * 3 + 1) * area.w, cy = area.y + hash(j * 5 + 2) * area.h, ink = hsl(hash(j * 9) * 360, 90, 66);
    if (a < 0) { const p = 1 + a / 0.35; for (let k = 0; k < 3; k++) px(G, cx, cy + (1 - p) * 16 + k * 1.5, mix('#FFF1A8', BG, k / 3)); continue; }
    for (let k = 0; k < 16; k++) {
      if (a > 0.9 && hash(k * 7 + Math.floor(tau * 20)) > 0.55) continue;
      const angle = Math.PI * 2 * k / 16, r = a * area.r * (1 - a * 0.25);
      px(G, cx + Math.cos(angle) * r * 1.4, cy + Math.sin(angle) * r + a * a * 5, mix(ink, BG, a / 1.4));
      if (a < 0.5) px(G, cx + Math.cos(angle) * r * 0.7, cy + Math.sin(angle) * r * 0.5 + a * a * 5, mix('#FFFFFF', ink, a * 2));
    }
  }
}
const CONFETTI = ['#FF5FA2', GOLD, '#87D7FF', '#AFD787', '#AF87FF', '#FFAF5F'];
function confetti(G, tau, rows, n) {
  for (let k = 0; k < n; k++) {
    const speed = 5 + hash(k * 11) * 9, hy = 2 + ((hash(k * 13) * 96 + tau * speed) % ((rows - 2) * 2)), ink = CONFETTI[k % 6];
    px(G, 1 + hash(k * 7 + 3) * (G.w - 2) + Math.sin(tau * 3 + k) * 1.2, hy, Math.floor(tau * 8 + k) % 2 ? ink : mix(ink, '#000000', 0.35));
  }
}
const titleDrop = tau => at => {
  const t0 = 0.25 + at * 0.06; if (tau < t0) return null;
  const p = Math.min(1, (tau - t0) / 0.4), land = tau - t0 - 0.4;
  return Math.round(-14 * (1 - p) * (1 - p) - (land > 0 ? Math.abs(Math.sin(land * 10)) * 2 * Math.exp(-land * 6) : 0));
};
function title(G, P, area) {
  const { tau } = P;
  G.clip = area.sky; fireworks(G, tau, area.fireworks);
  if (tau < CALM) confetti(G, tau, area.sky[3] >> 1, Math.round(40 * (1 - clamp01((tau - 5) / 2))));
  G.clip = null;
  if (tau < 1.6) { G.clip = [1, 2, W - 2, (G.h - 1) * 2 - 1]; confetti(G, tau * 1.6, G.h, 60); G.clip = null; }
  const text = 'STORY COMPLETE', left = Math.floor((W - pxWidth(text)) / 2);
  pxText(G, text, left, 2, at => hsl(at * 24 + tau * 160, 90, 66), { shadow: '#3A1530', dy: titleDrop(tau) });
  if (tau > 0.9) {
    const full = `✦ ${clip(P.label, area.sub.w - 6)} ✦`, shown = [...full].slice(0, Math.floor((tau - 0.9) * 40)).join('');
    put(G, centerX(full, area.sub.x, area.sub.w), area.sub.y, shown, FGT, null, true);
  }
}

// Crew cheering. In the tall layout the MVP stands with them under a crown; compact leaves the MVP to the poster.
const CROWN = ['#..#..#', '##.#.##', '#######', '#######'];
function crew(G, P, { members, x0, w, slotMax, hy, shadow, names, said, stage, hopPx, crown }) {
  const { tau } = P, n = members.length;
  if (!n) return;
  const slot = Math.min(slotMax, Math.floor(w / n)), start = x0 + Math.floor((w - slot * n) / 2);
  // idle: one hop every few seconds per member and a catchphrase every 3.2s, instead of the nonstop cheer
  const calm = tau >= CALM, idle = (tau - CALM) % 3.2;
  const speaker = !calm ? (tau > 1.1 ? Math.floor((tau - 1.1) / 1.6) % n : -1) : idle < 2 ? Math.floor((tau - CALM) / 3.2) % n : -1;
  G.clip = [x0, 2, x0 + w - 1, names * 2 - 1];
  members.forEach((role, at) => {
    const period = calm ? 4.0 : 1.6, k = (((tau - at * (calm ? 0.8 : 0.15)) % period) + period) % period / period, jump = calm ? 0.12 : 0.3;
    const hop = tau > 0.5 && k < jump ? -Math.round(Math.sin(k / jump * Math.PI) * hopPx) : 0, alt = Math.floor(tau * (calm ? 1.2 : 5) + at) % 2;
    const arms = tau < 0.5 ? ['down', 'down'] : at === speaker ? ['up', 'up'] : alt ? ['up', 'wave'] : ['wave', 'up'];
    const x = start + at * slot + Math.floor(slot / 2) - 9;
    for (let c = 0; c < 8 + hop; c++) px(G, x + 5 - hop / 2 + c, shadow, '#2A2230');
    blit(G, cheer(role, { arms, tau }), x, hy + hop);
    if (crown && role === P.mvp && tau > 6.0) {
      const drop = Math.max(0, Math.round((1 - easeOut((tau - 6.0) / 0.35)) * -6)), cy = hy - 2 + hop + drop, glow = Math.floor(tau * (calm ? 1 : 4)) % 2;
      CROWN.forEach((r, y) => [...r].forEach((c, cx) => { if (c === '#') px(G, x + 6 + cx, cy + y, y === 2 && cx === 3 ? '#E53935' : glow && y === 0 ? '#FFF1A8' : GOLD); }));
    }
  });
  G.clip = null;
  members.forEach((role, at) => {
    const p = easeOut((tau - 1.3 - at * 0.12) / 0.4), name = castName(role) ?? role;
    if (p <= 0) return;
    put(G, centerX(name, start + at * slot, slot), names, name, fade(ROLE_COLOR[role], p), null, true);
    if (stage != null) put(G, centerX(STAGE[role], start + at * slot, slot), stage, STAGE[role], fade(DIM, p));
  });
  const line = speaker >= 0 ? catchphrase(members[speaker]) : null;
  if (line) {
    const text = ` “${line}” `, center = start + speaker * slot + Math.floor(slot / 2);
    put(G, Math.max(x0, Math.min(x0 + w - strW(text), center - Math.floor(strW(text) / 2))), said, text, '#FFFFFF', mix(ROLE_COLOR[members[speaker]], '#000000', 0.55), true);
  }
}

// Bounties are character lore, not scores; the poster's last line names the work instead.
const PARCH = '#E6CF9C', INK = '#4A2C14', POSTER_W = 26, POSTER_ROWS = 15;
function poster(G, P, at) {
  const { tau } = P, art = MVP[P.mvp], t0 = 3.0, x0 = at.x, w = POSTER_W, rows = POSTER_ROWS, reveal = Math.floor(easeOut((tau - t0) / 0.8) * rows);
  if (!art || reveal <= 0) return;
  const stampAt = 5.8, shake = tau > stampAt && tau < stampAt + 0.18 ? (Math.floor(tau * 50) % 2 ? 1 : -1) : 0, X = x0 + shake;
  const top = at.y * 2, last = (at.y + rows) * 2 - 1, bottom = (at.y + reveal) * 2 - 1;
  for (let hy = top; hy <= bottom; hy++) for (let x = 0; x < w; x++) {
    const rim = x === 0 || x === w - 1 || hy === top || hy === last, corner = (x < 2 || x > w - 3) && (hy < top + 2 || hy > last - 2);
    px(G, X + x, hy, rim ? '#A8834F' : corner ? '#CDAE72' : mix('#EAD5A4', '#DCC189', hash(x * 31 + hy * 17) * 0.8));
  }
  if (reveal < rows) for (let x = 0; x < w; x++) { px(G, X + x, bottom, '#8F6A3A'); px(G, X + x, bottom - 1, '#C9A66B'); }
  const row = r => at.y + r, on = r => r < reveal - (reveal < rows ? 1 : 0);
  if (on(1)) put(G, centerX('W A N T E D', X, w), row(1), 'W A N T E D', INK, PARCH, true);
  const frame = { x: X + 2, y: row(2) * 2, w: 22, h: 18 };
  if (on(10)) {
    for (let hy = frame.y; hy < frame.y + frame.h; hy++) for (let x = 0; x < frame.w; x++) {
      const edge = x === 0 || x === frame.w - 1 || hy === frame.y || hy === frame.y + frame.h - 1;
      px(G, frame.x + x, hy, edge ? '#8F6A3A' : art.bg(x - 1, hy - frame.y - 1, tau));
    }
    G.clip = [frame.x + 1, frame.y + 1, frame.x + frame.w - 2, frame.y + frame.h - 2];
    blit(G, portrait(P.mvp, tau), frame.x + 1, frame.y + 1);
    G.clip = null;
  }
  if (reveal >= rows) { G.clip = [x0, top, x0 + w - 1, last]; art.over((x, hy, c) => px(G, x, hy, c), frame, tau); G.clip = null; }
  // coins fly behind the poster's lines, so the name and bounty stay readable
  G.clip = [x0, top, x0 + w - 1, last];
  for (let k = 0; k < 44 && tau < CALM; k++) {
    const ts = k < 16 ? 4.2 + k * 0.09 : 5.7 + (k - 16) * 0.004, a = tau - ts; if (a < 0 || a > 1.1) continue;
    const dir = hash(k * 19) - 0.5, vx = dir * (k < 16 ? 10 : 26), vy = k < 16 ? 10 : 16 + hash(k * 23) * 10;
    px(G, x0 + w / 2 + vx * a, row(12) * 2 - vy * a + 22 * a * a, Math.floor((tau + k) * 10) % 2 ? GOLD : '#FFF1A8');
  }
  G.clip = null;
  if (on(11)) put(G, centerX(art.epithet, X, w), row(11), art.epithet, INK, PARCH, true);
  if (on(12)) {
    const p = easeOut((tau - 4.2) / 1.5), money = `฿ ${Math.round(art.bounty * p).toLocaleString('en-US')}`;
    put(G, centerX(money, X, w), row(12), money, '#8B1E12', PARCH, true);
  }
  if (on(13)) { const work = clip(P.label, w - 4); put(G, centerX(work, X, w), row(13), work, '#6B4A26', PARCH); }
  if (tau > stampAt && reveal >= rows) { const flash = tau - stampAt < 0.1; put(G, X + 18, row(10), flash ? '▐MVP▌' : ' MVP ', flash ? '#3A0A08' : '#FFFFFF', flash ? '#FFFFFF' : '#C62D1F', true); }
  // the move is said once, as a speech bubble over the portrait, then the poster keeps the fixed name
  if (tau > 5.0 && tau < 6.6 && reveal >= rows) {
    const said = ` ${art.move} `, x = centerX(said, X, w);
    put(G, x, row(2), said, '#1A1020', '#FFFFFF', true); put(G, x + 2, row(3), '▼', '#FFFFFF');
  }
}

// result.md lands after the finish (the planner writes it), so the log says who is writing until then.
// Headline first (what the user gets), then the "한 일" lines that fit, then how many more.
function logLines(G, P, x, y, w, max, t0) {
  const { tau } = P;
  if (!P.settled) {
    const dots = '.'.repeat(1 + Math.floor(tau * 3) % 3);
    put(G, x + 1, y + 1, `✎ ${castName('planner') ?? 'planner'}가 항해일지를 쓰는 중${dots}`, mix(ROLE_COLOR.planner, BG, 0.25 + 0.2 * Math.sin(tau * 6)));
    return;
  }
  const { title: headline, done = [] } = P.outcome ?? {}, rows = headline ? max : max + 1, shown = done.slice(0, rows), more = done.length - shown.length;
  let typed = Math.floor((tau - Math.max(t0, P.settledAt ?? 0)) * 40), top = y;
  const type = (yy, xx, text, fg, bold) => { const chars = [...text], part = chars.slice(0, Math.max(0, typed)).join(''); if (typed > 0) put(G, xx, yy, part, fg, null, bold); typed -= chars.length + 2; return typed >= 0; };
  if (headline) { type(top, x, clip(`“${headline}”`, w), '#FFFFFF', true); top += 1; }
  if (!headline && !done.length) { put(G, x + 1, y + 1, '✎ result.md에 기록됐다', FGT); return; }
  shown.forEach((line, i) => {
    const tail = i === shown.length - 1 && more > 0 ? ` 외 ${more}건` : '', body = clip(line, w - 2 - strW(tail));
    if (typed > 0) put(G, x, top + i, '·', ROLE_COLOR.planner, null, true);
    if (type(top + i, x + 2, body, FGT) && tail) put(G, x + 2 + strW(body), top + i, tail, DIM);
  });
}

// Checks, not achievements: each line is something the harness verified for this story.
function checkLines(G, P, x, y, t0) {
  const { tau } = P, { rounds = null, max = 3, qa = false } = P.outcome ?? {}, lines = [];
  if (rounds != null) {
    const dots = Math.max(max, rounds);
    lines.push([['⚔ 리뷰 ', DIM], ...Array.from({ length: dots }, (_, k) => [k < rounds ? '●' : '○', k < rounds ? ROLE_COLOR.reviewer : LINE]), [` ${rounds}/${max}라운드`, FGT]]);
  }
  if (qa) lines.push([['✔ QA   ', DIM], [' PASS ', '#FFFFFF', OK_BG, true], [' 계약 통과', FGT]]);
  lines.push(P.settled ? [['✎ 기록 ', DIM], ['result.md 확정', OK, null, true]] : [['✎ 기록 ', DIM], [`정리 중 ${SPIN[Math.floor(tau * 10) % 10]}`, mix(ROLE_COLOR.planner, BG, 0.2)]]);
  lines.forEach((parts, i) => {
    const a = tau - t0 - i * 0.35; if (a < 0) return;
    let xx = x;
    for (const [text, fg, bg, bold] of parts) xx = put(G, xx, y + i, text, a < 0.08 ? '#FFFFFF' : fg, bg ?? null, bold ?? false);
    if (a < 0.5 && tau < CALM) tput(G, xx + 1, y + i, Math.floor(a * 14) % 2 ? '✦' : '✧', GOLD, true);
  });
}

// The one Enter notice on screen: Enter closes the card back to the board (board.mjs dismiss), it starts nothing.
function footer(G, P, y) {
  const { tau } = P, pulse = mix(OK, '#FFFFFF', 0.35 + 0.35 * Math.sin(tau * 4));
  const parts = [[`${P.story} 완료 · `, DIM], [P.settled ? 'result.md 확정' : `결과 정리 중 ${SPIN[Math.floor(tau * 10) % 10]}`, P.settled ? DIM : mix(ROLE_COLOR.planner, BG, 0.2)], ['   ', DIM],
    [' Enter ', '#1A1020', pulse, true], [' 보드로', OK, null, true]];
  let x = Math.max(1, Math.floor((W - parts.reduce((n, [t]) => n + strW(t), 0)) / 2));
  for (const [text, fg, bg, bold] of parts) x = put(G, x, y, text, fg, bg ?? null, bold ?? false);
}
const frameBorder = (G, tau) => box(G, 0, 0, W, G.h, DOUBLE, at => hsl(at * 5 - Math.min(tau, CALM) * 240, 85, 62));

// ---------- tall: title, crew, voyage between islands, then logbook + checks on the left and the poster below-right ----------
const TALL = { rows: 44, said: 5, crew: 12, shadow: 30, names: 16, stage: 17, route: 18, sea: 44, labels: 24, log: 26, check: 34, poster: { x: 48, y: 26 }, footer: 42 };
const SHIP = ['....wwwww..', '....wwkww..', '....wkkkw..', '....wwwww..', '......m....', 'hhhhhhhhhcc', '.hhhhhhhhcc', '..HHHHHHH..'];
const SHIP_INK = { w: '#F5F0E6', k: '#1B1B22', m: '#8B5E3C', h: '#C98A4A', H: '#8B5A2B', c: '#F2E6C9' };
const VOYAGE = { start: 1.8, travel: 0.42, pause: 0.22 };
// Islands follow the crew: one per stage this story had, plus the finish.
const islandsFor = n => Array.from({ length: n }, (_, i) => Math.round(7 + 64 * i / (n - 1)));
function voyagePos(tau, islands) {
  const stops = [1, ...islands.slice(0, -1), islands.at(-1) - 10], leg = VOYAGE.travel + VOYAGE.pause, t = tau - VOYAGE.start, last = islands.length - 1;
  if (t <= 0) return { center: stops[0], moving: false, reached: -1 };
  if (t >= (stops.length - 1) * leg) return { center: stops.at(-1), moving: false, reached: last, arrived: t - (stops.length - 1) * leg + VOYAGE.pause };
  const i = Math.floor(t / leg), p = Math.min(1, (t - i * leg) / VOYAGE.travel), ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  return { center: stops[i] + (stops[i + 1] - stops[i]) * ease, moving: p < 1, reached: p < 1 ? i - 1 : i };
}
const reachTime = i => VOYAGE.start + (i + 1) * (VOYAGE.travel + VOYAGE.pause) - VOYAGE.pause;
// Stage names under the islands: only what the harness knows (review rounds, QA verdict).
const stageLabel = (P, role) => role === 'reviewer' && P.outcome?.rounds != null ? `리뷰 ${P.outcome.rounds}회` : role === 'qa' && P.outcome?.qa ? 'QA PASS' : STAGE[role];
function sea(G, P) {
  const { tau } = P, roles = P.crew, islands = islandsFor(roles.length + 1), v = voyagePos(tau, islands), S = TALL.sea, goalAt = islands.length - 1;
  for (let x = 1; x < W - 1; x++) {
    const crest = Math.sin(x * 0.45 - tau * 3) + Math.sin(x * 0.17 + tau * 1.3) * 0.6;
    px(G, x, S, crest > 0.7 ? '#7FC4F0' : '#2E6BA8'); px(G, x, S + 1, crest > 1.1 ? '#2E6BA8' : '#24548A');
    px(G, x, S + 2, '#1C4473'); px(G, x, S + 3, '#163861');
    if (hash(x * 13 + Math.floor(tau * 4)) > 0.93) px(G, x, S + 2 + (x % 2), '#BFE6FF');
  }
  islands.forEach((ix, i) => {
    const lit = v.reached >= i, since = lit ? tau - reachTime(i) : -1, goal = i === goalAt;
    const sand = lit ? (since < 0.15 && tau < CALM ? '#FFF6D8' : '#E8C37A') : '#3E3646', top = lit ? '#F5DCA0' : '#4A4252';
    [[S - 3, 3, top], [S - 2, 5, sand], [S - 1, 7, sand]].forEach(([hy, w, c]) => { for (let k = 0; k < w; k++) px(G, ix - Math.floor(w / 2) + k, hy, c); });
    if (!goal && i % 2 === 0) {
      const trunk = lit ? '#8B5E3C' : '#4A3E40', leaf = lit ? '#4FBF5A' : '#3A4A3E', sway = Math.round(Math.sin(tau * 2 + i) * 0.6);
      px(G, ix, S - 4, trunk); px(G, ix, S - 5, trunk); [[0, -6], [-1, -6], [1, -6], [-2, -5], [2, -5]].forEach(([dx, dy]) => px(G, ix + dx + sway, S + dy, leaf));
    }
    if (goal) {
      const rise = v.arrived != null ? easeOut(v.arrived / 0.6) : 0, flagTop = S - 6 + Math.round((1 - rise) * 2);
      for (let hy = S - 6; hy <= S - 4; hy++) px(G, ix, hy, '#D8D0C0');
      if (rise > 0) for (let y = 0; y < 3; y++) for (let x = 1; x <= 3; x++) px(G, ix + x, flagTop + y, x === 2 && y === 1 ? '#FFFFFF' : '#141418');
    }
    if (lit && since >= 0 && since < 0.5) for (let k = 0; k < 8; k++) { const a = Math.PI * 2 * k / 8, r = 1 + since * 9; px(G, ix + Math.cos(a) * r * 1.4, S - 3 + Math.sin(a) * r * 0.8, mix('#FFF1A8', BG, since * 2)); }
  });
  for (let k = 0; k < 2; k++) {
    const gx = ((tau * (4 + k * 2) + k * 37) % 92) - 8, gy = S - 6 + Math.round(Math.sin(tau * 1.5 + k) * 0.8), up = Math.floor(tau * 4 + k) % 2;
    px(G, gx, gy + up, '#EDE8F0'); px(G, gx + 1, gy + 1 - up, '#EDE8F0'); px(G, gx + 2, gy + up, '#EDE8F0');
  }
  const sx = Math.round(v.center - 5), bob = Math.round(Math.sin(tau * 4) * 0.6);
  if (v.moving) for (let k = 1; k < 7; k++) px(G, sx - k + 1, S + (k % 2), mix('#E6F6FF', '#2E6BA8', k / 7));
  SHIP.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') px(G, sx + x, S - 6 + y + bob, SHIP_INK[c]); }));
  [...roles.map(role => stageLabel(P, role)), '완주'].forEach((label, i) => {
    const lit = v.reached >= i, since = lit ? tau - reachTime(i) : -1, color = i === goalAt ? GOLD : ROLE_COLOR[roles[i]];
    put(G, Math.max(1, Math.min(W - 1 - strW(label), centerX(label, islands[i] - 6, 13))), TALL.labels, label, lit ? (since < 0.12 ? '#FFFFFF' : color) : '#4A4450', null, lit);
  });
}
function section(G, tau, t0, y, h, label, color, tail) {
  box(G, 1, y, 46, h, ROUND, () => '#4A3E58', easeOut((tau - t0) / 0.6));
  if (tau > t0 + 0.3) { const x = put(G, 3, y, label, color, null, true); if (tail) put(G, x, y, tail, DIM); }
  return tau > t0 + 0.4;
}
function tallScene(P) {
  const { tau } = P, G = grid(W, TALL.rows);
  if (tau < 0.3) for (const cell of G.cells) cell.bg = mix('#FFFFFF', BG, tau / 0.3);
  title(G, P, { sky: [1, 2, W - 2, TALL.route * 2 - 1], fireworks: { x: 6, w: W - 12, y: 4, h: 16, r: 13 }, sub: { x: 0, w: W, y: 4 } });
  crew(G, P, { members: P.crew, x0: 1, w: W - 2, slotMax: 14, hy: TALL.crew, shadow: TALL.shadow, names: TALL.names, said: TALL.said, stage: TALL.stage, hopPx: 4, crown: true });
  if (tau > 1.6) {
    const reach = Math.floor(easeOut((tau - 1.6) / 0.5) * (W - 4));
    put(G, 2, TALL.route, '─'.repeat(reach), '#3A3440');
    put(G, 3, TALL.route, ' ≋ 항해 경로 ', '#87D7FF', null, true);
  }
  sea(G, P);
  if (section(G, tau, 2.9, TALL.log, 8, ' ✎ 항해일지 ', ROLE_COLOR.planner, 'result.md ')) logLines(G, P, 3, TALL.log + 1, 42, 5, 3.3);
  if (section(G, tau, 3.3, TALL.check, 7, ' ✔ 검증 ', OK)) checkLines(G, P, 4, TALL.check + 1, 3.7);
  poster(G, P, TALL.poster);
  footer(G, P, TALL.footer);
  frameBorder(G, tau);
  return G;
}

// ---------- compact: title on top, crew + one-row voyage left, poster right, then the result and its checks ----------
const COMPACT = { rows: 26, sub: 4, said: 5, crew: 10, shadow: 28, names: 15, rail: 16, sea: 34, divider: 19, log: 20, footer: 24, poster: { x: 49, y: 4 } };
const LEFT = { x: 1, w: 47 };
const BOAT = ['...w...', '..www..', 'hhhhhhh', '.HHHHH.'], BOAT_INK = { w: '#F5F0E6', h: '#C98A4A', H: '#8B5A2B' };
function rail(G, P) {
  const { tau } = P, roles = P.crew, labels = [...roles.map(role => STAGE[role]), '⚑'], C = COMPACT;
  const x0 = LEFT.x + 4, x1 = LEFT.x + LEFT.w - 4, at = i => Math.round(x0 + (x1 - x0) * i / (labels.length - 1));
  const p = clamp01((tau - 1.8) / (0.32 * (labels.length - 1))), ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  const ship = at(0) - 6 + (at(labels.length - 1) - at(0) + 6) * (tau < 1.8 ? 0 : ease);
  if (tau > 1.6) {
    const reach = Math.floor(easeOut((tau - 1.6) / 0.4) * (x1 - x0 + 4));
    for (let x = x0 - 2; x < x0 - 2 + reach; x++) put(G, x, C.rail, x <= ship ? '━' : '─', x <= ship ? mix(GOLD, BG, 0.45) : '#3A3440');
    labels.forEach((label, i) => {
      const cx = at(i), lit = ship >= cx - 1, flash = lit && ship - cx < 2.5 && tau < CALM, color = i === labels.length - 1 ? GOLD : ROLE_COLOR[roles[i]];
      put(G, cx - Math.floor(strW(` ${label} `) / 2), C.rail, ` ${label} `, lit ? (flash ? '#FFFFFF' : color) : '#4A4450', null, lit);
    });
  }
  for (let x = LEFT.x + 1; x < LEFT.x + LEFT.w - 1; x++) {
    const crest = Math.sin(x * 0.45 - tau * 3) + Math.sin(x * 0.17 + tau * 1.3) * 0.6;
    px(G, x, C.sea + 2, crest > 0.7 ? '#7FC4F0' : '#2E6BA8'); px(G, x, C.sea + 3, '#1C4473');
  }
  const sx = Math.round(ship - 3);
  if (tau > 1.8 && p < 1) for (let k = 1; k < 6; k++) px(G, sx - k + 1, C.sea + 2 + (k % 2), mix('#E6F6FF', '#2E6BA8', k / 6));
  BOAT.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') px(G, sx + x, C.sea + y, BOAT_INK[c]); }));
}
function compactScene(P) {
  const { tau } = P, C = COMPACT, G = grid(W, C.rows);
  if (tau < 0.3) for (const cell of G.cells) cell.bg = mix('#FFFFFF', BG, tau / 0.3);
  title(G, P, { sky: [1, 2, LEFT.x + LEFT.w - 1, C.names * 2 - 1], fireworks: { x: 4, w: 42, y: 3, h: 12, r: 11 }, sub: { x: LEFT.x, w: LEFT.w, y: C.sub } });
  crew(G, P, { members: P.crew.filter(role => role !== P.mvp), x0: LEFT.x, w: LEFT.w, slotMax: 14, hy: C.crew, shadow: C.shadow, names: C.names, said: C.said, stage: null, hopPx: 2, crown: false });
  rail(G, P);
  poster(G, P, C.poster);
  if (tau > 3.4) {
    const reach = Math.floor(easeOut((tau - 3.4) / 0.5) * (W - 2));
    put(G, 1, C.divider, '─'.repeat(reach), '#3A3440');
    if (reach >= 30) {
      const x = put(G, 3, C.divider, ' ✎ 항해일지 ', ROLE_COLOR.planner, null, true); put(G, x, C.divider, 'result.md ', DIM);
      logLines(G, P, 3, C.log, LEFT.w - 3, 3, 3.6);
    }
    if (tau > 3.9) { put(G, C.poster.x + 1, C.divider, ' ✔ 검증 ', OK, null, true); checkLines(G, P, C.poster.x + 2, C.log, 3.9); }
  }
  footer(G, P, C.footer);
  frameBorder(G, tau);
  return G;
}

export const SCENE_ROWS = { tall: TALL.rows, compact: COMPACT.rows };
// party: { story, label, tau, settled, settledAt, crew, mvp, outcome: { title, done, rounds, max, qa } }.
export function victoryScene(party, layout) {
  const P = { ...party, crew: party.crew?.length ? party.crew : ['executor'] };
  if (!P.crew.includes(P.mvp)) P.mvp = mvpOf(P.story, P.crew);
  return segments(layout === 'tall' ? tallScene(P) : compactScene(P));
}
