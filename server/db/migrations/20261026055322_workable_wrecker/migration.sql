CREATE TABLE "reservation_treatments" (
	"reservationId" integer,
	"position" integer,
	"treatmentId" integer NOT NULL,
	"name" text NOT NULL,
	"duration" bigint NOT NULL,
	CONSTRAINT "reservation_treatments_pkey" PRIMARY KEY("reservationId","position"),
	CONSTRAINT "reservation_treatments_reservation_treatment_unique" UNIQUE("reservationId","treatmentId"),
	CONSTRAINT "reservation_treatments_duration_range" CHECK ("duration" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customerId" integer NOT NULL,
	"customerName" text NOT NULL,
	"customerPhone" text NOT NULL,
	"startAt" timestamp with time zone NOT NULL,
	"endAt" timestamp with time zone NOT NULL,
	"cancelledAt" timestamp with time zone,
	"cancelReason" text,
	CONSTRAINT "reservations_end_after_start" CHECK ("endAt" > "startAt"),
	CONSTRAINT "reservations_reason_only_when_cancelled" CHECK ("cancelReason" is null or "cancelledAt" is not null)
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "treatments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"duration" bigint NOT NULL,
	"price" bigint NOT NULL,
	CONSTRAINT "treatments_name_not_blank" CHECK (btrim("name") <> ''),
	CONSTRAINT "treatments_duration_range" CHECK ("duration" between 1 and 9007199254740991),
	CONSTRAINT "treatments_price_range" CHECK ("price" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE INDEX "reservations_start_at_id_idx" ON "reservations" ("startAt","id");--> statement-breakpoint
ALTER TABLE "reservation_treatments" ADD CONSTRAINT "reservation_treatments_reservationId_reservations_id_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE;