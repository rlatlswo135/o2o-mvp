// Left board of the pane-first console: title, token gauges, role cards, then pipeline and story under the cards.
import os from 'node:os';
import path from 'node:path';
import { fit, columns } from './terminal.mjs';
import { elapsed, phases, actions } from './signals.mjs';
import { character, miniCharacter } from './characters.mjs';
import { ROLE_COLOR, FIRE, GOLD, BG, mix, hsl, hash, grid, put, blit, segments, sprite as pixelSprite, particles, aura, castName } from './sprites.mjs';
import { SCENE_WIDTH, SCENE_ROWS, victoryScene, crewOf, mvpOf } from './victory.mjs';
export { phases, actions };

const TOKENS = {
  accent: ['#FF5FA2', 205], shadow: ['#9E2F63', 125], alert: ['#D9534F', 167], border: ['#5C5C66', 240], dim: ['#8A8A94', 245],
  low: ['#7AC7FF', 117], mid: ['#F5D76E', 221], high: ['#FF5F87', 204],
  fire0: [FIRE[0], 88], fire1: [FIRE[1], 160], fire2: [FIRE[2], 202], fire3: [FIRE[3], 214], fire4: [FIRE[4], 221], fire5: [FIRE[5], 230],
  ok0: ['#1E6B3F', 29], ok1: ['#2FB36A', 35], ok2: ['#6EE7A0', 84], ok3: ['#D2FFE2', 194], okBg: ['#1F9D55', 29],
  planner: [ROLE_COLOR.planner, 215], executor: [ROLE_COLOR.executor, 117], reviewer: [ROLE_COLOR.reviewer, 150], designer: [ROLE_COLOR.designer, 211], qa: [ROLE_COLOR.qa, 141], refactor: [ROLE_COLOR.refactor, 155],
};
const HEX = Object.fromEntries(Object.entries(TOKENS).map(([name, [hex]]) => [name, hex])), FG = '#E6E1E8';
const STALE = 6 * 3600000, CARD = 76;

export function colorMode(env = process.env) {
  if (env.NO_COLOR !== undefined || env.TERM === 'dumb') return null;
  return /truecolor|24bit/i.test(env.COLORTERM ?? '') ? 'truecolor' : '256';
}

// Nearest xterm-256 color (6x6x6 cube or gray ramp) for a hex color, for terminals without truecolor.
const CUBE = [0, 95, 135, 175, 215, 255], XTERM = new Map();
function xterm(hex) {
  if (XTERM.has(hex)) return XTERM.get(hex);
  const rgb = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)), index = rgb.map(v => CUBE.reduce((best, level, at) => Math.abs(level - v) < Math.abs(CUBE[best] - v) ? at : best, 0));
  const step = Math.max(0, Math.min(23, Math.round((rgb.reduce((a, b) => a + b) / 3 - 8) / 10))), gray = 8 + step * 10;
  const distance = color => color.reduce((sum, v, at) => sum + (v - rgb[at]) ** 2, 0);
  const code = distance([gray, gray, gray]) < distance(index.map(at => CUBE[at])) ? 232 + step : 16 + 36 * index[0] + 6 * index[1] + index[2];
  XTERM.set(hex, code); return code;
}

// Styles: bold, white, fg:/bg: with a token name or a #RRGGBB color.
function sgr(style, mode) {
  return style.map(item => {
    if (item === 'bold') return '1';
    if (item === 'white') return '97';
    const [kind, name] = item.split(':'), [hex, fallback] = name.startsWith('#') ? [name, xterm(name)] : TOKENS[name], base = kind === 'bg' ? 48 : 38;
    return mode === 'truecolor' ? `${base};2;${[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(';')}` : `${base};5;${fallback}`;
  }).join(';');
}

const size = text => [...text].reduce((sum, character) => sum + columns(character), 0);

// A line is a list of [text, ...style] segments; text is sanitized and clipped to the width before painting.
function compose(segments, width, mode) {
  const runs = [];
  for (const [text, ...style] of segments) {
    const last = runs.at(-1), key = style.join(',');
    if (last && last.key === key) last.text += text; else runs.push({ text, style, key });
  }
  let out = '', used = 0;
  for (const run of runs) {
    if (used >= width) break;
    const piece = fit(run.text, width - used);
    if (!piece) continue;
    used += size(piece);
    out += mode && run.style.length ? `\x1b[${sgr(run.style, mode)}m${piece}\x1b[0m` : piece;
  }
  return { text: out, used };
}
const padded = (segments, width) => { const used = size(segments.map(([text]) => fit(text, width)).join('')); return [...segments, [' '.repeat(Math.max(0, width - used))]]; };

const BIG = [
  ' ██████╗██████╗ ██╗  ██╗██╗███╗   ███╗',
  '██╔════╝╚════██╗██║ ██╔╝██║████╗ ████║',
  '██║      █████╔╝█████╔╝ ██║██╔████╔██║',
  '██║     ██╔═══╝ ██╔═██╗ ██║██║╚██╔╝██║',
  '╚██████╗███████╗██║  ██╗██║██║ ╚═╝ ██║',
  ' ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝',
];
const FONT = {
  H: ['#..#', '#..#', '####', '#..#', '#..#'], A: ['.##.', '#..#', '####', '#..#', '#..#'], R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'], E: ['####', '#...', '###.', '#...', '####'], S: ['.###', '#...', '.##.', '...#', '###.'],
};
// 5-row pixel font squeezed into 3 rows of half blocks.
function small(text) {
  const glyphs = [...text].map(letter => FONT[letter]), rows = [];
  for (let y = 0; y < 6; y += 2) rows.push(glyphs.map(glyph => [...glyph[y]].map((pixel, x) => {
    const below = glyph[y + 1]?.[x] === '#';
    return pixel === '#' ? (below ? '█' : '▀') : below ? '▄' : ' ';
  }).join('')).join(' '));
  return rows;
}
const HARNESS = small('HARNESS');

// The logo plays one show per 6s slot, each fading in from the last: light sweep, rising fire, haki crackle,
// thunder, color wave. face: a solid block (letter face) rather than its shadow lines.
const SHOWS = ['sweep', 'fire', 'haki', 'thunder', 'wave'], SLOT = 6;
function logoInk(show, face, x, y, t) {
  const tick = Math.floor(t * 10), base = HEX[face ? 'accent' : 'shadow'];
  switch (show) {
    case 'sweep': { const d = Math.min(...[0, 1].map(k => Math.abs(x - y * 0.9 - (-8 + ((t / 1.6 + k / 2) % 1) * 80)))); return d < 3 ? mix(base, '#FFF2F8', (1 - d / 3) * (face ? 0.95 : 0.6)) : base; }
    case 'fire': { const heat = Math.max(0, Math.min(0.99, y / 5 * 0.75 + 0.3 * Math.sin(x * 0.7 + t * 6) + hash(x * 7 + y * 13 + tick) * 0.35 - 0.15)); const c = FIRE[1 + Math.floor(heat * 5)]; return face ? c : mix(c, BG, 0.45); }
    case 'haki': {
      const seed = Math.floor(tick / 2), path = 2 + hash(seed) * 66 + (hash(seed * 7 + y) - 0.5) * 4, d = Math.abs(x - path), live = hash(seed * 3) > 0.3;
      if (live && d < 1) return '#FFFFFF';
      if (live && d < 2.5) return '#C084FC';
      return face ? mix('#6B1FA8', '#A855F7', 0.5 + 0.5 * Math.sin(t * 5 + x * 0.3)) : '#2A0F45';
    }
    case 'thunder': {
      const c = t % 1.5, seed = Math.floor(t / 1.5), path = 2 + hash(seed) * 66 + (hash(seed * 5 + y) - 0.5) * 3;
      if (c < 0.1 || (c > 0.18 && c < 0.24)) return face ? '#FFF6B0' : '#C9B860';
      if (c < 0.5 && Math.abs(x - path) < 1.5) return '#FFE14D';
      return face ? mix('#5A6FB0', '#7FA0E8', 0.5 + 0.5 * Math.sin(x * 0.2 - t * 3)) : '#26305A';
    }
    default: { const c = hsl(x * 7 + y * 12 - t * 140, 85, 66); return face ? c : mix(c, BG, 0.5); }
  }
}
function title(width, { compact = false, shine = null } = {}) {
  if (compact || width < 40) return [[[' C2KIM', 'bold', 'fg:accent'], [' HARNESS', 'fg:dim']]];
  const t = shine?.t ?? 0, slot = Math.floor(t / SLOT), fade = Math.min(1, (t % SLOT) / 0.4);
  const ink = (face, x, y) => {
    if (!shine) return HEX[face ? 'accent' : 'shadow'];
    const now = logoInk(SHOWS[slot % SHOWS.length], face, x, y, t);
    return fade < 1 ? mix(logoInk(SHOWS[(slot + SHOWS.length - 1) % SHOWS.length], face, x, y, t), now, fade) : now;
  };
  const paint = (ch, x, y) => ch === ' ' ? [ch] : [ch, `fg:${ink(ch === '█', x, y)}`];
  // HARNESS sits to the right of the logo and takes the same show, as if the logo ran on into it.
  const tail = y => [['  '], ...[...HARNESS[y - 2]].map((ch, x) => ch === ' ' ? [ch] : [ch, `fg:${ink(true, BIG[0].length + 2 + x, y)}`])];
  const live = shine && width >= 78 ? [['  '], ['●', `fg:${mix('#7A1F3D', '#FF5F87', 0.5 + 0.5 * Math.sin(t * 4))}`], [` 실행 중 ${shine.live}/${shine.total}`, 'fg:dim']] : [];
  return BIG.map((row, y) => [[' '], ...[...row].map((ch, x) => paint(ch, x, y)),
    ...(width >= 78 && y >= 2 && y <= 4 ? tail(y) : y === 5 ? live : [])]);
}

const SYMBOL = { finished: ['●', 'bold', 'fg:ok2'], done: ['●', 'fg:dim'], current: ['◐', 'bold', 'fg:accent'], next: ['○', 'fg:border'], blocked: ['✕', 'bold', 'fg:alert'] };
// Wide boards draw the pipeline on two rows: nodes on a rail (filled up to the current stage) and names under each node.
function pipelineRows(stages, width) {
  if (stages.every(stage => stage.state === 'done')) stages = stages.map(stage => ({ ...stage, state: 'finished' }));
  const slot = Math.max(...stages.map(stage => size(stage.name))) + 4;
  if (1 + slot * (stages.length - 1) + size(stages.at(-1).name) > width) return [pipelineLine(stages)];
  const rail = [[' ']], names = [[' ']];
  stages.forEach((stage, index) => {
    const [symbol, ...style] = SYMBOL[stage.state], last = index === stages.length - 1;
    rail.push([symbol, ...style]);
    const filled = stage.state === 'done' || stage.state === 'finished';
    if (!last) rail.push([(filled ? '━' : '─').repeat(slot - 1), stage.state === 'finished' ? 'fg:ok2' : filled ? 'fg:accent' : 'fg:border']);
    names.push([last ? stage.name : stage.name + ' '.repeat(slot - size(stage.name)), ...style]);
  });
  return [rail, names];
}
// Until its complete screen is closed, a finished story replaces the story line with a green banner whose frame shimmers;
// when the complete card does not fit, the banner says how to close it.
function doneBanner(state, width, frame, count) {
  const text = [` ✔ ${state.story} 완료 `, 'bold', 'white', 'bg:okBg'];
  const next = state.victory ? [`  ${settledText(state.victory)} · Enter 보드로`, 'bold', 'fg:ok2'] : [`  다음 ${(state.next ?? []).join(' + ') || '확인'}`, 'fg:dim'];
  if (width < 24) return [[text]];
  const inner = width - 2, shine = k => `fg:ok${Math.min(3, Math.floor((0.5 + 0.5 * Math.sin(k * 0.35 - frame * 0.9)) * 4))}`;
  const edge = (left, right, offset) => [[left, 'bold', 'fg:ok2'], ...[...'━'.repeat(inner)].map((char, k) => [char, 'bold', shine(k + offset)]), [right, 'bold', 'fg:ok2']];
  const body = count ? [...padded([[' '], text, next], Math.max(0, inner - size(count[0]))), count] : padded([[' '], text, next], inner);
  return [edge('┏', '┓', 0), [['┃', 'bold', 'fg:ok2'], ...body, ['┃', 'bold', 'fg:ok2']], edge('┗', '┛', inner)];
}
function pipelineLine(stages) {
  const segments = [[' ']];
  stages.forEach((stage, index) => {
    const [symbol, ...style] = SYMBOL[stage.state];
    if (index) segments.push([' ━ ', 'fg:border']);
    segments.push([`${stage.name} ${symbol}`, ...style]);
  });
  return segments;
}

const badge = (alert, now) => [` ${alert.badge}${Number.isFinite(alert.since) ? ` · ${elapsed(alert.since, now)}` : ''} `, 'bold', 'white', 'bg:alert'];
const tone = percent => percent < 50 ? 'fg:low' : percent < 80 ? 'fg:mid' : 'fg:high';
function bar(percent, cells) {
  const filled = Math.max(0, Math.min(cells, Math.round(percent / 100 * cells)));
  return [['█'.repeat(filled), tone(percent)], ['░'.repeat(cells - filled), 'fg:border']];
}

function gauges(usage, width, now) {
  const cells = width >= 60 ? 14 : width >= 44 ? 10 : 6, rows = [];
  for (const [provider, name] of [['claude', 'CLAUDE'], ['codex', 'CODEX']]) {
    const reading = usage?.[provider], label = [` ${name.padEnd(7)} `, 'bold', 'fg:accent'];
    if (!reading) { rows.push([label, ['첫 요청 후 표시', 'fg:dim']]); continue; }
    const age = now - reading.at > STALE ? '오래됨' : `${elapsed(reading.at, now)} 전`, origin = reading.source === 'rollout' ? ' · cli 기록' : '';
    reading.windows.forEach((window, index) => {
      const reset = window.resets === null ? '' : window.resets > now ? `↻${elapsed(now, window.resets)}` : '↻지남';
      rows.push([index ? [' '.repeat(9)] : label, [`${window.label} `, 'fg:dim'], ...bar(window.used, cells), [`${String(Math.round(window.used)).padStart(4)}%`],
        [reset ? `  ${reset}` : '', 'fg:dim'], ...(index === reading.windows.length - 1 ? [[`   ${age}${origin}`, 'fg:dim']] : [])]);
    });
  }
  return rows;
}

const ctxBar = (ctx, cells) => [['ctx ', 'fg:dim'], ...bar(ctx, cells), [` ${Math.round(ctx)}%`, 'fg:dim']];
function sprite(art, row, pose, mark) {
  const color = pose === 'offline' ? 'fg:dim' : `fg:${row.role}`;
  return art.map((line, y) => y === 0 && pose === 'alert' ? [[[...line].slice(0, mark).join(''), color], [[...line].slice(mark).join(''), 'bold', 'fg:alert']] : [[line, color]]);
}

// A working role's border burns: three hot spots race clockwise around a heavy frame, every cell flickers and
// stray cells flare white-hot. Its status text glows in the bright half of the same palette.
function flame(at, frame, perimeter) {
  const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (3 * at / perimeter - frame * 0.07)), flicker = hash(at * 31 + frame * 17);
  return `fg:fire${flicker > 0.94 ? 5 : Math.min(5, Math.floor((wave * wave * 0.7 + flicker * 0.4) * 6))}`;
}
const blaze = (text, frame) => [...text].map((char, k) =>
  [char, 'bold', `fg:fire${2 + Math.min(3, Math.floor((0.5 + 0.5 * Math.sin(k * 0.9 - frame * 0.8)) * 2.5 + hash(k * 13 + frame * 7) * 1.5))}`]);
const statusText = (row, frame) => row.pose === 'working' ? blaze(row.status, frame) : [[row.status, 'fg:dim']];
const FRAMES = {
  plain: { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯', style: 'fg:border' },
  selected: { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛', style: 'fg:accent' },
  burning: { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛', style: 'fg:border' },
  burningSelected: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝', style: 'fg:accent' },
};

function card(row, selected, width, density, frame, now) {
  const burning = row.pose === 'working', line = FRAMES[burning ? (selected ? 'burningSelected' : 'burning') : selected ? 'selected' : 'plain'];
  const full = density === 'full', label = ` ${row.role} `;
  const art = full ? sprite(character(row.role, row.pose, frame), row, row.pose, 12) : sprite(miniCharacter(row.role, row.pose, frame), row, row.pose, 5);
  const height = art.length + 2, perimeter = 2 * (width + height) - 4;
  // Positions count clockwise from the top-left corner so the flames move as one ring.
  const ring = (text, from, step = 1) => burning
    ? [...text].map((char, k) => [char, 'bold', flame(from + k * step, frame, perimeter)])
    : [[text, line.style]];
  const top = [...ring(line.tl + line.h, 0), [label, line.style], ...ring(line.h.repeat(Math.max(0, width - 3 - size(label))) + line.tr, 2 + size(label))];
  const bottom = ring(line.bl + line.h.repeat(Math.max(0, width - 2)) + line.br, width + height - 2 + width - 1, -1);
  const sides = y => [ring(line.v, perimeter - y)[0], ring(line.v, width - 1 + y)[0]];
  const name = [row.role, 'bold', `fg:${row.role}`], status = statusText(row, frame);
  const text = width - (full ? 22 : 13), gap = full ? '   ' : '  ';
  const right = full
    ? [[], [name], status, row.alert ? [badge(row.alert, now)] : [], [], row.ctx == null ? [] : ctxBar(row.ctx, 10), []]
    : [[name, [' · ', 'fg:dim'], ...status], row.alert ? [badge(row.alert, now)] : [], row.ctx == null ? [] : ctxBar(row.ctx, 8)];
  return [top, ...art.map((segments, y) => { const [left, rightEdge] = sides(y + 1); return [left, [' '], ...segments, [gap], ...padded(right[y], text), [' '], rightEdge]; }), bottom];
}

function roleLine(row, selected, frame, now) {
  return [[selected ? ' › ' : '   ', 'bold', 'fg:accent'], [row.role, 'bold', `fg:${row.role}`], [' · ', 'fg:dim'], ...statusText(row, frame), [' '], ...(row.alert ? [badge(row.alert, now)] : [])];
}

// Several harness sessions can run side by side, so the board names its project: folder first, home-relative path after.
function projectLine(root) {
  if (!root) return [];
  const home = os.homedir(), shown = root === home || root.startsWith(home + path.sep) ? '~' + root.slice(home.length) : root;
  return [[' '], [path.basename(root) || root, 'bold', 'fg:accent'], [`  ${shown}`, 'fg:dim']];
}

// ---------------- pixel cards ----------------
const THIN = FRAMES.plain, HEAVY = FRAMES.selected, DOUBLE = FRAMES.burningSelected;
// Frame lines on a grid; colorAt gets the clockwise position from the top-left corner.
function box(G, x, y, w, h, line, colorAt, bold) {
  const per = 2 * (w + h) - 4;
  for (let k = 0; k < w; k++) put(G, x + k, y, k === 0 ? line.tl : k === w - 1 ? line.tr : line.h, colorAt(k, per), null, bold);
  for (let r = 1; r < h - 1; r++) { put(G, x + w - 1, y + r, line.v, colorAt(w - 1 + r, per), null, bold); put(G, x, y + r, line.v, colorAt(per - r, per), null, bold); }
  for (let k = 0; k < w; k++) put(G, x + k, y + h - 1, k === 0 ? line.bl : k === w - 1 ? line.br : line.h, colorAt(w - 1 + h - 1 + (w - 1 - k), per), null, bold);
}
const fireAt = (t, tick) => (at, per) => { const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (3 * at / per - t / 3)), flicker = hash(at * 31 + tick * 17); return FIRE[flicker > 0.94 ? 5 : Math.min(5, Math.floor((wave * wave * 0.7 + flicker * 0.4) * 6))]; };
const pulse = t => mix(HEX.alert, '#5C2A2A', 0.5 + 0.5 * Math.sin(t * 7));
const clip = (G, x, y, text, width, fg, bg, bold) => put(G, x, y, fit(text, Math.max(0, width)), fg, bg, bold);
// ink: four colors, dim to bright (default: the hot half of the fire palette).
function blazeAt(G, x, y, text, width, t, tick, ink = FIRE.slice(2)) {
  [...fit(text, width)].forEach((char, k) => { x = put(G, x, y, char, ink[Math.min(3, Math.floor((0.5 + 0.5 * Math.sin(k * 0.9 - t / 0.3 * 0.8)) * 2.5 + hash(k * 13 + Math.floor(t / 0.3) * 7) * 1.5))], null, true); });
}
const ago = (at, now) => now - at < 60000 ? '방금' : `${elapsed(at, now)} 전`;

// Word wrap by terminal cells; a word longer than a line is split, and an overflowing last line ends with '...'.
function wrap(text, width, lines) {
  const out = [''];
  for (const word of text.split(' ').filter(Boolean)) {
    let rest = word;
    while (rest && out.length <= lines) {
      const current = out.at(-1), room = width - size(current) - (current ? 1 : 0);
      if (size(rest) <= room) { out[out.length - 1] = current ? `${current} ${rest}` : rest; rest = ''; }
      else if (current && size(rest) <= width) out.push('');
      else { const head = fit(rest, current ? room : width); if (!head) { out.push(''); continue; } out[out.length - 1] = current ? `${current} ${head}` : head; rest = rest.slice(head.length); out.push(''); }
    }
  }
  while (out.length > 1 && !out.at(-1)) out.pop();
  if (out.length > lines) { out.length = lines; out[lines - 1] = fit(out[lines - 1], width - 3) + '...'; }
  return out;
}

// The latest reply as a speech bubble; its bottom edge carries the oldest unread inbox message. A reply that just
// arrived types in once and flashes the edge, then stays still so several bubbles never move together.
function bubble(G, row, left, right, t, now) {
  const width = right - left + 1, working = row.pose === 'working', asking = Boolean(row.alert) && !working, offline = row.pose === 'offline', lit = working || asking;
  const role = ROLE_COLOR[row.role], at = row.reply?.at, age = Number.isFinite(at) ? now - at : Infinity;
  const edge = asking ? pulse(t) : offline ? '#5A3A40' : age < 1600 && Math.floor(t * 8) % 2 ? '#FFFFFF' : working ? role : '#3A3440';
  const label = row.alert?.kind === 'choice' ? ' 질문 ' : row.alert?.kind === 'reply' ? ' 새 응답 ' : ' 최근 응답 ', when = Number.isFinite(at) ? ` ${ago(at, now)} ` : '';
  let x = put(G, left, 3, '╭─', edge); x = put(G, x, 3, label, lit ? FG : HEX.dim, null, lit);
  x = put(G, x, 3, '─'.repeat(Math.max(0, width - 4 - size(label) - size(when))), edge); x = put(G, x, 3, when, lit ? FG : HEX.dim); put(G, x, 3, '─╮', edge);
  const lines = row.reply ? wrap(row.reply.text, width - 4, 2) : ['아직 응답 없음'], ink = !row.reply ? HEX.dim : lit ? FG : offline ? '#6B6470' : HEX.dim;
  let typed = Math.floor(age / 1000 * 18);
  for (let y = 0; y < 2; y++) {
    put(G, left, 4 + y, '│', edge); put(G, right, 4 + y, '│', edge);
    const line = lines[y] ?? '', chars = [...line], end = put(G, left + 2, 4 + y, chars.slice(0, Math.max(0, typed)).join(''), ink);
    if (typed >= 0 && typed < chars.length && Math.floor(t * 4) % 2) put(G, end, 4 + y, '▌', role);
    typed -= chars.length;
  }
  x = put(G, left, 6, '╰', edge);
  if (row.mail) {
    const mail = fit(`› ${row.mail.from}의 ${row.mail.label}${row.mail.count > 1 ? ` 외 ${row.mail.count - 1}` : ''}`, width - 4);
    x = put(G, x, 6, ' ', edge); x = put(G, x, 6, mail, working ? mix(role, FG, 0.3) : Math.floor(t * 2) % 2 ? GOLD : '#FFF1A8', null, true); x = put(G, x, 6, ' ', edge);
  }
  put(G, put(G, x, 6, '─'.repeat(Math.max(0, right - x)), edge), 6, '╯', edge);
}

// Card: sprite on the left, name/status/alert/context in the middle, agent and reply bubble on the right (wide panes).
// A working card plays its character's signature move (aura): tint, border, card-wide effects and the move's name.
function pixelCard(row, selected, width, t, tick, now) {
  const S = pixelSprite(row.role, row.pose, t, tick), height = S.h / 2 + 2, G = grid(width, height), working = row.pose === 'working', alarmed = Boolean(row.alert) && !working;
  const role = ROLE_COLOR[row.role], line = working || alarmed ? (selected ? DOUBLE : HEAVY) : selected ? HEAVY : THIN, move = working ? aura(row.role) : null;
  const wide = width >= CARD, column = (wide ? 47 : width - 2) - 28, name = castName(row.role), right = wide ? 46 : width - 2;
  if (move) {
    // One tint per row keeps each row a single run for the terminal.
    const [top, bottom] = move.tint(t);
    for (let y = 1; y < height - 1; y++) { const bg = mix(top, bottom, (y - 1) / Math.max(1, height - 3)); for (let x = 1; x < width - 1; x++) G.cells[y * width + x].bg = bg; }
  }
  box(G, 0, 0, width, height, line, move ? move.edge(t, tick) : working ? fireAt(t, tick) : alarmed ? () => pulse(t) : () => selected ? HEX.accent : HEX.border, working || alarmed || selected);
  put(G, 2, 0, ` ${row.role} `, role, null, true);
  move?.field?.(G, t, tick, right);
  blit(G, S, 2, 2);
  move?.over?.(G, t, tick, right);
  particles(G, row.role, row.pose, 0, 0, t);
  const end = put(G, 28, 2, row.role, role, null, true);
  if (name) clip(G, end, 2, ` · ${name}`, 28 + column - end, mix(role, FG, 0.5), null, true);
  if (working) blazeAt(G, 28, 3, row.status, column, t, tick, move?.ink); else clip(G, 28, 3, row.status, column, HEX.dim);
  if (move) blazeAt(G, 28, 5, move.move(t), column, t + 0.5, tick, move.ink);
  if (row.alert) {
    // The elapsed time goes first when the badge would not fit the column.
    const long = ` ${row.alert.badge}${Number.isFinite(row.alert.since) ? ` · ${elapsed(row.alert.since, now)}` : ''} `;
    clip(G, 28, 4, size(long) <= column ? long : ` ${row.alert.badge} `, column, '#FFFFFF', HEX.alert, true);
  }
  if (row.ctx != null) {
    const cells = 10, filled = Math.max(0, Math.min(cells, Math.round(row.ctx / 100 * cells))), x = put(G, 28, 6, 'ctx ', HEX.dim);
    put(G, put(G, put(G, x, 6, '█'.repeat(filled), HEX[tone(row.ctx).slice(3)]), 6, '░'.repeat(cells - filled), HEX.border), 6, ` ${Math.round(row.ctx)}%`, HEX.dim);
  }
  if (wide) {
    if (row.agent) { const tag = ` ${row.agent} `; put(G, 75 - tag.length, 1, tag, row.agent === 'pi' ? '#0E2333' : '#2A140C', row.agent === 'pi' ? '#7AC7FF' : '#E8956B', true); }
    bubble(G, row, 48, 74, t, now);
  }
  return segments(G);
}

// Stage chips joined by rails: finished stages green, the current one pulses pink with a marching arrow.
const CHIP = 12, GAP = 3;
function chips(stages, width, t) {
  if (1 + stages.length * (CHIP + GAP) - GAP > width) return null;
  const G = grid(width, 3), finished = stages.every(stage => stage.state === 'done');
  stages.forEach((stage, at) => {
    const x = 1 + at * (CHIP + GAP), state = finished ? 'finished' : stage.state;
    let bg = '#2A2430', fg = HEX.dim, mark = '';
    if (state === 'done') { bg = HEX.okBg; fg = '#FFFFFF'; mark = '✔ '; }
    if (state === 'finished') { bg = mix(HEX.okBg, '#45D888', 0.5 + 0.5 * Math.sin(at * 0.9 - t * 4)); fg = '#FFFFFF'; mark = '✔ '; }
    if (state === 'current') { bg = mix('#D93A74', '#FF8CC0', 0.5 + 0.5 * Math.sin(t * 5)); fg = '#FFFFFF'; mark = '▸ '; }
    if (state === 'blocked') { bg = pulse(t); fg = '#FFFFFF'; mark = '✕ '; }
    const label = mark + stage.name;
    put(G, x, 0, '▗' + '▄'.repeat(CHIP - 2) + '▖', bg);
    put(G, x, 1, ' '.repeat(CHIP), fg, bg); put(G, x + Math.floor((CHIP - size(label)) / 2), 1, label, fg, bg, state !== 'next');
    put(G, x, 2, '▝' + '▀'.repeat(CHIP - 2) + '▘', bg);
    if (state === 'current' && Math.floor(t * 5) % 4 === 0) put(G, x + CHIP, 0, '✦', '#FFD1E6');
    if (at === stages.length - 1) return;
    const rail = x + CHIP;
    if (state === 'done' || state === 'finished') { put(G, rail, 1, '━'.repeat(GAP), HEX.ok1); const glint = Math.floor(t * 8 + at * 3) % 12; if (glint < GAP) put(G, rail + glint, 1, '━', HEX.ok3); }
    else if (state === 'current') for (let k = 0; k < GAP; k++) put(G, rail + k, 1, '›', mix(HEX.accent, '#3A2A36', ((((k - t * 7) % GAP) + GAP) % GAP) / GAP), null, true);
    else put(G, rail, 1, '┄'.repeat(GAP), HEX.border);
  });
  return segments(G);
}

const settledText = party => party.settled ? 'result.md 확정' : '결과 정리 중';

export function renderConsole(state, width = 80, height = 24, { color = null, now = Date.now() } = {}) {
  width = Math.max(1, width); height = Math.max(1, height);
  // Animation runs on the clock, not on draw count: classic effects step every 300ms, pixel props every 100ms.
  const t = now / 1000, frame = Math.floor(now / 300), tick = Math.floor(now / 100);
  const pixel = Boolean(color);
  const cardWidth = Math.min(Math.max(1, width - 1), CARD), roles = state.roles ?? [], selected = Math.max(0, Math.min(roles.length - 1, state.selected ?? 0));
  const top = [projectLine(state.project), ...gauges(state.usage, width, now), []];
  // Pipeline and story sit under the cards, where a tall pane otherwise leaves empty space.
  const status = [[], ...(state.pipeline ? (pixel && chips(state.pipeline, cardWidth, t)) || pipelineRows(state.pipeline, width) : [])];
  const alerts = roles.filter(row => row.alert).length, count = alerts ? [` ! 알림 ${alerts} `, 'bold', 'white', 'bg:alert'] : null;
  const story = state.story ? [[' '], [state.story, 'bold'], [` · ${state.phaseLabel ?? phases[state.phase] ?? state.phase ?? ''} · 다음 ${(state.next ?? []).join(' + ') || '확인'}`, 'fg:dim']] : [[' 활성 스토리 없음', 'fg:dim']];
  const waiting = [[' '], ['다음 스토리 대기', 'bold'], [` · 지난 ${state.story} 완료 → result.md · 다음 ${(state.next ?? []).join(' + ') || 'planner'}`, 'fg:dim']];
  if (state.phase === 'done' && state.story && state.waiting) status.push(count ? [...padded(waiting, Math.max(0, cardWidth - size(count[0]))), count] : waiting);
  else if (state.phase === 'done' && state.story) status.push(...doneBanner(state, cardWidth, frame, count));
  else status.push(count ? [...padded(story, Math.max(0, cardWidth - size(count[0]))), count] : story);
  for (const problem of [state.notice, ...(state.problems ?? [])].filter(Boolean).slice(0, 2)) status.push([[` ! ${problem}`, 'fg:alert']]);
  const footer = [[width >= 44 ? ' ↑↓ 역할 · Tab 입력창 (CLI에서 Tab = 복귀)' : ' ↑↓ 역할 · Tab 입력창', 'fg:dim']];
  const big = title(width, { shine: pixel ? { t, live: roles.filter(row => row.pose !== 'offline').length, total: roles.length } : null });
  const compact = title(width, { compact: true });
  // The complete card replaces the role cards and the status rows; problems and roles waiting on the user stay above it.
  // It takes the tallest layout and header that fit, down to one title row over the compact card; else the banner below.
  if (pixel && state.victory && width >= SCENE_WIDTH) {
    const notes = [...roles.filter(row => row.alert).map(row => roleLine(row, false, frame, now)), ...status.filter(line => line[0]?.[0]?.startsWith(' ! '))];
    const options = [[[...big, ...top], 'tall'], [[...compact, ...top], 'tall'], [[...compact, ...top], 'compact'], [[[...compact[0], ['   '], ...projectLine(state.project).slice(1)]], 'compact']];
    const pick = options.find(([header, layout]) => header.length + notes.length + SCENE_ROWS[layout] + 1 <= height);
    if (pick) {
      const crew = crewOf(roles.map(row => row.role)), party = { ...state.victory, crew, mvp: mvpOf(state.story, crew), label: [state.story, state.victory.outcome?.name].filter(Boolean).join(' ') };
      const lines = [...pick[0], ...notes, ...victoryScene(party, pick[1]), [[' ↑↓ 역할 · Tab 입력창', 'fg:dim']]];
      return lines.map(segments => compose(segments, width, color).text).join('\n');
    }
  }
  // The big logo gives way to a one-line title when that is what lets the full cards fit.
  const cardHeight = pixel ? 10 : 9, need = roles.length * cardHeight, rest = top.length + status.length + 1;
  const header = [...(height - big.length - rest >= need || height - 1 - rest < need ? big : compact), ...top];
  const room = Math.max(1, height - header.length - status.length - 1);
  const density = pixel && cardWidth >= 50 && roles.length * cardHeight <= room ? 'pixel' : cardWidth >= 34 && roles.length * 9 <= room ? 'full' : cardWidth >= 22 && roles.length * 5 <= room ? 'mini' : 'line';
  const blocks = roles.map((row, index) => {
    const selectedRole = index === selected, block = density === 'line' ? [roleLine(row, selectedRole, frame, now)]
      : density === 'pixel' ? pixelCard(row, selectedRole, cardWidth, t, tick, now) : card(row, selectedRole, cardWidth, density, frame, now);
    if (selectedRole && density !== 'line' && block.length) block[Math.floor(block.length / 2)].push(['←', 'bold', 'fg:accent']);
    return block;
  });
  const start = blocks.slice(0, selected).flat().length, end = start + (blocks[selected]?.length ?? 0), offset = end > room ? end - room : 0;
  const body = blocks.flat().slice(offset, offset + room);
  const lines = [...header, ...body, ...status, footer];
  return lines.slice(Math.max(0, lines.length - height)).map(segments => compose(segments, width, color).text).join('\n');
}
