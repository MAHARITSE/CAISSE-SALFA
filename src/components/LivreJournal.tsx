import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, FileText, Pencil, Printer, Trash2 } from 'lucide-react';
import type { Ecriture, LigneJournal } from '../types';
import { dateFr, formatAr, nombre } from '../utils/format';
import { Modale } from './Modale';

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
}
const PAR_PAGE = 50;

function BordereauDocument({ ligne }: { ligne: LigneJournal }) {
  const recette = ligne.sens === 'RECETTE';
  return <article className="bordereau-document bg-white text-slate-900">
    <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4"><div><p className="text-xl font-extrabold tracking-tight">SALFA</p><p className="text-xs">Service de trésorerie — Caisse de l’hôpital</p></div><div className="text-right"><h3 className="text-base font-bold uppercase">Bordereau de {recette ? 'recettes' : 'dépenses'}</h3><p className="mt-1 font-mono text-sm">{ligne.numero}</p></div></header>
    <div className="my-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3"><div><span className="label">Date de l’opération</span><p className="font-semibold">{dateFr(ligne.date)}</p></div><div><span className="label">Service / tiers</span><p className="font-semibold break-words">{ligne.tiers || 'Caisse principale'}</p></div><div><span className="label">Mode de paiement</span><p className="font-semibold">{ligne.mode || 'Non précisé'}</p></div></div>
    <p className="mb-3 text-sm font-semibold">{ligne.libelle}</p>
    {(ligne.reference || ligne.observation) && <div className="mb-4 space-y-1 text-xs"><p>{ligne.reference && <><strong>Référence : </strong>{ligne.reference}</>}</p><p className="whitespace-pre-wrap">{ligne.observation && <><strong>Observation : </strong>{ligne.observation}</>}</p></div>}
    <table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="border border-slate-400 p-2 w-10">N°</th><th className="border border-slate-400 p-2">Désignation / service</th><th className="border border-slate-400 p-2">Référence / quittance</th><th className="border border-slate-400 p-2 text-right">Montant (MGA)</th></tr></thead><tbody>{ligne.lignesDetail?.map((d, i) => <tr key={d.id}><td className="border border-slate-300 p-2 text-center">{i + 1}</td><td className="border border-slate-300 p-2 font-medium">{d.libelle}</td><td className="border border-slate-300 p-2 font-mono">{d.reference || '—'}</td><td className="border border-slate-300 p-2 text-right tabular-nums">{nombre(d.montant)}</td></tr>)}</tbody><tfoot><tr className="bg-slate-100 font-bold"><td colSpan={3} className="border border-slate-400 p-3 uppercase">Total {recette ? 'des recettes' : 'des dépenses'}</td><td className="border border-slate-400 p-3 text-right tabular-nums">{formatAr(ligne.montant)}</td></tr></tfoot></table>
    <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs"><div className="min-h-24 border border-dashed border-slate-400 p-3"><p className="font-semibold">Le caissier</p><p className="mt-1 text-slate-500">Signature & date</p></div><div className="min-h-24 border border-dashed border-slate-400 p-3"><p className="font-semibold">Le trésorier / responsable</p><p className="mt-1 text-slate-500">Visa & approbation</p></div></div>
    <p className="mt-5 text-[10px] text-slate-500">Document établi depuis le livre journal · {ligne.numero} · Montants en ariary (MGA)</p>
  </article>;
}

export function LivreJournal({ lignes, soldeOuverture, periode, recettes, depenses, soldeFin, filtreActif, enEditionId, onEditer, onSupprimer, onReinitialiser }: LivreJournalProps) {
  const [detailsOuverts, setDetailsOuverts] = useState<Record<string, boolean>>({});
  const [bordereau, setBordereau] = useState<LigneJournal | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [lignes]);
  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const pageActuelle = Math.min(page, pages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const fin = debut + PAR_PAGE;
  const horsPage = (i: number) => i < debut || i >= fin;

  return <>
    <section id="journal" className="card overflow-hidden" aria-label="Livre journal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><BookOpen size={18} className="text-brand-700" /><div><h2 className="text-sm font-bold">Livre journal</h2><p className="mt-0.5 text-[11px] text-slate-500">{periode} · {lignes.length} écriture{lignes.length > 1 ? 's' : ''}{filtreActif ? ' affichée(s) sur la sélection' : ''}</p></div></div><span className="badge badge-neutral">MGA · ariary</span></div>
      {filtreActif && <p className="border-b border-amber-100 bg-amber-50/70 px-5 py-2 text-[11px] text-amber-900">Vue filtrée : les totaux portent sur la sélection. Les soldes restent calculés sur le livre complet, dans l’ordre chronologique.</p>}
      <div className="relative overflow-x-auto">
        <table className="journal-table w-full min-w-[1060px] text-xs"><thead><tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">N° pièce</th><th className="px-3 py-3 font-semibold">Libellé & postes</th><th className="px-3 py-3 font-semibold">Catégorie</th><th className="px-3 py-3 font-semibold">Mode</th><th className="px-3 py-3 text-right font-semibold">Recette</th><th className="px-3 py-3 text-right font-semibold">Dépense</th><th className="px-3 py-3 text-right font-semibold">Solde cumulé</th><th className="no-print px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody><tr className="border-b border-slate-200 bg-slate-50/40"><td colSpan={7} className="px-4 py-3 font-medium text-slate-500">Report à nouveau {filtreActif ? '— période complète' : ''}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAr(soldeOuverture)}</td><td className="no-print" /></tr>
            {!lignes.length && <tr><td colSpan={9} className="px-5 py-16 text-center"><FileText size={32} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-slate-700">{filtreActif ? 'Aucune écriture ne correspond aux filtres' : 'Aucune écriture pour cette période'}</p><p className="mt-1 text-xs text-slate-500">{filtreActif ? 'Essayez une autre recherche ou réinitialisez les filtres.' : 'Ajoutez une recette ou une dépense pour commencer.'}</p>{filtreActif && <button className="btn-secondary mt-4" onClick={onReinitialiser}>Réinitialiser les filtres</button>}</td></tr>}
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
                  <td className="px-3 py-3.5 align-top text-[11px] text-slate-500">{ligne.mode || 'Non précisé'}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-emerald-700">{ligne.sens === 'RECETTE' ? formatAr(ligne.montant) : <span className="text-slate-300">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums text-rose-700">{ligne.sens === 'DEPENSE' ? formatAr(ligne.montant) : <span className="text-slate-300">—</span>}</td>
                  <td className={`whitespace-nowrap px-3 py-3.5 text-right align-top font-semibold tabular-nums ${ligne.solde < 0 ? 'text-rose-700' : 'text-slate-800'}`}>{formatAr(ligne.solde)}</td>
                  <td className="no-print px-2 py-3 align-top"><div className="flex justify-end gap-0.5 print:hidden">{aDetails && <button className="icon-button" title="Voir et imprimer le bordereau" aria-label={`Bordereau ${ligne.numero}`} onClick={() => setBordereau(ligne)}><Printer size={15} /></button>}<button className="icon-button" title="Modifier" aria-label={`Modifier ${ligne.numero}`} onClick={() => onEditer(ligne)}><Pencil size={15} /></button><button className="icon-button hover:bg-rose-50 hover:text-rose-600" title="Supprimer" aria-label={`Supprimer ${ligne.numero}`} onClick={() => onSupprimer(ligne.id)}><Trash2 size={15} /></button></div></td>
                </tr>
                {aDetails && ouvert && <tr id={detailId} className={`border-b border-slate-100 bg-brand-50/30 ${horsPage(index) ? 'screen-page-hidden' : ''}`}><td colSpan={9} className="px-5 py-4"><div className="rounded-lg border border-brand-100 bg-white p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Détail du bordereau · {ligne.numero}</p><button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setBordereau(ligne)}>Ouvrir le bordereau imprimable</button></div><table className="w-full text-xs"><thead className="text-left text-[10px] uppercase text-slate-500"><tr><th className="p-2">Poste</th><th className="p-2">Référence / quittance</th><th className="p-2 text-right">Montant</th></tr></thead><tbody>{ligne.lignesDetail!.map(d => <tr key={d.id} className="border-t border-slate-100"><td className="p-2 font-medium">{d.libelle}</td><td className="p-2 font-mono text-slate-500">{d.reference || '—'}</td><td className="p-2 text-right tabular-nums">{formatAr(d.montant)}</td></tr>)}</tbody><tfoot><tr className="border-t border-slate-200 font-semibold"><td colSpan={2} className="p-2">Total {ligne.sens === 'RECETTE' ? 'des recettes' : 'des dépenses'}</td><td className="p-2 text-right tabular-nums">{formatAr(ligne.montant)}</td></tr></tfoot></table></div></td></tr>}
              </React.Fragment>;
            })}
          </tbody>
          <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><td colSpan={5} className="px-4 py-3.5">{filtreActif ? 'Totaux de la sélection' : 'Totaux de la période'}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-emerald-700">{formatAr(recettes)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-rose-700">{formatAr(depenses)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums" title="Solde de clôture de la période complète, hors filtres">{formatAr(soldeFin)}</td><td className="no-print" /></tr></tfoot>
        </table>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500"><p>Le solde de clôture tient compte de toute la période, même lorsqu’elle est filtrée.</p>{pages > 1 && <div className="flex items-center gap-2"><button className="icon-button" disabled={pageActuelle === 1} aria-label="Page précédente" onClick={() => setPage(pageActuelle - 1)}><ChevronLeft size={16} /></button><span>Page {pageActuelle} / {pages}</span><button className="icon-button" disabled={pageActuelle === pages} aria-label="Page suivante" onClick={() => setPage(pageActuelle + 1)}><ChevronRight size={16} /></button></div>}</div>
      {pages > 1 && <p className="print-only px-4 py-2 text-xs">L’impression inclut toutes les pages de la sélection.</p>}
    </section>
    {bordereau && <>
      <Modale titre="Bordereau imprimable" sousTitre={`${bordereau.numero} · ${dateFr(bordereau.date)}`} largeur="large" icone={<Printer size={21} />} onFermer={() => setBordereau(null)} pied={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setBordereau(null)}>Fermer</button><button className="btn-primary" onClick={() => window.print()}><Printer size={16} />Imprimer ce bordereau</button></div>}><BordereauDocument ligne={bordereau} /></Modale>
      {createPortal(<div className="print-only print-bordereau"><BordereauDocument ligne={bordereau} /></div>, document.body)}
    </>}
  </>;
}
