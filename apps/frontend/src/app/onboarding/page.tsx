'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { apiGet, apiPost } from '@/lib/api';

const PACKAGES = {
  'monthly-plan': { name: 'Monthly Plan', price: 2599, registrationFee: 500, months: 1 },
  '3-month-plan': { name: '3-Month Plan', price: 7000, registrationFee: 500, months: 3 },
  '6-month-plan': { name: '6-Month Plan', price: 13000, registrationFee: 500, months: 6 },
};

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 2: Restaurant details
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  // Step 3: Tax settings
  const [vatPct, setVatPct] = useState(13);
  const [scPct, setScPct] = useState(10);
  const [taxPct, setTaxPct] = useState(0);

  // Step 4: Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Get selected package from localStorage (set by landing page)
  const [selectedPackage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zenthorax-package') ?? 'monthly-plan';
    }
    return 'monthly-plan';
  });

  const pkg = PACKAGES[selectedPackage as keyof typeof PACKAGES] ?? PACKAGES['monthly-plan'];
  const firstPayment = pkg.price + pkg.registrationFee;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Auto-generate slug from name
  useEffect(() => {
    const generated = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
    setSlug(generated);
    setSlugError('');
  }, [name]);

  // Check slug availability when slug changes
  useEffect(() => {
    if (!slug || slug.length < 3) return;
    const timer = setTimeout(async () => {
      setSlugChecking(true);
      try {
        const res = await apiGet<{ available: boolean; reason?: string }>(
          `/api/restaurants/check-slug/${slug}`,
        );
        if (res.success && res.data && !res.data.available) {
          setSlugError(res.data.reason ?? 'Slug is already taken');
        } else {
          setSlugError('');
        }
      } catch {
        // Silently ignore network errors during check
      }
      setSlugChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  }

  function canProceedStep2() {
    return (
      name.length >= 3 &&
      slug.length >= 3 &&
      !slugError &&
      !slugChecking &&
      contactNumber.length >= 7 &&
      address.length >= 5
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    try {
      const res = await apiPost<{ id: string }>('/api/restaurants', {
        name,
        slug,
        contactNumber,
        address,
        category: category || undefined,
        description: description || undefined,
        vatPercentage: vatPct,
        serviceChargePercentage: scPct,
        taxPercentage: taxPct,
        packageType: selectedPackage.replace('-plan', ''),
      });

      if (res.success) {
        localStorage.removeItem('zenthorax-package');
        router.push('/dashboard');
      } else {
        setError(res.error?.message ?? 'Failed to create restaurant. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    }
    setSubmitting(false);
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  s <= step ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`h-0.5 w-6 ${s < step ? 'bg-brand-500' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {step === 1 && 'Confirm Your Plan'}
          {step === 2 && 'Restaurant Details'}
          {step === 3 && 'Tax & Billing Settings'}
          {step === 4 && 'Complete Setup'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Step 1: Package Confirmation */}
        {step === 1 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">{pkg.name}</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan price</span>
                <span>NRS {pkg.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">One-time registration fee</span>
                <span>NRS {pkg.registrationFee.toLocaleString()}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold">
                <span>First payment</span>
                <span>NRS {firstPayment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Duration</span>
                <span>{pkg.months} month{pkg.months > 1 ? 's' : ''}</span>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Confirm & Continue
            </button>
          </div>
        )}

        {/* Step 2: Restaurant Details */}
        {step === 2 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Restaurant Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Your Restaurant Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">URL Slug *</label>
                <div className="mt-1 flex items-center rounded-lg border">
                  <span className="pl-3 text-sm text-muted-foreground">zenthorax.com/r/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 rounded-r-lg px-2 py-2 text-sm outline-none"
                    placeholder="your-restaurant"
                  />
                  {slugChecking && (
                    <span className="pr-3 text-xs text-muted-foreground">Checking...</span>
                  )}
                </div>
                {slugError && (
                  <p className="mt-1 text-xs text-red-500">{slugError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Contact Number *</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="+977 98XXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Kathmandu, Nepal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Category (optional)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  <option value="fine_dining">Fine Dining</option>
                  <option value="casual">Casual Restaurant</option>
                  <option value="cafe">Cafe</option>
                  <option value="fast_food">Fast Food</option>
                  <option value="bar">Bar & Pub</option>
                  <option value="bakery">Bakery</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2()}
                className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tax Settings */}
        {step === 3 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">VAT Percentage</label>
                <input
                  type="number"
                  value={vatPct}
                  onChange={(e) => setVatPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Service Charge Percentage</label>
                <input
                  type="number"
                  value={scPct}
                  onChange={(e) => setScPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Additional Tax Percentage</label>
                <input
                  type="number"
                  value={taxPct}
                  onChange={(e) => setTaxPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  min={0}
                  max={100}
                />
              </div>
              {/* Preview */}
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium">Preview on a NRS 1,000 order:</p>
                <p>VAT ({vatPct}%): NRS {((vatPct / 100) * 1000).toFixed(0)}</p>
                <p>SC ({scPct}%): NRS {((scPct / 100) * 1000).toFixed(0)}</p>
                <p>Tax ({taxPct}%): NRS {((taxPct / 100) * 1000).toFixed(0)}</p>
                <p className="mt-1 font-bold">
                  Total: NRS{' '}
                  {(1000 + (vatPct + scPct + taxPct) * 10).toFixed(0)}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Create */}
        {step === 4 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Review & Complete</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="font-medium">Plan:</span> {pkg.name} — NRS {firstPayment.toLocaleString()} first payment
              </div>
              <div>
                <span className="font-medium">Restaurant:</span> {name}
              </div>
              <div>
                <span className="font-medium">Slug:</span> zenthorax.com/r/{slug}
              </div>
              <div>
                <span className="font-medium">Contact:</span> {contactNumber}
              </div>
              <div>
                <span className="font-medium">Address:</span> {address}
              </div>
              <div>
                <span className="font-medium">Tax:</span> VAT {vatPct}%, SC {scPct}%, Tax {taxPct}%
              </div>
            </div>

            {/* Logo upload */}
            <div className="mt-6">
              <label className="block text-sm font-medium">Restaurant Logo (optional)</label>
              <div className="mt-2 flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-2xl text-muted-foreground hover:border-brand-500 hover:text-brand-500">
                    +
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or WebP. Max 2MB.
                  <br />
                  Square images work best.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : `Create Restaurant — NRS ${firstPayment.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
