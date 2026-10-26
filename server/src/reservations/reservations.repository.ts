import type { Reservation, ReservationCustomer, ReservationTreatment } from '@o2o/shared/contracts';

import { customers } from '@db/schemas/customers.schema.js';
import { reservations, reservationTreatments } from '@db/schemas/reservations.schema.js';
import { treatments } from '@db/schemas/treatments.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
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

  /** 예약 본문과 시술 스냅샷은 함께 바뀌어야 하므로 한 트랜잭션 안에서 다룬다. */
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** [from, to)에 시작한 예약. 시작 시각, 같으면 id 순이다. */
  findStartingBetween(from: number, to: number, includeCancelled: boolean): Promise<Reservation[]> {
    // 본문과 시술 스냅샷을 한 시점에서 읽는다. 사이에 끝난 수정이 섞이지 않게 한다
    return this.db.transaction(
      async (tx) => {
        const rows = await tx
          .select()
          .from(reservations)
          .where(
            and(
              gte(reservations.startAt, new Date(from)),
              lt(reservations.startAt, new Date(to)),
              includeCancelled ? undefined : isNull(reservations.cancelledAt),
            ),
          )
          .orderBy(asc(reservations.startAt), asc(reservations.id));
        return this.withTreatments(tx, rows);
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
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

  /** 행을 잠그고 읽는다. 트랜잭션이 끝날 때까지 다른 수정·취소는 기다린다. */
  async lock(tx: Transaction, id: number): Promise<Reservation | undefined> {
    const rows = await tx.select().from(reservations).where(eq(reservations.id, id)).for('update');
    const [reservation] = await this.withTreatments(tx, rows);
    return reservation;
  }

  async insert(tx: Transaction, draft: ReservationDraft): Promise<Reservation> {
    const [row] = await tx.insert(reservations).values(toColumns(draft)).returning();
    if (!row) throw new Error('예약을 저장했지만 저장한 행을 돌려받지 못했어요.');
    await this.insertTreatments(tx, row.id, draft.treatments);
    return toReservation(row, draft.treatments);
  }

  /** 취소되지 않은 예약만 바꾼다. 시술 스냅샷은 통째로 바꾼다. */
  async replace(tx: Transaction, id: number, draft: ReservationDraft): Promise<Reservation> {
    const [row] = await tx
      .update(reservations)
      .set(toColumns(draft))
      .where(and(eq(reservations.id, id), isNull(reservations.cancelledAt)))
      .returning();
    if (!row) throw new Error('잠근 예약을 바꾸지 못했어요.');
    await tx.delete(reservationTreatments).where(eq(reservationTreatments.reservationId, id));
    await this.insertTreatments(tx, id, draft.treatments);
    return toReservation(row, draft.treatments);
  }

  /** 처음 취소할 때만 시각·사유를 채운다. 이미 취소된 기록은 덮어쓰지 않는다. */
  async markCancelled(
    tx: Transaction,
    current: Reservation,
    reason: string | null,
    cancelledAt: Date,
  ): Promise<Reservation> {
    const [row] = await tx
      .update(reservations)
      .set({ cancelledAt, cancelReason: reason })
      .where(and(eq(reservations.id, current.id), isNull(reservations.cancelledAt)))
      .returning();
    if (!row) throw new Error('잠근 예약을 취소하지 못했어요.');
    return toReservation(row, current.treatments);
  }

  private async insertTreatments(
    tx: Transaction,
    reservationId: number,
    items: ReservationTreatment[],
  ) {
    await tx.insert(reservationTreatments).values(
      items.map((item, position) => ({
        reservationId,
        position,
        treatmentId: item.id,
        name: item.name,
        duration: item.duration,
      })),
    );
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

function toColumns(draft: ReservationDraft) {
  return {
    customerId: draft.customer.id,
    customerName: draft.customer.name,
    customerPhone: draft.customer.phone,
    startAt: new Date(draft.startAt),
    endAt: new Date(draft.endAt),
  };
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
