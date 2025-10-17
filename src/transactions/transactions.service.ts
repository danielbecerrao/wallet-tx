import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { UserBalance } from '../users/entities/user-balance.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  assertAmountFormat,
  amountStringToCents,
} from '../common/utils/money.util';
import { TransactionProcessResult } from './dto/transaction-service-response.dto';
import { FraudService } from '../frauds/frauds.service';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(UserBalance)
    private readonly balanceRepository: Repository<UserBalance>,
    private readonly dataSource: DataSource,
    private readonly fraudService: FraudService,
  ) {}

  public async process(
    createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionProcessResult> {
    try {
      assertAmountFormat(createTransactionDto.amount);
      const cents = amountStringToCents(createTransactionDto.amount);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');

      try {
        const existing = await queryRunner.manager.findOne(Transaction, {
          where: { transactionId: createTransactionDto.transactionId },
        });
        if (existing) {
          const bal = await queryRunner.manager.findOneOrFail(UserBalance, {
            where: { userId: existing.userId },
          });
          await queryRunner.commitTransaction();
          return { transaction: existing, balanceCents: bal.balanceCents };
        }

        let balance = await queryRunner.manager.findOne(UserBalance, {
          where: { userId: createTransactionDto.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          balance = queryRunner.manager.create(UserBalance, {
            userId: createTransactionDto.userId,
            balanceCents: 0,
          });
          await queryRunner.manager.save(balance);
          await queryRunner.manager.findOne(UserBalance, {
            where: { userId: createTransactionDto.userId },
            lock: { mode: 'pessimistic_write' },
          });
        }

        let newBalance = balance.balanceCents;
        if (createTransactionDto.type === TransactionType.DEPOSIT) {
          newBalance += cents;
        } else {
          if (cents > balance.balanceCents) {
            throw new BadRequestException('insufficient_funds');
          }
          newBalance -= cents;
        }

        const tx = queryRunner.manager.create(Transaction, {
          transactionId: createTransactionDto.transactionId,
          userId: createTransactionDto.userId,
          amountCents: cents,
          type: createTransactionDto.type,
        });
        await queryRunner.manager.save(tx);

        balance.balanceCents = newBalance;
        await queryRunner.manager.save(balance);

        await queryRunner.commitTransaction();

        const flagged = await this.fraudService.checkAndFlagIfSuspicious(tx);

        return { transaction: tx, balanceCents: newBalance, flagged };
      } catch (err) {
        await queryRunner.rollbackTransaction();
        if ((err as Error).message === 'insufficient_funds') throw err;
        if (err instanceof ConflictException) throw err;
        this.logger.error('TX error', (err as Error).stack);
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException((e as Error).message);
    }
  }

  async getUserTransactions(
    userId: string,
    limit = 50,
    before?: string,
  ): Promise<Transaction[]> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.createdAt', 'DESC')
      .limit(Math.min(limit, 200));

    if (before) {
      qb.andWhere('t.createdAt < :before', { before });
    }
    return qb.getMany();
  }

  async getUserBalance(userId: string): Promise<number> {
    const bal = await this.balanceRepository.findOne({ where: { userId } });
    return bal?.balanceCents ?? 0;
  }
}
