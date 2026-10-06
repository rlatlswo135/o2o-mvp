import type { ChangeEvent, FormEvent, RefObject } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import type { CustomerFieldErrors, CustomerInput } from "./customer.ts";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";
import { validateCustomerInput } from "./customer.ts";

type FocusTarget = "name" | "phone";

export type CustomerFormProps = {
  /** 패널 제목 id. 패널 section의 접근 이름이 된다. */
  titleId: string;
  /** 이름 입력. 패널이 열리거나 이미 열린 상태에서 등록 버튼을 누르면 여기로 포커스한다. */
  nameInputRef: RefObject<HTMLInputElement | null>;
  saving: boolean;
  /** 확인을 통과한 값을 저장한다. 중복 전화번호면 onDuplicate를 불러 전화번호 오류로 표시한다. */
  onSave: (input: CustomerInput, onDuplicate: () => void) => void;
  /** 취소·닫기. 저장 중에는 호출하지 않는다. */
  onClose: () => void;
};

const duplicatePhoneMessage = "이미 등록된 전화번호예요. 번호를 확인해주세요.";

/** 새 고객 등록 패널. 입력 값·항목 오류를 갖고, 저장 결과 반영(목록·알림)은 화면이 맡는다. */
export function CustomerForm({
  titleId,
  nameInputRef,
  saving,
  onSave,
  onClose,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerInput>({ name: "", phone: "" });
  const [errors, setErrors] = useState<CustomerFieldErrors>({});
  const phoneInputRef = useRef<HTMLInputElement>(null);
  // 오류 문구가 입력에 연결된 뒤 포커스해야 보조기기가 오류를 함께 읽는다.
  const pendingFocus = useRef<FocusTarget | null>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, [nameInputRef]);

  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "name") nameInputRef.current?.focus();
    if (target === "phone") phoneInputRef.current?.focus();
  }, [errors, nameInputRef]);

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    setValues((current) => ({ ...current, name }));
    setErrors((current) => (current.name ? { ...current, name: undefined } : current));
  }, []);

  const handlePhoneChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const phone = event.target.value;
    setValues((current) => ({ ...current, phone }));
    setErrors((current) => (current.phone ? { ...current, phone: undefined } : current));
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving) return;

      const validation = validateCustomerInput(values);
      if (!validation.ok) {
        pendingFocus.current = validation.errors.name ? "name" : "phone";
        setErrors(validation.errors);
        return;
      }

      onSave(validation.value, () => {
        pendingFocus.current = "phone";
        setErrors({ phone: duplicatePhoneMessage });
      });
    },
    [onSave, saving, values],
  );

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);

  return (
    <section aria-labelledby={titleId} {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelHeader)}>
        <h2 id={titleId} {...stylex.props(styles.title)}>
          새 고객 등록
        </h2>
        <button
          type="button"
          aria-label="등록 닫기"
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
        <Field label="이름" error={errors.name} required>
          <Input
            ref={nameInputRef}
            name="name"
            autoComplete="off"
            placeholder="고객 이름 입력"
            value={values.name}
            readOnly={saving}
            onChange={handleNameChange}
          />
        </Field>
        <Field
          label="전화번호"
          description="예약 안내에 사용할 연락처를 입력해주세요."
          error={errors.phone}
          required
        >
          <Input
            ref={phoneInputRef}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="010-0000-0000"
            value={values.phone}
            readOnly={saving}
            onChange={handlePhoneChange}
          />
        </Field>
        <p {...stylex.props(styles.info)}>
          같은 전화번호가 이미 등록되어 있으면 저장할 때 알려드려요.
        </p>

        <div {...stylex.props(styles.actions)}>
          <Button variant="secondary" disabled={saving} onClick={handleClose}>
            취소
          </Button>
          <div {...stylex.props(styles.submit)}>
            <Button type="submit" loading={saving}>
              {saving ? "저장 중" : "고객 저장"}
            </Button>
          </div>
        </div>
      </form>

      <p {...stylex.props(styles.footnote)}>
        가상 저장이에요. 실제 서버에 저장되지 않으며 새로고침하면 처음 예시로 돌아가요.
      </p>
    </section>
  );
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
