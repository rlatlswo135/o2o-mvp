import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { a11yStyles } from "../internal/control-styles.js";
import { colors, controls } from "../theme.stylex.js";

type CellAlign = "start" | "end";

export type TableProps = Omit<ComponentPropsWithRef<"table">, "className" | "style"> & {
  /** 표 이름. caption이 되어 보조기기가 표 이름으로 읽고, 스크롤 영역의 이름으로도 쓴다. */
  caption: string;
  /** caption을 화면에서만 숨긴다. 표 이름은 보조기기에 계속 제공된다. */
  hideCaption?: boolean | undefined;
};

/**
 * 네이티브 table. 좁은 화면에서는 표 영역만 가로 스크롤되며,
 * 스크롤 영역에 키보드 포커스를 줄 수 있어 화살표 키로도 내용을 볼 수 있다.
 */
export function Table({ caption, hideCaption = false, children, ...props }: TableProps) {
  const captionId = useId();

  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} {...stylex.props(styles.scroller)}>
      <table {...props} {...stylex.props(styles.table)}>
        <caption
          id={captionId}
          {...stylex.props(styles.caption, hideCaption && a11yStyles.visuallyHidden)}
        >
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: Omit<ComponentPropsWithRef<"thead">, "className" | "style">) {
  return <thead {...props} />;
}

export function TableBody(props: Omit<ComponentPropsWithRef<"tbody">, "className" | "style">) {
  return <tbody {...props} />;
}

export function TableRow(props: Omit<ComponentPropsWithRef<"tr">, "className" | "style">) {
  return <tr {...props} {...stylex.props(styles.row)} />;
}

export type TableHeaderCellProps = Omit<
  ComponentPropsWithRef<"th">,
  "className" | "style" | "align"
> & {
  /** 숫자 열은 end로 오른쪽 정렬한다. */
  align?: CellAlign | undefined;
};

/** 열 머리글. scope 기본값은 col. */
export function TableHeaderCell({
  align = "start",
  scope = "col",
  ...props
}: TableHeaderCellProps) {
  return (
    <th
      {...props}
      scope={scope}
      {...stylex.props(styles.cell, styles.headerCell, align === "end" && styles.alignEnd)}
    />
  );
}

export type TableCellProps = Omit<ComponentPropsWithRef<"td">, "className" | "style" | "align"> & {
  /** 숫자 열은 end로 오른쪽 정렬한다. */
  align?: CellAlign | undefined;
};

export function TableCell({ align = "start", ...props }: TableCellProps) {
  return (
    <td
      {...props}
      {...stylex.props(styles.cell, styles.bodyCell, align === "end" && styles.alignEnd)}
    />
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  scroller: {
    maxWidth: "100%",
    overflowX: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: controls.radius,
    backgroundColor: colors.surface,
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    color: colors.text,
    fontSize: {
      default: controls.fontSize,
      [narrow]: "14px",
    },
  },
  caption: {
    padding: "12px 16px 0",
    color: colors.text,
    fontSize: controls.labelFontSize,
    fontWeight: 600,
    textAlign: "start",
  },
  // 행 사이 구분선. 머리글·본문의 첫 행은 바깥 테두리·머리글 아래선과 겹치지 않게 뺀다.
  row: {
    borderTopWidth: {
      default: "1px",
      ":first-child": 0,
    },
    borderTopStyle: "solid",
    borderTopColor: colors.border,
    // 머리글 행은 칸 바탕이 덮어 본문 행만 hover가 보인다.
    backgroundColor: {
      default: "transparent",
      ":hover": "#fdf8f4",
    },
  },
  cell: {
    paddingInline: {
      default: "20px",
      // 375px에서 아바타·이름 · 전화번호 · 수정이 한 줄에 들어가는 폭
      [narrow]: "10px",
    },
    textAlign: "start",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  headerCell: {
    height: "44px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
    backgroundColor: "#fbf6f1",
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontWeight: 600,
  },
  bodyCell: {
    height: {
      default: "60px",
      [narrow]: "56px",
    },
    fontVariantNumeric: "tabular-nums",
  },
  alignEnd: {
    textAlign: "end",
  },
});
