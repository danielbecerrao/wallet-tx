import { forwardRef, Module } from '@nestjs/common';
import { FraudService } from './frauds.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudAlert } from './entities/fraud-alert.entity';
import { Transaction } from 'src/transactions/entities/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FraudAlert, Transaction]),
    forwardRef(() => TransactionsModule),
  ],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudsModule {}
