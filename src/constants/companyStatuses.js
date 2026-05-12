export const COMPANY_STATUSES = {
  new:        { label: 'Nový',          color: '#0066ff', bg: 'rgba(0,102,255,0.1)' },
  contacted:  { label: 'Kontaktovaný', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)' },
  offer:      { label: 'Ponuka',        color: '#cc00ff', bg: 'rgba(204,0,255,0.1)' },
  closed:     { label: 'Uzavreté',      color: '#00cc88', bg: 'rgba(0,204,136,0.1)' },
  rejected:   { label: 'Zamietnutý',   color: '#ff3333', bg: 'rgba(255,51,51,0.1)' },
}

export const STATUS_LIST = Object.entries(COMPANY_STATUSES).map(([key, val]) => ({ key, ...val }))
