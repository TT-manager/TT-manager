import Link from "next/link";
import { LegalPage, OwnerLine, SupportLink } from "@/components/legal-page";
import { SITE_NAME } from "@/components/logo";

export const metadata = { title: "Informativa privacy", description: `Come ${SITE_NAME} tratta i tuoi dati personali.` };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa privacy"
      intro={`Questa informativa spiega quali dati personali raccoglie ${SITE_NAME}, perché, per quanto tempo e quali sono i tuoi diritti (Regolamento UE 2016/679, «GDPR», e D.Lgs. 196/2003).`}
    >
      <section>
        <h2>1. Chi è il titolare del trattamento</h2>
        <p><OwnerLine /></p>
        <p>Per qualsiasi richiesta sui tuoi dati puoi scrivere a <SupportLink />.</p>
      </section>

      <section>
        <h2>2. Quali dati trattiamo</h2>
        <ul>
          <li><strong>Dati dell&apos;account</strong>: nome e cognome, email, password (conservata in forma cifrata, non leggibile da noi), circolo sportivo se lo indichi.</li>
          <li><strong>Foto profilo</strong>, solo se la carichi tu. È facoltativa.</li>
          <li><strong>Dati sportivi</strong>: iscrizioni a leghe e tornei, risultati delle partite, punteggio di ranking e relativo storico, posizione in classifica.</li>
          <li><strong>Rete sociale</strong>: amicizie e richieste di amicizia con altri giocatori, richieste di partecipazione alle leghe.</li>
          <li><strong>Dati tecnici</strong>: per proteggere l&apos;accesso degli organizzatori ai tornei conserviamo, per un periodo limitato, un&apos;impronta cifrata (hash) dell&apos;indirizzo IP per contare i tentativi di accesso errati. Non salviamo l&apos;IP in chiaro a questo scopo.</li>
          <li><strong>Messaggi</strong> che ci invii scrivendo all&apos;assistenza.</li>
        </ul>
        <p>Non raccogliamo dati particolari (come quelli sulla salute) né chiediamo documenti d&apos;identità.</p>
      </section>

      <section>
        <h2>3. Perché li trattiamo e su quale base</h2>
        <ul>
          <li><strong>Creare e gestire il tuo account</strong>, farti partecipare a leghe e tornei, calcolare classifiche e ranking: esecuzione del servizio che hai richiesto (art. 6.1.b GDPR).</li>
          <li><strong>Sicurezza e prevenzione degli abusi</strong>, ad esempio limitare i tentativi di accesso ripetuti: legittimo interesse del titolare (art. 6.1.f).</li>
          <li><strong>Rispondere alle tue richieste</strong> di assistenza: esecuzione del servizio o legittimo interesse.</li>
          <li><strong>Obblighi di legge</strong>, se previsti (art. 6.1.c).</li>
          <li><strong>Foto profilo</strong>: il consenso che dai caricandola (art. 6.1.a); puoi sostituirla o toglierla quando vuoi.</li>
        </ul>
        <p>Non facciamo profilazione né decisioni automatizzate con effetti giuridici su di te. Il punteggio di ranking è un calcolo sportivo sui risultati delle partite.</p>
      </section>

      <section>
        <h2>4. Cosa è visibile agli altri</h2>
        <p>
          {SITE_NAME} è pensato per mostrare classifiche e risultati: <strong>nome e cognome, circolo, foto profilo (se presente), punteggio, storico e risultati delle partite</strong> sono
          visibili a chiunque visiti il sito, anche senza account. La tua email e la tua password non sono mai pubbliche.
          Se non vuoi comparire, scrivici: valuteremo la rimozione o l&apos;anonimizzazione dei tuoi dati dalle pagine pubbliche.
        </p>
      </section>

      <section>
        <h2>5. Con chi condividiamo i dati</h2>
        <p>Non vendiamo i tuoi dati. Per far funzionare il sito ci affidiamo a fornitori che trattano i dati per nostro conto, in qualità di responsabili del trattamento:</p>
        <ul>
          <li><strong>Supabase</strong>: database, autenticazione e archiviazione delle foto.</li>
          <li><strong>Vercel</strong>: hosting e distribuzione del sito.</li>
        </ul>
        <p>
          Questi fornitori possono trattare dati anche fuori dallo Spazio Economico Europeo. In tal caso il trasferimento avviene con garanzie adeguate,
          come le clausole contrattuali tipo della Commissione europea o una decisione di adeguatezza.
        </p>
        <p>Gli organizzatori e gli amministratori delle leghe vedono i dati necessari a gestirli (iscritti, richieste, risultati).</p>
      </section>

      <section>
        <h2>6. Per quanto tempo conserviamo i dati</h2>
        <ul>
          <li>I dati dell&apos;account e quelli sportivi, finché mantieni l&apos;account. Se chiedi la cancellazione li eliminiamo o li rendiamo anonimi, salvo ciò che la legge ci obbliga a conservare.</li>
          <li>Le impronte dei tentativi di accesso degli organizzatori, solo per la breve finestra utile al controllo.</li>
          <li>I messaggi all&apos;assistenza, per il tempo necessario a gestire la richiesta.</li>
        </ul>
      </section>

      <section>
        <h2>7. Cookie</h2>
        <p>
          Usiamo esclusivamente <strong>cookie tecnici</strong>, necessari al funzionamento: quello di sessione che ti mantiene collegato dopo il login
          e quello che permette a un organizzatore di restare autenticato sul proprio torneo. Non usiamo cookie di profilazione, pubblicità o analisi di terze parti,
          perciò non serve un banner di consenso.
        </p>
      </section>

      <section>
        <h2>8. I tuoi diritti</h2>
        <p>Puoi in ogni momento chiedere:</p>
        <ul>
          <li>l&apos;accesso ai tuoi dati e una copia (art. 15);</li>
          <li>la rettifica dei dati inesatti (art. 16);</li>
          <li>la cancellazione (art. 17);</li>
          <li>la limitazione del trattamento (art. 18);</li>
          <li>la portabilità dei dati che ci hai fornito (art. 20);</li>
          <li>di opporti al trattamento basato sul legittimo interesse (art. 21);</li>
          <li>di revocare il consenso, senza effetti sul trattamento già avvenuto (art. 7).</li>
        </ul>
        <p>
          Scrivi a <SupportLink />: rispondiamo entro un mese. Una parte dei dati (nome, circolo, foto) puoi correggerla da solo nel tuo <Link href="/profilo" className="underline hover:text-brand">profilo</Link>.
          Hai anche il diritto di proporre reclamo al <a href="https://www.garanteprivacy.it" className="underline hover:text-brand" rel="noopener noreferrer" target="_blank">Garante per la protezione dei dati personali</a>.
        </p>
      </section>

      <section>
        <h2>9. Minori</h2>
        <p>
          In Italia un minore di 14 anni può registrarsi solo con il consenso di chi esercita la responsabilità genitoriale.
          Se pensi che un minore si sia iscritto senza questo consenso, scrivici e rimuoveremo l&apos;account.
        </p>
      </section>

      <section>
        <h2>10. Sicurezza</h2>
        <p>
          Adottiamo misure tecniche adeguate: connessione cifrata (HTTPS), password conservate in forma cifrata, permessi di accesso ai dati limitati per ruolo
          e operazioni sensibili eseguite solo lato server. Nessun sistema è però sicuro al 100%: scegli una password robusta e non riutilizzarla altrove.
        </p>
      </section>

      <section>
        <h2>11. Modifiche</h2>
        <p>
          Possiamo aggiornare questa informativa. La data in alto indica l&apos;ultima versione; per le modifiche rilevanti ti avviseremo sul sito o via email.
          Leggi anche i <Link href="/termini" className="underline hover:text-brand">Termini d&apos;uso</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
