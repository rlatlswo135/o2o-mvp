import { describe, expect, it } from "vite-plus/test";

import { kst } from "./kst.ts";

// 2026-10-22 14:03 KST
const sample = Date.UTC(2026, 9, 22, 5, 3);

describe("시각 읽기", () => {
  it("epoch ms를 한국 날짜·시각으로 읽는다", () => {
    const at = kst(sample);
    expect(at.date()).toBe("2026-10-22");
    expect(at.time()).toBe("14:03");
    expect([at.year, at.month, at.day, at.weekday]).toEqual([2026, 10, 22, 4]);
    expect(at.ms).toBe(sample);
  });

  it("UTC로는 전날이어도 한국 0시가 지났으면 다음 날이다", () => {
    expect(kst(Date.UTC(2026, 9, 21, 15, 0)).date()).toBe("2026-10-22");
    expect(kst(Date.UTC(2026, 9, 21, 14, 59)).date()).toBe("2026-10-21");
  });

  it("형식 문자열의 요일은 한국어로 쓴다", () => {
    expect(kst(sample).format("M월 D일(dd) dddd")).toBe("10월 22일(목) 목요일");
  });

  it("같은 한국 날짜인지 비교한다", () => {
    expect(kst(sample).isSameDay(kst(Date.UTC(2026, 9, 21, 15, 0)))).toBe(true);
    expect(kst(sample).isSameDay(kst(Date.UTC(2026, 9, 22, 15, 0)))).toBe(false);
  });

  it("나타낼 수 없는 시각은 유효하지 않다", () => {
    expect(kst(9e15).isValid()).toBe(false);
  });
});

describe("문자열 읽기", () => {
  it("YYYY-MM-DD를 그 날 한국 0시로 읽는다", () => {
    expect(kst.parseDate("2026-10-22")?.ms).toBe(Date.UTC(2026, 9, 21, 15, 0));
  });

  it("없는 날짜와 형식이 다른 문자열은 null이다", () => {
    for (const text of [
      "2026-02-29",
      "2026-02-30",
      "2026-13-01",
      "2026-04-31",
      "2026-1-01",
      " 2026-10-22",
      "",
    ]) {
      expect(kst.parseDate(text), text).toBeNull();
    }
    expect(kst.parseDate("2024-02-29")?.date()).toBe("2024-02-29");
  });

  it("0~99년도 그 연도 그대로 읽는다", () => {
    expect(kst.parseDate("0050-01-01")?.year).toBe(50);
  });

  it("날짜와 HH:mm을 한국 시각으로 읽는다", () => {
    expect(kst.parseDateTime("2026-10-22", "14:03")?.ms).toBe(sample);
    expect(kst.parseDateTime("2026-10-22", "24:00")).toBeNull();
    expect(kst.parseDateTime("2026-10-22", "9:00")).toBeNull();
    expect(kst.parseDateTime("2026-02-30", "09:00")).toBeNull();
  });

  it("HH:mm 형식인지 확인한다", () => {
    expect(kst.isTime("23:59")).toBe(true);
    expect(kst.isTime("12:60")).toBe(false);
  });
});

describe("계산", () => {
  it("날짜를 더하고 뺀다", () => {
    const day = kst.parseDate("2026-12-31");
    expect(day?.addDays(1).date()).toBe("2027-01-01");
    expect(day?.addDays(-365).date()).toBe("2025-12-31");
  });

  it("그 날 한국 0시부터 다음 날 0시 전까지의 범위", () => {
    expect(kst(sample).dayRange()).toEqual({
      from: Date.UTC(2026, 9, 21, 15, 0),
      to: Date.UTC(2026, 9, 22, 15, 0),
    });
  });

  it("분을 더한다. 달력에 나타낼 수 없으면 null", () => {
    expect(kst(sample).addMinutes(90)?.time()).toBe("15:33");
    expect(kst(sample).addMinutes(600)?.date()).toBe("2026-10-23");
    expect(
      kst(Date.UTC(9999, 11, 31, 14, 58))
        .addMinutes(1)
        ?.date(),
    ).toBe("9999-12-31");
    expect(kst(Date.UTC(9999, 11, 31, 14, 59)).addMinutes(1)).toBeNull();
    expect(kst(0).addMinutes(Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});
