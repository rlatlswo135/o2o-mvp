import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { toast } from "@/shared/ui/toast/toast.tsx";

import type { ReservationInput } from "../reservations.schema.ts";
import type { ReservationFormProps } from "./reservation-form.tsx";

import { registerReservation, reservationMutationKeys } from "../reservations.api.ts";
import { dateOf, formatDay, timeOf } from "../reservations.time.ts";
import { ReservationForm } from "./reservation-form.tsx";

export type CreateReservationFormProps = {
  // 지금 조회 중인 날짜. 새 예약의 처음 날짜다
  viewDate: string;
  onFinish: (result: { date: string }) => void;
  onClose: () => void;
};

// 모달 시트 위에서는 토스트가 가려지므로 실패는 시트 안에 알린다
const saveFailed: NoticeContent = {
  tone: "danger",
  title: "예약을 저장하지 못했어요.",
  description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
};

export function CreateReservationForm({ viewDate, onFinish, onClose }: CreateReservationFormProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  // isPending은 다음 렌더에야 바뀌어 그 전에 들어온 연속 제출을 막지 못한다
  const inFlight = useRef(false);
  const { mutate, isPending: saving } = useMutation({
    mutationKey: reservationMutationKeys.create(),
    mutationFn: (input: ReservationInput) => registerReservation(queryClient, input),
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
          case "created": {
            const { customer, treatment, startAt } = result.reservation;
            onFinish({ date: dateOf(startAt) });
            toast.success({
              title: "예약을 등록했어요.",
              description: `${formatDay(startAt, Number(viewDate.slice(0, 4)))} ${timeOf(startAt)} ${customer.name} · ${treatment.name}. 가상 데이터라 새로고침하면 사라져요.`,
            });
            break;
          }
          case "failed":
            setNotice(saveFailed);
            break;
        }
      },
    });
  };

  return (
    <ReservationForm
      title="새 예약 등록"
      closeLabel="등록 닫기"
      submitLabel="예약 저장"
      defaultValues={{ customerId: "", treatmentId: "", date: viewDate, startTime: "" }}
      keptTreatment={null}
      status={saving ? "saving" : "idle"}
      notice={notice}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
