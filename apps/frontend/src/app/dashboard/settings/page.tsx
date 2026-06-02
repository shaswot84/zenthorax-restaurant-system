'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPatch } from '@/lib/api';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [restaurant, setRestaurant] = useState<any>(null);

  const [name, setName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [vatPct, setVatPct] = useState(13);
  const [scPct, setScPct] = useState(10);
  const [taxPct, setTaxPct] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      loadRestaurant();
    }
  }, [user, isLoading]);

  async function loadRestaurant() {
    const res = await apiGet<any>('/api/restaurants/mine');
    if (res.success && res.data) {
      const r = res.data;
      setRestaurant(r);
      setName(r.name ?? '');
      setContactNumber(r.contactNumber ?? '');
      setAddress(r.address ?? '');
      setCategory(r.category ?? '');
      setDescription(r.description ?? '');
      setVatPct(r.vatPercentage ?? 13);
      setScPct(r.serviceChargePercentage ?? 10);
      setTaxPct(r.taxPercentage ?? 0);
    }
  }

  async function handleSave() {
    if (!restaurant) return;
    // Validate
    if (!name.trim() || name.trim().length < 3) { setMessage('Restaurant name must be at least 3 characters.'); return; }
    if (!address.trim() || address.trim().length < 5) { setMessage('Address must be at least 5 characters.'); return; }
    setSaving(true);
    setMessage('');

    const res = await apiPatch<any>(`/api/restaurants/${restaurant.id}`, {
      name,
      contactNumber,
      address,
      category: category || undefined,
      description: description || undefined,
      vatPercentage: vatPct,
      serviceChargePercentage: scPct,
      taxPercentage: taxPct,
    });

    if (res.success) {
      setMessage('Settings saved successfully!');
    } else {
      setMessage(res.error?.message ?? 'Failed to save. Please try again.');
    }
    setSaving(false);
  }

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your restaurant profile</p>

        {message && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {message}
          </div>
        )}

        {restaurant ? (
          <div className="mt-6 max-w-2xl space-y-6">
            {/* Status badge */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                    restaurant.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : restaurant.status === 'pending_approval'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {restaurant.status === 'active'
                    ? 'Active'
                    : restaurant.status === 'pending_approval'
                      ? 'Pending Approval'
                      : restaurant.status}
                </span>
              </div>
            </div>

            {/* Profile fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Restaurant Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="fine_dining">Fine Dining</option>
                  <option value="casual">Casual Restaurant</option>
                  <option value="cafe">Cafe</option>
                  <option value="fast_food">Fast Food</option>
                  <option value="bar">Bar & Pub</option>
                  <option value="bakery">Bakery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* Tax settings */}
            <h3 className="text-lg font-semibold">Tax Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">VAT %</label>
                <input
                  type="number"
                  value={vatPct}
                  onChange={(e) => setVatPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Service Charge %</label>
                <input
                  type="number"
                  value={scPct}
                  onChange={(e) => setScPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Additional Tax %</label>
                <input
                  type="number"
                  value={taxPct}
                  onChange={(e) => setTaxPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border bg-yellow-50 p-6 text-center">
            <p className="text-sm text-yellow-700">
              No restaurant found. Please complete your onboarding first.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Go to Onboarding
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
