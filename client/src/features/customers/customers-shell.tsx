import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

import { colors } from "../../shared/ui/theme.stylex.ts";

/** 사장님 화면 틀(왼쪽 메뉴·상단 바). 아직 만든 화면이 고객뿐이라 메뉴도 고객만 둔다. */
export function CustomersShell({ children }: { children: ReactNode }) {
  return (
    <div {...stylex.props(styles.shell)}>
      <nav aria-label="주요 메뉴" {...stylex.props(styles.rail)}>
        <span aria-hidden="true" {...stylex.props(styles.logo)}>
          m
        </span>
        <Link to="/customers" activeProps={railLinkActive} inactiveProps={railLinkIdle}>
          고객
        </Link>
      </nav>
      <div {...stylex.props(styles.content)}>
        <header {...stylex.props(styles.topBar)}>
          <p {...stylex.props(styles.brand)}>
            <strong>MORU</strong>
            <span aria-hidden="true" {...stylex.props(styles.divider)}>
              |
            </span>
            모루 네일(가상)
          </p>
          <p {...stylex.props(styles.status)}>가상 데이터 · 저장 미연결</p>
        </header>
        <main {...stylex.props(styles.main)}>{children}</main>
      </div>
    </div>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: {
      default: "row",
      [narrow]: "column",
    },
    minHeight: "100dvh",
    backgroundColor: colors.canvas,
    color: colors.text,
  },
  rail: {
    display: "flex",
    flexDirection: {
      default: "column",
      [narrow]: "row",
    },
    alignItems: "center",
    flexShrink: 0,
    gap: "12px",
    width: {
      default: "76px",
      [narrow]: "auto",
    },
    padding: {
      default: "16px 8px",
      [narrow]: "8px 16px",
    },
    backgroundColor: colors.text,
  },
  logo: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontSize: "18px",
    fontWeight: 700,
  },
  railLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "56px",
    minHeight: "40px",
    paddingInline: "8px",
    borderRadius: "8px",
    color: colors.onPrimary,
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.onPrimary,
  },
  railLinkIdle: {
    backgroundColor: {
      default: "transparent",
      ":hover": "rgba(255, 255, 255, 0.12)",
    },
  },
  railLinkActive: {
    backgroundColor: colors.primary,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  topBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px 16px",
    padding: "12px 24px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: 0,
    fontSize: "14px",
  },
  divider: {
    color: colors.border,
  },
  status: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "12px",
  },
  main: {
    flexGrow: 1,
    padding: {
      default: "24px",
      [narrow]: "16px",
    },
  },
});

// 현재 화면 메뉴는 Link가 aria-current="page"와 함께 activeProps를 적용한다.
const railLinkActive = stylex.props(styles.railLink, styles.railLinkActive);
const railLinkIdle = stylex.props(styles.railLink, styles.railLinkIdle);
