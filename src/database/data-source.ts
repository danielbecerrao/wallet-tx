import { DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config({ path: '.env' });

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'wallet',
  entities: [],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  migrations: ['dist/migrations/*.js'],
};

export default dataSourceOptions;
