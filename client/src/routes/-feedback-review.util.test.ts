import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createVirtualRetry } from "./-feedback-review.util.ts";

describe("createVirtualRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("대기 중 다시 시작하면 무시하고 완료 콜백은 한 번만 부른다", () => {
    const retry = createVirtualRetry(800);
    const done = vi.fn<() => void>();

    expect(retry.start(done)).toBe(true);
    expect(retry.start(done)).toBe(false);
    vi.advanceTimersByTime(799);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("취소하면 늦은 완료가 실행되지 않는다", () => {
    const retry = createVirtualRetry(800);
    const done = vi.fn<() => void>();

    retry.start(done);
    retry.cancel();
    vi.advanceTimersByTime(2000);

    expect(done).not.toHaveBeenCalled();
  });

  it("완료나 취소 뒤에는 다시 시작할 수 있다", () => {
    const retry = createVirtualRetry(800);
    const done = vi.fn<() => void>();

    retry.start(done);
    vi.advanceTimersByTime(800);
    expect(retry.start(done)).toBe(true);
    retry.cancel();
    expect(retry.start(done)).toBe(true);
    vi.advanceTimersByTime(800);

    expect(done).toHaveBeenCalledTimes(2);
  });
});
