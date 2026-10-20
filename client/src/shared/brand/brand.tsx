import * as stylex from "@stylexjs/stylex";

import { colors } from "../ui/theme.stylex.ts";

// 확정 제품명이 없어 index.html <title>과 같은 이름을 쓴다. 바뀌면 여기만 바꾼다.
export const APP_NAME = "O2O";

/** 브랜드 마크(매니큐어 방울) + 서비스 이름. */
export function Brand() {
  return (
    <span {...stylex.props(styles.root)}>
      <span aria-hidden="true" {...stylex.props(styles.mark)}>
        <span {...stylex.props(styles.highlight)} />
      </span>
      <span {...stylex.props(styles.wordmark)}>{APP_NAME}</span>
    </span>
  );
}

const styles = stylex.create({
  root: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "10px",
  },
  mark: {
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: colors.accent,
  },
  highlight: {
    position: "absolute",
    right: "7px",
    bottom: "5px",
    left: "7px",
    height: "7px",
    borderRadius: "0 0 8px 8px",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },
  wordmark: {
    color: colors.text,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "0.08em",
  },
});
