import type { ChangeEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback, useState } from "react";

import type { BadgeTone } from "@/shared/ui/badge/badge.tsx";

import { formatAmount } from "@/shared/ui/amount-field/amount-field.util.ts";
import { Badge } from "@/shared/ui/badge/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/shared/ui/table/table.tsx";

import { colors } from "../shared/ui/theme.stylex.ts";
import { ReviewValue, reviewStyles } from "./-review-layout.tsx";

// 목록·상태 검토용 가상 예시. 상태 문구와 의미 매핑은 이 화면(소비자)이 정한다.
interface ReviewRow {
  id: string;
  customer: string;
  service: string;
  status: { label: string; tone: BadgeTone };
  balance: number;
}

const rows: ReadonlyArray<ReviewRow> = [
  {
    id: "kim",
    customer: "김서연",
    service: "젤네일",
    status: { label: "예정", tone: "info" },
    balance: 120000,
  },
  {
    id: "lee",
    customer: "이지우",
    service: "케어",
    status: { label: "완료", tone: "success" },
    balance: 30000,
  },
  {
    id: "park",
    customer: "박수빈",
    service: "젤네일",
    status: { label: "취소", tone: "neutral" },
    balance: 0,
  },
];

const otherStatuses: ReadonlyArray<{ label: string; tone: BadgeTone }> = [
  { label: "확인 필요", tone: "warning" },
  { label: "처리 실패", tone: "danger" },
  { label: "사용 안 함", tone: "neutral" },
];

export function TableReview() {
  const [selectedId, setSelectedId] = useState("lee");
  const selected = rows.find((row) => row.id === selectedId);

  const handleSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSelectedId(event.target.value);
  }, []);

  return (
    <>
      <Table caption="예약 목록 예시" hideCaption>
        <TableHead>
          <TableRow>
            <TableHeaderCell>고객</TableHeaderCell>
            <TableHeaderCell>시술</TableHeaderCell>
            <TableHeaderCell>예약 상태</TableHeaderCell>
            <TableHeaderCell align="end">회원권 잔액</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} selected={row.id === selectedId}>
              <TableCell>
                {/* 행 선택 조작부. 이름에 고객명을 포함해 어떤 행인지 식별한다. */}
                <label {...stylex.props(styles.rowLabel)}>
                  <input
                    type="radio"
                    name="reservation-row"
                    value={row.id}
                    checked={row.id === selectedId}
                    onChange={handleSelect}
                    {...stylex.props(styles.radio)}
                  />
                  {row.customer}
                </label>
              </TableCell>
              <TableCell>{row.service}</TableCell>
              <TableCell>
                <Badge tone={row.status.tone}>{row.status.label}</Badge>
              </TableCell>
              <TableCell align="end">
                <data value={row.balance}>{formatAmount(row.balance)}</data>원
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div {...stylex.props(reviewStyles.row)}>
        <span {...stylex.props(reviewStyles.note)}>다른 의미색</span>
        {otherStatuses.map((status) => (
          <Badge key={status.label} tone={status.tone}>
            {status.label}
          </Badge>
        ))}
      </div>

      <dl aria-label="현재 선택 행" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="선택한 행">
          {selected
            ? `${selected.customer} · ${selected.service} · ${selected.status.label} · ${formatAmount(selected.balance)}원`
            : "(없음)"}
        </ReviewValue>
      </dl>
    </>
  );
}

const styles = stylex.create({
  rowLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: 600,
    cursor: "pointer",
  },
  radio: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
    margin: 0,
    accentColor: colors.primary,
    cursor: "pointer",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
});
