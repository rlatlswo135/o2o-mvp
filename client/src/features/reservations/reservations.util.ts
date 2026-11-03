// 예약 모듈에서만 쓰는 시술 시간 계산과 날짜·시각 문구. 한국 시간 계산 자체는 kst가 맡는다.
import type { Kst } from "@o2o/shared/date";

import { kst } from "@o2o/shared/date";

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
  const end = kst(startAt).addMinutes(totalMinutes);
  return end === null ? null : { startAt, endAt: end.ms, totalMinutes };
}

// referenceYear와 연도가 다를 때만 연도를 붙인다
function withYear(at: Kst, text: string, referenceYear: number | undefined) {
  return referenceYear !== undefined && at.year !== referenceYear ? `${at.year}년 ${text}` : text;
}

/** 10월 22일(목) */
export function formatDay(ms: number, referenceYear?: number) {
  const at = kst(ms);
  return withYear(at, at.format("M월 D일(dd)"), referenceYear);
}

/** 10월 22일 14:03 */
export function formatMoment(ms: number, referenceYear?: number) {
  const at = kst(ms);
  return withYear(at, at.format("M월 D일 HH:mm"), referenceYear);
}

/** 10월 22일 목요일 */
export function formatBarDate(date: string) {
  return kst.parseDate(date)?.format("M월 D일 dddd") ?? date;
}

/** 10월 22일 */
export function formatMonthDay(date: string) {
  return kst.parseDate(date)?.format("M월 D일") ?? date;
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
