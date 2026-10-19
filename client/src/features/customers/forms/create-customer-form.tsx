import type { CustomerInput } from "@o2o/shared/contracts";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/shared/ui/toast/toast.tsx";

import type { CustomerFormProps } from "./customer-form.tsx";

import { customerMutationKeys, registerCustomer } from "../customers.api.ts";
import { CustomerForm } from "./customer-form.tsx";

export type CreateCustomerFormProps = {
  onClose: () => void;
};

export function CreateCustomerForm({ onClose }: CreateCustomerFormProps) {
  const queryClient = useQueryClient();
  const { mutate, isPending: saving } = useMutation({
    mutationKey: customerMutationKeys.create(),
    mutationFn: (input: CustomerInput) => registerCustomer(queryClient, input),
  });

  const handleSave: CustomerFormProps["onSave"] = (input, showErrors) => {
    if (saving) return;
    mutate(input, {
      onSuccess: (result) => {
        switch (result.kind) {
          case "created":
            onClose();
            toast.success({
              title: "고객을 등록했어요.",
              description: `${result.customer.name} 고객을 목록 맨 위에 추가했어요.`,
            });
            break;
          case "duplicate":
            showErrors({ phone: "이미 등록된 전화번호예요. 번호를 확인해주세요." });
            break;
          case "failed":
            toast.error({
              title: "고객을 저장하지 못했어요.",
              description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
            });
            break;
        }
      },
    });
  };

  return (
    <CustomerForm
      title="새 고객 등록"
      closeLabel="등록 닫기"
      submitLabel="고객 저장"
      defaultValues={{ name: "", phone: "" }}
      saving={saving}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
