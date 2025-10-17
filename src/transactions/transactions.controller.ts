import { Controller, Post, Body } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';

@Controller()
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post('transactions')
  public async create(
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const { transaction, balanceCents } = await this.service.process(dto);
    return {
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      amountCents: transaction.amountCents,
      type: transaction.type,
      balanceCents: balanceCents,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
