import type { ChangeEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback, useState } from "react";

import { AmountDisplay, AmountInput } from "@/shared/ui/amount-field/amount-field.tsx";
import { parseAmount } from "@/shared/ui/amount-field/amount-field.util.ts";
import { Field } from "@/shared/ui/field/field.tsx";
import { Textarea } from "@/shared/ui/textarea/textarea.tsx";

import { ReviewValue, reviewStyles } from "./-review-layout.tsx";

// 사유·금액 검토용 가상 예시. 잔액 계산·저장은 하지 않는다.
const amountErrors = {
  format: "정수 원 단위 숫자로 입력해주세요.",
  range: "입력할 수 있는 금액 범위를 벗어났습니다.",
};

const statusLabels = { empty: "빈 값", valid: "유효", invalid: "잘못된 값" };

export function AmountReview() {
  const [reason, setReason] = useState("실수로 1만 원 과충전하여 잔액을 정정합니다.");
  const [amountText, setAmountText] = useState("-10000");
  const parsed = parseAmount(amountText);

  const handleReasonChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
  }, []);
  const handleAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setAmountText(event.target.value);
  }, []);

  return (
    <>
      <div {...stylex.props(reviewStyles.grid)}>
        <Field
          label="변경 사유"
          required
          description="금액 변경 이력에 함께 보관됩니다."
          error={reason.trim() === "" ? "변경 사유를 입력해주세요." : undefined}
        >
          <Textarea value={reason} onChange={handleReasonChange} />
        </Field>
        <Field label="이전 사유" description="지금은 변경할 수 없는 항목입니다.">
          <Textarea defaultValue={"첫 줄\n둘째 줄"} disabled />
        </Field>
      </div>

      <div {...stylex.props(reviewStyles.grid)}>
        <Field
          label="변경 금액"
          description="정수 원 단위. 차감은 -10000처럼 입력합니다."
          error={parsed.status === "invalid" ? amountErrors[parsed.reason] : undefined}
        >
          <AmountInput value={amountText} onChange={handleAmountChange} placeholder="0" />
        </Field>
        <Field label="변경 후 잔액" description="소비자가 제공한 예시 값입니다. 계산하지 않습니다.">
          <AmountDisplay value={30000} />
        </Field>
        <Field label="변경 금액" description="지금은 변경할 수 없는 항목입니다.">
          <AmountInput defaultValue="5000" disabled />
        </Field>
      </div>

      <div {...stylex.props(reviewStyles.grid)}>
        <Field label="읽기 전용 음수">
          <AmountDisplay value={-10000} />
        </Field>
        <Field label="읽기 전용 0">
          <AmountDisplay value={0} />
        </Field>
        <Field label="읽기 전용 양수">
          <AmountDisplay value={30000} />
        </Field>
        <Field label="읽기 전용 빈 값">
          <AmountDisplay value={null} />
        </Field>
      </div>

      <dl aria-label="현재 입력 값" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="사유 원문">{reason === "" ? "(비어 있음)" : reason}</ReviewValue>
        <ReviewValue label="사유 줄 수">
          {reason === "" ? 0 : reason.split("\n").length}줄
        </ReviewValue>
        <ReviewValue label="금액 원문">
          {amountText === "" ? "(비어 있음)" : `"${amountText}"`}
        </ReviewValue>
        <ReviewValue label="금액 해석">
          {statusLabels[parsed.status]}
          {parsed.status === "valid" && ` · ${parsed.value}`}
        </ReviewValue>
      </dl>
    </>
  );
}
