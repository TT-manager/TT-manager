import { dict } from "../locale";

/** Componenti piccoli condivisi: classifica, circoli, copia, aggiornamento automatico, foto del profilo. */
export const compCommon = dict({
  // ranking-table
  noPlayers: "Nessun giocatore in classifica.",
  player: "Giocatore",
  club: "Circolo",
  matches: "Partite",
  // club-picker
  noClub: "Nessun circolo",
  clubNotListed: "Il mio circolo non è in elenco…",
  newClubHelp: "Scrivi il circolo: lo controlla l'amministratore e, se lo approva, viene aggiunto al tuo profilo.",
  clubName: "Nome del circolo",
  clubCity: "Città (facoltativa)",
  clubCityAria: "Città del circolo",
  // copy-field
  copied: "Copiato!",
  copy: "Copia",
  // auto-refresh
  autoRefresh: (seconds: number, last: string | null) => `Aggiornamento automatico ogni ${seconds} s${last ? ` · ultimo alle ${last}` : ""}`,
  // avatar-uploader
  badImage: "Non riesco a leggere questa immagine: prova con un'altra foto.",
  uploading: "Caricamento…",
  changePhoto: "Cambia foto",
  addPhoto: "Aggiungi una foto",
  confirmRemovePhoto: "Togliere la foto?",
  remove: "Togli",
}, {
  noPlayers: "No players in the ranking.",
  player: "Player",
  club: "Club",
  matches: "Matches",
  noClub: "No club",
  clubNotListed: "My club isn't on the list…",
  newClubHelp: "Type your club: the administrator checks it and, if they approve it, it's added to your profile.",
  clubName: "Club name",
  clubCity: "City (optional)",
  clubCityAria: "Club city",
  copied: "Copied!",
  copy: "Copy",
  autoRefresh: (seconds: number, last: string | null) => `Auto-refresh every ${seconds} s${last ? ` · last at ${last}` : ""}`,
  badImage: "I can't read this image: try another photo.",
  uploading: "Uploading…",
  changePhoto: "Change photo",
  addPhoto: "Add a photo",
  confirmRemovePhoto: "Remove the photo?",
  remove: "Remove",
});
