// Slovak locale — default language
export const sk = {
  // Language meta
  code: 'sk',
  label: 'SK',

  // AI button & status
  aiBtn:          '🧠 AI Analýza',
  analyzing:      '⏳ Analyzujem...',
  done:           '✓ AI analýza hotová',
  doneFallback:   '✓ AI analýza (záložná)',
  error:          '⚠ Chyba analýzy',
  placeholder:    "Klikni „🧠 AI Analýza" pre vygenerovanie sales analýzy.",

  // Score
  scoreSuffix:    'STRIKER FIT',
  fallbackBadge:  'ZÁLOŽNÁ',

  // Section titles
  sections: {
    painPoints:  'Pain Points',
    reasoning:   'AI Reasoning',
    argument:    'Hlavný argument',
    opportunity: 'Príležitosť',
    draft:       'Email Draft',
  },

  // Draft note (email always in DE — sent to German companies)
  draftLang:  'DE',
  draftNote:  '(Email je v nemčine — odosielaný nemeckým firmám)',

  // Language switcher label
  langLabel: 'Jazyk analýzy',

  // Claude output instruction (injected into prompt)
  promptLang: `Write reasoning, painPoints, mainArgument, opportunity in Slovak (Slovenčina).
Email draft MUST be in German (Deutsch) — it will be sent to a German company.`,
}
