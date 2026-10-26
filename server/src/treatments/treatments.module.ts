import { Module } from '@nestjs/common';

import { TreatmentsController } from './treatments.controller.js';
import { TreatmentsRepository } from './treatments.repository.js';
import { TreatmentsService } from './treatments.service.js';

@Module({
  controllers: [TreatmentsController],
  providers: [TreatmentsService, TreatmentsRepository],
})
export class TreatmentsModule {}
