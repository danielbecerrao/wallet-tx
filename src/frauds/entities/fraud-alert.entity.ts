import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'fraudAlert' })
@Index('idx_fraud_user_created', ['userId', 'createdAt'])
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  transactionId!: string;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
