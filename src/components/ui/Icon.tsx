/**
 * Icon set.
 *
 * Inline SVG paths rather than an icon font or a package: it keeps the bundle
 * small, works offline in the app shell, and lets every glyph inherit
 * `currentColor` so icons theme automatically.
 *
 * Amenity icon keys come from `config/taxonomy`; anything without a dedicated
 * glyph falls back to a check mark, so adding an amenity never renders a hole.
 */

export type IconName =
  | 'anchor' | 'search' | 'calendar' | 'users' | 'chevron-left' | 'chevron-right'
  | 'chevron-down' | 'chevron-up' | 'close' | 'menu' | 'heart' | 'heart-filled'
  | 'star' | 'star-half' | 'star-empty' | 'map-pin' | 'map' | 'list' | 'filter'
  | 'sort' | 'check' | 'check-circle' | 'alert' | 'info' | 'clock' | 'bolt'
  | 'shield' | 'ruler' | 'boat' | 'message' | 'bell' | 'user' | 'settings'
  | 'logout' | 'card' | 'wallet' | 'plus' | 'minus' | 'trash' | 'edit'
  | 'camera' | 'share' | 'external' | 'phone' | 'mail' | 'globe' | 'home'
  | 'grid' | 'chart' | 'tag' | 'lock' | 'eye' | 'eye-off' | 'arrow-right'
  | 'arrow-left' | 'refresh' | 'download' | 'wifi' | 'snow' | 'shower'
  | 'kitchen' | 'fridge' | 'stove' | 'ice' | 'shade' | 'speaker' | 'tv'
  | 'gps' | 'depth' | 'sonar' | 'radar' | 'auto' | 'thruster' | 'wheel'
  | 'radio' | 'vest' | 'dinghy' | 'paddle' | 'kayak' | 'jetski' | 'wake'
  | 'ski' | 'snorkel' | 'dive' | 'rod' | 'bait' | 'knife' | 'snack' | 'drink'
  | 'lunch' | 'grill' | 'deck' | 'sun' | 'ladder' | 'bridge' | 'child' | 'pet'
  | 'smoke' | 'wine' | 'bottle' | 'shoe' | 'swim' | 'bed' | 'access';

const PATHS: Record<string, string> = {
  anchor: 'M12 7v14M12 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 13a7 7 0 0014 0M3 13h4M17 13h4',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  calendar: 'M7 3v4M17 3v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  users: 'M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  close: 'M18 6L6 18M6 6l12 12',
  menu: 'M3 12h18M3 6h18M3 18h18',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z',
  'heart-filled': 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z',
  'star-empty': 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z',
  'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3z',
  sort: 'M3 6h18M6 12h12M10 18h4',
  check: 'M20 6L9 17l-5-5',
  'check-circle': 'M22 11.1V12a10 10 0 11-5.9-9.1M22 4L12 14l-3-3',
  alert: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ruler: 'M21.3 8.7L8.7 21.3a1 1 0 01-1.4 0l-4.6-4.6a1 1 0 010-1.4L15.3 2.7a1 1 0 011.4 0l4.6 4.6a1 1 0 010 1.4zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2',
  boat: 'M3 18l1.5-6h15L21 18M5 12V7h14v5M12 3v4M2 18c1.5 2 3 3 5 3s3.5-1 5-1 3 1 5 1 3.5-1 5-3',
  message: 'M21 11.5a8.4 8.4 0 01-9 8.4 8.4 8.4 0 01-3.8-.9L3 21l2-4.9A8.4 8.4 0 0112 3a8.4 8.4 0 019 8.5z',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  card: 'M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2zM1 10h22',
  wallet: 'M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4h-4z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  external: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z',
  mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z',
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-8.2-8.2V3h9.4l8.8 8.8a2 2 0 010 2.6zM7 7h.01',
  lock: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 0110 0v4',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  'eye-off': 'M17.9 18A10.1 10.1 0 0112 20C5 20 1 12 1 12a18.5 18.5 0 015.1-6M9.9 4.2A9.1 9.1 0 0112 4c7 0 11 8 11 8a18.6 18.6 0 01-2.2 3.2M14.1 14.1a3 3 0 11-4.2-4.2M1 1l22 22',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',

  // Amenities
  wifi: 'M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 20h.01M1.4 9a15 15 0 0121.2 0',
  snow: 'M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1',
  shower: 'M4 12V6a3 3 0 016 0M2 12h14M12 16v.01M8 18v.01M14 18v.01M10 21v.01M16 15v.01',
  kitchen: 'M6 3v18M6 3a3 3 0 013 3v4H3V6a3 3 0 013-3zM18 3v18M15 3h6v8h-6z',
  fridge: 'M6 2h12a1 1 0 011 1v18a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zM5 10h14M8 6v2M8 13v2',
  stove: 'M4 8h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1zM4 8V5a1 1 0 011-1h14a1 1 0 011 1v3M8 12h8',
  ice: 'M12 2l4 5-4 5-4-5zM12 12l4 5-4 5-4-5z',
  shade: 'M2 12h20M12 12V3M4 12a8 8 0 0116 0M9 21a3 3 0 006 0v-9',
  speaker: 'M6 4h12a1 1 0 011 1v14a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1zM12 15a3 3 0 100-6 3 3 0 000 6zM12 7h.01',
  tv: 'M4 7h16a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM8 3l4 4 4-4',
  gps: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16a4 4 0 100-8 4 4 0 000 8zM12 2v3M12 19v3M2 12h3M19 12h3',
  depth: 'M12 2v14M8 12l4 4 4-4M3 21c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0',
  sonar: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  radar: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 12L18 6M12 12v10',
  auto: 'M12 22a10 10 0 100-20 10 10 0 000 20zM8 12l3 3 5-6',
  thruster: 'M5 12h14M5 12l4-4M5 12l4 4M19 8v8',
  wheel: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 15a3 3 0 100-6 3 3 0 000 6zM12 2v7M12 15v7M2 12h7M15 12h7',
  radio: 'M4 9h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10a1 1 0 011-1zM16 3l-8 6M8 15h.01M12 15h4',
  vest: 'M8 3l4 3 4-3 3 3v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6zM12 6v13',
  dinghy: 'M3 16l2-5h14l2 5M5 11V8h14v3M2 16c1.5 2 3 3 5 3s3.5-1 5-1 3 1 5 1 3.5-1 5-3',
  paddle: 'M6 21l12-12M6 3l3 3M15 3a4 4 0 015.7 5.7L15 14.4 9.6 9z',
  kayak: 'M2 12c4-6 16-6 20 0-4 6-16 6-20 0zM8 8v8M16 8v8',
  jetski: 'M3 17l3-7h10l3 4M6 10V7h8v3M2 18c1.5 1.5 3 2 5 2s3.5-1 5-1 3 1 5 1 3.5-.5 5-2',
  wake: 'M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  ski: 'M6 3v16M12 3v16M18 3v16M3 21h18',
  snorkel: 'M6 8h9a3 3 0 013 3v2M6 8v6a3 3 0 003 3h1M18 13v6M6 8a3 3 0 116 0',
  dive: 'M12 4a3 3 0 100 6 3 3 0 000-6zM12 10v8M8 14h8M9 21l3-3 3 3',
  rod: 'M4 20L20 4M20 4v5M20 4h-5M8 16l-3 5',
  bait: 'M12 22a10 10 0 100-20 10 10 0 000 20zM8 10h.01M12 6c-2 4-2 8 0 12',
  knife: 'M4 20L14 10M14 10l6-6v4l-4 4M4 20h4',
  snack: 'M4 8h16l-2 12H6zM8 8V5a4 4 0 018 0v3',
  drink: 'M5 4h14l-2 8H7zM12 12v8M8 20h8',
  lunch: 'M3 12h18M12 3v9M5 12a7 7 0 0014 0M3 21h18',
  grill: 'M4 6h16l-3 9H7zM9 15l-2 6M15 15l2 6M9 3v2M15 3v2',
  deck: 'M3 8h18M3 12h18M3 16h18M6 4v16M18 4v16',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  ladder: 'M7 2v20M17 2v20M7 7h10M7 12h10M7 17h10',
  bridge: 'M3 18h18M5 18V9M19 18V9M3 9a9 9 0 0118 0M12 9v9',
  child: 'M12 6a2 2 0 100-4 2 2 0 000 4zM9 21v-6H8V9a2 2 0 012-2h4a2 2 0 012 2v6h-1v6',
  pet: 'M5.5 11a2 2 0 100-4 2 2 0 000 4zM18.5 11a2 2 0 100-4 2 2 0 000 4zM9 7a2 2 0 100-4 2 2 0 000 4zM15 7a2 2 0 100-4 2 2 0 000 4zM12 12c-3 0-5 2.5-5 5a3 3 0 003 3h4a3 3 0 003-3c0-2.5-2-5-5-5z',
  smoke: 'M3 18h14a3 3 0 000-6M18 12V8a3 3 0 00-3-3M3 18v3h18v-3M21 12v6',
  wine: 'M8 3h8l-1 7a3 3 0 01-6 0zM12 13v7M9 20h6',
  bottle: 'M10 2h4v4l2 3v13H8V9l2-3zM8 13h8',
  shoe: 'M2 17h13l5-2v4H2zM2 17V9h4l3 4h5',
  swim: 'M2 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0M6 13l4-3 4 3M17 8a2 2 0 100-4 2 2 0 000 4z',
  bed: 'M2 20V8M2 13h20v7M22 20v-6a3 3 0 00-3-3h-9v9M7 12a2 2 0 100-4 2 2 0 000 4z',
  access: 'M12 5a2 2 0 100-4 2 2 0 000 4zM10 7v6h5l3 7M10 10h5M8 13a5 5 0 105 8',
};

const FILLED = new Set(['heart-filled', 'star']);

export interface IconProps {
  name: IconName | string;
  size?: number;
  className?: string;
  /** Icons are decorative by default; pass a label to expose one to AT. */
  label?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, className = '', label, strokeWidth = 1.7 }: IconProps) {
  // An unmapped amenity key still renders something sensible.
  const path = PATHS[name] ?? PATHS.check;
  const filled = FILLED.has(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
