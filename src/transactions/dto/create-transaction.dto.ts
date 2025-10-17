import { IsEnum, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsNotEmpty({
    message: 'transactionId should not be empty',
  })
  @IsUUID('4', {
    message: 'transactionId must be a valid UUID v4',
  })
  transactionId!: string;

  @IsNotEmpty({
    message: 'userId should not be empty',
  })
  @IsUUID('4', {
    message: 'userId must be a valid UUID v4',
  })
  userId!: string;

  @IsNotEmpty({
    message: 'amount should not be empty',
  })
  @IsString({
    message: 'amount must be a string',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal with up to 2 decimals',
  })
  amount!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;
}
