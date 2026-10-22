import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";
import {
  addDays,
  formatBarDate,
  formatMonthDay,
  isSupportedDate,
  maxYear,
  minYear,
} from "./reservations.time.ts";

export type ReservationDateBarProps = {
  // 지금 조회 중인 날짜(YYYY-MM-DD)
  date: string;
  today: string;
  onChange: (date: string) => void;
};

export function ReservationDateBar({ date, today, onChange }: ReservationDateBarProps) {
  const hintId = useId();
  // 입력 중인 값. 목록이 가리키는 날짜와 다를 수 있어 포커스가 빠지면 지운다
  const [draft, setDraft] = useState<string | null>(null);
  const previous = addDays(date, -1);
  const next = addDays(date, 1);
  const showHint = draft !== null && !isSupportedDate(draft);

  const go = (target: string) => {
    setDraft(null);
    if (isSupportedDate(target) && target !== date) onChange(target);
  };

  const handleInput = (value: string) => {
    setDraft(value);
    if (isSupportedDate(value) && value !== date) onChange(value);
  };

  return (
    <div>
      <div role="group" aria-label="조회 날짜" {...stylex.props(styles.bar)}>
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
            type="date"
            aria-label="조회 날짜"
            aria-describedby={showHint ? hintId : undefined}
            min={`${minYear}-01-01`}
            max={`${maxYear}-12-31`}
            value={draft ?? date}
            onChange={(event) => handleInput(event.target.value)}
            onBlur={() => setDraft(null)}
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
        <Button variant="secondary" onClick={() => go(today)}>
          오늘
        </Button>
        <span aria-hidden="true" {...stylex.props(styles.label)}>
          {formatBarDate(date)}
          {date === today && <span {...stylex.props(styles.today)}> · 오늘</span>}
        </span>
      </div>
      {showHint && (
        <p id={hintId} {...stylex.props(styles.hint)}>
          {minYear}~{maxYear}년 사이의 날짜를 입력하면 조회해요.
        </p>
      )}
    </div>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
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
  label: {
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
  hint: {
    margin: "8px 0 0",
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    lineHeight: "18px",
  },
});
