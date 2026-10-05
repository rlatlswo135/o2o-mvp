import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";

import { joinIds, useFieldControl } from "../field/field.js";
import { controlStyles } from "../internal/control-styles.js";
import { colors, controls } from "../theme.stylex.js";

export type SelectProps = Omit<
  ComponentPropsWithRef<"select">,
  "className" | "style" | "multiple"
> & {
  /** Field 밖에서 오류 상태를 직접 지정한다. Field 안에서는 Field의 error가 기본값이다. */
  invalid?: boolean | undefined;
};

/** 네이티브 단일 select. 옵션은 option 요소로 전달한다. */
export function Select({
  id,
  invalid,
  required,
  disabled = false,
  "aria-describedby": describedBy,
  children,
  ...props
}: SelectProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div {...stylex.props(styles.wrapper)}>
      <select
        {...props}
        id={field?.id ?? id}
        required={required ?? field?.required}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={joinIds(field?.describedBy, describedBy)}
        {...stylex.props(
          controlStyles.base,
          styles.select,
          isInvalid && controlStyles.invalid,
          disabled && controlStyles.disabled,
        )}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        {...stylex.props(styles.chevron, disabled && styles.chevronDisabled)}
      />
    </div>
  );
}

const styles = stylex.create({
  wrapper: {
    position: "relative",
    width: "100%",
  },
  select: {
    appearance: "none",
    paddingRight: `calc(${controls.paddingX} + 20px)`,
    cursor: "pointer",
  },
  // 네이티브 화살표 대신 같은 위치에 그리는 꺾쇠. 클릭은 select로 통과시킨다.
  chevron: {
    position: "absolute",
    top: "50%",
    right: controls.paddingX,
    width: "8px",
    height: "8px",
    borderRightWidth: "2px",
    borderBottomWidth: "2px",
    borderRightStyle: "solid",
    borderBottomStyle: "solid",
    borderColor: colors.text,
    transform: "translateY(-70%) rotate(45deg)",
    pointerEvents: "none",
  },
  chevronDisabled: {
    borderColor: colors.disabledText,
  },
});
