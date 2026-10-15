/**
 * 숫자만 저장된 전화번호를 화면에 보이는 형태로 나눈다.
 * 국내 번호 형태가 아니면 받은 그대로 돌려준다.
 */
export function formatPhone(digits: string): string {
  // 서울 지역번호 02: 02-123-4567, 02-1234-5678
  if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  // 휴대폰·지역번호(0으로 시작하는 3자리): 010-1234-5678, 031-123-4567
  if (/^0\d{9,10}$/.test(digits)) return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");
  // 대표번호: 1588-1234
  if (/^1\d{7}$/.test(digits)) return digits.replace(/^(\d{4})(\d{4})$/, "$1-$2");
  return digits;
}
