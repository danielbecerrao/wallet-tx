import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';

import { FraudService } from './frauds.service';
import { FraudAlert } from './entities/fraud-alert.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

describe('FraudService', () => {
  let service: FraudService;

  let alertRepo: jest.Mocked<Repository<FraudAlert>>;
  let txRepo: jest.Mocked<Repository<Transaction>>;

  let countSpy: jest.SpyInstance<
    ReturnType<Repository<Transaction>['count']>,
    Parameters<Repository<Transaction>['count']>
  >;
  let findSpy: jest.SpyInstance<
    ReturnType<Repository<Transaction>['find']>,
    Parameters<Repository<Transaction>['find']>
  >;
  let alertCreateSpy: jest.SpyInstance<
    ReturnType<Repository<FraudAlert>['create']>,
    Parameters<Repository<FraudAlert>['create']>
  >;
  let alertSaveSpy: jest.SpyInstance<
    ReturnType<Repository<FraudAlert>['save']>,
    Parameters<Repository<FraudAlert>['save']>
  >;
  let warnSpy: jest.SpyInstance<
    ReturnType<Logger['warn']>,
    Parameters<Logger['warn']>
  >;

  const tx = (over: Partial<Transaction> = {}): Transaction =>
    ({
      transactionId: 'tx-1',
      userId: 'user-1',
      amountCents: 10_000,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...over,
    }) as Transaction;

  const alert = (over: Partial<FraudAlert> = {}): FraudAlert =>
    ({
      id: 'a1',
      userId: 'user-1',
      transactionId: 'tx-1',
      reason: 'x',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...over,
    }) as FraudAlert;

  const REAL_ENV = process.env;
  const FIXED_NOW = new Date('2025-01-01T12:00:00Z').getTime();

  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterAll(() => {
    (Date.now as unknown as jest.SpyInstance<number, []>).mockRestore();
  });

  beforeEach(async () => {
    process.env = { ...REAL_ENV };
    alertRepo = createMock<Repository<FraudAlert>>({
      create: jest.fn(),
      save: jest.fn(),
    });
    txRepo = createMock<Repository<Transaction>>({
      count: jest.fn(),
      find: jest.fn(),
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: getRepositoryToken(FraudAlert), useValue: alertRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
      ],
    }).compile();

    service = moduleRef.get(FraudService);

    countSpy = jest.spyOn(txRepo, 'count');
    findSpy = jest.spyOn(txRepo, 'find');
    alertCreateSpy = jest.spyOn(alertRepo, 'create');
    alertSaveSpy = jest.spyOn(alertRepo, 'save');
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env = REAL_ENV;
  });

  it('retorna false si hay < 3 transacciones de alto valor en la ventana (defaults env), sin crear alerta ni loguear', async () => {
    const high = 100_00;
    countSpy.mockResolvedValueOnce(2);
    findSpy.mockResolvedValueOnce([
      tx({ amountCents: high }),
      tx({ amountCents: high }),
      tx({ amountCents: 5000 }),
      tx({ amountCents: 2000 }),
    ]);
    const suspicious = await service.checkAndFlagIfSuspicious(
      tx({ amountCents: high }),
    );

    expect(suspicious).toBe(false);
    expect(countSpy).toHaveBeenCalledTimes(1);
    type CountArg = NonNullable<
      Parameters<Repository<Transaction>['count']>[0]
    >;
    const [countArg] = countSpy.mock.calls[0] as [CountArg];

    const countWhere = Array.isArray(countArg.where)
      ? countArg.where[0]
      : countArg.where;

    expect(countWhere).toBeDefined();
    expect(countWhere?.userId).toBe('user-1');
    expect(countWhere?.createdAt).toBeDefined();
    expect(countWhere?.amountCents).toBeDefined();

    expect(findSpy).toHaveBeenCalledTimes(1);
    type FindArg = NonNullable<Parameters<Repository<Transaction>['find']>[0]>;
    const [findArg] = findSpy.mock.calls[0] as [FindArg];

    const findWhere = Array.isArray(findArg.where)
      ? findArg.where[0]
      : findArg.where;

    expect(findWhere).toBeDefined();
    expect(findWhere?.userId).toBe('user-1');
    expect(findWhere?.createdAt).toBeDefined();
    expect(findArg.order).toEqual({ createdAt: 'DESC' });
    expect(findArg.take).toBe(10);

    expect(alertCreateSpy).not.toHaveBeenCalled();
    expect(alertSaveSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('retorna true si hay >= 3 transacciones de alto valor (env override), crea alerta y loguea', async () => {
    process.env.FRAUD_HIGH_AMOUNT_CENTS = '5000';
    process.env.FRAUD_WINDOW_MIN = '15';
    const high = 5000;
    countSpy.mockResolvedValueOnce(12);

    findSpy.mockResolvedValueOnce([
      tx({ amountCents: high }),
      tx({ amountCents: high + 1 }),
      tx({ amountCents: high + 500 }),
      tx({ amountCents: 1200 }),
      tx({ amountCents: 4999 }),
    ]);

    alertCreateSpy.mockReturnValueOnce(
      alert({ reason: '>=3 high-value tx within 15 min' }),
    );
    alertSaveSpy.mockResolvedValueOnce(
      alert({ reason: '>=3 high-value tx within 15 min' }),
    );

    const suspicious = await service.checkAndFlagIfSuspicious(
      tx({
        transactionId: 'abc',
        userId: 'user-1',
        amountCents: high,
      }),
    );

    expect(suspicious).toBe(true);

    expect(countSpy).toHaveBeenCalledTimes(1);
    type CountArg = NonNullable<
      Parameters<Repository<Transaction>['count']>[0]
    >;
    const [countArg] = countSpy.mock.calls[0] as [CountArg];

    const countWhere = Array.isArray(countArg.where)
      ? countArg.where[0]
      : countArg.where;

    expect(countWhere).toBeDefined();
    expect(countWhere?.userId).toBe('user-1');
    expect(countWhere?.createdAt).toBeDefined();
    expect(countWhere?.amountCents).toBeDefined();

    expect(findSpy).toHaveBeenCalledTimes(1);
    type FindArg = NonNullable<Parameters<Repository<Transaction>['find']>[0]>;
    const [findArg] = findSpy.mock.calls[0] as [FindArg];

    const findWhere = Array.isArray(findArg.where)
      ? findArg.where[0]
      : findArg.where;

    expect(findWhere).toBeDefined();
    expect(findWhere?.userId).toBe('user-1');
    expect(findWhere?.createdAt).toBeDefined();
    expect(findArg.order).toEqual({ createdAt: 'DESC' });
    expect(findArg.take).toBe(12);

    expect(alertCreateSpy).toHaveBeenCalledTimes(1);
    expect(alertCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        transactionId: 'abc',
        reason: '>=3 high-value tx within 15 min',
      }),
    );

    expect(alertSaveSpy).toHaveBeenCalledTimes(1);
    expect(alertSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: '>=3 high-value tx within 15 min',
      }),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FRAUD ALERT for user user-1'),
    );
  });
});
