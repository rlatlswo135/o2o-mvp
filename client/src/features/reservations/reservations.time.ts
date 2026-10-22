// 한국 샵 기준(Asia/Seoul, UTC+9, 서머타임 없음)의 날짜·시각 계산. 브라우저 시간대를 쓰지 않는다.
// 시각은 epoch ms로 저장하고, 날짜 문자열은 YYYY-MM-DD, 시각 문자열은 HH:MM이다.
const offsetMs = 9 * 60 * 60 * 1000;
const minuteMs = 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;
const longWeekdays = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

// 날짜 바·입력이 다루는 연도 범위
export const minYear = 2000;
export const maxYear = 2099;
const maxEndYear = 9999;

export type CalendarDate = { year: number; month: number; day: number };

type KstParts = CalendarDate & { hour: number; minute: number; weekday: number };

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

// 실제로 있는 날짜인 YYYY-MM-DD만 돌려준다. Date.UTC는 2월 30일을 3월 2일로 보정하므로 되돌려 비교한다
export function parseDate(text: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(2000, month - 1, day));
  probe.setUTCFullYear(year);
  const exists =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return exists ? { year, month, day } : null;
}

export function isSupportedDate(text: string) {
  const date = parseDate(text);
  return date !== null && date.year >= minYear && date.year <= maxYear;
}

export function formatDate({ year, month, day }: CalendarDate) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function kstParts(ms: number): KstParts {
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

// minYear 이상 날짜만 받는다(Date.UTC가 0~99년을 1900년대로 보정한다)
function dayStart({ year, month, day }: CalendarDate) {
  return Date.UTC(year, month - 1, day) - offsetMs;
}

export function todayKst(now = Date.now()) {
  return formatDate(kstParts(now));
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
  if (!date || date.year < minYear) return null;
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

// 달력에 나타낼 수 없을 만큼 먼 종료 일시는 계산할 수 없는 것으로 본다
export function endAtOf(startAt: number, durationMinutes: number): number | null {
  const endAt = startAt + durationMinutes * minuteMs;
  if (!Number.isSafeInteger(endAt)) return null;
  const end = new Date(endAt + offsetMs);
  if (Number.isNaN(end.getTime()) || end.getUTCFullYear() > maxEndYear) return null;
  return endAt;
}

// referenceYear와 연도가 다를 때만 연도를 붙인다
function yearPrefix(year: number, referenceYear: number | undefined) {
  return referenceYear !== undefined && year !== referenceYear ? `${year}년 ` : "";
}

/** 10월 22일(목) */
export function formatDay(ms: number, referenceYear?: number) {
  const { year, month, day, weekday } = kstParts(ms);
  return `${yearPrefix(year, referenceYear)}${month}월 ${day}일(${weekdays[weekday]})`;
}

/** 10월 22일 목요일 */
export function formatBarDate(text: string) {
  const range = dayRange(text);
  if (!range) return text;
  const { month, day, weekday } = kstParts(range.from);
  return `${month}월 ${day}일 ${longWeekdays[weekday]}`;
}

/** 10월 22일 */
export function formatMonthDay(text: string) {
  const range = dayRange(text);
  if (!range) return text;
  const { month, day } = kstParts(range.from);
  return `${month}월 ${day}일`;
}

/** 10월 22일 14:03 */
export function formatMoment(ms: number, referenceYear?: number) {
  const { year, month, day } = kstParts(ms);
  return `${yearPrefix(year, referenceYear)}${month}월 ${day}일 ${timeOf(ms)}`;
}

export function yearOf(ms: number) {
  return kstParts(ms).year;
}

export function sameDay(a: number, b: number) {
  return dateOf(a) === dateOf(b);
}
