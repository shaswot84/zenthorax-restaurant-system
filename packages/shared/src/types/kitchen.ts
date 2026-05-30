export interface KitchenStaff {
  id: string;
  userId: string;
  restaurantId: string;
  isApproved: boolean;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KitchenTicket {
  tableId: string;
  tableNumber: string;
  sessionId: string;
  orders: {
    id: string;
    status: string;
    notes: string | null;
    items: {
      menuItemName: string;
      quantity: number;
    }[];
    createdAt: Date;
  }[];
  latestOrderAt: Date;
}
