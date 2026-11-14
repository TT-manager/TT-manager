import { dict } from "../locale";

/** Pagine legali (privacy e termini): cornice, titoli e testi di ripiego. */
export const legalText = dict({
  home: "Home",
  lastUpdated: "Ultimo aggiornamento:",
  translationNote: "",
  supportFallback: "l'indirizzo di assistenza indicato nel sito",
  ownerFallback: "Il gestore del sito",
  privacyTitle: "Informativa privacy",
  privacyDescription: (site: string) => `Come ${site} tratta i tuoi dati personali.`,
  termsTitle: "Termini d'uso",
  termsDescription: (site: string) => `Le regole per usare ${site}.`,
}, {
  home: "Home",
  lastUpdated: "Last updated:",
  translationNote: "This is a translation provided for convenience. In case of any difference, the Italian version prevails.",
  supportFallback: "the support address shown on the site",
  ownerFallback: "The site operator",
  privacyTitle: "Privacy policy",
  privacyDescription: (site: string) => `How ${site} handles your personal data.`,
  termsTitle: "Terms of use",
  termsDescription: (site: string) => `The rules for using ${site}.`,
});
