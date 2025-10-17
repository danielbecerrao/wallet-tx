import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { UserBalance } from '../users/entities/user-balance.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  assertAmountFormat,
  amountStringToCents,
} from '../common/utils/money.util';
import { TransactionProcessResult } from './dto/transaction-service-response.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly dataSource: DataSource) {}

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

        return { transaction: tx, balanceCents: newBalance };
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
}
