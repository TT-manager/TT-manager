import Link from "next/link";
import type { ReactNode } from "react";
import { dict, type Locale } from "../locale";

/** Testi della pagina Domande frequenti. */
export const publicFaqText = dict({
  title: "Domande frequenti",
  description: "Come funzionano PongFu, le leghe, i tornei, i punti in classifica e gli amichevoli.",
  intro: "Come funziona PongFu, in breve. Se non trovi la risposta, chiedi a chi organizza la tua lega.",
  topics: "Argomenti",
}, {
  title: "FAQ",
  description: "How PongFu, leagues, tournaments, ranking points and friendlies work.",
  intro: "How PongFu works, in short. If you can't find the answer, ask whoever organises your league.",
  topics: "Topics",
});

type QA = { q: string; a: ReactNode };
type Section = { title: string; items: QA[] };

const IT: Section[] = [
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
      { q: "Cosa sono le sfide?", a: <>Nelle leghe di singolare che le hanno attivate puoi sfidare un altro membro anche fuori dai tornei: dalla pagina della lega scegli l&apos;avversario e lanci la sfida. Se accetta, giocate; poi uno dei due inserisce il risultato e l&apos;altro lo conferma (o lo contesta: in quel caso decide un amministratore della lega). Una sfida confermata sposta una parte dei punti di una partita di torneo, e l&apos;amministratore può limitare quante sfide valgono a settimana con lo stesso avversario: le altre restano amichevoli. Le sfide che trovi in attesa sono nella tua home, alla voce «Le mie sfide».</> },
      { q: "Una sfida può scadere?", a: <>Sì: se l&apos;avversario non risponde entro 7 giorni la sfida scade, e lo stesso succede se dopo averla accettata nessuno inserisce il risultato entro 3 settimane. Chi non gioca sfide non perde punti.</> },
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

const EN: Section[] = [
  {
    title: "Getting started",
    items: [
      { q: "What is PongFu?", a: <>A site for organising table tennis among friends and in clubs: leagues with their own points ranking, tournaments with groups and a bracket you can follow live, and friendly tournaments you can create in a minute.</> },
      { q: "How do I sign up?", a: <>Click <Link href="/registrati" className="link">Sign up</Link> and enter your name, email and password. You&apos;ll get an email: open the link to confirm your address (it works even if you open it on your phone). From then on you can log in.</> },
      { q: "I didn't get the email", a: <>Check your spam or promotions folder and wait a few minutes. The sender is <strong>PongFu</strong>. If it still doesn&apos;t arrive, try logging in or use <Link href="/password-dimenticata" className="link">Forgot password</Link> with the same address.</> },
      { q: "I forgot my password", a: <>Go to <Link href="/password-dimenticata" className="link">Forgot password</Link>: we&apos;ll send you a link to choose a new one.</> },
      { q: "Do I need an account to follow a tournament?", a: <>No. Rankings, groups and brackets are visible without an account: all you need is the tournament link, or its code to type on the home page, in the «Got a tournament code?» box.</> },
    ],
  },
  {
    title: "Leagues",
    items: [
      { q: "What is a league?", a: <>A group of players who play several tournaments over time. Each league has its own points ranking, updated tournament after tournament, and a roll of honour. A league is either singles or doubles.</> },
      { q: "How do I join a league?", a: <>If you received an <strong>invitation link</strong>, open it and sign up: you&apos;re in straight away. Otherwise, from the league page or your profile click <strong>Ask to join</strong>: a league administrator approves the request.</> },
      { q: "I was already in the ranking before signing up", a: <>When you ask to join, pick your name under «Already in the ranking?»: the administrator links your account to that player, so you keep your points and history.</> },
      { q: "Who can see my league?", a: <><strong>Public</strong> leagues appear on everyone&apos;s home page. The others only appear on the home page of their members.</> },
      { q: "How is a league created?", a: <>Leagues are created by the site manager, who can then hand them over to other administrators. If you&apos;d like to start one for your group or your club, get in touch with whoever invited you to PongFu.</> },
    ],
  },
  {
    title: "Tournaments",
    items: [
      { q: "How do I sign up for a tournament?", a: <>When a tournament in your league has <strong>registration open</strong>, you&apos;ll find the «Sign up» box on its page (in doubles you also choose your partner). You can sign up or withdraw until the deadline. If registration isn&apos;t open, the organiser signs you up.</> },
      { q: "How does a tournament work?", a: <>There are usually two stages. In the <strong>qualification</strong> you play in groups, everyone against everyone. The best of each group go through to the <strong>knockout stage</strong>, all the way to the final. On the tournament page you&apos;ll find them in two separate tabs.</> },
      { q: "How are group standings worked out?", a: <>Each win is worth 2 points and each defeat 1. If two players are level on points, the head-to-head counts; otherwise the difference between sets won and lost, and then between points scored and conceded. These points only count for the group: they aren&apos;t the league ranking points.</> },
      { q: "Who enters the results?", a: <>The tournament organiser: the league administrators or, for friendlies, whoever created them. Everyone else sees the results update live.</> },
      { q: "What's the difference between a ranked tournament and a friendly?", a: <>A tournament that <strong>counts for the ranking</strong> moves the league points when it&apos;s closed. A <strong>friendly</strong> tournament is played for fun: it doesn&apos;t touch any ranking and doesn&apos;t go into the league history.</> },
    ],
  },
  {
    title: "Points and ranking",
    items: [
      { q: "How are points won and lost?", a: <>Every match in a ranked tournament moves points from the loser to the winner: beating a stronger opponent is worth more, losing to a weaker one costs more. On each league page, below the ranking, you&apos;ll find the full explanation with that league&apos;s numbers and a table of examples.</> },
      { q: "Why did I lose points without playing?", a: <>In many leagues, if you skip a tournament you lose a small share of the points you have above a certain threshold, so the ranking rewards those who play. If you were injured or away for work, ask the administrator to record your absence: during that period you lose nothing.</> },
      { q: "When is the ranking updated?", a: <>When the organiser closes the tournament. If a result was wrong, they can reopen it, correct it and close it again: the ranking is recalculated from scratch.</> },
      { q: "Does the set score count?", a: <>For the league ranking, only who wins the match counts. Sets are used to order the groups.</> },
      { q: "What are challenges?", a: <>In singles leagues that have turned them on, you can challenge another member outside tournaments too: from the league page pick your opponent and send the challenge. If they accept, you play; then one of you enters the result and the other confirms it (or disputes it: then a league administrator decides). A confirmed challenge moves part of the points of a tournament match, and the administrator can limit how many challenges count each week with the same opponent: the others stay friendlies. Your pending challenges are on your home page, under «My challenges».</> },
      { q: "Can a challenge expire?", a: <>Yes: if the opponent doesn&apos;t reply within 7 days the challenge expires, and the same happens if nobody enters the result within 3 weeks of accepting it. Players who don&apos;t play challenges lose no points.</> },
    ],
  },
  {
    title: "Friends and friendlies",
    items: [
      { q: "How do I add a friend?", a: <>Go to <Link href="/amici" className="link">Friends</Link>, search for a first name or surname and send the request. Once they accept it, you&apos;re friends.</> },
      { q: "How do I create a friendly tournament?", a: <>From <Link href="/amichevole/nuovo" className="link">Create a friendly tournament</Link>. You can enter yourself, your friends and also <strong>guests</strong> without an account (just their name). You can have up to 10 friendlies open at a time.</> },
    ],
  },
  {
    title: "Your profile",
    items: [
      { q: "How do I change my photo or name?", a: <>From <Link href="/profilo" className="link">your profile</Link>: you can upload a photo and change the name you appear under in the rankings.</> },
      { q: "My club isn't on the list", a: <>In your profile (or when signing up) choose «My club isn&apos;t on the list…» and type its name and town. The site manager checks the request and, if approved, the club is added to your profile and to the list.</> },
    ],
  },
];

/** Domande e risposte (con link interni) nelle due lingue. */
export const FAQ_SECTIONS: Record<Locale, Section[]> = { it: IT, en: EN };
