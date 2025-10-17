import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

const bigintTransformer = {
  to: (value: number): string | number => value,
  from: (value: string): number => parseInt(value, 10),
};

@Entity('transaction')
@Index('idx_tx_user_created', ['userId', 'createdAt'])
@Index('idx_tx_user_type', ['userId', 'type'])
export class Transaction {
  @PrimaryColumn({ type: 'uuid' })
  transactionId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amountCents!: number;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @CreateDateColumn()
  createdAt!: Date;
}
