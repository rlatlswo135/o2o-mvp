import { glob } from 'node:fs/promises';

import type { FunctionsVersioning, InferCallbackType } from 'drizzle-seed';
import { reset, seed } from 'drizzle-seed';

import { db } from '../index.ts';
import * as schema from '../schemas/index.ts';

// 도메인별 *.seeds.ts는 이 타입의 `refine`을 export한다.
export type SeedRefine = (f: FunctionsVersioning) => InferCallbackType<typeof db, typeof schema>;

const refines: SeedRefine[] = [];
for await (const file of glob('*.seeds.ts', { cwd: import.meta.dirname })) {
  const { refine } = (await import(`./${file}`)) as { refine: SeedRefine };
  refines.push(refine);
}

await reset(db, schema);
await seed(db, schema).refine((f) => Object.assign({}, ...refines.map((refine) => refine(f))));
