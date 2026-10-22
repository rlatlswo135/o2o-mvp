import type { Customer } from "@o2o/shared/contracts";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { formatPhone } from "@/shared/format/phone.ts";
import { Button } from "@/shared/ui/button/button.tsx";
import { createAppColumnHelper, DataTable } from "@/shared/ui/data-table/data-table.tsx";
import { EmptyState } from "@/shared/ui/empty-state/empty-state.tsx";
import { Skeleton } from "@/shared/ui/skeleton/skeleton.tsx";

import { colors } from "../../shared/ui/theme.stylex.ts";
import { customerQueries } from "./customers.api.ts";

export type CustomerListProps = {
  actions?: ReactNode;
  onEdit?: ((customer: Customer, trigger: HTMLButtonElement) => void) | undefined;
  editingId?: number | undefined;
};

export function CustomerList({ actions, onEdit, editingId }: CustomerListProps) {
  const query = useQuery(customerQueries.list());

  const columns = onEdit
    ? [
        ...baseColumns,
        columnHelper.display({
          id: "actions",
          header: "관리",
          meta: { align: "end" },
          cell: ({ row: { original: customer } }) => (
            <Button
              variant="secondary"
              size="small"
              aria-label={`${customer.name} 고객 정보 수정`}
              aria-haspopup="dialog"
              aria-expanded={customer.id === editingId}
              onClick={(event) => onEdit(customer, event.currentTarget)}
            >
              수정
            </Button>
          ),
        }),
      ]
    : baseColumns;

  return (
    <DataTable.Root
      title="고객 목록"
      query={query}
      columns={columns}
      getRowId={(customer) => String(customer.id)}
    >
      <DataTable.Header actions={actions}>
        {/* 지금 API는 전체 목록을 주므로 받은 행 수가 전체 고객 수다 */}
        <DataTable.Count>{(count) => `전체 ${count.toLocaleString("ko-KR")}명`}</DataTable.Count>
        <DataTable.PageSize />
      </DataTable.Header>
      <DataTable.Content
        pending={<Skeleton label="고객 목록을 불러오는 중이에요." rows={4} />}
        error={
          <DataTable.RetryError message="고객 목록을 불러오지 못했어요. 고객이 없다는 뜻은 아니에요." />
        }
        empty={
          <EmptyState
            title="아직 등록된 고객이 없어요"
            description="고객 등록으로 첫 고객을 추가해보세요."
          />
        }
      />
      <DataTable.Footer>
        <DataTable.Pagination />
      </DataTable.Footer>
    </DataTable.Root>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  who: {
    display: "flex",
    alignItems: "center",
    gap: {
      default: "12px",
      [narrow]: "10px",
    },
  },
  avatar: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    fontSize: "13px",
    fontWeight: 700,
  },
  // 표 칸의 nowrap을 풀고, 공백 없는 긴 이름도 줄바꿈해 수정 버튼을 밀어내지 않게 한다.
  // min-width는 anywhere가 세 글자 이름까지 끊지 않게 막는다
  name: {
    minWidth: "3em",
    fontWeight: 600,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
  phone: {
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
});

// 의미 없는 장식 색. id로 고르게 돌린다.
const avatarStyles = stylex.create({
  coral: {
    backgroundColor: colors.accentSurface,
    color: colors.accentText,
  },
  sand: {
    backgroundColor: "#f1e7dc",
    color: "#7a5a3c",
  },
  sage: {
    backgroundColor: "#e9eee4",
    color: "#4e6544",
  },
});

const avatarTones = [avatarStyles.coral, avatarStyles.sand, avatarStyles.sage];

const columnHelper = createAppColumnHelper<Customer>();

const baseColumns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "이름",
    cell: ({ row: { original: customer } }) => (
      <span {...stylex.props(styles.who)}>
        <span aria-hidden="true" {...stylex.props(styles.avatar, avatarTones[customer.id % 3])}>
          {customer.name.charAt(0)}
        </span>
        <span {...stylex.props(styles.name)}>{customer.name}</span>
      </span>
    ),
  }),
  columnHelper.accessor("phone", {
    header: "전화번호",
    cell: ({ getValue }) => <span {...stylex.props(styles.phone)}>{formatPhone(getValue())}</span>,
  }),
]);
