// Pixel characters for the console: one terminal cell holds two pixels (upper and lower half block).
// Decoration only: a moving sprite is never evidence that a model is generating.
import { clean, columns } from './terminal.mjs';

export const BG = '#120E14';
export const ROLE_COLOR = { planner: '#FFAF5F', executor: '#87D7FF', reviewer: '#AFD787', designer: '#FF87AF', qa: '#AF87FF', refactor: '#B6FF58' };
export const FIRE = ['#7A1712', '#C62D1F', '#FF6A13', '#FFA51F', '#FFE066', '#FFF4D6'];
export const GOLD = '#FFD24A';

const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export function hsl(h, s, l) { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return toHex([f(0) * 255, f(8) * 255, f(4) * 255]); }
export const hash = v => (Math.imul(v | 0, 2654435761) >>> 0) / 4294967296;

// ---------------- cell grid ----------------
// Text cells and pixel cells share one grid; a pixel drawn over text clears it. clip limits pixels to a region.
// Text without its own background keeps the cell's (a working card's tint).
export function grid(w, h) { return { w, h, clip: null, cells: Array.from({ length: w * h }, () => ({ ch: ' ', fg: null, bg: null, bold: false, top: null, bottom: null })) }; }
export function put(G, x, y, text, fg = null, bg = null, bold = false) {
  for (const c of clean(text)) {
    const w = columns(c);
    if (!w) continue;
    if (y >= 0 && y < G.h && x >= 0 && x + w <= G.w) {
      const at = G.cells[y * G.w + x];
      Object.assign(at, { ch: c, fg, bg: bg ?? at.bg, bold, top: null, bottom: null });
      if (w === 2) Object.assign(G.cells[y * G.w + x + 1], { ch: '', fg, bg: bg ?? at.bg, bold, top: null, bottom: null });
    }
    x += w;
  }
  return x;
}
export function px(G, x, hy, c) {
  if (!c) return;
  x = Math.round(x); hy = Math.round(hy);
  if (x < 0 || x >= G.w || hy < 0 || hy >= G.h * 2) return;
  if (G.clip && (x < G.clip[0] || x > G.clip[2] || hy < G.clip[1] || hy > G.clip[3])) return;
  const cell = G.cells[(hy >> 1) * G.w + x];
  if (cell.ch !== ' ') { if (cell.ch === '' && x > 0) G.cells[(hy >> 1) * G.w + x - 1].ch = ' '; cell.ch = ' '; }
  if (hy & 1) cell.bottom = c; else cell.top = c;
}
const empty = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y < G.h && (c => c.ch === ' ' && !c.top && !c.bottom)(G.cells[y * G.w + x]);
// Text that never covers sprite pixels or other text.
export const tput = (G, x, y, s, fg, bold) => { if ([...s].every((_, k) => empty(G, x + k, y))) put(G, x, y, s, fg, null, bold); };
export function blit(G, S, x, hy, scale = 1) {
  for (let y = 0; y < S.h; y++) for (let xx = 0; xx < S.w; xx++) {
    const c = S.p[y * S.w + xx]; if (!c) continue;
    for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) px(G, x + xx * scale + a, hy + y * scale + b, c);
  }
}
// Grid rows as console segments ([text, ...style]); hex colors go out as fg:#RRGGBB / bg:#RRGGBB.
export function segments(G) {
  const rows = [];
  for (let y = 0; y < G.h; y++) {
    const row = [];
    for (let x = 0; x < G.w; x++) {
      const c = G.cells[y * G.w + x];
      if (c.ch === '') continue;
      const bg = c.bg ? [`bg:${c.bg}`] : [];
      if (c.ch !== ' ') row.push([c.ch, ...(c.bold ? ['bold'] : []), ...(c.fg ? [`fg:${c.fg}`] : []), ...bg]);
      else if (c.top && c.bottom) row.push(c.top === c.bottom ? ['█', `fg:${c.top}`] : ['▀', `fg:${c.top}`, `bg:${c.bottom}`]);
      else if (c.top) row.push(['▀', `fg:${c.top}`, ...bg]);
      else if (c.bottom) row.push(['▄', `fg:${c.bottom}`, ...bg]);
      else row.push([' ', ...bg]);
    }
    rows.push(row);
  }
  return rows;
}

// ---------------- pixel buffers ----------------
const sbuf = (w, h) => ({ w, h, p: new Array(w * h).fill(null) });
function sp(S, x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= S.w || y >= S.h || !c) return; S.p[y * S.w + x] = c; }
const spE = (S, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S.w && y < S.h && !S.p[y * S.w + x]) sp(S, x, y, c); };
function srect(S, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) sp(S, x + i, y + j, c); }
function sline(S, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (let n = 0; n < 64; n++) { sp(S, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// Straight run of pixels (fractional ends allowed).
function seg(plot, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) plot(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c); }
// Jagged lightning from (x0,y0) to (x1,y1); seed fixes the zigzag. The glow is drawn first, the core over it.
function bolt(plot, x0, y0, x1, y1, seed, core, glow) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3)), pts = [];
  for (let k = 0; k <= n; k++) { const f = k / n, j = k && k < n ? 1 : 0; pts.push([x0 + (x1 - x0) * f + j * (hash(seed * 31 + k) - .5) * 4, y0 + (y1 - y0) * f + j * (hash(seed * 37 + k) - .5) * 3]); }
  if (glow) for (let k = 1; k <= n; k++) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) seg((x, y, c) => plot(x + a, y + b, c), ...pts[k - 1], ...pts[k], glow);
  for (let k = 1; k <= n; k++) seg(plot, ...pts[k - 1], ...pts[k], core);
}
// Empty pixels touching the drawn body, for auras that hug the silhouette.
function rim(S) {
  const out = [], at = (x, y) => x >= 0 && y >= 0 && x < S.w && y < S.h && S.p[y * S.w + x];
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (!at(x, y) && (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))) out.push([x, y]);
  return out;
}
const gray = c => { const [r, g, b] = hx(c), l = .3 * r + .59 * g + .11 * b; return mix(toHex([l, l, l]), BG, .35); };
const alertMark = (S, t) => { srect(S, 18, 0, 4, 5, '#D9534F'); sp(S, 18, 5, '#D9534F'); srect(S, 19, 1, 2, 2, '#FFFFFF'); srect(S, 19, 4, 2, 1, '#FFFFFF'); if (Math.floor(t * 4) % 2) srect(S, 18, 0, 4, 1, '#FF8A80'); };

// ---------------- characters ----------------
// Body maps are 14x14; each letter is a palette key, '.' is empty. Eyes, mouth, arms and props are drawn on top.
// Fan-art characters for a private repository; without color the console falls back to the box art.
const SK = '#F6C9A0';
const CHARS = {
  refactor: { id: 'brook', name: '브룩', line: '요호호호! 라분!', arm: ['w', 'w'], hand: 'w', lid: 'w', eyes: [[4, 4], [8, 4]], look: [0, 0], eyeC: '#171923',
    P: { a: '#262333', A: '#45405A', w: '#F8F4DC', k: '#171923', c: '#A3D9F5', b: '#65A6CF', g: '#FFD24A', n: '#303044' },
    map: ['...aAaaaaAa...', '..aAaaaaaaAa..', '.aAaaaaaaaaAa.', '.aawwwwwwwwaa.', '.aawkkwwkkwaa.', '..awkkwwkkwa..', '...wwwkkwww...', '....wkwkwk....', '....cgwwgc....', '....cwwwwc....', '....ckkwkc....', '....cwwwwc....', '.....w..w.....', '....nw..wn....'] },
  planner: { id: 'nami', name: '나미', line: '보수는 두 배야!', arm: ['s', 's'], hand: 's', mouth: [6, 7, 2, '#E0607A'],
    P: { o: '#FF8A3D', O: '#D9662A', s: SK, b: '#3A7BD5', w: '#FFFFFF', j: '#4A6FA5', f: '#8B5E3C' },
    map: ['....oooooo....', '...oooooooo...', '..oOooooooOo..', '..oossssssoo..', '.oossssssssoo.', '.oossssssssoo.', '.oossssssssoo.', '.oo.ssssss.oo.', '.oo.bwbwbw.oo.', '.o..ssssss..o.', '....jjjjjj....', '....jj..jj....', '....jj..jj....', '...ff....ff...'] },
  designer: { id: 'sanji', name: '상디', line: '오늘의 특선이다', arm: ['k', 'k'], hand: 's', eyes: [[8, 4]],
    P: { y: '#FFD54F', Y: '#E0B030', c: '#9A6B12', s: SK, k: '#22222C', b: '#5E8CC9', t: '#14141C', n: '#3A2A20' },
    map: ['....yyyyyy....', '...yyyyyyyy...', '..yyyyyyyyyy..', '..yyyyysccsy..', '..yyyyyssssy..', '..yyyyssssss..', '...Yysssssss..', '....ssssss....', '....kbttbk....', '....kkttkk....', '....kkkkkk....', '....kk..kk....', '....kk..kk....', '...nn....nn...'] },
  executor: { id: 'luffy', name: '루피', line: '시시시! 해냈다!', arm: ['s', 's'], hand: 's', mouth: [6, 7, 2, '#7A2A2A'],
    P: { y: '#F2C94C', o: '#C9A227', r: '#D63B3B', k: '#1B1B22', s: SK, x: '#B5524A', b: '#3E6FB0', t: '#8B5E3C' },
    map: ['....yyyyyy....', '...rrrrrrrr...', 'oyyyyyyyyyyyyo', '..kkkkkkkkkk..', '..kssssssssk..', '..kssssssssk..', '...ssxsssss...', '....ssssss....', '....rrssrr....', '....rrssrr....', '....bbbbbb....', '....bb..bb....', '....ss..ss....', '...tt....tt...'] },
  reviewer: { id: 'zoro', name: '조로', line: '흥, 별거 아니군', arm: ['w', 's'], hand: 's', eyes: [[8, 4]], mouth: [6, 7, 2, '#8A4A3A'],
    P: { g: '#4FBF5A', G: '#2E8B3E', s: SK, x: '#C98A70', a: '#FFD24A', w: '#EDEDED', h: '#2E6B3A', k: '#2A2A33', b: '#16161C' },
    map: ['...g.gggg.g...', '..gggggggggg..', '..gGggggggGg..', '..gssxssGGsg..', '..sssxssssss..', '.asssxssssss..', '.a.ssxsssss...', '....ssssss....', '....wwwwww....', '....hhhhhh....', '....kkkkkk....', '....kk..kk....', '....kk..kk....', '...bb....bb...'] },
  // Captain's hat with his own jolly roger, long blue hair, clown-white face, round red nose, red coat with a fur collar.
  qa: { id: 'buggy', name: '버기', line: '화려하게 가자!', arm: ['c', 'c'], hand: 'W', lid: 'f', mouth: [5, 8, 4, '#E53935'], sh: [[3, 9], [10, 9]],
    P: { h: '#1D2340', H: '#2E3768', w: '#F5F5F5', R: '#FF2D2D', B: '#4FA3E0', f: '#FAF4EE', c: '#C62828', W: '#F2F2F2', b: '#3F6BC4', p: '#5B3F8C', n: '#3A2A20' },
    map: ['....hhhhhh....', '...hhwwwwhh...', '...hhwRRwhh...', '.HHHHHHHHHHHH.', 'BBBffffffffBBB', 'BBffffffffffBB', 'BBffffRRffffBB', 'B.ffffRRffff.B', 'B..ffffffff..B', 'B..WWWWWWWW..B', '....cbwbwc....', '....cwbwbc....', '....pp..pp....', '...nn....nn...'] },
};
// Cross Guild officers who show up behind Buggy (9x14, drawn behind him).
const GUILD = {
  mihawk: { P: { k: '#16161C', F: '#EDE4FA', s: SK, Y: '#FFD21F', m: '#26262E', c: '#2B2B36', r: '#7A1E2E', y: '#E0B030' },
    map: ['......FF.', '...kkkFF.', '..kkkkkF.', 'kkkkkkkkk', '..ksssk..', '..sYsYs..', '..smmms..', '...sss...', '.ccsyscc.', 'crcsyscrc', 'cc.ccc.cc', '...ccc...', '...c.c...', '..kk.kk..'] },
  crocodile: { P: { k: '#16161C', s: '#E8B48E', x: '#8A5040', c: '#1F2A24', f: '#8B6A3E', g: '#2E5E3E' },
    map: ['..kkkkk..', '.kkkkkkk.', '.kssssss.', '..sksks..', '.sxxxxxs.', '..sssss..', '...sss...', 'fffcgcfff', 'ffcccccff', '.ccccccc.', '.cc.c.cc.', '...ccc...', '...c.c...', '..kk.kk..'] },
};
export const castName = role => CHARS[role]?.name ?? null;
export const catchphrase = role => CHARS[role]?.line ?? null;

// Arm offsets from the shoulder for the left arm; the right arm mirrors dx.
const ARM2 = { down: [[[0, 0], [0, 1]], [0, 2]], up: [[[-1, 0], [-2, -1], [-2, -2]], [-2, -3]], wave: [[[-1, 0], [-2, -1]], [-3, -2]],
  out: [[[-1, 0], [-2, 0]], [-3, 0]], hip: [[[-1, 0], [-2, 1]], [-1, 2]], cross: [[[1, 1], [2, 1]], [3, 1]] };
function drawChar(S, C, o) {
  const P = C.P, ox = o.ox ?? 2, oy = o.oy ?? 1, bob = o.bob || 0, lift = o.lift || 0, ground = o.ground ?? oy + 14;
  // bob bends the knees (head and body sink, feet stay); lift moves only the head.
  const Y = y => oy + y + (y <= 10 ? bob : 0) - (y <= 7 ? lift : 0), X = x => ox + x, col = k => o.recolor?.[k] || P[k];
  o.X = X; o.Y = Y; o.hands = {};
  if (!o.noShadow) { const w = Math.max(4, 8 - Math.max(0, ground - oy - 14) * 2); for (let k = 0; k < w; k++) sp(S, ox + 7 - w / 2 + k, ground, '#2A2230'); }
  const map = o.map || C.map;
  for (let y = map.length - 1; y >= 0; y--) [...map[y]].forEach((k, x) => { if (k !== '.') sp(S, X(x), Y(y), col(k)); });
  const E = C.eyeC || '#1A1420', lid = P[C.lid || 's'], look = Math.max(C.look?.[0] ?? -1, Math.min(C.look?.[1] ?? 1, o.look || 0));
  (C.eyes || [[5, 4], [8, 4]]).forEach(([ex, ey]) => {
    const x = X(ex), y = Y(ey);
    switch (o.eyes) {
      case 'open': sp(S, x + look, y, E); sp(S, x + look, y + 1, E); break;
      case 'blink': case 'sleep': sp(S, x, y, lid); sp(S, x, y + 1, E); break;
      case 'happy': sp(S, x, y, E); sp(S, x, y + 1, lid); sp(S, x - 1, y + 1, E); sp(S, x + 1, y + 1, E); break;
      case 'heart': [[-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]].forEach(([a, b]) => sp(S, x + a, y + b, '#FF3B6B')); sp(S, x, y, lid); break;
    }
  });
  if (C.mouth && o.mouth) {
    const [mx, my, mw, mc] = C.mouth, y = Y(my);
    if (o.mouth === 'smile') srect(S, X(mx), y, mw, 1, mc);
    if (o.mouth === 'grin') { srect(S, X(mx) - 1, y, mw + 2, 1, '#FFFFFF'); sp(S, X(mx) - 1, y, mc); sp(S, X(mx) + mw, y, mc); }
    if (o.mouth === 'o') sp(S, X(mx) + (mw > 2 ? 1 : 0), y, mc);
  }
  const sh = C.sh || [[3, 8], [10, 8]];
  [['L', o.armL, sh[0], 1], ['R', o.armR, sh[1], -1]].forEach(([side, spec, [sx, sy], m]) => {
    const a = ARM2[spec]; if (!a) return;
    const bx = X(sx), by = Y(sy);
    a[0].forEach(([dx, dy], k) => sp(S, bx + dx * m, by + dy, col(C.arm[k ? 1 : 0])));
    const h = [bx + a[1][0] * m, by + a[1][1]]; sp(S, h[0], h[1], col(C.hand)); o.hands[side] = h;
  });
}
function bug(S, x, y, frame) { sp(S, x, y, '#7CFC6A'); sp(S, x + 1, y, '#4FBF45'); if (frame % 2) sp(S, x, y - 1, '#FFFFFF'); }
const bugAt = t => [18 + Math.round(2.5 * Math.sin(t * 3.3)), 4 + Math.round(2 * Math.sin(t * 5.1))];
const ease = k => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3;
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
function officer(S, M, x0, y0, seen) { M.map.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.' && seen(x, y)) sp(S, x0 + x, y0 + y, M.P[k]); })); }

// Signature-move clocks, shared by a sprite, its card border and its tint so they hit the same beat.
// Gear 5: three rubber bounces, then a giant fist (punch 0..1).
const gear5 = t => { const c = t % 2.4; return c < 1.2 ? { hop: Math.abs(Math.sin(c / 1.2 * 3 * Math.PI)) > .5 ? 1 : 0, punch: null } : { hop: 0, punch: (c - 1.2) / 1.2 }; };
// Enma: short slashes all along, and a cut across the whole card every 2.4s (cut 0..1).
const enma = t => { const c = t % 2.4; return { cut: c > 1.6 && c < 2.1 ? (c - 1.6) / .5 : null }; };
// Zeus: each strike draws one more point of the route; the sky lights for the first .1s of a strike.
const ROUTE = [[18, 13], [19, 12], [19, 11], [20, 11], [21, 10], [21, 9], [22, 8]];
const zeus = t => { const step = Math.floor(t * 3) % (ROUTE.length + 5); return { step, flash: step >= 1 && step <= ROUTE.length && (t * 3) % 1 < .3 }; };
// Cross Guild: a bug hunt, then Mihawk and Crocodile arrive (in 0..1), pose (pose 0..1) and fade out.
const guild = t => { const c = t % 5; return c < 2.6 ? { hunt: true, in: 0 } : c < 3 ? { in: (c - 2.6) / .4 } : c < 4.5 ? { in: 1, pose: (c - 3) / 1.5 } : { in: 1 - (c - 4.5) / .5, out: true }; };
const roll = g => g.pose !== undefined && g.pose < .08;

// Idle pastimes, one per character, so a waiting board still looks like a ship's deck.
// Zoro presses a barbell: height 0 racked at the chin, 1 locked out overhead.
const press = t => { const p = (t % 2.4) / 2.4; return p < .15 ? 0 : p < .4 ? ease((p - .15) / .25) : p < .6 ? 1 : p < .85 ? 1 - (p - .6) / .25 : 0; };
// Luffy works through a bone-in meat in four bites, holds up the clean bone, then a fresh one appears.
const meal = t => { const n = Math.floor(t / 1.8), p = (t % 1.8) / 1.8, left = 4 - n % 5;
  return { left, p, reach: left ? (p < .3 ? 0 : p < .45 ? ease((p - .3) / .15) : p < .55 ? 1 : p < .7 ? 1 - (p - .55) / .15 : 0) : 0, eaten: left ? 4 - left + (p > .5 ? 1 : 0) : 4 }; };
// Nami's pinwheel: a steady spin with gusts (gust 0..1).
const pinwheel = t => ({ a: 5 * t + 3 * Math.sin(.7 * t), gust: Math.max(0, Math.cos(.7 * t) - .3) / .7 });
// Buggy's three-ball cascade: each ball flies two beats and rests one in a hand; the head pops off now and then.
const BEAT = .28;
const cascade = (t, i) => { const q = (t / BEAT + 2 * i) % 6; return q < 2 ? { from: 0, s: q / 2 } : q < 3 ? { hand: 1 } : q < 5 ? { from: 1, s: (q - 3) / 2 } : { hand: 0 }; };
// A pixel eighth note, for Brook's violin.
const note = (S, x, y, c) => [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2]].forEach(([a, b]) => spE(S, x + a, y + b, c));

const HAKI = ['#1A0826', '#3A0F5C', '#6B1FA8', '#A855F7'], ENMA = ['#120A14', '#2A0C22', '#4B1238', '#7A1846', '#B3204F'];
const ENMA_AURA = ['#3B0A3A', '#6A1A6A', '#9A2A6A', '#E05080'], BLUE = ['#0B1E5B', '#1F4FD8', '#2F8BFF', '#5CC8FF', '#B8F0FF', '#FFFFFF'];
const G5 = { y: '#FFFFFF', o: '#E6DCFF', r: '#FFFFFF', k: '#F4F0FF', b: '#E9E2F7' };
const ZEUS = ['...ww..ww..', '..wwwwwwww.', '.wwwwwwwwww', 'wwwwwwwwwww', '.SSSSSSSSS.'];

// Per-character tweaks: pre sets pose fields, under draws behind the body, post adds props; vpre/vpost do the same for the cheering pose.
// The working pose is each character's signature move.
const CFX = {
  brook: {
    pre(o, pose, t) {
      if (pose === 'idle') Object.assign(o, { armL: 'none', armR: 'none', bob: Math.floor(t * 1.2) % 2, look: 0 });
      if (pose === 'working') Object.assign(o, { armL: 'none', armR: 'none', bob: Math.floor(t * 4) % 2 });
    },
    under(S, o, pose, t, frame) {
      if (pose !== 'working') return;
      // Soul King's giant lime skull floats behind the afro, its tail and arms curling around him.
      const y0 = Math.floor(t * 3) % 2, pal = { g: '#72DF42', l: '#B6FF58', w: '#E8FFD0', k: '#19452E' };
      ['..gglllgg..', '.glwwwwwlg.', 'glwkkwkkwlg', '.lwwkwkwwl.', '..lwkkkwl..', '...lkkkl...', '...lwlwl...'].forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') sp(S, 15 + x, y + y0, pal[k]); }));
      for (let k = 0; k < 8; k++) { const x = 21 + Math.sin(t * 4 + k * .6) * 2, y = 7 + k; sp(S, x, y, '#B6FF58'); sp(S, x + 1, y, '#72DF42'); }
      for (const side of [-1, 1]) for (let k = 0; k < 13; k++) {
        const x = side < 0 ? 2 + Math.sin(k * .55 + t * 4) * 2 : 24 + Math.sin(k * .6 - t * 4), y = 14 - k;
        sp(S, x, y, k % 3 ? '#72DF42' : '#E8FFD0'); sp(S, x + side, y, '#B6FF58');
      }
      for (let k = 0; k < 12; k++) if (hash(k * 7 + frame) > .45) sp(S, hash(k * 11 + frame) * 26, hash(k * 13 + frame) * 16, k % 2 ? '#B6FF58' : '#E8FFD0');
    },
    post(S, o, pose, t) {
      if (pose === 'offline' || pose === 'sleeping') return;
      if (pose === 'idle') {
        // A violin under the jaw, the bow sawing across it, notes drifting off to the right.
        const B = '#F8F4DC', vx = o.X(10), vy = o.Y(7), s = .5 + .5 * Math.sin(t * 4.2);
        sline(S, o.X(10), o.Y(8), o.X(13), o.Y(11), B); sline(S, o.X(13), o.Y(11), vx + 7, vy + 1, B);
        const pal = { b: '#B4532A', B: '#7A3418', h: '#E08A4A', k: '#2A1810', s: '#F2E2C0' };
        ['.bb.......k', 'bhbbkkkkkk.', 'bbsb.......', '.bBb.......'].forEach((row, dy) => [...row].forEach((k, dx) => { if (k !== '.') sp(S, vx + dx, vy + dy, pal[k]); }));
        const hx_ = o.X(6) + s * 3, hy = o.Y(12) - s * 3;
        sline(S, o.X(3), o.Y(8), o.X(4), o.Y(11), B); sline(S, o.X(4), o.Y(11), hx_, hy, B);
        seg((x, y, c) => sp(S, x, y, c), hx_, hy, hx_ + 9, hy - 9, '#E8D8B0'); sp(S, hx_, hy, '#3A2A20');
        for (let k = 0; k < 2; k++) { const p = (t * .55 + k * .5) % 1; note(S, 19 + k * 3 + Math.round(Math.sin(p * 6 + k) * 1.5), 9 - Math.floor(p * 9), mix(k ? '#B6FF58' : '#E8FFD0', BG, p * .8)); }
        return;
      }
      // The guitar sits beside the open coat so the ribs and thin bone limbs stay visible.
      const x = o.X(8), y = o.Y(10), pal = { t: '#28BCA5', T: '#167F78', w: '#BFFFE8' };
      if (pose === 'working') {
        sline(S, o.X(3), o.Y(8), o.X(2), o.Y(11), '#F8F4DC');
        sline(S, o.X(2), o.Y(11), x + 4, y + 1, '#F8F4DC');
        sline(S, o.X(10), o.Y(8), x + 8, y - 3, '#F8F4DC');
      }
      ['.t..t..', 'tttttt.', 'Tttwttt', '.ttttt.', 'tt..tt.'].forEach((row, dy) => [...row].forEach((k, dx) => { if (k !== '.') sp(S, x + dx, y + dy - 1, pal[k]); }));
      sline(S, x + 4, y + 1, x + 12, y - 4, '#167F78');
      sline(S, x + 3, y, x + 12, y - 5, '#BFFFE8');
      for (let k = 0; k < 3; k++) sp(S, x + 10 + k, y - 5 - (k % 2), '#28BCA5');
      sp(S, x + 4, y + (pose === 'working' ? Math.floor(t * 8) % 2 : 0), '#F8F4DC');
      sp(S, x + 8, y - 3, '#F8F4DC');
    },
    vpost(S, o, tau) { const y = 2 + Math.floor((tau * 3) % 4); sline(S, 18, y, 18, y + 3, '#B6FF58'); sp(S, 17, y + 3, '#B6FF58'); sp(S, 19, y, '#B6FF58'); },
  },
  luffy: {
    pre(o, pose, t) {
      if (pose === 'idle') {
        const m = meal(t), chew = m.left && m.p > .55;
        Object.assign(o, { armL: 'hip', armR: 'none', look: m.reach > .5 ? -1 : 1, mouth: m.reach === 1 ? 'o' : chew ? (Math.floor(t * 7) % 2 ? 'smile' : null) : 'grin' });
        if (!m.left) Object.assign(o, { eyes: 'happy', look: 0 });
      }
      if (pose !== 'working') return;
      // Gear 5: hat and clothes go white, he bounces like rubber, then throws a giant fist.
      const g = gear5(t);
      Object.assign(o, { recolor: G5, mouth: 'grin', look: 1, oy: 1 - g.hop, bob: g.hop ? 0 : 1 });
      if (g.punch !== null) Object.assign(o, { armL: 'hip', armR: 'none', bob: g.punch < .15 ? 1 : 0 });
      else o.armL = o.armR = Math.floor(t * 6) % 2 ? 'up' : 'wave';
    },
    post(S, o, pose, t, frame) {
      if (pose === 'sleeping') { // snot bubble
        const r = Math.floor(t * 1.4) % 4, bx = o.X(8), by = o.Y(6) + 1, C = '#A8DCFF';
        if (r === 1) sp(S, bx, by, C);
        if (r >= 2) { srect(S, bx, by - 1, r, r, C); sp(S, bx, by - 1, '#FFFFFF'); }
      }
      if (pose === 'idle') {
        // Meat on the bone: lift, chomp (the bite comes off the mouth side), chew with puffed cheeks.
        const m = meal(t), hx_ = Math.round(lerp(o.X(14), o.X(9), m.reach)), hy = Math.round(lerp(o.Y(11), o.Y(12), m.reach)), W = '#F5F0E0';
        sline(S, o.X(10), o.Y(8), hx_, hy, SK); sp(S, hx_, hy, SK);
        sline(S, hx_, hy - 1, hx_, hy - 6, W); sp(S, hx_ - 1, hy - 7, W); sp(S, hx_ + 1, hy - 7, W);
        ['.MMM.', 'MMhMM', 'MMMMM', '.MMM.'].forEach((row, dy) => [...row].forEach((k, dx) => {
          if (k !== '.' && dx - (dy % 3 ? 0 : 1) >= m.eaten * 1.25) sp(S, hx_ - 2 + dx, hy - 5 + dy, k === 'h' ? '#D9864A' : dy === 3 ? '#7A3A1C' : '#A8532A');
        }));
        if (m.left && m.p > .55 && Math.floor(t * 7) % 2) [[1, 6], [12, 6], [2, 7], [11, 7]].forEach(([x, y]) => sp(S, o.X(x), o.Y(y), SK));
        if (m.left === 4 && m.p < .25) for (let k = 0; k < 4; k++) spE(S, hx_ + [-3, 3, 0, 0][k], hy - 4 + [0, 0, -4, 3][k], frame % 2 ? '#FFFFFF' : GOLD);
        if (m.reach === 1) sp(S, o.X(7), o.Y(9) + Math.floor(m.p * 20) % 3, '#A8532A');
      }
      if (pose !== 'working') return;
      // Cloud hair and the cloud ring on his shoulders boil every frame.
      const puff = (x, y, k) => spE(S, x, y, hash(k * 7 + frame) > .4 ? '#FFFFFF' : '#D9CCF2');
      for (let k = 0; k < 14; k++) if (hash(k * 13 + frame) > .35) puff(o.X(k), o.Y(0) - 1 - (hash(k * 5 + frame) > .7 ? 1 : 0), k);
      for (let k = 0; k < 4; k++) { puff(o.X(-1), o.Y(1 + k), k); puff(o.X(14), o.Y(1 + k), k + 9); }
      for (const x of [2, 3, 10, 11]) puff(o.X(x), o.Y(8) - (hash(x + frame) > .5 ? 1 : 0), x);
      [4, 9].forEach(x => sp(S, o.X(x), o.Y(4), '#FF3B5C'));
      const g = gear5(t); if (g.punch === null) return;
      // The fist balloons out to the right, wrapped in haki lightning at full reach.
      const p = g.punch, f = ease((p - .15) / .25) * (1 - ease((p - .8) / .2)), sx = o.X(11), sy = o.Y(8), fx = sx + 2 + f * 9, fy = sy - f, r = 1 + f * 2.4;
      seg((x, y, c) => { sp(S, x, y, c); sp(S, x, y + 1, c); }, sx, sy, fx, fy, SK);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.hypot(dx, dy); if (d <= r) sp(S, fx + dx, fy + dy, d > r - 1 ? '#FFFFFF' : dx === Math.floor(r) - 1 && dy % 2 ? '#D9A07A' : SK); }
      if (f < .95) return;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + frame * .2, len = 2 + (frame + k) % 3; for (let q = r + 1; q <= r + len; q++) spE(S, fx + Math.cos(a) * q, fy + Math.sin(a) * q, k % 2 ? '#E9D5FF' : '#FFFFFF'); }
      for (let k = 0; k < 2; k++) bolt((x, y, c) => sp(S, x, y, c), fx, fy, fx + (hash(frame * 3 + k) - .5) * 10, fy + (hash(frame * 5 + k) - .5) * 10, frame * 2 + k, '#14061E', '#C084FC');
    },
    vpre(o) { o.mouth = 'grin'; },
  },
  zoro: {
    pre(o, pose, t) {
      if (pose === 'sleeping') o.armL = o.armR = 'cross';
      if (pose === 'idle') { const h = press(t), p = (t % 2.4) / 2.4; Object.assign(o, { armL: 'none', armR: 'none', look: 0, bob: p > .08 && p < .15 ? 1 : 0, mouth: h > .4 ? 'grin' : null }); }
      // Enma: bandana on, a sword in each hand and the third in his mouth.
      if (pose === 'working') Object.assign(o, { armL: 'out', armR: 'out', look: 1, recolor: { g: '#22222A', G: '#141418' } });
    },
    post(S, o, pose, t, frame) {
      if (pose !== 'working') { [[11, 10, '#EDEDED'], [12, 9, '#EDEDED'], [12, 10, '#B03A37'], [13, 9, '#B03A37'], [12, 11, '#4A4A56'], [13, 10, '#4A4A56']].forEach(([x, y, c]) => sp(S, o.X(x), o.Y(y), c)); }
      if (pose === 'idle') {
        // Overhead press: sleeve to the elbow, forearm to the grip, a plated bar across both hands.
        const h = press(t), by = Math.round(lerp(o.Y(8), 1, h)), ey = Math.round(lerp(o.Y(10), 5, h));
        for (const [sx, ex, gx] of [[3, 1, 0], [10, 12, 13]]) { sline(S, o.X(sx), o.Y(8), o.X(ex), ey, '#EDEDED'); sline(S, o.X(ex), ey, o.X(gx), by + 1, SK); }
        srect(S, o.X(-2), by, 18, 1, '#C8D0DA');
        for (const x of [o.X(-2), o.X(14)]) { srect(S, x, by - 1, 2, 3, '#3A3A48'); sp(S, x, by - 1, '#5A5A6A'); }
        if (h === 1) { const d = Math.floor((t % 2.4 - 1) * 8); if (d >= 0 && d < 4) sp(S, o.X(11), o.Y(3) + d, '#7FD4FF'); }
      }
      if (pose !== 'working') return;
      // Dark aura: violet-crimson flames lick up the silhouette; the eye burns red.
      for (const [x, y] of rim(S)) { const n = hash(x * 7 + Math.floor(y + t * 9) * 13 + frame * 3); if (n > .45) { sp(S, x, y, ENMA_AURA[Math.min(3, Math.floor((n - .45) / .55 * 4))]); if (n > .85) spE(S, x, y - 1, ENMA_AURA[0]); } }
      sp(S, o.X(8), o.Y(4), '#FF2A3A'); sp(S, o.X(8), o.Y(5), '#FF7A8A');
      for (let x = 3; x <= 13; x++) sp(S, o.X(x), o.Y(7), x < 6 ? '#F2F2F2' : x === 13 ? '#FFFFFF' : '#C8D0DA');
      const [lx, ly] = o.hands.L; for (let r = 1; r <= 4; r++) sp(S, lx - r * .5, ly - r, r === 4 ? '#FFFFFF' : '#C8D0DA');
      const [hx_, hy] = o.hands.R, p = (t % .8) / .8, a = p < .45 ? -1.3 + p / .45 * 2.2 : .9;
      if (p < .7) for (let k = 4; k >= 1; k--) { const b = a - k * .3; sp(S, hx_ + Math.cos(b) * 5, hy + Math.sin(b) * 5, mix('#FF4D6D', BG, k * .2)); sp(S, hx_ + Math.cos(b) * 4, hy + Math.sin(b) * 4, mix('#9A2A6A', BG, .2 + k * .2)); }
      for (let r = 1; r <= 5; r++) sp(S, hx_ + Math.cos(a) * r, hy + Math.sin(a) * r, r === 5 ? '#FFFFFF' : '#C8D0DA');
    },
    vpre(o) { o.mouth = null; },
    vpost(S, o) {
      for (let x = 1; x <= 12; x++) sp(S, o.X(x), o.Y(7), x === 6 || x === 7 ? '#EDEDED' : '#C8D0DA');
      Object.values(o.hands).forEach(([hx_, hy], i) => { for (let r = 1; r <= 4; r++) sp(S, hx_ + (i ? r * .4 : -r * .4), hy - r, r === 4 ? '#FFFFFF' : '#C8D0DA'); });
    },
  },
  nami: {
    pre(o, pose) { if (pose === 'idle' || pose === 'working') o.mouth = 'smile'; if (pose === 'working') { o.armR = 'up'; o.look = 1; } if (pose === 'idle') { o.armR = 'out'; o.look = 1; } },
    post(S, o, pose, t) {
      if (pose === 'idle') {
        // A pinwheel on a stick; gusts spin it faster and blow streaks past it.
        const w = pinwheel(t), [hx_, hy] = o.hands.R, cx = hx_ + 4, cy = hy - 5;
        sline(S, hx_, hy - 1, cx, cy, '#C9A86A');
        ['#FF8A3D', '#3A7BD5', '#FFD24A', '#FF87AF'].forEach((c, k) => { const b = w.a + k * Math.PI / 2; for (let r = 1; r <= 3; r++) for (let d = 0; d <= .8; d += .4) sp(S, cx + Math.cos(b + d * (4 - r) / 3) * r, cy + Math.sin(b + d * (4 - r) / 3) * r, c); });
        sp(S, cx, cy, '#FFFFFF');
        if (w.gust > 0) for (let k = 0; k < 3; k++) { const x = 15 + (t * 24 + k * 4) % 11, y = 2 + k * 4; for (let q = 0; q < 1 + w.gust * 3; q++) spE(S, x - q, y, mix('#B8F0FF', BG, q / 4)); }
        return;
      }
      if (pose !== 'working') return;
      // Clima-Tact raised to Zeus; each strike burns the next point of the route onto her map.
      const z = zeus(t), [hx_, hy] = o.hands.R;
      for (let k = 1; k <= 4; k++) sp(S, hx_, hy - k, '#3A7BD5');
      sp(S, hx_, hy - 5, z.flash ? '#FFFFFF' : '#FFE14D');
      srect(S, 17, 7, 7, 1, '#C9A86A'); srect(S, 17, 8, 7, 6, '#EBD9AE'); srect(S, 17, 14, 7, 1, '#C9A86A');
      [[18, 9], [19, 9], [18, 10], [22, 12], [22, 13], [21, 13]].forEach(([x, y]) => sp(S, x, y, '#8DBF6A'));
      const n = Math.min(z.step, ROUTE.length);
      ROUTE.slice(0, n).forEach(([x, y]) => sp(S, x, y, '#C0392B'));
      if (z.step > ROUTE.length) sp(S, ...ROUTE.at(-1), Math.floor(t * 6) % 2 ? '#FF3030' : '#FFFFFF');
      // Zeus: a thundercloud with a face, darkening just before it strikes.
      const cx = 14, cy = Math.round(Math.sin(t * 2.2) * .6), dark = !z.flash && (t * 3) % 1 > .75;
      ZEUS.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') spE(S, cx + x, cy + y, k === 'w' ? (dark ? '#8A93AD' : '#EEF2FA') : (dark ? '#5A6380' : '#A6B0C8')); }));
      [[4, 2], [7, 2]].forEach(([x, y]) => sp(S, cx + x, cy + y, z.flash ? '#FFE14D' : '#2A2A3A'));
      sp(S, cx + 5, cy + 3, '#2A2A3A'); sp(S, cx + 6, cy + 3, '#2A2A3A');
      if (z.flash && n) { const [x, y] = ROUTE[n - 1]; bolt((a, b, c) => sp(S, a, b, c), cx + 6, cy + 5, x, y - 1, Math.floor(t * 3), '#FFF6B0', '#7FE6FF'); }
    },
    vpost(S, o, tau) { for (let k = 0; k < 2; k++) { const p = ((tau * .8 + k * .5) % 1); spE(S, o.X(-1 + k * 15), o.Y(0) + 8 - Math.floor(p * 9), p < .8 ? GOLD : '#FFF1A8'); } },
  },
  sanji: {
    // Ifrit Jambe: hands in his pockets, the right leg kicks in a blue-flame arc.
    pre(o, pose) {
      if (pose === 'idle') Object.assign(o, { look: 1, armL: 'none', armR: 'out' });
      if (pose === 'working') Object.assign(o, { look: 1, armL: 'none', armR: 'none', map: KICK });
    },
    post(S, o, pose, t, frame) {
      if (pose !== 'offline') {
        sp(S, o.X(9), o.Y(7), '#F5F5F5'); sp(S, o.X(10), o.Y(7), '#F5F5F5'); sp(S, o.X(11), o.Y(7), frame % 4 < 2 ? '#FF7A2A' : '#FFB347');
        for (let k = 0; k < 2; k++) { const p = (t * .6 + k * .5) % 1; spE(S, o.X(11) + Math.round(Math.sin(p * 6 + k * 2)), o.Y(7) - 1 - Math.floor(p * 6), mix('#C8C0D0', BG, p)); }
      }
      if (pose === 'idle') {
        // A pan over a small flame; every 2.2s the steak flips up end over end and lands back with a sizzle.
        const p = (t % 2.2) / 2.2, [hx_, hy] = o.hands.R, py = hy - (p < .1 ? 1 : 0), air = p > .05 && p < .6, s = (p - .05) / .55;
        sline(S, hx_ + 1, hy, hx_ + 3, py, '#2A2A33');
        srect(S, hx_ + 4, py, 6, 1, '#5A5A6A'); srect(S, hx_ + 5, py + 1, 4, 1, '#2A2A33');
        sp(S, hx_ + 6, py + 2, frame % 2 ? '#FF7A2A' : '#FFB347'); sp(S, hx_ + 7, py + 2, frame % 2 ? '#FFB347' : '#FF7A2A');
        const fx = hx_ + 6, fy = air ? Math.round(py - 1 - 24 * s * (1 - s)) : py - 1, side = air && Math.floor(s * 6) % 2;
        if (side) { sp(S, fx + 1, fy - 1, '#8B4A2B'); sp(S, fx + 1, fy, '#E8C8A0'); }
        else { srect(S, fx, fy, 3, 1, '#8B4A2B'); sp(S, fx + (air ? 0 : 2), fy, '#E8C8A0'); }
        if (!air) for (let k = 0; k < 2; k++) { const q = (t * .9 + k * .5) % 1; spE(S, fx + k * 2 + Math.round(Math.sin(q * 6 + k)), py - 2 - Math.floor(q * 5), mix('#E8E4F0', BG, q)); }
        if (p > .6 && p < .75) for (let k = 0; k < 3; k++) if (hash(k * 7 + frame) > .4) spE(S, hx_ + 4 + hash(k * 11 + frame) * 6, py - 1 - hash(k * 13 + frame) * 2, GOLD);
      }
      if (pose !== 'working') return;
      // Wind up behind, sweep through to a high kick, hold, come back down; angles in radians, down = pi/2.
      const leg = q => q < .3 ? lerp(1.57, 2.2, q / .3) : q < .45 ? lerp(2.2, -.6, (q - .3) / .15) : q < .75 ? -.6 : lerp(-.6, 1.57, (q - .75) / .25);
      const p = (t % .9) / .9, a = leg(p), hx_ = o.X(9), hy = o.Y(11);
      for (let k = 1; k <= 5; k++) { const b = leg(Math.max(0, p - k * .03)); if (Math.abs(b - a) > .05) for (let r = 3; r <= 5; r++) spE(S, hx_ + Math.cos(b) * r, hy + Math.sin(b) * r, BLUE[Math.max(1, 5 - k)]); }
      for (let r = 1; r <= 5; r++) sp(S, hx_ + Math.cos(a) * r, hy + Math.sin(a) * r, r === 5 ? '#3A2A20' : '#22222C');
      for (let r = 1; r <= 5; r++) for (let h = 1; h <= 3; h++) { const n = hash(r * 11 + h * 7 + frame); if (n > .3 + h * .15) spE(S, hx_ + Math.cos(a) * r + (n - .5), hy + Math.sin(a) * r - h, BLUE[Math.min(5, 5 - h + Math.floor(n * 2))]); }
      if (p > .42 && p < .6) { const fx = hx_ + Math.cos(a) * 6, fy = hy + Math.sin(a) * 6; for (let k = 0; k < 8; k++) { const b = k * Math.PI / 4; for (let q = 1; q <= 2 + frame % 2; q++) spE(S, fx + Math.cos(b) * q, fy + Math.sin(b) * q, q > 1 ? BLUE[3] : '#FFFFFF'); } }
    },
    vpre(o) { o.eyes = 'heart'; },
  },
  buggy: {
    pre(o, pose, t) {
      if (pose !== 'sleeping' && pose !== 'offline' && pose !== 'alert') o.mouth = 'smile';
      // Bara Bara juggling: his hands float off to juggle, and every 7s his head pops off with a grin.
      if (pose === 'idle') Object.assign(o, { armL: 'none', armR: 'none', look: 1, ...(t % 7 > 5.8 ? { lift: 1 + o.bob, mouth: 'grin', eyes: 'happy' } : {}) });
      if (pose !== 'working') return;
      // Bara Bara bug hunt with his hands flying loose, then the Cross Guild assembles behind him.
      const g = guild(t);
      if (g.hunt) Object.assign(o, { armL: 'none', armR: 'none', lift: Math.floor(t * 3) % 2, look: 1 });
      else Object.assign(o, { ox: 2 + Math.round(5 * ease(g.in)), armL: 'up', armR: 'up', mouth: 'grin', eyes: g.pose !== undefined && Math.floor(t * 4) % 2 ? 'happy' : 'open' });
    },
    under(S, o, pose, t, frame) {
      if (pose !== 'working') return;
      const g = guild(t); if (g.hunt) return;
      const k = ease(g.in), seen = (x, y) => !g.out || hash(x * 7 + y * 13 + 5) < g.in, mx = Math.round(-9 + 10 * k), cx = Math.round(26 - 9 * k);
      officer(S, GUILD.mihawk, mx, 0, seen);
      officer(S, GUILD.crocodile, cx, 0, seen);
      if (g.out) return;
      // Yoru raised at Mihawk's side with a green glint running up the blade; Crocodile lifts his hook in a sand swirl.
      const glint = g.pose === undefined ? -1 : 8 - Math.floor(g.pose * 18) % 9;
      for (let y = 0; y <= 8; y++) sp(S, mx, y, y === glint ? '#9FE8B0' : y === 0 ? '#3A3A48' : '#121218');
      srect(S, mx - 1, 9, 3, 1, '#C9A227'); sp(S, mx, 10, '#3A2A20'); sp(S, mx, 11, '#3A2A20');
      [[8, 8], [8, 7], [8, 6], [7, 5]].forEach(([x, y]) => sp(S, cx + x, y, '#E8B830'));
      sp(S, cx + 6, 4, '#8B5E3C'); sp(S, cx + 7, 4, frame % 4 < 2 ? '#FF7A2A' : '#FFB347');
      if (g.pose !== undefined) for (let q = 0; q < 10; q++) { const a = t * 4 + q * .63; sp(S, cx + 4 + Math.cos(a) * 6, 8 + Math.sin(a) * 3 - q * .2, q % 2 ? '#D9B26A' : '#B8924A'); }
    },
    post(S, o, pose, t, frame) {
      if (pose === 'idle') {
        const W = '#F5F5F5', c = '#C62828', hands = [[17, 12], [23, 12]];
        sp(S, o.X(3), o.Y(9), c); sp(S, o.X(10), o.Y(9), c);
        [GOLD, '#E53935', '#4FA3E0'].forEach((col, i) => {
          const b = cascade(t, i), [x0, y0] = hands[b.from ?? b.hand], [x1] = hands[1 - (b.from ?? b.hand)];
          const [x, y] = b.hand === undefined ? [lerp(x0, x1, b.s), y0 - 2 - 36 * b.s * (1 - b.s)] : [x0, y0 - 2];
          srect(S, Math.round(x), Math.round(y), 2, 2, col); sp(S, Math.round(x), Math.round(y), '#FFFFFF');
        });
        hands.forEach(([x, y], k) => { const dip = Math.floor(t / BEAT + k) % 2; srect(S, x, y + dip, 2, 1, W); srect(S, x, y + 1 + dip, 2, 1, c); });
        return;
      }
      if (pose !== 'working') return;
      const g = guild(t), W = '#F5F5F5', c = '#C62828';
      if (!g.hunt) {
        if (roll(g)) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; for (let q = 6; q <= 9; q++) spE(S, 13 + Math.cos(a) * q * 1.4, 7 + Math.sin(a) * q * .8, q % 2 ? GOLD : '#FFFFFF'); }
        return;
      }
      sp(S, o.X(3), o.Y(9), c); sp(S, o.X(10), o.Y(9), c);
      const [bx, by] = bugAt(t); bug(S, bx, by, frame);
      [[bx - 2 + Math.round(Math.sin(t * 9)), by + 2], [bx + 2, by - 1 + Math.round(Math.cos(t * 8))]].forEach(([x, y]) => { sp(S, x, y, W); sp(S, x, y + 1, c); });
    },
  },
};
// Sanji's body with the right leg left off, so the kick can draw it at any angle.
const KICK = CHARS.designer.map.map((row, y) => y >= 11 ? row.slice(0, 8) + '......' : row);

// 26x16 px = 26 columns x 8 rows; the right side leaves room for props and signature moves.
function charSprite(C, pose, t, frame) {
  const S = sbuf(26, 16), off = pose === 'offline', blink = (t % 3.7) < .16, fx = CFX[C.id] || {};
  const o = { ox: 2, oy: 1, ground: 15, eyes: 'open', look: 0, armL: C.rest?.[0] || 'down', armR: C.rest?.[1] || 'down', mouth: null };
  if (pose === 'idle') { o.bob = Math.floor(t * 1.6) % 2; o.eyes = blink ? 'blink' : 'open'; o.look = [0, 0, 1, 0, -1, 0][Math.floor(t / 1.3) % 6]; }
  if (pose === 'sleeping') { o.bob = 1; o.lift = -(Math.floor(t * .8) % 2); o.eyes = 'sleep'; }
  if (pose === 'alert') { o.oy = 1 - [0, 0, 1, 1, 1, 1, 0, 0][Math.floor(t * 10) % 8]; const f = Math.floor(t * 5) % 2; o.armL = f ? 'up' : 'wave'; o.armR = f ? 'wave' : 'up'; o.mouth = 'o'; }
  if (off) o.eyes = 'sleep';
  fx.pre?.(o, pose, t, frame);
  fx.under?.(S, o, pose, t, frame);
  drawChar(S, C, o);
  fx.post?.(S, o, pose, t, frame);
  if (pose === 'alert') alertMark(S, t);
  if (off) S.p = S.p.map((c, i) => !c || ((i % S.w) * 3 + Math.floor(i / S.w)) % 4 === 0 ? null : gray(c));
  return S;
}

// Harness poses map onto the drawn ones: an error stops the role like an alert, a quiet pane rests until it moves again.
const DRAWN = { error: 'alert', quiet: 'idle' };
export function sprite(role, pose, t, frame) {
  pose = DRAWN[pose] ?? pose;
  return charSprite(CHARS[role], pose, t, frame);
}

// Cheering pose for the story-complete scene: arms (up, wave, hip, out); 20x18 px.
export function cheer(role, { arms = ['up', 'up'], tau = 0 } = {}) {
  const S = sbuf(20, 18);
  const C = CHARS[role], fx = CFX[C.id] || {}, o = { ox: 2, oy: 3, noShadow: true, eyes: 'happy', mouth: 'smile', armL: arms[0], armR: arms[1] };
  fx.vpre?.(o);
  drawChar(S, C, o);
  fx.vpost?.(S, o, tau, Math.floor(tau * 12));
  return S;
}

// ---------------- working auras ----------------
// While a role works its whole card turns into the character's signature move: a tinted card, its own border,
// effects across the card (field: behind the sprite, over: in front of it), the status ink and the move's name.
// right is the last column effects may use, so the reply bubble stays clear.
const inside = (G, right) => (x, y, c) => { if (x >= 1 && x <= right && y >= 2 && y <= G.h * 2 - 3) px(G, x, y, c); };
const AURA = {
  brook: {
    move: () => '소울 킹 · 영혼의 선율', tint: () => ['#123224', '#0A201A'], ink: ['#72DF42', '#B6FF58', '#D9FF9B', '#E8FFD0'],
    edge: (t, tick) => (at, per) => hash(at * 31 + tick * 17) > .92 ? '#E8FFD0' : mix('#268C50', '#B6FF58', .5 + .5 * Math.sin(at / per * Math.PI * 6 - t * 6)),
    field(G, t, tick, right) {
      const plot = inside(G, right), floor = G.h * 2 - 3;
      for (let k = 0; k < 7; k++) {
        const x = 2 + k * (right - 3) / 6;
        for (let y = 3; y <= floor; y++) if ((y + k + tick) % 5 !== 0) plot(x + Math.sin(y * .5 - t * 4 + k) * 1.5, y, y % 4 ? '#268C50' : '#72DF42');
        const p = (t * .8 + hash(k * 7)) % 1; plot(x, floor - p * (floor - 2), '#E8FFD0');
      }
    },
  },
  luffy: {
    move: () => '기어 5 · 니카', tint: () => ['#2A1240', '#150A22'], ink: ['#A855F7', '#C084FC', '#E9D5FF', '#FFFFFF'],
    // Haoshoku: a dark violet ring where lightning crackles in short bright runs.
    edge: (t, tick) => (at, per) => {
      const f = hash(at * 31 + tick * 17);
      if (hash(Math.floor(at / 5) * 17 + Math.floor(tick / 2) * 131) > .8) return f > .5 ? '#FFFFFF' : f > .2 ? '#E9D5FF' : '#FF4D8D';
      return HAKI[Math.min(3, Math.floor((.5 + .5 * Math.sin(2 * Math.PI * (2 * at / per - t / 2))) * 2.5 + f * 1.5))];
    },
    // Black lightning arcing in from the card's edges, a few bolts at a time.
    field(G, t, tick, right) {
      if (tick % 3 === 2) return;
      const plot = inside(G, right);
      for (let k = 0; k < 3; k++) {
        const seed = Math.floor(tick / 3) * 3 + k; if (hash(seed * 7 + 1) > .6) continue;
        const top = hash(seed * 11) > .5, x0 = 1 + hash(seed * 13) * (right - 1), y0 = top ? 2 : G.h * 2 - 3;
        bolt(plot, x0, y0, x0 + (hash(seed * 17) - .5) * 18, y0 + (top ? 1 : -1) * (5 + hash(seed * 19) * 8), seed, '#0B0412', k % 2 ? '#FF4D8D' : '#B24DFF');
      }
    },
  },
  zoro: {
    move: () => '삼도류 · 염왕', tint: t => enma(t).cut !== null && enma(t).cut < .3 ? ['#3A0A1E', '#1E0610'] : ['#170810', '#0B0508'], ink: ['#7A1846', '#B3204F', '#E0607A', '#FFD0DA'],
    // Smouldering near-black ring with crimson embers; the cut flashes it white.
    edge: (t, tick) => { const cut = enma(t).cut; return (at, per) => {
      if (cut !== null && cut < .25) return hash(at + tick) > .3 ? '#FFE0E8' : '#FF4D6D';
      const f = hash(at * 31 + Math.floor(tick / 2) * 17), w = .5 + .5 * Math.sin(2 * Math.PI * (2 * at / per + t / 4));
      return f > .97 ? '#FF4D6D' : ENMA[Math.min(4, Math.floor(w * w * 3 + f * 1.8))];
    }; },
    field(G, t, tick, right) { const plot = inside(G, right); for (let k = 0; k < 7; k++) { const life = (t * .7 + hash(k * 3)) % 1; plot(2 + hash(k * 7) * 25 + Math.sin(t * 2 + k) * 1.5, 17 - life * 15, mix(k % 2 ? '#B3204F' : '#7A1846', '#170810', life)); } },
    // The cut runs corner to corner in a blink, then cools to a dark scar.
    over(G, t, tick, right) {
      const cut = enma(t).cut; if (cut === null) return;
      const plot = inside(G, right), reach = Math.min(1, cut / .15), cool = ease((cut - .15) / .85);
      for (let f = 0; f <= reach; f += .5 / right) { const x = 1 + f * (right - 1), y = 17 - f * 15; plot(x, y - 1, mix('#FF3B5C', '#170810', cool)); plot(x, y + 1, mix('#5A1030', '#170810', cool)); plot(x, y, mix('#FFFFFF', '#3D0D2E', cool)); }
    },
  },
  sanji: {
    move: () => '이프리트 잠브', tint: () => ['#0A1638', '#081028'], ink: ['#2F8BFF', '#5CC8FF', '#B8F0FF', '#FFFFFF'],
    edge: (t, tick) => (at, per) => { const w = .5 + .5 * Math.sin(2 * Math.PI * (3 * at / per - t / 1.6)), f = hash(at * 31 + tick * 17); return BLUE[f > .95 ? 5 : Math.min(5, Math.floor((w * w * .7 + f * .4) * 6))]; },
    // Blue flames along the bottom of the card, sparks drifting up.
    field(G, t, tick, right) {
      const plot = inside(G, right), floor = G.h * 2 - 3;
      for (let x = 1; x <= right; x++) { const h = Math.floor((.5 + .5 * Math.sin(x * .8 + t * 7)) * 2.5 + hash(x * 7 + tick) * 3); for (let d = 0; d <= h; d++) plot(x, floor - d, BLUE[Math.max(1, 4 - Math.floor(d / Math.max(1, h) * 3))]); }
      for (let k = 0; k < 6; k++) { const life = (t * .9 + hash(k * 5)) % 1; plot(1 + hash(k * 11) * (right - 1), floor - 4 - life * 9, mix('#8FE3FF', '#0A1638', life)); }
    },
  },
  nami: {
    move: () => '제우스 브리즈 템포', tint: t => zeus(t).flash ? ['#3A4775', '#26305A'] : ['#101A33', '#0B1226'], ink: ['#7FE6FF', '#B8F4FF', '#FFE14D', '#FFFBD0'],
    // Storm: a slate ring with sparks racing round it; a strike lights all of it.
    edge: (t, tick) => { const flash = zeus(t).flash; return (at, per) => {
      if (flash) return hash(at * 7 + tick) > .3 ? '#FFF6B0' : '#FFFFFF';
      const d = Math.min(...[0, 1, 2].map(k => { const e = Math.abs(at - (k * per / 3 + t * per * .6) % per); return Math.min(e, per - e); }));
      return d < 1 ? '#FFFFFF' : d < 3 ? '#FFE14D' : d < 6 ? '#7FE6FF' : hash(at * 31 + Math.floor(tick / 2)) > .9 ? '#5A6FB0' : '#2E3A60';
    }; },
    // Slanted rain over the card.
    field(G, t, tick, right) { const plot = inside(G, right); for (let k = 0; k < 12; k++) { const y = 2 + (hash(k * 3) * 16 + t * 22) % 16, x = 1 + (hash(k * 7) * right - (y - 2) * .5 + right) % right; plot(x, y, '#3D5A8C'); plot(x + 1, y - 1, '#2A3F66'); } },
  },
  buggy: {
    move: t => guild(t).hunt ? '바라바라 페스티벌' : 'CROSS GUILD 집합!', tint: t => roll(guild(t)) ? ['#5A4012', '#3A2A0C'] : ['#240D12', '#160A0C'], ink: ['#E53935', '#FF8A3D', '#FFD24A', '#FFF4D6'],
    // Circus marquee: bulbs chase round the frame, racing gold and white while the guild is out.
    edge: (t, tick) => { const g = guild(t), live = !g.hunt; return at => {
      if (roll(g)) return '#FFFFFF';
      const k = ((at + Math.floor(t * (live ? 14 : 5))) % 4 + 4) % 4;
      return k === 0 ? '#FFE066' : k === 2 ? (live ? '#FFFFFF' : '#FF4D4D') : '#7A1020';
    }; },
    // Confetti while the guild poses.
    field(G, t, tick, right) { const g = guild(t); if (g.hunt) return; const plot = inside(G, right); for (let k = 0; k < 16; k++) plot(1 + hash(k * 7) * (right - 1) + Math.sin(t * 3 + k), 2 + (hash(k * 13) * 16 + t * (6 + hash(k) * 6)) % 16, [GOLD, '#FFFFFF', '#E53935', '#FF8A3D'][k % 4]); },
  },
};
export const aura = role => AURA[CHARS[role]?.id] ?? null;

// Text particles between the sprite and the status column (x is the card's left edge). They never cover pixels.
export function particles(G, role, pose, x, y, t) {
  if (pose === 'quiet') { tput(G, x + 24, y + 2, '…?', '#B9AFC2'); return; }
  if (pose === 'sleeping') { for (let k = 0; k < 2; k++) { const p = ((t * .9 + k * .75) % 1.5) / 1.5; tput(G, x + 23 + k, y + 4 - Math.floor(p * 3), k ? 'Z' : 'z', mix('#B9AFC2', BG, p)); } }
}

// ---------------- pixel font ----------------
const F5 = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'], C: ['.###', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '###.'], E: ['####', '#...', '###.', '#...', '####'],
  L: ['#...', '#...', '#...', '#...', '####'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'], S: ['.###', '#...', '.##.', '...#', '###.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'], '!': ['#', '#', '#', '.', '#'],
};
export const pxWidth = s => [...s].reduce((n, c) => n + (F5[c] ? F5[c][0].length : 2) + 1, 0) - 1;
// 5-pixel text at half-row hy; dy(i) offsets a letter (null hides it), color may vary per letter.
export function pxText(G, s, x, hy, color, { shadow, dy } = {}) {
  let cx = x;
  [...s].forEach((c, i) => {
    const gl = F5[c]; if (!gl) { cx += 3; return; }
    const d = dy ? dy(i) : 0;
    if (d !== null) {
      if (shadow) gl.forEach((row, gy) => [...row].forEach((p, gx) => { if (p === '#') px(G, cx + gx + 1, hy + gy + 1 + d, shadow); }));
      gl.forEach((row, gy) => [...row].forEach((p, gx) => { if (p === '#') px(G, cx + gx, hy + gy + d, typeof color === 'function' ? color(i) : color); }));
    }
    cx += gl[0].length + 1;
  });
}
