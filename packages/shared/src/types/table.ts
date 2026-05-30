export interface Table {
  id: string;
  restaurantId: string;
  tableNumber: string;
  tableCode: string;
  qrUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableSession {
  id: string;
  tableId: string;
  sessionToken: string;
  isActive: boolean;
  openedAt: Date;
  closedAt: Date | null;
}

export interface TableWithSession extends Table {
  activeSession: TableSession | null;
}
