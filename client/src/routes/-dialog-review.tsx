import type { ChangeEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Checkbox } from "@/shared/ui/choice/choice.tsx";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog/dialog.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import { colors } from "../shared/ui/theme.stylex.ts";
import { ReviewValue, reviewStyles } from "./-review-layout.tsx";

// 중요한 행동 확인 검토용 가상 예시. 실제 예약 취소·저장 요청은 하지 않는다.
const initialReason = "고객 요청으로 취소";

const longNotes = [
  "예약 시간에 맞춰 준비한 재료와 좌석 배정이 해제됩니다.",
  "같은 시간대에 대기 중인 고객이 있으면 순서대로 안내됩니다.",
  "회원권으로 결제한 예약은 사용 내역에서 차감이 취소됩니다.",
  "선결제 금액은 결제 수단별 환불 기준에 따라 처리됩니다.",
  "취소 후 같은 시간으로 다시 예약하려면 새 예약을 등록해야 합니다.",
  "고객에게 보낼 안내 문자는 별도 화면에서 확인합니다.",
  "취소 사유는 예약 이력에 남아 이후 상담에 참고됩니다.",
];

type Outcome = { kind: "confirmed"; reason: string } | { kind: "cancelled" };

export function DialogReview() {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [long, setLong] = useState(false);
  const [reason, setReason] = useState(initialReason);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);

  const handleOpen = useCallback(() => {
    setReason(initialReason);
    setOutcome(null);
  }, []);
  // 확인으로 닫혔으면 그 결과를 유지하고, 그 밖의 닫힘은 취소로 기록한다.
  const handleClose = useCallback(() => {
    setOutcome((current) => current ?? { kind: "cancelled" });
  }, []);
  const handleConfirm = useCallback(() => {
    setOutcome({ kind: "confirmed", reason });
    setConfirmCount((count) => count + 1);
  }, [reason]);
  const handleReasonChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
  }, []);
  const handleLongChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setLong(event.target.checked);
  }, []);

  const actions = useMemo(
    () => (
      <>
        <DialogClose>
          <Button ref={cancelRef} variant="secondary">
            돌아가기
          </Button>
        </DialogClose>
        <DialogClose>
          {({ close }) => <ConfirmButton close={close} onConfirm={handleConfirm} />}
        </DialogClose>
      </>
    ),
    [handleConfirm],
  );

  return (
    <>
      <Dialog initialFocusRef={cancelRef} onOpen={handleOpen} onClose={handleClose}>
        <div {...stylex.props(reviewStyles.row)}>
          <DialogTrigger>
            <Button variant="danger">예약 취소</Button>
          </DialogTrigger>
          <Checkbox checked={long} onChange={handleLongChange}>
            긴 안내 포함
          </Checkbox>
        </div>

        <DialogContent
          tone="danger"
          title="예약을 취소할까요?"
          description="일정에서 제외되며 취소 내용과 사유는 보관됩니다."
          actions={actions}
        >
          <p {...stylex.props(styles.target)}>김서연 · 젤네일 · 오늘 14:00</p>
          <Field label="취소 사유">
            <Input value={reason} onChange={handleReasonChange} />
          </Field>
          {long && (
            <ul {...stylex.props(styles.notes)}>
              {longNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <dl aria-label="마지막 확인 결과" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="마지막 결과">
          {outcome === null
            ? "(없음)"
            : outcome.kind === "confirmed"
              ? `확인 · 사유: ${outcome.reason || "(빈 값)"}`
              : "취소 · 확인 동작 없음"}
        </ReviewValue>
        <ReviewValue label="확인 동작 횟수">{confirmCount}회</ReviewValue>
      </dl>
      <span {...stylex.props(reviewStyles.note)}>
        가상 예시이며 실제 예약 취소·저장 요청은 보내지 않습니다.
      </span>
    </>
  );
}

/** 확인 동작을 먼저 기록한 뒤 닫는다. 닫힘 통지(onClose)가 이 결과를 취소로 덮지 않는다. */
function ConfirmButton({ close, onConfirm }: { close: () => void; onConfirm: () => void }) {
  const handleClick = useCallback(() => {
    onConfirm();
    close();
  }, [close, onConfirm]);

  return (
    <Button variant="danger" onClick={handleClick}>
      예약 취소
    </Button>
  );
}

const styles = stylex.create({
  target: {
    margin: 0,
    padding: "12px 16px",
    borderRadius: "6px",
    backgroundColor: colors.neutralSurface,
    fontSize: "13px",
  },
  notes: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    paddingInlineStart: "20px",
    color: colors.textMuted,
    fontSize: "13px",
    lineHeight: 1.6,
  },
});
