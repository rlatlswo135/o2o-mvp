import type {
  ReservationCustomer,
  ReservationInput,
  ReservationTreatment,
} from "@o2o/shared/contracts";
import type { FormEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { formatPhone } from "@/shared/format/phone.ts";
import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";
import { Select } from "@/shared/ui/select/select.tsx";

import type {
  ChoiceKind,
  ReservationChoices,
  ReservationFieldErrors,
  ReservationFormValues,
  ReservationPreview,
  TreatmentRow,
} from "../reservations.schema.ts";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";
import { customerQueries } from "../../customers/customers.api.ts";
import { treatmentQueries } from "../../treatments/treatments.api.ts";
import {
  previewSchedule,
  reservationFieldNames,
  reservationInputSchema,
  treatmentRows,
} from "../reservations.schema.ts";
import {
  formatDay,
  formatMinutes,
  formatTotal,
  maxYear,
  minYear,
  sameDay,
  timeOf,
  yearOf,
} from "../reservations.time.ts";
import { ReservationSheetFrame } from "./reservation-sheet-frame.tsx";
import { TreatmentChecklist } from "./treatment-checklist.tsx";

// idle: 입력 가능, saving: 저장 중, locked: 수정 대상이 사라졌거나 취소돼 더 고칠 수 없음
export type ReservationFormStatus = "idle" | "saving" | "locked";

// 수정하는 예약에 저장된 고객·시술(예약 당시 값)
export type KeptChoices = {
  customer: ReservationCustomer;
  treatments: ReadonlyArray<ReservationTreatment>;
};

export type ReservationFormProps = {
  title: string;
  closeLabel: string;
  submitLabel: string;
  defaultValues: ReservationFormValues;
  kept: KeptChoices | null;
  status: ReservationFormStatus;
  notice: NoticeContent | null;
  onSave: (input: ReservationInput, showErrors: (errors: ReservationFieldErrors) => void) => void;
  onClose: () => void;
};

type ChoiceQuery<T> = { data: ReadonlyArray<T> | undefined; isError: boolean };

// 재조회에 실패해도 받아 둔 목록이 있으면 계속 고를 수 있다
function choiceKind({ data, isError }: ChoiceQuery<unknown>): ChoiceKind {
  if (data === undefined) return isError ? "failed" : "loading";
  return data.length === 0 ? "empty" : "ready";
}

export function ReservationForm({
  title,
  closeLabel,
  submitLabel,
  defaultValues,
  kept,
  status,
  notice,
  onSave,
  onClose,
}: ReservationFormProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const saving = status === "saving";
  const locked = status === "locked";
  const customersQuery = useQuery(customerQueries.list());
  const treatmentsQuery = useQuery(treatmentQueries.list());
  // 체크할 때 본 시술 값. 체크한 채로 목록에서 사라지면 이 값으로 보여준다
  const [seenTreatments, setSeenTreatments] = useState<ReadonlyArray<ReservationTreatment>>([]);
  const customerKind = choiceKind(customersQuery);
  const treatmentKind = choiceKind(treatmentsQuery);
  const customers = (customersQuery.data ?? []).toSorted(
    (a, b) => a.name.localeCompare(b.name, "ko") || a.phone.localeCompare(b.phone),
  );
  const choices: ReservationChoices = {
    customers: { kind: customerKind, items: customers },
    treatments: { kind: treatmentKind, items: treatmentsQuery.data ?? [] },
    keptCustomer: kept?.customer ?? null,
    keptTreatments: kept?.treatments ?? [],
    seenTreatments,
  };
  const schema = reservationInputSchema(choices);

  const form = useForm({
    defaultValues,
    validators: { onSubmit: schema },
    // 확인 결과는 다듬은 값을 돌려주지 않아 다시 parse한다
    onSubmit: ({ value }) => onSave(schema.parse(value), showErrors),
    onSubmitInvalid: ({ formApi }) => {
      focusField(reservationFieldNames.find((name) => formApi.getFieldMeta(name)?.errors.length));
    },
  });

  // 시술 칸은 첫 체크박스로, 체크박스가 없으면(불러오기 실패) 다시 시도 버튼으로 옮긴다
  const focusField = (name: string | undefined) => {
    if (!name) return;
    const root = rootRef.current;
    const target =
      root?.querySelector<HTMLElement>(`[name="${name}"]`) ??
      root?.querySelector<HTMLElement>(`[data-field="${name}"] :is(button, a)`);
    target?.focus();
  };

  const showErrors = (errors: ReservationFieldErrors) => {
    // 오류 설명이 입력에 연결된 뒤 포커스를 옮기도록 동기로 그린다
    flushSync(() => {
      for (const name of reservationFieldNames) {
        const message = errors[name];
        if (message === undefined) continue;
        form.setFieldMeta(name, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onSubmit: message },
        }));
      }
    });
    focusField(reservationFieldNames.find((name) => errors[name] !== undefined));
  };

  // 저장 버튼이 disabled가 되면 포커스를 잃으므로 닫기 버튼으로 옮긴다
  useEffect(() => {
    if (locked) dismissRef.current?.focus();
  }, [locked]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "idle") return;
    void form.handleSubmit();
  };

  const customerNoteId = `${baseId}-customer-note`;
  const treatmentNoteId = `${baseId}-treatment-note`;
  const keptCustomer = kept?.customer ?? null;
  const customerListed = customerKind === "ready" || customerKind === "empty";

  return (
    <ReservationSheetFrame
      rootRef={rootRef}
      dismissRef={dismissRef}
      title={title}
      closeLabel={closeLabel}
      dismissLabel="닫기"
      saving={saving}
      notice={notice}
      footnote="같은 시간에 겹치는 예약도 저장돼요(중복 검사 미지원)."
      submit={
        <Button type="submit" loading={saving} disabled={locked}>
          {saving ? "저장 중" : submitLabel}
        </Button>
      }
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      {/* handleBlur를 두면 포커스만 옮겨도 제출 오류가 지워진다. 입력을 고칠 때만 지운다 */}
      <form.Field name="customerId">
        {(field) => (
          <Field
            label="고객"
            description="동명이인은 전화번호로 구분해요."
            error={firstError(field.state.meta.errors)}
            required
          >
            <Select
              name={field.name}
              value={field.state.value}
              disabled={saving || locked}
              aria-describedby={customerKind === "ready" ? undefined : customerNoteId}
              onChange={(event) => field.handleChange(event.target.value)}
            >
              {customerListed ? (
                <>
                  {/* 수정 시트에는 자리표시를 두지 않는다. 잘못 고르면 기존 고객이 풀린다 */}
                  {!keptCustomer && (
                    <option value="">
                      {customerKind === "ready" ? "고객을 선택해주세요" : choiceLabels.empty}
                    </option>
                  )}
                  {keptCustomer && !customers.some((item) => item.id === keptCustomer.id) && (
                    <option value={keptCustomer.id}>
                      {customerLabel(keptCustomer)} (삭제된 고객)
                    </option>
                  )}
                  {customers.map((customer) =>
                    customer.id === keptCustomer?.id ? (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(keptCustomer)}
                        {keptCustomer.name !== customer.name ||
                        keptCustomer.phone !== customer.phone
                          ? " (예약 당시 정보)"
                          : ""}
                      </option>
                    ) : (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ),
                  )}
                </>
              ) : keptCustomer ? (
                // 목록을 몰라도 기존 고객은 그대로 둘 수 있다
                <option value={keptCustomer.id}>{customerLabel(keptCustomer)}</option>
              ) : (
                <option value="">
                  {choiceLabels[customerKind === "loading" ? "loading" : "failed"]}
                </option>
              )}
            </Select>
            <ChoiceNote
              id={customerNoteId}
              kind={customerKind}
              subject="고객"
              to="/customers"
              toLabel="고객 화면으로 이동"
              disabled={saving}
              onRetry={() => void customersQuery.refetch()}
              onNavigate={onClose}
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="treatmentIds">
        {(field) => {
          const preview = previewSchedule(
            { ...form.state.values, treatmentIds: field.state.value },
            choices,
          );
          const noted = treatmentKind === "failed" || treatmentKind === "empty";
          return (
            <TreatmentChecklist
              id={`${baseId}-treatments`}
              rows={treatmentRows(field.state.value, choices)}
              checkedIds={field.state.value}
              kind={treatmentKind}
              hasKept={choices.keptTreatments.length > 0}
              totalMinutes={preview.totalMinutes}
              disabled={saving || locked}
              error={firstError(field.state.meta.errors)}
              noteId={noted ? treatmentNoteId : undefined}
              note={
                noted && (
                  <ChoiceNote
                    id={treatmentNoteId}
                    kind={treatmentKind}
                    subject="시술"
                    to="/treatments"
                    toLabel="시술 화면으로 이동"
                    disabled={saving}
                    onRetry={() => void treatmentsQuery.refetch()}
                    onNavigate={onClose}
                  />
                )
              }
              onToggle={(row: TreatmentRow, checked: boolean) => {
                const id = String(row.id);
                if (
                  checked &&
                  row.kind === "listed" &&
                  row.name !== null &&
                  row.duration !== null
                ) {
                  const seen = { id: row.id, name: row.name, duration: row.duration };
                  setSeenTreatments((current) => [
                    ...current.filter((item) => item.id !== row.id),
                    seen,
                  ]);
                }
                field.handleChange((current) =>
                  checked
                    ? [...current.filter((value) => value !== id), id]
                    : current.filter((value) => value !== id),
                );
              }}
            />
          );
        }}
      </form.Field>

      <div {...stylex.props(styles.dateTime)}>
        <form.Field name="date">
          {(field) => (
            <Field label="날짜" error={firstError(field.state.meta.errors)} required>
              <Input
                type="date"
                name={field.name}
                min={`${minYear}-01-01`}
                max={`${maxYear}-12-31`}
                value={field.state.value}
                readOnly={saving || locked}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="startTime">
          {(field) => (
            <Field
              label="시작 시각"
              description="분 단위로 입력해요."
              error={firstError(field.state.meta.errors)}
              required
            >
              <Input
                type="time"
                name={field.name}
                step={60}
                value={field.state.value}
                readOnly={saving || locked}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EndPreview
            preview={previewSchedule(values, choices)}
            keptIds={choices.keptTreatments.map((item) => item.id)}
            editing={kept !== null}
          />
        )}
      </form.Subscribe>
    </ReservationSheetFrame>
  );
}

const customerLabel = (customer: ReservationCustomer) =>
  `${customer.name} · ${formatPhone(customer.phone)}`;

const choiceLabels = {
  loading: "고객 목록을 불러오는 중…",
  failed: "고객 목록을 불러오지 못했어요",
  empty: "등록된 고객이 없어요",
} as const;

type ChoiceNoteProps = {
  id: string;
  kind: ChoiceKind;
  subject: string;
  to: "/customers" | "/treatments";
  toLabel: string;
  disabled: boolean;
  onRetry: () => void;
  onNavigate: () => void;
};

// 선택지를 고를 수 없는 이유와 복구 방법. 고를 수 있을 때는 아무것도 그리지 않는다
function ChoiceNote({
  id,
  kind,
  subject,
  to,
  toLabel,
  disabled,
  onRetry,
  onNavigate,
}: ChoiceNoteProps) {
  switch (kind) {
    case "ready":
      return null;
    case "loading":
      return (
        <p id={id} {...stylex.props(styles.note)}>
          불러오는 중이에요.
        </p>
      );
    case "failed":
      return (
        <div id={id} {...stylex.props(styles.note, styles.noteDanger)}>
          <span aria-hidden="true" {...stylex.props(styles.noteMark)}>
            !
          </span>
          <span>{subject} 목록을 불러오지 못했어요.</span>
          <Button variant="secondary" size="small" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      );
    case "empty":
      return (
        <p id={id} {...stylex.props(styles.note)}>
          등록된 {subject}이 없어요.{" "}
          <Link
            to={to}
            onClick={() => {
              if (!disabled) onNavigate();
            }}
            {...stylex.props(styles.noteLink)}
          >
            {toLabel}
          </Link>
        </p>
      );
  }
}

type EndPreviewProps = {
  preview: ReservationPreview;
  keptIds: ReadonlyArray<number>;
  editing: boolean;
};

// 입력이 아니라 계산 결과다. 저장과 같은 규칙으로 종료 일시를 보여준다.
// 시술 내역은 체크할 때마다 길게 다시 읽지 않도록 live region 밖에 둔다
function EndPreview({ preview, keptIds, editing }: EndPreviewProps) {
  const { rows, schedule, totalMinutes, outOfRange } = preview;
  const described = rows.length > 0 && !outOfRange;

  return (
    <div {...stylex.props(styles.endBox)}>
      <div role="status" aria-live="polite">
        <p {...stylex.props(styles.endLabel)}>종료 예정</p>
        {outOfRange ? (
          <p {...stylex.props(styles.endWarn)}>
            종료 일시를 계산할 수 없어요. 고른 시술 시간이 너무 길어요.
          </p>
        ) : schedule && totalMinutes !== null ? (
          <p {...stylex.props(styles.endValue)}>
            {sameDay(schedule.startAt, schedule.endAt) ? (
              <span {...stylex.props(styles.nowrap)}>{timeOf(schedule.endAt)}</span>
            ) : (
              <span {...stylex.props(styles.nowrap)}>
                <span {...stylex.props(styles.endDate)}>
                  {formatDay(schedule.endAt, yearOf(schedule.startAt))}
                </span>{" "}
                {timeOf(schedule.endAt)}
              </span>
            )}{" "}
            · <span {...stylex.props(styles.nowrap)}>{formatTotal(totalMinutes)}</span>
          </p>
        ) : (
          <p {...stylex.props(styles.endEmpty)}>시술·날짜·시작 시각을 입력하면 계산해요.</p>
        )}
      </div>
      {described && rows.length >= 2 && (
        <p {...stylex.props(styles.endHint)}>
          {rows
            .map(
              (row) =>
                `${row.name ?? "더 이상 없는 시술"}${row.duration === null ? "" : ` ${formatMinutes(row.duration)}`}`,
            )
            .join(" + ")}
        </p>
      )}
      {described && editing && (
        <p {...stylex.props(styles.endHint)}>
          {rows.every((row) => keptIds.includes(row.id))
            ? "예약할 때 정한 시술 시간을 그대로 써요."
            : "새로 고른 시술만 지금 기본 소요시간으로 더했어요."}
        </p>
      )}
    </div>
  );
}

// 스키마 오류는 issue 객체, 서버 오류는 문자열
function firstError(errors: ReadonlyArray<string | { message: string } | undefined>) {
  const [error] = errors;
  return typeof error === "string" ? error : error?.message;
}

const compact = "@media (max-width: 399px)";

const styles = stylex.create({
  dateTime: {
    display: "grid",
    gridTemplateColumns: {
      default: "1fr 1fr",
      [compact]: "1fr",
    },
    gap: "12px",
    alignItems: "start",
  },
  note: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 8px",
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
  noteDanger: {
    color: colors.danger,
    fontWeight: 500,
  },
  noteMark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    backgroundColor: colors.danger,
    color: "#fff",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  },
  noteLink: {
    color: colors.text,
    fontWeight: 600,
    textDecoration: "underline",
  },
  endBox: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "12px 16px",
    borderRadius: controls.radius,
    backgroundColor: colors.neutralSurface,
  },
  endLabel: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.labelFontSize,
    fontWeight: 600,
  },
  endValue: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  endDate: {
    color: colors.accentText,
  },
  endHint: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
  endWarn: {
    margin: 0,
    color: colors.warning,
    fontSize: "15px",
    fontWeight: 500,
  },
  // 날짜시각·소요시간 덩어리가 좁은 화면에서 갈라지지 않게 한다
  nowrap: {
    whiteSpace: "nowrap",
  },
  endEmpty: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "15px",
    fontWeight: 400,
  },
});
