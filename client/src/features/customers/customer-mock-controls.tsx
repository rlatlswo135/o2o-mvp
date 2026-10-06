import type { ChangeEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { SegmentedControl } from "@/shared/ui/segmented-control/segmented-control.tsx";

import type { ListOutcome, SaveOutcome } from "./customer-mock.ts";

import { colors, controls } from "../../shared/ui/theme.stylex.ts";

const listOptions = [
  { value: "success", label: "정상 목록" },
  { value: "empty", label: "빈 결과" },
  { value: "failure", label: "조회 실패" },
] as const satisfies ReadonlyArray<{ value: ListOutcome; label: string }>;

const saveOptions = [
  { value: "success", label: "정상 저장" },
  { value: "failure", label: "저장 실패" },
] as const satisfies ReadonlyArray<{ value: SaveOutcome; label: string }>;

function pickValue<T extends string>(options: ReadonlyArray<{ value: T }>, value: string) {
  return options.find((option) => option.value === value)?.value;
}

export type CustomerMockControlsProps = {
  listOutcome: ListOutcome;
  onListOutcomeChange: (outcome: ListOutcome) => void;
  saveOutcome: SaveOutcome;
  onSaveOutcomeChange: (outcome: SaveOutcome) => void;
  loading: boolean;
  onReload: () => void;
};

/** FE 검토용 가상 결과 선택. 고른 결과는 다음 조회·저장부터 적용되고 바꾸기 전까지 유지된다. */
export function CustomerMockControls({
  listOutcome,
  onListOutcomeChange,
  saveOutcome,
  onSaveOutcomeChange,
  loading,
  onReload,
}: CustomerMockControlsProps) {
  const handleListChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const outcome = pickValue(listOptions, event.target.value);
      if (outcome) onListOutcomeChange(outcome);
    },
    [onListOutcomeChange],
  );

  const handleSaveChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const outcome = pickValue(saveOptions, event.target.value);
      if (outcome) onSaveOutcomeChange(outcome);
    },
    [onSaveOutcomeChange],
  );

  return (
    <section aria-labelledby="customer-mock-title" {...stylex.props(styles.box)}>
      <h2 id="customer-mock-title" {...stylex.props(styles.title)}>
        가상 동작 확인
      </h2>
      <p {...stylex.props(styles.description)}>
        실제 서버 연결 전 화면 상태를 확인하는 영역이에요. 고른 결과는 다음 조회·저장부터 적용돼요.
      </p>
      <div {...stylex.props(styles.row)}>
        <SegmentedControl
          legend="다음 조회 결과"
          options={listOptions}
          value={listOutcome}
          onChange={handleListChange}
        />
        <SegmentedControl
          legend="다음 저장 결과"
          options={saveOptions}
          value={saveOutcome}
          onChange={handleSaveChange}
        />
      </div>
      <div>
        <Button variant="secondary" loading={loading} onClick={onReload}>
          {loading ? "조회 중" : "다시 조회"}
        </Button>
      </div>
    </section>
  );
}

const styles = stylex.create({
  box: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: colors.borderHover,
    borderRadius: "10px",
    backgroundColor: colors.neutralSurface,
  },
  title: {
    margin: 0,
    fontSize: "14px",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
  },
});
