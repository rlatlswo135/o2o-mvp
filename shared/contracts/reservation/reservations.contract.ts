import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
  reservationCancelledSchema,
  reservationCancelSchema,
  reservationInputSchema,
  reservationListInputSchema,
  reservationRejectionSchema,
  reservationSchema,
  reservationUpdateSchema,
} from "./reservations.schema.ts";

// 오류 구분: 없는 예약 404, 이미 취소된 예약 409(확인한 예약 포함), 서버가 확정한 입력 거부 422(사유 포함).
// 형식이 틀린 입력은 계약 검증이 400으로 돌려준다.
export const reservationsContract = {
  list: oc
    .meta(openapi({ method: "GET", path: "/reservations" }))
    .input(reservationListInputSchema)
    .output(z.array(reservationSchema)),
  create: oc
    .meta(openapi({ method: "POST", path: "/reservations", successStatus: 201 }))
    .input(reservationInputSchema)
    .output(reservationSchema)
    .errors({ UNPROCESSABLE_CONTENT: { data: reservationRejectionSchema } }),
  update: oc
    .meta(openapi({ method: "PUT", path: "/reservations/{id}" }))
    .input(reservationUpdateSchema)
    .output(reservationSchema)
    .errors({
      NOT_FOUND: {},
      CONFLICT: { data: reservationCancelledSchema },
      UNPROCESSABLE_CONTENT: { data: reservationRejectionSchema },
    }),
  cancel: oc
    .meta(openapi({ method: "POST", path: "/reservations/{id}/cancel" }))
    .input(reservationCancelSchema)
    .output(reservationSchema)
    .errors({ NOT_FOUND: {}, CONFLICT: { data: reservationCancelledSchema } }),
};
