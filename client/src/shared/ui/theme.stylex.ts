import * as stylex from "@stylexjs/stylex";

// 잉크 블루 시안 기준 의미 토큰. 테마 교체 시 값만 바꾸고 이름(의미)은 유지한다.
export const colors = stylex.defineVars({
  canvas: "#f2f5f9",
  surface: "#ffffff",
  text: "#1e2a3b",
  textMuted: "#6b7686",
  border: "#d3dae4",
  borderHover: "#aab5c4",

  primary: "#2f5d9b",
  primaryHover: "#264d82",
  onPrimary: "#ffffff",
  focusRing: "#2f5d9b",
  focusRingSoft: "rgba(47, 93, 155, 0.18)",

  neutralSurface: "#eef2f7",

  danger: "#b9382f",
  dangerSurface: "#fff4f2",
  dangerBorder: "#f1c6c1",
  dangerRingSoft: "rgba(185, 56, 47, 0.16)",

  disabledSurface: "#eef1f5",
  disabledText: "#a3abb7",
});

export const controls = stylex.defineVars({
  height: "40px",
  radius: "6px",
  paddingX: "14px",
  fontSize: "14px",
  labelFontSize: "13px",
  hintFontSize: "12px",
});
