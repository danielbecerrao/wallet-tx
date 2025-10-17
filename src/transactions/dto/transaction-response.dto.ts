export interface TransactionResponseDto {
  transactionId: string;
  userId: string;
  amountCents: number;
  type: string;
  balanceCents: number;
  flagged?: boolean;
  createdAt: string;
}
