import type { ChangeEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useCallback, useState } from "react";

import { Checkbox, Radio, RadioGroup, Switch } from "@/shared/ui/choice/choice.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { SegmentedControl } from "@/shared/ui/segmented-control/segmented-control.tsx";
import { Select } from "@/shared/ui/select/select.tsx";

import { ReviewValue, reviewStyles } from "./-review-layout.tsx";

// 선택 요소 검토용 가상 예시. 값은 화면 상태로만 보관하고 저장하지 않는다.
interface SelectionValues {
  staff: string;
  service: string;
  selected: boolean;
  unselected: boolean;
  blockType: string;
  notify: boolean;
  theme: string;
}

const initialValues: SelectionValues = {
  staff: "owner",
  service: "gel",
  selected: true,
  unselected: false,
  blockType: "once",
  notify: true,
  theme: "blue",
};

const staffLabels: Record<string, string> = { owner: "사장님", jia: "김지아", harin: "박하린" };
const serviceLabels: Record<string, string> = { "": "선택 안 함", gel: "젤네일", care: "케어" };
const blockTypeLabels: Record<string, string> = { once: "일회성", repeat: "반복" };

const themeOptions = [
  { value: "blue", label: "블루" },
  { value: "plum", label: "플럼" },
  { value: "sage", label: "세이지" },
];

const disabledThemeOptions = [
  { value: "blue", label: "블루" },
  { value: "plum", label: "플럼" },
];

export function SelectionReview() {
  const [values, setValues] = useState(initialValues);

  // 각 컨트롤의 name을 상태 키로 쓴다. 체크박스·스위치는 checked, 나머지는 value.
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = event.target;
    const next =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setValues((prev) => ({ ...prev, [name]: next }));
  }, []);

  return (
    <>
      <div {...stylex.props(reviewStyles.grid)}>
        <Field label="담당자">
          <Select name="staff" value={values.staff} onChange={handleChange}>
            <option value="owner">사장님</option>
            <option value="jia">김지아</option>
            <option value="harin">박하린</option>
          </Select>
        </Field>
        <Field
          label="시술"
          required
          description="'선택 안 함'을 고르면 오류 상태를 확인할 수 있습니다."
          error={values.service === "" ? "시술을 선택해주세요." : undefined}
        >
          <Select name="service" value={values.service} onChange={handleChange}>
            <option value="">선택 안 함</option>
            <option value="gel">젤네일</option>
            <option value="care">케어</option>
          </Select>
        </Field>
        <Field label="시술" description="지금은 변경할 수 없는 항목입니다.">
          <Select defaultValue="gel" disabled>
            <option value="gel">젤네일</option>
          </Select>
        </Field>
      </div>

      <div {...stylex.props(reviewStyles.row)}>
        <Checkbox name="selected" checked={values.selected} onChange={handleChange}>
          선택됨
        </Checkbox>
        <Checkbox name="unselected" checked={values.unselected} onChange={handleChange}>
          미선택
        </Checkbox>
        <Checkbox defaultChecked disabled>
          사용 불가
        </Checkbox>
      </div>

      <RadioGroup
        legend="차단 방식"
        name="blockType"
        value={values.blockType}
        onChange={handleChange}
      >
        <Radio value="once">일회성</Radio>
        <Radio value="repeat">반복</Radio>
        <Radio value="monthly" disabled>
          매월 (사용 불가)
        </Radio>
      </RadioGroup>

      <div {...stylex.props(reviewStyles.row)}>
        <Switch name="notify" checked={values.notify} onChange={handleChange}>
          {values.notify ? "알림 사용" : "알림 끔"}
        </Switch>
        <Switch disabled>자동 안내 (사용 불가)</Switch>
      </div>

      <div {...stylex.props(reviewStyles.row)}>
        <SegmentedControl
          legend="테마 선택 예시"
          hideLegend
          name="theme"
          options={themeOptions}
          value={values.theme}
          onChange={handleChange}
        />
        <SegmentedControl
          legend="사용 불가 예시"
          hideLegend
          options={disabledThemeOptions}
          defaultValue="blue"
          disabled
        />
        <span {...stylex.props(reviewStyles.note)}>선택 상태 예시 (실제 테마는 바뀌지 않음)</span>
      </div>

      <dl aria-label="현재 선택 값" {...stylex.props(reviewStyles.values)}>
        <ReviewValue label="담당자">{staffLabels[values.staff]}</ReviewValue>
        <ReviewValue label="시술">{serviceLabels[values.service]}</ReviewValue>
        <ReviewValue label="체크박스">
          선택됨 {values.selected ? "켜짐" : "꺼짐"} · 미선택 {values.unselected ? "켜짐" : "꺼짐"}
        </ReviewValue>
        <ReviewValue label="차단 방식">{blockTypeLabels[values.blockType]}</ReviewValue>
        <ReviewValue label="알림">{values.notify ? "켜짐" : "꺼짐"}</ReviewValue>
        <ReviewValue label="테마">
          {themeOptions.find((option) => option.value === values.theme)?.label}
        </ReviewValue>
      </dl>
    </>
  );
}
