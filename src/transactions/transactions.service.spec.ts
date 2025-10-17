import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { UserBalance } from '../users/entities/user-balance.entity';
import { FraudService } from '../frauds/frauds.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

jest.mock('../common/utils/money.util', () => ({
  assertAmountFormat: jest.fn(),
  amountStringToCents: jest.fn(),
}));
import * as moneyUtil from '../common/utils/money.util';

describe('TransactionsService', () => {
  let service: TransactionsService;

  let txRepo: jest.Mocked<Repository<Transaction>>;
  let balRepo: jest.Mocked<Repository<UserBalance>>;
  let dataSource: jest.Mocked<DataSource>;
  let fraudService: jest.Mocked<FraudService>;

  let manager: jest.Mocked<EntityManager>;
  let queryRunner: jest.Mocked<QueryRunner>;

  let loggerErrorSpy: jest.SpyInstance;

  let cqSpy: jest.SpyInstance<
    ReturnType<DataSource['createQueryRunner']>,
    Parameters<DataSource['createQueryRunner']>
  >;

  let connectSpy: jest.SpyInstance<
    ReturnType<QueryRunner['connect']>,
    Parameters<QueryRunner['connect']>
  >;
  let startTxSpy: jest.SpyInstance<
    ReturnType<QueryRunner['startTransaction']>,
    Parameters<QueryRunner['startTransaction']>
  >;
  let commitSpy: jest.SpyInstance<
    ReturnType<QueryRunner['commitTransaction']>,
    Parameters<QueryRunner['commitTransaction']>
  >;
  let rollbackSpy: jest.SpyInstance<
    ReturnType<QueryRunner['rollbackTransaction']>,
    Parameters<QueryRunner['rollbackTransaction']>
  >;
  let releaseSpy: jest.SpyInstance<
    ReturnType<QueryRunner['release']>,
    Parameters<QueryRunner['release']>
  >;
  let checkFraudSpy: jest.SpyInstance<
    ReturnType<FraudService['checkAndFlagIfSuspicious']>,
    Parameters<FraudService['checkAndFlagIfSuspicious']>
  >;
  let findOneSpy: jest.SpyInstance<
    ReturnType<EntityManager['findOne']>,
    Parameters<EntityManager['findOne']>
  >;
  let findOneOrFailSpy: jest.SpyInstance<
    ReturnType<EntityManager['findOneOrFail']>,
    Parameters<EntityManager['findOneOrFail']>
  >;
  let createSpy: jest.SpyInstance<unknown, unknown[]>;
  let saveSpy: jest.SpyInstance<
    ReturnType<EntityManager['save']>,
    Parameters<EntityManager['save']>
  >;

  beforeEach(async () => {
    manager = createMock<EntityManager>({
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    });

    queryRunner = createMock<QueryRunner>({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    });

    dataSource = createMock<DataSource>({
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    });

    fraudService = createMock<FraudService>({
      checkAndFlagIfSuspicious: jest.fn(),
    });

    cqSpy = jest.spyOn(dataSource, 'createQueryRunner');
    connectSpy = jest.spyOn(queryRunner, 'connect');
    startTxSpy = jest.spyOn(queryRunner, 'startTransaction');
    commitSpy = jest.spyOn(queryRunner, 'commitTransaction');
    rollbackSpy = jest.spyOn(queryRunner, 'rollbackTransaction');
    releaseSpy = jest.spyOn(queryRunner, 'release');
    checkFraudSpy = jest.spyOn(fraudService, 'checkAndFlagIfSuspicious');
    findOneSpy = jest.spyOn(manager, 'findOne');
    findOneOrFailSpy = jest.spyOn(manager, 'findOneOrFail');
    createSpy = jest.spyOn(manager, 'create') as unknown as jest.SpyInstance<
      unknown,
      unknown[]
    >;
    saveSpy = jest.spyOn(manager, 'save');

    txRepo = createMock<Repository<Transaction>>({
      createQueryBuilder: jest.fn(),
    });

    balRepo = createMock<Repository<UserBalance>>({
      findOne: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(UserBalance), useValue: balRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: FraudService, useValue: fraudService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const dto = (
    over: Partial<CreateTransactionDto> = {},
  ): CreateTransactionDto => ({
    transactionId: 'tx-1',
    userId: 'user-1',
    amount: '12.34',
    type: TransactionType.DEPOSIT,
    ...over,
  });

  const tx = (over: Partial<Transaction> = {}): Transaction =>
    ({
      id: 'id-1',
      transactionId: 'tx-1',
      userId: 'user-1',
      amountCents: 1234,
      type: TransactionType.DEPOSIT,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...over,
    }) as Transaction;

  const bal = (over: Partial<UserBalance> = {}): UserBalance =>
    ({
      id: 'bal-1',
      userId: 'user-1',
      balanceCents: 0,
      ...over,
    }) as UserBalance;

  describe('process', () => {
    beforeEach(() => {
      (moneyUtil.assertAmountFormat as jest.Mock).mockImplementation(() => {});
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(1234);
      fraudService.checkAndFlagIfSuspicious.mockResolvedValue(false);
    });

    it('retorna transacción existente sin crear nueva, comitea y no ejecuta fraude', async () => {
      findOneSpy.mockResolvedValueOnce(tx());
      findOneOrFailSpy.mockResolvedValueOnce(bal({ balanceCents: 555 }));

      const result = await service.process(dto());

      expect(cqSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(startTxSpy).toHaveBeenCalledWith('SERIALIZABLE');
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledTimes(1);

      expect(result.transaction).toMatchObject({ transactionId: 'tx-1' });
      expect(result.balanceCents).toBe(555);
      expect(checkFraudSpy).not.toHaveBeenCalled();
      expect(findOneOrFailSpy).toHaveBeenCalledWith(UserBalance, {
        where: { userId: 'user-1' },
      });
    });

    it('crea balance si no existe y hace depósito, retorna flagged=false', async () => {
      (moneyUtil.assertAmountFormat as jest.Mock).mockImplementation(() => {});
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(1234);

      findOneSpy
        .mockResolvedValueOnce(null as unknown as Transaction)
        .mockResolvedValueOnce(null as unknown as UserBalance)
        .mockResolvedValueOnce(bal({ balanceCents: 0 }));

      createSpy
        .mockReturnValueOnce(bal({ userId: 'user-1', balanceCents: 0 }))
        .mockReturnValueOnce(tx({ amountCents: 1234 }));

      saveSpy
        .mockResolvedValueOnce(bal({ balanceCents: 0 }))
        .mockResolvedValueOnce(tx({ amountCents: 1234 }))
        .mockResolvedValueOnce(bal({ balanceCents: 1234 }));

      checkFraudSpy.mockResolvedValue(false);

      const result = await service.process(dto());

      expect(startTxSpy).toHaveBeenCalledWith('SERIALIZABLE');
      expect(findOneSpy).toHaveBeenNthCalledWith(
        3,
        UserBalance,
        expect.objectContaining({
          where: { userId: 'user-1' },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(result.balanceCents).toBe(1234);
      expect(result.transaction.amountCents).toBe(1234);
      expect(checkFraudSpy).toHaveBeenCalledTimes(1);
      expect(result.flagged).toBe(false);
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });

    it('lanza BadRequestException("insufficient_funds") en retiro con fondos insuficientes y hace rollback', async () => {
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(200);
      const d = dto({ type: TransactionType.WITHDRAW, amount: '2.00' });

      findOneSpy
        .mockResolvedValueOnce(null as unknown as Transaction)
        .mockResolvedValueOnce(bal({ balanceCents: 100 }));

      await service.process(d).catch((e: unknown) => {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toBe('insufficient_funds');
      });

      expect(rollbackSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).not.toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(checkFraudSpy).not.toHaveBeenCalled();
    });

    it('procede retiro con fondos suficientes y retorna flagged=true', async () => {
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(200);
      checkFraudSpy.mockResolvedValue(true);
      const d = dto({ type: TransactionType.WITHDRAW, amount: '2.00' });
      findOneSpy
        .mockResolvedValueOnce(null as unknown as Transaction)
        .mockResolvedValueOnce(bal({ balanceCents: 500 }));
      (
        createSpy as jest.SpyInstance<Transaction, unknown[]>
      ).mockReturnValueOnce(
        tx({ amountCents: 200, type: TransactionType.WITHDRAW }),
      );
      (saveSpy as jest.SpyInstance<Promise<unknown>, unknown[]>)
        .mockResolvedValueOnce(
          tx({ amountCents: 200, type: TransactionType.WITHDRAW }),
        )
        .mockResolvedValueOnce(bal({ balanceCents: 300 }));

      const result = await service.process(d);

      expect(startTxSpy).toHaveBeenCalledWith('SERIALIZABLE');
      expect(result.balanceCents).toBe(300);
      expect(result.flagged).toBe(true);

      expect(checkFraudSpy).toHaveBeenCalledTimes(1);
      expect(checkFraudSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 200,
          type: TransactionType.WITHDRAW,
        }),
      );

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(rollbackSpy).not.toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });

    it('envuelve errores genéricos en BadRequestException y loguea el error', async () => {
      (moneyUtil.assertAmountFormat as jest.Mock).mockImplementation(() => {});
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(1234);
      findOneSpy
        .mockResolvedValueOnce(null as unknown as Transaction)
        .mockResolvedValueOnce(bal({ balanceCents: 0 }));
      (
        createSpy as jest.SpyInstance<Transaction, unknown[]>
      ).mockReturnValueOnce(tx());

      (
        saveSpy as jest.SpyInstance<Promise<unknown>, unknown[]>
      ).mockRejectedValueOnce(new Error('db down'));

      await service.process(dto()).catch((e: unknown) => {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(String((e as BadRequestException).message)).toMatch(/db down/);
      });

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'TX error',
        expect.stringContaining('db down'),
      );
      expect(rollbackSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).not.toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalledTimes(1);

      expect(checkFraudSpy).not.toHaveBeenCalled();
    });

    it('ConflictException se re-lanza y luego se envuelve por el catch externo en BadRequestException', async () => {
      (moneyUtil.assertAmountFormat as jest.Mock).mockImplementation(() => {});
      (moneyUtil.amountStringToCents as jest.Mock).mockReturnValue(1234);

      findOneSpy
        .mockResolvedValueOnce(null as unknown as Transaction)
        .mockResolvedValueOnce(bal({ balanceCents: 0 }));

      (
        createSpy as jest.SpyInstance<Transaction, unknown[]>
      ).mockReturnValueOnce(tx());

      (
        saveSpy as jest.SpyInstance<Promise<unknown>, unknown[]>
      ).mockRejectedValueOnce(new ConflictException('duplicate_tx'));

      const p = service.process(dto());

      await expect(p).rejects.toThrow(BadRequestException);
      await expect(p).rejects.toThrow(/duplicate_tx/);

      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(startTxSpy).toHaveBeenCalledWith('SERIALIZABLE');
      expect(rollbackSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).not.toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(checkFraudSpy).not.toHaveBeenCalled();
    });

    it('propaga BadRequestException de assertAmountFormat sin envolver', async () => {
      (moneyUtil.assertAmountFormat as jest.Mock).mockImplementation(() => {
        throw new BadRequestException('bad_format');
      });
      await expect(service.process(dto())).rejects.toThrow(/bad_format/);
      await expect(service.process(dto())).rejects.toThrow(BadRequestException);
      expect(cqSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      expect(startTxSpy).not.toHaveBeenCalled();
      expect(commitSpy).not.toHaveBeenCalled();
      expect(rollbackSpy).not.toHaveBeenCalled();
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('getUserTransactions', () => {
    const makeQb = (list: Transaction[]) => {
      const whereMock = jest.fn();
      const orderByMock = jest.fn();
      const limitMock = jest.fn();
      const andWhereMock = jest.fn();
      const getManyMock = jest.fn().mockResolvedValue(list);

      const qb: Partial<SelectQueryBuilder<Transaction>> = {};
      whereMock.mockReturnValue(qb);
      orderByMock.mockReturnValue(qb);
      limitMock.mockReturnValue(qb);
      andWhereMock.mockReturnValue(qb);

      Object.assign(qb, {
        where: whereMock,
        orderBy: orderByMock,
        limit: limitMock,
        andWhere: andWhereMock,
        getMany: getManyMock,
      });

      return {
        qb: qb as SelectQueryBuilder<Transaction>,
        whereMock,
        orderByMock,
        limitMock,
        andWhereMock,
        getManyMock,
      };
    };

    it('retorna lista ordenada DESC y respeta limit por defecto', async () => {
      const list: Transaction[] = [
        tx({ transactionId: 'A' }),
        tx({ transactionId: 'B' }),
      ];
      const { qb, whereMock, orderByMock, limitMock, getManyMock } =
        makeQb(list);

      const createQbSpy = jest
        .spyOn(txRepo, 'createQueryBuilder')
        .mockReturnValue(qb);

      const res = await service.getUserTransactions('user-1');

      expect(createQbSpy).toHaveBeenCalledTimes(1);
      expect(whereMock).toHaveBeenCalledWith('t.userId = :userId', {
        userId: 'user-1',
      });
      expect(orderByMock).toHaveBeenCalledWith('t.createdAt', 'DESC');
      expect(limitMock).toHaveBeenCalledWith(50);
      expect(getManyMock).toHaveBeenCalledTimes(1);
      expect(res).toHaveLength(2);
    });

    it('aplica filtro "before" y limita a 200 cuando se solicita >200', async () => {
      const list: Transaction[] = [tx({ transactionId: 'C' })];
      const {
        qb,
        whereMock,
        orderByMock,
        limitMock,
        andWhereMock,
        getManyMock,
      } = makeQb(list);

      const createQbSpy = jest
        .spyOn(txRepo, 'createQueryBuilder')
        .mockReturnValue(qb);

      const res = await service.getUserTransactions(
        'user-1',
        1000,
        '2025-01-05T00:00:00Z',
      );

      expect(createQbSpy).toHaveBeenCalledTimes(1);
      expect(whereMock).toHaveBeenCalledWith('t.userId = :userId', {
        userId: 'user-1',
      });
      expect(orderByMock).toHaveBeenCalledWith('t.createdAt', 'DESC');
      expect(limitMock).toHaveBeenCalledWith(200);
      expect(andWhereMock).toHaveBeenCalledWith('t.createdAt < :before', {
        before: '2025-01-05T00:00:00Z',
      });
      expect(getManyMock).toHaveBeenCalledTimes(1);
      expect(res).toHaveLength(1);
    });
  });

  describe('getUserBalance', () => {
    it('retorna balance cuando existe', async () => {
      balRepo.findOne.mockResolvedValueOnce(bal({ balanceCents: 789 }));
      const cents = await service.getUserBalance('user-1');
      expect(cents).toBe(789);
    });

    it('retorna 0 cuando no hay registro', async () => {
      balRepo.findOne.mockResolvedValueOnce(null as unknown as UserBalance);
      const cents = await service.getUserBalance('user-1');
      expect(cents).toBe(0);
    });
  });
});
