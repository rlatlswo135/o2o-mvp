import type { MouseEvent, PointerEvent, ReactNode, RefObject } from "react";

import * as stylex from "@stylexjs/stylex";
import { Dialog as FlameDialog } from "flame-ui";
import { useCallback, useEffect, useId, useRef } from "react";

import { colors, controls } from "../theme.stylex.js";

export type DialogProps = {
  /** 열린 직후 포커스를 받을 요소. 생략하면 브라우저 기본(첫 포커스 가능 요소)을 따른다. */
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  onOpen?: (() => void) | undefined;
  /** 확인·취소·Escape·배경 클릭 등 모든 닫힘마다 호출한다. 확인 여부는 소비자가 구분한다. */
  onClose?: (() => void) | undefined;
  children: ReactNode;
};

/**
 * 네이티브 `<dialog>` 모달(flame-ui Dialog). 모달 의미·배경 차단·포커스 복귀는 브라우저 showModal을 따른다.
 * 열려 있는 동안 페이지 스크롤을 잠그고, 배경 클릭은 닫기로 처리한다.
 */
export function Dialog({ initialFocusRef, onOpen, onClose, children }: DialogProps) {
  const restoreScroll = useRef<(() => void) | null>(null);

  const releaseScroll = useCallback(() => {
    restoreScroll.current?.();
    restoreScroll.current = null;
  }, []);

  // flame-ui는 showModal() 직후 onOpen을 부른다.
  const handleOpen = useCallback(() => {
    restoreScroll.current ??= lockPageScroll();
    onOpen?.();
    initialFocusRef?.current?.focus();
  }, [initialFocusRef, onOpen]);

  const handleClose = useCallback(() => {
    releaseScroll();
    onClose?.();
  }, [releaseScroll, onClose]);

  useEffect(() => releaseScroll, [releaseScroll]);

  return (
    <FlameDialog keepMounted onOpen={handleOpen} onClose={handleClose}>
      {children}
    </FlameDialog>
  );
}

function lockPageScroll() {
  const root = document.documentElement;
  const previous = root.style.overflow;
  root.style.overflow = "hidden";
  return () => {
    root.style.overflow = previous;
  };
}

/** 단일 요소에 열기 동작과 aria-haspopup을 붙인다. 함수 children이면 `{ open }`을 받는다. */
export const DialogTrigger = FlameDialog.Trigger;

/** 단일 요소에 닫기 동작을 붙인다. 함수 children이면 `{ close }`를 받는다. */
export const DialogClose = FlameDialog.Closer;

type DialogTone = "default" | "danger";

export type DialogContentProps = {
  title: ReactNode;
  /** 본문 아래 보조 설명. dialog의 설명으로 연결한다. */
  description?: ReactNode;
  tone?: DialogTone | undefined;
  /** 닫기 아이콘 버튼의 접근 가능한 이름. */
  closeLabel?: string | undefined;
  /** 하단 버튼 영역. */
  actions: ReactNode;
  children?: ReactNode;
};

export function DialogContent({
  title,
  description,
  tone = "default",
  closeLabel = "닫기",
  actions,
  children,
}: DialogContentProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  // 누른 곳과 뗀 곳이 모두 배경(dialog 요소 자체)일 때만 닫는다.
  // 패널 안에서 눌러 배경에서 떼면 click이 dialog로 오지만 닫지 않는다.
  const pressedOnBackdrop = useRef(false);
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }, []);
  const handleClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) {
      event.currentTarget.close();
    }
    pressedOnBackdrop.current = false;
  }, []);

  return (
    <FlameDialog.Content
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      {...stylex.props(styles.dialog)}
    >
      <div {...stylex.props(styles.panel)}>
        <header {...stylex.props(styles.header)}>
          {tone === "danger" && (
            <span aria-hidden="true" {...stylex.props(styles.mark)}>
              !
            </span>
          )}
          <h2 id={titleId} {...stylex.props(styles.title)}>
            {title}
          </h2>
          <DialogClose>
            <button type="button" aria-label={closeLabel} {...stylex.props(styles.closeButton)}>
              <span aria-hidden="true">×</span>
            </button>
          </DialogClose>
        </header>
        <div {...stylex.props(styles.body)}>
          {children}
          {description && (
            <p id={descriptionId} {...stylex.props(styles.description)}>
              {description}
            </p>
          )}
        </div>
        <div {...stylex.props(styles.actions)}>{actions}</div>
      </div>
    </FlameDialog.Content>
  );
}

const viewportGap = "32px";

const styles = stylex.create({
  // 닫힌 dialog는 브라우저 기본 display:none으로 숨긴다. 여기서 display를 지정하지 않는다.
  dialog: {
    width: `min(480px, calc(100vw - ${viewportGap}))`,
    maxWidth: `calc(100vw - ${viewportGap})`,
    maxHeight: `calc(100dvh - ${viewportGap})`,
    padding: 0,
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "8px",
    backgroundColor: colors.surface,
    color: colors.text,
    boxShadow: "0 12px 32px rgba(30, 42, 59, 0.18)",
    "::backdrop": {
      backgroundColor: colors.overlay,
    },
  },
  // 긴 내용은 본문만 스크롤하고 머리·버튼 영역은 항상 보이게 한다.
  panel: {
    display: "flex",
    flexDirection: "column",
    maxHeight: `calc(100dvh - ${viewportGap} - 2px)`,
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "12px",
    padding: "20px 16px 4px 24px",
  },
  mark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.dangerBorder,
    borderRadius: controls.radius,
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    fontWeight: 700,
  },
  title: {
    flexGrow: 1,
    minWidth: 0,
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  closeButton: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    padding: 0,
    borderWidth: 0,
    borderRadius: controls.radius,
    backgroundColor: {
      default: "transparent",
      ":hover": colors.neutralSurface,
    },
    color: colors.textMuted,
    fontFamily: "inherit",
    fontSize: "20px",
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
  body: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    gap: "16px",
    minHeight: 0,
    padding: "16px 24px 24px",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
  },
  actions: {
    display: "flex",
    flexShrink: 0,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "16px 24px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.border,
  },
});
