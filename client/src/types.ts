export interface PdfLink {
  filename: string;
  month: string;
  url: string;
  matchMethod?: string;
  linkType?: "Sales" | "Expenses";
}

export interface Transaction {
  transferWiseId: string;
  date: string;
  dateTime: string;
  amount: number;
  currency: string;
  description: string;
  paymentReference: string;
  runningBalance: number;
  exchangeFrom: string;
  exchangeTo: string;
  exchangeRate: string;
  payerName: string;
  payeeName: string;
  payeeAccountNumber: string;
  merchant: string;
  cardLastFourDigits: string;
  cardHolderFullName: string;
  attachment: string;
  note: string;
  totalFees: number;
  exchangeToAmount: string;
  transactionType: string;
  transactionDetailsType: string;
  invoiceLinks?: PdfLink[];
  remittanceLinks?: PdfLink[];
}

export interface ApiResponse {
  transactions: Transaction[];
  stats: {
    total: number;
    withInvoice: number;
    withRemittance: number;
  };
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: keyof Transaction;
  direction: SortDirection;
}

export interface Filter {
  key: string;
  value: string;
}
