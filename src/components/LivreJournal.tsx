import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, FileText, Pencil, Printer, Settings2, Trash2 } from 'lucide-react';
import type { Ecriture, LigneJournal } from '../types';
import { dateFr, formatAr } from '../utils/format';
import { entetesParDefaut, type DocumentEntete, type EnteteDocument, type EntetesDocuments } from '../utils/entete';
import { ModaleBordereau } from './Bordereau';
import { EnteteBordereauModal } from './EnteteBordereauModal';

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
  onEnregistrerEntete?: (document: DocumentEntete, entete: EnteteDocument) => void;
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
  { lignes, soldeOuverture, periode, recettes, depenses, soldeFin, filtreActif, enEditionId, onEditer, onSupprimer, onReinitialiser, entetes = entetesParDefaut(), onEnregistrerEntete },
  ref,
) {
  const [detailsOuverts, setDetailsOuverts] = useState<Record<string, boolean>>({});
  const [bordereau, setBordereau] = useState<LigneJournal | null>(null);
  const [bordereauApresEnregistrement, setBordereauApresEnregistrement] = useState(false);
  useImperativeHandle(ref, () => ({
    ouvrirBordereau: (ligne: LigneJournal) => { setBordereauApresEnregistrement(true); setBordereau(ligne); },
  }), []);
  const [entetesOuverts, setEntetesOuverts] = useState(false);
  const [documentEntete, setDocumentEntete] = useState<DocumentEntete>('depense');
  const ouvrirEntetes = (document?: DocumentEntete) => {
    if (document) setDocumentEntete(document);
    setEntetesOuverts(true);
  };
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [lignes]);
  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const pageActuelle = Math.min(page, pages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const fin = debut + PAR_PAGE;
  const horsPage = (i: number) => i < debut || i >= fin;

  return <>
    <section id="journal" className="card overflow-hidden" aria-label="Livre journal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><BookOpen size={18} className="text-brand-700" /><div><h2 className="text-sm font-bold">Livre journal</h2><p className="mt-0.5 text-[11px] text-slate-500">{periode} · {lignes.length} écriture{lignes.length > 1 ? 's' : ''}{filtreActif ? ' affichée(s) sur la sélection' : ''}</p></div></div><div className="flex items-center gap-2"><span className="badge badge-neutral">MGA · ariary</span>{onEnregistrerEntete && <button className="btn-secondary" onClick={() => ouvrirEntetes()} title="Modifier l’en-tête des bordereaux"><Settings2 size={15} />En-tête</button>}</div></div>
      {filtreActif && <p className="border-b border-amber-100 bg-amber-50/70 px-5 py-2 text-[11px] text-amber-900">Vue filtrée : les totaux portent sur la sélection. Les soldes restent calculés sur le livre complet, dans l’ordre chronologique.</p>}
      <div className="relative overflow-x-auto">
        <table className="journal-table w-full min-w-[960px] text-xs"><thead><tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">N° pièce</th><th className="px-3 py-3 font-semibold">Libellé & postes</th><th className="px-3 py-3 font-semibold">Catégorie</th><th className="px-3 py-3 text-right font-semibold">Recette</th><th className="px-3 py-3 text-right font-semibold">Dépense</th><th className="px-3 py-3 text-right font-semibold">Solde cumulé</th><th className="no-print px-3 py-3 text-center font-semibold">Action</th></tr></thead>
          <tbody><tr className="border-b border-slate-200 bg-slate-50/40"><td colSpan={6} className="px-4 py-3 font-medium text-slate-500">Report à nouveau {filtreActif ? '— période complète' : ''}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAr(soldeOuverture)}</td><td className="no-print" /></tr>
            {!lignes.length && <tr><td colSpan={8} className="px-5 py-16 text-center"><FileText size={32} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-slate-700">{filtreActif ? 'Aucune écriture ne correspond aux filtres' : 'Aucune écriture pour cette période'}</p><p className="mt-1 text-xs text-slate-500">{filtreActif ? 'Essayez une autre recherche ou réinitialisez les filtres.' : 'Ajoutez une recette ou une dépense pour commencer.'}</p>{filtreActif && <button className="btn-secondary mt-4" onClick={onReinitialiser}>Réinitialiser les filtres</button>}</td></tr>}
            {lignes.map((ligne, index) => {
              const aDetails = Boolean(ligne.lignesDetail?.length);
              const ouvert = Boolean(detailsOuverts[ligne.id]);
              const detailId = `detail-${ligne.id}`;
              const meta = [ligne.tiers, ligne.reference, ligne.observation].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
              return <React.Fragment key={ligne.id}>
                <tr className={`border-b border-slate-100 transition-colors ${horsPage(index) ? 'screen-page-hidden' : ''} ${enEditionId === ligne.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'}`}>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top tabular-nums text-slate-600">{dateFr(ligne.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-top font-mono text-[11px] text-slate-500">{ligne.numero || 'Sans numéro'}</td>
                  <td className="max-w-72 px-3 py-3.5 align-top"><p className="font-semibold leading-relaxed text-slate-800 break-words">{ligne.libelle}</p>{meta && <p className="mt-1 text-[11px] leading-relaxed text-slate-500 break-words">{meta}</p>}{aDetails && <button className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${ouvert ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`} onClick={() => setDetailsOuverts(p => ({ ...p, [ligne.id]: !p[ligne.id] }))} aria-expanded={ouvert} aria-controls={detailId}><FileText size={12} />{ligne.lignesDetail!.length} postes<ChevronDown size={12} className={ouvert ? 'rotate-180' : ''} /></button>}</td>
                  <td className="max-w-40 px-3 py-3.5 align-top text-slate-600">{ligne.categorie}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-emerald-700">{ligne.sens === 'RECETTE' ? formatAr(ligne.montant) : <span className="text-slate-300">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-rose-700">{ligne.sens === 'DEPENSE' ? formatAr(ligne.montant) : <span className="text-slate-300">—</span>}</td>
                  <td className={`whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums ${ligne.solde < 0 ? 'text-rose-700' : 'text-slate-800'}`}>{formatAr(ligne.solde)}</td>
                  <td className="no-print px-2 py-3 align-top"><div className="flex justify-center gap-0.5 print:hidden"><button className="icon-button" title="Imprimer le bordereau" aria-label={`Imprimer le bordereau ${ligne.numero}`} onClick={() => setBordereau(ligne)}><Printer size={15} /></button><button className="icon-button" title="Modifier" aria-label={`Modifier ${ligne.numero}`} onClick={() => onEditer(ligne)}><Pencil size={15} /></button><button className="icon-button hover:bg-rose-50 hover:text-rose-600" title="Supprimer" aria-label={`Supprimer ${ligne.numero}`} onClick={() => onSupprimer(ligne.id)}><Trash2 size={15} /></button></div></td>
                </tr>
                {aDetails && ouvert && <tr id={detailId} className={`border-b border-slate-100 bg-brand-50/30 ${horsPage(index) ? 'screen-page-hidden' : ''}`}><td colSpan={8} className="px-5 py-4"><div className="rounded-lg border border-brand-100 bg-white p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Détail du bordereau · {ligne.numero}</p><button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setBordereau(ligne)}>Ouvrir le bordereau imprimable</button></div><table className="w-full text-xs"><thead className="text-left text-[10px] uppercase text-slate-500"><tr><th className="p-2">Poste</th><th className="p-2">Référence / quittance</th><th className="p-2 text-right">Montant</th></tr></thead><tbody>{ligne.lignesDetail!.map(d => <tr key={d.id} className="border-t border-slate-100"><td className="p-2 font-medium">{d.libelle}</td><td className="p-2 font-mono text-slate-500">{d.reference || '—'}</td><td className="p-2 text-right tabular-nums">{formatAr(d.montant)}</td></tr>)}</tbody><tfoot><tr className="border-t border-slate-200 font-semibold"><td colSpan={2} className="p-2">Total {ligne.sens === 'RECETTE' ? 'des recettes' : 'des dépenses'}</td><td className="p-2 text-right tabular-nums">{formatAr(ligne.montant)}</td></tr></tfoot></table></div></td></tr>}
              </React.Fragment>;
            })}
          </tbody>
          <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><td colSpan={4} className="px-4 py-3.5">{filtreActif ? 'Totaux de la sélection' : 'Totaux de la période'}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-emerald-700">{formatAr(recettes)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-rose-700">{formatAr(depenses)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums" title="Solde de clôture de la période complète, hors filtres">{formatAr(soldeFin)}</td><td className="no-print" /></tr></tfoot>
        </table>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500"><p>Le solde de clôture tient compte de toute la période, même lorsqu’elle est filtrée.</p>{pages > 1 && <div className="flex items-center gap-2"><button className="icon-button" disabled={pageActuelle === 1} aria-label="Page précédente" onClick={() => setPage(pageActuelle - 1)}><ChevronLeft size={16} /></button><span>Page {pageActuelle} / {pages}</span><button className="icon-button" disabled={pageActuelle === pages} aria-label="Page suivante" onClick={() => setPage(pageActuelle + 1)}><ChevronRight size={16} /></button></div>}</div>
      {pages > 1 && <p className="print-only px-4 py-2 text-xs">L’impression inclut toutes les pages de la sélection.</p>}
    </section>
    {bordereau && <>
      <ModaleBordereau
        ligne={bordereau}
        entete={entetes}
        onModifierEntete={onEnregistrerEntete ? () => ouvrirEntetes(bordereau.sens === 'RECETTE' ? 'recette' : 'depense') : undefined}
        onFermer={() => { setBordereau(null); setBordereauApresEnregistrement(false); }}
        imprimerDirectement={bordereauApresEnregistrement}
      />
    </>}
    {entetesOuverts && onEnregistrerEntete && <EnteteBordereauModal
      entetes={entetes}
      onEnregistrer={entete => { onEnregistrerEntete(documentEntete, entete); setEntetesOuverts(false); }}
      onFermer={() => setEntetesOuverts(false)}
    />}
  </>;
});
