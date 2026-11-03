import React, { useState } from 'react';
import { Ecriture, LigneJournal } from '../types';
import { dateFr, formatAr } from '../utils/format';

interface LivreJournalProps {
  lignes: LigneJournal[];
  soldeOuverture: number;
  periode: string;
  recettes: number;
  depenses: number;
  soldeFin: number;
  enEditionId: string | null;
  onEditer: (ecriture: Ecriture) => void;
  onSupprimer: (id: string) => void;
}

export const LivreJournal: React.FC<LivreJournalProps> = ({
  lignes,
  soldeOuverture,
  periode,
  recettes,
  depenses,
  soldeFin,
  enEditionId,
  onEditer,
  onSupprimer,
}) => {
  const [detailsOuverts, setDetailsOuverts] = useState<Record<string, boolean>>({});
  const [bordereauAffiche, setBordereauAffiche] = useState<LigneJournal | null>(null);

  const toggleDetails = (id: string) => {
    setDetailsOuverts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const imprimerBordereauUnique = () => {
    window.print();
  };

  return (
    <>
      <section id="journal" className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="print-only px-4 pt-4 pb-2">
          <p className="text-base font-bold">CAISSE SALFA — Livre journal des recettes et dépenses</p>
          <p className="text-xs">Période : {periode}</p>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Livre journal</h2>
            <p className="text-[11px] text-slate-500">
              Historique des mouvements de trésorerie avec détail des sous-lignes
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {periode} · {lignes.length} écriture(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">N°</th>
                <th className="px-3 py-2 font-medium">Libellé & Postes</th>
                <th className="px-3 py-2 font-medium">Catégorie</th>
                <th className="px-3 py-2 font-medium text-right">Recette</th>
                <th className="px-3 py-2 font-medium text-right">Dépense</th>
                <th className="px-3 py-2 font-medium text-right">Solde</th>
                <th className="px-3 py-2 no-print w-16" />
              </tr>
            </thead>

            <tbody>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <td className="px-3 py-2 text-xs text-slate-500" colSpan={4}>
                  Report à nouveau
                </td>
                <td className="px-3 py-2 text-right text-slate-300">—</td>
                <td className="px-3 py-2 text-right text-slate-300">—</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">
                  {formatAr(soldeOuverture)}
                </td>
                <td className="px-3 py-2 no-print" />
              </tr>

              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    Aucune écriture pour cette période.
                  </td>
                </tr>
              ) : (
                lignes.map(ligne => {
                  const aDetails = !!(ligne.lignesDetail && ligne.lignesDetail.length > 0);
                  const estOuvert = !!detailsOuverts[ligne.id];

                  return (
                    <React.Fragment key={ligne.id}>
                      <tr
                        className={`border-b border-slate-50 ${
                          enEditionId === ligne.id
                            ? 'bg-amber-50'
                            : estOuvert
                              ? 'bg-slate-50/50'
                              : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 align-top">
                          {dateFr(ligne.date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-500 align-top">
                          {ligne.numero}
                        </td>
                        <td className="px-3 py-2 text-slate-900 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{ligne.libelle}</span>
                            {aDetails && (
                              <button
                                type="button"
                                onClick={() => toggleDetails(ligne.id)}
                                className={`no-print inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                                  estOuvert
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                                title="Afficher / masquer les sous-lignes"
                              >
                                <span>📋 {ligne.lignesDetail!.length} postes</span>
                                <span>{estOuvert ? '▲' : '▼'}</span>
                              </button>
                            )}
                          </div>

                          {ligne.tiers || ligne.reference || ligne.observation ? (
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              {[ligne.tiers, ligne.reference, ligne.observation].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap align-top">
                          {ligne.categorie}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700 font-medium align-top">
                          {ligne.sens === 'RECETTE' ? formatAr(ligne.montant) : ''}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-rose-700 font-medium align-top">
                          {ligne.sens === 'DEPENSE' ? formatAr(ligne.montant) : ''}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-slate-900 align-top">
                          {formatAr(ligne.solde)}
                        </td>
                        <td className="px-2 py-2 no-print align-top">
                          <div className="flex items-center justify-end gap-1">
                            {aDetails && (
                              <button
                                type="button"
                                onClick={() => setBordereauAffiche(ligne)}
                                title="Voir & imprimer le bordereau officiel"
                                className="w-6 h-6 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 text-xs flex items-center justify-center"
                              >
                                🖨️
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditer(ligne)}
                              title="Modifier"
                              aria-label={`Modifier ${ligne.numero}`}
                              className="w-6 h-6 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 text-xs"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => onSupprimer(ligne.id)}
                              title="Supprimer"
                              aria-label={`Supprimer ${ligne.numero}`}
                              className="w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-base leading-none"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordéon détail sous-lignes */}
                      {aDetails && (estOuvert || false) && (
                        <tr className="bg-emerald-50/20 border-b border-emerald-100/60">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="rounded-md border border-emerald-200/80 bg-white p-3 shadow-xs">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    Bordereau de dépouillement : {ligne.libelle} ({ligne.numero})
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    Date : {dateFr(ligne.date)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setBordereauAffiche(ligne)}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                  <span>Afficher le bordereau imprimable</span>
                                </button>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-200 bg-slate-50">
                                      <th className="px-2.5 py-1.5 w-10 text-center">N°</th>
                                      <th className="px-2.5 py-1.5">Désignation / Service</th>
                                      <th className="px-2.5 py-1.5 w-36">N° Quittance / Réf</th>
                                      <th className="px-2.5 py-1.5 text-right w-36">Montant (MGA)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-sans">
                                    {ligne.lignesDetail!.map((sousLigne, sIdx) => (
                                      <tr key={sousLigne.id} className="hover:bg-slate-50/50">
                                        <td className="px-2.5 py-1.5 text-center text-slate-400 font-mono text-[11px]">
                                          {sIdx + 1}
                                        </td>
                                        <td className="px-2.5 py-1.5 font-medium text-slate-800 uppercase">
                                          {sousLigne.libelle}
                                        </td>
                                        <td className="px-2.5 py-1.5 font-mono text-[11px] text-rose-700 font-medium">
                                          {sousLigne.reference || '—'}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-medium text-slate-900 whitespace-nowrap">
                                          {formatAr(sousLigne.montant)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-emerald-50/60 font-bold border-t border-emerald-200">
                                      <td colSpan={3} className="px-2.5 py-2 text-[11px] uppercase tracking-wide text-emerald-950">
                                        TOTAL DES RECETTES
                                      </td>
                                      <td className="px-2.5 py-2 text-right text-emerald-900 text-xs whitespace-nowrap font-bold">
                                        {formatAr(ligne.montant)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            <tfoot>
              <tr className="bg-slate-100 border-t border-slate-200 font-medium">
                <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-slate-700">
                  Totaux de la période
                </td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-800 whitespace-nowrap">
                  {formatAr(recettes)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-rose-800 whitespace-nowrap">
                  {formatAr(depenses)}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                  {formatAr(soldeFin)}
                </td>
                <td className="px-3 py-2 no-print" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Modal / Vue imprimable du Bordereau détaillé comme sur le carnet papier */}
      {bordereauAffiche && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto no-print">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bordereau de dépouillement des recettes
                </h3>
                <p className="text-xs text-slate-500">
                  Trésorerie / Caisse de l Hôpital SALFA
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={imprimerBordereauUnique}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => setBordereauAffiche(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3.5 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">N° Pièce</span>
                <span className="font-mono font-semibold text-slate-900">{bordereauAffiche.numero}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">Date</span>
                <span className="font-medium text-slate-900">{dateFr(bordereauAffiche.date)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">Service / Tiers</span>
                <span className="font-medium text-slate-900">{bordereauAffiche.tiers || 'Caisse'}</span>
              </div>
            </div>

            {bordereauAffiche.observation && (
              <div className="mb-4 bg-amber-50/60 border border-amber-200/80 rounded-md p-2.5 text-xs text-slate-700">
                <span className="font-bold text-amber-900 uppercase text-[10px] block mb-0.5">Observation</span>
                <p>{bordereauAffiche.observation}</p>
              </div>
            )}

            {/* Tableau calqué sur le carnet physique */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold text-[11px] text-slate-700">
                    <th className="py-2 px-3 w-10 text-center border-r border-slate-300">N°</th>
                    <th className="py-2 px-3 border-r border-slate-300">DÉSIGNATION / SERVICE</th>
                    <th className="py-2 px-3 w-32 border-r border-slate-300">N° QUITTANCE</th>
                    <th className="py-2 px-3 w-36 text-right">MONTANT (MGA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bordereauAffiche.lignesDetail?.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold uppercase text-slate-800 border-r border-slate-200">
                        {item.libelle}
                      </td>
                      <td className="py-2 px-3 font-mono text-rose-700 font-semibold border-r border-slate-200">
                        {item.reference || ''}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {formatAr(item.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                    <td colSpan={3} className="py-2.5 px-3 uppercase text-[11px] tracking-wide border-r border-slate-300">
                      TOTAL DES RECETTES
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-bold text-slate-900">
                      {formatAr(bordereauAffiche.montant)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
              <div className="border border-dashed border-slate-300 rounded p-3 text-center min-h-[90px]">
                <p className="font-semibold text-slate-700">Le Caissier</p>
                <p className="text-[10px] text-slate-400 mt-1">Signature & date</p>
              </div>
              <div className="border border-dashed border-slate-300 rounded p-3 text-center min-h-[90px]">
                <p className="font-semibold text-slate-700">Le Trésorier / Chef d établissement</p>
                <p className="text-[10px] text-slate-400 mt-1">Visa & approbation</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
