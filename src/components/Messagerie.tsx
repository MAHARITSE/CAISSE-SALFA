import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { MODE_API, lireMessages, modifierMessages, type BoiteMessages, type MessagePrive, type Utilisateur } from '../utils/api';
import { listerComptes } from '../utils/utilisateurs';
import { Modale } from './Modale';

const CLE = 'salfa_messages_prives';
function messagesLocaux(): MessagePrive[] {
  const data = JSON.parse(localStorage.getItem(CLE) || '[]');
  if (!Array.isArray(data)) throw new Error('Messages locaux illisibles.');
  return data;
}
async function boiteLocale(user: Utilisateur): Promise<BoiteMessages> {
  const comptes = (await listerComptes()).filter(c => c.actif && String(c.id) !== String(user.id));
  return { comptes, messages: messagesLocaux().filter(m => String(m.auteurId) === String(user.id) || String(m.destinataireId) === String(user.id)) };
}
export function Messagerie({ utilisateur }: { utilisateur: Utilisateur }) {
  const [ouvert, setOuvert] = useState(false);
  const [boite, setBoite] = useState<BoiteMessages>({ comptes: [], messages: [] });
  const [dest, setDest] = useState('');
  const [redaction, setRedaction] = useState<'nouveau' | 'reponse' | null>(null);
  const [contenu, setContenu] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'indisponible'>(() => typeof Notification === 'undefined' ? 'indisponible' : Notification.permission);
  const vus = useRef<Set<number> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  // Chrome exige un geste utilisateur pour autoriser le son.
  function preparerSon() {
    try {
      if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') void audio.current.resume().catch(() => {});
    } catch { /* Les notifications restent disponibles sans son. */ }
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
    preparerSon();
    if (typeof Notification === 'undefined') return;
    try { setPermission(await Notification.requestPermission()); }
    catch { setPermission(Notification.permission); }
  }
  function detecterMessages(nouvelleBoite: BoiteMessages) {
    const recus = nouvelleBoite.messages.filter(m => String(m.destinataireId) === String(utilisateur.id));
    const dejaVus = vus.current;
    if (dejaVus) {
      const nouveaux = recus.filter(m => !m.luLe && !dejaVus.has(m.id));
      if (nouveaux.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const notification = new Notification('Caisse SALFA · Nouveau message', {
            body: nouveaux.length === 1 ? `Message de ${nouveaux[0].auteurNom}` : `${nouveaux.length} nouveaux messages`,
            tag: 'salfa-message-prive',
            silent: true,
          });
          notification.onclick = () => { window.focus(); setOuvert(true); notification.close(); };
          sonner();
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
    const timer = window.setInterval(() => { void actualiser(); }, 60000);
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
      setContenu(''); setDest(''); setRedaction(null); setErreur('');
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
  const nonLus = boite.messages.filter(m => String(m.destinataireId) === String(utilisateur.id) && !m.luLe).length;
  return <><button className="icon-button relative" aria-label={`Messages privés${nonLus ? `, ${nonLus} non lus` : ''}`} title="Messages privés" onClick={() => { preparerSon(); setOuvert(true); void actualiser(); }}><Mail size={18} />{nonLus > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1 text-[10px] text-white">{nonLus}</span>}</button>
    {ouvert && <Modale titre="Messages privés" sousTitre="Vos échanges avec les autres utilisateurs" onFermer={() => setOuvert(false)}>
      <div className="mb-5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
        {permission === 'indisponible' ? <p>Notifications indisponibles. Chrome exige une connexion sécurisée HTTPS (ou localhost) pour les notifications.</p> : permission === 'denied' ? <p>Notifications bloquées. Autorisez-les dans les paramètres du site dans Chrome, puis rechargez la page.</p> : <><p>{permission === 'granted' ? 'Notifications autorisées. Ouvrez la messagerie après chaque lancement pour activer le son.' : 'Recevoir une notification Windows avec son pour les nouveaux messages.'}</p><button type="button" className="btn-secondary mt-2" onClick={() => void activerNotifications()}>{permission === 'granted' ? 'Activer le son' : 'Activer les notifications et le son'}</button></>}
      </div>
      {!redaction && <button type="button" className="btn-primary" onClick={() => { setDest(''); setRedaction('nouveau'); }}>Nouveau message</button>}
      {redaction && <form onSubmit={e => { e.preventDefault(); void envoyer(); }} className="space-y-3">
        {redaction === 'nouveau' ? <><label className="block text-sm font-semibold" htmlFor="dest-message">Destinataire</label><select className="field" id="dest-message" required value={dest} onChange={e => setDest(e.target.value)}><option value="">Choisir un utilisateur</option>{boite.comptes.map(c => <option key={c.id} value={c.id}>{c.nomComplet} ({c.identifiant})</option>)}</select></> : <p className="text-sm">Réponse à <strong>{boite.comptes.find(c => String(c.id) === dest)?.nomComplet ?? 'Utilisateur indisponible'}</strong></p>}
        <label className="block text-sm font-semibold" htmlFor="contenu-message">Message</label><textarea className="field" id="contenu-message" rows={3} maxLength={2000} required value={contenu} onChange={e => setContenu(e.target.value)} autoFocus />
        <div className="flex gap-2"><button className="btn-primary" disabled={occupe || !dest || !contenu.trim() || !boite.comptes.some(c => String(c.id) === dest)}>Envoyer</button><button type="button" className="btn-secondary" onClick={() => { setRedaction(null); setDest(''); setContenu(''); setErreur(''); }}>Annuler</button></div>
      </form>}
      {erreur && <p role="alert" className="mt-3 text-sm text-rose-700">{erreur}</p>}
      <div className="mt-6 flex items-center justify-between"><h3 className="font-bold">Échanges</h3><button className="btn-secondary" onClick={() => void actualiser()}>Actualiser</button></div>
      {boite.messages.length === 0 && <p className="mt-3 text-sm text-slate-500">Aucun message.</p>}
      <ul className="mt-3 space-y-2">{boite.messages.map(m => { const recu = String(m.destinataireId) === String(utilisateur.id); return <li key={m.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><p><strong>{recu ? `De ${m.auteurNom}` : `À ${m.destinataireNom}`}</strong> · {new Date(m.creeLe).toLocaleString('fr-FR')} {recu && !m.luLe && <strong>· Non lu</strong>}</p><p className="mt-1 whitespace-pre-wrap break-words">{m.contenu}</p>{recu && <div className="mt-2 flex flex-wrap gap-4"><button type="button" className="text-brand-700 underline disabled:opacity-50" disabled={!boite.comptes.some(c => String(c.id) === String(m.auteurId))} title={boite.comptes.some(c => String(c.id) === String(m.auteurId)) ? 'Répondre à ce message' : 'Cet utilisateur est désactivé ou indisponible'} onClick={() => { setDest(String(m.auteurId)); setRedaction('reponse'); setErreur(''); }}>Répondre</button>{!m.luLe && <button className="text-brand-700 underline" disabled={occupe} onClick={() => void lire(m.id)}>Marquer comme lu</button>}</div>}</li>; })}</ul>
    </Modale>}
  </>;
}
