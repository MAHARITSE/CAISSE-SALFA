import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileJson, HardDrive, Info, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import type { Sauvegarde } from '../types';
import { exporterSauvegarde, exporterSecours, lireSauvegarde } from '../utils/backup';
import { MAX_IMPORT_OCTETS } from '../utils/constants';
import { formatAr, horodatageFr } from '../utils/format';
import { totaliser } from '../utils/ledger';
import { MODE_API, exporterSql } from '../utils/api';
import { telechargerTexte } from '../utils/export';
import { Modale } from './Modale';

interface Props {
  livre: Sauvegarde;
  /** Le dump .sql contient les comptes : seul l'administrateur le produit. */
  administrateur?: boolean;
  erreur: string | null;
  onRestaurer: (livre: Sauvegarde) => boolean | Promise<boolean>;
  onRecharger: () => void;
}

export function DonneesSauvegardes({ livre, administrateur = false, erreur, onRestaurer, onRecharger }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [apercu, setApercu] = useState<Sauvegarde | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [erreurImport, setErreurImport] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [accepte, setAccepte] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [restauration, setRestauration] = useState(false);
  const [sqlEnCours, setSqlEnCours] = useState(false);
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

  async function restaurerLivre() {
    if (!apercu || !accepte) return;
    setRestauration(true);
    try {
      if (await onRestaurer(apercu)) {
        setConfirmation(false); setApercu(null);
        setMessage('Restauration enregistrée. Le livre a été remplacé par la sauvegarde sélectionnée.');
      }
    } finally { setRestauration(false); }
  }

  /**
   * Dump MySQL : le fichier que l'on réimporte tel quel dans phpMyAdmin.
   * C'est la sauvegarde de référence sous WAMP — elle restitue la structure
   * des tables, les écritures, les en-têtes et les comptes.
   */
  async function exporterBaseSql() {
    setErreurImport(''); setSqlEnCours(true);
    try {
      const { contenu, nom } = await exporterSql();
      telechargerTexte(contenu, nom, 'application/sql;charset=utf-8');
      setMessage(`Sauvegarde ${nom} téléchargée : structure et données de la base. Réimportez-la dans phpMyAdmin pour restaurer.`);
    } catch (e) {
      setErreurImport(e instanceof Error ? e.message : 'L’export SQL a échoué.');
    } finally { setSqlEnCours(false); }
  }

  function exporter() {
    try { exporterSauvegarde(livre); setMessage('Sauvegarde JSON téléchargée. Conservez-la dans un dossier sûr, séparé de ce navigateur.'); }
    catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export impossible.'); }
  }

  return <div className="space-y-5">
    <section className="card overflow-hidden"><div className="border-b border-slate-100 dark:border-slate-800 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300"><ShieldCheck size={26} /></span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Vos données, sous votre responsabilité</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{MODE_API ? 'Les écritures sont enregistrées dans MySQL sur le serveur WAMP. Une sauvegarde régulière — dump .sql, ou JSON — protège votre travail.' : 'Une sauvegarde régulière protège votre travail contre la perte du stockage navigateur.'}</p></div></div></div>
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        {MODE_API && administrateur && <div>
          <h3 className="flex items-center gap-2 text-base font-semibold"><Database size={18} className="text-brand-700 dark:text-brand-300" />Sauvegarde de la base (.sql)</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Le fichier <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">.sql</code> contient la structure des tables et toutes les données : écritures, en-têtes, catégories et comptes. C’est la sauvegarde à privilégier sous WAMP : elle se réimporte dans phpMyAdmin par <em>Importer</em>.</p>
          <button className="btn-primary mt-4" onClick={() => void exporterBaseSql()} disabled={sqlEnCours}><Database size={16} />{sqlEnCours ? 'Préparation…' : 'Télécharger la sauvegarde .sql'}</button>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">Réservée à l’administrateur : le fichier contient les comptes. Les mots de passe n’y sont que hachés. Les sessions ouvertes ne sont pas exportées.</p>
        </div>}
        <div><h3 className="flex items-center gap-2 text-base font-semibold"><Download size={18} className="text-brand-700 dark:text-brand-300" />Exporter une sauvegarde complète</h3><p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Le fichier JSON contient les écritures, les détails et références, le solde initial, les modèles et les compteurs de pièces. Il peut être restauré sur un autre navigateur.</p><button className="btn-primary mt-4" onClick={exporter} disabled={Boolean(erreur)}><Download size={16} />Télécharger la sauvegarde JSON</button></div>
        <div className="lg:border-l lg:border-slate-100 lg:pl-6"><h3 className="flex items-center gap-2 text-base font-semibold"><Upload size={18} className="text-brand-700 dark:text-brand-300" />Restaurer un fichier</h3><p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Choisissez une sauvegarde CAISSE SALFA. Son contenu est vérifié avant toute modification ; la restauration remplace le livre, elle ne fusionne pas les écritures.</p><input ref={inputRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Fichier de sauvegarde JSON" onChange={e => void chargerFichier(e.target.files?.[0])} /><button className="btn-secondary mt-4" disabled={lecture} onClick={() => inputRef.current?.click()}><Upload size={16} />{lecture ? 'Vérification…' : 'Choisir une sauvegarde JSON'}</button><p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Format version 1 · 8 Mo maximum</p></div></div>
      {message && <p role="status" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-3.5 text-sm text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={18} className="shrink-0" />{message}</p>}
      {erreurImport && <p role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3.5 text-sm text-rose-800 dark:text-rose-300"><AlertCircle size={18} className="shrink-0" />{erreurImport}</p>}
      {apercu && totaux && <div className="mx-5 mb-5 rounded-xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/40 p-4 sm:mx-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-base font-semibold text-brand-900 dark:text-brand-200"><FileJson size={20} />{nomFichier}</p><p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Fichier valide · exporté le {horodatageFr(apercu.exportedAt ?? apercu.updatedAt)}</p></div><button className="btn-primary" onClick={() => { setAccepte(false); setConfirmation(true); }}><RefreshCw size={16} />Restaurer cette sauvegarde</button></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"><div><dt className="text-slate-500 dark:text-slate-400">Écritures</dt><dd className="mt-1 font-bold text-slate-900 dark:text-slate-100">{apercu.ecritures.length}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Recettes totales</dt><dd className="mt-1 font-bold text-emerald-700 dark:text-emerald-400">{formatAr(totaux.recettes)}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Dépenses totales</dt><dd className="mt-1 font-bold text-rose-700 dark:text-rose-400">{formatAr(totaux.depenses)}</dd></div><div><dt className="text-slate-500 dark:text-slate-400">Modèles / solde initial</dt><dd className="mt-1 font-bold text-slate-900 dark:text-slate-100">{apercu.masques.length} / {formatAr(apercu.parametres.soldeInitial)}</dd></div></dl></div>}
    </section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]"><section className="card p-5"><h3 className="flex items-center gap-2 text-base font-semibold"><Info size={19} className="text-brand-700 dark:text-brand-300" />Ce qu’il faut savoir</h3><ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300"><li className="flex gap-2"><HardDrive size={16} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" /><span>{MODE_API ? 'Les données sont enregistrées dans la base MySQL du serveur WAMP et partagées entre les postes autorisés. Chaque personne doit avoir son propre compte.' : 'Les données restent dans le stockage local de ce navigateur, sur cet appareil. Elles ne sont pas envoyées à un serveur et ne sont pas synchronisées entre appareils.'}</span></li><li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" /><span>Le stockage et les fichiers exportés ne sont pas chiffrés par l’application. Utilisez un appareil protégé et restreignez l’accès au navigateur ; évitez les ordinateurs partagés.</span></li><li className="flex gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" /><span>{MODE_API ? 'Les données ne sont pas stockées dans le navigateur : effacer les données du site, changer de profil ou naviguer en privé ne touche pas au livre. Seule la base MySQL fait foi.' : 'Effacer les données du site, changer de profil ou utiliser la navigation privée peut entraîner une perte des données. Exportez une sauvegarde après chaque session et conservez plusieurs copies.'}</span></li><li className="flex gap-2"><RefreshCw size={16} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" /><span>Avant une restauration, le livre actuel est téléchargé en sauvegarde. En cas de stockage corrompu, un export brut de secours est téléchargé à la place.</span></li></ul></section>
      <section className="card p-5"><h3 className="flex items-center gap-2 text-base font-semibold"><Database size={19} className="text-brand-700 dark:text-brand-300" />{MODE_API ? 'État du livre sur le serveur' : 'État du livre local'}</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Écritures / modèles</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{livre.ecritures.length} / {livre.masques.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Taille approximative</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{poids} Ko</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Révision {MODE_API ? 'serveur' : 'locale'}</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{livre.revision}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Dernier enregistrement</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{livre.revision ? horodatageFr(livre.updatedAt) : 'Livre initial non modifié'}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><button className="btn-secondary" onClick={onRecharger}><RefreshCw size={16} />Recharger le livre</button><button className="btn-secondary" onClick={() => {
            // Serveur : le livre MySQL tel qu'il est enregistré, sans passer par
            // le stockage du navigateur, qui n'en contient aucune copie.
            if (MODE_API) {
              try { exporterSauvegarde(livre); setMessage('Copie du livre MySQL téléchargée telle qu’elle est enregistrée dans la base.'); }
              catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export impossible.'); }
              return;
            }
            try { exporterSecours(); setMessage('Export brut téléchargé. Il contient les clés d’origine, y compris les données éventuellement corrompues.'); } catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export de secours impossible.'); }
          }}><Download size={16} />{MODE_API ? 'Copie du livre MySQL' : 'Export brut de secours'}</button></div><p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">{MODE_API ? 'Les données ne vivent que dans MySQL : cette copie est un instantané du livre enregistré. Pour repartir d’une base neuve, utilisez la sauvegarde .sql ; pour réimporter des écritures, la sauvegarde JSON.' : 'L’export brut est destiné au diagnostic et à la récupération. Pour restaurer l’application, utilisez la sauvegarde JSON complète.'}</p></section></div>
    {confirmation && apercu && <Modale titre="Remplacer le livre actuel ?" sousTitre="Cette opération nécessite votre confirmation explicite." largeur="petite" icone={<RefreshCw size={22} />} onFermer={() => setConfirmation(false)} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirmation(false)}>Annuler</button><button className="btn-danger" disabled={!accepte || restauration} onClick={() => void restaurerLivre()}>{restauration ? 'Restauration…' : 'Restaurer et remplacer'}</button></div>}><div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"><p>Le fichier contient <strong>{apercu.ecritures.length} écriture(s)</strong> et <strong>{apercu.masques.length} modèle(s)</strong>. Toutes les données actuelles seront remplacées, sans fusion.</p><p>{MODE_API ? 'Une copie du livre actuel enregistré dans MySQL sera téléchargée avant la restauration.' : (erreur ? 'Le stockage actuel étant illisible, un export brut de secours sera téléchargé avant la restauration.' : 'Une sauvegarde JSON du livre actuel sera téléchargée automatiquement avant la restauration.')} Vérifiez que le téléchargement a abouti.</p><label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3.5"><input id={id} type="checkbox" className="mt-1 size-4 accent-brand-700" checked={accepte} onChange={e => setAccepte(e.target.checked)} /><span className="text-sm">Je comprends que les données actuelles seront remplacées et je souhaite restaurer ce fichier.</span></label>{erreur && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{erreur}</p>}</div></Modale>}
  </div>;
}
