/** Nome confrontabile: minuscole, senza accenti, spazi ripuliti («  Mario  Rossì » → «mario rossi»). */
export function normName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Giocatore con lo stesso nome (nome e cognome anche in ordine inverso), se ce n'è uno solo. */
export function sameNameMatch<T extends { name: string }>(name: string, candidates: T[]): T | null {
  const n = normName(name);
  if (!n) return null;
  const flip = n.split(" ").reverse().join(" ");
  const hits = candidates.filter((c) => { const m = normName(c.name); return m === n || m === flip; });
  return hits.length === 1 ? hits[0] : null;
}
