import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { Brand } from "@/shared/brand/brand.tsx";

import { colors, radii } from "../shared/ui/theme.stylex.ts";

// 사장님 업무 화면 공통 레이아웃. 인증 guard는 아직 없다(인증 연결 스토리에서 추가).
export const Route = createFileRoute("/_app")({ component: AppShell });

function AppShell() {
  return (
    <div {...stylex.props(styles.shell)}>
      <header {...stylex.props(styles.topBar)}>
        <span {...stylex.props(styles.brand)}>
          <Brand />
        </span>
        {/* 메뉴는 만든 화면(고객·시술·예약)만 둔다 */}
        <nav aria-label="주요 메뉴" {...stylex.props(styles.nav)}>
          <Link to="/customers" activeProps={navLinkActive} inactiveProps={navLinkIdle}>
            고객
          </Link>
          <Link to="/treatments" activeProps={navLinkActive} inactiveProps={navLinkIdle}>
            시술
          </Link>
          {/* search 없이 열어 메뉴로 들어오면 항상 오늘 날짜다 */}
          <Link to="/reservations" activeProps={navLinkActive} inactiveProps={navLinkIdle}>
            예약
          </Link>
        </nav>
        {/* 보호되지 않은 로컬 확인용 화면이라는 사실 표시. 인증이 연결되면 지운다. */}
        <span {...stylex.props(styles.chip)}>
          <span aria-hidden="true" {...stylex.props(styles.chipDot)} />
          로그인 연결 전
        </span>
      </header>
      <main {...stylex.props(styles.main)}>
        <Outlet />
      </main>
    </div>
  );
}

const narrow = "@media (max-width: 719px)";
const tablet = "@media (min-width: 720px) and (max-width: 1023px)";

const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    backgroundColor: colors.canvas,
    color: colors.text,
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "grid",
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr) auto",
      [narrow]: "minmax(0, 1fr) auto",
    },
    gridTemplateAreas: {
      default: "'brand nav chip'",
      [narrow]: "'brand chip' 'nav nav'",
    },
    gridTemplateRows: {
      default: "64px",
      [narrow]: "56px 44px",
    },
    alignItems: "center",
    columnGap: {
      default: "32px",
      [narrow]: "12px",
    },
    paddingInline: {
      default: "40px",
      [tablet]: "24px",
      [narrow]: "16px",
    },
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: {
    gridArea: "brand",
    display: "flex",
  },
  nav: {
    gridArea: "nav",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    paddingBottom: {
      default: 0,
      [narrow]: "4px",
    },
    overflowX: "auto",
  },
  chip: {
    gridArea: "chip",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "28px",
    paddingInline: "12px",
    borderRadius: radii.pill,
    backgroundColor: colors.neutralSurface,
    color: colors.neutralText,
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  chipDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: colors.warning,
  },
  navLink: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    height: "40px",
    paddingInline: "16px",
    borderRadius: radii.pill,
    fontSize: "14px",
    textDecoration: "none",
    whiteSpace: "nowrap",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  navLinkIdle: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.neutralSurface,
    },
    color: colors.textMuted,
    fontWeight: 600,
  },
  // 색만이 아니라 굵기로도 현재 위치를 구분한다
  navLinkActive: {
    backgroundColor: colors.accentSurface,
    color: colors.text,
    fontWeight: 700,
  },
  main: {
    width: "100%",
    maxWidth: "1120px",
    marginInline: "auto",
    paddingTop: {
      default: "40px",
      [tablet]: "32px",
      [narrow]: "24px",
    },
    paddingBottom: {
      default: "64px",
      [tablet]: "56px",
      [narrow]: "48px",
    },
    paddingInline: {
      default: "40px",
      [tablet]: "24px",
      [narrow]: "16px",
    },
  },
});

// 현재 화면 메뉴는 Link가 aria-current="page"와 함께 activeProps를 적용한다.
const navLinkActive = stylex.props(styles.navLink, styles.navLinkActive);
const navLinkIdle = stylex.props(styles.navLink, styles.navLinkIdle);
