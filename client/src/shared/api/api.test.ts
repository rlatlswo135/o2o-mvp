import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("api", () => {
  it("서버 URL이 없으면 설정 오류를 알려준다", async () => {
    vi.stubEnv("VITE_SERVER_URL", "");
    await expect(import("./api.ts")).rejects.toThrow("VITE_SERVER_URL");
  });

  it("환경변수의 서버 경로 아래로 계약의 경로를 요청한다", async () => {
    vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/v1/");
    const fetch = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api.ts");

    expect(await api.customers.list()).toEqual([]);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.example.test/v1/customers");
  });
});
