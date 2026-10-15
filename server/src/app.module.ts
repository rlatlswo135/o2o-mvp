import { Logger, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { ORPCModule } from '@orpc/nest';
import { COMMON_ERROR_STATUS_MAP, DEFAULT_ERROR_STATUS, onError, ORPCError } from '@orpc/server';
import { drizzle } from 'drizzle-orm/node-postgres';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CustomersModule } from './customers/customers.module.js';

const orpcLogger = new Logger('ORPC');

/** 응답 상태 코드를 OpenAPI 핸들러와 같은 방식으로 구한다. code로 찾고, 없으면 500이다. */
function toResponseStatus(error: unknown): number {
  if (!(error instanceof ORPCError)) return DEFAULT_ERROR_STATUS;
  const statusMap: Record<string, number> = COMMON_ERROR_STATUS_MAP;
  return Object.hasOwn(statusMap, error.code) ? statusMap[error.code] : DEFAULT_ERROR_STATUS;
}

@Module({
  imports: [
    DrizzleModule.forRoot({
      drizzle,
      connection: process.env.DATABASE_URL!,
    }),
    ORPCModule.forRoot({
      interceptors: [
        onError((error) => {
          // @orpc/nest는 오류를 HttpException으로 감싸서 Nest가 로그를 남기지 않는다. 여기서 직접 남긴다.
          // 4xx는 계약에 정의된 응답이라 건너뛴다. 출력 검증 실패도 ORPCError(500)라서 클래스가 아니라 상태로 거른다.
          if (toResponseStatus(error) < 500) return;
          orpcLogger.error(error);
        }),
      ],
    }),
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
