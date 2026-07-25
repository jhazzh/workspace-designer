# Workspace Designer

Build your office setup in a 3D room, see the price update as you go, then rent it.

**Live:** https://workspace-designer-app.vercel.app
**Source:** https://github.com/jhazzh/workspace-designer

---

## Approach

Most rental sites make you scroll a product list. I wanted the opposite: put a real
room on screen and let you build a desk setup inside it. Pick a desk, add a chair,
drop in a monitor and a plant, and watch it come together.

The part that matters is that **items know where they belong**. A monitor lands at the
back of the desk, a lamp sits on the surface, the chair tucks in at the near edge.
Nothing floats, sinks through the floor, or overlaps. You never have to position
anything to get a setup that looks right — but you can, and once you move something
by hand it stays where you put it.

When it looks right, the summary panel already has the price, and one button takes
you to checkout.

## Tech choices

| Choice | Why |
|---|---|
| Next.js 16 + Tailwind 4 | Required by the brief |
| React Three Fiber | three.js as React components, so the scene and the price panel share one state store |
| Zustand | Both the 3D scene and the checkout panel read the same selections |
| Stripe Checkout (test mode) | First month + refundable deposit as a single charge |

**Why React Three Fiber and not plain three.js?** Next.js is required, so React is
already in the app. Selecting a chair has to update both the scene and the price
panel; with R3F both read the same store. With bare three.js you hand-wire every
change across the React boundary and unwind it on unmount. R3F is the same three.js
underneath, so the imperative escape hatch is still there — which is exactly what the
collision code uses.

**The one structural rule:** collision and dragging mutate three.js objects directly,
never through React state. Routing per-frame AABB resolution through React would
re-render the app on every mouse move. React finds out on drag end.

## The layout engine

Adapted from a vanilla three.js prototype I'd built for composing GLB scenes:

- **Collision** resolves along the axis of *smallest* overlap, so dragging sideways
  into a desk slides you off it while dragging down sets you on top. Obstacle boxes
  are cached at drag start rather than rebuilt each frame.
- **Auto-arrange** anchors on the largest work surface, puts tall items along the far
  edge and short ones in front using real depths, then rings the remaining floor
  items around it.
- **Undo/redo** is a command stack — every action carries its own inverse.

Two things changed in the port. The prototype classified items by matching keywords
against filenames; here each catalog item declares its own `placement`, so it's a
field read instead of a guess. And items the user has dragged are pinned, so adding
more furniture never undoes deliberate positioning.

## Models

Furniture is defined in [`src/data/catalog.ts`](src/data/catalog.ts). Each item can
point at a `.glb`; anything without one renders as a built-in low-poly mesh. The app
worked end to end before any model existed, and models can be added one at a time.

To add a real model, drop `<item-id>.glb` into `public/models/` and set `model` on
that catalog entry. Nothing else changes. Models must be **Y-up, in metres, with the
origin at the floor-contact point** — generated GLBs usually centre the origin, which
makes furniture float. There's a runtime recentre as a safety net.

## Running locally

```bash
npm install
npm run dev
```

Checkout needs Stripe **test** keys in `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
```

Without it everything works except the Rent button, which reports that payments
aren't configured. Test card: `4242 4242 4242 4242`, any future expiry.

## Tests

```bash
npm run test:e2e          # desktop + mobile
npm run test:e2e -- --project=desktop
```

Playwright builds and serves the production bundle, then runs 15 tests against
Chrome and a Pixel 7.

Testing a 3D canvas is awkward — from the outside it's one opaque element, so
asserting "the page rendered" proves very little. A small `SceneProbe` component
(mounted only when `NEXT_PUBLIC_E2E=1`, never in production) exposes the scene's
bounding boxes, which lets the tests check what actually matters:

- a monitor's base sits at desk height, not on the floor beside it
- nothing drops below the floor
- no two items overlap
- undo empties the room and redo restores it exactly
- the checkout API recomputes prices server-side and ignores a client that
  claims its setup is free

## Keyboard

`W` move · `E` rotate · `R` scale · `A` tidy up · `X` snap · `C` collision
`D` duplicate · `Del` remove · `Esc` deselect · `Ctrl+Z` / `Ctrl+Y` undo / redo

## With more time

- **Save and share a setup by URL** so you can send it to a colleague or come back to it
- **Real inventory and delivery dates**, since a rental business can run out of chairs
- **Touch dragging on mobile.** Tap-to-select and the full catalog work on a phone,
  but gizmo editing is desktop-only — touch plus transform handles is unreliable and
  I'd rather ship it working than half-working
- **AR preview** to check the setup fits your actual room
- **Room sizing** instead of one fixed corner
- A **wall and flooring catalog**, which the room component already accepts models for
