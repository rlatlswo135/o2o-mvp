import type {
  ReservationCustomer,
  ReservationInput,
  ReservationTreatment,
  Schedule,
} from "@o2o/shared/contracts";

import { isValidDuration, snapshotTreatments, totalMinutesOf } from "@o2o/shared/contracts";
import { z } from "zod";

import type { RejectionReason } from "./reservations.api.ts";

import {
  isValidTime,
  maxYear,
  minYear,
  parseDate,
  scheduleOf,
  startAtOf,
} from "./reservations.time.ts";

// loading: 처음 불러오는 중, failed: 받아 둔 목록 없이 실패, empty: 0건, ready: 고를 수 있음
// 다시 불러오다 실패해도 받아 둔 목록이 있으면 ready·empty다
export type ChoiceKind = "loading" | "failed" | "empty" | "ready";

export type ReservationChoices = {
  customers: { kind: ChoiceKind; items: ReadonlyArray<ReservationCustomer> };
  treatments: { kind: ChoiceKind; items: ReadonlyArray<ReservationTreatment> };
  // 수정할 때 예약에 저장된 고객·시술(예약 당시 값). 등록이면 null·빈 목록
  keptCustomer: ReservationCustomer | null;
  keptTreatments: ReadonlyArray<ReservationTreatment>;
  // 이번 시트에서 체크할 때 본 시술 값. 체크한 뒤 목록에서 사라지면 이 값으로 보여준다
  seenTreatments: ReadonlyArray<ReservationTreatment>;
};

export type ReservationFormValues = {
  customerId: string;
  treatmentIds: string[];
  date: string;
  startTime: string;
};

export const reservationFieldNames = ["customerId", "treatmentIds", "date", "startTime"] as const;

export type ReservationFieldErrors = Partial<
  Record<(typeof reservationFieldNames)[number], string>
>;

const isListed = (kind: ChoiceKind) => kind === "ready" || kind === "empty";

function toId(text: string) {
  return /^\d+$/.test(text) ? Number(text) : null;
}

// listed: 지금 목록, kept·kept_changed: 기존 예약 시술(예약 당시 값), deleted: 기존 예약 시술인데 목록에 없음,
// vanished: 이번에 새로 체크한 시술이 다시 불러온 목록에서 빠짐(이름을 모르면 null)
export type TreatmentRowKind = "listed" | "kept" | "kept_changed" | "deleted" | "vanished";

export type TreatmentRow = {
  id: number;
  name: string | null;
  duration: number | null;
  kind: TreatmentRowKind;
};

// 체크 목록에 보이는 행과 순서. 사라진·삭제된 시술은 맨 위, 나머지는 시술 화면 목록 순서다.
// 저장·미리보기의 시술 순서도 이 순서를 따른다
export function treatmentRows(
  checkedIds: ReadonlyArray<string>,
  { treatments, keptTreatments, seenTreatments }: ReservationChoices,
): TreatmentRow[] {
  const listed = isListed(treatments.kind);
  const keptOf = (id: number) => keptTreatments.find((item) => item.id === id);
  const listedIds = new Set(treatments.items.map((item) => item.id));

  const vanished: TreatmentRow[] = [];
  if (listed) {
    for (const text of checkedIds) {
      const id = toId(text);
      if (id === null || keptOf(id) || listedIds.has(id)) continue;
      const seen = seenTreatments.find((item) => item.id === id);
      vanished.push({
        id,
        name: seen?.name ?? null,
        duration: seen?.duration ?? null,
        kind: "vanished",
      });
    }
  }

  // 목록을 모르면 기존 예약 시술만 예약 당시 값으로 보여준다
  if (!listed) {
    return keptTreatments.map((item) => ({ ...item, kind: "kept" }));
  }

  const deleted: TreatmentRow[] = keptTreatments
    .filter((item) => !listedIds.has(item.id))
    .map((item) => ({ ...item, kind: "deleted" }));
  const rest: TreatmentRow[] = treatments.items.map((item) => {
    const kept = keptOf(item.id);
    if (!kept) return { ...item, kind: "listed" };
    const changed = kept.name !== item.name || kept.duration !== item.duration;
    return { ...kept, kind: changed ? "kept_changed" : "kept" };
  });
  return [...vanished, ...deleted, ...rest];
}

// 체크 목록 순서대로 정렬한 체크된 시술. 사라진 시술이 섞여 있으면 missing
function checkedTreatments(checkedIds: ReadonlyArray<string>, choices: ReservationChoices) {
  const checked = new Set(checkedIds);
  const ids = treatmentRows(checkedIds, choices)
    .filter((row) => checked.has(String(row.id)))
    .map((row) => row.id);
  return snapshotTreatments(ids, choices.keptTreatments, choices.treatments.items);
}

export type ReservationPreview = {
  // 체크된 행(체크 목록 순서)
  rows: TreatmentRow[];
  // 모든 분을 알고 더할 수 있을 때만 값이 있다
  totalMinutes: number | null;
  // 날짜·시각까지 올바를 때만 값이 있다
  schedule: Schedule | null;
  // 시술 시간 합 때문에 종료 일시를 계산할 수 없음
  outOfRange: boolean;
};

// 종료 예정 표시와 저장이 같은 규칙(shared scheduleOf)을 쓴다
export function previewSchedule(
  values: Pick<ReservationFormValues, "treatmentIds" | "date" | "startTime">,
  choices: ReservationChoices,
): ReservationPreview {
  const checked = new Set(values.treatmentIds);
  const rows = treatmentRows(values.treatmentIds, choices).filter((row) =>
    checked.has(String(row.id)),
  );
  const durations = rows.map((row) => row.duration);
  const known = durations.every((minutes) => minutes !== null && isValidDuration(minutes));
  const totalMinutes = known ? totalMinutesOf(durations as number[]) : null;
  const empty = { rows, totalMinutes, schedule: null, outOfRange: false };
  if (rows.length === 0 || !known) return empty;
  if (totalMinutes === null) return { ...empty, outOfRange: true };

  const dateText = values.date.trim();
  const date = parseDate(dateText);
  if (!date || date.year < minYear || date.year > maxYear) return empty;
  const startAt = startAtOf(dateText, values.startTime);
  if (startAt === null) return empty;
  const schedule = scheduleOf(startAt, durations as number[]);
  return { ...empty, schedule, outOfRange: schedule === null };
}

export const treatmentMessages = {
  none: "시술을 1개 이상 선택해주세요.",
  loading: "시술 목록을 불러온 뒤 선택해주세요.",
  unavailable: "선택할 수 있는 시술이 없어요.",
  vanished: "목록에서 사라진 시술이 선택돼 있어요. 해제한 뒤 저장해주세요.",
  badDuration: "소요시간이 올바르지 않은 시술이 있어 예약할 수 없어요.",
  outOfRange:
    "고른 시술 시간을 모두 더하면 종료 일시를 계산할 수 없어요. 시술 선택을 확인해주세요.",
  notFound: "더 이상 없는 시술이 있어요. 목록을 새로 불러왔으니 다시 확인해주세요.",
  invalid: "시술 선택을 다시 확인해주세요.",
} as const;

export const customerNotFoundMessage =
  "더 이상 없는 고객이에요. 목록을 새로 불러왔으니 다시 선택해주세요.";

function noTreatmentMessage({ treatments, keptTreatments }: ReservationChoices) {
  // 수정에서는 기존 예약 시술을 목록 상태와 관계없이 고를 수 있다
  if (treatments.kind === "ready" || keptTreatments.length > 0) return treatmentMessages.none;
  return treatments.kind === "loading" ? treatmentMessages.loading : treatmentMessages.unavailable;
}

function customerOf(id: number | null, { customers, keptCustomer }: ReservationChoices) {
  if (id === null) return undefined;
  // 기존 고객을 그대로 두면 목록 상태와 관계없이 저장할 수 있다
  if (keptCustomer?.id === id) return keptCustomer;
  return customers.items.find((item) => item.id === id);
}

export function reservationInputSchema(choices: ReservationChoices) {
  return z
    .object({
      customerId: z.string(),
      treatmentIds: z.array(z.string()),
      date: z.string(),
      startTime: z.string(),
    })
    .transform((values, ctx): ReservationInput => {
      let failed = false;
      const fail = (field: keyof ReservationFormValues, message: string) => {
        failed = true;
        ctx.addIssue({ code: "custom", message, path: [field] });
      };

      const customer = customerOf(toId(values.customerId), choices);
      const { kind: customerKind } = choices.customers;
      if (!customer) {
        if (customerKind === "loading") fail("customerId", "고객 목록을 불러온 뒤 선택해주세요.");
        else if (customerKind !== "ready") fail("customerId", "선택할 수 있는 고객이 없어요.");
        else if (values.customerId === "") fail("customerId", "고객을 선택해주세요.");
        else fail("customerId", "목록에 없는 고객이에요. 다시 선택해주세요.");
      }

      const snapshot = checkedTreatments(values.treatmentIds, choices);
      const treatments = snapshot.kind === "ok" ? snapshot.treatments : [];
      if (snapshot.kind === "missing") fail("treatmentIds", treatmentMessages.vanished);
      else if (treatments.length === 0) fail("treatmentIds", noTreatmentMessage(choices));
      else if (!treatments.every((item) => isValidDuration(item.duration))) {
        fail("treatmentIds", treatmentMessages.badDuration);
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

      if (failed || !customer) return z.NEVER;

      const { schedule } = previewSchedule(values, choices);
      if (!schedule) {
        // 날짜 입력은 2000~2099년만 받으므로 종료 일시를 넘기는 원인은 시술 합계다
        fail("treatmentIds", treatmentMessages.outOfRange);
        return z.NEVER;
      }

      return {
        customerId: customer.id,
        treatmentIds: treatments.map((item) => item.id),
        startAt: schedule.startAt,
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

// 서버가 확정한 거부를 칸 오류로 바꾼다. 칸을 알 수 없으면 null(시트 알림으로 알린다)
export function rejectionErrors(reason: RejectionReason): ReservationFieldErrors | null {
  switch (reason) {
    case "customer_not_found":
      return { customerId: customerNotFoundMessage };
    case "treatment_not_found":
      return { treatmentIds: treatmentMessages.notFound };
    case "schedule_out_of_range":
      return { treatmentIds: treatmentMessages.outOfRange };
    case "invalid_treatments":
      return { treatmentIds: treatmentMessages.invalid };
    case "invalid":
      return null;
  }
}
