import type { FormEvent } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { Brand } from "@/shared/brand/brand.tsx";
import { Button } from "@/shared/ui/button/button.tsx";
import { Field } from "@/shared/ui/field/field.tsx";
import { Input } from "@/shared/ui/input/input.tsx";
import { Notice } from "@/shared/ui/notice/notice.tsx";

import { colors, radii, shadows } from "../../shared/ui/theme.stylex.ts";

// 인증 방식이 정해지기 전의 화면 확인용 폼. 입력값은 전송·저장하지 않는다(name 속성도 두지 않는다).
export function LoginPage() {
  const noticeId = useId();
  const laterId = useId();

  // Enter 암시적 제출로도 요청·URL 변화가 생기지 않게 막는다
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div {...stylex.props(styles.page)}>
      <aside aria-hidden="true" {...stylex.props(styles.brandPanel)}>
        <span {...stylex.props(styles.brandRow)}>
          <Brand />
        </span>
        <span {...stylex.props(styles.swatches)}>
          {swatches.map((swatch) => (
            <span key={swatch.color} {...stylex.props(styles.swatch, swatch.style)} />
          ))}
        </span>
        <p {...stylex.props(styles.tagline)}>샵 운영을 한곳에서.</p>
      </aside>

      <main {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.card)}>
          <div {...stylex.props(styles.heading)}>
            <p {...stylex.props(styles.eyebrow)}>OWNER SIGN IN</p>
            <h1 {...stylex.props(styles.title)}>사장님 로그인</h1>
            <p {...stylex.props(styles.description)}>샵 운영 화면에 들어가려면 로그인해요.</p>
          </div>

          <div id={noticeId}>
            <Notice
              tone="info"
              title="인증 연결 예정"
              description="아직 로그인 기능이 연결되지 않았어요. 입력한 내용은 전송·저장되지 않아요."
            />
          </div>

          <form
            noValidate
            aria-describedby={noticeId}
            onSubmit={handleSubmit}
            {...stylex.props(styles.form)}
          >
            <Field label="아이디">
              <Input type="text" autoComplete="off" placeholder="아이디 입력" />
            </Field>
            <Field label="비밀번호">
              <Input type="password" autoComplete="off" placeholder="비밀번호 입력" />
            </Field>
            <div {...stylex.props(styles.submit)}>
              <Button type="submit" disabled aria-describedby={laterId}>
                로그인
              </Button>
              <p id={laterId} {...stylex.props(styles.later)}>
                인증이 연결되면 사용할 수 있어요.
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

const desktop = "@media (min-width: 1024px)";
const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  page: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [desktop]: "minmax(400px, 44%) minmax(0, 1fr)",
    },
    gridTemplateRows: {
      default: "auto 1fr",
      [desktop]: "auto",
    },
    minHeight: "100dvh",
    backgroundColor: colors.canvas,
    color: colors.text,
  },
  brandPanel: {
    position: "relative",
    display: "flex",
    flexDirection: {
      default: "row",
      [desktop]: "column",
    },
    alignItems: {
      default: "flex-end",
      [desktop]: "stretch",
    },
    justifyContent: "space-between",
    height: {
      default: "200px",
      [narrow]: "148px",
      [desktop]: "auto",
    },
    padding: {
      default: "24px",
      [narrow]: "16px",
      [desktop]: "40px",
    },
    overflow: "hidden",
    backgroundImage: `linear-gradient(180deg, #f6e3da 0%, ${colors.canvas} 100%)`,
  },
  brandRow: {
    position: {
      default: "absolute",
      [desktop]: "static",
    },
    top: {
      default: "24px",
      [narrow]: "16px",
    },
    left: {
      default: "24px",
      [narrow]: "16px",
    },
    display: "flex",
  },
  swatches: {
    display: "flex",
    alignItems: "flex-end",
    gap: {
      default: "8px",
      [desktop]: "12px",
    },
    marginBlock: {
      default: 0,
      [desktop]: "40px 24px",
    },
    marginInlineStart: {
      default: "auto",
      [desktop]: 0,
    },
  },
  swatch: {
    position: "relative",
    display: "block",
    width: {
      default: "24px",
      [desktop]: "36px",
    },
    borderRadius: "18px",
    boxShadow: "inset 0 -10px 18px rgba(0, 0, 0, 0.08)",
    "::after": {
      content: "''",
      position: "absolute",
      top: "12%",
      left: "22%",
      width: "18%",
      height: "38%",
      borderRadius: radii.pill,
      backgroundColor: "rgba(255, 255, 255, 0.38)",
    },
  },
  tagline: {
    display: {
      default: "none",
      [desktop]: "block",
    },
    margin: 0,
    color: colors.textMuted,
    fontSize: "12px",
    lineHeight: "18px",
  },
  main: {
    display: "flex",
    alignItems: {
      default: "flex-start",
      [desktop]: "center",
    },
    justifyContent: "center",
    padding: {
      default: "32px 24px",
      [narrow]: 0,
      [desktop]: "40px",
    },
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    maxWidth: {
      default: "440px",
      [narrow]: "none",
      [desktop]: "400px",
    },
    padding: {
      default: "32px",
      [narrow]: "24px 16px 32px",
      [desktop]: 0,
    },
    borderWidth: {
      default: "1px",
      [narrow]: 0,
      [desktop]: 0,
    },
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: {
      default: radii.card,
      [narrow]: 0,
    },
    backgroundColor: {
      default: colors.surface,
      [desktop]: "transparent",
    },
    boxShadow: {
      default: shadows.card,
      [narrow]: "none",
      [desktop]: "none",
    },
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  eyebrow: {
    margin: 0,
    color: colors.accent,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "16px",
    letterSpacing: "0.14em",
  },
  title: {
    margin: 0,
    fontSize: {
      default: "30px",
      [narrow]: "24px",
    },
    fontWeight: 700,
    lineHeight: {
      default: "38px",
      [narrow]: "32px",
    },
    letterSpacing: "-0.02em",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "15px",
    lineHeight: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  submit: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
  },
  later: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "12px",
    lineHeight: "18px",
    textAlign: "center",
  },
});

// 매니큐어 스와치 장식. 데스크톱 패널에서만 크게 보인다.
const swatchStyles = stylex.create({
  coral: {
    height: { default: "72px", [desktop]: "120px" },
    backgroundColor: "#d9583f",
  },
  blush: {
    height: { default: "58px", [desktop]: "96px" },
    backgroundColor: "#e9a08c",
  },
  rose: {
    height: { default: "80px", [desktop]: "132px" },
    backgroundColor: "#c9867a",
  },
  wine: {
    height: { default: "64px", [desktop]: "108px" },
    backgroundColor: "#8e4b4b",
  },
  nude: {
    height: { default: "56px", [desktop]: "100px" },
    backgroundColor: "#f2cdbf",
  },
});

const swatches = [
  { color: "coral", style: swatchStyles.coral },
  { color: "blush", style: swatchStyles.blush },
  { color: "rose", style: swatchStyles.rose },
  { color: "wine", style: swatchStyles.wine },
  { color: "nude", style: swatchStyles.nude },
];
