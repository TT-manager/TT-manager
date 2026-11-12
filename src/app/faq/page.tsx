import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Domande frequenti",
  description: "Come funzionano PongFu, le leghe, i tornei, i punti in classifica e gli amichevoli.",
};

type QA = { q: string; a: ReactNode };
const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: "Per iniziare",
    items: [
      { q: "Che cos'è PongFu?", a: <>Un sito per organizzare il tennis tavolo tra amici e nei circoli: leghe con la loro classifica a punti, tornei con gironi e tabellone seguiti in diretta, e tornei amichevoli da creare in un minuto.</> },
      { q: "Come mi registro?", a: <>Clicca <Link href="/registrati" className="link">Registrati</Link>, inserisci nome, email e password. Ti arriva un&apos;email: apri il link per confermare l&apos;indirizzo (funziona anche se la apri dal telefono). Da quel momento puoi accedere.</> },
      { q: "Non mi è arrivata l'email", a: <>Controlla nello spam o nelle promozioni e aspetta qualche minuto. Il mittente è <strong>PongFu</strong>. Se proprio non arriva, prova ad accedere o usa <Link href="/password-dimenticata" className="link">Password dimenticata</Link> con lo stesso indirizzo.</> },
      { q: "Ho dimenticato la password", a: <>Vai su <Link href="/password-dimenticata" className="link">Password dimenticata</Link>: ti mandiamo un link per sceglierne una nuova.</> },
      { q: "Devo registrarmi per seguire un torneo?", a: <>No. Classifiche, gironi e tabelloni si vedono anche senza account: basta il link del torneo, oppure il suo codice da scrivere nella home, nel riquadro «Hai il codice di un torneo?».</> },
    ],
  },
  {
    title: "Leghe",
    items: [
      { q: "Che cos'è una lega?", a: <>Un gruppo di giocatori che gioca più tornei nel tempo. Ogni lega ha la sua classifica a punti, che si aggiorna torneo dopo torneo, e un albo d&apos;oro. Una lega è di singolare o di doppio.</> },
      { q: "Come entro in una lega?", a: <>Se hai ricevuto un <strong>link d&apos;invito</strong>, aprilo e registrati: entri subito. Altrimenti, dalla pagina della lega o dal tuo profilo clicca <strong>Chiedi di partecipare</strong>: un amministratore della lega approva la richiesta.</> },
      { q: "Ero già in classifica prima di registrarmi", a: <>Quando chiedi di partecipare, scegli il tuo nome alla voce «Sei già in classifica?»: l&apos;amministratore collega il tuo account a quel giocatore, così tieni punti e storico.</> },
      { q: "Chi vede la mia lega?", a: <>Le leghe <strong>pubbliche</strong> compaiono nella home di tutti. Le altre compaiono solo nella home di chi ne fa parte.</> },
      { q: "Come si crea una lega?", a: <>Le leghe le crea il gestore del sito, che può poi affidarle ad altri amministratori. Se vuoi aprirne una per il tuo gruppo o il tuo circolo, contatta chi ti ha invitato su PongFu.</> },
    ],
  },
  {
    title: "Tornei",
    items: [
      { q: "Come mi iscrivo a un torneo?", a: <>Quando un torneo della tua lega ha le <strong>iscrizioni aperte</strong>, nella sua pagina trovi il riquadro «Iscriviti» (in doppio scegli anche il compagno). Puoi iscriverti o ritirarti fino alla scadenza. Se le iscrizioni non sono aperte, ti iscrive l&apos;organizzatore.</> },
      { q: "Come funziona un torneo?", a: <>Di solito ci sono due fasi. Nella <strong>qualificazione</strong> si gioca a gironi, tutti contro tutti. I migliori di ogni girone passano alla <strong>fase finale</strong>, a eliminazione diretta, fino alla finale. Nella pagina del torneo le trovi in due schede separate.</> },
      { q: "Come si ordina un girone?", a: <>Ogni vittoria vale 2 punti e ogni sconfitta 1. Se due giocatori sono a pari punti conta lo scontro diretto; altrimenti la differenza tra set vinti e persi e poi quella tra punti fatti e subiti. Questi punti servono solo per il girone: non sono i punti della classifica della lega.</> },
      { q: "Chi inserisce i risultati?", a: <>L&apos;organizzatore del torneo: gli amministratori della lega oppure, per gli amichevoli, chi li ha creati. Tutti gli altri vedono i risultati aggiornarsi in diretta.</> },
      { q: "Che differenza c'è tra torneo valido e amichevole?", a: <>Un torneo <strong>valido per la classifica</strong> sposta i punti della lega quando viene chiuso. Un torneo <strong>amichevole</strong> si gioca per divertimento: non tocca nessuna classifica e non entra nello storico della lega.</> },
    ],
  },
  {
    title: "Punti e classifica",
    items: [
      { q: "Come si guadagnano e si perdono i punti?", a: <>Ogni partita di un torneo valido sposta punti da chi perde a chi vince: battere un avversario più forte vale di più, perdere contro uno più debole costa di più. Nella pagina di ogni lega, sotto la classifica, trovi la spiegazione completa con i numeri di quella lega e una tabella di esempi.</> },
      { q: "Perché ho perso punti senza giocare?", a: <>In molte leghe chi salta un torneo perde una piccola parte dei punti che ha sopra una certa soglia, così la classifica premia chi gioca. Se eri infortunato o fuori per lavoro, chiedi all&apos;amministratore di segnare l&apos;assenza: in quel periodo non perdi nulla.</> },
      { q: "Quando si aggiorna la classifica?", a: <>Quando l&apos;organizzatore chiude il torneo. Se un risultato era sbagliato, può riaprirlo, correggerlo e richiuderlo: la classifica viene ricalcolata da capo.</> },
      { q: "Il punteggio dei set conta?", a: <>Per la classifica della lega conta solo chi vince la partita. I set servono a ordinare i gironi.</> },
    ],
  },
  {
    title: "Amici e amichevoli",
    items: [
      { q: "Come aggiungo un amico?", a: <>Vai su <Link href="/amici" className="link">Amici</Link>, cerca nome o cognome e invia la richiesta. Quando l&apos;altro la accetta, siete amici.</> },
      { q: "Come creo un torneo amichevole?", a: <>Da <Link href="/amichevole/nuovo" className="link">Crea un torneo amichevole</Link>. Puoi iscrivere te stesso, i tuoi amici e anche degli <strong>ospiti</strong> senza account (basta il nome). Puoi avere fino a 10 amichevoli aperti alla volta.</> },
    ],
  },
  {
    title: "Il tuo profilo",
    items: [
      { q: "Come cambio foto o nome?", a: <>Dal <Link href="/profilo" className="link">tuo profilo</Link>: puoi caricare una foto e cambiare il nome con cui compari nelle classifiche.</> },
      { q: "Il mio circolo non è in elenco", a: <>Nel profilo (o in registrazione) scegli «Il mio circolo non è in elenco…» e scrivi nome e città. Il gestore del sito controlla la richiesta e, se la approva, il circolo viene aggiunto al tuo profilo e all&apos;elenco.</> },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold uppercase">Domande frequenti</h1>
      <p className="mt-2 text-muted">Come funziona PongFu, in breve. Se non trovi la risposta, chiedi a chi organizza la tua lega.</p>
      <nav aria-label="Argomenti" className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s, i) => <a key={s.title} href={`#s${i}`} className="badge-muted hover:text-brand">{s.title}</a>)}
      </nav>
      {SECTIONS.map((s, i) => (
        <section key={s.title} id={`s${i}`} className="mt-10 scroll-mt-24">
          <h2 className="text-2xl font-bold uppercase">{s.title}</h2>
          <div className="card mt-3 divide-y divide-line !py-1">
            {s.items.map((x) => (
              <details key={x.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {x.q}<span aria-hidden="true" className="text-muted transition group-open:rotate-90">›</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{x.a}</p>
              </details>))}
          </div>
        </section>))}
    </main>
  );
}
