import type { Customer } from "@o2o/shared/contracts";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import type { DataTableColumn } from "@/shared/ui/data-table/data-table.tsx";

import { formatPhone } from "@/shared/format/phone.ts";
import { Button } from "@/shared/ui/button/button.tsx";
import { DataTable } from "@/shared/ui/data-table/data-table.tsx";

import { colors } from "../../shared/ui/theme.stylex.ts";
import { customerQueries } from "./customers.api.ts";

export type CustomerListProps = {
  toolbar?: ReactNode;
  onEdit?: ((customer: Customer, trigger: HTMLButtonElement) => void) | undefined;
  editingId?: number | undefined;
};

export function CustomerList({ toolbar, onEdit, editingId }: CustomerListProps) {
  const query = useQuery(customerQueries.list());

  const columns: ReadonlyArray<DataTableColumn<Customer>> = [
    {
      key: "number",
      header: "No.",
      cell: (_, index) => (
        <span {...stylex.props(styles.number)}>{String(index + 1).padStart(2, "0")}</span>
      ),
    },
    {
      key: "name",
      header: "이름",
      cell: (customer) => <span {...stylex.props(styles.name)}>{customer.name}</span>,
    },
    {
      key: "phone",
      header: "전화번호",
      cell: (customer) => (
        <span {...stylex.props(styles.phone)}>{formatPhone(customer.phone)}</span>
      ),
    },
    ...(onEdit
      ? [
          {
            key: "actions",
            header: "관리",
            align: "end",
            cell: (customer: Customer) => {
              const editing = customer.id === editingId;
              return (
                <Button
                  variant={editing ? "primary" : "secondary"}
                  aria-label={`${customer.name} 고객 정보 수정`}
                  aria-expanded={editing}
                  onClick={(event) => onEdit(customer, event.currentTarget)}
                >
                  수정
                </Button>
              );
            },
          } satisfies DataTableColumn<Customer>,
        ]
      : []),
  ];

  return (
    <DataTable
      title="전체 고객"
      query={query}
      columns={columns}
      rowKey={(customer) => customer.id}
      toolbar={toolbar}
      footer={(customers) => (
        <p {...stylex.props(styles.footer)}>등록된 고객 {customers.length}명</p>
      )}
      loadingLabel="고객 목록을 불러오는 중이에요."
      errorMessage="고객 목록을 불러오지 못했어요. 고객이 없다는 뜻은 아니에요."
      empty={{
        title: "아직 등록된 고객이 없어요",
        description: "고객 등록으로 첫 고객을 추가해보세요.",
      }}
    />
  );
}

export function CustomerCount() {
  const { data } = useQuery(customerQueries.list());
  if (data === undefined) return null;
  return <span {...stylex.props(styles.count)}>{data.length}명</span>;
}

const styles = stylex.create({
  count: {
    paddingBlock: "2px",
    paddingInline: "10px",
    borderRadius: "999px",
    backgroundColor: colors.selectedSurface,
    color: colors.primary,
    fontSize: "13px",
    fontWeight: 600,
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
