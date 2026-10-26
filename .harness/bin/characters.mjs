// Role characters: box head plus a role prop. Decoration only; a moving sprite is not evidence of model activity.
export const POSES = ['idle', 'working', 'sleeping', 'alert', 'quiet', 'error', 'offline'];

// 15 columns x 7 rows. `eyes` is the face token swapped for closed or error eyes.
const ART = {
  refactor: { eyes: ['o   o', '─   ─', '>   <'], rows: ['  .@@@@@@@.    ', ' @@╭─────╮@@   ', ' @@│o   o│@@   ', '   │ ┴┴┴ │  ♫  ', '   ╰┬───┬╯ ╱╱  ', '   ╱│   │╲◢━   ', '    ┘   └      '] },
  planner: { eyes: ['•   •', '─   ─', '>   <'], rows: ['               ', '╭───────╮ ┌───┐', '│ •   • │ │✓──│', '│   ‿   │─┤✓──│', '╰─┬───┬─╯ │·──│', '  │   │   └───┘', '  ┘   └        '] },
  designer: { eyes: ['◠   ◠', '─   ─', '>   <'], rows: [' .@@@@@@@@@.   ', '@@╭───────╮@@  ', '@@│ ◠   ◠ │@@  ', ' @│ ╲www╱ │@   ', '  ╰─┬───┬─╯  ● ', '   ╱│   │╲══╱  ', '    ┘   └      '] },
  executor: { eyes: ['o   o', '─   ─', '>   <'], rows: ['               ', '  ╭───────╮    ', '  │ o   o │    ', '  │   ▿   │    ', '  ╰─┬───┬─╯    ', ' ┌──╨───╨──┐   ', ' │▄▄▄█▄▄▄▄▄│   '] },
  reviewer: { eyes: ['(•)-(•)', '(─)-(─)', '(>)-(<)'], rows: ['               ', '╭───────╮      ', '│(•)-(•)│      ', '│   ─   │ ┌───┐', '╰─┬───┬─╯ │≡ ✓│', ' ╱│   │───┤≡ ✗│', '  ┘   └   └───┘'] },
  qa: { eyes: ['•   ⊙', '─   ─', '>   <'], rows: ['    ▄▄▄▄▄      ', ' ▄█████████▄   ', '  │ •   ⊙ │    ', '  │   o   │    ', '  ╰─┬───┬─╯╭─╮ ', '   ╱│   │──┤ │ ', '    ┘   └  ╰─╯ '] },
};

// Working animation: row replacements per frame (four frames, 300ms each).
const WORK = {
  refactor: frame => ({ 3: `   │ ┴┴┴ │  ${frame % 2 ? '♪' : '♫'}  `, 5: frame % 2 ? '   ╱│   │╲◢≈   ' : '   ╱│   │╲◢━   ' }),
  planner: frame => ({ 2: `│ •   • │ │${frame > 0 ? '✓' : '·'}──│`, 3: `│   ‿   │─┤${frame > 1 ? '✓' : '·'}──│`, 4: `╰─┬───┬─╯ │${frame > 2 ? '✓' : '·'}──│` }),
  designer: frame => ({ 6: '    ┘   └ ' + '~'.repeat(frame + 1).padEnd(5) }),
  executor: frame => ({ 6: ' │' + '▄▄▄▄▄▄▄▄▄'.split('').map((key, at) => at === [1, 5, 3, 7][frame] ? '█' : key).join('') + '│   ' }),
  reviewer: frame => frame % 2 ? { 5: ' ╱│   │───┤✎ ✗│' } : { 4: '╰─┬───┬─╯ │✎ ✓│' },
  qa: frame => frame % 2 ? {} : { 4: '  ╰─┬───┬─╯ ╭─╮', 5: '   ╱│   │───┤ │', 6: '    ┘   └   ╰─╯' },
};

// 7 columns x 3 rows for compact cards.
const MINI = {
  refactor: { eyes: ['o o', '─ ─', '> <'], rows: ['@@@@@  ', '│o o│♪ ', '╰┬┴┬╯  '], work: ['♪', '♫'] },
  planner: { eyes: ['• •', '─ ─', '> <'], rows: ['╭───╮  ', '│• •│✓ ', '╰┬─┬╯  '], work: ['·', '✓'] },
  designer: { eyes: ['◠ ◠', '─ ─', '> <'], rows: ['@@@@@  ', '│◠ ◠│● ', '╰┬─┬╯  '], work: ['~', '≈'] },
  executor: { eyes: ['o o', '─ ─', '> <'], rows: ['╭───╮  ', '│o o│  ', '▄▄█▄▄  '], work: null },
  reviewer: { eyes: ['•-•', '─-─', '>-<'], rows: ['╭───╮  ', '│•-•│≡ ', '╰┬─┬╯  '], work: ['✎', '≡'] },
  qa: { eyes: ['• ⊙', '─ ─', '> <'], rows: ['▄███▄  ', '│• ⊙│○ ', '╰┬─┬╯  '], work: ['◌', '●'] },
};

const ghost = row => row.replaceAll('─', '┄').replaceAll('│', '┆').replaceAll('━', '┅');
const overlay = (row, at, text) => { const chars = [...row]; chars.splice(at, [...text].length, ...text); return chars.join(''); };

function shape(art, pose, frame, { mark, alert }) {
  let rows = [...art.rows];
  const eyes = kind => { rows[art.eyeRow] = rows[art.eyeRow].replace(art.eyes[0], art.eyes[kind]); };
  if (pose === 'working') { const step = art.work(frame % 4); rows = rows.map((row, at) => step[at] ?? row); }
  if (pose === 'sleeping' || pose === 'offline' || pose === 'idle' && frame % 10 === 9) eyes(1);
  if (pose === 'error') eyes(2);
  if (pose === 'sleeping') rows[0] = overlay(rows[0], mark, frame % 2 ? 'zZ' : 'z ');
  if (pose === 'alert') rows[0] = overlay(rows[0], mark, alert);
  if (pose === 'quiet') rows[0] = overlay(rows[0], mark, '…?');
  if (pose === 'offline') rows = rows.map(ghost);
  return rows;
}

export function character(role, pose = 'idle', frame = 0) {
  return shape({ ...ART[role], eyeRow: 2, work: WORK[role] }, pose, frame, { mark: 12, alert: '‹!›' });
}

export function miniCharacter(role, pose = 'idle', frame = 0) {
  const art = MINI[role];
  const work = step => art.work ? { 1: overlay(art.rows[1], 5, art.work[step % 2]) } : { 2: step % 2 ? '▄▄▄▄█  ' : '▄█▄▄▄  ' };
  return shape({ ...art, eyeRow: 1, work }, pose, frame, { mark: 5, alert: '!' });
}
