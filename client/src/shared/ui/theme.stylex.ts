import * as stylex from "@stylexjs/stylex";

// 코랄 살롱 시안 기준 의미 토큰. 테마 교체 시 값만 바꾸고 이름(의미)은 유지한다.
export const colors = stylex.defineVars({
  canvas: "#faf5f0",
  surface: "#fffdfa",
  text: "#2b201c",
  textMuted: "#76665e",
  border: "#eadfd6",
  borderHover: "#cdb8ab",

  primary: "#2b201c",
  primaryHover: "#46362f",
  onPrimary: "#fff8f2",
  focusRing: "#2b201c",
  focusRingSoft: "rgba(217, 88, 63, 0.22)",

  neutralSurface: "#f3ebe4",
  neutralText: "#5e504a",

  infoSurface: "#f1eeea",
  success: "#2e6b45",
  successSurface: "#e7f2ea",
  warning: "#8a5300",
  warningSurface: "#fcf1dc",

  danger: "#b3261e",
  dangerSurface: "#fdf0ee",
  dangerBorder: "#f0c3bd",
  dangerRingSoft: "rgba(179, 38, 30, 0.16)",

  disabledSurface: "#f1eae4",
  disabledText: "#b3a69e",

  overlay: "rgba(43, 32, 28, 0.42)",

  // 브랜드 포인트(마크·활성 메뉴·eyebrow). 버튼 채움·오류에는 쓰지 않는다.
  accent: "#d9583f",
  accentSurface: "#fce6de",
  accentText: "#a5402b",
});

export const controls = stylex.defineVars({
  height: "44px",
  radius: "12px",
  paddingX: "16px",
  fontSize: "15px",
  labelFontSize: "13px",
  hintFontSize: "12px",
});

export const radii = stylex.defineVars({
  pill: "999px",
  small: "8px",
  card: "20px",
  sheet: "24px",
});

export const shadows = stylex.defineVars({
  card: "0 1px 2px rgba(43, 32, 28, 0.04), 0 8px 24px rgba(43, 32, 28, 0.05)",
  sheet: "0 24px 64px rgba(43, 32, 28, 0.18)",
  toast: "0 12px 32px rgba(43, 32, 28, 0.16)",
});
