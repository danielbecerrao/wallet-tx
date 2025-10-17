import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { createMock } from '@golevelup/ts-jest';
import { Transaction } from './entities/transaction.entity';
import { TransactionType } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionsService>;

  let processSpy: jest.SpyInstance<
    ReturnType<TransactionsService['process']>,
    Parameters<TransactionsService['process']>
  >;
  let getUserTransactionsSpy: jest.SpyInstance<
    ReturnType<TransactionsService['getUserTransactions']>,
    Parameters<TransactionsService['getUserTransactions']>
  >;
  let getUserBalanceSpy: jest.SpyInstance<
    ReturnType<TransactionsService['getUserBalance']>,
    Parameters<TransactionsService['getUserBalance']>
  >;

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

  const dto = (
    over: Partial<CreateTransactionDto> = {},
  ): CreateTransactionDto => ({
    transactionId: 'tx-1',
    userId: 'user-1',
    amount: '12.34',
    type: TransactionType.DEPOSIT,
    ...over,
  });

  beforeEach(async () => {
    const mockService = createMock<TransactionsService>({
      process: jest.fn(),
      getUserTransactions: jest.fn(),
      getUserBalance: jest.fn(),
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: mockService }],
    }).compile();

    controller = moduleRef.get(TransactionsController);
    service = moduleRef.get(TransactionsService);

    processSpy = jest.spyOn(service, 'process');
    getUserTransactionsSpy = jest.spyOn(service, 'getUserTransactions');
    getUserBalanceSpy = jest.spyOn(service, 'getUserBalance');

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /transactions -> create', () => {
    it('mapea la respuesta del servicio a TransactionResponseDto (ISO date) y llama a process con el dto', async () => {
      const created = new Date('2025-01-02T03:04:05.000Z');
      const t = tx({
        transactionId: 'tx-abc',
        userId: 'user-xyz',
        amountCents: 5678,
        type: TransactionType.WITHDRAW,
        createdAt: created,
      });

      processSpy.mockResolvedValueOnce({
        transaction: t,
        balanceCents: 999,
        flagged: true,
      });

      const body = dto({
        transactionId: 'tx-abc',
        userId: 'user-xyz',
        amount: '56.78',
        type: TransactionType.WITHDRAW,
      });

      const res = await controller.create(body);

      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(processSpy).toHaveBeenCalledWith(body);

      expect(res).toEqual({
        transactionId: 'tx-abc',
        userId: 'user-xyz',
        amountCents: 5678,
        type: TransactionType.WITHDRAW,
        balanceCents: 999,
        createdAt: created.toISOString(),
      });
    });
  });

  describe('GET /users/:userId/transactions -> history', () => {
    it('usa limit por defecto (50) y mapea a snake_case', async () => {
      const list: Transaction[] = [
        tx({ transactionId: 'A', createdAt: new Date('2025-01-05T00:00:00Z') }),
        tx({
          transactionId: 'B',
          amountCents: 999,
          createdAt: new Date('2025-01-04T00:00:00Z'),
        }),
      ];

      getUserTransactionsSpy.mockResolvedValueOnce(list);

      const res = await controller.history('user-1');

      expect(getUserTransactionsSpy).toHaveBeenCalledTimes(1);
      expect(getUserTransactionsSpy).toHaveBeenCalledWith(
        'user-1',
        50,
        undefined,
      );

      expect(res).toEqual({
        transactions: [
          {
            transactionId: 'A',
            amountCents: 1234,
            type: TransactionType.DEPOSIT,
            createdAt: '2025-01-05T00:00:00.000Z',
          },
          {
            transactionId: 'B',
            amountCents: 999,
            type: TransactionType.DEPOSIT,
            createdAt: '2025-01-04T00:00:00.000Z',
          },
        ],
      });
    });

    it('parsea limit desde query string y reenvía before', async () => {
      const list: Transaction[] = [
        tx({
          transactionId: 'C',
          amountCents: 1,
          createdAt: new Date('2025-01-03T00:00:00Z'),
        }),
      ];

      getUserTransactionsSpy.mockResolvedValueOnce(list);

      const res = await controller.history(
        'user-9',
        '150',
        '2025-01-02T23:59:59.000Z',
      );

      expect(getUserTransactionsSpy).toHaveBeenCalledTimes(1);
      expect(getUserTransactionsSpy).toHaveBeenCalledWith(
        'user-9',
        150,
        '2025-01-02T23:59:59.000Z',
      );

      expect(res).toEqual({
        transactions: [
          {
            transactionId: 'C',
            amountCents: 1,
            type: TransactionType.DEPOSIT,
            createdAt: '2025-01-03T00:00:00.000Z',
          },
        ],
      });
    });
  });

  describe('GET /users/:userId/balance -> balance', () => {
    it('retorna el balance en snake_case y llama al servicio con el userId', async () => {
      getUserBalanceSpy.mockResolvedValueOnce(777);

      const res = await controller.balance('user-7');

      expect(getUserBalanceSpy).toHaveBeenCalledTimes(1);
      expect(getUserBalanceSpy).toHaveBeenCalledWith('user-7');

      expect(res).toEqual({
        userId: 'user-7',
        balanceCents: 777,
      });
    });
  });
});
