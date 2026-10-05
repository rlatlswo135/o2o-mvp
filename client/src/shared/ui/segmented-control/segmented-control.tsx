import type { ChangeEventHandler } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { a11yStyles, groupStyles } from "../internal/control-styles.js";
import { colors, controls } from "../theme.stylex.js";

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean | undefined;
};

export type SegmentedControlProps = {
  /** 그룹 이름. fieldset의 legend가 되어 보조기기가 그룹 이름으로 읽는다. */
  legend: string;
  /** legend를 화면에서만 숨긴다. 그룹 이름은 보조기기에 계속 제공된다. */
  hideLegend?: boolean | undefined;
  options: ReadonlyArray<SegmentedOption>;
  /** 라디오 name. 생략하면 자동 생성한다. */
  name?: string | undefined;
  /** 제어 모드의 선택 값. */
  value?: string | undefined;
  /** 비제어 모드의 처음 선택 값. */
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  /** 선택이 바뀌면 고른 라디오의 change 이벤트로 알린다. 값은 event.target.value. */
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
};

/** 붙어 있는 버튼 모양의 단일 선택. 의미는 라디오 그룹이며 화살표 키로 이동한다. */
export function SegmentedControl({
  legend,
  hideLegend = false,
  options,
  name,
  value,
  defaultValue,
  disabled = false,
  onChange,
}: SegmentedControlProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset disabled={disabled} {...stylex.props(groupStyles.fieldset)}>
      <legend {...stylex.props(groupStyles.legend, hideLegend && a11yStyles.visuallyHidden)}>
        {legend}
      </legend>
      <div {...stylex.props(styles.track)}>
        {options.map((option) => {
          const isDisabled = disabled || (option.disabled ?? false);
          return (
            <label
              key={option.value}
              {...stylex.props(styles.item, isDisabled && styles.itemDisabled)}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === undefined ? undefined : value === option.value}
                defaultChecked={
                  value === undefined && defaultValue !== undefined
                    ? defaultValue === option.value
                    : undefined
                }
                disabled={isDisabled}
                onChange={onChange}
                {...stylex.props(a11yStyles.visuallyHidden, stylex.defaultMarker())}
              />
              <span {...stylex.props(styles.segment, isDisabled && styles.segmentDisabled)}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const styles = stylex.create({
  track: {
    display: "inline-flex",
    flexWrap: "wrap",
    gap: "2px",
    maxWidth: "100%",
    padding: "3px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: controls.radius,
    backgroundColor: colors.neutralSurface,
  },
  item: {
    position: "relative",
    display: "inline-flex",
    cursor: "pointer",
  },
  itemDisabled: {
    cursor: "not-allowed",
  },
  // 숨긴 라디오(marker)의 checked·focus 상태를 바로 뒤 span 모양에 반영한다.
  segment: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "56px",
    minHeight: "32px",
    paddingInline: "16px",
    borderRadius: "4px",
    color: {
      default: colors.textMuted,
      [stylex.when.siblingBefore(":checked")]: colors.primary,
    },
    backgroundColor: {
      default: "transparent",
      [stylex.when.siblingBefore(":checked")]: colors.surface,
    },
    boxShadow: {
      default: "none",
      [stylex.when.siblingBefore(":checked")]: "0 1px 2px rgba(30, 42, 59, 0.12)",
    },
    fontSize: controls.fontSize,
    fontWeight: {
      default: 500,
      [stylex.when.siblingBefore(":checked")]: 600,
    },
    outlineStyle: {
      default: "none",
      [stylex.when.siblingBefore(":focus-visible")]: "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "1px",
    outlineColor: colors.focusRing,
    transitionProperty: "background-color, color",
    transitionDuration: "120ms",
  },
  segmentDisabled: {
    color: colors.disabledText,
  },
});
