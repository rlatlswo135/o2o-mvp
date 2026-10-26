import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";

import {
  reservationCancelSchema,
  reservationInputSchema,
  reservationListInputSchema,
  reservationSchema,
  reservationUpdateSchema,
} from "./reservations.schema.ts";
import { snapshotTreatments } from "./reservations.snapshot.ts";
import { endAtOf, scheduleOf, startAtOf, totalMinutesOf } from "./reservations.time.ts";

const at = (date: string, time: string) => {
  const ms = startAtOf(date, time);
  if (ms === null) throw new Error(`${date} ${time}`);
  return ms;
};

const valid = { customerId: 1, treatmentIds: [1, 2], startAt: at("2026-10-26", "23:30") };

function fieldErrors(input: unknown) {
  const { error } = reservationInputSchema.safeParse(input);
  return error ? z.flattenError(error).fieldErrors : {};
}

describe("날짜별 조회 입력", () => {
  it("취소 포함은 주소의 문자열 'false'를 false로 읽고, 없으면 꺼짐이다", () => {
    expect(
      reservationListInputSchema.parse({ date: "2026-10-26", includeCancelled: "false" }),
    ).toEqual({
      date: "2026-10-26",
      includeCancelled: false,
    });
    expect(
      reservationListInputSchema.parse({ date: "2026-10-26", includeCancelled: "true" })
        .includeCancelled,
    ).toBe(true);
    expect(reservationListInputSchema.parse({ date: "2026-10-26" }).includeCancelled).toBe(false);
    expect(
      reservationListInputSchema.safeParse({ date: "2026-10-26", includeCancelled: "yes please" })
        .success,
    ).toBe(false);
  });

  it.each([
    { date: "2000-01-01", ok: true },
    { date: "2099-12-31", ok: true },
    { date: "1999-12-31", ok: false },
    { date: "2100-01-01", ok: false },
    { date: "2026-02-30", ok: false },
    { date: "2026-1-5", ok: false },
  ])("조회 날짜 $date → $ok", ({ date, ok }) => {
    expect(reservationListInputSchema.safeParse({ date }).success).toBe(ok);
  });
});

describe("예약 입력", () => {
  it("고객 ID·서로 다른 시술 ID 목록·분 단위 시작 시각만 받는다", () => {
    expect(reservationInputSchema.parse(valid)).toEqual(valid);
    expect(reservationInputSchema.parse({ ...valid, treatmentIds: [7] }).treatmentIds).toEqual([7]);
  });

  it.each([
    { case: "시술 0개", treatmentIds: [], message: "시술을 1개 이상 선택해주세요." },
    {
      case: "같은 시술 두 번",
      treatmentIds: [1, 1],
      message: "같은 시술을 두 번 선택할 수 없어요.",
    },
  ])("$case → $message", ({ treatmentIds, message }) => {
    expect(fieldErrors({ ...valid, treatmentIds })).toEqual({ treatmentIds: [message] });
  });

  it("ID는 Postgres integer 범위의 양수만 받는다", () => {
    expect(fieldErrors({ ...valid, customerId: 2_147_483_648 })).toHaveProperty("customerId");
    expect(fieldErrors({ ...valid, customerId: 0 })).toHaveProperty("customerId");
    expect(fieldErrors({ ...valid, treatmentIds: [2_147_483_648] })).toHaveProperty("treatmentIds");
    expect(fieldErrors({ ...valid, treatmentIds: ["1"] })).toHaveProperty("treatmentIds");
  });

  it.each([
    { case: "+1ms", startAt: valid.startAt + 1 },
    { case: "+1초", startAt: valid.startAt + 1000 },
    { case: "소수", startAt: valid.startAt + 0.5 },
  ])("분 경계가 아닌 시작 시각($case)은 거부한다", ({ startAt }) => {
    expect(fieldErrors({ ...valid, startAt })).toHaveProperty("startAt");
  });

  it.each([
    { case: "2000-01-01 00:00", startAt: at("2000-01-01", "00:00"), ok: true },
    { case: "2099-12-31 23:59", startAt: at("2099-12-31", "23:59"), ok: true },
    {
      case: "1999-12-31 23:59 (한국 시간)",
      startAt: at("2000-01-01", "00:00") - 60_000,
      ok: false,
    },
    {
      case: "2100-01-01 00:00 (한국 시간)",
      startAt: at("2099-12-31", "23:59") + 60_000,
      ok: false,
    },
  ])("시작 날짜 범위 $case → $ok", ({ startAt, ok }) => {
    expect(reservationInputSchema.safeParse({ ...valid, startAt }).success).toBe(ok);
  });

  it("수정은 경로의 id를 숫자로 읽는다", () => {
    expect(reservationUpdateSchema.parse({ ...valid, id: "12" }).id).toBe(12);
    expect(reservationUpdateSchema.safeParse({ ...valid, id: "2147483648" }).success).toBe(false);
  });
});

describe("취소 입력", () => {
  it("사유 앞뒤 공백을 지우고 비면 사유 없음이며, 다시 넣어도 같다", () => {
    const once = reservationCancelSchema.parse({ id: "3", reason: "  고객 요청 " });

    expect(once).toEqual({ id: 3, reason: "고객 요청" });
    expect(reservationCancelSchema.parse(once)).toEqual(once);
    expect(reservationCancelSchema.parse({ id: 3, reason: "   " }).reason).toBeNull();
    expect(reservationCancelSchema.parse({ id: 3, reason: null }).reason).toBeNull();
    expect(reservationCancelSchema.safeParse({ id: 3, reason: "가".repeat(201) }).success).toBe(
      false,
    );
  });
});

describe("예약 응답", () => {
  const reservation = {
    id: 1,
    customer: { id: 1, name: "김서연", phone: "01012345678" },
    treatments: [{ id: 1, name: "젤 원컬러", duration: 30 }],
    startAt: valid.startAt,
    endAt: valid.startAt + 30 * 60_000,
    cancelledAt: null,
    cancelReason: null,
  };

  it("시술이 없거나 시각이 숫자가 아니면 계약에 맞지 않는 응답이다", () => {
    expect(reservationSchema.safeParse(reservation).success).toBe(true);
    expect(reservationSchema.safeParse({ ...reservation, treatments: [] }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...reservation, startAt: "2026-10-26" }).success).toBe(
      false,
    );
  });
});

describe("시술 시간 합산과 종료 일시", () => {
  it("30분+60분을 23:30에 시작하면 총 90분, 한국 시간 다음 날 01:00에 끝난다", () => {
    expect(scheduleOf(valid.startAt, [30, 60])).toEqual({
      startAt: valid.startAt,
      endAt: at("2026-10-27", "01:00"),
      totalMinutes: 90,
    });
  });

  it("0개, 올바르지 않은 시간, 안전 정수를 넘는 합은 계산하지 않는다", () => {
    expect(totalMinutesOf([])).toBeNull();
    expect(totalMinutesOf([30, 0])).toBeNull();
    expect(totalMinutesOf([30, 1.5])).toBeNull();
    expect(totalMinutesOf([Number.MAX_SAFE_INTEGER, 1])).toBeNull();
    expect(scheduleOf(valid.startAt, [Number.MAX_SAFE_INTEGER])).toBeNull();
  });

  it("종료 연도는 9999년까지다", () => {
    const start = at("2099-12-31", "00:00");
    const lastMinute = Date.UTC(9999, 11, 31, 23, 59) - 9 * 60 * 60_000;
    const minutes = (lastMinute - start) / 60_000;

    expect(endAtOf(start, minutes)).toBe(lastMinute);
    expect(scheduleOf(start, [minutes - 10, 10])?.endAt).toBe(lastMinute);
    expect(scheduleOf(start, [minutes, 1])).toBeNull();
  });
});

describe("시술 스냅샷", () => {
  const kept = [
    { id: 1, name: "젤 원컬러(예약 당시)", duration: 30 },
    { id: 9, name: "삭제된 시술", duration: 20 },
  ];
  const listed = [
    { id: 1, name: "젤 원컬러", duration: 45 },
    { id: 2, name: "속눈썹 연장", duration: 60 },
  ];

  it("기존 예약 시술은 예약 당시 값, 새 시술은 지금 목록 값을 요청 순서대로 쓴다", () => {
    expect(snapshotTreatments([2, 1, 9], kept, listed)).toEqual({
      kind: "ok",
      treatments: [
        { id: 2, name: "속눈썹 연장", duration: 60 },
        { id: 1, name: "젤 원컬러(예약 당시)", duration: 30 },
        { id: 9, name: "삭제된 시술", duration: 20 },
      ],
    });
  });

  it("등록에는 기존 값이 없어 지금 목록 값을 쓰고, 목록에 없는 시술은 모두 알려준다", () => {
    expect(snapshotTreatments([1], [], listed)).toEqual({
      kind: "ok",
      treatments: [{ id: 1, name: "젤 원컬러", duration: 45 }],
    });
    expect(snapshotTreatments([9, 2, 5], [], listed)).toEqual({
      kind: "missing",
      treatmentIds: [9, 5],
    });
  });
});
