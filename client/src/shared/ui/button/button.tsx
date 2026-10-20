import type { ComponentPropsWithRef, MouseEvent } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, controls, radii } from "../theme.stylex.js";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "medium" | "small";

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "className" | "style"> & {
  variant?: ButtonVariant;
  /** small은 표 행·상태 박스 안처럼 좁은 자리의 보조 동작에 쓴다. */
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...stylex.props(
        styles.base,
        size === "small" && styles.small,
        variantStyles[variant],
        loading && styles.loading,
        disabled && styles.disabled,
      )}
    >
      {loading && <span aria-hidden="true" {...stylex.props(styles.spinner)} />}
      {children}
    </button>
  );
}

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: controls.height,
    paddingInline: "20px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: radii.pill,
    fontFamily: "inherit",
    fontSize: controls.fontSize,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transitionProperty: "background-color, border-color, color",
    transitionDuration: "120ms",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  small: {
    minHeight: "36px",
    paddingInline: "14px",
    fontSize: "14px",
  },
  loading: {
    cursor: "progress",
  },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
    color: colors.disabledText,
    cursor: "not-allowed",
  },
  spinner: {
    width: "14px",
    height: "14px",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "currentColor",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animationName: spin,
    animationDuration: "800ms",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
});

const variantStyles = stylex.create({
  primary: {
    backgroundColor: {
      default: colors.primary,
      ":hover": colors.primaryHover,
    },
    borderColor: {
      default: colors.primary,
      ":hover": colors.primaryHover,
    },
    color: colors.onPrimary,
  },
  secondary: {
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.neutralSurface,
    },
    borderColor: colors.borderHover,
    color: colors.text,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    borderColor: {
      default: colors.dangerBorder,
      ":hover": colors.danger,
    },
    color: colors.danger,
  },
});
