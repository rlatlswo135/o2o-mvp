import type { Customer, CustomerInput } from "@o2o/shared/contracts";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { formatPhone } from "@/shared/format/phone.ts";
import { toast } from "@/shared/ui/toast/toast.tsx";

import type { CustomerFormProps } from "./customer-form.tsx";

import { customerMutationKeys, updateCustomer } from "../customers.api.ts";
import { CustomerForm } from "./customer-form.tsx";

export type EditCustomerFormProps = {
  customer: Customer;
  onClose: () => void;
};

export function EditCustomerForm({ customer, onClose }: EditCustomerFormProps) {
  const queryClient = useQueryClient();
  const { mutate, isPending: saving } = useMutation({
    mutationKey: customerMutationKeys.update(),
    mutationFn: (input: CustomerInput) =>
      updateCustomer(queryClient, { id: customer.id, ...input }),
  });

  const handleSave: CustomerFormProps["onSave"] = (input, showErrors) => {
    if (saving) return;
    mutate(input, {
      onSuccess: (result) => {
        switch (result.kind) {
          case "updated":
            onClose();
            toast.success({
              title: "고객 정보를 수정했어요.",
              description: `${result.customer.name} 고객의 정보를 저장했어요.`,
            });
            break;
          case "duplicate":
            showErrors({ phone: "다른 고객이 쓰는 전화번호예요. 번호를 확인해주세요." });
            break;
          case "not_found":
            onClose();
            toast.warn({
              title: "이미 삭제된 고객이에요.",
              description: "목록에서 내렸어요. 최신 목록을 확인해주세요.",
            });
            break;
          case "failed":
            toast.error({
              title: "고객 정보를 저장하지 못했어요.",
              description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
            });
            break;
        }
      },
    });
  };

  return (
    <CustomerForm
      title="고객 정보 수정"
      closeLabel="수정 닫기"
      submitLabel="변경 저장"
      defaultValues={{ name: customer.name, phone: formatPhone(customer.phone) }}
      saving={saving}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
