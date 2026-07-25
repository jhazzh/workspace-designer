# Workspace Designer

Build your office setup in a 3D room, see the price update as you go, then rent it.

**Live:** https://workspace-designer-app.vercel.app
**Source:** https://github.com/jhazzh/workspace-designer

## Approach

Most rental sites make you scroll a product list. This puts a 3D room on screen and
lets you build a desk setup inside it.

## Tech choices

| Choice | Why |
|---|---|
| Next.js + Tailwind | Required by the brief |
| React Three Fiber | three.js as React components, so the scene and price panel share one store |
| Zustand | Scene and checkout read the same selections |
| Stripe Checkout (test mode) | First month + refundable deposit as one charge |

## Layouts and rooms

Setups export to flat JSON (item ids and metres) so they can be
hand-edited or LLM-generated and loaded back. Parsing treats every field as untrusted and
reports skipped items rather than dropping them silently.

The room ships as an open corner or four walls, and you can upload your own `.glb`/`.gltf`
in place of it.

## Models

Furniture lives in [`src/data/catalog.ts`](src/data/catalog.ts). Each item can point at a
`.glb`; anything without one renders as a low-poly mesh.

To add one, drop `<item-id>.glb` into `public/models/` and set `model` on that entry.

## Running locally

```bash
npm install
npm run dev
```

Checkout needs Stripe **test** keys in `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
```

Without it everything works except Rent, which reports payments aren't configured.
Test card: `4242 4242 4242 4242`, any future expiry.

## Tests

```bash
npm run test:e2e          # desktop + mobile
npm run test:e2e -- --project=desktop
```

## Keyboard

`W` move · `E` rotate · `A` tidy up · `X` snap · `C` collision
`D` duplicate · `Del` remove · `Esc` deselect · `Ctrl+Z` / `Ctrl+Y` undo / redo

## With more time

- **Real inventory and delivery dates**, since a rental business can run out of chairs
