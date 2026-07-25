export type Slot = 'desk' | 'chair' | 'monitor' | 'lamp' | 'plant' | 'rug' | 'storage';

/** Where an item belongs. Replaces filename guessing in the arranger. */
export type Placement = 'support' | 'tabletop' | 'floor';

export type Item = {
  id: string;
  slot: Slot;
  placement: Placement;
  name: string;
  monthly: number;
  blurb: string;
  /** Size in metres [w, h, d]. Placeholder dims; also the arranger's fallback. */
  size: [number, number, number];
  color: string;
  /** GLB at /models/<id>.glb. Absent = placeholder mesh. */
  model?: string;
  /** Tall tabletop items go at the back of the desk. */
  back?: boolean;
};

export const SLOTS: { slot: Slot; label: string; multi: boolean }[] = [
  { slot: 'desk', label: 'Desk', multi: false },
  { slot: 'chair', label: 'Chair', multi: false },
  { slot: 'monitor', label: 'Monitors', multi: true },
  { slot: 'lamp', label: 'Lighting', multi: true },
  { slot: 'plant', label: 'Plants', multi: true },
  { slot: 'storage', label: 'Storage', multi: true },
  { slot: 'rug', label: 'Rugs', multi: true },
];

export const CATALOG: Item[] = [
  // desks
  {
    id: 'desk-oak',
    slot: 'desk',
    placement: 'support',
    name: 'Oak Writing Desk',
    monthly: 42,
    blurb: 'Solid oak top, 140cm. Warm and quiet.',
    size: [1.4, 0.74, 0.7],
    color: '#b98d5c',
  },
  {
    id: 'desk-standing',
    slot: 'desk',
    placement: 'support',
    name: 'Electric Standing Desk',
    monthly: 68,
    blurb: 'Sit or stand, memory presets, 160cm.',
    size: [1.6, 0.78, 0.75],
    color: '#4a4f57',
  },
  {
    id: 'desk-compact',
    slot: 'desk',
    placement: 'support',
    name: 'Compact Studio Desk',
    monthly: 28,
    blurb: 'Fits small rooms without feeling small.',
    size: [1.1, 0.73, 0.6],
    color: '#d8cdbc',
  },

  // chairs
  {
    id: 'chair-ergonomic',
    slot: 'chair',
    placement: 'floor',
    name: 'Ergonomic Mesh Chair',
    monthly: 38,
    blurb: 'Lumbar support for long days.',
    size: [0.65, 1.15, 0.65],
    color: '#3b4048',
  },
  {
    id: 'chair-lounge',
    slot: 'chair',
    placement: 'floor',
    name: 'Rattan Lounge Chair',
    monthly: 30,
    blurb: 'Woven rattan. Reading-friendly.',
    size: [0.7, 0.95, 0.7],
    color: '#c79a62',
  },
  {
    id: 'chair-stool',
    slot: 'chair',
    placement: 'floor',
    name: 'Adjustable Stool',
    monthly: 18,
    blurb: 'Light, rolls away, pairs with standing desks.',
    size: [0.45, 0.75, 0.45],
    color: '#6b7280',
  },

  // monitors
  {
    id: 'monitor-27',
    slot: 'monitor',
    placement: 'tabletop',
    name: '27" 4K Monitor',
    monthly: 34,
    blurb: 'Sharp enough to stop squinting.',
    size: [0.62, 0.52, 0.2],
    color: '#22262c',
    back: true,
  },
  {
    id: 'monitor-ultrawide',
    slot: 'monitor',
    placement: 'tabletop',
    name: '34" Ultrawide',
    monthly: 52,
    blurb: 'Two windows side by side, no seam.',
    size: [0.82, 0.5, 0.22],
    color: '#1c2027',
    back: true,
  },

  // lighting
  {
    id: 'lamp-desk',
    slot: 'lamp',
    placement: 'tabletop',
    name: 'Warm Desk Lamp',
    monthly: 9,
    blurb: 'Adjustable arm, warm bulb.',
    size: [0.18, 0.42, 0.18],
    color: '#e8dcc8',
    back: true,
  },
  {
    id: 'lamp-floor',
    slot: 'lamp',
    placement: 'floor',
    name: 'Arc Floor Lamp',
    monthly: 14,
    blurb: 'Soft overhead light without the ceiling work.',
    size: [0.32, 1.6, 0.32],
    color: '#d6d3cd',
  },

  // plants
  {
    id: 'plant-monstera',
    slot: 'plant',
    placement: 'floor',
    name: 'Monstera',
    monthly: 11,
    blurb: 'Big leaves. Forgiving.',
    size: [0.55, 1.1, 0.55],
    color: '#3f7d44',
  },
  {
    id: 'plant-desk',
    slot: 'plant',
    placement: 'tabletop',
    name: 'Desk Succulent',
    monthly: 5,
    blurb: 'Small, green, nearly unkillable.',
    size: [0.16, 0.2, 0.16],
    color: '#5b8f5a',
  },

  // storage
  {
    id: 'storage-drawer',
    slot: 'storage',
    placement: 'floor',
    name: 'Rolling Drawer Unit',
    monthly: 16,
    blurb: 'Three drawers, tucks under the desk.',
    size: [0.42, 0.58, 0.5],
    color: '#8a8f98',
  },
  {
    id: 'storage-shelf',
    slot: 'storage',
    placement: 'floor',
    name: 'Low Bookshelf',
    monthly: 22,
    blurb: 'Books, gear, a place for the printer.',
    size: [0.8, 0.9, 0.32],
    color: '#a9784b',
  },

  // rugs
  {
    id: 'rug-jute',
    slot: 'rug',
    placement: 'floor',
    name: 'Jute Rug',
    monthly: 12,
    blurb: 'Woven jute. Warms up a hard floor.',
    size: [2.2, 0.02, 1.6],
    color: '#c9b189',
  },
];

export const byId = (id: string) => CATALOG.find((i) => i.id === id);
export const bySlot = (slot: Slot) => CATALOG.filter((i) => i.slot === slot);
