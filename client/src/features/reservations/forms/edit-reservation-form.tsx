import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { toast } from "@/shared/ui/toast/toast.tsx";

import type { Reservation } from "../reservations.mock.ts";
import type { ReservationInput } from "../reservations.schema.ts";
import type { ReservationFormProps } from "./reservation-form.tsx";

import { reservationMutationKeys, updateReservation } from "../reservations.api.ts";
import { dateOf, formatDay, timeOf } from "../reservations.time.ts";
import { ReservationForm } from "./reservation-form.tsx";

export type EditReservationFormProps = {
  reservation: Reservation;
  onFinish: (result: { date: string }) => void;
  onClose: () => void;
};

const saveFailed: NoticeContent = {
  tone: "danger",
  title: "변경을 저장하지 못했어요.",
  description: "예약은 바뀌지 않았고 입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
};

const staleDescription = (refreshed: boolean) =>
  refreshed
    ? "목록을 최신 상태로 바꿨어요. 이 예약은 수정할 수 없어요."
    : "이 예약은 수정할 수 없어요. 목록을 다시 불러오지 못했으니 목록에서 다시 시도해주세요.";

export function EditReservationForm({ reservation, onFinish, onClose }: EditReservationFormProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  // 없어졌거나 취소된 예약이면 더 고칠 수 없다
  const [stale, setStale] = useState(false);
  // isPending은 다음 렌더에야 바뀌어 그 전에 들어온 연속 제출을 막지 못한다
  const inFlight = useRef(false);
  const { mutate, isPending: saving } = useMutation({
    mutationKey: reservationMutationKeys.update(),
    mutationFn: (input: ReservationInput) => updateReservation(queryClient, reservation.id, input),
  });

  const handleSave: ReservationFormProps["onSave"] = (input) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    mutate(input, {
      onSettled: () => {
        inFlight.current = false;
      },
      onSuccess: (result) => {
        switch (result.kind) {
          case "updated": {
            const { startAt } = result.reservation;
            const moved = dateOf(startAt) !== dateOf(reservation.startAt);
            onFinish({ date: dateOf(startAt) });
            toast.success({
              title: "예약을 수정했어요.",
              ...(moved && {
                description: `${formatDay(startAt, Number(dateOf(reservation.startAt).slice(0, 4)))} ${timeOf(startAt)}으로 옮겼어요.`,
              }),
            });
            break;
          }
          case "cancelled":
            setStale(true);
            setNotice({
              tone: "warning",
              title: "이미 취소된 예약이에요.",
              description: staleDescription(result.refreshed),
            });
            break;
          case "not_found":
            setStale(true);
            setNotice({
              tone: "warning",
              title: "더 이상 없는 예약이에요.",
              description: staleDescription(result.refreshed),
            });
            break;
          case "failed":
            setNotice(saveFailed);
            break;
        }
      },
    });
  };

  return (
    <ReservationForm
      title="예약 수정"
      closeLabel="수정 닫기"
      submitLabel="변경 저장"
      defaultValues={{
        customerId: String(reservation.customer.id),
        treatmentId: String(reservation.treatment.id),
        date: dateOf(reservation.startAt),
        startTime: timeOf(reservation.startAt),
      }}
      keptTreatment={reservation.treatment}
      status={saving ? "saving" : stale ? "locked" : "idle"}
      notice={notice}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
