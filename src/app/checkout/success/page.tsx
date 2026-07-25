import Link from 'next/link';
import Stripe from 'stripe';
import { money } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

type Details = { total: number; email: string | null; months: string | null };

async function fetchSession(id: string): Promise<Details | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const s = await new Stripe(key).checkout.sessions.retrieve(id);
    return {
      total: (s.amount_total ?? 0) / 100,
      email: s.customer_details?.email ?? null,
      months: s.metadata?.months ?? null,
    };
  } catch {
    return null;
  }
}

export default async function SuccessPage(props: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  // Next 16: searchParams is async
  const { session_id } = await props.searchParams;
  const details = session_id ? await fetchSession(session_id) : null;

  return (
    <main className="grid min-h-[100dvh] place-content-center bg-stone-100 px-6 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-full bg-emerald-500 text-white">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
            <path
              d="M6 13.5l4.5 4.5L20 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-stone-900">
          Your workspace is booked
        </h1>
        <p className="mt-2 text-stone-600">
          {details?.email ? (
            <>
              We&apos;ve sent the details to{' '}
              <span className="font-medium text-stone-800">{details.email}</span>. Our
              team will confirm a delivery slot within one working day.
            </>
          ) : (
            <>
              Our team will be in touch within one working day to arrange delivery and
              setup.
            </>
          )}
        </p>

        {details && (
          <dl className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Paid today</dt>
              <dd className="font-medium tabular-nums text-stone-900">
                {money(details.total)}
              </dd>
            </div>
            {details.months && (
              <div className="mt-2 flex justify-between">
                <dt className="text-stone-500">Rental length</dt>
                <dd className="tabular-nums text-stone-800">{details.months} months</dd>
              </div>
            )}
          </dl>
        )}

        <Link
          href="/"
          className="mt-7 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Design another workspace
        </Link>

        <p className="mt-4 text-[12px] text-stone-400">
          Test mode — no real payment was taken.
        </p>
      </div>
    </main>
  );
}
