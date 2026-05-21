// Division B — intelligence constants

export const INTEL_STATUSES = {
  new:        { key: 'new',        label: 'Nový target',          color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  analyzed:   { key: 'analyzed',   label: 'Analyzovaný',          color: '#00cc88', bg: 'rgba(0,204,136,0.1)'   },
  ready:      { key: 'ready',      label: 'Pripravený',           color: '#ffaa00', bg: 'rgba(255,170,0,0.1)'   },
  contacted:  { key: 'contacted',  label: 'Kontaktovaný',         color: '#ff5c00', bg: 'rgba(255,92,0,0.1)'    },
  replied:    { key: 'replied',    label: 'Odpovedal',            color: '#00cc88', bg: 'rgba(0,204,136,0.1)'   },
  followup:   { key: 'followup',   label: 'Follow-up',            color: '#ffaa00', bg: 'rgba(255,170,0,0.1)'   },
  unsuitable: { key: 'unsuitable', label: 'Nevhodný',             color: '#4b5563', bg: 'rgba(75,85,99,0.1)'    },
}

export const INTEL_STATUS_LIST = Object.values(INTEL_STATUSES)

export const REC_META = {
  immediate:     { label: 'Kontaktovať okamžite',        color: '#00cc88', icon: '✅' },
  monitor:       { label: 'Sledovať',                    color: '#ffaa00', icon: '◉'  },
  unsuitable:    { label: 'Nevhodný',                    color: '#4b5563', icon: '✗'  },
  prepare_offer: { label: 'Pripraviť ponuku',            color: '#818cf8', icon: '📋' },
}

export const SEGMENTS = [
  { value: 'hotel',      label: '🏨 Hotel / Ubytovanie'      },
  { value: 'wellness',   label: '💆 Wellness / Spa'          },
  { value: 'laundry',    label: '🧺 Priemyselná práčovňa'    },
  { value: 'hospital',   label: '🏥 Nemocnica / Klinika'     },
  { value: 'restaurant', label: '🍽️ Reštaurácia / Gastro'   },
  { value: 'food',       label: '🏭 Potravinárstvo'           },
  { value: 'brewery',    label: '🍺 Pivovar'                  },
  { value: 'industrial', label: '⚙️ Priemysel / Iné'         },
]

export const SEGMENT_LABELS = Object.fromEntries(SEGMENTS.map(s => [s.value, s.label]))

export const COUNTRIES = [
  { value: 'DE', label: '🇩🇪 Nemecko'    },
  { value: 'AT', label: '🇦🇹 Rakúsko'    },
  { value: 'CH', label: '🇨🇭 Švajčiarsko' },
  { value: 'SK', label: '🇸🇰 Slovensko'  },
  { value: 'CZ', label: '🇨🇿 Česko'      },
]

export function scoreColor(s) {
  return s >= 70 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ef4444'
}
