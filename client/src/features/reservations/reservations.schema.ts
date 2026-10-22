import { z } from "zod";

import {
  endAtOf,
  isSupportedDate,
  isValidTime,
  maxYear,
  minYear,
  parseDate,
  startAtOf,
} from "./reservations.time.ts";

// 예약에 저장하는 값. 고객·시술은 예약 당시의 이름·전화번호·시술명·소요시간을 그대로 담는다
export type ReservationCustomer = { id: number; name: string; phone: string };
export type ReservationTreatment = { id: number; name: string; duration: number };

export type ReservationInput = {
  customer: ReservationCustomer;
  treatment: ReservationTreatment;
  startAt: number;
  endAt: number;
};

// loading: 불러오는 중, unavailable: 실패했거나 0건이라 고를 수 없음
export type ChoiceStatus = "loading" | "unavailable" | "ready";

export type ReservationChoices = {
  customers: { status: ChoiceStatus; items: ReadonlyArray<ReservationCustomer> };
  treatments: { status: ChoiceStatus; items: ReadonlyArray<ReservationTreatment> };
  // 수정할 때 예약에 저장된 시술. 같은 시술을 고르고 있으면 이 이름·소요시간을 유지한다
  keptTreatment: ReservationTreatment | null;
};

export type ReservationFormValues = {
  customerId: string;
  treatmentId: string;
  date: string;
  startTime: string;
};

export type ReservationSchedule = { startAt: number; endAt: number; duration: number };

function findById<T extends { id: number }>(items: ReadonlyArray<T>, id: string) {
  if (!/^\d+$/.test(id)) return undefined;
  const numeric = Number(id);
  return items.find((item) => item.id === numeric);
}

export function resolveTreatment(
  treatmentId: string,
  { treatments, keptTreatment }: Pick<ReservationChoices, "treatments" | "keptTreatment">,
): ReservationTreatment | null {
  const listed = findById(treatments.items, treatmentId);
  if (!listed) return null;
  return keptTreatment?.id === listed.id ? keptTreatment : listed;
}

// 시술·날짜·시작 시각이 모두 올바를 때만 종료 일시를 계산한다. 종료 예정 표시와 저장이 같은 규칙을 쓴다
export function resolveSchedule(
  values: Pick<ReservationFormValues, "treatmentId" | "date" | "startTime">,
  choices: Pick<ReservationChoices, "treatments" | "keptTreatment">,
): ReservationSchedule | null {
  const treatment = resolveTreatment(values.treatmentId, choices);
  if (!treatment || !Number.isSafeInteger(treatment.duration) || treatment.duration <= 0) {
    return null;
  }
  if (!isSupportedDate(values.date)) return null;
  const startAt = startAtOf(values.date, values.startTime);
  if (startAt === null) return null;
  const endAt = endAtOf(startAt, treatment.duration);
  return endAt === null ? null : { startAt, endAt, duration: treatment.duration };
}

const unavailableMessage = {
  customers: "선택할 수 있는 고객이 없어요.",
  treatments: "선택할 수 있는 시술이 없어요.",
} as const;

const loadingMessage = {
  customers: "고객 목록을 불러온 뒤 선택해주세요.",
  treatments: "시술 목록을 불러온 뒤 선택해주세요.",
} as const;

// 고르는 값이 없을 때 필드에 보일 문구. 선택지가 있으면 null
function unselectableMessage(kind: "customers" | "treatments", status: ChoiceStatus) {
  if (status === "loading") return loadingMessage[kind];
  if (status === "unavailable") return unavailableMessage[kind];
  return null;
}

export function reservationInputSchema(choices: ReservationChoices) {
  return z
    .object({
      customerId: z.string(),
      treatmentId: z.string(),
      date: z.string(),
      startTime: z.string(),
    })
    .transform((values, ctx): ReservationInput => {
      let failed = false;
      const fail = (field: keyof ReservationFormValues, message: string) => {
        failed = true;
        ctx.addIssue({ code: "custom", message, path: [field] });
      };

      const customer = findById(choices.customers.items, values.customerId);
      const customerBlocked = unselectableMessage("customers", choices.customers.status);
      if (customerBlocked) fail("customerId", customerBlocked);
      else if (values.customerId === "") fail("customerId", "고객을 선택해주세요.");
      else if (!customer) fail("customerId", "목록에 없는 고객이에요. 다시 선택해주세요.");

      const treatment = resolveTreatment(values.treatmentId, choices);
      const treatmentBlocked = unselectableMessage("treatments", choices.treatments.status);
      if (treatmentBlocked) fail("treatmentId", treatmentBlocked);
      else if (values.treatmentId === "") fail("treatmentId", "시술을 선택해주세요.");
      else if (!treatment) fail("treatmentId", "목록에 없는 시술이에요. 다시 선택해주세요.");
      else if (!Number.isSafeInteger(treatment.duration) || treatment.duration <= 0) {
        fail("treatmentId", "이 시술은 소요시간이 올바르지 않아 예약할 수 없어요.");
      }

      const dateText = values.date.trim();
      const date = parseDate(dateText);
      if (dateText === "") fail("date", "예약 날짜를 입력해주세요.");
      else if (!date) fail("date", "없는 날짜예요. 날짜를 다시 확인해주세요.");
      else if (date.year < minYear || date.year > maxYear) {
        fail("date", `${minYear}~${maxYear}년 사이의 날짜를 입력해주세요.`);
      }

      if (values.startTime === "") fail("startTime", "시작 시각을 입력해주세요.");
      else if (!isValidTime(values.startTime)) {
        fail("startTime", "시작 시각을 분 단위로 다시 입력해주세요.");
      }

      if (failed || !customer || !treatment) return z.NEVER;

      const schedule = resolveSchedule({ ...values, date: dateText }, choices);
      if (!schedule) {
        fail("date", "종료 일시를 계산할 수 없는 날짜예요.");
        return z.NEVER;
      }

      return {
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
        treatment: { id: treatment.id, name: treatment.name, duration: schedule.duration },
        startAt: schedule.startAt,
        endAt: schedule.endAt,
      };
    });
}

export const cancelInputSchema = z.object({
  // 공백만 입력하면 사유 없음으로 저장한다
  reason: z
    .string()
    .trim()
    .max(200, "취소 사유는 200자 이하로 입력해주세요.")
    .transform((text) => (text === "" ? null : text)),
});

export type CancelInput = z.output<typeof cancelInputSchema>;
