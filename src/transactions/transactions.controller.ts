import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import {
  TransactionHistoryItemDto,
  TransactionHistoryResponseDto,
} from './dto/transaction-history-response.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';

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

  @Get('users/:userId/transactions')
  async history(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<TransactionHistoryResponseDto> {
    const items = await this.service.getUserTransactions(
      userId,
      limit ? Number(limit) : 50,
      before,
    );

    const transactions: TransactionHistoryItemDto[] = items.map((t) => ({
      transaction_id: t.transactionId,
      amount_cents: t.amountCents,
      type: t.type,
      created_at: t.createdAt.toISOString(),
    }));

    return { transactions };
  }

  @Get('users/:userId/balance')
  async balance(@Param('userId') userId: string): Promise<BalanceResponseDto> {
    const cents = await this.service.getUserBalance(userId);
    return { user_id: userId, balance_cents: cents };
  }
}
