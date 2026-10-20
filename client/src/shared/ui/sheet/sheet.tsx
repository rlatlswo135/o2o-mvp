import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Drawer } from "flame-ui";
import { createContext, use, useEffectEvent, useId, useLayoutEffect, useRef } from "react";

import { lockPageScroll } from "../internal/scroll-lock.js";
import { colors, radii, shadows } from "../theme.stylex.js";

const SheetTitleContext = createContext<string | null>(null);

/** Sheet 안 제목 요소에 줄 id. 이 id의 요소가 sheet의 이름이 된다. Sheet 밖이면 null. */
export function useSheetTitleId() {
  return use(SheetTitleContext);
}

export type SheetProps = {
  /** 열림의 정본. 닫기 요청을 받아 소비자가 false로 바꿔야 닫힌다. */
  open: boolean;
  /** Escape·배경 클릭 같은 닫기 요청. */
  onClose: () => void;
  /** false면 Escape·배경 클릭으로 닫히지 않는다. 저장 중처럼 닫히면 안 될 때 쓴다. */
  dismissible?: boolean | undefined;
  /** 닫힌 뒤 포커스를 둘 요소. 없으면 브라우저가 열기 전 요소로 돌려준다. */
  returnFocus?: (() => HTMLElement | null | undefined) | undefined;
  id?: string | undefined;
  children: ReactNode;
};

/**
 * 화면 가장자리에서 겹쳐 여는 모달 시트(넓은 화면은 오른쪽, 좁은 화면은 아래).
 * flame-ui Drawer가 dialog를 그리고, 열리면 첫 입력에 포커스를 둔다.
 */
export function Sheet({
  open,
  onClose,
  dismissible = true,
  returnFocus,
  id,
  children,
}: SheetProps) {
  const titleId = useId();
  const generatedId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useEffectEvent(() => returnFocus?.()?.focus());

  // Drawer를 먼저 연 뒤(자식 effect가 먼저 돈다) 잠그고 포커스를 옮긴다.
  useLayoutEffect(() => {
    if (!open) return;
    const releaseScroll = lockPageScroll();
    panelRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => {
      releaseScroll();
      restoreFocus();
    };
  }, [open]);

  // Escape 등으로 Drawer가 스스로 닫혔을 때만 열림 상태를 맞춘다.
  const handleDrawerClose = () => {
    if (open) onClose();
  };

  // Drawer는 cancel을 받으면 무조건 닫는다. 닫기 요청은 closedby로 막고,
  // closedby를 모르는 브라우저는 Escape keydown을 취소해 cancel이 생기지 않게 한다.
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (!dismissible && event.key === "Escape") event.preventDefault();
  };

  // 누른 곳과 뗀 곳이 모두 배경(dialog 요소 자체)일 때만 닫는다.
  const pressedOnBackdrop = useRef(false);
  const handlePointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  const handleClickCapture = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressedOnBackdrop.current && event.target === event.currentTarget && dismissible) {
      onClose();
    }
    pressedOnBackdrop.current = false;
  };

  return (
    <SheetTitleContext value={titleId}>
      <Drawer id={id ?? generatedId} animation={false} onClose={handleDrawerClose}>
        <Drawer.Content
          {...stylex.props(styles.dialog)}
          aria-labelledby={titleId}
          closedby={dismissible ? undefined : "none"}
          style={drawerSizeReset}
          onKeyDownCapture={handleKeyDownCapture}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
        >
          <div ref={panelRef} {...stylex.props(styles.panel)}>
            <span aria-hidden="true" {...stylex.props(styles.grabber)} />
            {children}
          </div>
        </Drawer.Content>
        {/* 제어형 open이 없어 공개 Trigger·Closer가 주는 함수로 열림을 따라간다. */}
        <Drawer.Trigger>
          {({ open: show }) => (
            <Drawer.Closer>
              {({ close: hide }) => <FollowOpen open={open} show={show} hide={hide} />}
            </Drawer.Closer>
          )}
        </Drawer.Trigger>
      </Drawer>
    </SheetTitleContext>
  );
}

function FollowOpen({ open, show, hide }: { open: boolean; show: () => void; hide: () => void }) {
  const showDrawer = useEffectEvent(show);
  const hideDrawer = useEffectEvent(hide);

  useLayoutEffect(() => {
    if (!open) return;
    showDrawer();
    return () => hideDrawer();
  }, [open]);

  return null;
}

// Drawer가 넣는 인라인 크기·여백을 지워 아래 반응형 스타일이 정하게 한다.
const drawerSizeReset: CSSProperties = {
  height: undefined,
  maxHeight: undefined,
  maxWidth: undefined,
  marginRight: undefined,
};

const narrow = "@media (max-width: 719px)";
const reducedMotion = "@media (prefers-reduced-motion: reduce)";
const bottomGap = "24px";

const slideFromEnd = stylex.keyframes({
  from: { transform: "translateX(24px)", opacity: 0 },
});

const slideFromBottom = stylex.keyframes({
  from: { transform: "translateY(32px)", opacity: 0 },
});

const styles = stylex.create({
  // 닫힌 dialog는 브라우저 기본 display:none으로 숨긴다. 여기서 display를 지정하지 않는다.
  dialog: {
    top: {
      default: 0,
      [narrow]: "auto",
    },
    right: 0,
    bottom: 0,
    left: {
      default: "auto",
      [narrow]: 0,
    },
    width: {
      default: "min(440px, calc(100vw - 32px))",
      [narrow]: "100%",
    },
    maxWidth: "100%",
    height: {
      default: "100dvh",
      [narrow]: "auto",
    },
    maxHeight: {
      default: "100dvh",
      [narrow]: `calc(100dvh - ${bottomGap})`,
    },
    margin: 0,
    padding: 0,
    overflow: "hidden",
    borderWidth: 0,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: {
      default: 0,
      [narrow]: radii.sheet,
    },
    borderBottomLeftRadius: {
      default: radii.sheet,
      [narrow]: 0,
    },
    borderBottomRightRadius: 0,
    backgroundColor: colors.surface,
    color: colors.text,
    boxShadow: shadows.sheet,
    animationName: {
      default: slideFromEnd,
      [narrow]: slideFromBottom,
    },
    animationDuration: {
      default: "200ms",
      [reducedMotion]: "0s",
    },
    animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    "::backdrop": {
      backgroundColor: colors.overlay,
    },
  },
  // 내용이 길면 소비자가 둔 본문 영역만 스크롤하도록 높이를 묶는다.
  // Drawer가 dialog와 이 패널 사이에 section을 넣어 % 높이가 끊기므로 화면 단위로 묶는다.
  panel: {
    display: "flex",
    flexDirection: "column",
    height: {
      default: "100dvh",
      [narrow]: "auto",
    },
    maxHeight: {
      default: "none",
      [narrow]: `calc(100dvh - ${bottomGap})`,
    },
  },
  grabber: {
    display: {
      default: "none",
      [narrow]: "block",
    },
    flexShrink: 0,
    width: "36px",
    height: "4px",
    marginTop: "10px",
    marginInline: "auto",
    borderRadius: "2px",
    backgroundColor: colors.border,
  },
});
