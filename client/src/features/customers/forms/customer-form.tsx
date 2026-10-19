import type { CustomerInput } from "@o2o/shared/contracts";
import type { FormEvent } from "react";

import { customerInputSchema } from "@o2o/shared/contracts";
import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";

export type CustomerFormValues = { name: string; phone: string };

export type CustomerFormProps = {
  title: string;
  closeLabel: string;
  submitLabel: string;
  defaultValues: CustomerFormValues;
  saving: boolean;
  onSave: (input: CustomerInput, showErrors: (errors: CustomerFieldErrors) => void) => void;
  onClose: () => void;
};

const fieldNames = ["name", "phone"] as const;

export type CustomerFieldErrors = Partial<Record<(typeof fieldNames)[number], string>>;

export function CustomerForm({
  title,
  closeLabel,
  submitLabel,
  defaultValues,
  saving,
  onSave,
  onClose,
}: CustomerFormProps) {
  const titleId = useId();
  const form = useForm({
    defaultValues,
    validators: { onSubmit: customerInputSchema },
    // 확인 결과는 다듬은 값을 돌려주지 않아 다시 parse한다
    onSubmit: ({ value }) => onSave(customerInputSchema.parse(value), showErrors),
  });

  const showErrors = (errors: CustomerFieldErrors) => {
    for (const name of fieldNames) {
      const message = errors[name];
      if (message === undefined) continue;
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onSubmit: message },
      }));
    }
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
    <section aria-labelledby={titleId} {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelHeader)}>
        <h2 id={titleId} {...stylex.props(styles.title)}>
          {title}
        </h2>
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
        <p {...stylex.props(styles.eyebrow)}>CUSTOMER DETAILS</p>
        <form.Field name="name">
          {(field) => (
            <Field label="이름" error={firstError(field.state.meta.errors)} required>
              <Input
                autoFocus
                name={field.name}
                autoComplete="off"
                placeholder="고객 이름 입력"
                value={field.state.value}
                readOnly={saving}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <Field
              label="전화번호"
              description="예약 안내에 사용할 연락처를 입력해주세요."
              error={firstError(field.state.meta.errors)}
              required
            >
              <Input
                name={field.name}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="010-0000-0000"
                value={field.state.value}
                readOnly={saving}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <p {...stylex.props(styles.info)}>
          같은 전화번호가 이미 등록되어 있으면 저장할 때 알려드려요.
        </p>

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
      </form>

      <p {...stylex.props(styles.footnote)}>저장한 고객 정보는 서버에 보관돼요.</p>
    </section>
  );
}

// 스키마 오류는 issue 객체, 서버 오류는 문자열
function firstError(errors: ReadonlyArray<string | { message: string } | undefined>) {
  const [error] = errors;
  return typeof error === "string" ? error : error?.message;
}

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "10px",
    backgroundColor: colors.surface,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "17px",
  },
  closeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: controls.height,
    height: controls.height,
    padding: 0,
    borderWidth: 0,
    borderRadius: controls.radius,
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": colors.neutralSurface,
    },
    color: {
      default: colors.textMuted,
      ":disabled": colors.disabledText,
    },
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    fontSize: "22px",
    lineHeight: 1,
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineColor: colors.focusRing,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  eyebrow: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
  },
  info: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: controls.radius,
    backgroundColor: colors.infoSurface,
    color: colors.text,
    fontSize: controls.hintFontSize,
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
  footnote: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
  },
});
