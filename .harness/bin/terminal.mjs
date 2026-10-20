export const clean = value => String(value ?? '').replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
export const columns = character => /\p{Mark}/u.test(character) ? 0 : /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\uffe0-\uffe6\u{1f300}-\u{1faff}]/u.test(character) ? 2 : 1;

export function fit(value, width) {
  let result = '', used = 0;
  for (const character of clean(value)) { const size = columns(character); if (used + size > width) break; result += character; used += size; }
  return result;
}
