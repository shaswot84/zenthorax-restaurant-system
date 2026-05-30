import type { OrderStatus } from '../constants/index';

export interface Order {
  id: string;
  sessionId: string;
  restaurantId: string;
  tableId: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}
