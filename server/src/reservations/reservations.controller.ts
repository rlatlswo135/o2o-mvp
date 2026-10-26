import { Controller } from '@nestjs/common';
import { contract } from '@o2o/shared/contracts';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { ReservationsService } from './reservations.service.js';

// 경로, 입력 검증, 응답 모양, 오류 종류는 @o2o/shared/contracts의 contract가 정한다.
// 컨트롤러는 서비스 결과를 계약의 오류로 바꾸는 일만 한다.
@Controller()
export class ReservationsController {
  constructor(private readonly reservationService: ReservationsService) {}

  @Implement(contract.reservations)
  reservations() {
    return {
      list: implement(contract.reservations.list).handler(({ input }) =>
        this.reservationService.getReservations(input.date, input.includeCancelled),
      ),
      create: implement(contract.reservations.create).handler(async ({ input, errors }) => {
        const result = await this.reservationService.createReservation(input);
        if (result.kind === 'rejected') {
          throw errors.UNPROCESSABLE_CONTENT({ data: result.rejection });
        }
        return result.reservation;
      }),
      update: implement(contract.reservations.update).handler(async ({ input, errors }) => {
        const result = await this.reservationService.updateReservation(input);
        switch (result.kind) {
          case 'updated':
            return result.reservation;
          case 'not_found':
            throw errors.NOT_FOUND();
          case 'already_cancelled':
            throw errors.CONFLICT({ data: { reservation: result.reservation } });
          case 'rejected':
            throw errors.UNPROCESSABLE_CONTENT({ data: result.rejection });
        }
      }),
      cancel: implement(contract.reservations.cancel).handler(async ({ input, errors }) => {
        const result = await this.reservationService.cancelReservation(input);
        switch (result.kind) {
          case 'cancelled':
            return result.reservation;
          case 'not_found':
            throw errors.NOT_FOUND();
          case 'already_cancelled':
            throw errors.CONFLICT({ data: { reservation: result.reservation } });
        }
      }),
    };
  }
}
