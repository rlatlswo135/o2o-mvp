import { z } from "zod";

import { isSupportedDate, isSupportedStartAt, maxYear, minYear } from "./reservations.time.ts";

// id 컬럼은 Postgres integer라서 그 범위를 넘는 값은 DB 오류(500) 대신 입력 오류(400)로 돌려준다.
const recordIdSchema = z.number().int().positive().max(2_147_483_647);

// 예약은 고객·시술을 예약 당시 값(스냅샷)으로 담는다. 마스터가 바뀌거나 지워져도 그대로다.
export const reservationCustomerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
});

export const reservationTreatmentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  duration: z.number().int().positive(),
});

export const reservationSchema = z.object({
  id: z.number().int().positive(),
  customer: reservationCustomerSchema,
  // 고른 순서가 아니라 요청에 담긴 순서다
  treatments: z.array(reservationTreatmentSchema).min(1),
  startAt: z.number().int(),
  endAt: z.number().int(),
  // 취소하면 원래 내용은 그대로 두고 처음 취소한 시각·사유만 채운다
  cancelledAt: z.number().int().nullable(),
  cancelReason: z.string().nullable(),
});

export const reservationIdSchema = z.object({
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const reservationListInputSchema = z.object({
  date: z
    .string()
    .refine(isSupportedDate, `${minYear}~${maxYear}년 사이의 날짜만 조회할 수 있어요.`),
  includeCancelled: z.stringbool().default(false),
});

// 이름·소요시간·종료 일시는 보내지 않는다. 서버가 고객·시술을 확인해 스냅샷과 종료 일시를 정한다.
export const reservationInputSchema = z.object({
  customerId: recordIdSchema,
  treatmentIds: z
    .array(recordIdSchema)
    .min(1, "시술을 1개 이상 선택해주세요.")
    .refine((ids) => new Set(ids).size === ids.length, "같은 시술을 두 번 선택할 수 없어요."),
  startAt: z
    .number()
    .int()
    .refine(
      isSupportedStartAt,
      `시작 일시는 ${minYear}~${maxYear}년(한국 시간)의 분 단위 시각이어야 해요.`,
    ),
});

export const reservationUpdateSchema = reservationInputSchema.extend(reservationIdSchema.shape);

// 클라이언트가 parse한 값을 서버가 다시 parse한다. 공백만 있으면 사유 없음이다.
export const reservationCancelSchema = reservationIdSchema.extend({
  reason: z
    .string()
    .trim()
    .max(200, "취소 사유는 200자 이하로 입력해주세요.")
    .nullable()
    .transform((text) => (text === "" ? null : text)),
});

// 서버가 확정한 입력 거부(422). 어느 항목 때문인지 data로 구분한다
export const reservationRejectionSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("customer_not_found") }),
  z.object({
    reason: z.literal("treatment_not_found"),
    treatmentIds: z.array(z.number().int().positive()),
  }),
  // 시술 시간 합이 너무 길어 종료 일시를 계산할 수 없음
  z.object({ reason: z.literal("schedule_out_of_range") }),
]);

// 이미 취소된 예약(409). 재조회에 기대지 않도록 서버가 확인한 예약을 함께 준다
export const reservationCancelledSchema = z.object({ reservation: reservationSchema });

export type Reservation = z.output<typeof reservationSchema>;
export type ReservationCustomer = z.output<typeof reservationCustomerSchema>;
export type ReservationTreatment = z.output<typeof reservationTreatmentSchema>;
export type ReservationListInput = z.input<typeof reservationListInputSchema>;
export type ReservationInput = z.output<typeof reservationInputSchema>;
export type ReservationUpdate = z.output<typeof reservationUpdateSchema>;
export type ReservationCancel = z.output<typeof reservationCancelSchema>;
export type ReservationRejection = z.output<typeof reservationRejectionSchema>;
