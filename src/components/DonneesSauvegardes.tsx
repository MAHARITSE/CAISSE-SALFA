import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileJson, HardDrive, Info, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import type { Sauvegarde } from '../types';
import { exporterSauvegarde, exporterSecours, lireSauvegarde } from '../utils/backup';
import { MAX_IMPORT_OCTETS } from '../utils/constants';
import { formatAr, horodatageFr } from '../utils/format';
import { totaliser } from '../utils/ledger';
import { Modale } from './Modale';

interface Props {
  livre: Sauvegarde;
  erreur: string | null;
  onRestaurer: (livre: Sauvegarde) => boolean;
  onRecharger: () => void;
}

export function DonneesSauvegardes({ livre, erreur, onRestaurer, onRecharger }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [apercu, setApercu] = useState<Sauvegarde | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [erreurImport, setErreurImport] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [accepte, setAccepte] = useState(false);
  const [lecture, setLecture] = useState(false);
  const totaux = apercu ? totaliser(apercu.ecritures) : null;
  const poids = (new Blob([JSON.stringify(livre)]).size / 1024).toFixed(1).replace('.', ',');

  async function chargerFichier(file?: File) {
    if (!file) return;
    setErreurImport(''); setApercu(null); setMessage(''); setLecture(true);
    try {
      if (file.size > MAX_IMPORT_OCTETS) throw new Error('Fichier trop volumineux : 8 Mo maximum.');
      const contenu = await file.text();
      setApercu(lireSauvegarde(contenu));
      setNomFichier(file.name);
    } catch (e) { setErreurImport(e instanceof Error ? e.message : 'Lecture du fichier impossible.'); }
    finally { setLecture(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  function exporter() {
    try { exporterSauvegarde(livre); setMessage('Sauvegarde JSON téléchargée. Conservez-la dans un dossier sûr, séparé de ce navigateur.'); }
    catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export impossible.'); }
  }

  return <div className="space-y-5">
    <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck size={23} /></span><div><h2 className="text-base font-bold">Vos données, sous votre responsabilité</h2><p className="mt-1 text-xs text-slate-500">Une sauvegarde régulière protège votre travail contre la perte du stockage navigateur.</p></div></div></div>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><Download size={17} className="text-brand-700" />Exporter une sauvegarde complète</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">Le fichier JSON contient les écritures, les détails et références, le solde initial, les modèles et les compteurs de pièces. Il peut être restauré sur un autre navigateur.</p><button className="btn-primary mt-4" onClick={exporter} disabled={Boolean(erreur)}><Download size={16} />Télécharger la sauvegarde JSON</button></div>
        <div className="lg:border-l lg:border-slate-100 lg:pl-6"><h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={17} className="text-brand-700" />Restaurer un fichier</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">Choisissez une sauvegarde CAISSE SALFA. Son contenu est vérifié avant toute modification ; la restauration remplace le livre, elle ne fusionne pas les écritures.</p><input ref={inputRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Fichier de sauvegarde JSON" onChange={e => void chargerFichier(e.target.files?.[0])} /><button className="btn-secondary mt-4" disabled={lecture} onClick={() => inputRef.current?.click()}><Upload size={16} />{lecture ? 'Vérification…' : 'Choisir une sauvegarde JSON'}</button><p className="mt-2 text-[11px] text-slate-400">Format version 1 · 8 Mo maximum</p></div></div>
      {message && <p role="status" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 size={16} className="shrink-0" />{message}</p>}
      {erreurImport && <p role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={16} className="shrink-0" />{erreurImport}</p>}
      {apercu && totaux && <div className="mx-5 mb-5 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:mx-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-brand-900"><FileJson size={18} />{nomFichier}</p><p className="mt-1 text-xs text-emerald-700">Fichier valide · exporté le {horodatageFr(apercu.exportedAt ?? apercu.updatedAt)}</p></div><button className="btn-primary" onClick={() => { setAccepte(false); setConfirmation(true); }}><RefreshCw size={15} />Restaurer cette sauvegarde</button></div><dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4"><div><dt className="text-slate-500">Écritures</dt><dd className="mt-1 font-bold">{apercu.ecritures.length}</dd></div><div><dt className="text-slate-500">Recettes totales</dt><dd className="mt-1 font-bold text-emerald-700">{formatAr(totaux.recettes)}</dd></div><div><dt className="text-slate-500">Dépenses totales</dt><dd className="mt-1 font-bold text-rose-700">{formatAr(totaux.depenses)}</dd></div><div><dt className="text-slate-500">Modèles / solde initial</dt><dd className="mt-1 font-bold">{apercu.masques.length} / {formatAr(apercu.parametres.soldeInitial)}</dd></div></dl></div>}
    </section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]"><section className="card p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Info size={18} className="text-brand-700" />Ce qu’il faut savoir</h3><ul className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600"><li className="flex gap-2"><HardDrive size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>Les données restent dans le stockage local de ce navigateur, sur cet appareil. Elles ne sont pas envoyées à un serveur et ne sont pas synchronisées entre appareils.</span></li><li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>Le stockage et les fichiers exportés ne sont pas chiffrés par l’application. Utilisez un appareil protégé et restreignez l’accès au navigateur ; évitez les ordinateurs partagés.</span></li><li className="flex gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" /><span>Effacer les données du site, changer de profil ou utiliser la navigation privée peut entraîner une perte des données. Exportez une sauvegarde après chaque session et conservez plusieurs copies.</span></li><li className="flex gap-2"><RefreshCw size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>Avant une restauration, le livre actuel est téléchargé en sauvegarde. En cas de stockage corrompu, un export brut de secours est téléchargé à la place.</span></li></ul></section>
      <section className="card p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Database size={18} className="text-brand-700" />État du livre local</h3><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Écritures / modèles</dt><dd className="font-semibold">{livre.ecritures.length} / {livre.masques.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Taille approximative</dt><dd className="font-semibold">{poids} Ko</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Révision locale</dt><dd className="font-semibold">{livre.revision}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Dernier enregistrement</dt><dd className="font-semibold">{livre.revision ? horodatageFr(livre.updatedAt) : 'Livre initial non modifié'}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><button className="btn-secondary" onClick={onRecharger}><RefreshCw size={15} />Recharger le livre</button><button className="btn-secondary" onClick={() => { try { exporterSecours(); setMessage('Export brut téléchargé. Il contient les clés d’origine, y compris les données éventuellement corrompues.'); } catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export de secours impossible.'); } }}><Download size={15} />Export brut de secours</button></div><p className="mt-3 text-[11px] leading-relaxed text-slate-500">L’export brut est destiné au diagnostic et à la récupération. Pour restaurer l’application, utilisez la sauvegarde JSON complète.</p></section></div>
    {confirmation && apercu && <Modale titre="Remplacer le livre actuel ?" sousTitre="Cette opération nécessite votre confirmation explicite." largeur="petite" icone={<RefreshCw size={20} />} onFermer={() => setConfirmation(false)} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirmation(false)}>Annuler</button><button className="btn-danger" disabled={!accepte} onClick={() => { if (accepte && onRestaurer(apercu)) { setConfirmation(false); setApercu(null); setMessage('Restauration enregistrée. Le livre a été remplacé par la sauvegarde sélectionnée.'); } }}>Restaurer et remplacer</button></div>}><div className="space-y-4 text-xs leading-relaxed text-slate-600"><p>Le fichier contient <strong>{apercu.ecritures.length} écriture(s)</strong> et <strong>{apercu.masques.length} modèle(s)</strong>. Toutes les données actuelles seront remplacées, sans fusion.</p><p>{erreur ? 'Le stockage actuel étant illisible, un export brut de secours sera téléchargé avant la restauration.' : 'Une sauvegarde JSON du livre actuel sera téléchargée automatiquement avant la restauration.'} Vérifiez que le téléchargement a abouti.</p><label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><input id={id} type="checkbox" className="mt-0.5 accent-brand-700" checked={accepte} onChange={e => setAccepte(e.target.checked)} /><span>Je comprends que les données actuelles seront remplacées et je souhaite restaurer ce fichier.</span></label>{erreur && <p role="alert" className="text-rose-700">{erreur}</p>}</div></Modale>}
  </div>;
}
