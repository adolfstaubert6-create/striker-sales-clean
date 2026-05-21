// Zdieľané konštanty pre STRIKER INTELLIGENCE — Division B

export const SEGMENTS = [
  { value: 'hotel',      label: '🏨 Hotel / Ubytovanie' },
  { value: 'wellness',   label: '💆 Wellness / Spa / Kúpele' },
  { value: 'laundry',    label: '🧺 Priemyselná práčovňa' },
  { value: 'hospital',   label: '🏥 Nemocnica / Klinika' },
  { value: 'restaurant', label: '🍽️ Reštaurácia / Gastro' },
  { value: 'food',       label: '🏭 Potravinárstvo / Výroba' },
  { value: 'brewery',    label: '🍺 Pivovar' },
  { value: 'dryer',      label: '🌾 Sušiareň / Agrárna prevádzka' },
  { value: 'industrial', label: '⚙️ Priemysel / Iné' },
]

export const SEGMENT_LABELS = {
  hotel: 'Hotel / Ubytovanie', wellness: 'Wellness / Spa / Kúpele',
  laundry: 'Priemyselná práčovňa', hospital: 'Nemocnica / Klinika',
  restaurant: 'Reštaurácia / Gastro', food: 'Potravinárstvo / Výroba',
  brewery: 'Pivovar', dryer: 'Sušiareň / Agrárna prevádzka', industrial: 'Priemysel / Iné',
}

export const SEGMENT_ICON = {
  hotel: '🏨', wellness: '💆', laundry: '🧺', hospital: '🏥',
  restaurant: '🍽️', food: '🏭', brewery: '🍺', dryer: '🌾', industrial: '⚙️',
}

export const COUNTRIES = [
  { value: 'DE', label: '🇩🇪 Nemecko' },
  { value: 'AT', label: '🇦🇹 Rakúsko' },
  { value: 'CH', label: '🇨🇭 Švajčiarsko' },
  { value: 'SK', label: '🇸🇰 Slovensko' },
  { value: 'CZ', label: '🇨🇿 Česko' },
]

export const INTEL_STATUSES = [
  { key: 'new',        label: 'Nový target',          color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.35)' },
  { key: 'analyzed',   label: 'Analyzovaná',           color: '#00cc88', bg: 'rgba(0,204,136,0.12)',   border: 'rgba(0,204,136,0.35)'   },
  { key: 'ready',      label: 'Pripravená na kontakt', color: '#ffaa00', bg: 'rgba(255,170,0,0.12)',   border: 'rgba(255,170,0,0.35)'   },
  { key: 'contacted',  label: 'Kontaktovaná',          color: '#ff5c00', bg: 'rgba(255,92,0,0.12)',    border: 'rgba(255,92,0,0.35)'    },
  { key: 'replied',    label: 'Odpovedala',            color: '#00cc88', bg: 'rgba(0,204,136,0.12)',   border: 'rgba(0,204,136,0.35)'   },
  { key: 'followup',   label: 'Follow-up',             color: '#ffaa00', bg: 'rgba(255,170,0,0.12)',   border: 'rgba(255,170,0,0.35)'   },
  { key: 'unsuitable', label: 'Nevhodná',              color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'   },
]

export const STATUS_MAP = Object.fromEntries(INTEL_STATUSES.map(s => [s.key, s]))

export const REC_META = {
  immediate:     { label: 'Kontaktovať okamžite',       color: '#00cc88', bg: 'rgba(0,204,136,0.1)',    border: '#00cc8866', icon: '✅' },
  monitor:       { label: 'Sledovať',                   color: '#ffaa00', bg: 'rgba(255,170,0,0.1)',     border: '#ffaa0066', icon: '◉'  },
  unsuitable:    { label: 'Nevhodné',                   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',     border: '#ef444466', icon: '✗'  },
  prepare_offer: { label: 'Pripraviť individuálnu ponuku', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: '#818cf866', icon: '📋' },
}

export const INTENT_META = {
  weak:   { label: 'Slabý záujem', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: '#6b728055' },
  medium: { label: 'Stredný záujem', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: '#ffaa0055' },
  strong: { label: 'Silný záujem',  color: '#00cc88', bg: 'rgba(0,204,136,0.1)', border: '#00cc8855' },
}

export const SOURCE_TYPES = [
  { value: 'web',         label: '🌐 Webová stránka' },
  { value: 'article',     label: '📰 Článok / Správa' },
  { value: 'job_posting', label: '💼 Pracovná ponuka' },
  { value: 'pdf',         label: '📄 PDF / Dokument' },
  { value: 'tender',      label: '📋 Tender / Výberové konanie' },
  { value: 'social',      label: '💬 LinkedIn / Sociálne siete' },
  { value: 'other',       label: '📎 Iné' },
]

export const CONTACT_ROLES = [
  'CEO / Generálny riaditeľ',
  'Geschäftsführer / Konateľ',
  'Facility Manager',
  'Energy Manager',
  'Technical Director',
  'Operations Manager',
  'CFO / Finančný riaditeľ',
  'Správca budov',
  'Iné',
]

export function scoreColor(s) {
  return s >= 70 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ef4444'
}
