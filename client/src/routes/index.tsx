import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "../shared/ui/Button.js";
import { Field } from "../shared/ui/Field.js";
import { Input } from "../shared/ui/Input.js";
import { colors } from "../shared/ui/theme.stylex.js";

export const Route = createFileRoute("/")({ component: Home });

// 1단계 공통 UI 검토용 임시 조립. 업무 화면 단계에서 실제 진입 화면으로 교체한다.
function Home() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(styles.title)}>공통 UI 검토</h1>

      <section aria-labelledby="buttons-title" {...stylex.props(styles.card)}>
        <h2 id="buttons-title" {...stylex.props(styles.cardTitle)}>
          Button
        </h2>
        <div {...stylex.props(styles.row)}>
          <Button>+ 고객 등록</Button>
          <Button variant="secondary">취소</Button>
          <Button variant="danger">예약 취소</Button>
        </div>
        <div {...stylex.props(styles.row)}>
          <Button loading>저장 중</Button>
          <Button disabled>고객 저장</Button>
        </div>
      </section>

      <section aria-labelledby="inputs-title" {...stylex.props(styles.card)}>
        <h2 id="inputs-title" {...stylex.props(styles.cardTitle)}>
          Field · Input
        </h2>
        <div {...stylex.props(styles.grid)}>
          <Field label="고객 이름" description="고객이 사용하는 이름을 입력해주세요." required>
            <Input placeholder="이름 입력" />
          </Field>
          <Field label="전화번호" error="이미 등록된 전화번호입니다." required>
            <Input type="tel" defaultValue="010-0000-1001" />
          </Field>
          <Field label="고객 이름" description="지금은 변경할 수 없는 항목입니다.">
            <Input defaultValue="김서연" disabled />
          </Field>
        </div>
      </section>
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minHeight: "100vh",
    padding: "40px 48px",
    backgroundColor: colors.canvas,
    color: colors.text,
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif",
  },
  title: {
    margin: 0,
    fontSize: "24px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "960px",
    padding: "24px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "8px",
    backgroundColor: colors.surface,
  },
  cardTitle: {
    margin: 0,
    fontSize: "16px",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "20px",
  },
});
