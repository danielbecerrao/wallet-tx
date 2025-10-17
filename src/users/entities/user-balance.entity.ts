import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

const bigintTransformer = {
  to: (value: number): string | number => value,
  from: (value: string): number => parseInt(value, 10),
};

@Entity('userBalance')
export class UserBalance {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
    default: 0,
  })
  balanceCents!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
