import type {
  Reservation,
  ReservationCancel,
  ReservationInput,
  ReservationRejection,
  ReservationUpdate,
} from '@o2o/shared/contracts';

import { Injectable } from '@nestjs/common';
import { dayRange, scheduleOf, snapshotTreatments } from '@o2o/shared/contracts';

import {
  ReservationDraft,
  ReservationsRepository,
  Transaction,
} from './reservations.repository.js';

// 서비스는 HTTP와 oRPC를 모른다. 결과만 돌려주고, 응답 코드로 바꾸는 일은 컨트롤러가 한다.
export type Rejected = { kind: 'rejected'; rejection: ReservationRejection };
export type CreateReservationResult = { kind: 'created'; reservation: Reservation } | Rejected;
export type UpdateReservationResult =
  | { kind: 'updated'; reservation: Reservation }
  | { kind: 'not_found' }
  | { kind: 'already_cancelled'; reservation: Reservation }
  | Rejected;
export type CancelReservationResult =
  | { kind: 'cancelled'; reservation: Reservation }
  | { kind: 'not_found' }
  | { kind: 'already_cancelled'; reservation: Reservation };

@Injectable()
export class ReservationsService {
  constructor(private readonly reservations: ReservationsRepository) {}

  /** date는 계약이 2000~2099년 날짜로 확인한 값이다. */
  getReservations(date: string, includeCancelled: boolean) {
    const range = dayRange(date);
    if (!range) throw new Error(`조회할 수 없는 날짜예요: ${date}`);
    return this.reservations.findStartingBetween(range.from, range.to, includeCancelled);
  }

  /** TODO: 예약 본문과 시술 스냅샷 저장을 하나의 트랜잭션으로 묶는다. */
  createReservation(_input: ReservationInput): Promise<CreateReservationResult> {
    throw new Error('TODO: create reservation transaction');
  }

  /** TODO: 행 잠금 → 취소 여부 확인 → draft 계산 → 원자적 교체 순으로 처리한다. */
  updateReservation(_input: ReservationUpdate): Promise<UpdateReservationResult> {
    throw new Error('TODO: update reservation transaction');
  }

  /** TODO: 행 잠금 후 최초 취소만 기록한다. */
  cancelReservation(_input: ReservationCancel): Promise<CancelReservationResult> {
    throw new Error('TODO: cancel reservation transaction');
  }

  // 클라이언트가 보낸 이름·소요시간·종료 일시는 받지 않는다. 고객·시술을 확인해 스냅샷과 종료 일시를 정한다.
  // 수정에서 그대로 둔 고객·시술은 예약 당시 값을 쓰고, 바꾸거나 새로 고른 것만 지금 값으로 확인한다.
  private async draft(
    tx: Transaction,
    input: ReservationInput,
    current: Reservation | null,
  ): Promise<{ kind: 'ok'; draft: ReservationDraft } | Rejected> {
    const customer =
      current?.customer.id === input.customerId
        ? current.customer
        : await this.reservations.findCustomer(tx, input.customerId);
    if (!customer) return { kind: 'rejected', rejection: { reason: 'customer_not_found' } };

    const kept = current?.treatments ?? [];
    const added = input.treatmentIds.filter((id) => !kept.some((item) => item.id === id));
    const listed = added.length > 0 ? await this.reservations.findTreatments(tx, added) : [];
    const snapshot = snapshotTreatments(input.treatmentIds, kept, listed);
    if (snapshot.kind === 'missing') {
      return {
        kind: 'rejected',
        rejection: { reason: 'treatment_not_found', treatmentIds: snapshot.treatmentIds },
      };
    }

    const schedule = scheduleOf(
      input.startAt,
      snapshot.treatments.map((item) => item.duration),
    );
    if (!schedule) return { kind: 'rejected', rejection: { reason: 'schedule_out_of_range' } };

    return {
      kind: 'ok',
      draft: {
        customer,
        treatments: snapshot.treatments,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
      },
    };
  }
}
