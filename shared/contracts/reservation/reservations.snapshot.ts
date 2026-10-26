import type { ReservationTreatment } from "./reservations.schema.ts";

export type SnapshotResult =
  | { kind: "ok"; treatments: ReservationTreatment[] }
  | { kind: "missing"; treatmentIds: number[] };

// 기존 예약에 있던 시술은 예약 당시 이름·소요시간을, 새로 고른 시술만 지금 시술 목록의 값을 쓴다.
// 같은 시술을 해제했다가 다시 골라도 기존 예약에 있던 시술이면 예약 당시 값이다. 순서는 ids를 따른다
export function snapshotTreatments(
  ids: ReadonlyArray<number>,
  kept: ReadonlyArray<ReservationTreatment>,
  listed: ReadonlyArray<ReservationTreatment>,
): SnapshotResult {
  const treatments: ReservationTreatment[] = [];
  const missing: number[] = [];
  for (const id of ids) {
    const found = kept.find((item) => item.id === id) ?? listed.find((item) => item.id === id);
    if (found) treatments.push({ id: found.id, name: found.name, duration: found.duration });
    else missing.push(id);
  }
  return missing.length > 0
    ? { kind: "missing", treatmentIds: missing }
    : { kind: "ok", treatments };
}
