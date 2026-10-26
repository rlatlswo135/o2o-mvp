import type { Reservation, ReservationCustomer, ReservationTreatment } from '@o2o/shared/contracts';

import { customers } from '@db/schemas/customers.schema.js';
import { reservations, reservationTreatments } from '@db/schemas/reservations.schema.js';
import { treatments } from '@db/schemas/treatments.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { asc, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Transaction = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

/** 저장할 예약 본문. 스냅샷·종료 일시는 서비스가 정한다. */
export type ReservationDraft = {
  customer: ReservationCustomer;
  treatments: ReservationTreatment[];
  startAt: number;
  endAt: number;
};

type ReservationRow = typeof reservations.$inferSelect;

@Injectable()
export class ReservationsRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  /** TODO: work을 DB 트랜잭션에 전달하고 결과를 반환한다. */
  transaction<T>(_work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (_tx) => {
      throw new Error('TODO: pass transaction handle to work');
    });
  }

  /** [from, to)에 시작한 예약. 시작 시각, 같으면 id 순이다. */
  findStartingBetween(
    _from: number,
    _to: number,
    _includeCancelled: boolean,
  ): Promise<Reservation[]> {
    throw new Error('TODO: repeatable-read list transaction');
  }

  async findCustomer(tx: Transaction, id: number): Promise<ReservationCustomer | undefined> {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).limit(1);
    return customer;
  }

  findTreatments(tx: Transaction, ids: number[]): Promise<ReservationTreatment[]> {
    return tx
      .select({ id: treatments.id, name: treatments.name, duration: treatments.duration })
      .from(treatments)
      .where(inArray(treatments.id, ids));
  }

  /** TODO: 예약 행을 잠그고 본문·시술 스냅샷을 읽는다. */
  async lock(_tx: Transaction, _id: number): Promise<Reservation | undefined> {
    throw new Error('TODO: lock reservation row');
  }

  /** TODO: 예약 본문을 저장한 뒤 같은 tx로 시술 스냅샷을 저장한다. */
  async insert(_tx: Transaction, _draft: ReservationDraft): Promise<Reservation> {
    throw new Error('TODO: insert reservation and treatment snapshots');
  }

  /** TODO: 취소되지 않은 예약 본문·시술 스냅샷을 같은 tx로 교체한다. */
  async replace(_tx: Transaction, _id: number, _draft: ReservationDraft): Promise<Reservation> {
    throw new Error('TODO: replace reservation and treatment snapshots');
  }

  /** TODO: 최초 취소만 기록하고 취소된 예약을 덮어쓰지 않는다. */
  async markCancelled(
    _tx: Transaction,
    _current: Reservation,
    _reason: string | null,
    _cancelledAt: Date,
  ): Promise<Reservation> {
    throw new Error('TODO: mark reservation cancelled');
  }

  /** TODO: 요청 순서대로 시술 스냅샷을 tx에 삽입한다. */
  private async insertTreatments(
    _tx: Transaction,
    _reservationId: number,
    _items: ReservationTreatment[],
  ) {
    throw new Error('TODO: insert treatment snapshots');
  }

  private async withTreatments(
    db: NodePgDatabase | Transaction,
    rows: ReservationRow[],
  ): Promise<Reservation[]> {
    if (rows.length === 0) return [];
    const items = await db
      .select()
      .from(reservationTreatments)
      .where(
        inArray(
          reservationTreatments.reservationId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(reservationTreatments.reservationId), asc(reservationTreatments.position));
    return rows.map((row) =>
      toReservation(
        row,
        items
          .filter((item) => item.reservationId === row.id)
          .map((item) => ({ id: item.treatmentId, name: item.name, duration: item.duration })),
      ),
    );
  }
}

function toReservation(row: ReservationRow, items: ReservationTreatment[]): Reservation {
  return {
    id: row.id,
    customer: { id: row.customerId, name: row.customerName, phone: row.customerPhone },
    treatments: items,
    startAt: row.startAt.getTime(),
    endAt: row.endAt.getTime(),
    cancelledAt: row.cancelledAt?.getTime() ?? null,
    cancelReason: row.cancelReason,
  };
}
