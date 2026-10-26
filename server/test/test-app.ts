import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { App } from 'supertest/types.js';

import { devTargetsOf, readEnvFile, resolveTestDatabaseUrl } from './test-database.js';

const serverRoot = resolve(import.meta.dirname, '..');

/** 테스트 전용 DB인지 확인한 뒤에만 migration을 적용한다. AppModule을 import하기 전에 불러야 한다. */
export async function prepareTestDatabase(): Promise<string> {
  const url = resolveTestDatabaseUrl(process.env.TEST_DATABASE_URL, [
    ...devTargetsOf(process.env),
    ...devTargetsOf(readEnvFile(resolve(serverRoot, '.env'))),
  ]);
  // AppModule은 모듈을 읽을 때 DATABASE_URL을 쓰므로 import 전에 확인한 주소로 바꾼다
  process.env.DATABASE_URL = url;
  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder: resolve(serverRoot, 'db/migrations') });
  } finally {
    await db.$client.end();
  }
  return url;
}

/** 서버 재시작을 흉내 내려면 앱을 닫고 다시 부른다. 매번 새 연결 풀을 연다. */
export async function startApp(): Promise<INestApplication<App>> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}
