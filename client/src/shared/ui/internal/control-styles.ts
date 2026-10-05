import * as stylex from "@stylexjs/stylex";

import { colors, controls } from "../theme.stylex.js";

// Select·Textarea·금액 입력이 함께 쓰는 입력 상자 모양. Input과 같은 테두리·포커스·오류·disabled 표현을 따른다.
export const controlStyles = stylex.create({
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
      ":focus": colors.primary,
    },
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: controls.fontSize,
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
    backgroundColor: colors.dangerSurface,
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

export const a11yStyles = stylex.create({
  // 화면에서는 숨기고 보조기기와 키보드 포커스에는 남긴다.
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});

// fieldset 기본 테두리·여백을 지우고 Field label과 같은 글자 모양의 legend를 쓴다.
export const groupStyles = stylex.create({
  fieldset: {
    minWidth: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  legend: {
    padding: 0,
    marginBottom: "8px",
    color: colors.text,
    fontSize: controls.labelFontSize,
    fontWeight: 600,
  },
});
