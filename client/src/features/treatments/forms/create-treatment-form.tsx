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
const saveRejected: NoticeContent = {
  tone: "danger",
  title: "시술을 저장할 수 없어요.",
  description: "이름·소요시간·가격을 다시 확인해주세요.",
};

const saveUnknown: NoticeContent = {
  tone: "warning",
  title: "저장됐는지 확인하지 못했어요.",
  description:
    "서버에 저장됐을 수도 있어요. 입력 내용은 그대로 두었어요. 시트를 닫고 시술 목록에서 확인한 뒤, 없을 때만 다시 저장해주세요.",
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

  const handleSave: TreatmentFormProps["onSave"] = (input, showErrors) => {
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
              description: `'${result.treatment.name}' 시술을 목록에 추가했어요. 예약 등록에서 바로 고를 수 있어요.`,
            });
            break;
          case "rejected":
            if (Object.keys(result.errors).length > 0) showErrors(result.errors);
            else setNotice(saveRejected);
            break;
          case "unknown":
            setNotice(saveUnknown);
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
