import Link from 'next/link';

const PACKAGES = [
  {
    name: 'Monthly Plan',
    price: '2,599',
    registrationFee: '500',
    firstPayment: '3,099',
    period: '/month',
    description: 'Full access to all features with monthly billing. Cancel anytime.',
  },
  {
    name: '3-Month Plan',
    price: '7,000',
    registrationFee: '500',
    firstPayment: '7,500',
    period: '/3 months',
    description: 'Save with quarterly billing. Same great features, better value.',
    popular: true,
  },
  {
    name: '6-Month Plan',
    price: '13,000',
    registrationFee: '500',
    firstPayment: '13,500',
    period: '/6 months',
    description: 'Best value for committed restaurants. Maximum savings.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900">
            QR Menu & Ordering
            <br />
            <span className="text-brand-500">Made Simple</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Customers scan, browse, order, and pay — all from their phone. Built for
            Nepali restaurants. No app download required.
          </p>
          <div className="mt-10">
            <a
              href="#packages"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-brand-600 transition-colors"
            >
              Get Started — One-time NRS 500 registration
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center">Everything Your Restaurant Needs</h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'QR Table Ordering',
                desc: 'Customers scan a QR code at their table, browse your menu, and place orders instantly. No login needed.',
              },
              {
                title: 'Kitchen Dashboard',
                desc: 'Orders appear in real-time on your kitchen display with sound notifications. Track every ticket from received to ready.',
              },
              {
                title: 'Smart Billing',
                desc: 'Customers request bills from their phone. Manage payments, apply discounts, and track revenue — all in one place.',
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="py-16 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center">Choose Your Plan</h2>
          <p className="mt-4 text-center text-muted-foreground">
            All plans include a one-time NRS 500 registration fee
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                className={`relative rounded-xl border-2 bg-white p-8 shadow-sm ${
                  pkg.popular
                    ? 'border-brand-500 shadow-brand-100 shadow-lg'
                    : 'border-gray-200'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold">{pkg.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">NRS {pkg.price}</span>
                  <span className="text-muted-foreground">{pkg.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  + NRS {pkg.registrationFee} one-time registration
                </p>
                <p className="mt-1 text-sm font-medium text-brand-600">
                  First payment: NRS {pkg.firstPayment}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">{pkg.description}</p>
                <Link
                  href="/login"
                  className={`mt-6 block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors ${
                    pkg.popular
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 text-gray-400 text-center text-sm">
        <div className="container mx-auto">
          <p>&copy; {new Date().getFullYear()} Zenthorax. All rights reserved.</p>
          <p className="mt-2">QR-based restaurant ordering platform. Made in Nepal 🇳🇵</p>
        </div>
      </footer>
    </main>
  );
}
