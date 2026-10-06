import * as stylex from "@stylexjs/stylex";
import { useCallback, useRef } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { EmptyState } from "@/shared/ui/empty-state/empty-state.tsx";
import { ErrorState } from "@/shared/ui/error-state/error-state.tsx";
import { Skeleton } from "@/shared/ui/skeleton/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/shared/ui/table/table.tsx";

import type { Customer } from "./customer.ts";

import { colors } from "../../shared/ui/theme.stylex.ts";

export type CustomerListQuery =
  | { kind: "loading" }
  | { kind: "loaded"; customers: ReadonlyArray<Customer> }
  | { kind: "failed" };

export type CustomerListProps = {
  query: CustomerListQuery;
  /** 조회 실패 후 다시 조회한다. */
  onRetry: () => void;
};

/** 고객 목록 조회 영역. 불러오는 중·빈 결과·조회 실패·목록을 서로 다른 표현으로 보여준다. */
export function CustomerList({ query, onRetry }: CustomerListProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // 재시도 버튼이 사라지므로 목록 영역으로 포커스를 옮긴다.
  const handleRetry = useCallback(() => {
    onRetry();
    sectionRef.current?.focus();
  }, [onRetry]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="customer-list-title"
      tabIndex={-1}
      {...stylex.props(styles.section)}
    >
      <h2 id="customer-list-title" {...stylex.props(styles.title)}>
        전체 고객
      </h2>

      {query.kind === "loading" && <Skeleton label="고객 목록을 불러오는 중이에요." rows={5} />}
      {query.kind === "failed" && (
        <ErrorState message="고객 목록을 불러오지 못했어요. 고객이 없다는 뜻은 아니에요.">
          <Button variant="secondary" onClick={handleRetry}>
            다시 시도
          </Button>
        </ErrorState>
      )}
      {query.kind === "loaded" && query.customers.length === 0 && (
        <EmptyState
          title="아직 등록된 고객이 없어요"
          description="고객 등록으로 첫 고객을 추가해보세요."
        />
      )}
      {query.kind === "loaded" && query.customers.length > 0 && (
        <div {...stylex.props(styles.listBox)}>
          <Table caption="고객 목록" hideCaption>
            <TableHead>
              <TableRow>
                <TableHeaderCell>No.</TableHeaderCell>
                <TableHeaderCell>이름</TableHeaderCell>
                <TableHeaderCell>전화번호</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.customers.map((customer, index) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <span {...stylex.props(styles.number)}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span {...stylex.props(styles.name)}>{customer.name}</span>
                  </TableCell>
                  <TableCell>
                    <span {...stylex.props(styles.phone)}>{customer.phone}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p {...stylex.props(styles.footer)}>등록된 고객 {query.customers.length}명</p>
        </div>
      )}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    borderRadius: "8px",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "4px",
    outlineColor: colors.focusRing,
  },
  title: {
    margin: 0,
    paddingBottom: "10px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
    color: colors.primary,
    fontSize: "14px",
  },
  listBox: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  number: {
    color: colors.textMuted,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  name: {
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  phone: {
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  footer: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "12px",
  },
});
