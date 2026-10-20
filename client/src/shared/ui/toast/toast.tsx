import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { toast as flameToast, Toaster as FlameToaster } from "flame-ui";

import type { NoticeTone } from "../notice/notice.js";

import { badgeMark } from "../badge/badge.js";
import { colors, controls, radii, shadows } from "../theme.stylex.js";

type ToastTone = Exclude<NoticeTone, "info">;

export type ToastOptions = {
  /** 자동으로 사라지기까지의 시간(ms). 0 이하·Infinity는 즉시 사라지므로 쓰지 않는다. */
  timeout?: number;
};

export type ToastContent = {
  title: ReactNode;
  /** 제목 아래 보조 설명. */
  description?: ReactNode;
};

/** 읽을 시간이 더 필요한 경고·실패는 더 오래 남긴다. */
const toneTimeouts: Record<ToastTone, number> = {
  success: 4000,
  warning: 6000,
  danger: 6000,
};

function toned(tone: ToastTone) {
  return (content: ToastContent, options?: ToastOptions) =>
    flameToast(<ToastCard tone={tone} {...content} />, {
      timeout: options?.timeout ?? toneTimeouts[tone],
    });
}

/**
 * 화면 가장자리의 자동 소멸 알림. 어디서든 호출하며 `<Toaster />`가 한 번 마운트되어 있어야 보인다.
 * `toast(jsx)`는 받은 내용을 그대로(flame-ui 기본 3초), `success`·`warn`·`error`는 `{ title, description }`을 결과 카드로 보여준다.
 * 포커스를 옮기지 않고, 토스트를 누르면 바로 닫힌다. 입력 오류는 토스트가 아니라 필드 가까이에 둔다.
 */
export const toast = Object.assign(
  (content: ReactNode, options?: ToastOptions) => flameToast(content, options),
  {
    success: toned("success"),
    warn: toned("warning"),
    error: toned("danger"),
  },
);

/** 앱 루트에 한 번 둔다. 컨테이너가 미리 live region으로 있어 새로 추가된 토스트를 보조기기가 읽는다. */
export function Toaster() {
  return (
    <FlameToaster
      placement="bottom-right"
      aria-live="polite"
      aria-relevant="additions"
      {...stylex.props(styles.toaster)}
    />
  );
}

function ToastCard({ tone, title, description }: ToastContent & { tone: ToastTone }) {
  return (
    <div {...stylex.props(styles.card)}>
      <span aria-hidden="true" {...stylex.props(styles.mark, markStyles[tone])}>
        {badgeMark(tone)}
      </span>
      <div {...stylex.props(styles.content)}>
        <p {...stylex.props(styles.title)}>{title}</p>
        {description && <p {...stylex.props(styles.description)}>{description}</p>}
      </div>
    </div>
  );
}

const styles = stylex.create({
  toaster: {
    zIndex: 10,
  },
  card: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    width: "min(380px, calc(100vw - 20px))",
    padding: "14px 16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    boxShadow: shadows.toast,
    color: colors.text,
    cursor: "pointer",
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
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "2px",
    minWidth: 0,
    paddingBlock: "2px",
    fontSize: controls.fontSize,
    overflowWrap: "anywhere",
  },
  title: {
    margin: 0,
    fontWeight: 600,
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
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
