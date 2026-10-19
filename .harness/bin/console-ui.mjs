// Left board of the pane-first console: title, token gauges, role cards, then pipeline and story under the cards.
import { fit, columns } from './terminal.mjs';
import { elapsed, phases, actions } from './signals.mjs';
import { character, miniCharacter } from './characters.mjs';
export { phases, actions };

const TOKENS = {
  accent: ['#FF5FA2', 205], shadow: ['#9E2F63', 125], alert: ['#D9534F', 167], border: ['#5C5C66', 240], dim: ['#8A8A94', 245],
  low: ['#7AC7FF', 117], mid: ['#F5D76E', 221], high: ['#FF5F87', 204],
  fire0: ['#7A1712', 88], fire1: ['#C62D1F', 160], fire2: ['#FF6A13', 202], fire3: ['#FFA51F', 214], fire4: ['#FFE066', 221], fire5: ['#FFF4D6', 230],
  ok0: ['#1E6B3F', 29], ok1: ['#2FB36A', 35], ok2: ['#6EE7A0', 84], ok3: ['#D2FFE2', 194], okBg: ['#1F9D55', 29],
  planner: ['#FFAF5F', 215], executor: ['#87D7FF', 117], reviewer: ['#AFD787', 150], designer: ['#FF87AF', 211], qa: ['#AF87FF', 141],
};
const STALE = 6 * 3600000, CARD = 76;

export function colorMode(env = process.env) {
  if (env.NO_COLOR !== undefined || env.TERM === 'dumb') return null;
  return /truecolor|24bit/i.test(env.COLORTERM ?? '') ? 'truecolor' : '256';
}

function sgr(style, mode) {
  return style.map(item => {
    if (item === 'bold') return '1';
    if (item === 'white') return '97';
    const [kind, name] = item.split(':'), [hex, fallback] = TOKENS[name], base = kind === 'bg' ? 48 : 38;
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

function title(width) {
  if (width < 40) return [[[' C2KIM', 'bold', 'fg:accent'], [' HARNESS', 'fg:dim']]];
  return BIG.map((row, y) => [[' '], ...[...row].map(ch => [ch, ...(ch === '█' ? ['fg:accent'] : ch === ' ' ? [] : ['fg:shadow'])]),
    ...(width >= 78 && y >= 2 && y <= 4 ? [['  '], [HARNESS[y - 2], 'fg:accent']] : [])]);
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
// A finished story replaces the story line with a green banner whose frame shimmers, so completion is hard to miss.
function doneBanner(state, width, frame, count) {
  const text = [` ✔ ${state.story} 완료 `, 'bold', 'white', 'bg:okBg'], next = [`  다음 ${(state.next ?? []).join(' + ') || '확인'}`, 'fg:dim'];
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
const hash = value => (Math.imul(value, 2654435761) >>> 0) / 4294967296;
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

export function renderConsole(state, width = 80, height = 24, { color = null, frame = 0, now = Date.now() } = {}) {
  width = Math.max(1, width); height = Math.max(1, height);
  const cardWidth = Math.min(width, CARD), roles = state.roles ?? [], selected = Math.max(0, Math.min(roles.length - 1, state.selected ?? 0));
  const header = [...title(width), [], ...gauges(state.usage, width, now), []];
  // Pipeline and story sit under the cards, where a tall pane otherwise leaves empty space.
  const status = [[], ...(state.pipeline ? pipelineRows(state.pipeline, width) : [])];
  const alerts = roles.filter(row => row.alert).length, count = alerts ? [` ! 알림 ${alerts} `, 'bold', 'white', 'bg:alert'] : null;
  const story = state.story ? [[' '], [state.story, 'bold'], [` · ${state.phaseLabel ?? phases[state.phase] ?? state.phase ?? ''} · 다음 ${(state.next ?? []).join(' + ') || '확인'}`, 'fg:dim']] : [[' 활성 스토리 없음', 'fg:dim']];
  if (state.phase === 'done' && state.story) status.push(...doneBanner(state, cardWidth, frame, count));
  else status.push(count ? [...padded(story, Math.max(0, cardWidth - size(count[0]))), count] : story);
  for (const problem of [state.notice, ...(state.problems ?? [])].filter(Boolean).slice(0, 2)) status.push([[` ! ${problem}`, 'fg:alert']]);
  const footer = [[width >= 44 ? ' ↑↓ 역할 · Tab 입력창 (CLI에서 Tab = 복귀)' : ' ↑↓ 역할 · Tab 입력창', 'fg:dim']];
  const room = Math.max(1, height - header.length - status.length - 1);
  const density = cardWidth >= 34 && roles.length * 9 <= room ? 'full' : cardWidth >= 22 && roles.length * 5 <= room ? 'mini' : 'line';
  const blocks = roles.map((row, index) => density === 'line' ? [roleLine(row, index === selected, frame, now)] : card(row, index === selected, cardWidth, density, frame, now));
  const body = blocks.flat(), start = blocks.slice(0, selected).flat().length, end = start + (blocks[selected]?.length ?? 0);
  const offset = end > room ? end - room : 0;
  const lines = [...header, ...body.slice(offset, offset + room), ...status, footer];
  return lines.slice(Math.max(0, lines.length - height)).map(segments => compose(segments, width, color).text).join('\n');
}
