import { Controller } from '@nestjs/common';
import { contract } from '@o2o/shared/contracts';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { TreatmentsService } from './treatments.service.js';

// 경로, 입력 검증, 응답 모양은 @o2o/shared/contracts의 contract가 정한다.
@Controller()
export class TreatmentsController {
  constructor(private readonly treatmentService: TreatmentsService) {}

  @Implement(contract.treatments)
  treatments() {
    return {
      list: implement(contract.treatments.list).handler(() =>
        this.treatmentService.getTreatments(),
      ),
      create: implement(contract.treatments.create).handler(({ input }) =>
        this.treatmentService.createTreatment(input),
      ),
    };
  }
}
