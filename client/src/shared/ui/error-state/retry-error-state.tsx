import * as stylex from "@stylexjs/stylex";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import { Button } from "../button/button.js";
import { a11yStyles } from "../internal/control-styles.js";
import { ErrorState } from "./error-state.js";

export type RetryErrorStateProps = {
  message: string;
  tone?: "danger" | "warning" | undefined;
  onRetry: () => void;
  /** 다시 시도 중에는 상자를 그대로 두고 버튼만 막는다. */
  retrying: boolean;
  /** 다시 시도가 성공해 상자가 사라질 때 포커스를 받을 곳. */
  returnFocus?: (() => HTMLElement | null | undefined) | undefined;
};

/** 조회 실패와 다시 시도. 진행·실패 결과는 화면 문구를 바꾸지 않고 숨긴 알림으로 전한다. */
export function RetryErrorState({
  message,
  tone,
  onRetry,
  retrying,
  returnFocus,
}: RetryErrorStateProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [attempted, setAttempted] = useState(false);

  const restoreFocus = useEffectEvent(() => returnFocus?.()?.focus());

  // 버튼이 DOM에서 빠지기 전에 옮겨야 포커스가 body로 떨어지지 않는다
  useLayoutEffect(() => {
    const button = buttonRef.current;
    return () => {
      if (button && button === document.activeElement) restoreFocus();
    };
  }, []);

  const handleRetry = () => {
    setAttempted(true);
    onRetry();
  };

  const notice = retrying ? "다시 불러오는 중이에요." : attempted ? "다시 불러오지 못했어요." : "";

  return (
    <ErrorState tone={tone} message={message}>
      <Button
        ref={buttonRef}
        variant="secondary"
        size="small"
        loading={retrying}
        onClick={handleRetry}
      >
        {retrying ? "다시 시도 중" : "다시 시도"}
      </Button>
      <span aria-live="polite" {...stylex.props(a11yStyles.visuallyHidden)}>
        {notice}
      </span>
    </ErrorState>
  );
}
