import { Injectable } from '@nestjs/common';

import { ReservationsRepository } from './reservations.repository.ts';

// TODO: 컨트롤러와 e2e 테스트가 요구하는 메서드·결과 타입을 직접 만든다. RESERVATION-TRANSACTION-TODO.md 참고.
@Injectable()
export class ReservationsService {
  constructor(private readonly reservations: ReservationsRepository) {}

  getReservations() {
    return null;
  }

  getReservationById() {
    return null;
  }

  async createReservation() {
    return null;
  }

  async updateReservation() {
    return null;
  }

  async cancelReservation() {
    return null;
  }
}
