import type { Reservation, Treatment } from '@o2o/shared/contracts';

import { customers } from '@db/schemas/customers.schema.js';
import { reservations, reservationTreatments } from '@db/schemas/reservations.schema.js';
import { treatments } from '@db/schemas/treatments.schema.js';
import { INestApplication } from '@nestjs/common';
import { startAtOf } from '@o2o/shared/contracts';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { ReservationsRepository } from '../src/reservations/reservations.repository.js';
import { prepareTestDatabase, startApp } from './test-app.js';

// 실제 HTTP 계약 → controller → service → repository → PostgreSQL(테스트 전용 DB) 경로를 돈다.
// 테스트가 만든 행만 기억했다가 지운다.

let app: INestApplication<App>;
let db: ReturnType<typeof drizzle>;
const made = {
  customers: [] as number[],
  treatments: [] as number[],
  reservations: [] as number[],
};

// 다른 테스트 데이터와 섞이지 않게 먼 날짜를 쓴다
const day = '2031-03-14';
const nextDay = '2031-03-15';
const at = (date: string, time: string) => {
  const ms = startAtOf(date, time);
  if (ms === null) throw new Error(`${date} ${time}`);
  return ms;
};

const http = () => request(app.getHttpServer());

async function newCustomer(name = '김서연') {
  const phone = `010${String(Date.now() % 1e8).padStart(8, '0')}${made.customers.length}`.slice(
    0,
    15,
  );
  const response = await http().post('/customers').send({ name, phone }).expect(201);
  made.customers.push(response.body.id);
  return response.body as { id: number; name: string; phone: string };
}

async function newTreatment(name: string, duration: number, price = 10000) {
  const response = await http().post('/treatments').send({ name, duration, price }).expect(201);
  made.treatments.push(response.body.id);
  return response.body as Treatment;
}

async function reserve(body: { customerId: number; treatmentIds: number[]; startAt: number }) {
  const response = await http().post('/reservations').send(body);
  if (response.status === 201) made.reservations.push(response.body.id);
  return response;
}

async function listOn(date: string, includeCancelled?: 'true' | 'false') {
  const response = await http()
    .get('/reservations')
    .query(includeCancelled ? { date, includeCancelled } : { date })
    .expect(200);
  return (response.body as Reservation[]).filter((row) => made.reservations.includes(row.id));
}

beforeAll(async () => {
  const url = await prepareTestDatabase();
  db = drizzle(url);
  app = await startApp();
});

afterAll(async () => {
  await app?.close();
  if (!db) return;
  if (made.reservations.length > 0) {
    await db.delete(reservations).where(inArray(reservations.id, made.reservations));
  }
  if (made.treatments.length > 0) {
    await db.delete(treatments).where(inArray(treatments.id, made.treatments));
  }
  if (made.customers.length > 0) {
    await db.delete(customers).where(inArray(customers.id, made.customers));
  }
  await db.$client.end();
});

describe('시술 등록·조회', () => {
  it('안전 정수 상한의 분·원을 그대로 저장하고 다시 조회해도 같은 값이다', async () => {
    const max = Number.MAX_SAFE_INTEGER;
    const treatment = await newTreatment('  아주 긴 시술 ', max, max);

    expect(treatment).toMatchObject({ name: '아주 긴 시술', duration: max, price: max });
    const list = await http().get('/treatments').expect(200);
    expect(list.body.find((row: Treatment) => row.id === treatment.id)).toEqual(treatment);
  });

  it('최근 등록이 앞이고, 0원 시술도 등록한다', async () => {
    const first = await newTreatment('젤 제거', 30, 0);
    const second = await newTreatment('손 케어', 40, 20000);

    const list = await http().get('/treatments').expect(200);
    const ids = (list.body as Treatment[]).map((row) => row.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it.each([
    { case: '소요시간 0', body: { name: '젤', duration: 0, price: 0 } },
    {
      case: '소요시간 상한 초과',
      body: { name: '젤', duration: Number.MAX_SAFE_INTEGER + 1, price: 0 },
    },
    { case: '가격 음수', body: { name: '젤', duration: 30, price: -1 } },
    { case: '가격 소수', body: { name: '젤', duration: 30, price: 10.5 } },
    { case: '빈 이름', body: { name: '  ', duration: 30, price: 0 } },
  ])('$case → 400, 저장하지 않는다', async ({ body }) => {
    const before = await http().get('/treatments').expect(200);
    await http().post('/treatments').send(body).expect(400);
    const after = await http().get('/treatments').expect(200);
    expect(after.body).toHaveLength(before.body.length);
  });
});

describe('예약 등록·조회', () => {
  it('30분+60분을 23:30에 등록하면 총 90분, 다음 날 01:00 종료가 응답·DB·재조회에서 같다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤네일 기본', 30);
    const lash = await newTreatment('속눈썹 연장', 60);
    const startAt = at(day, '23:30');

    const response = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id, lash.id],
      startAt,
    });

    expect(response.status).toBe(201);
    const expected = {
      id: response.body.id,
      customer,
      treatments: [
        { id: gel.id, name: '젤네일 기본', duration: 30 },
        { id: lash.id, name: '속눈썹 연장', duration: 60 },
      ],
      startAt,
      endAt: at(nextDay, '01:00'),
      cancelledAt: null,
      cancelReason: null,
    };
    expect(response.body).toEqual(expected);

    const [row] = await db.select().from(reservations).where(eq(reservations.id, response.body.id));
    expect(row?.endAt.getTime()).toBe(at(nextDay, '01:00'));
    const items = await db
      .select()
      .from(reservationTreatments)
      .where(eq(reservationTreatments.reservationId, response.body.id))
      .orderBy(reservationTreatments.position);
    expect(items.map((item) => [item.treatmentId, item.duration])).toEqual([
      [gel.id, 30],
      [lash.id, 60],
    ]);

    // 시작 날짜에만 나오고, 종료만 걸친 다음 날에는 나오지 않는다
    expect(await listOn(day)).toContainEqual(expected);
    expect((await listOn(nextDay)).some((row) => row.id === expected.id)).toBe(false);
  });

  it('한국 시간 그날 0시 이상 다음 날 0시 미만에 시작한 예약을 시작 시각·id 순으로 준다', async () => {
    const customer = await newCustomer('이지우');
    const gel = await newTreatment('젤 원컬러', 60);
    const late = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '15:00'),
    });
    const early = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '00:00'),
    });
    const sameTime = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '15:00'),
    });
    const previousDay = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at('2031-03-13', '23:59'),
    });

    const ids = (await listOn(day)).map((row) => row.id);
    expect(ids.indexOf(early.body.id)).toBeLessThan(ids.indexOf(late.body.id));
    expect(ids.indexOf(late.body.id)).toBeLessThan(ids.indexOf(sameTime.body.id));
    expect(ids).not.toContain(previousDay.body.id);
  });

  it.each([
    { case: '시술 0개', treatmentIds: () => [], startAt: at(day, '10:00') },
    { case: '같은 시술 두 번', treatmentIds: (id: number) => [id, id], startAt: at(day, '10:00') },
    { case: '시작 +1ms', treatmentIds: (id: number) => [id], startAt: at(day, '10:00') + 1 },
    { case: '시작 +1초', treatmentIds: (id: number) => [id], startAt: at(day, '10:00') + 1000 },
    {
      case: '시작 2100-01-01',
      treatmentIds: (id: number) => [id],
      startAt: at('2099-12-31', '23:59') + 60_000,
    },
    {
      case: '시작 1999-12-31',
      treatmentIds: (id: number) => [id],
      startAt: at('2000-01-01', '00:00') - 60_000,
    },
  ])('$case → 400', async ({ treatmentIds, startAt }) => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);

    const response = await reserve({
      customerId: customer.id,
      treatmentIds: treatmentIds(gel.id),
      startAt,
    });
    expect(response.status).toBe(400);
  });

  it('목록을 읽는 도중 수정이 끝나도 한 예약의 본문·시술을 서로 다른 시점으로 섞지 않는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const lash = await newTreatment('속눈썹', 90);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '05:00'),
    });

    // 시술 스냅샷 테이블을 잠가 목록 조회가 본문을 읽은 뒤 시술 조회에서 멈추게 한다
    const writer = await db.$client.connect();
    try {
      await writer.query('begin');
      await writer.query('lock table reservation_treatments in access exclusive mode');
      const listing = listOn(day);
      await vi.waitFor(
        async () => {
          const { rows } = await db.$client.query(
            `select 1 from pg_locks where not granted and relation = 'reservation_treatments'::regclass`,
          );
          expect(rows.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );
      await writer.query(
        `update reservations set "endAt" = "endAt" + interval '60 minutes' where id = $1`,
        [created.body.id],
      );
      await writer.query(`delete from reservation_treatments where "reservationId" = $1`, [
        created.body.id,
      ]);
      await writer.query(
        `insert into reservation_treatments ("reservationId", position, "treatmentId", name, duration)
         values ($1, 0, $2, '속눈썹', 90)`,
        [created.body.id, lash.id],
      );
      await writer.query('commit');

      expect((await listing).find((row) => row.id === created.body.id)).toEqual(created.body);
    } finally {
      await writer.query('rollback').catch(() => {});
      writer.release();
    }

    const after = (await listOn(day)).find((row) => row.id === created.body.id);
    expect(after?.treatments).toEqual([{ id: lash.id, name: '속눈썹', duration: 90 }]);
    expect(after && after.endAt - after.startAt).toBe(90 * 60_000);
  });

  it('시작 날짜 양 끝(2000-01-01 00:00, 2099-12-31 23:59)은 받는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);

    expect(
      (
        await reserve({
          customerId: customer.id,
          treatmentIds: [gel.id],
          startAt: at('2000-01-01', '00:00'),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await reserve({
          customerId: customer.id,
          treatmentIds: [gel.id],
          startAt: at('2099-12-31', '23:59'),
        })
      ).status,
    ).toBe(201);
  });

  it('없는 고객·시술, 계산할 수 없는 종료 일시는 사유와 함께 422로 거부한다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const huge = await newTreatment('아주 긴 시술', Number.MAX_SAFE_INTEGER);
    const startAt = at(day, '10:00');

    const noCustomer = await reserve({
      customerId: 2_147_483_000,
      treatmentIds: [gel.id],
      startAt,
    });
    expect(noCustomer.status).toBe(422);
    expect(noCustomer.body.data).toEqual({ reason: 'customer_not_found' });

    const noTreatment = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id, 2_147_483_000],
      startAt,
    });
    expect(noTreatment.status).toBe(422);
    expect(noTreatment.body.data).toEqual({
      reason: 'treatment_not_found',
      treatmentIds: [2_147_483_000],
    });

    const tooLong = await reserve({ customerId: customer.id, treatmentIds: [huge.id], startAt });
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.data).toEqual({ reason: 'schedule_out_of_range' });
  });

  it('조회 날짜는 2000~2099년만 받고, 취소 포함 "false"는 꺼짐이다', async () => {
    await http().get('/reservations').query({ date: '2100-01-01' }).expect(400);
    await http().get('/reservations').query({ date: '1999-12-31' }).expect(400);
    await http().get('/reservations').query({ date: '2026-02-30' }).expect(400);
    await http()
      .get('/reservations')
      .query({ date: '2000-01-01', includeCancelled: 'false' })
      .expect(200);
    await http()
      .get('/reservations')
      .query({ date: '2099-12-31', includeCancelled: 'true' })
      .expect(200);
  });
});

describe('예약 수정과 스냅샷', () => {
  it('시술 마스터를 바꿔도 저장한 예약은 그대로고, 시간만 바꾸면 기존 스냅샷을 쓴다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤네일 기본', 30);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '10:00'),
    });

    await db
      .update(treatments)
      .set({ name: '젤네일 리뉴얼', duration: 45 })
      .where(eq(treatments.id, gel.id));
    expect((await listOn(day)).find((row) => row.id === created.body.id)?.treatments).toEqual([
      { id: gel.id, name: '젤네일 기본', duration: 30 },
    ]);

    const moved = await http()
      .put(`/reservations/${created.body.id}`)
      .send({ customerId: customer.id, treatmentIds: [gel.id], startAt: at(nextDay, '11:00') })
      .expect(200);
    expect(moved.body).toMatchObject({
      treatments: [{ id: gel.id, name: '젤네일 기본', duration: 30 }],
      startAt: at(nextDay, '11:00'),
      endAt: at(nextDay, '11:30'),
    });
    expect((await listOn(day)).some((row) => row.id === created.body.id)).toBe(false);
    expect((await listOn(nextDay)).find((row) => row.id === created.body.id)).toEqual(moved.body);
  });

  it('시술을 추가하면 기존 것은 예약 당시 값, 추가분만 지금 값으로 합산한다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤네일 기본', 30);
    const lash = await newTreatment('속눈썹 연장', 60);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '23:30'),
    });
    await db.update(treatments).set({ duration: 45 }).where(eq(treatments.id, gel.id));

    const updated = await http()
      .put(`/reservations/${created.body.id}`)
      .send({ customerId: customer.id, treatmentIds: [gel.id, lash.id], startAt: at(day, '23:30') })
      .expect(200);

    expect(updated.body.treatments).toEqual([
      { id: gel.id, name: '젤네일 기본', duration: 30 },
      { id: lash.id, name: '속눈썹 연장', duration: 60 },
    ]);
    expect(updated.body.endAt).toBe(at(nextDay, '01:00'));
  });

  it('지운 시술·고객도 과거 예약에 남고 그대로 유지해 수정할 수 있지만 새로 고를 수는 없다', async () => {
    const customer = await newCustomer('김지은');
    const gel = await newTreatment('삭제될 시술', 30);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '13:00'),
    });

    await db.delete(treatments).where(eq(treatments.id, gel.id));
    await http().delete(`/customers/${customer.id}`).expect(204);

    const kept = (await listOn(day)).find((row) => row.id === created.body.id);
    expect(kept).toMatchObject({
      customer,
      treatments: [{ id: gel.id, name: '삭제될 시술', duration: 30 }],
    });

    await http()
      .put(`/reservations/${created.body.id}`)
      .send({ customerId: customer.id, treatmentIds: [gel.id], startAt: at(day, '14:00') })
      .expect(200);

    const other = await newCustomer();
    const reNew = await reserve({
      customerId: other.id,
      treatmentIds: [gel.id],
      startAt: at(day, '14:00'),
    });
    expect(reNew.status).toBe(422);
    expect(reNew.body.data).toEqual({ reason: 'treatment_not_found', treatmentIds: [gel.id] });

    const anotherGel = await newTreatment('젤', 30);
    const reCustomer = await reserve({
      customerId: customer.id,
      treatmentIds: [anotherGel.id],
      startAt: at(day, '14:00'),
    });
    expect(reCustomer.status).toBe(422);
    expect(reCustomer.body.data).toEqual({ reason: 'customer_not_found' });
  });

  it('없는 예약은 404로 알린다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    await http()
      .put('/reservations/2147483000')
      .send({ customerId: customer.id, treatmentIds: [gel.id], startAt: at(day, '10:00') })
      .expect(404);
    await http().post('/reservations/2147483000/cancel').send({ reason: null }).expect(404);
  });

  it('트랜잭션이 실패하면 예약 본문·시술 스냅샷을 일부만 바꾸지 않는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const lash = await newTreatment('속눈썹', 60);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '16:00'),
    });
    const repository = app.get(ReservationsRepository);

    await expect(
      repository.transaction(async (tx) => {
        await repository.replace(tx, created.body.id, {
          customer,
          treatments: [{ id: lash.id, name: '속눈썹', duration: 60 }],
          startAt: at(day, '17:00'),
          endAt: at(day, '18:00'),
        });
        throw new Error('저장 도중 실패');
      }),
    ).rejects.toThrow('저장 도중 실패');

    expect((await listOn(day)).find((row) => row.id === created.body.id)).toEqual(created.body);
  });
});

describe('예약 취소', () => {
  it('원본·복수 시술을 남기고 기본 목록에서만 빼며, 취소 포함에서 최초 취소 시각·사유를 본다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const lash = await newTreatment('속눈썹', 60);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id, lash.id],
      startAt: at(day, '18:00'),
    });

    const before = Date.now();
    const cancelled = await http()
      .post(`/reservations/${created.body.id}/cancel`)
      .send({ reason: '  고객 요청 ' })
      .expect(200);

    expect(cancelled.body).toMatchObject({
      ...created.body,
      cancelledAt: expect.any(Number),
      cancelReason: '고객 요청',
    });
    expect(cancelled.body.cancelledAt).toBeGreaterThanOrEqual(before - 1000);
    expect((await listOn(day)).some((row) => row.id === created.body.id)).toBe(false);
    expect((await listOn(day, 'true')).find((row) => row.id === created.body.id)).toEqual(
      cancelled.body,
    );
    expect((await listOn(day, 'false')).some((row) => row.id === created.body.id)).toBe(false);

    // 다시 취소·수정하면 409와 함께 처음 취소한 기록이 담긴 예약을 준다
    const again = await http()
      .post(`/reservations/${created.body.id}/cancel`)
      .send({ reason: '다른 사유' })
      .expect(409);
    expect(again.body.data).toEqual({ reservation: cancelled.body });
    const edit = await http()
      .put(`/reservations/${created.body.id}`)
      .send({ customerId: customer.id, treatmentIds: [gel.id], startAt: at(day, '19:00') })
      .expect(409);
    expect(edit.body.data).toEqual({ reservation: cancelled.body });
    expect((await listOn(day, 'true')).find((row) => row.id === created.body.id)).toEqual(
      cancelled.body,
    );
  });

  it('동시에 두 번 취소해도 하나만 기록되고 다른 하나는 최초 기록을 받는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '20:00'),
    });

    const [a, b] = await Promise.all([
      http().post(`/reservations/${created.body.id}/cancel`).send({ reason: '첫 번째' }),
      http().post(`/reservations/${created.body.id}/cancel`).send({ reason: '두 번째' }),
    ]);

    const statuses = [a.status, b.status].toSorted((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
    const winner = a.status === 200 ? a.body : b.body;
    const loser = a.status === 409 ? a.body : b.body;
    expect(loser.data.reservation).toEqual(winner);
    expect((await listOn(day, 'true')).find((row) => row.id === created.body.id)).toEqual(winner);
  });

  it('수정과 취소가 겹쳐도 취소된 예약을 되살리지 않는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('젤', 30);
    const lash = await newTreatment('속눈썹', 60);
    const created = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '21:00'),
    });

    const [edit, cancel] = await Promise.all([
      http()
        .put(`/reservations/${created.body.id}`)
        .send({
          customerId: customer.id,
          treatmentIds: [gel.id, lash.id],
          startAt: at(day, '21:00'),
        }),
      http().post(`/reservations/${created.body.id}/cancel`).send({ reason: null }),
    ]);

    expect(cancel.status).toBe(200);
    expect([200, 409]).toContain(edit.status);
    const stored = (await listOn(day, 'true')).find((row) => row.id === created.body.id);
    expect(stored?.cancelledAt).toBe(cancel.body.cancelledAt);
    expect(stored).toEqual(cancel.body);
    expect((await listOn(day)).some((row) => row.id === created.body.id)).toBe(false);
  });
});

describe('서버 재시작', () => {
  it('앱을 닫고 다시 띄워도 시술·예약·취소 기록이 남는다', async () => {
    const customer = await newCustomer();
    const gel = await newTreatment('재시작 확인 시술', 30);
    const lash = await newTreatment('재시작 확인 시술 2', 60);
    const kept = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id, lash.id],
      startAt: at(day, '22:00'),
    });
    const gone = await reserve({
      customerId: customer.id,
      treatmentIds: [gel.id],
      startAt: at(day, '22:30'),
    });
    const cancelled = await http()
      .post(`/reservations/${gone.body.id}/cancel`)
      .send({ reason: '재시작 전 취소' })
      .expect(200);

    await app.close();
    app = await startApp();

    const treatmentList = (await http().get('/treatments').expect(200)).body as Treatment[];
    expect(treatmentList).toContainEqual(gel);
    const rows = await listOn(day, 'true');
    expect(rows.find((row) => row.id === kept.body.id)).toEqual(kept.body);
    expect(rows.find((row) => row.id === gone.body.id)).toEqual(cancelled.body);
  });
});

describe('고객 회귀', () => {
  it('등록·조회·수정·삭제가 그대로 동작한다', async () => {
    const customer = await newCustomer('회귀 확인');
    const list = await http().get('/customers').expect(200);
    expect(list.body).toContainEqual(customer);

    const updated = await http()
      .put(`/customers/${customer.id}`)
      .send({ name: '회귀 확인 수정', phone: customer.phone })
      .expect(200);
    expect(updated.body).toEqual({ ...customer, name: '회귀 확인 수정' });
    await http().post('/customers').send({ name: '중복', phone: customer.phone }).expect(409);
    await http().delete(`/customers/${customer.id}`).expect(204);
    await http().get(`/customers/${customer.id}`).expect(404);
  });
});
