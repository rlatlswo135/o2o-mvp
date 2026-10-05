import type { ChangeEvent, ChangeEventHandler, ComponentPropsWithRef, ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { createContext, use, useCallback, useId, useMemo } from "react";

import { a11yStyles, groupStyles } from "../internal/control-styles.js";
import { colors, controls } from "../theme.stylex.js";

export type CheckboxProps = Omit<
  ComponentPropsWithRef<"input">,
  "className" | "style" | "type" | "children"
> & {
  /** 보이는 이름. 체크박스와 같은 label 안에 그려 클릭 영역과 접근 가능한 이름이 된다. */
  children: ReactNode;
};

export function Checkbox({ disabled = false, children, ...props }: CheckboxProps) {
  return (
    <label {...stylex.props(styles.label, disabled && styles.labelDisabled)}>
      <input
        {...props}
        type="checkbox"
        disabled={disabled}
        {...stylex.props(styles.box, disabled && styles.controlDisabled)}
      />
      {children}
    </label>
  );
}

export type SwitchProps = CheckboxProps;

/** 켜기/끄기. 네이티브 체크박스에 switch 역할을 부여해 checked 상태를 그대로 사용한다. */
export function Switch({ disabled = false, children, ...props }: SwitchProps) {
  return (
    <label {...stylex.props(styles.label, disabled && styles.labelDisabled)}>
      <input
        {...props}
        type="checkbox"
        role="switch"
        disabled={disabled}
        {...stylex.props(styles.switchTrack, disabled && styles.controlDisabled)}
      />
      {children}
    </label>
  );
}

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  defaultValue: string | undefined;
  disabled: boolean;
  onChange: ChangeEventHandler<HTMLInputElement> | undefined;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = {
  /** 그룹 이름. fieldset의 legend가 되어 보조기기가 그룹 이름으로 읽는다. */
  legend: string;
  /** legend를 화면에서만 숨긴다. 그룹 이름은 보조기기에 계속 제공된다. */
  hideLegend?: boolean | undefined;
  /** 라디오 name. 생략하면 자동 생성한다. */
  name?: string | undefined;
  /** 제어 모드의 선택 값. */
  value?: string | undefined;
  /** 비제어 모드의 처음 선택 값. */
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  /** 선택이 바뀌면 고른 라디오의 change 이벤트로 알린다. 값은 event.target.value. */
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
  children: ReactNode;
};

export function RadioGroup({
  legend,
  hideLegend = false,
  name,
  value,
  defaultValue,
  disabled = false,
  onChange,
  children,
}: RadioGroupProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  const group = useMemo(
    () => ({ name: groupName, value, defaultValue, disabled, onChange }),
    [groupName, value, defaultValue, disabled, onChange],
  );

  return (
    <fieldset disabled={disabled} {...stylex.props(groupStyles.fieldset)}>
      <legend {...stylex.props(groupStyles.legend, hideLegend && a11yStyles.visuallyHidden)}>
        {legend}
      </legend>
      <div {...stylex.props(styles.options)}>
        <RadioGroupContext value={group}>{children}</RadioGroupContext>
      </div>
    </fieldset>
  );
}

export type RadioProps = Omit<
  ComponentPropsWithRef<"input">,
  "className" | "style" | "type" | "children" | "value" | "name"
> & {
  value: string;
  children: ReactNode;
};

/** RadioGroup 안에서 name·선택 값·disabled를 그룹에서 받는다. */
export function Radio({
  value,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  children,
  ...props
}: RadioProps) {
  const group = use(RadioGroupContext);
  const isDisabled = disabled || (group?.disabled ?? false);

  // 그룹이 제어 모드면 그룹 값이 우선한다. 제어 여부에 따라 checked/defaultChecked 중 하나만 넘긴다.
  const isChecked = group?.value === undefined ? checked : group.value === value;
  const isDefaultChecked =
    isChecked !== undefined
      ? undefined
      : group?.defaultValue === undefined
        ? defaultChecked
        : group.defaultValue === value;

  const groupOnChange = group?.onChange;
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      groupOnChange?.(event);
    },
    [onChange, groupOnChange],
  );

  return (
    <label {...stylex.props(styles.label, isDisabled && styles.labelDisabled)}>
      <input
        {...props}
        type="radio"
        name={group?.name}
        value={value}
        checked={isChecked}
        defaultChecked={isDefaultChecked}
        disabled={isDisabled}
        onChange={handleChange}
        {...stylex.props(styles.box, isDisabled && styles.controlDisabled)}
      />
      {children}
    </label>
  );
}

const styles = stylex.create({
  label: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "32px",
    color: colors.text,
    fontSize: controls.fontSize,
    cursor: "pointer",
  },
  labelDisabled: {
    color: colors.disabledText,
    cursor: "not-allowed",
  },
  options: {
    display: "flex",
    flexWrap: "wrap",
    columnGap: "20px",
    rowGap: "4px",
  },
  // 체크박스·라디오는 네이티브 모양에 시안 색만 입힌다.
  box: {
    flexShrink: 0,
    width: "18px",
    height: "18px",
    margin: 0,
    accentColor: colors.primary,
    cursor: "inherit",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  // 썸은 배경 원으로 그려 checked일 때 오른쪽으로 옮긴다.
  switchTrack: {
    appearance: "none",
    flexShrink: 0,
    width: "36px",
    height: "20px",
    margin: 0,
    borderRadius: "999px",
    backgroundColor: {
      default: colors.borderHover,
      ":checked": colors.primary,
    },
    backgroundImage: `radial-gradient(circle, ${colors.surface} 7px, transparent 7.5px)`,
    backgroundSize: "20px 20px",
    backgroundRepeat: "no-repeat",
    backgroundPosition: {
      default: "left center",
      ":checked": "right center",
    },
    cursor: "inherit",
    transitionProperty: "background-color, background-position",
    transitionDuration: "120ms",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
});
