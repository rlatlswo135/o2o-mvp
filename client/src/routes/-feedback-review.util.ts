/**
 * 검토 화면의 가상 재시도. 잠깐 기다린 뒤 완료 콜백을 한 번 부른다.
 * 대기 중 재시작은 무시하고(중복 재시도 방지), 취소하면 늦은 완료가 실행되지 않는다.
 */
export function createVirtualRetry(delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    start(onDone: () => void) {
      if (timer !== null) return false;
      timer = setTimeout(() => {
        timer = null;
        onDone();
      }, delayMs);
      return true;
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
