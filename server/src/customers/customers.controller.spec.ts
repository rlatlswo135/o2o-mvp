import type { INestApplication } from '@nestjs/common';

import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { AppModule } from '../app.module.js';
import { CustomersRepository } from './customers.repository.js';

const customer = { id: 1, name: '테스트 고객', phone: '010-0000-0001' };
const repository = {
  findAll: vi.fn<() => Promise<(typeof customer)[]>>(),
  findById: vi.fn<CustomersRepository['findById']>(),
  insert: vi.fn<CustomersRepository['insert']>(),
};

describe('Customers HTTP API', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDrizzleToken())
      .useValue({})
      .overrideProvider(CustomersRepository)
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /customers returns the persisted customer with a numeric ID', async () => {
    repository.insert.mockResolvedValue(customer);

    const response = await request(app.getHttpServer())
      .post('/customers')
      .send({ name: customer.name, phone: customer.phone })
      .expect(201);
    expect(response.body).toEqual(customer);
  });

  it('trims input and strips unknown fields before inserting', async () => {
    repository.insert.mockResolvedValue(customer);

    await request(app.getHttpServer())
      .post('/customers')
      .send({ name: ` ${customer.name} `, phone: ` ${customer.phone} `, id: 99 })
      .expect(201);

    expect(repository.insert).toHaveBeenCalledWith({ name: customer.name, phone: customer.phone });
  });

  it.each([
    {},
    { name: 1, phone: customer.phone },
    { name: '   ', phone: customer.phone },
    { name: customer.name, phone: 123 },
    { name: customer.name, phone: ' - ' },
    { name: customer.name, phone: 'not-a-phone' },
  ])('rejects invalid body %j without inserting', async (body) => {
    await request(app.getHttpServer()).post('/customers').send(body).expect(400);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 for a duplicate phone without exposing DB errors', async () => {
    repository.insert.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/customers')
      .send({ name: customer.name, phone: customer.phone })
      .expect(409);

    expect(response.body.message).toBe('이미 등록된 전화번호예요.');
  });

  it('returns the DB list, including an empty list', async () => {
    repository.findAll.mockResolvedValueOnce([customer]).mockResolvedValueOnce([]);
    const loaded = await request(app.getHttpServer()).get('/customers').expect(200);
    const empty = await request(app.getHttpServer()).get('/customers').expect(200);
    expect(loaded.body).toEqual([customer]);
    expect(empty.body).toEqual([]);
  });

  it('finds a numeric ID and returns 404 for a missing customer', async () => {
    repository.findById.mockResolvedValueOnce(customer).mockResolvedValueOnce(undefined);
    await request(app.getHttpServer()).get('/customers/1').expect(200).expect(customer);
    expect(repository.findById).toHaveBeenCalledWith(1);
    await request(app.getHttpServer()).get('/customers/2').expect(404);
  });

  it.each(['abc', '0', '-1', '1.5', '2147483648'])(
    'rejects invalid ID %s before DB lookup',
    async (id) => {
      await request(app.getHttpServer()).get(`/customers/${id}`).expect(400);
      expect(repository.findById).not.toHaveBeenCalled();
    },
  );
});
