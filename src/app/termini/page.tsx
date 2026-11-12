import Link from "next/link";
import { LegalPage, OwnerLine, SupportLink } from "@/components/legal-page";
import { SITE_NAME } from "@/components/logo";

export const metadata = { title: "Termini d'uso", description: `Le regole per usare ${SITE_NAME}.` };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termini d'uso"
      intro={`Usando ${SITE_NAME} accetti queste regole. Sono scritte per tenere il gioco corretto per tutti: se non le condividi, non usare il sito.`}
    >
      <section>
        <h2>1. Il servizio</h2>
        <p>
          {SITE_NAME} permette di consultare classifiche, tornei e risultati di tennis tavolo e, con un account, di partecipare alle leghe,
          gestire amicizie e inserire o consultare le proprie partite. Il servizio è gestito da <OwnerLine />.
        </p>
      </section>

      <section>
        <h2>2. Account</h2>
        <ul>
          <li>Per registrarti devi fornire dati veri e aggiornati. Puoi avere un solo account personale.</li>
          <li>Sei responsabile della riservatezza della password e di ciò che avviene con il tuo account: se sospetti un uso non autorizzato, scrivici subito.</li>
          <li>Se hai meno di 14 anni serve il consenso di un genitore o di chi ne fa le veci.</li>
        </ul>
      </section>

      <section>
        <h2>3. Comportamento corretto</h2>
        <p>Non devi:</p>
        <ul>
          <li>inserire risultati falsi o alterare classifiche e punteggi Elo;</li>
          <li>usare l&apos;identità o i dati di un&apos;altra persona;</li>
          <li>caricare foto o testi offensivi, illeciti o che violano diritti di terzi (la foto profilo deve ritrarre te e non essere inappropriata);</li>
          <li>tentare di accedere ad aree riservate, aggirare i limiti di sicurezza o sovraccaricare il sito con accessi automatici;</li>
          <li>usare il sito per scopi illeciti o commerciali non autorizzati.</li>
        </ul>
        <p>Chi gestisce una lega o un torneo può correggere o annullare risultati e rimuovere iscrizioni, per mantenere la correttezza delle classifiche.</p>
      </section>

      <section>
        <h2>4. Contenuti e visibilità</h2>
        <p>
          Mantieni i diritti sulla tua foto e sui contenuti che carichi, e ci concedi il permesso (non esclusivo e gratuito) di mostrarli sul sito
          per il solo scopo di fornire il servizio. Ricorda che nome, circolo, foto, punteggi e risultati sono pubblici, come spiegato nell&apos;
          <Link href="/privacy" className="underline hover:text-brand">Informativa privacy</Link>.
        </p>
        <p>Il nome, il logo e la grafica di {SITE_NAME} sono del gestore e non si possono riutilizzare senza permesso.</p>
      </section>

      <section>
        <h2>5. Punteggi e classifiche</h2>
        <p>
          Il punteggio Elo e le classifiche sono calcolati automaticamente dai risultati inseriti e hanno valore puramente amichevole e sportivo.
          Possono essere ricalcolati se un risultato viene corretto, e non danno diritto a premi o rimborsi salvo quanto stabilito dagli organizzatori di ciascun torneo.
        </p>
      </section>

      <section>
        <h2>6. Disponibilità e responsabilità</h2>
        <p>
          Il servizio è fornito «così com&apos;è», senza garanzia di funzionamento continuo o privo di errori; può essere sospeso per manutenzione o modificato.
          Nei limiti consentiti dalla legge, il gestore non risponde di danni indiretti derivanti dall&apos;uso o dal mancato uso del sito, né di
          ciò che gli utenti pubblicano. Restano ferme le responsabilità che la legge non permette di escludere, in particolare verso i consumatori.
        </p>
      </section>

      <section>
        <h2>7. Sospensione e chiusura dell&apos;account</h2>
        <p>
          Puoi smettere di usare il sito e chiedere la cancellazione dell&apos;account scrivendo a <SupportLink />.
          Possiamo sospendere o chiudere un account che violi queste regole, dandoti se possibile una spiegazione.
        </p>
      </section>

      <section>
        <h2>8. Modifiche ai termini</h2>
        <p>
          Possiamo aggiornare questi termini; la data in alto indica l&apos;ultima versione. Se continui a usare il sito dopo una modifica, la accetti.
          Per le modifiche rilevanti ti avviseremo sul sito o via email.
        </p>
      </section>

      <section>
        <h2>9. Legge applicabile e contatti</h2>
        <p>
          Questi termini sono regolati dalla legge italiana. Se sei un consumatore restano valide le norme inderogabili del tuo Paese di residenza
          e il foro del consumatore. Per domande o segnalazioni scrivi a <SupportLink />.
        </p>
      </section>
    </LegalPage>
  );
}
