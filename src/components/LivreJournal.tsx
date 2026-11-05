import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, FileText, Pencil, Printer, Trash2 } from 'lucide-react';
import type { Categories, Ecriture, LigneJournal, Sens } from '../types';
import { dateFr, formatAr } from '../utils/format';
import { entetesParDefaut, type EnteteDocument, type EntetesDocuments } from '../utils/entete';
import { ModaleBordereau } from './Bordereau';
import { EnteteBordereauModal } from './EnteteBordereauModal';
import { GestionCategoriesModal } from './GestionCategoriesModal';

interface LivreJournalProps {
  lignes: LigneJournal[];
  soldeOuverture: number;
  periode: string;
  recettes: number;
  depenses: number;
  soldeFin: number;
  filtreActif: boolean;
  enEditionId: string | null;
  onEditer: (ecriture: Ecriture) => void;
  onSupprimer: (id: string) => void;
  onReinitialiser: () => void;
  /** En-têtes personnalisés des deux bordereaux ; vide = en-têtes livrés. */
  entetes?: EntetesDocuments;
  /** L'en-tête est commun : un seul enregistrement vaut pour les deux documents. */
  onEnregistrerEntete?: (entete: EnteteDocument) => void;
  /** Catégories de saisie, séparées pour les recettes et les dépenses. */
  categories?: Categories;
  onEnregistrerCategories?: (sens: Sens, liste: string[]) => Promise<boolean>;
}

/** Ce que l'application peut demander au journal depuis l'extérieur. */
export interface LivreJournalHandle {
  /** Ouvre le bordereau imprimable d'une pièce (après enregistrement). */
  ouvrirBordereau: (ligne: LigneJournal) => void;
}
const PAR_PAGE = 50;

/**
 * `forwardRef` est nécessaire : l'application ouvre le bordereau d'une pièce
 * depuis l'extérieur, juste après son enregistrement.
 */
export const LivreJournal = forwardRef<LivreJournalHandle, LivreJournalProps>(function LivreJournal(
  { lignes, soldeOuverture, periode, recettes, depenses, soldeFin, filtreActif, enEditionId, onEditer, onSupprimer, onReinitialiser, entetes = entetesParDefaut(), onEnregistrerEntete, categories, onEnregistrerCategories },
  ref,
) {
  const [detailsOuverts, setDetailsOuverts] = useState<Record<string, boolean>>({});
  /**
   * L'en-tête peut changer pendant que la pièce est ouverte : le bordereau
   * reprend alors la valeur courante, jamais celle du montage.
   */
  const enteteCourant = entetes ?? entetesParDefaut();
  /** La pièce dont on imprime le bordereau : l'en-tête vient toujours de l'appelant. */
  const [numeroBordereau, setNumeroBordereau] = useState<string | null>(null);
  const bordereau = numeroBordereau ? lignes.find(l => l.numero === numeroBordereau) ?? null : null;
  const ouvrirBordereau = (ligne: LigneJournal) => setNumeroBordereau(ligne.numero);
  const [bordereauApresEnregistrement, setBordereauApresEnregistrement] = useState(false);
  useImperativeHandle(ref, () => ({
    ouvrirBordereau: (ligne: LigneJournal) => { setBordereauApresEnregistrement(true); setNumeroBordereau(ligne.numero); },
  }), []);
  const [entetesOuverts, setEntetesOuverts] = useState(false);
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false);
  const ouvrirEntetes = () => setEntetesOuverts(true);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [lignes]);
  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const pageActuelle = Math.min(page, pages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const fin = debut + PAR_PAGE;
  const horsPage = (i: number) => i < debut || i >= fin;

  return <>
    <section id="journal" className="card overflow-hidden" aria-label="Livre journal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div className="flex items-center gap-2.5"><BookOpen size={20} className="text-brand-700 dark:text-brand-400" /><div><h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Livre journal</h2><p className="mt-0.5 text-xs text-slate-500 sm:text-sm dark:text-slate-400">{periode} · {lignes.length} écriture{lignes.length > 1 ? 's' : ''}{filtreActif ? ' affichée(s) sur la sélection' : ''}</p></div></div><div className="flex items-center gap-2"><span className="badge badge-neutral">MGA · ariary</span></div></div>
      {filtreActif && <p className="border-b border-amber-100 bg-amber-50/70 px-5 py-2.5 text-xs text-amber-900 sm:text-sm dark:border-amber-950/60 dark:bg-amber-950/40 dark:text-amber-200">Vue filtrée : les totaux portent sur la sélection. Les soldes restent calculés sur le livre complet, dans l’ordre chronologique.</p>}
      <div className="relative overflow-x-auto">
        <table className="journal-table w-full min-w-[960px] text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"><th className="px-4 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">N° pièce</th><th className="px-3 py-3 font-semibold">Libellé & postes</th><th className="px-3 py-3 font-semibold">Catégorie</th><th className="px-3 py-3 text-right font-semibold">Recette</th><th className="px-3 py-3 text-right font-semibold">Dépense</th><th className="px-3 py-3 text-right font-semibold">Solde cumulé</th><th className="no-print px-3 py-3 text-center font-semibold">Action</th></tr></thead>
          <tbody><tr className="border-b border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-850/40"><td colSpan={6} className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400">Report à nouveau {filtreActif ? '— période complète' : ''}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatAr(soldeOuverture)}</td><td className="no-print" /></tr>
            {!lignes.length && <tr><td colSpan={8} className="px-5 py-16 text-center"><FileText size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p className="text-base font-semibold text-slate-700 dark:text-slate-300">{filtreActif ? 'Aucune écriture ne correspond aux filtres' : 'Aucune écriture pour cette période'}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{filtreActif ? 'Essayez une autre recherche ou réinitialisez les filtres.' : 'Ajoutez une recette ou une dépense pour commencer.'}</p>{filtreActif && <button className="btn-secondary mt-4" onClick={onReinitialiser}>Réinitialiser les filtres</button>}</td></tr>}
            {lignes.map((ligne, index) => {
              const aDetails = Boolean(ligne.lignesDetail?.length);
              const ouvert = Boolean(detailsOuverts[ligne.id]);
              const detailId = `detail-${ligne.id}`;
              const meta = [ligne.tiers, ligne.reference, ligne.observation].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
              return <React.Fragment key={ligne.id}>
                <tr className={`border-b border-slate-100 transition-colors dark:border-slate-800/80 ${horsPage(index) ? 'screen-page-hidden' : ''} ${enEditionId === ligne.id ? 'bg-amber-50 dark:bg-amber-950/40' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'}`}>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top tabular-nums text-slate-700 dark:text-slate-300">{dateFr(ligne.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-top font-mono text-xs font-medium text-slate-600 dark:text-slate-400 sm:text-sm">{ligne.numero || 'Sans numéro'}</td>
                  <td className="max-w-72 px-3 py-3.5 align-top"><p className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100 break-words sm:text-[15px]">{ligne.libelle}</p>{meta && <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 break-words">{meta}</p>}{aDetails && <button className={`mt-2 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${ouvert ? 'bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300' : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`} onClick={() => setDetailsOuverts(p => ({ ...p, [ligne.id]: !p[ligne.id] }))} aria-expanded={ouvert} aria-controls={detailId}><FileText size={13} />{ligne.lignesDetail!.length} postes<ChevronDown size={13} className={ouvert ? 'rotate-180' : ''} /></button>}</td>
                  <td className="max-w-40 px-3 py-3.5 align-top text-slate-700 dark:text-slate-300">{ligne.categorie}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{ligne.sens === 'RECETTE' ? formatAr(ligne.montant) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-rose-700 dark:text-rose-400">{ligne.sens === 'DEPENSE' ? formatAr(ligne.montant) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                  <td className={`whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums ${ligne.solde < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{formatAr(ligne.solde)}</td>
                  <td className="no-print px-2 py-3 align-top"><div className="flex justify-center gap-0.5 print:hidden"><button className="icon-button" title="Imprimer le bordereau" aria-label={`Imprimer le bordereau ${ligne.numero}`} onClick={() => ouvrirBordereau(ligne)}><Printer size={16} /></button><button className="icon-button" title="Modifier" aria-label={`Modifier ${ligne.numero}`} onClick={() => onEditer(ligne)}><Pencil size={16} /></button><button className="icon-button hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400" title="Supprimer" aria-label={`Supprimer ${ligne.numero}`} onClick={() => onSupprimer(ligne.id)}><Trash2 size={16} /></button></div></td>
                </tr>
                {aDetails && ouvert && <tr id={detailId} className={`border-b border-slate-100 bg-brand-50/30 dark:border-slate-800 dark:bg-brand-950/20 ${horsPage(index) ? 'screen-page-hidden' : ''}`}><td colSpan={8} className="px-5 py-4"><div className="rounded-lg border border-brand-100 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-850"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Détail du bordereau · {ligne.numero}</p><button className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400" onClick={() => ouvrirBordereau(ligne)}>Ouvrir le bordereau imprimable</button></div><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="p-2">Poste</th><th className="p-2">Référence / quittance</th><th className="p-2 text-right">Montant</th></tr></thead><tbody>{ligne.lignesDetail!.map(d => <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2 font-medium text-slate-800 dark:text-slate-200">{d.libelle}</td><td className="p-2 font-mono text-slate-600 dark:text-slate-400">{d.reference || '—'}</td><td className="p-2 text-right tabular-nums text-slate-900 dark:text-slate-100">{formatAr(d.montant)}</td></tr>)}</tbody><tfoot><tr className="border-t border-slate-200 font-semibold dark:border-slate-700"><td colSpan={2} className="p-2 text-slate-900 dark:text-slate-100">Total {ligne.sens === 'RECETTE' ? 'des recettes' : 'des dépenses'}</td><td className="p-2 text-right tabular-nums text-slate-900 dark:text-slate-100">{formatAr(ligne.montant)}</td></tr></tfoot></table></div></td></tr>}
              </React.Fragment>;
            })}
          </tbody>
          <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100"><td colSpan={4} className="px-4 py-3.5">{filtreActif ? 'Totaux de la sélection' : 'Totaux de la période'}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatAr(recettes)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatAr(depenses)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums" title="Solde de clôture de la période complète, hors filtres">{formatAr(soldeFin)}</td><td className="no-print" /></tr></tfoot>
        </table>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:text-sm dark:border-slate-800 dark:text-slate-400"><p>Le solde de clôture tient compte de toute la période, même lorsqu’elle est filtrée.</p>{pages > 1 && <div className="flex items-center gap-2"><button className="icon-button" disabled={pageActuelle === 1} aria-label="Page précédente" onClick={() => setPage(pageActuelle - 1)}><ChevronLeft size={16} /></button><span>Page {pageActuelle} / {pages}</span><button className="icon-button" disabled={pageActuelle === pages} aria-label="Page suivante" onClick={() => setPage(pageActuelle + 1)}><ChevronRight size={16} /></button></div>}</div>
      {pages > 1 && <p className="print-only px-4 py-2 text-xs">L’impression inclut toutes les pages de la sélection.</p>}
    </section>
    {bordereau && <>
      <ModaleBordereau
        ligne={bordereau}
        entete={enteteCourant}
        onModifierEntete={onEnregistrerEntete ? () => ouvrirEntetes() : undefined}
        onFermer={() => { setNumeroBordereau(null); setBordereauApresEnregistrement(false); }}
        imprimerDirectement={bordereauApresEnregistrement}
      />
    </>}
    {categoriesOuvertes && categories && onEnregistrerCategories && <GestionCategoriesModal
      categories={categories}
      onEnregistrer={onEnregistrerCategories}
      onFermer={() => setCategoriesOuvertes(false)}
    />}
    {entetesOuverts && onEnregistrerEntete && <EnteteBordereauModal
      entetes={entetes}
      onEnregistrer={entete => { onEnregistrerEntete(entete); setEntetesOuverts(false); }}
      onFermer={() => setEntetesOuverts(false)}
    />}
  </>;
});
