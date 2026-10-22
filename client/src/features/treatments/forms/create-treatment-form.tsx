import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { toast } from "@/shared/ui/toast/toast.tsx";

import type { TreatmentInput } from "../treatments.schema.ts";
import type { TreatmentFormProps } from "./treatment-form.tsx";

import { registerTreatment, treatmentMutationKeys } from "../treatments.api.ts";
import { TreatmentForm } from "./treatment-form.tsx";

export type CreateTreatmentFormProps = {
  onClose: () => void;
};

// 모달 시트 위에서는 토스트가 가려지므로 실패는 시트 안에 알린다
const saveFailed: NoticeContent = {
  tone: "danger",
  title: "시술을 저장하지 못했어요.",
  description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
};

export function CreateTreatmentForm({ onClose }: CreateTreatmentFormProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  // isPending은 다음 렌더에야 바뀌어 그 전에 들어온 연속 제출을 막지 못한다
  const inFlight = useRef(false);
  const { mutate, isPending: saving } = useMutation({
    mutationKey: treatmentMutationKeys.create(),
    mutationFn: (input: TreatmentInput) => registerTreatment(queryClient, input),
  });

  const handleSave: TreatmentFormProps["onSave"] = (input) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    mutate(input, {
      onSettled: () => {
        inFlight.current = false;
      },
      onSuccess: (result) => {
        switch (result.kind) {
          case "created":
            onClose();
            toast.success({
              title: "시술을 등록했어요.",
              description: `'${result.treatment.name}' 시술을 목록 맨 위에 추가했어요. 가상 데이터라 새로고침하면 사라져요.`,
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
    <TreatmentForm
      title="새 시술 등록"
      closeLabel="등록 닫기"
      submitLabel="시술 저장"
      defaultValues={{ name: "", duration: "", price: "" }}
      saving={saving}
      notice={notice}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
