import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { treatmentInputSchema, treatmentSchema } from "./treatments.schema.ts";

export const treatmentsContract = {
  list: oc.meta(openapi({ method: "GET", path: "/treatments" })).output(z.array(treatmentSchema)),
  create: oc
    .meta(openapi({ method: "POST", path: "/treatments", successStatus: 201 }))
    .input(treatmentInputSchema)
    .output(treatmentSchema),
};
