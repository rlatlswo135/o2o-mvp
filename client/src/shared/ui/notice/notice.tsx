import * as stylex from "@stylexjs/stylex";

import { badgeMark } from "../badge/badge.js";
import { colors, controls } from "../theme.stylex.js";

export type NoticeTone = "success" | "warning" | "danger";

export type NoticeContent = {
  tone: NoticeTone;
  title: string;
  description?: string | undefined;
};

export type NoticeProps = NoticeContent & {
  /** 있으면 닫기 버튼을 보여준다. 닫은 뒤 포커스를 둘 곳은 소비자가 정한다. */
  onClose?: (() => void) | undefined;
  /** 닫기 버튼의 접근 가능한 이름. 기본은 `${title} 닫기`. */
  closeLabel?: string | undefined;
  /** 화면 가장자리에 띄울 때의 표현. 그림자를 두고, 긴 내용은 화면 높이 안에서 스크롤해 닫기 버튼을 화면에 남긴다. */
  elevated?: boolean | undefined;
};

/**
 * 처리 결과 표시. 기호는 보조 표시로 숨기고 제목·설명 텍스트로 결과를 전달한다.
 * 자체 live region이 없는 정적 표현이며, 동적 알림은 LiveNotice로 감싼다.
 */
export function Notice({
  tone,
  title,
  description,
  onClose,
  closeLabel,
  elevated = false,
}: NoticeProps) {
  return (
    <div {...stylex.props(styles.root, elevated && styles.elevated)}>
      <span aria-hidden="true" {...stylex.props(styles.mark, markStyles[tone])}>
        {badgeMark(tone)}
      </span>
      <div {...stylex.props(styles.text, elevated && styles.elevatedText)}>
        <p {...stylex.props(styles.title)}>{title}</p>
        {description && <p {...stylex.props(styles.description)}>{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label={closeLabel ?? `${title} 닫기`}
          onClick={onClose}
          {...stylex.props(styles.closeButton)}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

export type LiveNoticeProps = {
  /** 표시할 결과. null이면 알림 영역만 비워 둔다. */
  notice: NoticeContent | null;
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
  elevated?: boolean | undefined;
  /**
   * 표시 사건 식별자. 같은 결과를 다시 알릴 때 값을 바꾸면 영역은 유지한 채 안쪽 알림만 새로 넣어
   * 보조기기가 다시 전달할 수 있다.
   */
  noticeKey?: string | number | undefined;
};

/**
 * 동적 결과 알림. status(성공·경고)와 alert(실패) 영역을 미리 비워 두고 내용만 바꿔
 * 보조기기가 변경을 전달하게 한다. 한 결과는 한 영역에만 넣는다. 포커스는 옮기지 않는다.
 */
export function LiveNotice({ notice, onClose, closeLabel, elevated, noticeKey }: LiveNoticeProps) {
  const content = notice && (
    <Notice
      key={noticeKey}
      {...notice}
      onClose={onClose}
      closeLabel={closeLabel}
      elevated={elevated}
    />
  );
  const urgent = notice?.tone === "danger";

  return (
    <>
      <div role="status">{!urgent && content}</div>
      <div role="alert">{urgent && content}</div>
    </>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px 12px 14px 16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "8px",
    backgroundColor: colors.surface,
    color: colors.text,
  },
  elevated: {
    boxShadow: "0 8px 24px rgba(30, 42, 59, 0.16)",
  },
  // 카드 여백·화면 가장자리 간격을 뺀 높이. 닫기 버튼은 카드 위쪽에 남는다.
  elevatedText: {
    maxHeight: "calc(100dvh - 96px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  mark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    fontSize: controls.hintFontSize,
    fontWeight: 700,
  },
  text: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "2px",
    minWidth: 0,
    paddingBlock: "2px",
  },
  title: {
    margin: 0,
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
  closeButton: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    borderWidth: 0,
    borderRadius: controls.radius,
    backgroundColor: {
      default: "transparent",
      ":hover": colors.neutralSurface,
    },
    color: colors.textMuted,
    fontFamily: "inherit",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
});

const markStyles = stylex.create({
  success: {
    backgroundColor: colors.successSurface,
    color: colors.success,
  },
  warning: {
    backgroundColor: colors.warningSurface,
    color: colors.warning,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
  },
});
