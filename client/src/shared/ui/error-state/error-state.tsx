import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { colors, controls, radii } from "../theme.stylex.js";

export type ErrorStateProps = {
  /** 실패 설명. 빈 결과와 구분되는 문구를 소비자가 정한다. */
  message: string;
  /**
   * danger: 보여줄 내용이 없는 실패. 영역을 채우는 상자로 보여준다.
   * warning: 이전 내용을 계속 보여주는 실패(다시 불러오기 실패 등). 내용 위 한 줄 띠로 보여준다.
   */
  tone?: "danger" | "warning" | undefined;
  /** 선택적 재시도 등 액션. 전달한 경우에만 렌더한다. */
  children?: ReactNode;
};

/**
 * 조회 실패를 조회 영역 안에 보여주는 정적 표현. 기호는 보조 표시로 숨긴다.
 * 결과를 따로 알려야 하면 소비자가 LiveNotice·Toast를 쓴다.
 */
export function ErrorState({ message, tone = "danger", children }: ErrorStateProps) {
  const warning = tone === "warning";

  return (
    <div {...stylex.props(warning ? styles.strip : styles.box)}>
      <span aria-hidden="true" {...stylex.props(warning ? styles.stripMark : styles.boxMark)}>
        !
      </span>
      <p {...stylex.props(styles.message, warning && styles.stripMessage)}>{message}</p>
      {children && (
        <div {...stylex.props(styles.actions, !warning && styles.boxActions)}>{children}</div>
      )}
    </div>
  );
}

const styles = stylex.create({
  box: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "48px 24px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.dangerBorder,
    borderRadius: radii.card,
    backgroundColor: colors.dangerSurface,
    textAlign: "center",
  },
  boxMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    marginBottom: "8px",
    borderRadius: "50%",
    backgroundColor: colors.danger,
    color: "#fff",
    fontWeight: 800,
  },
  strip: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 10px",
    padding: "10px 14px",
    borderRadius: controls.radius,
    backgroundColor: colors.warningSurface,
  },
  stripMark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: colors.warning,
    color: "#fff",
    fontSize: controls.hintFontSize,
    fontWeight: 800,
  },
  message: {
    margin: 0,
    color: colors.text,
    fontSize: "15px",
    lineHeight: "24px",
    overflowWrap: "anywhere",
  },
  stripMessage: {
    flexGrow: 1,
    flexBasis: "200px",
    color: "#5c3a00",
    fontSize: "13px",
    lineHeight: "20px",
  },
  actions: {
    display: "flex",
    flexShrink: 0,
    gap: "8px",
  },
  boxActions: {
    marginTop: "8px",
  },
});
