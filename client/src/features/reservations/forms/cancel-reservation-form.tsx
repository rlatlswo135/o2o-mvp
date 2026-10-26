import type { Reservation } from "@o2o/shared/contracts";
import type { FormEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { formatPhone } from "@/shared/format/phone.ts";
import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Textarea } from "@/shared/ui/textarea/textarea.tsx";
import { toast } from "@/shared/ui/toast/toast.tsx";

import type { CancelInput } from "../reservations.schema.ts";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";
import { cancelReservation, reservationMutationKeys } from "../reservations.api.ts";
import { cancelInputSchema } from "../reservations.schema.ts";
import {
  dateOf,
  formatDay,
  formatMinutes,
  formatMoment,
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

// 취소됐을 수도 있어 '예약은 그대로'라고 단정하지 않는다. 반복 취소는 처음 기록을 바꾸지 않는다
const cancelUnknown: NoticeContent = {
  tone: "warning",
  title: "취소됐는지 확인하지 못했어요.",
  description: "서버에서 취소됐을 수도 있어요. 다시 시도해도 처음 취소한 기록은 바뀌지 않아요.",
};

// 서버가 확인한 처음 취소 시각·사유. 목록 재조회 결과에 기대지 않는다
const alreadyCancelledDescription = ({ cancelledAt, cancelReason, startAt }: Reservation) => {
  const when = cancelledAt === null ? "" : `${formatMoment(cancelledAt, yearOf(startAt))}에 `;
  const record =
    cancelReason === null ? "처음 취소한 기록" : `처음 취소한 기록(사유: ${cancelReason})`;
  return `${when}먼저 취소됐어요. ${record}은 그대로 남아 있어요.`;
};

export function CancelReservationForm({
  reservation,
  onFinish,
  onClose,
}: CancelReservationFormProps) {
  const queryClient = useQueryClient();
  const dismissRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
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
              description: alreadyCancelledDescription(result.reservation),
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
          case "rejected":
            // 사유 외에는 보내는 입력이 없다
            flushSync(() =>
              form.setFieldMeta("reason", (meta) => ({
                ...meta,
                errorMap: { ...meta.errorMap, onSubmit: "취소 사유를 다시 확인해주세요." },
              })),
            );
            reasonRef.current?.focus();
            break;
          case "unknown":
            setNotice(cancelUnknown);
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

  const { customer, treatments, startAt, endAt } = reservation;
  const totalMinutes = treatments.reduce((sum, treatment) => sum + treatment.duration, 0);

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
          <span {...stylex.props(styles.nowrap)}>
            {formatDay(startAt)} {timeOf(startAt)}
          </span>{" "}
          –{" "}
          <span {...stylex.props(styles.nowrap)}>
            {sameDay(startAt, endAt)
              ? timeOf(endAt)
              : `${formatDay(endAt, yearOf(startAt))} ${timeOf(endAt)}`}
          </span>
        </p>
        {treatments.length === 1 ? (
          treatments.map((treatment) => (
            <p key={treatment.id} {...stylex.props(styles.summaryTreatment)}>
              {treatment.name} ·{" "}
              <span {...stylex.props(styles.nowrap)}>{formatMinutes(treatment.duration)}</span>
            </p>
          ))
        ) : (
          <>
            <ul {...stylex.props(styles.treatments)}>
              {treatments.map((treatment) => (
                <li key={treatment.id}>
                  {treatment.name} ·{" "}
                  <span {...stylex.props(styles.nowrap)}>{formatMinutes(treatment.duration)}</span>
                </li>
              ))}
            </ul>
            <p {...stylex.props(styles.summaryTreatment)}>
              시술 {treatments.length}개 · 총 {formatMinutes(totalMinutes)}
            </p>
          </>
        )}
      </div>

      <form.Field name="reason">
        {(field) => (
          <Field
            label="취소 사유 (선택)"
            description="입력하면 '취소 포함' 목록에서 확인할 수 있어요."
            error={firstError(field.state.meta.errors)}
          >
            <Textarea
              ref={reasonRef}
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
  treatments: {
    marginTop: "2px",
    marginBottom: 0,
    marginInline: 0,
    paddingLeft: "18px",
    color: colors.textMuted,
    fontSize: controls.labelFontSize,
    lineHeight: "20px",
    overflowWrap: "anywhere",
  },
  summaryTreatment: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.labelFontSize,
    overflowWrap: "anywhere",
  },
  nowrap: {
    whiteSpace: "nowrap",
  },
});

// 스키마 오류는 issue 객체, 서버 오류는 문자열
function firstError(errors: ReadonlyArray<string | { message: string } | undefined>) {
  const [error] = errors;
  return typeof error === "string" ? error : error?.message;
}
