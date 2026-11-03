// 한국 시간(Asia/Seoul) 날짜·시각 계산. 문구와 도메인 규칙은 쓰는 쪽이 정한다.
// 시각은 epoch ms, 날짜 문자열은 YYYY-MM-DD, 시각 문자열은 HH:mm이다.
import type { Dayjs } from "dayjs";

import dayjs from "dayjs";
import "dayjs/locale/ko.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

export const minuteMs = 60 * 1000;
// 서머타임이 없어 고정 오프셋이다
const offsetMs = 9 * 60 * minuteMs;
// YYYY-MM-DD로 나타낼 수 있는 마지막 연도
const maxCalendarYear = 9999;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// dayjs의 utcOffset·timezone은 실행 환경 시간대의 서머타임에 따라 계산이 어긋난다.
// 그래서 한국 벽시계 시각을 UTC 모드 dayjs로 들고 계산하고, epoch ms로 오갈 때만 9시간을 더하고 뺀다.
// 생성은 kst()로만 한다. Dayjs가 밖으로 새지 않게 클래스는 타입만 내보낸다
class Kst {
  readonly #wall: Dayjs;

  constructor(wall: Dayjs) {
    this.#wall = wall.locale("ko");
  }

  get ms() {
    return this.#wall.valueOf() - offsetMs;
  }

  get year() {
    return this.#wall.year();
  }

  // 1~12
  get month() {
    return this.#wall.month() + 1;
  }

  get day() {
    return this.#wall.date();
  }

  // 0(일)~6(토)
  get weekday() {
    return this.#wall.day();
  }

  isValid() {
    return this.#wall.isValid();
  }

  date() {
    return this.#wall.format("YYYY-MM-DD");
  }

  time() {
    return this.#wall.format("HH:mm");
  }

  // dayjs 형식 문자열. 요일 이름은 한국어(dd: 목, dddd: 목요일)
  format(template: string) {
    return this.#wall.format(template);
  }

  isSameDay(other: Kst) {
    return this.date() === other.date();
  }

  startOfDay() {
    return new Kst(this.#wall.startOf("day"));
  }

  addDays(days: number) {
    return new Kst(this.#wall.add(days, "day"));
  }

  // 달력에 나타낼 수 없을 만큼 먼 시각은 계산할 수 없는 것으로 본다
  addMinutes(minutes: number): Kst | null {
    const ms = this.ms + minutes * minuteMs;
    if (!Number.isSafeInteger(ms)) return null;
    const result = at(ms);
    return result.isValid() && result.year <= maxCalendarYear ? result : null;
  }

  // 그 날 0시부터 다음 날 0시 전까지
  dayRange(): { from: number; to: number } {
    const start = this.startOfDay();
    return { from: start.ms, to: start.addDays(1).ms };
  }
}

function at(ms: number) {
  return new Kst(dayjs.utc(ms + offsetMs));
}

// 실제로 있는 날짜·시각만 받는다. 2월 30일처럼 넘친 날짜는 되돌려 비교해 거른다
function parseDateTime(dateText: string, timeText: string): Kst | null {
  if (!datePattern.test(dateText) || !timePattern.test(timeText)) return null;
  // Z로 끝나는 ISO 문자열은 Date가 직접 읽어 0~99년도 그대로 받는다
  const result = new Kst(dayjs.utc(`${dateText}T${timeText}:00Z`));
  return result.isValid() && result.date() === dateText ? result : null;
}

export type { Kst };

export const kst = Object.assign(at, {
  now: () => at(Date.now()),
  // 그 날 0시
  parseDate: (text: string) => parseDateTime(text, "00:00"),
  parseDateTime,
  isTime: (text: string) => timePattern.test(text),
});
