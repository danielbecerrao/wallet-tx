import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { FraudAlert } from './entities/fraud-alert.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(FraudAlert)
    private readonly alertRepository: Repository<FraudAlert>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async checkAndFlagIfSuspicious(tx: Transaction): Promise<boolean> {
    const high = process.env.FRAUD_HIGH_AMOUNT_CENTS
      ? Number(process.env.FRAUD_HIGH_AMOUNT_CENTS)
      : 100_00;
    const windowMin = process.env.FRAUD_WINDOW_MIN
      ? Number(process.env.FRAUD_WINDOW_MIN)
      : 10;

    const offsetHours = 5;
    const now = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const since = new Date(
      Date.now() - windowMin * 60_000 + offsetHours * 60 * 60 * 1000,
    );
    const count = await this.transactionRepository.count({
      where: {
        userId: tx.userId,
        createdAt: Between(since, now),
        amountCents: MoreThanOrEqual(high),
      },
    });

    const recent = await this.transactionRepository.find({
      where: { userId: tx.userId, createdAt: Between(since, now) },
      order: { createdAt: 'DESC' },
      take: Math.max(count, 10),
    });

    const highOnes = recent.filter((r) => r.amountCents >= high);
    const suspicious = highOnes.length >= 3;

    if (suspicious) {
      const alert = this.alertRepository.create({
        userId: tx.userId,
        transactionId: tx.transactionId,
        reason: `>=3 high-value tx within ${windowMin} min`,
      });
      await this.alertRepository.save(alert);
      this.logger.warn(
        `FRAUD ALERT for user ${tx.userId} due to high frequency high-value tx`,
      );
    }

    return suspicious;
  }
}
