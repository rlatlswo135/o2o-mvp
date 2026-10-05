import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, controls } from "../theme.stylex.js";

export type EmptyStateProps = {
  title: string;
  /** 다음 행동을 안내하는 설명. 액션이 없어도 항상 보인다. */
  description: string;
  /** 선택적 액션. 전달한 경우에만 렌더한다. */
  children?: ReactNode;
};

/** 조회 결과가 비어 있음을 알리는 정적 표현. 조회 실패는 ErrorState로 구분한다. */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div {...stylex.props(styles.root)}>
      <p {...stylex.props(styles.title)}>{title}</p>
      <p {...stylex.props(styles.description)}>{description}</p>
      {children && <div {...stylex.props(styles.actions)}>{children}</div>}
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "32px 20px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: "8px",
    textAlign: "center",
  },
  title: {
    margin: 0,
    color: colors.text,
    fontSize: controls.fontSize,
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px",
    marginTop: "10px",
  },
});
