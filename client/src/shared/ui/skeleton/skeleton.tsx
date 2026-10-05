import * as stylex from "@stylexjs/stylex";

import { colors, controls } from "../theme.stylex.js";

export type SkeletonProps = {
  /** 보이는 로딩 문구. 움직임 없이도 불러오는 중임을 알린다. */
  label: string;
  /** placeholder 행 수. */
  rows?: number | undefined;
};

/**
 * 목록을 불러오는 동안의 자리 표시. 영역은 busy로 표시하고 문구는 보조기기에 남기며,
 * placeholder 장식은 숨긴다. 움직임·타이머 없는 정적 표현이다.
 */
export function Skeleton({ label, rows = 3 }: SkeletonProps) {
  return (
    <div aria-busy="true" {...stylex.props(styles.root)}>
      <p {...stylex.props(styles.label)}>{label}</p>
      <div aria-hidden="true" {...stylex.props(styles.decoration)}>
        <span {...stylex.props(styles.bar, styles.heading)} />
        {Array.from({ length: rows }, (_, index) => (
          <span key={index} data-skeleton-row {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.circle)} />
            <span {...stylex.props(styles.bar, styles.line)} />
            <span {...stylex.props(styles.bar, styles.short)} />
          </span>
        ))}
      </div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "8px",
  },
  label: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
  },
  decoration: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  bar: {
    display: "block",
    height: "10px",
    borderRadius: "5px",
    backgroundColor: colors.neutralSurface,
  },
  heading: {
    width: "30%",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  circle: {
    flexShrink: 0,
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: colors.neutralSurface,
  },
  line: {
    flexGrow: 1,
    maxWidth: "40%",
  },
  short: {
    width: "60px",
    marginInlineStart: "auto",
  },
});
