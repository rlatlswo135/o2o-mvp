// Pixel characters for the console: one terminal cell holds two pixels (upper and lower half block).
// Decoration only: a moving sprite is never evidence that a model is generating.
import { clean, columns } from './terminal.mjs';

export const BG = '#120E14';
export const ROLE_COLOR = { planner: '#FFAF5F', executor: '#87D7FF', reviewer: '#AFD787', designer: '#FF87AF', qa: '#AF87FF' };
export const FIRE = ['#7A1712', '#C62D1F', '#FF6A13', '#FFA51F', '#FFE066', '#FFF4D6'];
export const GOLD = '#FFD24A';

const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export function hsl(h, s, l) { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return toHex([f(0) * 255, f(8) * 255, f(4) * 255]); }
export const hash = v => (Math.imul(v | 0, 2654435761) >>> 0) / 4294967296;

// ---------------- cell grid ----------------
// Text cells and pixel cells share one grid; a pixel drawn over text clears it. clip limits pixels to a region.
export function grid(w, h) { return { w, h, clip: null, cells: Array.from({ length: w * h }, () => ({ ch: ' ', fg: null, bg: null, bold: false, top: null, bottom: null })) }; }
export function put(G, x, y, text, fg = null, bg = null, bold = false) {
  for (const c of clean(text)) {
    const w = columns(c);
    if (!w) continue;
    if (y >= 0 && y < G.h && x >= 0 && x + w <= G.w) {
      Object.assign(G.cells[y * G.w + x], { ch: c, fg, bg, bold, top: null, bottom: null });
      if (w === 2) Object.assign(G.cells[y * G.w + x + 1], { ch: '', fg, bg, bold, top: null, bottom: null });
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
const gray = c => { const [r, g, b] = hx(c), l = .3 * r + .59 * g + .11 * b; return mix(toHex([l, l, l]), BG, .35); };
const alertMark = (S, t) => { srect(S, 18, 0, 4, 5, '#D9534F'); sp(S, 18, 5, '#D9534F'); srect(S, 19, 1, 2, 2, '#FFFFFF'); srect(S, 19, 4, 2, 1, '#FFFFFF'); if (Math.floor(t * 4) % 2) srect(S, 18, 0, 4, 1, '#FF8A80'); };

// Role palette for the text particles.
const PAL = {};
function pal(role, off) { const k = off ? 'off' : role; if (PAL[k]) return PAL[k]; const m = off ? '#6B6470' : ROLE_COLOR[role]; return PAL[k] = { main: m, light: mix(m, '#FFFFFF', .45), dark: mix(m, '#000000', .35), deep: mix(m, '#000000', .6) }; }
// ---------------- characters ----------------
// Body maps are 14x14; each letter is a palette key, '.' is empty. Eyes, mouth, arms and props are drawn on top.
// Fan-art characters for a private repository; without color the console falls back to the box art.
const SK = '#F6C9A0';
const CHARS = {
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
  qa: { id: 'buggy', name: '버기', line: '화려하게 가자!', arm: ['c', 'c'], hand: 'W', lid: 'f', mouth: [5, 7, 4, '#E53935'],
    P: { h: '#2B2F5A', w: '#FFFFFF', B: '#3F6BC4', f: '#F4EEE8', R: '#E53935', c: '#E8762B', y: '#FFD24A', p: '#6A4C9C', n: '#3A2A20', W: '#F5F5F5' },
    map: ['...hhhhhhhh...', '..hhhhwwhhhh..', '.hhhhhhhhhhhh.', '.BBffffffffBB.', 'BBBffffffffBBB', '.BBfffRRfffBB.', '...fffRRfff...', '....ffffff....', '....cccccc....', '....cyyyyc....', '....cccccc....', '....pp..pp....', '....pp..pp....', '...nn....nn...'] },
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
  for (let y = C.map.length - 1; y >= 0; y--) [...C.map[y]].forEach((k, x) => { if (k !== '.') sp(S, X(x), Y(y), col(k)); });
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

// Per-character tweaks: pre sets pose fields before the body is drawn, post adds props; vpre/vpost do the same for the cheering pose.
const CFX = {
  luffy: {
    pre(o, pose) { if (pose === 'idle' || pose === 'working') { o.armL = o.armR = 'hip'; o.mouth = 'grin'; } if (pose === 'working') { o.armR = 'none'; o.look = 1; } },
    post(S, o, pose, t, frame) {
      if (pose === 'sleeping') { // snot bubble
        const r = Math.floor(t * 1.4) % 4, bx = o.X(8), by = o.Y(6) + 1, C = '#A8DCFF';
        if (r === 1) sp(S, bx, by, C);
        if (r >= 2) { srect(S, bx, by - 1, r, r, C); sp(S, bx, by - 1, '#FFFFFF'); }
      }
      if (pose !== 'working') return;
      srect(S, 15, 14, 7, 1, '#2E3240'); for (let x = 15; x < 22; x += 2) sp(S, x, 14, '#5A6070');
      const fist = k => [17 + Math.floor(hash(k * 7) * 3), 9 + Math.floor(hash(k * 13) * 4)];
      for (let gh = 2; gh >= 1; gh--) { const [fx, fy] = fist(frame - gh); srect(S, fx, fy, 2, 2, mix(SK, BG, .25 + gh * .2)); }
      const [fx, fy] = fist(frame); sline(S, o.X(11), o.Y(8), fx - 1, fy, SK); srect(S, fx, fy, 2, 2, SK); sp(S, fx + 1, fy + 1, '#D9A07A');
      sp(S, 15 + Math.floor(hash(frame * 3) * 7), 14, '#E6FBFF');
    },
    vpre(o) { o.mouth = 'grin'; },
  },
  zoro: {
    pre(o, pose) { if (pose === 'idle' || pose === 'sleeping') o.armL = o.armR = 'cross'; if (pose === 'working') { o.armR = 'out'; o.look = 1; o.recolor = { g: '#2A2A33', G: '#1A1A20' }; } },
    post(S, o, pose, t) {
      [[11, 10, '#EDEDED'], [12, 9, '#EDEDED'], [12, 10, '#B03A37'], [13, 9, '#B03A37'], [12, 11, '#4A4A56'], [13, 10, '#4A4A56']].forEach(([x, y, c]) => sp(S, o.X(x), o.Y(y), c));
      if (pose !== 'working') return;
      const [hx_, hy] = o.hands.R, p = (t % .8) / .8, a = p < .45 ? -1.3 + p / .45 * 2.2 : .9;
      if (p < .7) for (let k = 4; k >= 1; k--) { const b = a - k * .3; sp(S, hx_ + Math.cos(b) * 5, hy + Math.sin(b) * 5, mix('#FFFFFF', BG, k * .2)); sp(S, hx_ + Math.cos(b) * 4, hy + Math.sin(b) * 4, mix('#FFFFFF', BG, .2 + k * .2)); }
      for (let r = 1; r <= 5; r++) sp(S, hx_ + Math.cos(a) * r, hy + Math.sin(a) * r, r === 5 ? '#FFFFFF' : '#C8D0DA');
    },
    vpre(o) { o.mouth = null; },
    vpost(S, o) {
      for (let x = 1; x <= 12; x++) sp(S, o.X(x), o.Y(7), x === 6 || x === 7 ? '#EDEDED' : '#C8D0DA');
      Object.values(o.hands).forEach(([hx_, hy], i) => { for (let r = 1; r <= 4; r++) sp(S, hx_ + (i ? r * .4 : -r * .4), hy - r, r === 4 ? '#FFFFFF' : '#C8D0DA'); });
    },
  },
  nami: {
    pre(o, pose) { if (pose === 'idle' || pose === 'working') o.mouth = 'smile'; if (pose === 'working') { o.armR = 'out'; o.look = 1; } },
    post(S, o, pose, t) {
      if (pose !== 'working') return;
      srect(S, 16, 3, 6, 1, '#C9A86A'); srect(S, 16, 4, 6, 8, '#EBD9AE'); srect(S, 16, 12, 6, 1, '#C9A86A');
      [[17, 5], [18, 5], [17, 6], [20, 10], [21, 10], [21, 9]].forEach(([x, y]) => sp(S, x, y, '#8DBF6A'));
      const R = [[17, 11], [18, 11], [18, 10], [19, 9], [19, 8], [20, 7], [20, 6], [21, 5]], n = Math.floor(t * 3) % (R.length + 5);
      R.slice(0, n).forEach(([x, y]) => sp(S, x, y, '#C0392B'));
      if (n > R.length) sp(S, 21, 5, Math.floor(t * 6) % 2 ? '#FF3030' : '#FFFFFF');
      else if (n) { const [x, y] = R[n - 1]; sp(S, x - 1, y + 1, '#3A2A20'); }
    },
    vpost(S, o, tau) { for (let k = 0; k < 2; k++) { const p = ((tau * .8 + k * .5) % 1); spE(S, o.X(-1 + k * 15), o.Y(0) + 8 - Math.floor(p * 9), p < .8 ? GOLD : '#FFF1A8'); } },
  },
  sanji: {
    pre(o, pose, t) { if (pose === 'working') { o.armR = Math.floor(t * 4) % 2 ? 'out' : 'wave'; o.look = 1; } },
    post(S, o, pose, t, frame) {
      if (pose !== 'offline') {
        sp(S, o.X(9), o.Y(7), '#F5F5F5'); sp(S, o.X(10), o.Y(7), '#F5F5F5'); sp(S, o.X(11), o.Y(7), frame % 4 < 2 ? '#FF7A2A' : '#FFB347');
        for (let k = 0; k < 2; k++) { const p = (t * .6 + k * .5) % 1; spE(S, o.X(11) + Math.round(Math.sin(p * 6 + k * 2)), o.Y(7) - 1 - Math.floor(p * 6), mix('#C8C0D0', BG, p)); }
      }
      if (pose !== 'working') return;
      srect(S, 16, 12, 5, 1, '#F4F0EA'); srect(S, 15, 13, 7, 1, '#BDB6AC');
      const F = [[17, 11], [18, 11], [19, 11], [18, 10], [17, 10], [19, 10], [18, 9]], FC = ['#E25B45', '#F2C14E', '#7FB069', '#E8A0BF', '#F28C28', '#9BC1BC', '#FFFFFF'];
      const n = Math.floor(t * 2.2) % (F.length + 4);
      F.slice(0, n).forEach(([x, y], k) => sp(S, x, y, FC[k]));
      if (n > F.length && Math.floor(t * 6) % 2) { sp(S, 20, 8, '#FFF6C2'); sp(S, 16, 9, '#FFF6C2'); }
    },
    vpre(o) { o.eyes = 'heart'; },
  },
  buggy: {
    pre(o, pose, t) { if (pose !== 'sleeping' && pose !== 'offline' && pose !== 'alert') o.mouth = 'smile'; if (pose === 'working') { o.armL = o.armR = 'none'; o.lift = Math.floor(t * 3) % 2; o.look = 1; } },
    post(S, o, pose, t, frame) {
      if (pose !== 'working') return;
      const W = '#F5F5F5', c = '#E8762B', cyc = t % 3;
      sp(S, o.X(3), o.Y(8), c); sp(S, o.X(10), o.Y(8), c);
      if (cyc > 2.3) { sp(S, 18, 6, W); sp(S, 20, 6, W); sp(S, 19, 6, '#7CFC6A'); sp(S, 18, 7, c); sp(S, 20, 7, c); return; }
      const [bx, by] = bugAt(t); bug(S, bx, by, frame);
      [[bx - 2 + Math.round(Math.sin(t * 9)), by + 2], [bx + 2, by - 1 + Math.round(Math.cos(t * 8))]].forEach(([x, y]) => { sp(S, x, y, W); sp(S, x, y + 1, c); });
    },
  },
};

// 22x16 px = 22 columns x 8 rows.
function charSprite(C, pose, t, frame) {
  const S = sbuf(22, 16), off = pose === 'offline', blink = (t % 3.7) < .16, fx = CFX[C.id] || {};
  const o = { ox: 2, oy: 1, ground: 15, eyes: 'open', look: 0, armL: C.rest?.[0] || 'down', armR: C.rest?.[1] || 'down', mouth: null };
  if (pose === 'idle') { o.bob = Math.floor(t * 1.6) % 2; o.eyes = blink ? 'blink' : 'open'; o.look = [0, 0, 1, 0, -1, 0][Math.floor(t / 1.3) % 6]; }
  if (pose === 'sleeping') { o.bob = 1; o.lift = -(Math.floor(t * .8) % 2); o.eyes = 'sleep'; }
  if (pose === 'alert') { o.oy = 1 - [0, 0, 1, 1, 1, 1, 0, 0][Math.floor(t * 10) % 8]; const f = Math.floor(t * 5) % 2; o.armL = f ? 'up' : 'wave'; o.armR = f ? 'wave' : 'up'; o.mouth = 'o'; }
  if (off) o.eyes = 'sleep';
  fx.pre?.(o, pose, t, frame);
  drawChar(S, C, o);
  fx.post?.(S, o, pose, t, frame);
  if (pose === 'alert') alertMark(S, t);
  if (off) S.p = S.p.map((c, i) => !c || ((i % 22) * 3 + Math.floor(i / 22)) % 4 === 0 ? null : gray(c));
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

// Text particles between the sprite and the status column (x is the card's left edge). They never cover pixels.
export function particles(G, role, pose, x, y, t, frame) {
  const P = pal(role);
  if (pose === 'quiet') { tput(G, x + 24, y + 2, '…?', '#B9AFC2'); return; }
  if (pose === 'sleeping') { for (let k = 0; k < 2; k++) { const p = ((t * .9 + k * .75) % 1.5) / 1.5; tput(G, x + 23 + k, y + 4 - Math.floor(p * 3), k ? 'Z' : 'z', mix('#B9AFC2', BG, p)); } return; }
  if (pose !== 'working') return;
  if (role === 'executor') {
    const CODE = '{}<>;=/*()[]';
    for (let k = 0; k < 5; k++) { const life = 14, a = (frame + k * 3) % life, gen = Math.floor((frame + k * 3) / life); tput(G, x + 24 + ((k * 2 + gen) % 4), y + 7 - Math.floor(a / 2), CODE[(k * 5 + gen) % CODE.length], mix(P.light, BG, a / life), true); }
  }
  if (role === 'planner') { const p = (t % .9) / .9; tput(G, x + 24, y + 5 - Math.floor(p * 3), '✓', mix('#6EE7A0', BG, p), true); if (Math.floor(t) % 3 === 0) tput(G, x + 26, y + 3, '✎', P.light); }
  if (role === 'designer') { for (let k = 0; k < 4; k++) { const s = Math.floor(t * 3) + k * 7; tput(G, x + 24 + Math.floor(hash(s) * 4), y + 1 + Math.floor(hash(s * 3) * 7), hash(s * 5) > .5 ? '•' : '+', hsl(hash(s * 7) * 360, 85, 65)); } }
  if (role === 'reviewer') { const c = Math.floor(t / 1.6), a = t % 1.6, ok = c % 3 !== 2; if (a > .25) tput(G, x + 25, y + 3, ok ? '✓' : '✗', a > 1.3 ? mix(ok ? '#6EE7A0' : '#FF6F6F', BG, .6) : ok ? '#6EE7A0' : '#FF6F6F', true); if (Math.floor(t * 3) % 2) tput(G, x + 24, y + 5, '...', P.light); }
  if (role === 'qa') { if (t % 3 > 2.3) { tput(G, x + 23, y + 2, 'BUG!', '#FF6F6F', true); tput(G, x + 24, y + 3, '+1', '#6EE7A0', true); } }
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
