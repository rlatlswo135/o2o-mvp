import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { Checkbox } from "@/shared/ui/choice/choice.tsx";
import { joinIds } from "@/shared/ui/field/field.tsx";
import { a11yStyles, groupStyles } from "@/shared/ui/internal/control-styles.ts";

import type { ChoiceKind, TreatmentRow } from "../reservations.schema.ts";

import { colors, controls } from "../../../shared/ui/theme.stylex.ts";
import { formatMinutes } from "../reservations.time.ts";

export type TreatmentChecklistProps = {
  id: string;
  rows: ReadonlyArray<TreatmentRow>;
  checkedIds: ReadonlyArray<string>;
  kind: ChoiceKind;
  // 기존 예약 시술이 있으면(수정) 불러오는 동안에도 그 행을 고를 수 있다
  hasKept: boolean;
  // 체크된 시술 시간의 합. 모르거나 더할 수 없으면 null
  totalMinutes: number | null;
  disabled: boolean;
  error: string | undefined;
  // 불러오기 실패·0건 안내. 그룹 설명으로 연결한다
  note: ReactNode;
  noteId: string | undefined;
  onToggle: (row: TreatmentRow, checked: boolean) => void;
};

const rowNotes: Partial<Record<TreatmentRow["kind"], string>> = {
  kept_changed: "예약 당시 값",
  deleted: "삭제된 시술 · 이 예약에만 남아 있어요",
  vanished: "목록에서 사라졌어요. 해제해주세요.",
};

// 시술 여러 개를 고르는 체크 목록. 공용 Select는 multiple을 쓰지 않으므로 Checkbox를 행으로 쓴다
export function TreatmentChecklist({
  id,
  rows,
  checkedIds,
  kind,
  hasKept,
  totalMinutes,
  disabled,
  error,
  note,
  noteId,
  onToggle,
}: TreatmentChecklistProps) {
  const errorId = error ? `${id}-error` : undefined;
  const checked = new Set(checkedIds);
  const checkedCount = rows.filter((row) => checked.has(String(row.id))).length;
  const showBox = rows.length > 0 || kind === "loading";

  return (
    <fieldset
      data-field="treatmentIds"
      aria-describedby={joinIds(errorId, noteId)}
      {...stylex.props(groupStyles.fieldset, styles.group)}
    >
      <legend {...stylex.props(groupStyles.legend, styles.legend)}>
        <span {...stylex.props(styles.legendRow)}>
          <span>
            시술
            <span aria-hidden="true" {...stylex.props(styles.requiredMark)}>
              *
            </span>
            <span {...stylex.props(a11yStyles.visuallyHidden)}>(필수, 1개 이상)</span>
          </span>
          <span {...stylex.props(styles.count, checkedCount === 0 && styles.countNone)}>
            {checkedCount === 0
              ? "선택 안 함"
              : `${checkedCount}개 선택${totalMinutes === null ? "" : ` · 총 ${formatMinutes(totalMinutes)}`}`}
          </span>
        </span>
      </legend>

      {showBox && (
        <div {...stylex.props(styles.box, error !== undefined && styles.boxInvalid)}>
          <div {...stylex.props(styles.scroll)}>
            {rows.map((row) => {
              const isChecked = checked.has(String(row.id));
              const rowNote = rowNotes[row.kind];
              return (
                <div
                  key={row.id}
                  {...stylex.props(
                    styles.row,
                    disabled && styles.rowDisabled,
                    isChecked && styles.rowChecked,
                  )}
                >
                  <Checkbox
                    name="treatmentIds"
                    value={row.id}
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(event) => onToggle(row, event.target.checked)}
                  >
                    <span {...stylex.props(styles.nameBlock)}>
                      <span {...stylex.props(styles.name, isChecked && styles.nameChecked)}>
                        {row.name ?? "더 이상 없는 시술"}
                      </span>
                      {rowNote && (
                        <span
                          {...stylex.props(
                            styles.rowNote,
                            row.kind === "vanished" && styles.rowNoteWarn,
                            disabled && styles.mutedDisabled,
                          )}
                        >
                          {rowNote}
                        </span>
                      )}
                    </span>
                    {row.duration !== null && (
                      <span
                        {...stylex.props(
                          styles.minutes,
                          isChecked && styles.minutesChecked,
                          disabled && styles.mutedDisabled,
                        )}
                      >
                        {formatMinutes(row.duration)}
                      </span>
                    )}
                  </Checkbox>
                </div>
              );
            })}
            {kind === "loading" && (
              <div {...stylex.props(styles.placeholder)}>
                {hasKept ? "다른 시술을 불러오는 중이에요." : "시술 목록을 불러오는 중이에요."}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p id={errorId} {...stylex.props(styles.error)}>
          <span aria-hidden="true" {...stylex.props(styles.errorMark)}>
            !
          </span>
          {error}
        </p>
      )}
      {note}
    </fieldset>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  // legend 배치는 브라우저마다 달라 flex는 안쪽 span에 준다
  legend: {
    display: "block",
    width: "100%",
    marginBottom: "2px",
    lineHeight: "20px",
  },
  legendRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  },
  requiredMark: {
    marginLeft: "2px",
    color: colors.accentText,
  },
  count: {
    color: colors.text,
    fontSize: controls.labelFontSize,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  countNone: {
    color: colors.textMuted,
    fontWeight: 400,
  },
  box: {
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: controls.radius,
    backgroundColor: colors.surface,
  },
  boxInvalid: {
    borderColor: colors.danger,
  },
  // 반쯤 보이는 행으로 더 있다는 것을 알린다(넓은 화면 5.5행, 좁은 화면 4.5행)
  scroll: {
    maxHeight: {
      default: "264px",
      [narrow]: "216px",
    },
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  // grid라서 안의 label이 행 전체로 늘어나 행 어디를 눌러도 체크된다
  row: {
    display: "grid",
    minHeight: "48px",
    paddingInline: "14px",
    borderTopWidth: {
      default: "1px",
      ":first-child": 0,
    },
    borderTopStyle: "solid",
    borderTopColor: colors.border,
    backgroundColor: {
      default: "transparent",
      ":hover": colors.canvas,
    },
  },
  rowChecked: {
    backgroundColor: {
      default: colors.neutralSurface,
      ":hover": colors.neutralSurface,
    },
  },
  rowDisabled: {
    backgroundColor: {
      default: "transparent",
      ":hover": "transparent",
    },
  },
  nameBlock: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "2px",
    minWidth: 0,
    paddingBlock: "6px",
  },
  name: {
    fontSize: "15px",
    fontWeight: 500,
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
  nameChecked: {
    fontWeight: 600,
  },
  rowNote: {
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontWeight: 400,
    lineHeight: "16px",
  },
  rowNoteWarn: {
    color: colors.warning,
    fontWeight: 500,
  },
  minutes: {
    color: colors.textMuted,
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  minutesChecked: {
    color: colors.text,
  },
  mutedDisabled: {
    color: colors.disabledText,
  },
  placeholder: {
    display: "flex",
    alignItems: "center",
    minHeight: "48px",
    paddingInline: "14px",
    borderTopWidth: {
      default: "1px",
      ":first-child": 0,
    },
    borderTopStyle: "solid",
    borderTopColor: colors.border,
    color: colors.textMuted,
    fontSize: "14px",
  },
  error: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    margin: 0,
    color: colors.danger,
    fontSize: controls.hintFontSize,
    fontWeight: 500,
    lineHeight: "18px",
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
