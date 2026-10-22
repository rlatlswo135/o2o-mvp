import type { FormEvent, ReactNode, Ref } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { Button } from "@/shared/ui/button/button.tsx";
import { LiveNotice } from "@/shared/ui/notice/notice.tsx";
import { useSheetTitleId } from "@/shared/ui/sheet/sheet.tsx";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";

export type ReservationSheetFrameProps = {
  title: string;
  closeLabel: string;
  // 하단 왼쪽 버튼 문구. 시트 안에서 '예약 취소'와 헷갈리지 않게 '취소'는 쓰지 않는다
  dismissLabel: string;
  saving: boolean;
  notice: NoticeContent | null;
  footnote: string;
  // 하단 오른쪽 주 버튼
  submit: ReactNode;
  rootRef?: Ref<HTMLDivElement> | undefined;
  dismissRef?: Ref<HTMLButtonElement> | undefined;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  children: ReactNode;
};

// 등록·수정·취소 시트가 함께 쓰는 머리·본문·하단 틀. 구조는 treatments/forms/treatment-form.tsx와 같다
export function ReservationSheetFrame({
  title,
  closeLabel,
  dismissLabel,
  saving,
  notice,
  footnote,
  submit,
  rootRef,
  dismissRef,
  onSubmit,
  onClose,
  children,
}: ReservationSheetFrameProps) {
  const generatedTitleId = useId();
  const titleId = useSheetTitleId() ?? generatedTitleId;

  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <div ref={rootRef} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.heading)}>
          <p {...stylex.props(styles.eyebrow)}>RESERVATION</p>
          <h2 id={titleId} {...stylex.props(styles.title)}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          disabled={saving}
          onClick={handleClose}
          {...stylex.props(styles.closeButton)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <form
        noValidate
        aria-busy={saving || undefined}
        onSubmit={onSubmit}
        {...stylex.props(styles.form)}
      >
        <div {...stylex.props(styles.body)}>{children}</div>

        <div {...stylex.props(styles.footer)}>
          {/* 알림이 없을 때 빈 알림 영역이 버튼 줄 위 간격을 만들지 않게 한다 */}
          <div {...stylex.props(notice && styles.noticeShown)}>
            <LiveNotice notice={notice} />
          </div>
          <div {...stylex.props(styles.actions)}>
            <Button ref={dismissRef} variant="secondary" disabled={saving} onClick={handleClose}>
              {dismissLabel}
            </Button>
            <div {...stylex.props(styles.submit)}>{submit}</div>
          </div>
          <p {...stylex.props(styles.footnote)}>{footnote}</p>
        </div>
      </form>
    </div>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  // 시트 높이 안에서 본문만 스크롤하고 머리·동작 줄은 항상 보이게 한다.
  root: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: {
      default: "24px 20px 8px 24px",
      [narrow]: "12px 12px 4px 16px",
    },
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    color: colors.accent,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "16px",
    letterSpacing: "0.14em",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: "26px",
  },
  closeButton: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    padding: 0,
    borderWidth: 0,
    borderRadius: "50%",
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": colors.neutralSurface,
    },
    color: {
      default: colors.textMuted,
      ":hover:not(:disabled)": colors.text,
      ":disabled": colors.disabledText,
    },
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    fontFamily: "inherit",
    fontSize: "22px",
    lineHeight: 1,
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "18px",
    minHeight: 0,
    padding: {
      default: "16px 24px 24px",
      [narrow]: "12px 16px 16px",
    },
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  footer: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    padding: {
      default: "16px 24px 24px",
      [narrow]: "12px 16px max(16px, env(safe-area-inset-bottom))",
    },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.border,
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  submit: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  noticeShown: {
    marginBottom: "12px",
  },
  footnote: {
    marginTop: "12px",
    marginBottom: 0,
    marginInline: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
});
