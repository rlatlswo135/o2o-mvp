import { reservations, reservationTreatments } from '@db/schemas/reservations.schema.ts';
import { treatments } from '@db/schemas/treatments.schema.ts';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Reservation } from '@o2o/shared/contracts';
import { asc, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

// TODO: 서비스와 e2e 테스트가 요구하는 타입·메서드를 직접 만든다. RESERVATION-TRANSACTION-TODO.md 참고.
@Injectable()
export class ReservationsRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async findAll(): Promise<ReservationDto[]> {
    const result = await this.db
      .select({ reservations, reservationTreatments })
      .from(reservations)
      .innerJoin(reservationTreatments, eq(reservationTreatments.reservationId, reservations.id))
      .orderBy(asc(reservations.startAt));

    return toConvert(result);
  }
}

type ReservationJoinRow = {
  reservations: typeof reservations.$inferSelect;
  reservationTreatments: typeof reservationTreatments.$inferSelect;
};

type ReservationDto = {
  treatments: Omit<typeof reservationTreatments.$inferSelect, 'reservationId'>[];
} & typeof reservations.$inferSelect;

const toConvert = (response: ReservationJoinRow[]): ReservationDto[] => {
  const grouped = new Map<number, ReservationDto>();

  response.forEach(({ reservations, reservationTreatments }) => {
    const reservation = grouped.get(reservations.id);
    const { reservationId, ...treatment } = reservationTreatments;

    if (reservation) {
      // oxlint-disable-next-line no-unused-vars
      reservation.treatments.push(treatment);

      grouped.set(reservationId, reservation);
      return;
    }

    const dto = {
      ...reservations,
      treatments: [treatment],
    };

    grouped.set(reservations.id, dto);
  });

  return [...grouped.values()];
};
