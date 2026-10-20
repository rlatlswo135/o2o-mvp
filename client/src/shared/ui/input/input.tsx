import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";

import { joinIds, useFieldControl } from "../field/field.js";
import { colors, controls } from "../theme.stylex.js";

export type InputProps = Omit<ComponentPropsWithRef<"input">, "className" | "style"> & {
  /** Field 밖에서 오류 상태를 직접 지정한다. Field 안에서는 Field의 error가 기본값이다. */
  invalid?: boolean | undefined;
};

export function Input({
  id,
  invalid,
  required,
  disabled = false,
  "aria-describedby": describedBy,
  ...props
}: InputProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <input
      {...props}
      id={field?.id ?? id}
      required={required ?? field?.required}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      aria-describedby={joinIds(field?.describedBy, describedBy)}
      {...stylex.props(styles.base, isInvalid && styles.invalid, disabled && styles.disabled)}
    />
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  base: {
    width: "100%",
    minHeight: controls.height,
    paddingInline: controls.paddingX,
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: controls.radius,
    borderColor: {
      default: colors.border,
      ":hover": colors.borderHover,
      ":focus": colors.text,
    },
    backgroundColor: {
      default: colors.surface,
      ":read-only": "#fbf7f3",
    },
    color: {
      default: colors.text,
      ":read-only": colors.textMuted,
    },
    fontFamily: "inherit",
    // 16px 미만이면 iOS가 입력 시 화면을 확대한다
    fontSize: {
      default: controls.fontSize,
      [narrow]: "16px",
    },
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus": `0 0 0 3px ${colors.focusRingSoft}`,
    },
    transitionProperty: "border-color, box-shadow",
    transitionDuration: "120ms",
    "::placeholder": {
      color: colors.disabledText,
    },
  },
  invalid: {
    borderColor: colors.danger,
    boxShadow: {
      default: "none",
      ":focus": `0 0 0 3px ${colors.dangerRingSoft}`,
    },
  },
  disabled: {
    borderColor: colors.disabledSurface,
    backgroundColor: colors.disabledSurface,
    color: colors.disabledText,
    cursor: "not-allowed",
  },
});
