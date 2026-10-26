import type { ReservationInput } from "@o2o/shared/contracts";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { toast } from "@/shared/ui/toast/toast.tsx";

import type { ReservationFormProps } from "./reservation-form.tsx";

import { registerReservation, reservationMutationKeys } from "../reservations.api.ts";
import { rejectionErrors } from "../reservations.schema.ts";
import { dateOf, formatDay, formatMonthDay, timeOf } from "../reservations.time.ts";
import { ReservationForm } from "./reservation-form.tsx";

export type CreateReservationFormProps = {
  // 지금 조회 중인 날짜. 새 예약의 처음 날짜다
  viewDate: string;
  onFinish: (result: { date: string }) => void;
  onClose: () => void;
};

// 모달 시트 위에서는 토스트가 가려지므로 실패는 시트 안에 알린다
const saveRejected: NoticeContent = {
  tone: "danger",
  title: "예약을 저장할 수 없어요.",
  description: "고객·시술·날짜·시각을 다시 확인해주세요.",
};

// 저장됐을 수도 있어 '저장되지 않았다'고 단정하지 않는다
const saveUnknown = (date: string): NoticeContent => ({
  tone: "warning",
  title: "저장됐는지 확인하지 못했어요.",
  description: `서버에 저장됐을 수도 있어요. 입력 내용은 그대로 두었어요. 시트를 닫고 ${formatMonthDay(date)} 목록에서 예약을 확인한 뒤, 없을 때만 다시 저장해주세요.`,
});

export function CreateReservationForm({ viewDate, onFinish, onClose }: CreateReservationFormProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  // isPending은 다음 렌더에야 바뀌어 그 전에 들어온 연속 제출을 막지 못한다
  const inFlight = useRef(false);
  const { mutate, isPending: saving } = useMutation({
    mutationKey: reservationMutationKeys.create(),
    mutationFn: (input: ReservationInput) => registerReservation(queryClient, input),
  });

  const handleSave: ReservationFormProps["onSave"] = (input, showErrors) => {
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
            const { customer, treatments, startAt } = result.reservation;
            const [first] = treatments;
            const more = treatments.length > 1 ? ` 외 ${treatments.length - 1}개` : "";
            onFinish({ date: dateOf(startAt) });
            toast.success({
              title: "예약을 등록했어요.",
              description: `${formatDay(startAt, Number(viewDate.slice(0, 4)))} ${timeOf(startAt)} ${customer.name} · ${first?.name ?? ""}${more}`,
            });
            break;
          }
          case "rejected": {
            const errors = rejectionErrors(result.reason);
            if (errors) showErrors(errors);
            else setNotice(saveRejected);
            break;
          }
          case "unknown":
            setNotice(saveUnknown(dateOf(input.startAt)));
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
      defaultValues={{ customerId: "", treatmentIds: [], date: viewDate, startTime: "" }}
      kept={null}
      status={saving ? "saving" : "idle"}
      notice={notice}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
