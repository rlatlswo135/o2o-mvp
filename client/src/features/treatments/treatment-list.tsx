import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { formatAmount } from "@/shared/ui/amount-field/amount-field.util.ts";
import { createAppColumnHelper, DataTable } from "@/shared/ui/data-table/data-table.tsx";
import { EmptyState } from "@/shared/ui/empty-state/empty-state.tsx";
import { Skeleton } from "@/shared/ui/skeleton/skeleton.tsx";

import type { Treatment } from "./treatments.mock.ts";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";
import { treatmentQueries } from "./treatments.api.ts";

export type TreatmentListProps = {
  actions?: ReactNode;
};

export function TreatmentList({ actions }: TreatmentListProps) {
  const query = useQuery(treatmentQueries.list());

  return (
    <DataTable.Root
      title="시술 목록"
      query={query}
      columns={columns}
      getRowId={(treatment) => String(treatment.id)}
    >
      <DataTable.Header actions={actions}>
        <DataTable.Count>{(count) => `전체 ${count.toLocaleString("ko-KR")}개`}</DataTable.Count>
        <DataTable.PageSize />
      </DataTable.Header>
      <DataTable.Content
        pending={<Skeleton label="시술 목록을 불러오는 중이에요." rows={4} />}
        error={
          <DataTable.RetryError message="시술 목록을 불러오지 못했어요. 시술이 없다는 뜻은 아니에요." />
        }
        empty={
          <EmptyState
            title="아직 등록된 시술이 없어요"
            description="시술 등록으로 첫 시술을 추가해보세요."
          />
        }
      />
      <DataTable.Footer>
        <DataTable.Pagination />
      </DataTable.Footer>
    </DataTable.Root>
  );
}

function Quantity({ value, unit }: { value: string; unit: string }) {
  return (
    <span {...stylex.props(styles.quantity)}>
      {value}
      <span {...stylex.props(styles.unit)}>{unit}</span>
    </span>
  );
}

const styles = stylex.create({
  // 표 칸의 nowrap을 풀고, 공백 없는 긴 이름도 줄바꿈한다.
  // min-width는 anywhere가 세 글자 이름까지 끊지 않게 막는다
  name: {
    minWidth: "3em",
    fontWeight: 600,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
  quantity: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  unit: {
    marginLeft: "2px",
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontWeight: 400,
  },
});

const columnHelper = createAppColumnHelper<Treatment>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "시술명",
    cell: ({ getValue }) => <span {...stylex.props(styles.name)}>{getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "소요시간",
    meta: { align: "end" },
    cell: ({ getValue }) => <Quantity value={formatAmount(getValue())} unit="분" />,
  }),
  columnHelper.accessor("price", {
    header: "가격",
    meta: { align: "end" },
    cell: ({ getValue }) => <Quantity value={formatAmount(getValue())} unit="원" />,
  }),
]);
