import { saveDraft } from './firebaseService.js'

export function generateEmailDraft(company) {
  const isLaundry = company.category === 'laundry'
  const subject = isLaundry
    ? 'Senkung Ihrer Heizkosten in der Wäscherei – STRIKER Technologie'
    : 'Reduzierung Ihrer Heizkosten – STRIKER Wärmetechnologie'

  const body = `Sehr geehrte Damen und Herren,

mein Name ist Adolf Staubert, ich bin Entwickler einer patentierten industriellen Heiztechnologie namens STRIKER.

${isLaundry
    ? 'Industriewäschereien gehören zu den energieintensivsten Betrieben – unser System kann Ihren Wärmeenergiebedarf drastisch senken.'
    : `Für ${company.name} bietet STRIKER ein erhebliches Einsparpotenzial.`}

Unser System erzeugt bei einem elektrischen Verbrauch von nur 45 kW eine Wärmeleistung von 120–160 kW – das entspricht einer Einsparung von bis zu 70% gegenüber herkömmlichen Heizsystemen.

Preis: ab 8.000 EUR, Lieferzeit 6–8 Wochen.

Darf ich mich kurz telefonisch bei Ihnen melden?

Mit freundlichen Grüßen
Adolf Staubert
STRIKER Wärmetechnologie
Tel: +49 171 4758126
E-Mail: info@striker-energy.de`

  return { subject, body }
}

export async function createDraft(company) {
  const { subject, body } = generateEmailDraft(company)
  await saveDraft(company.id, company.name, subject, body)
  return { subject, body }
}
