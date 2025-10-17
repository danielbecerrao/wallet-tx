import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { UserBalance } from '../users/entities/user-balance.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FraudAlert } from '../frauds/entities/fraud-alert.entity';

config({ path: '.env' });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'wallet',
  entities: [UserBalance, Transaction, FraudAlert],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  migrations: ['dist/migrations/*.js'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
