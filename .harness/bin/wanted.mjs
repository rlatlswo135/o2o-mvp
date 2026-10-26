// MVP portraits for the WANTED poster: each crew member in a signature form, 20x16 px inside the poster frame,
// plus an effect that spills out of the frame across the whole poster.
import { mix, hash } from './sprites.mjs';

const SK = '#F6C9A0';
export const buf = (w, h) => ({ w, h, p: new Array(w * h).fill(null) });
const dot = (S, x, y, c) => { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < S.w && y < S.h) S.p[y * S.w + x] = c; };
const empty = (S, x, y) => x >= 0 && y >= 0 && x < S.w && y < S.h && !S.p[y * S.w + x];
const dotE = (S, x, y, c) => { if (empty(S, Math.round(x), Math.round(y))) dot(S, x, y, c); };
function paint(S, rows, pal, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    if ([...row].length !== 20) throw new Error(`portrait row ${y} is ${[...row].length} wide: ${row}`);
    [...row].forEach((k, x) => { if (k !== '.') dot(S, ox + x, oy + y, pal[k]); });
  });
}
function line(plot, x0, y0, x1, y1, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let k = 0; k <= n; k++) plot(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, typeof c === 'function' ? c(k / n) : c);
}
// Empty pixels touching the silhouette, for auras.
function rim(S) {
  const out = [];
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (empty(S, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !empty(S, x + a, y + b) && x + a >= 0 && x + a < S.w && y + b >= 0 && y + b < S.h)) out.push([x, y]);
  return out;
}
// A jagged bolt: a core line with a glow on both sides.
function zap(plot, x0, y0, x1, y1, seed, core, glow) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0))), nx = -(y1 - y0) / n, ny = (x1 - x0) / n;
  let off = 0;
  for (let k = 0; k <= n; k++) {
    off = Math.max(-2.5, Math.min(2.5, off + (hash(seed * 31 + k) - 0.5) * 2.2));
    const x = x0 + (x1 - x0) * k / n + nx * off, y = y0 + (y1 - y0) * k / n + ny * off;
    plot(x + 1, y, glow); plot(x - 1, y, glow); plot(x, y, core);
  }
}

// ---------- Luffy: Gear 5, the Nika pose, Conqueror's haki crackling all over the poster ----------
// Small head and full body so the pose reads: elbows out, fists up by the head, one knee raised.
const LUFFY = [
  '......W..WW..W......',
  '.....WWVWWWWVWW.....',
  '....WWWWWWWWWWWW....',
  '...WWWWWWWWWWWWWW...',
  '...WWW' + 'ssssssss' + 'WWW...',
  '..WWWW' + 'ek' + 'ssss' + 'ke' + 'WWWW..',
  '...WWW' + 'ek' + 'ssss' + 'ke' + 'WWW...',
  '....WW' + 'sx' + 'ssssss' + 'WW....',
  '.....W' + 'tttttttt' + 'W.....',
  '......' + 'smmmmmms' + '......',
  '..sss' + 'uuuuuuuuuu' + 'sss..',
  '......' + 'cssxxssc' + '......',
  '......' + 'cccCCccc' + '......',
  '......' + 'cc..cccc' + 'cc....',
  '......' + 'cc......' + 'cc....',
  '......' + 'ss......' + 'ss....',
];
const LUFFY_PAL = { W: '#FFFFFF', V: '#DCD0F2', s: SK, e: '#E5383B', k: '#1B1B22', x: '#B5524A', t: '#FFFFFF', m: '#7A1F2A', u: '#FFFFFF', c: '#F4F0FF', C: '#CFC4E6' };
const luffy = {
  epithet: '「밀짚모자」 루피', move: '해방의 드럼!', bounty: 3000000000,
  bg: (x, y, t) => mix('#12040F', '#3A0A1E', 0.4 + 0.3 * Math.sin(t * 9 + x * 0.6) * (hash(Math.floor(t * 8) + y) > 0.6 ? 1 : 0.3) + y / 40),
  draw(S, t) {
    const beat = Math.floor(t * 4) % 2, laugh = Math.floor(t * 6) % 2, fist = '#F0B88E';
    paint(S, LUFFY.map((row, y) => y === 9 && laugh ? '......' + 'sttmmtts' + '......' : row), LUFFY_PAL, 0, beat);
    // forearms up from the elbows; the fists pump to the drums, one up while the other is down
    for (const [ex, fx, up] of [[2, 1, beat], [17, 18, 1 - beat]]) {
      for (let y = 7; y <= 9; y++) dot(S, ex, y + beat - up, SK);
      [[fx, 5], [fx + (fx < 10 ? 1 : -1), 5], [fx, 6], [fx + (fx < 10 ? 1 : -1), 6]].forEach(([x, y]) => dot(S, x, y + beat - up, fist));
    }
    // cloud hair boils, steam puffs off his shoulders
    const f = Math.floor(t * 10);
    for (let x = 3; x < 17; x++) if (hash(x * 7 + f) > 0.55) dotE(S, x, beat + (hash(x + f * 3) > 0.5 ? 0 : 1) - 1, hash(x * 3 + f) > 0.5 ? '#FFFFFF' : '#E9E2FA');
    for (let k = 0; k < 6; k++) { const p = (t * 0.9 + k / 6) % 1; dotE(S, (k % 2 ? 15 : 4) + Math.sin(p * 7 + k) * 1.5, 10 - p * 9, mix('#FFFFFF', '#2A0C22', p)); }
  },
  // Conqueror's haki: black lightning with a red edge bursts from the frame across the whole poster.
  over(plot, box, t) {
    const cycle = Math.floor(t / 0.4), live = (t % 0.4) < 0.26;
    if (!live) return;
    for (let k = 0; k < 4; k++) {
      const seed = cycle * 7 + k, side = (k + cycle) % 4, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const [sx, sy] = side === 0 ? [box.x, cy + (hash(seed) - 0.5) * box.h] : side === 1 ? [box.x + box.w - 1, cy + (hash(seed) - 0.5) * box.h] : side === 2 ? [cx + (hash(seed) - 0.5) * box.w, box.y] : [cx + (hash(seed) - 0.5) * box.w, box.y + box.h - 1];
      const a = Math.atan2(sy - cy, sx - cx) + (hash(seed * 3) - 0.5) * 0.9, len = 9 + hash(seed * 5) * 8, glow = hash(seed * 9) > 0.5 ? '#FF2A3A' : '#B3123A';
      const ex = sx + Math.cos(a) * len * 1.4, ey = sy + Math.sin(a) * len;
      zap(plot, sx, sy, ex, ey, seed, '#0A0410', glow);
      // a branch forks off halfway
      const mx = (sx + ex) / 2, my = (sy + ey) / 2, b = a + (hash(seed * 11) > 0.5 ? 0.8 : -0.8);
      zap(plot, mx, my, mx + Math.cos(b) * len * 0.7, my + Math.sin(b) * len * 0.5, seed + 99, '#0A0410', glow);
    }
  },
};

// ---------- Zoro: Enma outfit, Santoryu Ougi Sanzen Sekai ----------
const ZORO = [
  '....................',
  '......kkkkkkkk......',
  '.....kkkkkkkkkk.....',
  '......g' + 'kkkkkk' + 'g.kk...',
  '......' + 'sxssssss' + '......',
  '......' + 'sxsssRss' + '......',
  '......' + 'ssxsssss' + '......',
  '..LLLL' + 'shhhhhhs' + 'LLLL..',
  '.......' + 'ssssss' + '.......',
  '....KK' + 'KwKKKKwK' + 'KK....',
  '...KKK' + 'KKwwwwKK' + 'KKK...',
  '...KKK' + 'KKKKKKKK' + 'KKK...',
  '....KK' + 'rrrrrrrr' + 'KK....',
  '......' + 'KKKKKKKK' + '......',
  '......' + 'KKK..KKK' + '......',
  '......' + 'nnn..nnn' + '......',
];
const ZORO_PAL = { k: '#1A1A22', g: '#4FBF5A', s: SK, x: '#9C5A48', R: '#FF2A3A', L: '#D8DEE8', h: '#3A2A20', K: '#2F5A44', w: '#E8E2D4', r: '#8E2A2A', n: '#24242C' };
const zoro = {
  epithet: '「해적사냥꾼」 조로', move: '삼천세계!', bounty: 1111000000,
  bg: (x, y, t) => mix('#160812', '#2E0C26', y / 16 + 0.15 * Math.sin(t * 3 + x * 0.4)),
  draw(S, t) {
    paint(S, ZORO, ZORO_PAL);
    // Enma's dark aura flickers up the silhouette
    const f = Math.floor(t * 12);
    for (const [x, y] of rim(S)) { const n = hash(x * 7 + y * 13 + f * 3); if (n > 0.6) dot(S, x, y, ['#3B0A3A', '#6A1A6A', '#9A2A6A', '#E05080'][Math.floor((n - 0.6) / 0.4 * 4)]); }
    // Sanzen Sekai: a sword in each fist spun like a windmill, Enma (black, red edge) left and Wado (white) right
    [[5, 11, 1, '#14101A', '#FF3A5A'], [14, 11, -1, '#EDEDED', '#FFFFFF']].forEach(([cx, cy, dir, blade, edge]) => {
      const a = t * 10 * dir;
      for (let k = 1; k <= 5; k++) { const b = a - k * 0.35 * dir; for (const half of [0, Math.PI]) dotE(S, cx + Math.cos(b + half) * 5, cy + Math.sin(b + half) * 3.5, mix('#FF6AA0', '#2E0C26', k / 6)); }
      for (const half of [0, Math.PI]) for (let r = 1; r <= 5; r++) dot(S, cx + Math.cos(a + half) * r, cy + Math.sin(a + half) * r * 0.7, r === 5 ? edge : blade);
      dot(S, cx, cy, SK); dot(S, cx + dir, cy, '#C9A227');
    });
  },
  // a giant slash cuts the whole poster every so often
  over(plot, box, t) {
    const c = t % 1.6; if (c > 0.35) return;
    const p = c / 0.35, seed = Math.floor(t / 1.6), up = hash(seed) > 0.5;
    const x0 = box.x - 4, x1 = box.x + box.w + 4, y0 = up ? box.y + box.h + 2 : box.y - 2, y1 = up ? box.y - 2 : box.y + box.h + 2;
    line(plot, x0, y0, x0 + (x1 - x0) * Math.min(1, p * 1.6), y0 + (y1 - y0) * Math.min(1, p * 1.6), q => q > 0.92 ? '#FFFFFF' : mix('#E05080', '#FFD1E6', q));
    if (p > 0.5) line(plot, x0, y0 + 1, x1, y1 + 1, mix('#6A1A6A', '#000000', (p - 0.5) * 2));
  },
};

// ---------- Sanji: Ifrit Jambe, blue fire, high kick ----------
const SANJI = [
  '....................',
  '......yyyyyyyy......',
  '.....yyyyyyyyyy.....',
  '.....yyyyyyyyyyy....',
  '.....sscsyyyyyyy....',
  '.....ssksyyyyyy.....',
  '.....sssssyyyyy.....',
  '.....sssssswwwo.....',
  '......ssssss........',
  '.....kbbttbbk.......',
  '....kkkkttkkkk......',
  '....kkkkkkkkkk......',
  '.....kkkkkkkk.......',
  '.....kk.............',
  '.....kk.............',
  '....nnn.............',
];
const SANJI_PAL = { y: '#FFD54F', s: SK, c: '#9A6B12', k: '#22222C', b: '#5E8CC9', t: '#14141C', w: '#F5F5F5', o: '#FF7A2A', n: '#3A2A20' };
const BLUE = ['#0B1E5B', '#1F4FD8', '#2F8BFF', '#5CC8FF', '#B8F0FF', '#FFFFFF'];
const sanji = {
  epithet: '「검은다리」 상디', move: '이프리트 잠브!', bounty: 1032000000,
  bg: (x, y, t) => mix('#060A1E', '#10204A', y / 16 + 0.1 * Math.sin(t * 6 + x)),
  draw(S, t) {
    const f = Math.floor(t * 12), jit = Math.floor(t * 8) % 2;
    paint(S, SANJI, SANJI_PAL);
    // high kick: the right leg sweeps up, burning white-blue
    const hipX = 11, hipY = 12, a = -0.75 + Math.sin(t * 5) * 0.12, len = 8;
    for (let r = 0; r <= len; r++) for (const w of [0, 1]) dot(S, hipX + Math.cos(a) * r, hipY + Math.sin(a) * r + w, r >= len - 1 ? '#3A2A20' : BLUE[Math.min(5, 3 + ((r + f) % 3))]);
    // blue flames lick up the whole body
    for (const [x, y] of rim(S)) { const n = hash(x * 11 + y * 7 + f * 5); if (n > 0.35) { dot(S, x, y, BLUE[1 + Math.floor((n - 0.35) / 0.65 * 4)]); if (n > 0.8) dotE(S, x, y - 1, BLUE[2]); } }
    // smoke from the cigarette
    for (let k = 0; k < 2; k++) { const p = (t * 0.7 + k * 0.5) % 1; dotE(S, 14 + Math.round(Math.sin(p * 6 + k)), 6 - p * 6, mix('#C8C0D0', '#10204A', p)); }
    dot(S, 14, 7, jit ? '#FFB347' : '#FF7A2A');
  },
  // embers rise off the poster
  over(plot, box, t) {
    for (let k = 0; k < 14; k++) {
      const p = (t * (0.5 + hash(k) * 0.5) + hash(k * 3)) % 1, x = box.x - 2 + hash(k * 7) * (box.w + 4) + Math.sin(t * 4 + k) * 1.2;
      plot(x, box.y + box.h + 6 - p * (box.h + 12), BLUE[5 - Math.floor(p * 4)]);
    }
  },
};

// ---------- Nami: recent outfit, Clima-Tact up, Zeus overhead ----------
const NAMI = [
  '....................',
  '....................',
  '......oooooo........',
  '....oooooooooo......',
  '....oossssssoo......',
  '...oosksskssoo......',
  '...oosssmsssoo......',
  '...ooosssssooo......',
  '..oooswwwwwsooo.....',
  '..oo.sbwwwbs.oo.....',
  '..oo..sssss..oo.....',
  '..o...jjjjj...o.....',
  '......jjjjj.........',
  '......jj.jj.........',
  '......jj.jj.........',
  '.....ff...ff........',
];
const NAMI_PAL = { o: '#FF8A3D', s: SK, k: '#1A1420', m: '#E0607A', w: '#FFFFFF', b: '#3A7BD5', j: '#3E5F9E', f: '#E8E2D4' };
const ZEUS = ['...ww..ww..', '..wwwwwwww.', '.wwwwwwwwww', 'wwwwwwwwwww', '.SSSSSSSSS.'];
const nami = {
  epithet: '「도둑고양이」 나미', move: '제우스 브리즈 템포!', bounty: 366000000,
  bg: (x, y, t) => { const flash = (t % 1.2) < 0.08; return flash ? '#5A6A9A' : mix('#1A2238', '#2C3A5C', y / 16); },
  draw(S, t) {
    paint(S, NAMI.map(row => row.slice(2) + '..'), NAMI_PAL);
    // one hand on her hip, the other raises the Clima-Tact
    [[2, 9], [2, 10], [3, 11]].forEach(([x, y]) => dot(S, x, y, SK));
    [[10, 8], [11, 7], [12, 6], [12, 5]].forEach(([x, y]) => dot(S, x, y, SK));
    for (let y = 1; y <= 4; y++) dot(S, 12, y, y === 0 ? ((t % 1.2) < 0.15 ? '#FFFFFF' : '#FFE14D') : '#3A7BD5');
    // a wink on the beat
    if (Math.floor(t * 1.5) % 3 === 0) { dot(S, 7, 5, SK); dot(S, 6, 6, '#1A1420'); dot(S, 8, 6, '#1A1420'); }
    // ฿ glints by her hair
    const p = (t * 0.8) % 1; dotE(S, 2, 8 - p * 7, p < 0.8 ? '#FFD24A' : '#FFF1A8');
  },
  // Zeus sits on the frame's top-right corner, grins, and strikes the tip of her staff
  over(plot, box, t) {
    const cx = box.x + box.w - 12, cy = box.y + 1 + Math.round(Math.sin(t * 2.2) * 0.6), strike = (t % 1.2) < 0.15, dark = !strike && (t % 1.2) > 0.9;
    ZEUS.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') plot(cx + x, cy + y, k === 'w' ? (dark ? '#8A93AD' : '#EEF2FA') : (dark ? '#5A6380' : '#A6B0C8')); }));
    [[4, 2], [7, 2]].forEach(([x, y]) => plot(cx + x, cy + y, strike ? '#FFE14D' : '#2A2A3A'));
    plot(cx + 5, cy + 3, '#2A2A3A'); plot(cx + 6, cy + 3, '#2A2A3A');
    if (strike) zap(plot, cx + 4, cy + 5, box.x + 13, box.y + 2, Math.floor(t / 1.2), '#FFF6B0', '#7FE6FF');
  },
};

// ---------- Buggy: the Cross Guild poster face ----------
const BUGGY = [
  '......hhhhhhhh......',
  '.....hhhwwwwhhh.....',
  '.....hhhwRRwhhh.....',
  '...HHHHHHHHHHHHHH...',
  '.BBffffffffffffffBB.',
  '.BBfWWWffffffWWWfBB.',
  'BBBfWkWffffffWkWfBBB',
  'BBBfWWWffRRffWWWfBBB',
  'BB.ffffffRRffffff.BB',
  'BB.fLLLLLLLLLLLLf.BB',
  'B..fLMMMMMMMMMMLf..B',
  'B..ffLMMTTTTMMLff..B',
  '...fffLLLLLLLLfff...',
  '....ffffffffffff....',
  '..ccccWbWbWbWbcccc..',
  '.cccccbWbWbWbWccccc.',
];
const BUGGY_PAL = { h: '#1D2340', w: '#F5F5F5', R: '#FF2D2D', H: '#2E3768', B: '#4FA3E0', f: '#FAF4EE', W: '#FFFFFF', k: '#1A1420', L: '#E53935', M: '#5A1018', T: '#FF8FA3', c: '#C62828', b: '#3F6BC4' };
const buggy = {
  epithet: '「천제」 버기', move: '갸하하! 크로스 길드!', bounty: 3189000000,
  bg: (x, y, t) => mix('#F3E3BC', '#E2C890', ((x + y + Math.floor(t * 4)) % 4) / 6),
  draw(S, t) {
    const laugh = Math.floor(t * 7) % 2, jitter = Math.floor(t * 5) % 3 - 1;
    paint(S, laugh ? BUGGY.map((row, y) => y === 11 ? 'B..fLMMTTTTTTMMLf..B' : row) : BUGGY, BUGGY_PAL, 0, laugh ? -1 : 0);
    // pupils roll around, sweat flies off
    for (const ex of [5, 14]) { dot(S, ex - 1, 5 + (laugh ? -1 : 0), '#FFFFFF'); dot(S, ex + jitter, 6 + (laugh ? -1 : 0), '#1A1420'); }
    const p = (t * 1.6) % 1; dot(S, 18 + p * 2, 3 + p * 5, '#9FD8FF'); dot(S, 1 - p * 2, 4 + p * 4, '#9FD8FF');
  },
  // gold coins rain over the poster: the Cross Guild pays out
  over(plot, box, t) {
    for (let k = 0; k < 10; k++) {
      const p = (t * (0.6 + hash(k) * 0.4) + hash(k * 5)) % 1, x = box.x - 3 + hash(k * 13) * (box.w + 6);
      plot(x, box.y - 6 + p * (box.h + 14), Math.floor(t * 8 + k) % 2 ? '#FFD24A' : '#FFF1A8');
    }
  },
};

// ---------- Brook and Laboon: a guitar call, a friendly head pat, then the whale answers with a splash ----------
const BROOK = [
  '.aAaaaaAa...........',
  'aAaaaaaaAa..........',
  'aaaaaaaaaa..........',
  '.wwwwwwww...........',
  '.wkkwwkkw...........',
  '.wkkwwkkw...........',
  '..wwkkww............',
  '..wkwkwk............',
  '..cwwwwc............',
  '..ckkwkc............',
  '..cwwwwc............',
  '..bkkwkb............',
  '...w..w.............',
  '...w..w.............',
  '..nw..wn............',
  '....................',
];
const BROOK_PAL = { a: '#262333', A: '#45405A', w: '#F8F4DC', k: '#171923', c: '#A3D9F5', b: '#65A6CF', g: '#FFD24A', n: '#303044' };
const brook = {
  epithet: '「소울 킹」 브룩', move: '라분! 함께 노래해요!', bounty: 383000000,
  bg: (x, y, t) => mix('#102E28', '#205348', y / 20 + .1 * Math.sin(t * 3 + x * .5)),
  draw(S, t) {
    const beat = Math.floor(t * 4) % 4, pat = beat >= 2, wx = pat ? 9 : 10, wy = pat ? 8 : 9;
    paint(S, BROOK, BROOK_PAL);
    // Keep the ribs exposed while the bone arm strums toward Laboon.
    line((x, y, c) => dot(S, x, y, c), 2, 8, 1, 11, '#F8F4DC');
    line((x, y, c) => dot(S, x, y, c), 1, 11, 8, 11, '#F8F4DC');
    ['.t.tt.', 'tttttt', '.ttwt.', 'tt..tt'].forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') dot(S, 5 + x, 10 + y, k === 'w' ? '#BFFFE8' : '#28BCA5'); }));
    line((x, y, c) => dot(S, x, y, c), 8, 11, 13, 7, '#BFFFE8');
    dot(S, 13, 6, '#28BCA5'); dot(S, 14, 7, '#28BCA5');
    dot(S, 8, 10 + beat % 2, '#F8F4DC'); dot(S, 10, 8, '#F8F4DC');
    // Laboon leans into Brook's hand on the answering beat; forehead scars distinguish him from a generic whale.
    const pal = { b: '#344C78', B: '#516D99', w: '#C9E9F5', e: '#FFFFFF' };
    ['..BBBB....', '.BBbbbB...', 'BBbbbbbB.b', 'bbebbbbbbb', 'bbwwwwwbb.', '.bbbbbbb..', '..bb..b...'].forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') dot(S, wx + x, wy + y, pal[k]); }));
    [[3, 0], [4, 1], [5, 0], [3, 2], [5, 2]].forEach(([x, y]) => dot(S, wx + x, wy + y, '#1B293F'));
    dot(S, wx + 2, wy + 3, pat ? '#1B293F' : '#FFFFFF');
    if (pat) { dot(S, wx + 1, wy + 2, '#1B293F'); dot(S, wx + 3, wy + 2, '#1B293F'); line((x, y, c) => dot(S, x, y, c), 7, 9, wx + 1, wy + 1, '#F8F4DC'); }
    dot(S, 18, wy + 2, '#516D99');
    dot(S, 19, wy + 1, '#516D99'); dot(S, 19, wy, '#344C78');
    dot(S, 17, wy + 1, '#516D99'); dot(S, 16, wy, '#344C78');
    // Notes travel from guitar to whale; spout/splash answers the same four-beat phrase.
    for (let k = 0; k < 2; k++) {
      const p = (t * .8 + k * .5) % 1, x = 9 + p * 9, y = 5 - Math.sin(p * Math.PI) * 3;
      line((a, b, c) => dotE(S, a, b, c), x, y, x, y + 2, '#B6FF58'); dotE(S, x - 1, y + 2, '#B6FF58'); dotE(S, x + 1, y, '#B6FF58');
    }
    if (pat) {
      line((x, y, c) => dot(S, x, y, c), wx + 5, wy - 1, wx + 5, wy - 4, '#92E8FF');
      for (const side of [-1, 1]) { dot(S, wx + 5 + side, wy - 5, '#D5F7FF'); dot(S, wx + 5 + side * 2, wy - 4, '#92E8FF'); dot(S, wx + 5 + side * 3, wy - 2 + beat % 2, '#92E8FF'); }
    }
    for (let x = 0; x < 20; x++) dot(S, x, 15, (x + beat) % 4 ? '#2E6BA8' : '#92E8FF');
  },
  over(plot, box, t) {
    for (let k = 0; k < 4; k++) {
      const p = (t * .7 + k / 4) % 1, x = box.x - 1 + p * (box.w + 2), y = box.y + 3 - Math.sin(p * Math.PI) * 2;
      line(plot, x, y, x, y + 2, '#B6FF58'); plot(x - 1, y + 2, '#B6FF58'); plot(x + 1, y, '#B6FF58');
      plot(box.x + box.w - 3 + Math.sin(t * 5 + k) * 2, box.y + box.h - 2 - p * 5, '#92E8FF');
    }
  },
};

export const MVP = { executor: luffy, reviewer: zoro, designer: sanji, planner: nami, qa: buggy, refactor: brook };
export function portrait(role, t) {
  const art = MVP[role], S = buf(20, 16);
  art.draw(S, t);
  return S;
}
