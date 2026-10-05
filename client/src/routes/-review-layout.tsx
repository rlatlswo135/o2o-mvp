import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors } from "../shared/ui/theme.stylex.ts";

// 공통 UI 검토 화면의 배치. 업무 화면 단계에서 검토 화면과 함께 교체한다.
export const reviewStyles = stylex.create({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
    gap: "20px",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 20px",
  },
  note: {
    color: colors.textMuted,
    fontSize: "12px",
  },
  values: {
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    gap: "6px 16px",
    margin: 0,
    padding: "16px",
    borderRadius: "6px",
    backgroundColor: colors.neutralSurface,
    fontSize: "13px",
  },
  valueLabel: {
    color: colors.textMuted,
  },
  value: {
    margin: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

/** 현재 값 확인 목록(dl)의 한 줄. 줄바꿈을 그대로 보여준다. */
export function ReviewValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt {...stylex.props(reviewStyles.valueLabel)}>{label}</dt>
      <dd {...stylex.props(reviewStyles.value)}>{children}</dd>
    </>
  );
}
