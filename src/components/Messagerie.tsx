import { useEffect, useRef, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, Send, Trash2 }  from 'lucide-react';
import { MODE_API, lireMessages, modifierMessages, type BoiteMessages, type MessagePrive, type Utilisateur } from '../utils/api';
import { listerComptes } from '../utils/utilisateurs';
import { libelleRole } from '../utils/roles';
import { CLE_SON_MESSAGES, EVENEMENT_SON_MESSAGES, lireSonMessages } from '../utils/son-messages';
import { Modale } from './Modale';

const DUREE_SON_SECONDES = 3;
const CLE = 'salfa_messages_prives';
const CLE_SUPPRESSIONS = 'salfa_messages_suppressions';
function suppressionsLocales(): Record<string, number[]> {
  const data = JSON.parse(localStorage.getItem(CLE_SUPPRESSIONS) || '{}');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Suppressions locales illisibles.');
  return data;
}
function messagesLocaux(): MessagePrive[] {
  const data = JSON.parse(localStorage.getItem(CLE) || '[]');
  if (!Array.isArray(data)) throw new Error('Messages locaux illisibles.');
  return data;
}
async function boiteLocale(user: Utilisateur): Promise<BoiteMessages> {
  const comptes = (await listerComptes()).filter(c => c.actif && String(c.id) !== String(user.id));
  const supprimes = new Set(suppressionsLocales()[String(user.id)] ?? []);
  return { comptes, messages: messagesLocaux().filter(m => !supprimes.has(m.id) && (String(m.auteurId) === String(user.id) || String(m.destinataireId) === String(user.id))) };
}
export function Messagerie({ utilisateur }: { utilisateur: Utilisateur }) {
  const [ouvert, setOuvert] = useState(false);
  const [boite, setBoite] = useState<BoiteMessages>({ comptes: [], messages: [] });
  const [dest, setDest] = useState('');
  const [redaction, setRedaction] = useState<'nouveau' | 'reponse' | null>(null);
  const [contenu, setContenu] = useState('');
  const [messageRepondu, setMessageRepondu] = useState<MessagePrive | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const [confirmationEnvoi, setConfirmationEnvoi] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const vus = useRef<Set<number> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const sonsActifs = useRef(new Set<OscillatorNode>());
  const sonAutorise = useRef(lireSonMessages());

  // Chrome exige un geste utilisateur pour autoriser le son.
  async function preparerSon(): Promise<boolean> {
    try {
      if ((!audio.current || audio.current.state === 'closed') && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') await audio.current.resume();
      return audio.current?.state === 'running';
    } catch { return false; }
  }
  function sonner(): boolean {
    try {
      const contexte = audio.current;
      if (!sonAutorise.current || !contexte || contexte.state !== 'running') return false;
      const oscillateur = contexte.createOscillator();
      const volume = contexte.createGain();
      oscillateur.frequency.value = 740;
      volume.gain.setValueAtTime(0.08, contexte.currentTime);
      // L'enveloppe garde le volume pendant 2,8 secondes puis atténue la fin,
      // sans dépendre des minuteurs JavaScript ralentis en arrière-plan.
      volume.gain.setValueAtTime(0.08, contexte.currentTime + DUREE_SON_SECONDES - 0.2);
      volume.gain.exponentialRampToValueAtTime(0.001, contexte.currentTime + DUREE_SON_SECONDES);
      oscillateur.connect(volume); volume.connect(contexte.destination);
      sonsActifs.current.add(oscillateur);
      oscillateur.onended = () => { sonsActifs.current.delete(oscillateur); oscillateur.disconnect(); volume.disconnect(); };
      oscillateur.start(); oscillateur.stop(contexte.currentTime + DUREE_SON_SECONDES);
      return true;
    } catch { return false; /* L'absence de périphérique audio ne bloque pas la messagerie. */ }
  }
  function detecterMessages(nouvelleBoite: BoiteMessages) {
    const recus = nouvelleBoite.messages.filter(m => String(m.destinataireId) === String(utilisateur.id));
    const dejaVus = vus.current;
    if (dejaVus) {
      const nouveaux = recus.filter(m => !m.luLe && !dejaVus.has(m.id));
      if (nouveaux.length && sonAutorise.current) {
        // Reprendre un contexte déjà autorisé mais suspendu, même en arrière-plan.
        if (audio.current?.state === 'suspended') void preparerSon().then(ok => { if (ok) sonner(); });
        else sonner();
      }
      if (nouveaux.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const notification = new Notification('Caisse SALFA · Nouveau message', {
            body: nouveaux.length === 1 ? `Message de ${nouveaux[0].auteurNom}` : `${nouveaux.length} nouveaux messages`,
            tag: 'salfa-message-prive',
            silent: true,
          });
          notification.onclick = () => { window.focus(); setOuvert(true); notification.close(); };
        } catch { /* Les restrictions du navigateur ne doivent pas masquer les messages. */ }
      }
    }
    // Mémoriser aussi les messages lus pour ne pas les annoncer plus tard.
    vus.current = new Set([...(dejaVus ?? []), ...recus.map(m => m.id)]);
  }
  async function actualiser() {
    try { const nouvelle = MODE_API ? await lireMessages() : await boiteLocale(utilisateur); detecterMessages(nouvelle); setBoite(nouvelle); setErreur(''); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Impossible de charger les messages.'); }
  }
  // Le son est activé par défaut au premier geste dans la caisse, même si la
  // messagerie n'est jamais ouverte. Chrome peut exiger une activation utilisateur.
  useEffect(() => {
    const activer = () => {
      if (sonAutorise.current && audio.current?.state !== 'running') void preparerSon();
    };
    const arreterSons = () => {
      for (const oscillateur of sonsActifs.current) { try { oscillateur.stop(); } catch { /* déjà terminé */ } }
      sonsActifs.current.clear();
    };
    const changerSon = (event: Event) => {
      sonAutorise.current = (event as CustomEvent<boolean>).detail;
      if (sonAutorise.current) activer(); else arreterSons();
    };
    const synchroniserSon = (event: StorageEvent) => {
      if (event.key === CLE_SON_MESSAGES || event.key === null) { sonAutorise.current = lireSonMessages(); if (!sonAutorise.current) arreterSons(); }
    };
    window.addEventListener(EVENEMENT_SON_MESSAGES, changerSon);
    window.addEventListener('storage', synchroniserSon);
    document.addEventListener('pointerdown', activer, true);
    document.addEventListener('keydown', activer, true);
    // Après une connexion ou un rechargement, le navigateur peut déjà avoir
    // autorisé l'audio. Ne pas créer de contexte avant toute interaction.
    if (navigator.userActivation?.hasBeenActive) activer();
    return () => {
      arreterSons();
      window.removeEventListener(EVENEMENT_SON_MESSAGES, changerSon);
      window.removeEventListener('storage', synchroniserSon);
      document.removeEventListener('pointerdown', activer, true);
      document.removeEventListener('keydown', activer, true);
    };
  }, [utilisateur.id]);
  useEffect(() => {
    vus.current = null;
    void actualiser();
    // La vérification continue aussi quand l'onglet n'est pas visible. Chrome
    // peut cependant ralentir ou suspendre ses minuteries en arrière-plan.
    const timer = window.setInterval(() => { void actualiser(); }, 15000);
    const reprise = () => { if (document.visibilityState === 'visible') void actualiser(); };
    const connexion = () => { void actualiser(); };
    const stockage = (e: StorageEvent) => { if (!MODE_API && e.key === CLE) void actualiser(); };
    document.addEventListener('visibilitychange', reprise);
    window.addEventListener('online', connexion);
    window.addEventListener('storage', stockage);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reprise); window.removeEventListener('online', connexion); window.removeEventListener('storage', stockage); if (audio.current) { void audio.current.close().catch(() => {}); audio.current = null; } };
  }, [utilisateur.id]);
  async function envoyer() {
    if (!dest || !contenu.trim() || occupe) return;
    setOccupe(true);
    try {
      if (MODE_API) setBoite(await modifierMessages({ operation: 'envoyer', destinataireId: dest, contenu: contenu.trim() }));
      else {
        const compte = (await boiteLocale(utilisateur)).comptes.find(c => String(c.id) === dest);
        if (!compte) throw new Error('Destinataire introuvable ou désactivé.');
        const liste = messagesLocaux();
        liste.unshift({ id: Math.max(0, ...liste.map(m => m.id)) + 1, auteurId: utilisateur.id, destinataireId: compte.id, auteurNom: utilisateur.nomComplet, destinataireNom: compte.nomComplet, contenu: contenu.trim(), creeLe: new Date().toISOString(), luLe: null });
        localStorage.setItem(CLE, JSON.stringify(liste)); setBoite(await boiteLocale(utilisateur));
      }
      setConversation(dest); setConfirmationEnvoi('Message envoyé.'); setContenu(''); setMessageRepondu(null); setRedaction('reponse'); setErreur('');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Envoi impossible.'); }
    finally { setOccupe(false); }
  }
  async function lire(id: number) {
    if (occupe) return;
    setOccupe(true);
    try {
      if (MODE_API) setBoite(await modifierMessages({ operation: 'lire', id }));
      else {
        const liste = messagesLocaux().map(m => m.id === id && String(m.destinataireId) === String(utilisateur.id) && !m.luLe ? { ...m, luLe: new Date().toISOString() } : m);
        localStorage.setItem(CLE, JSON.stringify(liste)); setBoite(await boiteLocale(utilisateur));
      }
      setErreur('');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Mise à jour impossible.'); }
    finally { setOccupe(false); }
  }
  async function supprimer(id?: number) {
    if (occupe || (!id && !conversation)) return;
    const question = id ? 'Supprimer ce message de votre messagerie ? Le correspondant le conservera.' : 'Supprimer toute cette conversation de votre messagerie ? Le correspondant conservera ses messages.';
    if (!window.confirm(question + ((!id || messagesConversation.length === 1) && contenu.trim() ? ' Le brouillon en cours sera également abandonné.' : ''))) return;
    setOccupe(true);
    try {
      if (MODE_API) setBoite(await modifierMessages(id ? { operation: 'supprimer', id } : { operation: 'supprimer_conversation', correspondantId: conversation! }));
      else {
        const suppressions = suppressionsLocales();
        const cible = id ? boite.messages.filter(m => m.id === id) : messagesConversation;
        suppressions[String(utilisateur.id)] = [...new Set([...(suppressions[String(utilisateur.id)] ?? []), ...cible.map(m => m.id)])];
        localStorage.setItem(CLE_SUPPRESSIONS, JSON.stringify(suppressions));
        setBoite(await boiteLocale(utilisateur));
      }
      if (!id || messagesConversation.length === 1) { setConversation(null); setRedaction(null); setDest(''); setContenu(''); setMessageRepondu(null); }
      setErreur(''); setConfirmationEnvoi('');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Suppression impossible.'); }
    finally { setOccupe(false); }
  }
  function repondre(m: MessagePrive) {
    if (redaction === 'reponse' && messageRepondu?.id === m.id) return;
    if (contenu.trim() && (redaction !== 'reponse' || messageRepondu?.id !== m.id) && !window.confirm('Abandonner le brouillon en cours pour répondre à ce message ?')) return;
    setContenu(''); setDest(String(m.auteurId)); setMessageRepondu(m); setRedaction('reponse'); setErreur(''); setConfirmationEnvoi('');
  }
  const nonLus = boite.messages.filter(m => String(m.destinataireId) === String(utilisateur.id) && !m.luLe).length;
  // Une conversation regroupe tous les échanges avec le même correspondant.
  const conversations = new Map<string, { id: string; nom: string; dernier: MessagePrive; nonLus: number }>();
  for (const m of boite.messages) {
    const recu = String(m.destinataireId) === String(utilisateur.id);
    const id = String(recu ? m.auteurId : m.destinataireId);
    const nom = recu ? m.auteurNom : m.destinataireNom;
    const actuelle = conversations.get(id);
    if (!actuelle) conversations.set(id, { id, nom, dernier: m, nonLus: recu && !m.luLe ? 1 : 0 });
    else {
      if (new Date(m.creeLe).getTime() > new Date(actuelle.dernier.creeLe).getTime() || (m.creeLe === actuelle.dernier.creeLe && m.id > actuelle.dernier.id)) { actuelle.dernier = m; actuelle.nom = nom; }
      if (recu && !m.luLe) actuelle.nonLus++;
    }
  }
  const selection = conversation ? conversations.get(conversation) : undefined;
  const compteSelectionne = boite.comptes.find(c => String(c.id) === conversation);
  const nomSelectionne = compteSelectionne?.nomComplet ?? selection?.nom ?? 'Utilisateur';
  const contacts = [...boite.comptes.map(c => ({ id: String(c.id), nom: c.nomComplet, role: c.role, actif: true })), ...[...conversations.values()].filter(c => !boite.comptes.some(u => String(u.id) === c.id)).map(c => ({ id: c.id, nom: c.nom, role: undefined, actif: false }))];
  const messagesConversation = boite.messages.filter(m => conversation !== null && (String(m.auteurId) === conversation || String(m.destinataireId) === conversation)).sort((a, b) => a.creeLe.localeCompare(b.creeLe) || a.id - b.id);
  const presence = (id: string): 'En ligne' | 'Hors ligne' | 'Présence inconnue' => { const etat = boite.comptes.find(c => String(c.id) === id)?.enLigne; return etat == null ? 'Présence inconnue' : etat === true || etat === 1 || etat === '1' ? 'En ligne' : 'Hors ligne'; };
  const enLigne = (id: string) => presence(id) === 'En ligne';
  const disponible = conversation !== null && boite.comptes.some(c => String(c.id) === conversation);
  function choisirConversation(id: string | null) {
    if (id === conversation) return;
    if (contenu.trim() && !window.confirm('Abandonner le brouillon en cours ?')) return;
    setConversation(id); setRedaction(id ? 'reponse' : null); setDest(id ?? ''); setContenu(''); setMessageRepondu(null); setErreur(''); setConfirmationEnvoi('');
  }
  return <><button className="icon-button relative" aria-label={`Messages privés${nonLus ? `, ${nonLus} non lus` : ''}`} title="Messages privés" onClick={() => { if (sonAutorise.current) void preparerSon(); setOuvert(true); void actualiser(); }}><Mail size={18} />{nonLus > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1 text-[10px] text-white">{nonLus}</span>}</button>
    {ouvert && <Modale titre="Messages privés" sousTitre="Vos échanges avec les autres utilisateurs" largeur="document" onFermer={() => { if (contenu.trim() && !window.confirm('Abandonner le brouillon en cours ?')) return; setOuvert(false); }}>
      <div className="messagerie-interface">
        <aside className="messagerie-contacts" aria-label="Liste des utilisateurs">
          <div className="messagerie-legende"><span><span className="point-presence en-ligne" /> Vert : en ligne · <span className="point-presence" /> Gris : hors ligne</span><button type="button" className="icon-button" aria-label="Actualiser" title="Actualiser" onClick={() => void actualiser()}><RefreshCw size={15} /></button></div>
          {!MODE_API && <p className="px-3 py-1 text-xs text-slate-500">Présence indisponible en mode local.</p>}
          <div className="messagerie-liste" aria-label="Liste des conversations">
            {contacts.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun autre utilisateur disponible.</p>}
            {contacts.map(c => { const discussion = conversations.get(c.id); return <button type="button" key={c.id} className={`messagerie-contact ${conversation === c.id ? 'selectionne' : ''}`} onClick={() => choisirConversation(c.id)} aria-pressed={conversation === c.id}>
              <span className={`point-presence ${enLigne(c.id) ? 'en-ligne' : ''}`} aria-label={presence(c.id)} />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.nom}</span><span className="block truncate text-xs text-slate-500">{(c.role ? libelleRole(c.role) : null) || (c.actif ? boite.comptes.find(u => String(u.id) === c.id)?.identifiant : 'Compte indisponible')}{discussion ? ` · ${discussion.dernier.contenu}` : ''}</span></span>
              {!!discussion?.nonLus && <span className="rounded-full bg-indigo-600 px-2 text-xs text-white">{discussion.nonLus}</span>}
            </button>; })}
          </div>
        </aside>
        <section className="messagerie-contenu" aria-label={conversation ? `Conversation avec ${nomSelectionne}` : 'Conversation'}>
          {conversation ? <>
            <header className="messagerie-entete"><div className="min-w-0"><strong>{nomSelectionne}</strong>{compteSelectionne?.role && <span className="ml-2 text-xs text-slate-500">({libelleRole(compteSelectionne.role)})</span>}<span className="sr-only">{presence(conversation)}</span></div>{messagesConversation.length > 0 && <button type="button" disabled={occupe} className="text-xs text-red-600 hover:underline" onClick={() => void supprimer()}>Supprimer toute la conversation</button>}</header>
            <div className="messagerie-bulles" aria-live="polite">
              {messagesConversation.length === 0 && <p className="m-auto text-center text-sm text-slate-400">Aucun message. Écrivez à {nomSelectionne}.</p>}
              {messagesConversation.map(m => { const recu = String(m.destinataireId) === String(utilisateur.id); const auteurDisponible = boite.comptes.some(c => String(c.id) === String(m.auteurId)); return <div key={m.id} className={`flex ${recu ? 'justify-start' : 'justify-end'}`}><article className={`messagerie-bulle ${recu ? 'recu' : 'envoye'}`}>
                <p className="whitespace-pre-wrap break-words">{m.contenu}</p><p className="mt-1 text-right text-[11px] opacity-75"><time dateTime={m.creeLe}>{new Date(m.creeLe).toLocaleString('fr-FR')}</time> · {recu ? (m.luLe ? 'Lu' : 'Non lu') : (m.luLe ? 'Lu par le destinataire' : 'Envoyé · non lu')}</p>
                <div className="mt-1 flex flex-wrap justify-end gap-3 text-xs"><button type="button" aria-label={`Supprimer le message ${m.id}`} title="Supprimer" disabled={occupe} onClick={() => void supprimer(m.id)}><Trash2 size={14} /></button>{recu && <><button type="button" disabled={!auteurDisponible || occupe} className="underline disabled:opacity-50" onClick={() => repondre(m)}>Répondre</button>{!m.luLe && <button type="button" disabled={occupe} className="underline" onClick={() => void lire(m.id)}>Marquer comme lu</button>}</>}</div>
              </article></div>; })}
            </div>
            {messageRepondu && <blockquote className="mx-3 border-l-4 border-indigo-400 px-3 text-xs text-slate-500">Réponse à {messageRepondu.auteurNom} : {messageRepondu.contenu}</blockquote>}
            {disponible ? <form onSubmit={e => { e.preventDefault(); void envoyer(); }} className="messagerie-saisie"><label className="sr-only" htmlFor="contenu-message">Message</label><textarea className="field" id="contenu-message" rows={1} maxLength={2000} required value={contenu} onChange={e => setContenu(e.target.value)} placeholder="Votre message…" /><button className="messagerie-envoyer" aria-label="Envoyer" title="Envoyer" disabled={occupe || !contenu.trim()}><Send size={18} /></button></form> : <p className="p-3 text-sm text-slate-500">Ce correspondant est désactivé ou indisponible.</p>}
          </> : <div className="m-auto p-6 text-center text-sm text-slate-400"><MessageCircle className="mx-auto mb-2" size={28} />Sélectionnez un utilisateur pour commencer une conversation.</div>}
        </section>
      </div>
      {confirmationEnvoi && <p role="status" className="mt-2 text-sm text-emerald-700">{confirmationEnvoi}</p>}
      {erreur && <p role="alert" className="mt-2 text-sm text-rose-700">{erreur}</p>}
    </Modale>}
  </>;
}
