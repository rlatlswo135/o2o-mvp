import { emitKeypressEvents, cursorTo, moveCursor, clearScreenDown } from 'node:readline';
import { DEFAULT_LAYOUT, ROLES, validateLayout } from './layout.mjs';

const cancelled = () => Object.assign(new Error('설정을 취소했습니다. 변경한 파일은 없습니다.'), { code: 'ABORT_ERR' });
function fit(text, columns) { let width = 0, result = ''; for (const char of text) { width += char.codePointAt(0) > 127 ? 2 : 1; if (width > columns - 1) break; result += char; } return result; }

export async function selectRoles({ input = process.stdin, output = process.stdout, initial = DEFAULT_LAYOUT } = {}) {
  if (!input.isTTY || !output.isTTY) throw new Error('Role selection requires an interactive terminal.');
  const selected = new Set(validateLayout(initial).roles);
  const wasRaw = Boolean(input.isRaw); let listener, ended, failed, rendered = 0, current = 0, warning = '';
  const draw = () => {
    if (rendered) moveCursor(output, 0, -rendered);
    cursorTo(output, 0); clearScreenDown(output);
    const lines = ['역할 선택 — ↑/↓ 이동 · Space 선택/해제 · Enter 진행 · Esc 취소', ...ROLES.map((role, i) => `${i === current ? '>' : ' '} [${selected.has(role) ? 'x' : ' '}] ${role}`)];
    if (warning) lines.push(warning);
    const width = Math.max(1, (output.columns || 80) - 1);
    output.write(lines.map(line => fit(line, width)).join('\n') + '\n'); rendered = lines.length;
  };
  emitKeypressEvents(input);
  try {
    input.setRawMode(true); output.write('\x1b[?25l');
    const result = await new Promise((resolve, reject) => {
      ended = () => reject(cancelled()); failed = reject;
      listener = (_text, key = {}) => {
        if (key.ctrl && ['c', 'd'].includes(key.name) || key.name === 'escape') return ended();
        if (key.name === 'up') current = (current + ROLES.length - 1) % ROLES.length;
        else if (key.name === 'down') current = (current + 1) % ROLES.length;
        else if (key.name === 'space') { const role = ROLES[current]; selected.has(role) ? selected.delete(role) : selected.add(role); }
        else if (key.name === 'return' || key.name === 'enter') {
          if (!selected.size) { warning = '역할을 하나 이상 선택하세요.'; draw(); return; }
          return resolve(validateLayout({ roles: ROLES.filter(role => selected.has(role)) }));
        } else return;
        warning = ''; draw();
      };
      input.on('keypress', listener); input.once('end', ended); input.once('close', ended); input.once('error', failed);
      draw(); input.resume();
    });
    return result;
  } finally {
    if (listener) input.removeListener('keypress', listener);
    if (ended) { input.removeListener('end', ended); input.removeListener('close', ended); }
    if (failed) input.removeListener('error', failed);
    input.setRawMode(wasRaw); input.pause(); output.write('\x1b[?25h\n');
  }
}
