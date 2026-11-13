import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileText, RefreshCw, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import type { Sauvegarde } from '../types';
import { exporterSecours, exporterSqlLivre, lireSauvegardeSql, MAX_SQL_OCTETS } from '../utils/backup';
import { formatAr, horodatageFr } from '../utils/format';
import { exempleDisponible, jeuDeDemonstration, resumeExemple } from '../utils/demonstration';
import { totaliser } from '../utils/ledger';
import { MODE_API, exporterSql } from '../utils/api';
import { telechargerTexte } from '../utils/export';
import { Modale } from './Modale';

interface Props {
  livre: Sauvegarde;
  administrateur?: boolean;
  /** Jeu de démonstration : chargé depuis cette page, jamais imposé. */
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
  const [exempleConfirme, setExempleConfirme] = useState(false);
  const [exempleEnCours, setExempleEnCours] = useState(false);
  const exemple = exempleDisponible(livre);
  const apercuExemple = exemple ? jeuDeDemonstration(livre) : null;

  /** Le jeu d'exemple remplace le livre vide : jamais un livre déjà rempli. */
  async function chargerExemple() {
    if (!apercuExemple || exempleEnCours) return;
    setExempleEnCours(true); setErreurImport(''); setMessage('');
    try {
      if (await onRestaurer(apercuExemple)) {
        setExempleConfirme(false);
        setMessage('Exemples chargés : écritures de caisse, comptes bancaires, clients et fournisseurs sont prêts à parcourir.');
      } else setErreurImport('Les exemples n’ont pas pu être enregistrés. Rechargez le livre et réessayez.');
    } catch (e) {
      setErreurImport(e instanceof Error ? e.message : 'Chargement des exemples impossible.');
    } finally { setExempleEnCours(false); }
  }
  const totaux = apercu ? totaliser(apercu.ecritures) : null;

  async function chargerFichier(file?: File) {
    if (!file) return;
    setErreurImport(''); setApercu(null); setMessage(''); setLecture(true);
    try {
      if (!file.name.toLowerCase().endsWith('.sql')) throw new Error('Choisissez un fichier .sql.');
      if (file.size > MAX_SQL_OCTETS) throw new Error('Fichier trop volumineux : 24 Mo maximum.');
      setApercu(lireSauvegardeSql(await file.text()));
      setNomFichier(file.name);
    } catch (e) { setErreurImport(e instanceof Error ? e.message : 'Lecture du fichier impossible.'); }
    finally { setLecture(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function exporterBaseSql() {
    setErreurImport(''); setMessage(''); setSqlEnCours(true);
    try {
      if (MODE_API) {
        const { contenu, nom } = await exporterSql();
        telechargerTexte(contenu, nom, 'application/sql;charset=utf-8');
        setMessage(`Sauvegarde ${nom} téléchargée. Conservez-la dans un lieu sûr.`);
      } else {
        exporterSqlLivre(livre);
        setMessage('Sauvegarde SQL du livre local téléchargée. Conservez-la dans un lieu sûr.');
      }
    } catch (e) { setErreurImport(e instanceof Error ? e.message : 'L’export SQL a échoué.'); }
    finally { setSqlEnCours(false); }
  }

  async function restaurerLivre() {
    if (!apercu || !accepte || restauration) return;
    setRestauration(true); setErreurImport('');
    try {
      if (await onRestaurer(apercu)) {
        setConfirmation(false); setApercu(null);
        setMessage('Restauration enregistrée. Le livre a été remplacé par la sauvegarde sélectionnée.');
      } else {
        setConfirmation(false);
        setErreurImport('La restauration n’a pas pu être confirmée. Rechargez le livre et vérifiez son contenu avant de réessayer.');
      }
    } catch (e) {
      setConfirmation(false);
      setErreurImport(e instanceof Error ? e.message : 'Restauration impossible.');
    } finally { setRestauration(false); }
  }

  return <div className="space-y-5">
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5 sm:p-6 dark:border-slate-800"><div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"><ShieldCheck size={26} /></span><div><h2 className="text-lg font-bold">Données & sauvegardes SQL</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sauvegardez régulièrement et conservez plusieurs copies dans un endroit sécurisé.</p></div></div></div>
      {administrateur ? <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div><h3 className="flex items-center gap-2 text-base font-semibold"><Database size={18} />Sauvegarder</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{MODE_API ? 'Téléchargez la base MySQL complète : écritures, exercices, paramètres et comptes (mots de passe hachés). Ce fichier peut aussi être importé dans phpMyAdmin.' : 'Téléchargez le livre de ce navigateur dans un fichier SQL. Les comptes locaux ne sont pas inclus.'}</p>
          <button className="btn-primary mt-4" onClick={() => void exporterBaseSql()} disabled={sqlEnCours || (!MODE_API && Boolean(erreur))}><Download size={16} />{sqlEnCours ? 'Préparation…' : 'Télécharger la sauvegarde SQL'}</button>
        </div>
        <div className="lg:border-l lg:border-slate-100 lg:pl-6 dark:lg:border-slate-800"><h3 className="flex items-center gap-2 text-base font-semibold"><Upload size={18} />Restaurer</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Choisissez une sauvegarde SQL récente exportée par l’application. Le livre est vérifié avant remplacement ; les comptes et mots de passe actuels ne sont pas modifiés.</p>
          <input ref={inputRef} type="file" accept=".sql,application/sql,text/plain" className="sr-only" aria-label="Fichier de sauvegarde SQL" onChange={e => void chargerFichier(e.target.files?.[0])} />
          <button className="btn-secondary mt-4" disabled={lecture} onClick={() => inputRef.current?.click()}><Upload size={16} />{lecture ? 'Vérification…' : 'Choisir une sauvegarde SQL'}</button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Fichier : 24 Mo maximum ; livre intégré : 8 Mo maximum. Pour un ancien dump ou restaurer aussi les comptes, utilisez phpMyAdmin en mode serveur.</p>
        </div>
      </div> : <p className="p-5 text-sm">La sauvegarde et la restauration sont réservées à l’administrateur.</p>}
      {message && <p role="status" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 size={18} className="shrink-0" />{message}</p>}
      {erreurImport && <p role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-rose-50 p-3.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"><AlertCircle size={18} className="shrink-0" />{erreurImport}</p>}
      {apercu && totaux && <div className="mx-5 mb-5 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900/60 sm:mx-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><FileText size={20} />{nomFichier}</p><p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Livre vérifié · {horodatageFr(apercu.exportedAt ?? apercu.updatedAt)}</p></div><button className="btn-primary" onClick={() => { setAccepte(false); setConfirmation(true); }}><RefreshCw size={16} />Restaurer cette sauvegarde</button></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"><div><dt>Écritures courantes</dt><dd className="font-bold">{apercu.ecritures.length}</dd></div><div><dt>Recettes courantes</dt><dd className="font-bold">{formatAr(totaux.recettes)}</dd></div><div><dt>Dépenses courantes</dt><dd className="font-bold">{formatAr(totaux.depenses)}</dd></div><div><dt>Exercices archivés</dt><dd className="font-bold">{apercu.exercicesClotures.length}</dd></div></dl></div>}
    </section>
    {administrateur && exemple && apercuExemple && <section className="card p-5" aria-label="Exemples de démonstration">
      <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={19} className="text-brand-700 dark:text-brand-300" />Exemples de démonstration</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Le livre est vide : chargez un jeu d’exemples pour voir l’application en fonctionnement — recettes et dépenses de caisse,
        comptes bancaires BNI/C et BNI/D avec leur RIB, clients, fournisseurs, virements et bordereaux.
        Une sauvegarde SQL du livre actuel est téléchargée avant le remplacement, et l’exercice repris est l’année en cours.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500 dark:text-slate-400">Écritures de caisse</dt><dd className="font-bold">{apercuExemple.ecritures.length}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Virements</dt><dd className="font-bold">{apercuExemple.virements?.ecritures.length ?? 0}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Comptes bancaires</dt><dd className="font-bold">{apercuExemple.virements?.comptes.length ?? 0}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Clients et fournisseurs</dt><dd className="font-bold">{apercuExemple.virements?.tiers.length ?? 0}</dd></div>
      </dl>
      <button className="btn-primary mt-4" onClick={() => setExempleConfirme(true)}><Sparkles size={16} />Charger les exemples</button>
    </section>}
    <section className="card p-5"><h3 className="flex items-center gap-2 font-semibold"><Database size={19} />{MODE_API ? 'Livre sur le serveur' : 'Livre local'}</h3><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Révision {livre.revision} · {livre.ecritures.length} écriture(s) courante(s). {MODE_API ? 'Les données sont stockées dans MySQL.' : 'Les données sont stockées dans ce navigateur.'}</p><div className="mt-4 flex flex-wrap gap-2"><button className="btn-secondary" onClick={onRecharger}><RefreshCw size={16} />Recharger le livre</button>{!MODE_API && administrateur && <button className="btn-secondary" onClick={() => { try { exporterSecours(); setMessage('Export SQL brut de diagnostic téléchargé ; il ne peut pas être restauré automatiquement.'); } catch (e) { setErreurImport(e instanceof Error ? e.message : 'Export de secours impossible.'); } }}><Download size={16} />Export brut de secours</button>}</div></section>
    {exempleConfirme && apercuExemple && <Modale titre="Charger les exemples ?" sousTitre="Le livre vide sera remplacé par un jeu de démonstration." largeur="petite" icone={<Sparkles size={22} />} onFermer={() => { if (!exempleEnCours) setExempleConfirme(false); }} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" disabled={exempleEnCours} onClick={() => setExempleConfirme(false)}>Annuler</button><button className="btn-primary" disabled={exempleEnCours} onClick={() => void chargerExemple()}>{exempleEnCours ? 'Chargement…' : 'Charger les exemples'}</button></div>}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <p>Le livre actuel est vide : les exemples le remplacent sans rien perdre. S’il contenait déjà des écritures, cette proposition ne s’afficherait pas.</p>
        <p>Une sauvegarde SQL du livre actuel est téléchargée avant le remplacement ; les comptes et mots de passe ne changent pas.</p>
        <p className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">{resumeExemple()} Les pièces sont datées de l’année en cours, pour apparaître dans les périodes affichées.</p>
      </div>
    </Modale>}
    {confirmation && apercu && <Modale titre="Remplacer le livre actuel ?" sousTitre="Cette opération nécessite votre confirmation explicite." largeur="petite" icone={<RefreshCw size={22} />} onFermer={() => { if (!restauration) setConfirmation(false); }} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" disabled={restauration} onClick={() => setConfirmation(false)}>Annuler</button><button className="btn-danger" disabled={!accepte || restauration} onClick={() => void restaurerLivre()}>{restauration ? 'Restauration…' : 'Restaurer et remplacer'}</button></div>}><div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"><p>Le livre actuel sera remplacé sans fusion, y compris les exercices archivés. Les comptes et mots de passe ne seront pas modifiés.</p><p>Une sauvegarde SQL des données actuelles sera téléchargée avant le remplacement. Vérifiez que le téléchargement a abouti. {erreur && !MODE_API ? 'Si le stockage est illisible, un export brut de secours sera téléchargé.' : ''}</p><label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40"><input id={id} type="checkbox" className="mt-1 size-4 accent-brand-700" checked={accepte} onChange={e => setAccepte(e.target.checked)} /><span>Je comprends que le livre actuel sera remplacé.</span></label></div></Modale>}
  </div>;
}
