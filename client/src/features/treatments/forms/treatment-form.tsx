import type { FormEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { flushSync } from "react-dom";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { AmountInput } from "@/shared/ui/amount-field/amount-field.tsx";
import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";
import { LiveNotice } from "@/shared/ui/notice/notice.tsx";
import { useSheetTitleId } from "@/shared/ui/sheet/sheet.tsx";

import type { TreatmentFieldErrors } from "../treatments.api.ts";
import type { TreatmentInput } from "../treatments.schema.ts";

import { colors } from "../../../shared/ui/theme.stylex.ts";
import { treatmentFieldNames } from "../treatments.api.ts";
import { treatmentInputSchema } from "../treatments.schema.ts";

export type TreatmentFormValues = { name: string; duration: string; price: string };

export type TreatmentFormProps = {
  title: string;
  closeLabel: string;
  submitLabel: string;
  defaultValues: TreatmentFormValues;
  saving: boolean;
  notice: NoticeContent | null;
  onSave: (input: TreatmentInput, showErrors: (errors: TreatmentFieldErrors) => void) => void;
  onClose: () => void;
};

export function TreatmentForm({
  title,
  closeLabel,
  submitLabel,
  defaultValues,
  saving,
  notice,
  onSave,
  onClose,
}: TreatmentFormProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const titleId = useSheetTitleId() ?? generatedTitleId;
  const form = useForm({
    defaultValues,
    validators: { onSubmit: treatmentInputSchema },
    // 확인 결과는 다듬은 값을 돌려주지 않아 다시 parse한다
    onSubmit: ({ value }) => onSave(treatmentInputSchema.parse(value), showErrors),
    onSubmitInvalid: ({ formApi }) => {
      focusField(treatmentFieldNames.find((name) => formApi.getFieldMeta(name)?.errors.length));
    },
  });

  const focusField = (name: string | undefined) => {
    rootRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
  };

  const showErrors = (errors: TreatmentFieldErrors) => {
    // 오류 설명이 입력에 연결된 뒤 포커스를 옮기도록 동기로 그린다
    flushSync(() => {
      for (const name of treatmentFieldNames) {
        const message = errors[name];
        if (message === undefined) continue;
        form.setFieldMeta(name, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onSubmit: message },
        }));
      }
    });
    focusField(treatmentFieldNames.find((name) => errors[name] !== undefined));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    void form.handleSubmit();
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <div ref={rootRef} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.heading)}>
          <p {...stylex.props(styles.eyebrow)}>TREATMENT</p>
          <h2 id={titleId} {...stylex.props(styles.title)}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          disabled={saving}
          onClick={handleClose}
          {...stylex.props(styles.closeButton)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <form
        noValidate
        aria-busy={saving || undefined}
        onSubmit={handleSubmit}
        {...stylex.props(styles.form)}
      >
        <div {...stylex.props(styles.body)}>
          {/* handleBlur를 두면 포커스만 옮겨도 제출 오류가 지워진다. 입력을 고칠 때만 지운다 */}
          <form.Field name="name">
            {(field) => (
              <Field label="시술명" error={firstError(field.state.meta.errors)} required>
                <Input
                  name={field.name}
                  autoComplete="off"
                  placeholder="예: 젤 원컬러"
                  value={field.state.value}
                  readOnly={saving}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="duration">
            {(field) => (
              <Field
                label="소요시간"
                description="분 단위 정수로 입력해주세요."
                error={firstError(field.state.meta.errors)}
                required
              >
                <AmountInput
                  name={field.name}
                  unit="분"
                  inputMode="numeric"
                  placeholder="60"
                  value={field.state.value}
                  readOnly={saving}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="price">
            {(field) => (
              <Field
                label="가격"
                description="원 단위로 입력해주세요. 무료 시술은 0을 입력해요."
                error={firstError(field.state.meta.errors)}
                required
              >
                <AmountInput
                  name={field.name}
                  inputMode="numeric"
                  placeholder="0"
                  value={field.state.value}
                  readOnly={saving}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
        </div>

        <div {...stylex.props(styles.footer)}>
          {/* 알림이 없을 때 빈 알림 영역이 버튼 줄 위 간격을 만들지 않게 한다 */}
          <div {...stylex.props(notice && styles.noticeShown)}>
            <LiveNotice notice={notice} />
          </div>
          <div {...stylex.props(styles.actions)}>
            <Button variant="secondary" disabled={saving} onClick={handleClose}>
              취소
            </Button>
            <div {...stylex.props(styles.submit)}>
              <Button type="submit" loading={saving}>
                {saving ? "저장 중" : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// 스키마 오류는 issue 객체, 서버 오류는 문자열
function firstError(errors: ReadonlyArray<string | { message: string } | undefined>) {
  const [error] = errors;
  return typeof error === "string" ? error : error?.message;
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  // 시트 높이 안에서 본문만 스크롤하고 머리·동작 줄은 항상 보이게 한다.
  root: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: {
      default: "24px 20px 8px 24px",
      [narrow]: "12px 12px 4px 16px",
    },
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    color: colors.accent,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "16px",
    letterSpacing: "0.14em",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: "26px",
  },
  closeButton: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    padding: 0,
    borderWidth: 0,
    borderRadius: "50%",
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": colors.neutralSurface,
    },
    color: {
      default: colors.textMuted,
      ":hover:not(:disabled)": colors.text,
      ":disabled": colors.disabledText,
    },
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    fontFamily: "inherit",
    fontSize: "22px",
    lineHeight: 1,
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "18px",
    minHeight: 0,
    padding: {
      default: "16px 24px 24px",
      [narrow]: "12px 16px 16px",
    },
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  footer: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    padding: {
      default: "16px 24px 24px",
      [narrow]: "12px 16px max(16px, env(safe-area-inset-bottom))",
    },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.border,
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  submit: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  noticeShown: {
    marginBottom: "12px",
  },
});
