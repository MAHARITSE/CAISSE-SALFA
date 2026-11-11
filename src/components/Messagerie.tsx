import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, MessageCircle, Plus, RefreshCw, Send, Trash2, Volume2 }  from 'lucide-react';
import { MODE_API, lireMessages, modifierMessages, type BoiteMessages, type MessagePrive, type Utilisateur } from '../utils/api';
import { listerComptes } from '../utils/utilisateurs';
import { Modale } from './Modale';

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
  const [sonActif, setSonActif] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'indisponible'>(() => typeof Notification === 'undefined' ? 'indisponible' : Notification.permission);
  const vus = useRef<Set<number> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  // Chrome exige un geste utilisateur pour autoriser le son.
  async function preparerSon(): Promise<boolean> {
    try {
      if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') await audio.current.resume();
      const actif = audio.current?.state === 'running';
      setSonActif(Boolean(actif));
      return Boolean(actif);
    } catch { setSonActif(false); return false; }
  }
  function sonner() {
    try {
      const contexte = audio.current;
      if (!contexte || contexte.state !== 'running') return;
      const oscillateur = contexte.createOscillator();
      const volume = contexte.createGain();
      oscillateur.frequency.value = 740;
      volume.gain.setValueAtTime(0.08, contexte.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, contexte.currentTime + 0.3);
      oscillateur.connect(volume); volume.connect(contexte.destination);
      oscillateur.start(); oscillateur.stop(contexte.currentTime + 0.3);
    } catch { /* L'absence de périphérique audio ne bloque pas la messagerie. */ }
  }
  async function activerNotifications() {
    void preparerSon();
    if (typeof Notification === 'undefined') return;
    try { setPermission(await Notification.requestPermission()); }
    catch { setPermission(Notification.permission); }
  }
  function detecterMessages(nouvelleBoite: BoiteMessages) {
    const recus = nouvelleBoite.messages.filter(m => String(m.destinataireId) === String(utilisateur.id));
    const dejaVus = vus.current;
    if (dejaVus) {
      const nouveaux = recus.filter(m => !m.luLe && !dejaVus.has(m.id));
      if (nouveaux.length) sonner();
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
  useEffect(() => {
    vus.current = null;
    void actualiser();
    const timer = window.setInterval(() => { void actualiser(); }, 15000);
    return () => { window.clearInterval(timer); if (audio.current) { void audio.current.close().catch(() => {}); audio.current = null; } };
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
      setConversation(dest); setConfirmationEnvoi('Message envoyé.'); setContenu(''); setDest(''); setMessageRepondu(null); setRedaction(null); setErreur('');
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
  const listeConversations = [...conversations.values()].sort((a, b) => b.dernier.creeLe.localeCompare(a.dernier.creeLe) || b.dernier.id - a.dernier.id);
  const selection = conversation ? conversations.get(conversation) : undefined;
  const messagesConversation = boite.messages.filter(m => conversation !== null && (String(m.auteurId) === conversation || String(m.destinataireId) === conversation)).sort((a, b) => a.creeLe.localeCompare(b.creeLe) || a.id - b.id);
  const enLigne = (id: string) => { const etat = boite.comptes.find(c => String(c.id) === id)?.enLigne; return etat === true || etat === 1 || etat === '1'; };
  const disponible = conversation !== null && boite.comptes.some(c => String(c.id) === conversation);
  function choisirConversation(id: string | null) {
    if (contenu.trim() && !window.confirm('Abandonner le brouillon en cours ?')) return;
    setConversation(id); setRedaction(null); setDest(''); setContenu(''); setMessageRepondu(null); setErreur(''); setConfirmationEnvoi('');
  }
  return <><button className="icon-button relative" aria-label={`Messages privés${nonLus ? `, ${nonLus} non lus` : ''}`} title="Messages privés" onClick={() => { void preparerSon(); setOuvert(true); void actualiser(); }}><Mail size={18} />{nonLus > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1 text-[10px] text-white">{nonLus}</span>}</button>
    {ouvert && <Modale titre="Messages privés" sousTitre="Vos échanges avec les autres utilisateurs" onFermer={() => setOuvert(false)}>
      <div className="mb-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
        <p>{sonActif ? 'Son activé pour cet onglet.' : 'Activez le son après ouverture de la caisse pour entendre les nouveaux messages.'}</p>
        <button type="button" className="btn-secondary mt-2" onClick={() => { void preparerSon().then(ok => { if (ok) sonner(); else setErreur('Son indisponible : vérifiez le son de Chrome et de Windows.'); }); }}><Volume2 size={16} />Activer et tester le son</button>
      </div>
      <div className="mb-5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
        {permission === 'indisponible' ? <p>Notifications indisponibles. Chrome exige une connexion sécurisée HTTPS (ou localhost) pour les notifications.</p> : permission === 'denied' ? <p>Notifications bloquées. Autorisez-les dans les paramètres du site dans Chrome, puis rechargez la page.</p> : <><p>{permission === 'granted' ? 'Notifications autorisées. Le son se règle séparément ci-dessus.' : 'Recevoir une notification Windows pour les nouveaux messages.'}</p><button type="button" className="btn-secondary mt-2" onClick={() => void activerNotifications()}>{permission === 'granted' ? 'Activer le son' : 'Activer les notifications et le son'}</button></>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {conversation && <button type="button" className="icon-button" aria-label="Retour aux conversations" title="Retour aux conversations" onClick={() => choisirConversation(null)}><ArrowLeft size={18} /></button>}
          <div><h3 className="font-bold text-slate-900 dark:text-slate-100">{selection?.nom ?? 'Conversations'}</h3><p className={`text-xs ${conversation && enLigne(conversation) ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>{conversation ? (enLigne(conversation) ? '● En ligne' : 'Messages privés') : `${listeConversations.length} conversation${listeConversations.length > 1 ? 's' : ''} · ${nonLus} non lu${nonLus > 1 ? 's' : ''}`}</p></div>
        </div>
        <div className="flex gap-2"><button className="icon-button" type="button" aria-label="Actualiser" title="Actualiser" onClick={() => void actualiser()}><RefreshCw size={17} /></button>{!redaction && <button type="button" className="btn-secondary" onClick={() => { setDest(''); setMessageRepondu(null); setConfirmationEnvoi(''); setRedaction('nouveau'); }}><Plus size={16} />Nouveau message</button>}</div>
      </div>
      {!conversation && MODE_API && <div className="mt-4 text-sm" aria-label="Utilisateurs en ligne"><p className="font-semibold">Utilisateurs en ligne</p><div className="mt-2 flex flex-wrap gap-2">{boite.comptes.filter(c => enLigne(String(c.id))).map(c => <span key={c.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />{c.nomComplet} · en ligne</span>)}{!boite.comptes.some(c => enLigne(String(c.id))) && <span className="text-slate-500">{boite.comptes.some(c => c.enLigne === null || c.enLigne === undefined) ? 'Présence indisponible pour cette configuration.' : 'Aucun utilisateur détecté en ligne.'}</span>}</div></div>}
      {!conversation && <div className="mt-4 space-y-2" aria-label="Liste des conversations">
        {listeConversations.length === 0 && <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-800"><MessageCircle className="mx-auto mb-2 text-slate-400" size={24} />Aucun message. Commencez une conversation.</div>}
        {listeConversations.map(c => <button key={c.id} type="button" className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => choisirConversation(c.id)}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{c.nom.trim().slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-slate-100">{c.nom} {enLigne(c.id) && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />En ligne</span>}</span><span className="block truncate text-xs text-slate-500">{c.dernier.contenu}</span></span>
          {c.nonLus > 0 && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">{c.nonLus} non lu{c.nonLus > 1 ? 's' : ''}</span>}
        </button>)}
      </div>}
      {conversation && <button type="button" className="btn-secondary mt-3" disabled={occupe} onClick={() => void supprimer()}><Trash2 size={15} />Supprimer toute la conversation</button>}
      {conversation && <div aria-label={`Conversation avec ${selection?.nom ?? 'utilisateur'}`} className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-100 p-3 sm:p-4 dark:bg-slate-950">
        {messagesConversation.map(m => {
          const recu = String(m.destinataireId) === String(utilisateur.id);
          const auteurDisponible = boite.comptes.some(c => String(c.id) === String(m.auteurId));
          return <div key={m.id} className={`flex ${recu ? 'justify-start' : 'justify-end'}`}>
            <article className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${recu ? 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100' : 'rounded-br-sm bg-brand-700 text-white'}`}>
              <p className="whitespace-pre-wrap break-words">{m.contenu}</p>
              <p className={`mt-2 text-[11px] ${recu ? 'text-slate-500 dark:text-slate-400' : 'text-white/80'}`}><time dateTime={m.creeLe}>{new Date(m.creeLe).toLocaleString('fr-FR')}</time> · {recu ? (m.luLe ? 'Lu' : 'Non lu') : (m.luLe ? 'Lu par le destinataire' : 'Envoyé · non lu')}</p>
              <button type="button" aria-label={`Supprimer le message ${m.id}`} className={`mt-2 text-xs underline ${recu ? 'text-rose-700 dark:text-rose-300' : 'text-white'}`} disabled={occupe} onClick={() => void supprimer(m.id)}>Supprimer</button>
              {recu && <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold"><button type="button" className="text-brand-700 underline disabled:opacity-50 dark:text-brand-400" disabled={!auteurDisponible || occupe} title={auteurDisponible ? 'Répondre à ce message' : 'Cet utilisateur est désactivé ou indisponible'} onClick={() => repondre(m)}>Répondre</button>{!m.luLe && <button type="button" className="text-brand-700 underline dark:text-brand-400" disabled={occupe} onClick={() => void lire(m.id)}>Marquer comme lu</button>}</div>}
            </article>
          </div>;
        })}
      </div>}
      {conversation && !redaction && <div className="mt-3">{disponible ? <button type="button" className="btn-primary" onClick={() => { setDest(conversation); setMessageRepondu(null); setRedaction('reponse'); setConfirmationEnvoi(''); }}>Écrire un message</button> : <p className="text-sm text-slate-500">Ce correspondant est désactivé ou indisponible.</p>}</div>}
      {redaction && <form onSubmit={e => { e.preventDefault(); void envoyer(); }} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        {redaction === 'nouveau' ? <><label className="block text-sm font-semibold" htmlFor="dest-message">Destinataire</label><select className="field" id="dest-message" required value={dest} onChange={e => { if (dest && contenu.trim() && e.target.value !== dest && !window.confirm('Changer le destinataire du brouillon ?')) return; setDest(e.target.value); }}><option value="">Choisir un utilisateur</option>{boite.comptes.map(c => <option key={c.id} value={c.id}>{c.nomComplet} ({c.identifiant}){enLigne(String(c.id)) ? ' ● En ligne' : ''}</option>)}</select></> : <p className="text-sm">Réponse à <strong>{boite.comptes.find(c => String(c.id) === dest)?.nomComplet ?? 'Utilisateur indisponible'}</strong></p>}
        {messageRepondu && redaction === 'reponse' && <blockquote className="rounded-lg border-l-4 border-brand-500 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300"><p className="font-semibold">Message de {messageRepondu.auteurNom}</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">{messageRepondu.contenu}</p></blockquote>}
        <label className="block text-sm font-semibold" htmlFor="contenu-message">Message</label><textarea className="field" id="contenu-message" rows={3} maxLength={2000} required value={contenu} onChange={e => setContenu(e.target.value)} autoFocus placeholder="Écrivez votre message…" />
        <div className="flex gap-2"><button className="btn-primary" disabled={occupe || !dest || !contenu.trim() || !boite.comptes.some(c => String(c.id) === dest)}><Send size={16} />Envoyer</button><button type="button" className="btn-secondary" onClick={() => { setRedaction(null); setDest(''); setContenu(''); setMessageRepondu(null); setErreur(''); }}>Annuler</button></div>
      </form>}
      {confirmationEnvoi && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{confirmationEnvoi}</p>}
      {erreur && <p role="alert" className="mt-3 text-sm text-rose-700">{erreur}</p>}
    </Modale>}
  </>;
}
