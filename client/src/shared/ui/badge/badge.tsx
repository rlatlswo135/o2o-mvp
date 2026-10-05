import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, controls } from "../theme.stylex.js";

export type BadgeTone = "info" | "success" | "neutral" | "warning" | "danger";

// 색을 보지 못해도 의미가 전달되도록 문구가 기본이고, 기호는 보조 표시로만 쓴다.
const toneMarks: Record<BadgeTone, string | null> = {
  info: "•",
  success: "✓",
  neutral: null,
  warning: "!",
  danger: "!",
};

/** 의미별 보조 기호. neutral은 기호 없이 문구만 쓴다. */
export function badgeMark(tone: BadgeTone) {
  return toneMarks[tone];
}

export type BadgeProps = Omit<ComponentPropsWithRef<"span">, "className" | "style"> & {
  /** 의미 표현. 문구(children)는 소비자가 정한다. */
  tone?: BadgeTone;
};

/** 정적 상태 표시. 알림이 아니므로 live region을 붙이지 않는다. */
export function Badge({ tone = "neutral", children, ...props }: BadgeProps) {
  const mark = badgeMark(tone);

  return (
    <span {...props} {...stylex.props(styles.base, toneStyles[tone])}>
      {mark && <span aria-hidden="true">{mark}</span>}
      {children}
    </span>
  );
}

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "22px",
    paddingInline: "8px",
    borderRadius: "4px",
    fontSize: controls.hintFontSize,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
});

const toneStyles = stylex.create({
  info: {
    backgroundColor: colors.infoSurface,
    color: colors.primary,
  },
  success: {
    backgroundColor: colors.successSurface,
    color: colors.success,
  },
  neutral: {
    backgroundColor: colors.neutralSurface,
    color: colors.neutralText,
  },
  warning: {
    backgroundColor: colors.warningSurface,
    color: colors.warning,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
  },
});
