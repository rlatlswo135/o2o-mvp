/** 모달이 열린 동안 페이지 스크롤을 잠그고, 돌려받은 함수로 이전 값을 되돌린다. */
export function lockPageScroll() {
  const root = document.documentElement;
  const previous = root.style.overflow;
  root.style.overflow = "hidden";
  return () => {
    root.style.overflow = previous;
  };
}
