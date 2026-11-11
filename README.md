# Campionato di tennis tavolo

Applicazione web per gestire un campionato: classifica generale Elo, tornei con gironi
e tabellone a eliminazione, inserimento dei risultati da parte degli organizzatori.

## Come si usa

- **Pubblico**: la home mostra la classifica generale; ogni giocatore ha una pagina con lo
  storico del rating. Con il codice torneo (6 caratteri) si apre `/t/CODICE`: gironi,
  classifiche, tabellone e risultati, aggiornati automaticamente.
- **Organizzatore** (senza account): dalla pagina del torneo, «Inserisci risultati», con il
  codice organizzatore ricevuto dall'admin.
- **Amministratori** (`/login`): giocatori, tornei (formato configurabile: gironi, set per
  fase, chi passa e in quale turno entra), iscrizioni, generazione dei gironi, correzione dei
  risultati, chiusura del torneo (applica l'Elo) e riapertura. Il proprietario gestisce gli admin.

## Sviluppo

```bash
npm install
cp .env.example .env.local   # poi inserisci la chiave segreta solo se ti serve in locale
npm run dev
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Next.js (App Router, Cache Components) e Supabase. Prima di scrivere codice Next leggi
`node_modules/next/dist/docs/` (vedi `AGENTS.md`).

- `src/lib/domain/`: logica pura con test (Elo, gironi, formato, tabellone, punteggi).
- `supabase/migrations/`: schema del database, nell'ordine in cui è stato applicato.

## Sicurezza (in breve)

- Lettura pubblica; scritture degli admin protette dalla RLS (`private.is_admin()`).
- Il codice organizzatore è mostrato una sola volta; nel database c'è solo l'impronta scrypt.
  Verifica, limite ai tentativi, sessioni e tutte le scritture dei risultati avvengono sul
  server con la chiave segreta (`SUPABASE_SECRET_KEY`), mai dal browser.
- Chiusura e riapertura dei tornei sono funzioni SQL atomiche, eseguibili solo dal server.
