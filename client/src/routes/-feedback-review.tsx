import type { ChangeEvent, MouseEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

import type { BadgeTone } from "@/shared/ui/badge/badge.tsx";
import type { DataTableColumn, DataTableQuery } from "@/shared/ui/data-table/data-table.tsx";
import type { NoticeContent, NoticeTone } from "@/shared/ui/notice/notice.tsx";

import { Badge } from "@/shared/ui/badge/badge.tsx";
import { Button } from "@/shared/ui/button/button.tsx";
import { Checkbox } from "@/shared/ui/choice/choice.tsx";
import { DataTable } from "@/shared/ui/data-table/data-table.tsx";
import { EmptyState } from "@/shared/ui/empty-state/empty-state.tsx";
import { LiveNotice, Notice } from "@/shared/ui/notice/notice.tsx";
import { SegmentedControl } from "@/shared/ui/segmented-control/segmented-control.tsx";
import { toast } from "@/shared/ui/toast/toast.tsx";

import { colors } from "../shared/ui/theme.stylex.ts";
import { createVirtualRetry } from "./-feedback-review.util.ts";
import { ReviewValue, reviewStyles } from "./-review-layout.tsx";

// 조회 상태·처리 결과 검토용 가상 예시. 실제 조회·고객 등록·저장 요청은 하지 않는다.
type QueryState = "loading" | "empty" | "error" | "data" | "refreshError";

const queryOptions: ReadonlyArray<{ value: QueryState; label: string }> = [
  { value: "loading", label: "불러오는 중" },
  { value: "empty", label: "데이터 없음" },
  { value: "error", label: "조회 실패" },
  { value: "data", label: "데이터 있음" },
  { value: "refreshError", label: "재조회 실패" },
];

const queryLabels: Record<QueryState, string> = {
  loading: "불러오는 중",
  empty: "데이터 없음",
  error: "조회 실패",
  data: "데이터 있음",
  refreshError: "재조회 실패(이전 목록 유지)",
};

type ReviewCustomer = {
  id: string;
  name: string;
  service: string;
  status: { label: string; tone: BadgeTone };
};

const customers: ReadonlyArray<ReviewCustomer> = [
  { id: "kim", name: "김서연", service: "젤네일", status: { label: "예정", tone: "info" } },
  { id: "lee", name: "이지우", service: "케어", status: { label: "완료", tone: "success" } },
];

const columns: ReadonlyArray<DataTableColumn<ReviewCustomer>> = [
  { key: "name", header: "고객", cell: (customer) => customer.name },
  { key: "service", header: "시술", cell: (customer) => customer.service },
  {
    key: "status",
    header: "예약 상태",
    cell: (customer) => <Badge tone={customer.status.tone}>{customer.status.label}</Badge>,
  },
];

/** 고른 상태를 useQuery 결과와 같은 모양으로 만든다. 다시 시도 중이면 isFetching이 켜진다. */
function fakeQuery(
  state: QueryState,
  isFetching: boolean,
  refetch: () => void,
): DataTableQuery<ReviewCustomer> {
  switch (state) {
    case "loading":
      return { status: "pending", data: undefined, isFetching: true, refetch };
    case "empty":
      return { status: "success", data: [], isFetching, refetch };
    case "error":
      return { status: "error", data: undefined, isFetching, refetch };
    case "data":
      return { status: "success", data: customers, isFetching, refetch };
    case "refreshError":
      return { status: "error", data: customers, isFetching, refetch };
  }
}

const retryDelayMs = 800;

export function FeedbackStatesReview() {
  const [retry] = useState(() => createVirtualRetry(retryDelayMs));
  const [query, setQuery] = useState<QueryState>("error");
  const [fetching, setFetching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [emptyActionCount, setEmptyActionCount] = useState(0);

  // 언마운트 뒤 늦은 완료가 상태를 바꾸지 않게 정리한다.
  useEffect(() => () => retry.cancel(), [retry]);

  // 직접 고른 상태를 대기 중인 재시도 완료가 덮지 않게 먼저 취소한다.
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    retry.cancel();
    setFetching(false);
    setQuery(event.target.value as QueryState);
  };
  // 대기 중 중복 실행은 무시한다. 완료되면 데이터 있음으로 바뀐다.
  const handleRefetch = () => {
    const started = retry.start(() => {
      setFetching(false);
      setQuery("data");
    });
    if (!started) return;
    setRetryCount((count) => count + 1);
    setFetching(true);
  };
  const handleEmptyAction = () => {
    setEmptyActionCount((count) => count + 1);
  };

  return (
    <>
      <SegmentedControl
        legend="조회 상태"
        options={queryOptions}
        value={query}
        onChange={handleQueryChange}
      />

      <DataTable
        title="고객 목록"
        query={fakeQuery(query, fetching, handleRefetch)}
        columns={columns}
        rowKey={(customer) => customer.id}
        toolbar={<Button onClick={handleEmptyAction}>+ 고객 등록</Button>}
        footer={(rows) => <span {...stylex.props(reviewStyles.note)}>총 {rows.length}명</span>}
        loadingLabel="고객 목록을 불러오는 중이에요."
        errorMessage="고객 목록을 불러오지 못했어요."
        empty={{ title: "아직 등록된 고객이 없어요", description: "첫 고객을 등록해보세요." }}
      />

      <div {...stylex.props(styles.example)}>
        <span {...stylex.props(reviewStyles.note)}>액션 없는 빈 결과 예시</span>
        <EmptyState
          title="검색 결과가 없어요"
          description="이름이나 전화번호를 다시 확인해주세요."
        />
      </div>

      <dl aria-label="조회 상태 확인" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="현재 상태">{queryLabels[query]}</ReviewValue>
        <ReviewValue label="재시도 실행">{retryCount}회</ReviewValue>
        <ReviewValue label="고객 등록 동작">{emptyActionCount}회 · 실제 등록 없음</ReviewValue>
      </dl>
      <span {...stylex.props(reviewStyles.note)}>
        가상 조회이며 네트워크 요청을 보내지 않습니다. 다시 시도는 잠깐 불러오는 중(재조회 실패는
        목록 유지)을 거쳐 데이터 있음으로 바뀝니다.
      </span>
    </>
  );
}

const results: Record<NoticeTone, NoticeContent> = {
  success: {
    tone: "success",
    title: "고객을 등록했어요.",
    description: "목록에서 새 고객을 확인할 수 있어요.",
  },
  warning: {
    tone: "warning",
    title: "기존 예약이 있어 시간을 막을 수 없어요.",
    description: "예약을 이동하거나 취소한 뒤 다시 시도해주세요.",
  },
  danger: {
    tone: "danger",
    title: "변경 내용을 저장하지 못했어요.",
    description: "입력 내용은 유지됩니다. 확인 후 다시 시도해주세요.",
  },
};

const staticNotices: ReadonlyArray<NoticeContent> = [
  results.success,
  results.warning,
  results.danger,
];

const longDetail =
  " 같은 시간대의 다른 예약과 담당자 일정, 회원권 사용 내역도 함께 확인해야 하므로 화면을 새로 고치기 전에 현재 입력과 선택 상태를 다시 살펴봐주세요.";

const resultTones: ReadonlyArray<{ tone: NoticeTone; label: string }> = [
  { tone: "success", label: "성공" },
  { tone: "warning", label: "경고" },
  { tone: "danger", label: "실패" },
];

function resultFor(tone: NoticeTone, long: boolean): NoticeContent {
  const result = results[tone];
  return long ? { ...result, description: `${result.description ?? ""}${longDetail}` } : result;
}

function describeResult(notice: NoticeContent | null) {
  if (notice === null) return "(없음)";
  const label = resultTones.find((item) => item.tone === notice.tone)?.label ?? notice.tone;
  return `${label} · ${notice.title}`;
}

const toastByTone = { success: toast.success, warning: toast.warn, danger: toast.error };

export function FeedbackNoticeReview() {
  const staticListRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const pendingStaticFocus = useRef<number | null>(null);
  const inlineTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inlineSeq = useRef(0);

  const [hiddenStatic, setHiddenStatic] = useState<ReadonlyArray<NoticeTone>>([]);
  const [long, setLong] = useState(false);
  // id는 표시 사건마다 증가한다. 같은 결과를 다시 표시해도 새 알림으로 전달된다.
  const [inline, setInline] = useState<{ notice: NoticeContent; id: number } | null>(null);

  const visibleStatic = staticNotices.filter((notice) => !hiddenStatic.includes(notice.tone));

  // 닫은 예시의 닫기 버튼이 사라지면 다음(없으면 이전) 닫기 버튼, 모두 닫혔으면 다시 표시로 옮긴다.
  useEffect(() => {
    const index = pendingStaticFocus.current;
    if (index === null) return;
    pendingStaticFocus.current = null;
    const buttons = Array.from(
      staticListRef.current?.querySelectorAll<HTMLButtonElement>("li button") ?? [],
    );
    const target = buttons[Math.min(index, buttons.length - 1)] ?? restoreRef.current;
    target?.focus();
  }, [hiddenStatic]);

  const handleStaticClose = (tone: NoticeTone) => {
    pendingStaticFocus.current = staticNotices
      .filter((notice) => !hiddenStatic.includes(notice.tone))
      .findIndex((notice) => notice.tone === tone);
    setHiddenStatic([...hiddenStatic, tone]);
  };
  const handleStaticRestore = () => {
    pendingStaticFocus.current = 0;
    setHiddenStatic([]);
  };

  const handleLongChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLong(event.target.checked);
  };

  // 표시할 때 포커스는 옮기지 않고, 닫으면 마지막 표시 버튼으로 돌려보낸다.
  const handleShowInline = (event: MouseEvent<HTMLButtonElement>) => {
    inlineTriggerRef.current = event.currentTarget;
    inlineSeq.current += 1;
    setInline({
      notice: resultFor(event.currentTarget.value as NoticeTone, long),
      id: inlineSeq.current,
    });
  };
  const handleCloseInline = () => {
    setInline(null);
    inlineTriggerRef.current?.focus();
  };

  // 토스트는 쌓이며 저절로 사라진다. 포커스는 옮기지 않는다.
  const handleShowToast = (event: MouseEvent<HTMLButtonElement>) => {
    const tone = event.currentTarget.value as NoticeTone;
    const { title, description } = resultFor(tone, long);
    toastByTone[tone]({ title, description });
  };
  const handleShowRawToast = () => {
    toast(<div {...stylex.props(styles.rawToast)}>정해진 모양 없이 그대로 그린 토스트</div>);
  };

  return (
    <>
      <div {...stylex.props(styles.group)}>
        <h3 {...stylex.props(styles.groupTitle)}>정적 예시</h3>
        {visibleStatic.length > 0 && (
          <ul ref={staticListRef} aria-label="정적 알림 예시" {...stylex.props(styles.list)}>
            {visibleStatic.map((notice) => (
              <StaticNoticeItem key={notice.tone} notice={notice} onClose={handleStaticClose} />
            ))}
          </ul>
        )}
        {hiddenStatic.length > 0 && (
          <div {...stylex.props(reviewStyles.row)}>
            <Button ref={restoreRef} variant="secondary" onClick={handleStaticRestore}>
              예시 다시 표시
            </Button>
            <span {...stylex.props(reviewStyles.note)}>닫은 예시 {hiddenStatic.length}개</span>
          </div>
        )}
        <span {...stylex.props(reviewStyles.note)}>
          시안 확인용 고정 예시로, 보조기기에 결과를 따로 알리지 않습니다.
        </span>
      </div>

      <Checkbox checked={long} onChange={handleLongChange}>
        긴 문구로 표시
      </Checkbox>

      <div {...stylex.props(styles.group)}>
        <h3 {...stylex.props(styles.groupTitle)}>인라인 결과 알림</h3>
        <div {...stylex.props(reviewStyles.row)}>
          {resultTones.map((item) => (
            <Button
              key={item.tone}
              variant="secondary"
              value={item.tone}
              onClick={handleShowInline}
            >
              {item.label} 알림
            </Button>
          ))}
        </div>
        <div>
          <LiveNotice
            notice={inline?.notice ?? null}
            noticeKey={inline?.id}
            onClose={handleCloseInline}
          />
        </div>
      </div>

      <div {...stylex.props(styles.group)}>
        <h3 {...stylex.props(styles.groupTitle)}>토스트</h3>
        <div {...stylex.props(reviewStyles.row)}>
          {resultTones.map((item) => (
            <Button key={item.tone} variant="secondary" value={item.tone} onClick={handleShowToast}>
              {item.label} 토스트
            </Button>
          ))}
          <Button variant="secondary" onClick={handleShowRawToast}>
            직접 그린 토스트
          </Button>
        </div>
        <span {...stylex.props(reviewStyles.note)}>
          토스트는 쌓여서 표시되고 저절로 사라지며, 누르면 바로 닫힙니다.
        </span>
      </div>

      <dl aria-label="알림 확인" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="인라인 알림">
          {inline ? `${describeResult(inline.notice)} · ${inline.id}번째 표시` : "(없음)"}
        </ReviewValue>
      </dl>
      <span {...stylex.props(reviewStyles.note)}>
        입력 오류는 필드 가까이, 처리 결과는 알림으로. 중요한 오류는 자동으로 사라지는 알림에만
        의존하지 않습니다.
      </span>
    </>
  );
}

function StaticNoticeItem({
  notice,
  onClose,
}: {
  notice: NoticeContent;
  onClose: (tone: NoticeTone) => void;
}) {
  const handleClose = () => onClose(notice.tone);

  return (
    <li>
      <Notice {...notice} onClose={handleClose} />
    </li>
  );
}

const styles = stylex.create({
  example: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  groupTitle: {
    margin: 0,
    fontSize: "14px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  rawToast: {
    padding: "10px 14px",
    borderRadius: "999px",
    backgroundColor: colors.text,
    color: colors.surface,
    fontSize: "14px",
    cursor: "pointer",
  },
});
