import type { RouterContractClient } from "@orpc/contract";

import { contract } from "@o2o/shared/contracts";
import { createORPCClient } from "@orpc/client";
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
