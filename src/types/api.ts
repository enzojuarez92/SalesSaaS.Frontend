export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}
export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}
export interface RegisterRequest {
  tenantName: string;
  taxId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  taxCondition?: string;
  businessCategory?: string;
}
export interface PeriodMetric {
  current: number;
  previous: number;
  variationPercentage: number;
}
export interface DashboardKpis {
  dailySales: PeriodMetric;
  monthlySales: PeriodMetric;
  estimatedGrossProfit: number;
  estimatedGrossMarginPercentage: number;
  processedOrders: number;
  averageTicket: number;
  totalReceivable: number;
  totalPayable: number;
}
export interface DashboardCash {
  id: string;
  warehouseName: string;
  expectedCash: number;
  openedAtUtc: string;
}
export interface RecentSale {
  id: string;
  customerName: string;
  totalAmount: number;
  status: string;
  occurredAtUtc: string;
  paymentMethod: number;
}
export interface SalesHistoryRow {
  id: string; date: string; receiptNumber: string; customer: string; seller: string;
  paymentMethod: number; total: number; status: string;
}
export interface SaleDetail {
  id: string; date: string; receiptNumber: string; customer: string; customerDocument: string;
  seller: string; paymentMethod: number; total: number; discount: number; status: string;
  items: Array<{ product: string; sku: string; quantity: number; unitPrice: number; subtotal: number }>;
}
export interface DashboardSummary {
  dailySales: number;
  dailyTransactions: number;
  monthlySales: number;
  monthlyTransactions: number;
  totalReceivable: number;
  criticalStockCount: number;
  currentCash: DashboardCash | null;
  recentSales: RecentSale[];
}
export interface DashboardSalesPoint { date: string; total: number; transactions: number; }
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}
export interface Subscription {
  id: string;
  subscriptionPlanId: string;
  planName: string;
  status: 1 | 2 | 3 | 4;
  startsAtUtc: string;
  expiresAtUtc: string;
  autoRenew: boolean;
  providerSubscriptionId: string | null;
}
export interface SubscriptionPlan { id: string; name: string; monthlyPrice: number; annualPrice: number; currency: string; maxUsers: number; maxWarehouses: number; maxInvoicesPerMonth: number; supportsAfip: boolean; isDefault: boolean; }
export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
}
export interface TopProduct {
  productId: string;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  description: string;
  price: number;
  cost: number;
  vatRate: number;
  stock: number;
  minimumStockAlert: number;
  isActive: boolean;
}
export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}
export interface Invoice {
  id: string;
  orderId: string;
  number: string;
  status: string;
  totalAmount: number;
  issuedAtUtc: string;
  customerName: string;
  cae: string | null;
  caeExpirationDate: string | null;
  afipResult: string | null;
  barCode: string | null;
  afipErrors: string | null;
  afipVoucherType: number | null;
  afipSalesPoint: number | null;
}

export interface Customer {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  taxCondition: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  creditLimit: number;
  currentBalance: number;
  availableCredit?: number;
  allowCredit: boolean;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  legalName: string;
  taxId: string;
  taxCondition: string;
  email: string | null;
  isActive: boolean;
}

export interface AccountEntry {
  id: string;
  amount: number;
  description: string;
  occurredAtUtc: string;
  type?: number;
  isDebit?: boolean;
}

export interface CashMovement {
  id: string;
  paymentMethod: number;
  amount: number;
  isIncome: boolean;
  description: string;
  occurredAtUtc: string;
}
export interface CashPaymentTotal { paymentMethod: number; income: number; expense: number; net: number; }
export interface CashSession {
  id: string; warehouseId: string; warehouseName: string; openingBalance: number; expectedCash: number;
  closingBalance: number | null; difference: number | null; openedAtUtc: string; closedAtUtc: string | null;
  status: string; totals: CashPaymentTotal[]; movements: CashMovement[];
}

export interface AfipAuthorization {
  invoiceId: string;
  isApproved: boolean;
  cae: string | null;
  caeExpirationDate: string | null;
  barCode: string | null;
  errors: string | null;
}
