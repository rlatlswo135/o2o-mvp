import type { FormEvent, KeyboardEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId, useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";
import {
  addDays,
  dayRange,
  formatBarDate,
  formatDay,
  formatMonthDay,
  isSupportedDate,
  maxYear,
  minYear,
} from "./reservations.time.ts";

export type ReservationDateBarProps = {
  // 지금 조회 중인(확정된) 날짜(YYYY-MM-DD)
  date: string;
  today: string;
  onChange: (date: string) => void;
};

// 입력·달력에서 바꾼 값은 초안이다. [조회]나 Enter로 확정할 때만 조회 날짜가 바뀐다.
type Draft = { value: string; error: string | null };

const incompleteMessage = "조회할 날짜를 연·월·일까지 모두 입력해주세요.";
const rangeMessage = `${minYear}~${maxYear}년 사이의 날짜만 조회할 수 있어요.`;

export function ReservationDateBar({ date, today, onChange }: ReservationDateBarProps) {
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // 포커스가 빠져도 지우지 않는다. 휴대폰에서 날짜를 고른 뒤 [조회]를 누르면 먼저 포커스가 빠진다
  const [draft, setDraft] = useState<Draft | null>(null);
  // 확정 날짜가 바뀌면(뒤로/앞으로·저장 후 이동) 초안을 버린다. 숨기기만 하면 원래 날짜로 돌아왔을 때 되살아난다
  const [draftDate, setDraftDate] = useState(date);
  if (draftDate !== date) {
    setDraftDate(date);
    setDraft(null);
  }
  const dirty = draft !== null && draft.value !== date;
  const previous = addDays(date, -1);
  const next = addDays(date, 1);

  const go = (target: string) => {
    setDraft(null);
    if (isSupportedDate(target) && target !== date) onChange(target);
  };

  const handleConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 같은 날짜를 다시 확정하면 조회하지 않는다
    if (!draft || draft.value === date) {
      setDraft(null);
      return;
    }
    // 덜 입력한 날짜는 브라우저가 빈 값으로 준다
    if (draft.value === "" || !isSupportedDate(draft.value)) {
      setDraft({ ...draft, error: draft.value === "" ? incompleteMessage : rangeMessage });
      inputRef.current?.focus();
      return;
    }
    setDraft(null);
    onChange(draft.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && draft) {
      event.preventDefault();
      setDraft(null);
    }
  };

  const hint = dirty && draft.error === null ? draftHint(draft.value, date) : null;

  return (
    <form
      role="search"
      aria-label="조회 날짜"
      noValidate
      onSubmit={handleConfirm}
      {...stylex.props(styles.root)}
    >
      <div {...stylex.props(styles.bar)}>
        <div {...stylex.props(styles.nav)}>
          <Button
            variant="secondary"
            aria-label={`이전 날 (${formatMonthDay(previous)})`}
            aria-disabled={!isSupportedDate(previous) || undefined}
            onClick={() => go(previous)}
          >
            ‹
          </Button>
          <div {...stylex.props(styles.input)}>
            <Input
              ref={inputRef}
              type="date"
              aria-label="조회 날짜"
              aria-describedby={draft?.error || hint ? messageId : undefined}
              invalid={draft?.error ? true : undefined}
              min={`${minYear}-01-01`}
              max={`${maxYear}-12-31`}
              value={draft?.value ?? date}
              onChange={(event) => setDraft({ value: event.target.value, error: null })}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            variant="secondary"
            aria-label={`다음 날 (${formatMonthDay(next)})`}
            aria-disabled={!isSupportedDate(next) || undefined}
            onClick={() => go(next)}
          >
            ›
          </Button>
        </div>
        <div {...stylex.props(styles.actions)}>
          <Button variant="secondary" onClick={() => go(today)}>
            오늘
          </Button>
          {/* 초안이 없어도 비활성으로 만들지 않는다. 확정 직후 비활성이 되면 키보드 포커스를 잃는다 */}
          <div {...stylex.props(styles.confirm)}>
            <Button type="submit" variant={dirty ? "primary" : "secondary"}>
              조회
            </Button>
          </div>
        </div>
        <span aria-hidden="true" {...stylex.props(styles.label)}>
          {formatBarDate(date)}
          {date === today && <span {...stylex.props(styles.today)}> · 오늘</span>}
        </span>
      </div>
      {/* 입력 안에서 Enter로 확정하면 포커스가 움직이지 않아 오류는 alert로 읽힌다. 안내는 글자마다 바뀌어 live로 두지 않는다 */}
      {draft?.error ? (
        <p id={messageId} role="alert" {...stylex.props(styles.message, styles.error)}>
          <span aria-hidden="true" {...stylex.props(styles.errorMark)}>
            !
          </span>
          {draft.error}
        </p>
      ) : (
        hint && (
          <p id={messageId} {...stylex.props(styles.message)}>
            {hint}
          </p>
        )
      )}
    </form>
  );
}

// 휴대폰에는 Enter가 없어 안내에 Enter를 적지 않는다
function draftHint(value: string, date: string) {
  if (value === "") return "날짜를 끝까지 입력한 뒤 조회를 눌러주세요.";
  const range = isSupportedDate(value) ? dayRange(value) : null;
  if (!range) return rangeMessage;
  return (
    <>
      조회를 눌러야{" "}
      <span {...stylex.props(styles.hintDate)}>
        {formatDay(range.from, Number(date.slice(0, 4)))}
      </span>{" "}
      예약으로 바뀌어요.
    </>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  root: {
    margin: 0,
  },
  // 좁은 화면은 세 줄: 확정 날짜 / ‹ 입력 › / 오늘 조회. DOM 순서(탭 순서)는 바꾸지 않는다
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexBasis: {
      default: "auto",
      [narrow]: "100%",
    },
    minWidth: 0,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexBasis: {
      default: "auto",
      [narrow]: "100%",
    },
  },
  confirm: {
    display: "flex",
    flexDirection: "column",
    flexGrow: {
      default: 0,
      [narrow]: 1,
    },
  },
  input: {
    width: {
      default: "180px",
      [narrow]: "auto",
    },
    flexGrow: {
      default: 0,
      [narrow]: 1,
    },
    flexShrink: {
      default: 0,
      [narrow]: 1,
    },
    flexBasis: {
      default: "auto",
      [narrow]: 0,
    },
    minWidth: 0,
  },
  // 포커스를 받지 않아 order로 위에 올려도 탭 순서와 어긋나지 않는다
  label: {
    order: {
      default: 0,
      [narrow]: -1,
    },
    marginInlineStart: {
      default: "auto",
      [narrow]: 0,
    },
    flexBasis: {
      default: "auto",
      [narrow]: "100%",
    },
    color: colors.text,
    fontSize: "15px",
    fontWeight: 600,
  },
  today: {
    color: colors.accentText,
  },
  message: {
    marginTop: "8px",
    marginBottom: 0,
    marginInline: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
  hintDate: {
    color: colors.text,
    fontWeight: 600,
  },
  error: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    color: colors.danger,
    fontWeight: 500,
  },
  errorMark: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    marginTop: "2px",
    borderRadius: "50%",
    backgroundColor: colors.danger,
    color: "#fff",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  },
});
