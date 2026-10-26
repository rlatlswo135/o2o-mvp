// 날짜·시각 규칙(한국 시간, 연도 범위, 종료 계산)은 서버와 같은 shared 규칙을 쓴다. 여기는 화면 표시만 둔다.
import { dateOf, dayRange, formatDate, kstParts, timeOf } from "@o2o/shared/contracts";

export {
  addDays,
  dateOf,
  dayRange,
  formatDate,
  isSupportedDate,
  isValidTime,
  maxYear,
  minYear,
  parseDate,
  scheduleOf,
  startAtOf,
  timeOf,
} from "@o2o/shared/contracts";
export type { CalendarDate } from "@o2o/shared/contracts";

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
