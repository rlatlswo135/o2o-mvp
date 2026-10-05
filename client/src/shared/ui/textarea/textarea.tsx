import type { ComponentPropsWithRef } from "react";

import * as stylex from "@stylexjs/stylex";

import { joinIds, useFieldControl } from "../field/field.js";
import { controlStyles } from "../internal/control-styles.js";

export type TextareaProps = Omit<ComponentPropsWithRef<"textarea">, "className" | "style"> & {
  /** Field 밖에서 오류 상태를 직접 지정한다. Field 안에서는 Field의 error가 기본값이다. */
  invalid?: boolean | undefined;
};

export function Textarea({
  id,
  invalid,
  required,
  disabled = false,
  rows = 3,
  "aria-describedby": describedBy,
  ...props
}: TextareaProps) {
  const field = useFieldControl();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <textarea
      {...props}
      id={field?.id ?? id}
      required={required ?? field?.required}
      disabled={disabled}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={joinIds(field?.describedBy, describedBy)}
      {...stylex.props(
        controlStyles.base,
        styles.textarea,
        isInvalid && controlStyles.invalid,
        disabled && controlStyles.disabled,
      )}
    />
  );
}

const styles = stylex.create({
  textarea: {
    display: "block",
    paddingBlock: "10px",
    lineHeight: 1.5,
    resize: "vertical",
  },
});
