import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { PostgresError } from 'pg-error-enum';

// drizzle은 pg 오류를 DrizzleQueryError로 감싸고 원본(DatabaseError)은 cause에 둔다.
function isPostgresError(error: unknown, code: PostgresError) {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof DatabaseError &&
    error.cause.code === code
  );
}

/** 유니크 제약이 걸린 컬럼에 이미 있는 값을 또 저장하려 할 때. */
export const isUniqueViolation = (error: unknown) =>
  isPostgresError(error, PostgresError.UNIQUE_VIOLATION);
