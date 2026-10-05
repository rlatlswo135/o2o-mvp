// 금액 원문 해석과 표시 형식. UI 없이 쓰고 테스트한다.
export type AmountParseResult =
  | { status: "empty" }
  | { status: "valid"; value: number }
  | { status: "invalid"; reason: "format" | "range" };

// 부호(-, −, +) 하나와 숫자. 쉼표는 세 자리 묶음일 때만 허용한다.
const AMOUNT_PATTERN = /^([+\-−])?(\d+|\d{1,3}(?:,\d{3})+)$/;

/**
 * 원 단위 정수 금액 원문을 해석한다. 빈 값은 0이 아니며,
 * 정수 형식이 아니거나 안전한 정수 범위를 벗어나면 NaN·0 대신 invalid로 돌려준다.
 */
export function parseAmount(raw: string): AmountParseResult {
  const text = raw.trim();
  if (text === "") {
    return { status: "empty" };
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) {
    return { status: "invalid", reason: "format" };
  }

  const [, sign, digits = ""] = match;
  const magnitude = Number(digits.replaceAll(",", ""));
  if (!Number.isSafeInteger(magnitude)) {
    return { status: "invalid", reason: "range" };
  }

  const isNegative = sign === "-" || sign === "−";
  // -0은 0으로 정규화한다.
  return { status: "valid", value: isNegative && magnitude !== 0 ? -magnitude : magnitude };
}

const amountFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 금액 숫자를 한국어 천 단위 구분으로 표시한다. 단위(원)는 붙이지 않는다. */
export function formatAmount(value: number) {
  return amountFormatter.format(value);
}
