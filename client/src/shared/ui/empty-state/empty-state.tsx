import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, radii } from "../theme.stylex.js";

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
      <span aria-hidden="true" {...stylex.props(styles.icon)}>
        <span {...stylex.props(styles.drop)} />
      </span>
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
    gap: "8px",
    padding: "48px 24px",
    borderRadius: radii.card,
    textAlign: "center",
  },
  // 매니큐어 방울 장식
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    marginBottom: "8px",
    borderRadius: "50%",
    backgroundColor: colors.accentSurface,
  },
  drop: {
    width: "14px",
    height: "24px",
    borderRadius: "7px 7px 7px 7px / 10px 10px 7px 7px",
    backgroundColor: colors.accent,
  },
  title: {
    margin: 0,
    color: colors.text,
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: "24px",
    overflowWrap: "anywhere",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "13px",
    lineHeight: "20px",
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px",
    marginTop: "8px",
  },
});
