import type { BillStatus, PaymentMedium } from '../constants/index';

export interface Bill {
  id: string;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  subtotal: number;
  discount: number;
  vat: number;
  serviceCharge: number;
  tax: number;
  total: number;
  status: BillStatus;
  paymentMedium: PaymentMedium | null;
  paidAt: Date | null;
  paidByUserId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillWithOrders extends Bill {
  orders: {
    id: string;
    items: {
      menuItemName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
  }[];
}

export interface BillCalculation {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  serviceCharge: number;
  tax: number;
  total: number;
}
