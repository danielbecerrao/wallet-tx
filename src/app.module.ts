import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from './transactions/transactions.module';
import { dataSourceOptions } from './database/data-source';
import { FraudsModule } from './frauds/frauds.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TransactionsModule,
    FraudsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
