import { Transaction } from '../entities/transaction.entity';

export interface TransactionProcessResult {
  transaction: Transaction;
  balanceCents: number;
}
