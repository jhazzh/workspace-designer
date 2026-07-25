import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { breakdown, quote, toCents } from '@/lib/pricing';

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;

  let body: { ids?: unknown; months?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === 'string') : [];
  const months = Number(body.months) || 1;

  if (!ids.length) {
    return NextResponse.json({ error: 'Your workspace is empty.' }, { status: 400 });
  }

  // Recomputed server-side from ids only: the client never sends prices.
  const q = quote(ids, months);

  if (!key) {
    return NextResponse.json(
      { error: 'Payments are not configured on this deployment.' },
      { status: 503 },
    );
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const stripe = new Stripe(key);

  // Same record on both objects: the session is the checkout flow, the payment
  // intent is what stays visible under Payments once the charge settles.
  const metadata = {
    items: ids.join(',').slice(0, 500),
    line_items: breakdown(q.lines),
    months: String(q.months),
    subtotal: q.subtotal.toFixed(2),
    discount: q.discount.toFixed(2),
    monthly: q.monthly.toFixed(2),
    deposit: q.deposit.toFixed(2),
    due_today: q.dueToday.toFixed(2),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: toCents(q.monthly),
            product_data: {
              name: `Workspace rental — first month`,
              description: q.lines.map((l) => l.name).join(', ').slice(0, 500),
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: toCents(q.deposit),
            product_data: {
              name: 'Refundable deposit',
              description: 'Returned in full when the equipment is collected.',
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe errors quote the API key and other internals, so they stay in the
    // server log. The client only ever sees a generic failure.
    console.error('[checkout] session create failed:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 },
    );
  }
}
