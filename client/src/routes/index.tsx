import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";

import { colors } from "../shared/ui/theme.stylex.ts";
import { AmountReview } from "./-amount-review.tsx";
import { DialogReview } from "./-dialog-review.tsx";
import { FeedbackNoticeReview, FeedbackStatesReview } from "./-feedback-review.tsx";
import { SelectionReview } from "./-selection-review.tsx";
import { TableReview } from "./-table-review.tsx";

export const Route = createFileRoute("/")({ component: Home });

// 1단계 공통 UI 검토용 임시 조립. 업무 화면 단계에서 실제 진입 화면으로 교체한다.
function Home() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(styles.title)}>공통 UI 검토</h1>
      <p {...stylex.props(styles.screenLinks)}>
        업무 화면:{" "}
        <Link to="/customers" {...stylex.props(styles.screenLink)}>
          고객 관리(가상 동작)
        </Link>
      </p>

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

      <section aria-labelledby="choices-title" {...stylex.props(styles.card)}>
        <h2 id="choices-title" {...stylex.props(styles.cardTitle)}>
          Select · Checkbox · Radio · Switch · SegmentedControl
        </h2>
        <SelectionReview />
      </section>

      <section aria-labelledby="amounts-title" {...stylex.props(styles.card)}>
        <h2 id="amounts-title" {...stylex.props(styles.cardTitle)}>
          Textarea · AmountInput · AmountDisplay
        </h2>
        <AmountReview />
      </section>

      <section aria-labelledby="table-title" {...stylex.props(styles.card)}>
        <h2 id="table-title" {...stylex.props(styles.cardTitle)}>
          Table · Badge
        </h2>
        <TableReview />
      </section>

      <section aria-labelledby="dialog-title" {...stylex.props(styles.card)}>
        <h2 id="dialog-title" {...stylex.props(styles.cardTitle)}>
          Dialog
        </h2>
        <DialogReview />
      </section>

      <section aria-labelledby="states-title" {...stylex.props(styles.card)}>
        <h2 id="states-title" {...stylex.props(styles.cardTitle)}>
          EmptyState · Skeleton · ErrorState
        </h2>
        <FeedbackStatesReview />
      </section>

      <section aria-labelledby="notices-title" {...stylex.props(styles.card)}>
        <h2 id="notices-title" {...stylex.props(styles.cardTitle)}>
          Notice · Toast
        </h2>
        <FeedbackNoticeReview />
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
    padding: {
      default: "40px 48px",
      "@media (max-width: 640px)": "24px 16px",
    },
    // 화면 하단 토스트가 마지막 내용을 가리지 않도록 스크롤 여유를 둔다.
    paddingBottom: "160px",
    backgroundColor: colors.canvas,
    color: colors.text,
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif",
  },
  title: {
    margin: 0,
    fontSize: "24px",
  },
  screenLinks: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "14px",
  },
  screenLink: {
    color: colors.primary,
    fontWeight: 600,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "960px",
    padding: {
      default: "24px",
      "@media (max-width: 640px)": "16px",
    },
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
    gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
    gap: "20px",
  },
});
