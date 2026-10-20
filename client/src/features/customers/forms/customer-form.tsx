import type { CustomerInput } from "@o2o/shared/contracts";
import type { FormEvent } from "react";

import { customerInputSchema } from "@o2o/shared/contracts";
import * as stylex from "@stylexjs/stylex";
import { useForm } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";
import { useSheetTitleId } from "@/shared/ui/sheet/sheet.tsx";

import { colors, controls, radii } from "../../../shared/ui/theme.stylex.ts";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const titleId = useSheetTitleId() ?? generatedTitleId;
  const form = useForm({
    defaultValues,
    validators: { onSubmit: customerInputSchema },
    // 확인 결과는 다듬은 값을 돌려주지 않아 다시 parse한다
    onSubmit: ({ value }) => onSave(customerInputSchema.parse(value), showErrors),
  });

  const showErrors = (errors: CustomerFieldErrors) => {
    // 오류 설명이 입력에 연결된 뒤 포커스를 옮기도록 동기로 그린다
    flushSync(() => {
      for (const name of fieldNames) {
        const message = errors[name];
        if (message === undefined) continue;
        form.setFieldMeta(name, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onSubmit: message },
        }));
      }
    });
    const firstError = fieldNames.find((name) => errors[name] !== undefined);
    rootRef.current?.querySelector<HTMLInputElement>(`input[name="${firstError}"]`)?.focus();
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
          <p {...stylex.props(styles.eyebrow)}>CUSTOMER</p>
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
          <form.Field name="name">
            {(field) => (
              <Field label="이름" error={firstError(field.state.meta.errors)} required>
                <Input
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
            <span aria-hidden="true" {...stylex.props(styles.infoMark)}>
              i
            </span>
            같은 전화번호가 이미 등록되어 있으면 저장할 때 알려드려요.
          </p>
        </div>

        <div {...stylex.props(styles.footer)}>
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
          <p {...stylex.props(styles.footnote)}>저장한 고객 정보는 서버에 보관돼요.</p>
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
  info: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    margin: 0,
    padding: "12px 14px",
    borderRadius: controls.radius,
    backgroundColor: colors.infoSurface,
    color: colors.text,
    fontSize: "13px",
    lineHeight: "20px",
  },
  infoMark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    color: colors.surface,
    fontSize: controls.hintFontSize,
    fontWeight: 800,
  },
  footer: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: "12px",
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
  footnote: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
});
