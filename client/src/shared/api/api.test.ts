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

  it("환경변수의 서버 경로를 기준으로 상대 endpoint를 요청한다", async () => {
    vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/v1/");
    const fetch = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api.ts");

    expect(await api.get("health").json()).toEqual({ ok: true });
    expect(fetch.mock.calls[0]?.[0].url).toBe("https://api.example.test/v1/health");
  });
});
