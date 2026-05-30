import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  anonymousToken: string | null;
  tableCode: string | null;
  restaurantSlug: string | null;

  setSession: (token: string, tableCode: string, slug: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      anonymousToken: null,
      tableCode: null,
      restaurantSlug: null,

      setSession: (token, tableCode, slug) =>
        set({ anonymousToken: token, tableCode, restaurantSlug: slug }),

      clearSession: () =>
        set({ anonymousToken: null, tableCode: null, restaurantSlug: null }),
    }),
    {
      name: 'zenthorax-session',
    },
  ),
);
