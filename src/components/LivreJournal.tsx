import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import type { Categories, Ecriture, LigneJournal, Sens } from '../types';
import { dateFr, montantAffiche } from '../utils/format';
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
  peutModifier?: boolean;
  enEditionId: string | null;
  onEditer: (ecriture: Ecriture) => void;
  onSupprimer: (id: string) => void;
  onReinitialiser: () => void;
  /** En-têtes personnalisés des deux bordereaux ; vide = en-têtes livrés. */
  entetes?: EntetesDocuments;
  /** L'en-tête est commun : un seul enregistrement vaut pour les deux documents. */
  onEnregistrerEntete?: (entete: EnteteDocument) => void;
  /** Ouvre la saisie depuis l'état vide ; absent pour un rôle en lecture seule. */
  onNouvelleEcriture?: (sens: Sens) => void;
  /** Catégories de saisie, séparées pour les recettes et les dépenses. */
  categories?: Categories;
  onEnregistrerCategories?: (sens: Sens, liste: string[]) => Promise<boolean>;
}

/** Ce que l'application peut demander au journal depuis l'extérieur. */
export interface LivreJournalHandle {
  /** Ouvre le bordereau imprimable d'une pièce (après enregistrement). */
  ouvrirBordereau: (ligne: LigneJournal) => void;
}

type SortColumn = 'date' | 'numero' | 'libelle' | 'categorie' | 'recette' | 'depense' | 'solde';
type SortDirection = 'asc' | 'desc';

const PAR_PAGE = 50;

/**
 * `forwardRef` est nécessaire : l'application ouvre le bordereau d'une pièce
 * depuis l'extérieur, juste après son enregistrement.
 */
export const LivreJournal = forwardRef<LivreJournalHandle, LivreJournalProps>(function LivreJournal(
  { lignes, soldeOuverture, periode, recettes, depenses, soldeFin, filtreActif, peutModifier = true, enEditionId, onEditer, onSupprimer, onReinitialiser, entetes = entetesParDefaut(), onEnregistrerEntete, onNouvelleEcriture, categories, onEnregistrerCategories },
  ref,
) {
  /** Ligne active / sélectionnée dans le tableau */
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  /** Tri des colonnes */
  const [sortCol, setSortCol] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  /** Conserver l'historique de la liste précédente pour gérer l'ajout et la suppression */
  const prevLignesRef = useRef<LigneJournal[]>([]);

  /** L'en-tête courant */
  const enteteCourant = entetes ?? entetesParDefaut();
  const [numeroBordereau, setNumeroBordereau] = useState<string | null>(null);
  const bordereau = numeroBordereau ? lignes.find(l => l.numero === numeroBordereau) ?? null : null;
  const [bordereauApresEnregistrement, setBordereauApresEnregistrement] = useState(false);

  const ouvrirBordereau = (ligne: LigneJournal) => {
    setActiveId(ligne.id);
    setNumeroBordereau(ligne.numero);
  };

  useImperativeHandle(ref, () => ({
    ouvrirBordereau: (ligne: LigneJournal) => {
      setBordereauApresEnregistrement(true);
      setActiveId(ligne.id);
      setNumeroBordereau(ligne.numero);
    },
  }), []);

  const [entetesOuverts, setEntetesOuverts] = useState(false);
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false);
  const ouvrirEntetes = () => setEntetesOuverts(true);

  /** Tri des lignes */
  const changerTri = (col: SortColumn) => {
    if (sortCol === col) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const lignesTriees = useMemo(() => {
    if (!sortCol) return lignes;
    return [...lignes].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      switch (sortCol) {
        case 'date':
          valA = a.date;
          valB = b.date;
          break;
        case 'numero':
          valA = a.numero || '';
          valB = b.numero || '';
          break;
        case 'libelle':
          valA = a.libelle;
          valB = b.libelle;
          break;
        case 'categorie':
          valA = a.categorie;
          valB = b.categorie;
          break;
        case 'recette':
          valA = a.sens === 'RECETTE' ? a.montant : 0;
          valB = b.sens === 'RECETTE' ? b.montant : 0;
          break;
        case 'depense':
          valA = a.sens === 'DEPENSE' ? a.montant : 0;
          valB = b.sens === 'DEPENSE' ? b.montant : 0;
          break;
        case 'solde':
          valA = a.solde;
          valB = b.solde;
          break;
      }
      let comp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comp = valA - valB;
      } else {
        comp = String(valA).localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' });
      }
      return sortDir === 'asc' ? comp : -comp;
    });
  }, [lignes, sortCol, sortDir]);

  /** Suivi dynamique de la ligne active à l'ouverture, l'ajout et la suppression */
  useEffect(() => {
    const prevLignes = prevLignesRef.current;
    prevLignesRef.current = lignes;

    if (!lignes.length) {
      setActiveId(null);
      return;
    }

    // Cas 1 : Suppression -> Sélectionner la ligne suivante
    if (prevLignes.length > 0 && prevLignes.length > lignes.length) {
      setActiveId(actuelle => {
        if (actuelle && !lignes.some(l => l.id === actuelle)) {
          const idxSupprime = prevLignes.findIndex(p => p.id === actuelle);
          const suivante = (idxSupprime !== -1 ? lignes[idxSupprime] : null) || lignes[idxSupprime - 1] || lignes[lignes.length - 1];
          return suivante ? suivante.id : null;
        }
        return actuelle;
      });
      return;
    }

    // Cas 2 : Ajout d'une nouvelle écriture -> Sélectionner la nouvelle ligne
    if (lignes.length > prevLignes.length && prevLignes.length > 0) {
      const ajouts = lignes.filter(l => !prevLignes.some(p => p.id === l.id));
      if (ajouts.length > 0) {
        setActiveId(ajouts[ajouts.length - 1].id);
        return;
      }
    }

    // Cas 3 : Ouverture initiale -> Sélectionner la dernière ligne par défaut
    setActiveId(actuelle => {
      if (!actuelle || !lignes.some(l => l.id === actuelle)) {
        return lignes[lignes.length - 1]?.id ?? null;
      }
      return actuelle;
    });
  }, [lignes]);

  /** Pagination calculée et calée sur la ligne active */
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(lignesTriees.length / PAR_PAGE));

  useEffect(() => {
    if (!activeId || !lignesTriees.length) return;
    const index = lignesTriees.findIndex(l => l.id === activeId);
    if (index !== -1) {
      const pageCible = Math.floor(index / PAR_PAGE) + 1;
      setPage(pageCible);
    }
  }, [activeId, lignesTriees]);

  const pageActuelle = Math.min(page, pages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const fin = debut + PAR_PAGE;
  const horsPage = (i: number) => i < debut || i >= fin;

  /** Défilement vers la ligne active */
  useEffect(() => {
    if (activeId && activeRowRef.current && typeof activeRowRef.current.scrollIntoView === 'function') {
      activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeId, pageActuelle]);

  const gererSupprimer = (ligne: LigneJournal) => {
    const index = lignesTriees.findIndex(l => l.id === ligne.id);
    if (index !== -1) {
      const suivante = lignesTriees[index + 1] || lignesTriees[index - 1] || null;
      if (suivante) setActiveId(suivante.id);
    }
    onSupprimer(ligne.id);
  };

  function ThTriable({ col, label, align = 'left' }: { col: SortColumn; label: string; align?: 'left' | 'right' }) {
    const actif = sortCol === col;
    return (
      <th
        scope="col"
        aria-sort={actif ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1 transition-colors hover:text-brand-800 dark:hover:text-brand-300 ${actif ? 'font-bold text-brand-800 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}
          onClick={() => changerTri(col)}
          title={`Cliquer pour trier par ${label}`}
        >
          <span>{label}</span>
          {actif ? (
            sortDir === 'asc' ? <ArrowUp size={13} className="shrink-0 text-brand-700 dark:text-brand-400" /> : <ArrowDown size={13} className="shrink-0 text-brand-700 dark:text-brand-400" />
          ) : (
            <ArrowUpDown size={11} className="shrink-0 opacity-40 hover:opacity-100" />
          )}
        </button>
      </th>
    );
  }

  return <>
    <section id="journal" className="card overflow-hidden" aria-label="Livre journal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <BookOpen size={18} className="text-brand-700 dark:text-brand-400" />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Livre journal</h2>
              {sortCol && (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
                  onClick={() => { setSortCol(null); setSortDir('asc'); }}
                >
                  Réinitialiser le tri
                </button>
              )}
            </div>
            <p aria-live="polite" className="mt-0.5 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {periode} · {lignes.length} écriture{lignes.length > 1 ? 's' : ''}{filtreActif ? ' affichée(s) sur la sélection' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-neutral">MGA · ariary</span>
        </div>
      </div>
      {filtreActif && <p className="border-b border-amber-100 bg-amber-50/70 px-5 py-2 text-xs text-amber-900 sm:text-sm dark:border-amber-950/60 dark:bg-amber-950/40 dark:text-amber-200">Vue filtrée : les totaux portent sur la sélection. Les soldes restent calculés sur le livre complet, dans l’ordre chronologique.</p>}
      <div className="relative overflow-x-auto">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Montants en ariary</p>
        <table className="journal-table w-full min-w-[960px] text-sm">
          <caption className="sr-only">Écritures de la caisse, classées par date : pièce, libellé, catégorie, recette, dépense et solde cumulé.</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              <ThTriable col="date" label="Date" />
              <ThTriable col="numero" label="N° pièce" />
              <ThTriable col="libelle" label="Libellé" />
              <ThTriable col="categorie" label="Catégorie" />
              <ThTriable col="recette" label="Recette" align="right" />
              <ThTriable col="depense" label="Dépense" align="right" />
              <ThTriable col="solde" label="Solde cumulé" align="right" />
              <th scope="col" className="no-print sticky right-0 bg-slate-50 px-3 py-2 text-center font-semibold dark:bg-slate-800">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/40">
              <td colSpan={6} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">Report à nouveau {filtreActif ? '— période complète' : ''}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">{montantAffiche(soldeOuverture)}</td>
              <td className="no-print sticky right-0 bg-slate-50/95 dark:bg-slate-800/95" />
            </tr>
            {!lignesTriees.length && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <FileText size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                    {filtreActif ? 'Aucune écriture ne correspond aux filtres' : 'Aucune écriture pour cette période'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {filtreActif ? 'Essayez une autre recherche ou réinitialisez les filtres.' : 'Ajoutez une recette ou une dépense pour commencer.'}
                  </p>
                  {filtreActif
                    ? <button className="btn-secondary mt-3" onClick={onReinitialiser}>Réinitialiser les filtres</button>
                    : onNouvelleEcriture && <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button className="btn-primary" onClick={() => onNouvelleEcriture('RECETTE')}><Plus size={16} />Saisir une recette</button>
                      <button className="btn-danger" onClick={() => onNouvelleEcriture('DEPENSE')}><Plus size={16} />Saisir une dépense</button>
                    </div>}
                </td>
              </tr>
            )}
            {lignesTriees.map((ligne, index) => {
              const meta = [ligne.tiers, ligne.reference, ligne.observation].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
              const estActive = activeId === ligne.id;
              const estEdition = enEditionId === ligne.id;

              return (
                <tr
                  key={ligne.id}
                  ref={estActive ? activeRowRef : undefined}
                  onClick={() => setActiveId(ligne.id)}
                  className={`border-b transition-all duration-150 cursor-pointer ${
                    horsPage(index) ? 'screen-page-hidden' : ''
                  } ${
                    estActive
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-l-4 border-l-emerald-600 dark:border-l-emerald-400 font-medium shadow-xs'
                      : estEdition
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-500'
                      : 'border-l-4 border-l-transparent border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {estActive && <span className="size-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-xs" title="Ligne active" />}
                      <span className="tabular-nums text-slate-700 dark:text-slate-300">{dateFr(ligne.date)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle font-mono text-xs font-medium text-slate-600 dark:text-slate-400 sm:text-sm">{ligne.numero || 'Sans numéro'}</td>
                  <td className="max-w-80 px-3 py-2 align-middle">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate line-clamp-1">{ligne.libelle}</p>
                    {meta && <p className="text-xs text-slate-500 dark:text-slate-400 truncate line-clamp-1">{meta}</p>}
                  </td>
                  <td className="max-w-40 px-3 py-2 align-middle text-slate-700 dark:text-slate-300 truncate">{ligne.categorie}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {ligne.sens === 'RECETTE' ? montantAffiche(ligne.montant) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                    {ligne.sens === 'DEPENSE' ? montantAffiche(ligne.montant) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right align-middle font-semibold tabular-nums ${ligne.solde < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {montantAffiche(ligne.solde)}
                  </td>
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className={`no-print sticky right-0 px-2 py-1.5 align-middle ${
                      estActive ? 'bg-emerald-50/95 dark:bg-emerald-950' : estEdition ? 'bg-amber-50/95 dark:bg-amber-950' : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-center gap-0.5 print:hidden">
                      <button
                        type="button"
                        className="icon-button"
                        title="Imprimer le bordereau"
                        aria-label={`Imprimer le bordereau ${ligne.numero}`}
                        onClick={() => ouvrirBordereau(ligne)}
                      >
                        <Printer size={16} />
                      </button>
                      {peutModifier && <button
                        type="button"
                        className="icon-button"
                        title="Modifier"
                        aria-label={`Modifier ${ligne.numero}`}
                        onClick={() => {
                          setActiveId(ligne.id);
                          onEditer(ligne);
                        }}
                      >
                        <Pencil size={16} />
                      </button>}
                      {peutModifier && <button
                        type="button"
                        className="icon-button hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                        title="Supprimer"
                        aria-label={`Supprimer ${ligne.numero}`}
                        onClick={() => gererSupprimer(ligne)}
                      >
                        <Trash2 size={16} />
                      </button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100">
              <td colSpan={4} className="px-4 py-2.5">{filtreActif ? 'Totaux de la sélection' : 'Totaux de la période'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{montantAffiche(recettes)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-rose-700 dark:text-rose-400">{montantAffiche(depenses)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums" title="Solde en fin de période, calculé sur toute la période même filtrée">{montantAffiche(soldeFin)}</td>
              <td className="no-print sticky right-0 bg-slate-50 dark:bg-slate-800/80" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 sm:text-sm dark:border-slate-800 dark:text-slate-400">
        <p>Le solde de clôture tient compte de toute la période, même lorsqu’elle est filtrée.</p>
        {pages > 1 && (
          <nav className="flex items-center gap-2" aria-label="Pagination du journal">
            <button className="icon-button" disabled={pageActuelle === 1} aria-label="Page précédente" onClick={() => setPage(pageActuelle - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="tabular-nums">Page {pageActuelle} sur {pages}</span>
            <button className="icon-button" disabled={pageActuelle === pages} aria-label="Page suivante" onClick={() => setPage(pageActuelle + 1)}>
              <ChevronRight size={16} />
            </button>
          </nav>
        )}
      </div>
      {pages > 1 && <p className="print-only px-4 py-2 text-xs">L’impression inclut toutes les pages de la sélection.</p>}
    </section>
    {bordereau && (
      <ModaleBordereau
        ligne={bordereau}
        entete={enteteCourant}
        onModifierEntete={onEnregistrerEntete ? () => ouvrirEntetes() : undefined}
        onFermer={() => { setNumeroBordereau(null); setBordereauApresEnregistrement(false); }}
        imprimerDirectement={bordereauApresEnregistrement}
      />
    )}
    {categoriesOuvertes && categories && onEnregistrerCategories && (
      <GestionCategoriesModal
        categories={categories}
        onEnregistrer={onEnregistrerCategories}
        onFermer={() => setCategoriesOuvertes(false)}
      />
    )}
    {entetesOuverts && onEnregistrerEntete && (
      <EnteteBordereauModal
        entetes={entetes}
        onEnregistrer={entete => { onEnregistrerEntete(entete); setEntetesOuverts(false); }}
        onFermer={() => setEntetesOuverts(false)}
      />
    )}
  </>;
});
