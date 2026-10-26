import type { TreatmentInput } from '@o2o/shared/contracts';

import { Injectable } from '@nestjs/common';

import { TreatmentsRepository } from './treatments.repository.js';

@Injectable()
export class TreatmentsService {
  constructor(private readonly treatments: TreatmentsRepository) {}

  getTreatments() {
    return this.treatments.findAll();
  }

  createTreatment(input: TreatmentInput) {
    return this.treatments.insert(input);
  }
}
