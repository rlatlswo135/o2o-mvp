import * as stylex from "@stylexjs/stylex";

import type { NoticeContent } from "../notice/notice.js";

import { LiveNotice } from "../notice/notice.js";

export type ToastProps = {
  /** 표시할 결과. null이면 비어 있는 알림 영역만 유지한다. */
  notice: NoticeContent | null;
  /** 닫기 버튼으로만 닫는다. 자동 소멸·본문 클릭 닫기는 없다. */
  onClose: () => void;
  closeLabel?: string | undefined;
};

/**
 * 화면 가장자리의 비모달 결과 알림. 표시 여부·문구는 소비자 상태가 정하며
 * 알림 저장소·타이머·큐 없이 한 번에 하나를 보여준다. 표시할 때 포커스를 옮기지 않는다.
 */
export function Toast({ notice, onClose, closeLabel }: ToastProps) {
  return (
    <div {...stylex.props(styles.viewport)}>
      <LiveNotice notice={notice} onClose={onClose} closeLabel={closeLabel} elevated />
    </div>
  );
}

const styles = stylex.create({
  viewport: {
    position: "fixed",
    insetInlineEnd: {
      default: "24px",
      "@media (max-width: 640px)": "16px",
    },
    insetBlockEnd: {
      default: "24px",
      "@media (max-width: 640px)": "16px",
    },
    zIndex: 10,
    width: "min(380px, calc(100vw - 32px))",
  },
});
