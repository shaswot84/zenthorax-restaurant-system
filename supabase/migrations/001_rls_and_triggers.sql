-- ============================================================================
-- Phase 1: Row-Level Security Policies & Auth Triggers
-- Apply this in Supabase SQL Editor (local: http://127.0.0.1:54323, prod: dashboard)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. AUTO-CREATE USER RECORD ON SIGNUP
-- When someone signs up via Supabase Auth, insert a row into public.users.
-- Role defaults to 'restaurant_manager' (can be overridden for super admins).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'restaurant_manager')::public.role,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. ENABLE RLS ON ALL TABLES
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_credentials ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. HELPER: current user's role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()::text;
$$;

-- ---------------------------------------------------------------------------
-- 4. PUBLIC READ POLICIES (for QR menu — no auth required)
-- ---------------------------------------------------------------------------

-- restaurants: anyone can read active restaurants
DROP POLICY IF EXISTS "Public can read active restaurants" ON public.restaurants;
CREATE POLICY "Public can read active restaurants" ON public.restaurants
  FOR SELECT USING (status = 'active');

-- menu_categories: anyone can read categories of active restaurants
DROP POLICY IF EXISTS "Public can read menu categories" ON public.menu_categories;
CREATE POLICY "Public can read menu categories" ON public.menu_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.status = 'active'
    )
  );

-- menu_items: anyone can read available items of active restaurants
DROP POLICY IF EXISTS "Public can read available menu items" ON public.menu_items;
CREATE POLICY "Public can read available menu items" ON public.menu_items
  FOR SELECT USING (
    is_available = true AND
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.status = 'active'
    )
  );

-- tables: anyone can read active tables
DROP POLICY IF EXISTS "Public can read active tables" ON public.tables;
CREATE POLICY "Public can read active tables" ON public.tables
  FOR SELECT USING (is_active = true);

-- ---------------------------------------------------------------------------
-- 5. AUTHENTICATED USER POLICIES (own data only)
-- ---------------------------------------------------------------------------

-- users: read own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (id = auth.uid()::text);

-- users: super admins can read all users
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- restaurants: managers read their own
DROP POLICY IF EXISTS "Managers can read own restaurant" ON public.restaurants;
CREATE POLICY "Managers can read own restaurant" ON public.restaurants
  FOR SELECT USING (owner_id = auth.uid()::text);

-- restaurants: kitchen staff can read their affiliated restaurant
DROP POLICY IF EXISTS "Kitchen staff can read their restaurant" ON public.restaurants;
CREATE POLICY "Kitchen staff can read their restaurant" ON public.restaurants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.kitchen_staff ks
      WHERE ks.restaurant_id = id
        AND ks.user_id = auth.uid()::text
        AND ks.is_approved = true
    )
  );

-- restaurants: super admin reads all
DROP POLICY IF EXISTS "Super admins can read all restaurants" ON public.restaurants;
CREATE POLICY "Super admins can read all restaurants" ON public.restaurants
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- menu_items (full): authenticated staff can read all their restaurant's items
DROP POLICY IF EXISTS "Staff can read all menu items" ON public.menu_items;
CREATE POLICY "Staff can read all menu items" ON public.menu_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id
        AND (r.owner_id = auth.uid()::text OR
             EXISTS (SELECT 1 FROM public.kitchen_staff ks
                     WHERE ks.restaurant_id = r.id
                       AND ks.user_id = auth.uid()::text
                       AND ks.is_approved = true))
    )
  );

-- tables (full): staff can read all their tables
DROP POLICY IF EXISTS "Staff can read own tables" ON public.tables;
CREATE POLICY "Staff can read own tables" ON public.tables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()::text
    )
  );

-- orders: restaurant staff can read their restaurant's orders
DROP POLICY IF EXISTS "Staff can read their restaurant orders" ON public.orders;
CREATE POLICY "Staff can read their restaurant orders" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id
        AND (r.owner_id = auth.uid()::text OR
             EXISTS (SELECT 1 FROM public.kitchen_staff ks
                     WHERE ks.restaurant_id = r.id
                       AND ks.user_id = auth.uid()::text
                       AND ks.is_approved = true))
    )
  );

-- order_items: same access as parent order
DROP POLICY IF EXISTS "Staff can read their restaurant order items" ON public.order_items;
CREATE POLICY "Staff can read their restaurant order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = order_id
        AND (r.owner_id = auth.uid()::text OR
             EXISTS (SELECT 1 FROM public.kitchen_staff ks
                     WHERE ks.restaurant_id = r.id
                       AND ks.user_id = auth.uid()::text
                       AND ks.is_approved = true))
    )
  );

-- bills: restaurant staff can read their restaurant's bills
DROP POLICY IF EXISTS "Staff can read their restaurant bills" ON public.bills;
CREATE POLICY "Staff can read their restaurant bills" ON public.bills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id
        AND (r.owner_id = auth.uid()::text OR
             EXISTS (SELECT 1 FROM public.kitchen_staff ks
                     WHERE ks.restaurant_id = r.id
                       AND ks.user_id = auth.uid()::text
                       AND ks.is_approved = true))
    )
  );

-- subscriptions: managers read own
DROP POLICY IF EXISTS "Managers can read own subscription" ON public.subscriptions;
CREATE POLICY "Managers can read own subscription" ON public.subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()::text
    )
  );

-- subscription_packages: anyone can read (landing page shows pricing before signup)
DROP POLICY IF EXISTS "Anyone can read subscription packages" ON public.subscription_packages;
CREATE POLICY "Anyone can read subscription packages" ON public.subscription_packages
  FOR SELECT USING (true);

-- kitchen_staff: staff can read own record, managers can read their restaurant's staff
DROP POLICY IF EXISTS "Kitchen staff can read own record" ON public.kitchen_staff;
CREATE POLICY "Kitchen staff can read own record" ON public.kitchen_staff
  FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Managers can read their kitchen staff" ON public.kitchen_staff;
CREATE POLICY "Managers can read their kitchen staff" ON public.kitchen_staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()::text
    )
  );

-- ---------------------------------------------------------------------------
-- 6. SUPER-ADMIN ONLY POLICIES
-- ---------------------------------------------------------------------------

-- subscriptions: super admin reads/manages all
DROP POLICY IF EXISTS "Super admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can read all subscriptions" ON public.subscriptions
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- payments: super admin reads all
DROP POLICY IF EXISTS "Super admins can read all payments" ON public.payments;
CREATE POLICY "Super admins can read all payments" ON public.payments
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- audit_logs: super admin only
DROP POLICY IF EXISTS "Super admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can read audit logs" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- governance: super admin only
DROP POLICY IF EXISTS "Super admins can read proposals" ON public.governance_proposals;
CREATE POLICY "Super admins can read proposals" ON public.governance_proposals
  FOR SELECT USING (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admins can read votes" ON public.governance_votes;
CREATE POLICY "Super admins can read votes" ON public.governance_votes
  FOR SELECT USING (public.current_user_role() = 'super_admin');

-- super_admin_credentials: user can read own, super admin can read all
DROP POLICY IF EXISTS "Users can read own credentials" ON public.super_admin_credentials;
CREATE POLICY "Users can read own credentials" ON public.super_admin_credentials
  FOR SELECT USING (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 7. ANONYMOUS SESSION POLICIES
-- Customers don't log in — they use session tokens.
-- Backend verifies session tokens and uses service_role key.
-- No direct anon access needed; these are handled by the API.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 8. ADD TABLES TO SUPABASE REALTIME PUBLICATION
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
