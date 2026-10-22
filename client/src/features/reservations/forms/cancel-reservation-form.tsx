import type { FormEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { formatPhone } from "@/shared/format/phone.ts";
import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Textarea } from "@/shared/ui/textarea/textarea.tsx";
import { toast } from "@/shared/ui/toast/toast.tsx";

import type { Reservation } from "../reservations.mock.ts";
import type { CancelInput } from "../reservations.schema.ts";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";
import { cancelReservation, reservationMutationKeys } from "../reservations.api.ts";
import { cancelInputSchema } from "../reservations.schema.ts";
import {
  dateOf,
  formatDay,
  formatMonthDay,
  sameDay,
  timeOf,
  yearOf,
} from "../reservations.time.ts";
import { ReservationSheetFrame } from "./reservation-sheet-frame.tsx";

export type CancelReservationFormProps = {
  reservation: Reservation;
  onFinish: () => void;
  onClose: () => void;
};

// 확인한 상태는 목록에 이미 반영했다. 목록을 다시 불러오지 못했으면 그 사실을 따로 알린다
const listNote = (refreshed: boolean) =>
  refreshed
    ? "목록을 최신 상태로 바꿨어요."
    : "목록을 다시 불러오지 못했으니 목록에서 다시 시도해주세요.";

const saveFailed: NoticeContent = {
  tone: "danger",
  title: "예약을 취소하지 못했어요.",
  description: "예약은 그대로예요. 잠시 후 다시 시도해주세요.",
};

export function CancelReservationForm({
  reservation,
  onFinish,
  onClose,
}: CancelReservationFormProps) {
  const queryClient = useQueryClient();
  const dismissRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  // 이미 취소됐거나 없는 예약이면 더 취소할 수 없다
  const [stale, setStale] = useState(false);
  // isPending은 다음 렌더에야 바뀌어 그 전에 들어온 연속 제출을 막지 못한다
  const inFlight = useRef(false);
  const { mutate, isPending: saving } = useMutation({
    mutationKey: reservationMutationKeys.cancel(),
    mutationFn: (input: CancelInput) => cancelReservation(queryClient, reservation.id, input),
  });

  const handleCancel = (input: CancelInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    mutate(input, {
      onSettled: () => {
        inFlight.current = false;
      },
      onSuccess: (result) => {
        switch (result.kind) {
          case "cancelled":
            onFinish();
            toast.success({
              title: "예약을 취소했어요.",
              description: `${reservation.customer.name} · ${formatMonthDay(dateOf(reservation.startAt))} ${timeOf(reservation.startAt)}. '취소 포함'을 켜면 취소 기록을 볼 수 있어요.`,
            });
            break;
          case "already_cancelled":
            setStale(true);
            setNotice({
              tone: "warning",
              title: "이미 취소된 예약이에요.",
              description: `${listNote(result.refreshed)} 처음 취소한 기록은 그대로 남아 있어요.`,
            });
            break;
          case "not_found":
            setStale(true);
            setNotice({
              tone: "warning",
              title: "더 이상 없는 예약이에요.",
              description: listNote(result.refreshed),
            });
            break;
          case "failed":
            setNotice(saveFailed);
            break;
        }
      },
    });
  };

  const form = useForm({
    defaultValues: { reason: "" },
    validators: { onSubmit: cancelInputSchema },
    // 확인 결과는 다듬은 값을 돌려주지 않아 다시 parse한다
    onSubmit: ({ value }) => handleCancel(cancelInputSchema.parse(value)),
  });

  // 취소 버튼이 disabled가 되면 포커스를 잃으므로 돌아가기 버튼으로 옮긴다
  useEffect(() => {
    if (stale) dismissRef.current?.focus();
  }, [stale]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || stale) return;
    void form.handleSubmit();
  };

  const { customer, treatment, startAt, endAt } = reservation;

  return (
    <ReservationSheetFrame
      dismissRef={dismissRef}
      title="예약 취소"
      closeLabel="취소 닫기"
      dismissLabel="돌아가기"
      saving={saving}
      notice={notice}
      footnote="취소해도 예약 내용은 기록으로 남아요. 취소한 예약은 되돌릴 수 없어요."
      submit={
        <Button type="submit" variant="danger" loading={saving} disabled={stale}>
          {saving ? "취소하는 중" : "예약 취소"}
        </Button>
      }
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div {...stylex.props(styles.summary)}>
        <p {...stylex.props(styles.summaryWho)}>
          {customer.name} · {formatPhone(customer.phone)}
        </p>
        <p {...stylex.props(styles.summaryWhen)}>
          {formatDay(startAt)} {timeOf(startAt)} –{" "}
          {sameDay(startAt, endAt)
            ? timeOf(endAt)
            : `${formatDay(endAt, yearOf(startAt))} ${timeOf(endAt)}`}
        </p>
        <p {...stylex.props(styles.summaryTreatment)}>
          {treatment.name} · {treatment.duration}분
        </p>
      </div>

      <form.Field name="reason">
        {(field) => (
          <Field
            label="취소 사유 (선택)"
            description="입력하면 '취소 포함' 목록에서 확인할 수 있어요."
            error={field.state.meta.errors[0]?.message}
          >
            <Textarea
              name={field.name}
              rows={3}
              maxLength={200}
              value={field.state.value}
              readOnly={saving}
              disabled={stale}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </Field>
        )}
      </form.Field>
    </ReservationSheetFrame>
  );
}

const styles = stylex.create({
  summary: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "12px 16px",
    borderRadius: controls.radius,
    backgroundColor: colors.neutralSurface,
  },
  summaryWho: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  summaryWhen: {
    margin: 0,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
  },
  summaryTreatment: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.labelFontSize,
  },
});
