// 한국 시간 계산은 shared/date, 예약 연도 범위는 계약 규칙을 쓴다. 여기는 화면 표시와 종료 예정 계산만 둔다.
import { addMinutes, dateOf, dayRange, formatDate, kstParts, timeOf } from "@o2o/shared/date";

export {
  addDays,
  dateOf,
  dayRange,
  formatDate,
  isValidTime,
  parseDate,
  startAtOf,
  timeOf,
} from "@o2o/shared/date";
export type { CalendarDate } from "@o2o/shared/date";
export { isSupportedDate, maxYear, minYear } from "@o2o/shared/contracts";

export const isValidDuration = (minutes: number) => Number.isSafeInteger(minutes) && minutes > 0;

// 고른 시술 시간의 합. 올바르지 않은 시간이 있거나 합이 안전 정수를 넘으면 null
export function totalMinutesOf(durations: ReadonlyArray<number>): number | null {
  let total = 0;
  for (const minutes of durations) {
    if (!isValidDuration(minutes)) return null;
    total += minutes;
    if (!Number.isSafeInteger(total)) return null;
  }
  return durations.length === 0 ? null : total;
}

export type Schedule = { startAt: number; endAt: number; totalMinutes: number };

// 종료 = 한국 시간 시작 일시 + 모든 시술 시간의 합
export function scheduleOf(startAt: number, durations: ReadonlyArray<number>): Schedule | null {
  const totalMinutes = totalMinutesOf(durations);
  if (totalMinutes === null) return null;
  const endAt = addMinutes(startAt, totalMinutes);
  return endAt === null ? null : { startAt, endAt, totalMinutes };
}

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

export function todayKst(now = Date.now()) {
  return formatDate(kstParts(now));
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

export const formatMinutes = (minutes: number) => `${minutes.toLocaleString("ko-KR")}분`;

/** 총 45분, 총 90분 (1시간 30분), 총 1,500분 (25시간) */
export function formatTotal(minutes: number) {
  const total = `총 ${formatMinutes(minutes)}`;
  if (minutes < 60) return total;
  const hours = Math.floor(minutes / 60).toLocaleString("ko-KR");
  const rest = minutes % 60;
  return `${total} (${hours}시간${rest === 0 ? "" : ` ${rest}분`})`;
}

export function yearOf(ms: number) {
  return kstParts(ms).year;
}

export function sameDay(a: number, b: number) {
  return dateOf(a) === dateOf(b);
}
