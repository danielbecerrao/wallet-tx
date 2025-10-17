export interface TransactionHistoryItemDto {
  transactionId: string;
  amountCents: number;
  type: string;
  createdAt: string;
}

export interface TransactionHistoryResponseDto {
  transactions: TransactionHistoryItemDto[];
}
