import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import ConnectionParameters from 'pg/lib/connection-parameters';

// e2e는 TEST_DATABASE_URL로 지정한 테스트 전용 DB에서만 돈다. 개발 DB로 대신 실행하지 않는다.
// 오류 문구에는 접속 정보를 넣지 않는다.

export type DatabaseTarget = { host: string; port: string; database: string };

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const normalizeHost = (host: string) => {
  const lower = host.toLowerCase();
  return localHosts.has(lower) ? 'localhost' : lower;
};

// 대상은 pg 드라이버의 파서로 읽는다. 쿼리 host·port(중복이면 마지막 값), 정수 port, PGPORT 등 기본값이 실제 접속과 같아진다
export function targetOf(url: string): DatabaseTarget | null {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return null;
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') return null;
  let resolved: ConnectionParameters;
  try {
    resolved = new ConnectionParameters(url);
  } catch {
    return null;
  }
  const { host, port, database } = resolved;
  if (!host || !database || !Number.isInteger(port)) return null;
  return { host: normalizeHost(host), port: String(port), database };
}

const sameTarget = (a: DatabaseTarget, b: DatabaseTarget) =>
  a.host === b.host && a.port === b.port && a.database === b.database;

/** 개발 서버(DATABASE_URL)와 drizzle-kit(POSTGRES_DB·DATABASE_PORT)이 쓰는 대상. */
export function devTargetsOf(env: Record<string, string | undefined>): DatabaseTarget[] {
  const targets: DatabaseTarget[] = [];
  const fromUrl = env.DATABASE_URL ? targetOf(env.DATABASE_URL) : null;
  if (fromUrl) targets.push(fromUrl);
  if (env.POSTGRES_DB) {
    targets.push({
      host: 'localhost',
      port: env.DATABASE_PORT || '5432',
      database: env.POSTGRES_DB,
    });
  }
  return targets;
}

/** server/.env를 process.env에 넣지 않고 값만 읽는다. */
export function readEnvFile(path: string): Record<string, string | undefined> {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

/** 접속·migration·정리 전에 부른다. 테스트 전용 대상이 아니면 던진다. */
export function resolveTestDatabaseUrl(
  testUrl: string | undefined,
  devTargets: DatabaseTarget[],
): string {
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL이 없어요. 개발 DB(DATABASE_URL)로 대신 실행하지 않아요.');
  }
  const target = targetOf(testUrl);
  if (!target) throw new Error('TEST_DATABASE_URL이 postgres 접속 주소가 아니에요.');
  if (!/test/i.test(target.database)) {
    throw new Error('TEST_DATABASE_URL의 DB 이름에 test가 없어요. 테스트 전용 DB만 쓸 수 있어요.');
  }
  if (devTargets.some((dev) => sameTarget(dev, target))) {
    throw new Error(
      'TEST_DATABASE_URL이 개발 DB와 같은 대상이에요. 테스트 전용 DB를 따로 지정해주세요.',
    );
  }
  return testUrl;
}
