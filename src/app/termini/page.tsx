import Link from "next/link";
import { LegalPage, OwnerLine, SupportLink } from "@/components/legal-page";
import { SITE_NAME } from "@/components/logo";
import { getLocale, tr } from "@/i18n/server";
import { legalText } from "@/i18n/dict/legal-common";

export async function generateMetadata() {
  const t = await tr(legalText);
  return { title: t.termsTitle, description: t.termsDescription(SITE_NAME) };
}

export default async function TermsPage() {
  return (await getLocale()) === "en" ? <TermsEn /> : <TermsIt />;
}

function TermsIt() {
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
          <li>inserire risultati falsi o alterare classifiche e punteggi di ranking;</li>
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
          Il punteggio di ranking e le classifiche sono calcolati automaticamente dai risultati inseriti e hanno valore puramente amichevole e sportivo.
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

function TermsEn() {
  return (
    <LegalPage
      title="Terms of use"
      intro={`By using ${SITE_NAME} you accept these rules. They are written to keep the game fair for everyone: if you do not agree with them, please do not use the site.`}
    >
      <section>
        <h2>1. The service</h2>
        <p>
          {SITE_NAME} lets you view table tennis rankings, tournaments and results and, with an account, take part in leagues,
          manage friendships and enter or view your own matches. The service is run by <OwnerLine />.
        </p>
      </section>

      <section>
        <h2>2. Account</h2>
        <ul>
          <li>To sign up you must provide true and up-to-date information. You may have only one personal account.</li>
          <li>You are responsible for keeping your password confidential and for what happens with your account: if you suspect unauthorised use, write to us straight away.</li>
          <li>If you are under 14, you need the consent of a parent or guardian.</li>
        </ul>
      </section>

      <section>
        <h2>3. Fair behaviour</h2>
        <p>You must not:</p>
        <ul>
          <li>enter false results or tamper with rankings and ranking scores;</li>
          <li>use another person&apos;s identity or data;</li>
          <li>upload photos or text that are offensive, unlawful or infringe the rights of others (your profile photo must show you and must not be inappropriate);</li>
          <li>try to access restricted areas, get around security limits or overload the site with automated requests;</li>
          <li>use the site for unlawful purposes or for unauthorised commercial purposes.</li>
        </ul>
        <p>Whoever manages a league or tournament can correct or cancel results and remove entries, to keep the rankings fair.</p>
      </section>

      <section>
        <h2>4. Content and visibility</h2>
        <p>
          You keep the rights to your photo and to the content you upload, and you grant us a non-exclusive, free-of-charge permission to show it on the site
          for the sole purpose of providing the service. Remember that name, club, photo, scores and results are public, as explained in the{" "}
          <Link href="/privacy" className="underline hover:text-brand">Privacy policy</Link>.
        </p>
        <p>The name, logo and design of {SITE_NAME} belong to the operator and may not be reused without permission.</p>
      </section>

      <section>
        <h2>5. Scores and rankings</h2>
        <p>
          The ranking score and the rankings are calculated automatically from the results entered and are purely friendly and sporting in nature.
          They may be recalculated if a result is corrected, and they give no right to prizes or refunds, except as set out by the organisers of each tournament.
        </p>
      </section>

      <section>
        <h2>6. Availability and liability</h2>
        <p>
          The service is provided &quot;as is&quot;, with no guarantee that it will work continuously or without errors; it may be suspended for maintenance or changed.
          To the extent permitted by law, the operator is not liable for indirect damage arising from the use of, or inability to use, the site, nor for
          what users publish. This does not affect any liability that the law does not allow to be excluded, in particular towards consumers.
        </p>
      </section>

      <section>
        <h2>7. Suspension and closure of your account</h2>
        <p>
          You can stop using the site and ask for your account to be deleted by writing to <SupportLink />.
          We may suspend or close an account that breaks these rules, giving you an explanation where possible.
        </p>
      </section>

      <section>
        <h2>8. Changes to these terms</h2>
        <p>
          We may update these terms; the date at the top shows the latest version. If you keep using the site after a change, you accept it.
          For significant changes we will let you know on the site or by email.
        </p>
      </section>

      <section>
        <h2>9. Governing law and contact</h2>
        <p>
          These terms are governed by Italian law. If you are a consumer, the mandatory rules of your country of residence
          and the consumer&apos;s court remain applicable. For questions or reports write to <SupportLink />.
        </p>
      </section>
    </LegalPage>
  );
}
