import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { joinIds, useFieldControl } from "../field/field.js";
import { a11yStyles, controlStyles } from "../internal/control-styles.js";
import { colors, controls } from "../theme.stylex.js";
import { formatAmount } from "./amount-field.util.js";

export type AmountInputProps = Omit<
  ComponentPropsWithRef<"input">,
  "className" | "style" | "type"
> & {
  /** Field 밖에서 오류 상태를 직접 지정한다. Field 안에서는 Field의 error가 기본값이다. */
  invalid?: boolean | undefined;
  /** 입력 오른쪽에 표시하는 단위. */
  unit?: string | undefined;
};

/**
 * 원 단위 금액 입력. 입력 원문을 바꾸지 않는다(자동 쉼표 없음).
 * 해석은 소비자가 parseAmount로 하고, 오류 문구는 Field의 error로 전달한다.
 */
export function AmountInput({
  id,
  invalid,
  required,
  disabled = false,
  unit = "원",
  "aria-describedby": describedBy,
  ...props
}: AmountInputProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const unitId = useId();

  return (
    <div {...stylex.props(styles.wrapper)}>
      <input
        autoComplete="off"
        {...props}
        type="text"
        id={field?.id ?? id}
        required={required ?? field?.required}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={joinIds(field?.describedBy, unitId, describedBy)}
        {...stylex.props(
          controlStyles.base,
          styles.amount,
          styles.input,
          isInvalid && controlStyles.invalid,
          disabled && controlStyles.disabled,
        )}
      />
      <span id={unitId} {...stylex.props(styles.unit, styles.unitOverlay)}>
        {unit}
      </span>
    </div>
  );
}

export type AmountDisplayProps = {
  /** 표시할 원 단위 금액. null·undefined는 빈 값으로 표시하고 0과 구분한다. */
  value: number | null | undefined;
  unit?: string | undefined;
  /** 빈 값일 때 보조기기에 읽어줄 문구. */
  emptyLabel?: string | undefined;
  /** Field 밖에서 쓸 때의 id. Field 안에서는 Field label과 연결된다. */
  id?: string | undefined;
};

/** 읽기 전용 금액. 계산하지 않고 받은 값만 보여준다. */
export function AmountDisplay({
  value,
  unit = "원",
  emptyLabel = "값 없음",
  id,
}: AmountDisplayProps) {
  const field = useFieldControl();
  const isEmpty = value === null || value === undefined;

  return (
    <output
      id={field?.id ?? id}
      aria-describedby={field?.describedBy}
      {...stylex.props(styles.display, styles.amount)}
    >
      {isEmpty ? (
        <>
          <span aria-hidden="true">—</span>
          <span {...stylex.props(a11yStyles.visuallyHidden)}>{emptyLabel}</span>
        </>
      ) : (
        <>
          <data value={value}>{formatAmount(value)}</data>
          <span {...stylex.props(styles.unit)}>{unit}</span>
        </>
      )}
    </output>
  );
}

const styles = stylex.create({
  wrapper: {
    position: "relative",
    width: "100%",
  },
  amount: {
    fontSize: "16px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },
  input: {
    paddingRight: `calc(${controls.paddingX} + 24px)`,
  },
  unit: {
    color: colors.textMuted,
    fontSize: controls.hintFontSize,
    fontWeight: 400,
  },
  unitOverlay: {
    position: "absolute",
    top: "50%",
    right: controls.paddingX,
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  display: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    minHeight: controls.height,
    paddingInline: controls.paddingX,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.disabledSurface,
    borderRadius: controls.radius,
    backgroundColor: colors.neutralSurface,
    color: colors.text,
    overflowWrap: "anywhere",
  },
});
