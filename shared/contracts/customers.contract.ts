import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { customerInputSchema, customerSchema } from "./customers.schema.ts";

// path와 query 값은 문자열로 들어오므로 숫자와 불리언은 여기서 변환한다.
// 숫자는 z.coerce.number(), 불리언은 z.stringbool()을 쓴다(z.coerce.boolean은 "false"도 true가 된다).
// id 컬럼은 Postgres integer라서 그 범위를 넘는 값은 DB 오류(500) 대신 입력 오류(400)로 돌려준다.
const customerIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const customersContract = {
  list: oc.meta(openapi({ method: "GET", path: "/customers" })).output(z.array(customerSchema)),
  find: oc
    .meta(openapi({ method: "GET", path: "/customers/{id}" }))
    .input(z.object({ id: customerIdSchema }))
    .output(customerSchema)
    .errors({ NOT_FOUND: {} }),
  create: oc
    .meta(openapi({ method: "POST", path: "/customers", successStatus: 201 }))
    .input(customerInputSchema)
    .output(customerSchema)
    .errors({ CONFLICT: {} }),
};
