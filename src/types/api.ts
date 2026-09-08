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

export interface AfipAuthorization {
  invoiceId: string;
  isApproved: boolean;
  cae: string | null;
  caeExpirationDate: string | null;
  barCode: string | null;
  errors: string | null;
}
