import type { RouterContractClient } from "@orpc/contract";

import { contract } from "@o2o/shared/contracts";
import { createORPCClient, ORPCError } from "@orpc/client";
import { ResponseValidationPlugin } from "@orpc/contract/plugins";
import { OpenAPILink } from "@orpc/openapi/fetch";

const serverUrl: string | undefined = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) throw new Error("client/.env.local에 VITE_SERVER_URL을 설정해주세요.");

// oRPC는 origin과 경로를 따로 받는다. VITE_SERVER_URL에 경로(/v1 등)가 붙어 있어도 그 아래로 요청한다.
const { origin, pathname } = new URL(serverUrl);

/** 서버 API. 경로·입력·응답 모양은 @o2o/shared/contracts의 contract를 따르고, 응답은 계약 스키마로 확인한다. */
export const api: RouterContractClient<typeof contract> = createORPCClient(
  new OpenAPILink(contract, {
    origin,
    url: pathname as `/${string}`,
    plugins: [new ResponseValidationPlugin(contract)],
  }),
);

/**
 * 서버가 요청을 받아 거부했다고 확정할 수 있는 오류. 계약에 정의한 오류(data까지 맞음)와 입력 확인 실패(400)다.
 * 그 밖의 실패(통신 실패·5xx·응답 계약 위반)는 서버에 반영됐을 수도 있어 결과 불명으로 다룬다.
 */
export function isRejection(error: unknown): error is ORPCError<string, unknown> {
  // 응답 계약 위반은 INTERNAL_SERVER_ERROR로 바뀌어 여기 들지 않는다
  if (!(error instanceof ORPCError)) return false;
  return error.defined || error.code === "BAD_REQUEST";
}

/** 입력 확인 실패(400)의 issues에서 첫 경로가 names에 있는 칸별 첫 문구를 모은다. */
export function fieldIssuesOf<Name extends string>(
  error: ORPCError<string, unknown>,
  names: ReadonlyArray<Name>,
): Partial<Record<Name, string>> {
  const errors: Partial<Record<Name, string>> = {};
  if (error.code !== "BAD_REQUEST") return errors;
  const issues = (error.data as { issues?: unknown } | undefined)?.issues;
  if (!Array.isArray(issues)) return errors;
  for (const issue of issues as Array<{ path?: unknown[]; message?: unknown }>) {
    const name = issue.path?.[0];
    if (typeof name !== "string" || typeof issue.message !== "string") continue;
    if (!names.includes(name as Name) || errors[name as Name] !== undefined) continue;
    errors[name as Name] = issue.message;
  }
  return errors;
}
