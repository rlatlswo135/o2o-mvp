import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { createContext, use, useId, useMemo } from "react";

import { colors, controls } from "./theme.stylex.js";

interface FieldControl {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/** Field 안의 입력 요소가 label·설명·오류 연결 정보를 읽는다. Field 밖이면 null. */
export function useFieldControl() {
  return use(FieldContext);
}

export interface FieldProps {
  label: string;
  /** 입력 아래 안내 문구. */
  description?: string | undefined;
  /** 오류 문구. 있으면 입력을 invalid로 표시하고 오류 설명으로 연결한다. */
  error?: string | undefined;
  required?: boolean | undefined;
  /** 입력 요소의 id. 생략하면 자동 생성한다. Field 안 입력의 id는 이 값으로 정해진다. */
  id?: string | undefined;
  children: ReactNode;
}

export function Field({ label, description, error, required = false, id, children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = joinIds(descriptionId, errorId);
  const invalid = Boolean(error);

  const control = useMemo(
    () => ({ id: controlId, describedBy, invalid, required }),
    [controlId, describedBy, invalid, required],
  );

  return (
    <div {...stylex.props(styles.root)}>
      <label htmlFor={controlId} {...stylex.props(styles.label)}>
        {label}
        {required && (
          <span aria-hidden="true" {...stylex.props(styles.requiredMark)}>
            *
          </span>
        )}
      </label>
      <FieldContext value={control}>{children}</FieldContext>
      {description && (
        <p id={descriptionId} {...stylex.props(styles.message)}>
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} {...stylex.props(styles.message, styles.error)}>
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}

export function joinIds(...ids: Array<string | undefined>) {
  const joined = ids.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  label: {
    display: "inline-flex",
    gap: "4px",
    color: colors.text,
    fontSize: controls.labelFontSize,
    fontWeight: 600,
  },
  requiredMark: {
    color: colors.textMuted,
  },
  message: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: 1.4,
  },
  error: {
    color: colors.danger,
  },
});
