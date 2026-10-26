import type { Reservation } from "@o2o/shared/contracts";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { formatPhone } from "@/shared/format/phone.ts";
import { Badge } from "@/shared/ui/badge/badge.tsx";
import { Button } from "@/shared/ui/button/button.tsx";
import { Switch } from "@/shared/ui/choice/choice.tsx";
import { createAppColumnHelper, DataTable } from "@/shared/ui/data-table/data-table.tsx";
import { EmptyState } from "@/shared/ui/empty-state/empty-state.tsx";
import { Skeleton } from "@/shared/ui/skeleton/skeleton.tsx";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";
import { reservationQueries } from "./reservations.api.ts";
import {
  formatDay,
  formatMinutes,
  formatMoment,
  formatMonthDay,
  sameDay,
  timeOf,
  yearOf,
} from "./reservations.time.ts";

export type ReservationListProps = {
  date: string;
  includeCancelled: boolean;
  actions: ReactNode;
  // 수정·취소 시트가 열려 있는 예약. 행 버튼의 aria-expanded에 쓴다
  editingId: number | undefined;
  cancellingId: number | undefined;
  onIncludeCancelledChange: (include: boolean) => void;
  onEdit: (reservation: Reservation, trigger: HTMLButtonElement) => void;
  onCancel: (reservation: Reservation, trigger: HTMLButtonElement) => void;
};

export function ReservationList({
  date,
  includeCancelled,
  actions,
  editingId,
  cancellingId,
  onIncludeCancelledChange,
  onEdit,
  onCancel,
}: ReservationListProps) {
  // 다른 날짜·조건의 이전 결과가 남지 않게 목록은 쓰는 동안만 캐시한다
  const query = useQuery({
    ...reservationQueries.list({ date, includeCancelled }),
    gcTime: 0,
  });
  const cancelledCount = query.data?.filter((row) => row.cancelledAt !== null).length ?? 0;

  const columns = [
    ...baseColumns,
    columnHelper.display({
      id: "actions",
      header: "관리",
      meta: { align: "end" },
      cell: ({ row: { original: reservation } }) => {
        if (reservation.cancelledAt !== null) {
          return (
            <span
              role="img"
              aria-label="취소된 예약은 변경할 수 없어요"
              {...stylex.props(styles.muted)}
            >
              –
            </span>
          );
        }
        const label = `${reservation.customer.name} ${timeOf(reservation.startAt)}`;
        return (
          <span {...stylex.props(styles.manage)}>
            <Button
              variant="secondary"
              size="small"
              aria-label={`${label} 예약 수정`}
              aria-haspopup="dialog"
              aria-expanded={reservation.id === editingId}
              onClick={(event) => onEdit(reservation, event.currentTarget)}
            >
              수정
            </Button>
            <Button
              variant="secondary"
              size="small"
              aria-label={`${label} 예약 취소`}
              aria-haspopup="dialog"
              aria-expanded={reservation.id === cancellingId}
              onClick={(event) => onCancel(reservation, event.currentTarget)}
            >
              예약 취소
            </Button>
          </span>
        );
      },
    }),
  ];

  const monthDay = formatMonthDay(date);

  return (
    <DataTable.Root
      title={`${monthDay} 예약 목록`}
      query={query}
      columns={columns}
      getRowId={(reservation) => String(reservation.id)}
    >
      <DataTable.Header actions={actions}>
        <DataTable.Count>
          {(count) =>
            includeCancelled
              ? `${count.toLocaleString("ko-KR")}건${cancelledCount > 0 ? ` (취소 ${cancelledCount.toLocaleString("ko-KR")}건 포함)` : ""}`
              : `예약 ${count.toLocaleString("ko-KR")}건`
          }
        </DataTable.Count>
        <Switch
          checked={includeCancelled}
          onChange={(event) => onIncludeCancelledChange(event.target.checked)}
        >
          취소 포함
        </Switch>
        <DataTable.PageSize />
      </DataTable.Header>
      <DataTable.Content
        pending={<Skeleton label="예약 목록을 불러오는 중이에요." rows={3} />}
        error={
          <DataTable.RetryError message="예약 목록을 불러오지 못했어요. 예약이 없다는 뜻은 아니에요." />
        }
        empty={
          <EmptyState
            title={`${monthDay}에는 예약이 없어요`}
            description={
              includeCancelled
                ? "이 날짜에는 취소한 예약도 없어요."
                : "예약 등록으로 이 날짜에 예약을 추가해보세요. 취소한 예약은 '취소 포함'을 켜면 볼 수 있어요."
            }
          />
        }
      />
      <DataTable.Footer>
        <DataTable.Pagination />
      </DataTable.Footer>
    </DataTable.Root>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  time: {
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  sub: {
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
  },
  // 표 칸의 nowrap을 풀고, 공백 없는 긴 이름도 줄바꿈한다.
  // 열 최소 폭(design §8: 고객·시술 120, 상태 110, 관리 170)으로 좁은 화면에서 표가 스크롤되게 하고
  // anywhere가 이름을 음절 단위로 끊지 않게 한다. 인라인 요소에는 min-width가 먹지 않아 block으로 둔다
  name: {
    display: "block",
    minWidth: "120px",
    fontWeight: 600,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
  names: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  phoneTail: {
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
  },
  // 사유는 줄여 숨기지 않고 줄바꿈해 모두 보인다
  reason: {
    maxWidth: "16em",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  muted: {
    color: colors.textMuted,
  },
  badge: {
    display: "flex",
  },
  statusColumn: {
    minWidth: "110px",
  },
  manage: {
    display: "inline-flex",
    gap: "6px",
    minWidth: "170px",
    justifyContent: "flex-end",
  },
});

// 취소된 행은 취소선 대신 글자색을 낮춘다
const cancelledText = (reservation: Reservation) =>
  reservation.cancelledAt !== null && styles.muted;

const columnHelper = createAppColumnHelper<Reservation>();

const baseColumns = columnHelper.columns([
  columnHelper.display({
    id: "time",
    header: "시간",
    cell: ({ row: { original: reservation } }) => (
      <span {...stylex.props(styles.stack, cancelledText(reservation))}>
        <span {...stylex.props(styles.time)}>
          {timeOf(reservation.startAt)} – {timeOf(reservation.endAt)}
        </span>
        {!sameDay(reservation.startAt, reservation.endAt) && (
          <span {...stylex.props(styles.sub)}>
            종료 {formatDay(reservation.endAt, yearOf(reservation.startAt))}{" "}
            {timeOf(reservation.endAt)}
          </span>
        )}
      </span>
    ),
  }),
  columnHelper.display({
    id: "customer",
    header: "고객",
    cell: ({ row: { original: reservation } }) => (
      <span {...stylex.props(styles.name, cancelledText(reservation))}>
        {reservation.customer.name}
        <span {...stylex.props(styles.phoneTail)}>
          {" · "}
          {formatPhone(reservation.customer.phone).slice(-4)}
        </span>
      </span>
    ),
  }),
  columnHelper.display({
    id: "treatment",
    header: "시술",
    cell: ({ row: { original: reservation } }) => {
      const { treatments } = reservation;
      const total = treatments.reduce((sum, treatment) => sum + treatment.duration, 0);
      // 여러 개여도 '외 N개'로 줄이지 않고 이름을 모두 보인다
      return (
        <span {...stylex.props(styles.stack, cancelledText(reservation))}>
          {treatments.length === 1 ? (
            <span {...stylex.props(styles.name)}>{treatments[0]?.name}</span>
          ) : (
            <ul {...stylex.props(styles.names)}>
              {treatments.map((treatment) => (
                <li key={treatment.id} {...stylex.props(styles.name)}>
                  {treatment.name}
                </li>
              ))}
            </ul>
          )}
          <span {...stylex.props(styles.sub)}>
            {treatments.length === 1
              ? formatMinutes(total)
              : `시술 ${treatments.length}개 · 총 ${formatMinutes(total)}`}
          </span>
        </span>
      );
    },
  }),
  columnHelper.display({
    id: "status",
    header: "상태",
    cell: ({ row: { original: reservation } }) =>
      reservation.cancelledAt === null ? (
        <span {...stylex.props(styles.badge, styles.statusColumn)}>
          <Badge tone="info">예약</Badge>
        </span>
      ) : (
        <span {...stylex.props(styles.stack, styles.statusColumn)}>
          <span {...stylex.props(styles.badge)}>
            <Badge tone="neutral">취소</Badge>
          </span>
          <span {...stylex.props(styles.sub)}>
            {formatMoment(reservation.cancelledAt, yearOf(reservation.startAt))} 취소
          </span>
          {reservation.cancelReason && (
            <span {...stylex.props(styles.sub, styles.reason)}>
              사유: {reservation.cancelReason}
            </span>
          )}
        </span>
      ),
  }),
]);
