import { INestApplication, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { TransactionsController } from '../src/transactions/transactions.controller';
import { TransactionsService } from '../src/transactions/transactions.service';
import { Transaction } from '../src/transactions/entities/transaction.entity';
import { TransactionType } from '../src/transactions/entities/transaction.entity';
import { CreateTransactionDto } from '../src/transactions/dto/create-transaction.dto';

type ProcessFn = (
  dto: CreateTransactionDto,
) => ReturnType<TransactionsService['process']>;
type GetHistoryFn = (
  userId: string,
  limit?: number,
  before?: string,
) => ReturnType<TransactionsService['getUserTransactions']>;
type GetBalanceFn = (
  userId: string,
) => ReturnType<TransactionsService['getUserBalance']>;

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  let processMock: jest.MockedFunction<ProcessFn>;
  let getUserTransactionsMock: jest.MockedFunction<GetHistoryFn>;
  let getUserBalanceMock: jest.MockedFunction<GetBalanceFn>;

  const tx = (over: Partial<Transaction> = {}): Transaction =>
    ({
      id: 'id-1',
      transactionId: 'tx-1',
      userId: 'user-1',
      amountCents: 1234,
      type: TransactionType.DEPOSIT,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
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

  beforeAll(async () => {
    processMock = jest.fn<ReturnType<ProcessFn>, Parameters<ProcessFn>>();
    getUserTransactionsMock = jest.fn<
      ReturnType<GetHistoryFn>,
      Parameters<GetHistoryFn>
    >();
    getUserBalanceMock = jest.fn<
      ReturnType<GetBalanceFn>,
      Parameters<GetBalanceFn>
    >();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            process: processMock,
            getUserTransactions: getUserTransactionsMock,
            getUserBalance: getUserBalanceMock,
          } as Pick<
            TransactionsService,
            'process' | 'getUserTransactions' | 'getUserBalance'
          >,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    http = request(app.getHttpServer());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /transactions', () => {
    it('devuelve TransactionResponseDto con createdAt en ISO y llama a service.process', async () => {
      const created = new Date('2025-01-02T03:04:05.000Z');

      processMock.mockResolvedValueOnce({
        transaction: tx({
          transactionId: 'tx-abc',
          userId: 'user-xyz',
          amountCents: 5678,
          type: TransactionType.WITHDRAW,
          createdAt: created,
        }),
        balanceCents: 999,
        flagged: true,
      });

      const body = dto({
        transactionId: 'tx-abc',
        userId: 'user-xyz',
        amount: '56.78',
        type: TransactionType.WITHDRAW,
      });

      await http.post('/transactions').send(body).expect(201).expect({
        transactionId: 'tx-abc',
        userId: 'user-xyz',
        amountCents: 5678,
        type: TransactionType.WITHDRAW,
        balanceCents: 999,
        createdAt: created.toISOString(),
      });

      expect(processMock).toHaveBeenCalledTimes(1);
      expect(processMock).toHaveBeenCalledWith(body);
    });

    it('propaga BadRequestException como 400', async () => {
      processMock.mockRejectedValueOnce(new BadRequestException('bad_format'));

      await http.post('/transactions').send(dto()).expect(400);
    });
  });

  describe('GET /users/:userId/transactions', () => {
    it('usa limit por defecto (50)', async () => {
      const list: Transaction[] = [
        tx({
          transactionId: 'A',
          createdAt: new Date('2025-01-05T00:00:00.000Z'),
        }),
        tx({
          transactionId: 'B',
          amountCents: 999,
          createdAt: new Date('2025-01-04T00:00:00.000Z'),
        }),
      ];
      getUserTransactionsMock.mockResolvedValueOnce(list);

      await http
        .get('/users/user-1/transactions')
        .expect(200)
        .expect({
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

      expect(getUserTransactionsMock).toHaveBeenCalledTimes(1);
      expect(getUserTransactionsMock).toHaveBeenCalledWith(
        'user-1',
        50,
        undefined,
      );
    });

    it('parsea limit (string -> number) y reenvía before', async () => {
      const list: Transaction[] = [
        tx({
          transactionId: 'C',
          amountCents: 1,
          createdAt: new Date('2025-01-03T00:00:00.000Z'),
        }),
      ];
      getUserTransactionsMock.mockResolvedValueOnce(list);

      const before = '2025-01-02T23:59:59.000Z';

      await http
        .get('/users/user-9/transactions')
        .query({ limit: '150', before })
        .expect(200)
        .expect({
          transactions: [
            {
              transactionId: 'C',
              amountCents: 1,
              type: TransactionType.DEPOSIT,
              createdAt: '2025-01-03T00:00:00.000Z',
            },
          ],
        });

      expect(getUserTransactionsMock).toHaveBeenCalledTimes(1);
      expect(getUserTransactionsMock).toHaveBeenCalledWith(
        'user-9',
        150,
        before,
      );
    });
  });

  describe('GET /users/:userId/balance', () => {
    it('llama al servicio con userId', async () => {
      getUserBalanceMock.mockResolvedValueOnce(777);

      await http
        .get('/users/user-7/balance')
        .expect(200)
        .expect({ userId: 'user-7', balanceCents: 777 });

      expect(getUserBalanceMock).toHaveBeenCalledTimes(1);
      expect(getUserBalanceMock).toHaveBeenCalledWith('user-7');
    });
  });
});
