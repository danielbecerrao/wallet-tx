export interface TransactionHistoryItemDto {
  transaction_id: string;
  amount_cents: number;
  type: string;
  created_at: string;
}

export interface TransactionHistoryResponseDto {
  transactions: TransactionHistoryItemDto[];
}
