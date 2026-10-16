import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
  customerIdSchema,
  customerInputSchema,
  customerSchema,
  customerUpdateSchema,
} from "./customers.schema.ts";

// path와 query 값은 문자열로 들어오므로 숫자와 불리언은 여기서 변환한다.
// 숫자는 z.coerce.number(), 불리언은 z.stringbool()을 쓴다(z.coerce.boolean은 "false"도 true가 된다).
// id 컬럼은 Postgres integer라서 그 범위를 넘는 값은 DB 오류(500) 대신 입력 오류(400)로 돌려준다.

export const customersContract = {
  list: oc.meta(openapi({ method: "GET", path: "/customers" })).output(z.array(customerSchema)),
  get: oc
    .meta(openapi({ method: "GET", path: "/customers/{id}" }))
    .input(customerIdSchema)
    .output(customerSchema)
    .errors({ NOT_FOUND: {} }),
  create: oc
    .meta(openapi({ method: "POST", path: "/customers", successStatus: 201 }))
    .input(customerInputSchema)
    .output(customerSchema)
    .errors({ CONFLICT: {} }),
  // 삭제할때 보통 output? -> 204 + noContent .... id만 받는 것도 스키마로? Pipe처럼 @Param이런건 없나 -> 아 이미 oRPC쓰기로했으니 그 계약은 여기책임.
  delete: oc
    .meta(openapi({ method: "DELETE", path: "/customers/{id}", successStatus: 204 }))
    .input(customerIdSchema)
    .errors({ NOT_FOUND: {} }),
  update: oc
    .meta(openapi({ method: "PUT", path: "/customers/{id}" }))
    .input(customerUpdateSchema)
    .output(customerSchema)
    .errors({ NOT_FOUND: {}, CONFLICT: {} }),
};
