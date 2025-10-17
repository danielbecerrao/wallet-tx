export function assertAmountFormat(value: string): void {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error('amount must be a positive decimal with up to 2 decimals');
  }
}

export function amountStringToCents(value: string): number {
  const [intPart, decPart = ''] = value.split('.');
  const normalized = decPart.padEnd(2, '0').slice(0, 2);
  const cents = Number(intPart) * 100 + Number(normalized);
  if (cents <= 0) throw new Error('amount must be > 0');
  return cents;
}
