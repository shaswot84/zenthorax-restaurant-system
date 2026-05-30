import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@zenthorax/shared';

type CartMode = 'dine-in' | 'takeaway';

interface CartState {
  items: CartItem[];
  mode: CartMode;
  tableSessionId: string | null;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  setMode: (mode: CartMode) => void;
  setTableSessionId: (sessionId: string | null) => void;

  // Computed
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      mode: 'dine-in',
      tableSessionId: null,

      addItem: (item) => {
        const existing = get().items.find((i) => i.menuItemId === item.menuItemId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.menuItemId === item.menuItemId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i,
            ),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      removeItem: (menuItemId) => {
        set({ items: get().items.filter((i) => i.menuItemId !== menuItemId) });
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, quantity } : i,
          ),
        });
      },

      clearCart: () => set({ items: [] }),
      setMode: (mode) => set({ mode }),
      setTableSessionId: (sessionId) => set({ tableSessionId: sessionId }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'zenthorax-cart',
      partialize: (state) => ({
        items: state.items,
        mode: state.mode,
        tableSessionId: state.tableSessionId,
      }),
    },
  ),
);
