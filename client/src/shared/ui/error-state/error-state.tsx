import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, controls } from "../theme.stylex.js";

export type ErrorStateProps = {
  /** 실패 설명. 빈 결과와 구분되는 문구를 소비자가 정한다. */
  message: string;
  /** 선택적 재시도 등 액션. 전달한 경우에만 렌더한다. */
  children?: ReactNode;
};

/**
 * 조회 실패를 조회 영역 안에 보여주는 정적 표현. 기호는 보조 표시로 숨긴다.
 * 결과를 따로 알려야 하면 소비자가 LiveNotice·Toast를 쓴다.
 */
export function ErrorState({ message, children }: ErrorStateProps) {
  return (
    <div {...stylex.props(styles.root)}>
      <span aria-hidden="true" {...stylex.props(styles.mark)}>
        !
      </span>
      <p {...stylex.props(styles.message)}>{message}</p>
      {children && <div {...stylex.props(styles.actions)}>{children}</div>}
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 12px",
    padding: "12px 16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.dangerBorder,
    borderRadius: "8px",
    backgroundColor: colors.dangerSurface,
  },
  mark: {
    flexShrink: 0,
    color: colors.danger,
    fontWeight: 700,
  },
  message: {
    flexGrow: 1,
    flexBasis: "200px",
    margin: 0,
    color: colors.text,
    fontSize: controls.fontSize,
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    flexShrink: 0,
    gap: "8px",
  },
});
