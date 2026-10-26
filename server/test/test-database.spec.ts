import { devTargetsOf, resolveTestDatabaseUrl, targetOf } from './test-database.js';

const dev = devTargetsOf({
  DATABASE_URL: 'postgres://app:secret@localhost:5432/o2o',
  POSTGRES_DB: 'o2o_kit',
  DATABASE_PORT: '5433',
});

describe('테스트 DB 확인', () => {
  it('TEST_DATABASE_URL이 없으면 개발 DB로 대신하지 않고 멈춘다', () => {
    expect(() => resolveTestDatabaseUrl(undefined, dev)).toThrow(/TEST_DATABASE_URL이 없어요/);
    expect(() => resolveTestDatabaseUrl('', dev)).toThrow(/TEST_DATABASE_URL이 없어요/);
  });

  it('개발 서버가 쓰는 DB와 같은 대상이면 이름에 test가 있어도 멈춘다', () => {
    const devNamedTest = devTargetsOf({ DATABASE_URL: 'postgres://a:b@127.0.0.1/o2o_test' });

    expect(() =>
      resolveTestDatabaseUrl('postgresql://other:pw@localhost:5432/o2o_test', devNamedTest),
    ).toThrow(/개발 DB와 같은 대상/);
  });

  it('drizzle-kit이 쓰는 개발 DB(POSTGRES_DB·DATABASE_PORT)와 같아도 멈춘다', () => {
    const kit = devTargetsOf({ POSTGRES_DB: 'o2o_test', DATABASE_PORT: '5432' });

    expect(() => resolveTestDatabaseUrl('postgres://a:b@127.0.0.1:5432/o2o_test', kit)).toThrow(
      /개발 DB와 같은 대상/,
    );
  });

  it('DB 이름에 test가 없으면 테스트 전용 대상으로 보지 않는다', () => {
    expect(() => resolveTestDatabaseUrl('postgres://a:b@localhost:5432/o2o', [])).toThrow(
      /test가 없어요/,
    );
    expect(() => resolveTestDatabaseUrl('mysql://a:b@localhost/o2o_test', [])).toThrow(
      /postgres 접속 주소가 아니에요/,
    );
  });

  it('개발 DB와 다른 테스트 전용 DB만 그대로 쓴다', () => {
    const url = 'postgres://a:b@localhost:5432/o2o_test';

    expect(resolveTestDatabaseUrl(url, dev)).toBe(url);
  });

  it('오류 문구에 접속 정보를 담지 않는다', () => {
    try {
      resolveTestDatabaseUrl('postgres://user:topsecret@localhost:5432/o2o', dev);
    } catch (error) {
      expect(String(error)).not.toContain('topsecret');
    }
  });

  it('쿼리의 host·port로 개발 DB를 가리키면 주소 부분이 달라도 멈춘다', () => {
    const devNamedTest = devTargetsOf({ DATABASE_URL: 'postgres://a:b@localhost:5432/o2o_test' });

    expect(() =>
      resolveTestDatabaseUrl('postgres://f:f@localhost:5433/o2o_test?port=5432', devNamedTest),
    ).toThrow(/개발 DB와 같은 대상/);
    expect(() =>
      resolveTestDatabaseUrl('postgres://f:f@elsewhere:5432/o2o_test?host=127.0.0.1', devNamedTest),
    ).toThrow(/개발 DB와 같은 대상/);
  });

  it('중복 port·host는 pg처럼 마지막 값, 0을 붙인 port는 정수로 읽어 막는다', () => {
    const devNamedTest = devTargetsOf({ DATABASE_URL: 'postgres://a:b@localhost:5432/o2o_test' });

    for (const url of [
      'postgres://f:f@localhost:5433/o2o_test?port=5433&port=5432',
      'postgres://f:f@localhost:5433/o2o_test?port=05432',
      'postgres://f:f@elsewhere/o2o_test?host=elsewhere&host=localhost',
    ]) {
      expect(() => resolveTestDatabaseUrl(url, devNamedTest)).toThrow(/개발 DB와 같은 대상/);
    }
  });

  it('개발 DB 주소의 쿼리 host·port도 같은 규칙으로 읽는다', () => {
    expect(targetOf('postgres://a@other:6000/db_test?host=localhost&port=5432')).toEqual(
      targetOf('postgres://b@127.0.0.1:5432/db_test'),
    );
  });

  it('포트가 없으면 pg처럼 PGPORT 기본값을 쓴다', () => {
    vi.stubEnv('PGPORT', '6000');
    try {
      expect(targetOf('postgres://a@localhost/db_test')).toEqual(
        targetOf('postgres://a@localhost:6000/db_test'),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('localhost·127.0.0.1과 기본 포트를 같은 대상으로 본다', () => {
    expect(targetOf('postgres://a@127.0.0.1/db_test')).toEqual(
      targetOf('postgres://b@localhost:5432/db_test'),
    );
  });
});
