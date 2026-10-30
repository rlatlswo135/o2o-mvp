// 한국 시간(Asia/Seoul, UTC+9, 서머타임 없음) 날짜·시각 계산. 브라우저·서버 시간대를 쓰지 않는다.
// 시각은 epoch ms, 날짜 문자열은 YYYY-MM-DD, 시각 문자열은 HH:MM이다.
const offsetMs = 9 * 60 * 60 * 1000;
export const minuteMs = 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
// 달력에 나타낼 수 있는 마지막 연도
const maxCalendarYear = 9999;

export type CalendarDate = { year: number; month: number; day: number };

export type KstParts = CalendarDate & { hour: number; minute: number; weekday: number };

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

// Date.UTC는 0~99년을 1900년대로 보정하므로 연도를 따로 넣는다
function utcDate({ year, month, day }: CalendarDate) {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}

// 실제로 있는 날짜인 YYYY-MM-DD만 돌려준다. 2월 30일은 3월 2일로 보정되므로 되돌려 비교한다
export function parseDate(text: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const probe = utcDate(date);
  const exists =
    probe.getUTCFullYear() === date.year &&
    probe.getUTCMonth() === date.month - 1 &&
    probe.getUTCDate() === date.day;
  return exists ? date : null;
}

export function formatDate({ year, month, day }: CalendarDate) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function kstParts(ms: number): KstParts {
  const shifted = new Date(ms + offsetMs);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function dayStart(date: CalendarDate) {
  return utcDate(date).getTime() - offsetMs;
}

export function dateOf(ms: number) {
  return formatDate(kstParts(ms));
}

export function timeOf(ms: number) {
  const { hour, minute } = kstParts(ms);
  return `${pad(hour)}:${pad(minute)}`;
}

export function addDays(text: string, days: number) {
  const date = parseDate(text);
  if (!date) throw new Error(`날짜 형식이 아니에요: ${text}`);
  return dateOf(dayStart(date) + days * dayMs);
}

// 그 날짜(한국 시간 0시)부터 다음 날 0시 전까지
export function dayRange(text: string): { from: number; to: number } | null {
  const date = parseDate(text);
  if (!date) return null;
  const from = dayStart(date);
  return { from, to: from + dayMs };
}

export function isValidTime(text: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

export function startAtOf(dateText: string, timeText: string): number | null {
  const range = dayRange(dateText);
  if (!range || !isValidTime(timeText)) return null;
  const hour = Number(timeText.slice(0, 2));
  const minute = Number(timeText.slice(3, 5));
  return range.from + (hour * 60 + minute) * minuteMs;
}

// 달력에 나타낼 수 없을 만큼 먼 시각은 계산할 수 없는 것으로 본다
export function addMinutes(ms: number, minutes: number): number | null {
  const result = ms + minutes * minuteMs;
  if (!Number.isSafeInteger(result)) return null;
  const shifted = new Date(result + offsetMs);
  if (Number.isNaN(shifted.getTime()) || shifted.getUTCFullYear() > maxCalendarYear) return null;
  return result;
}
