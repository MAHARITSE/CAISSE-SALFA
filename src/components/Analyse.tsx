import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Info,
  Layers,
  ListFilter,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Ecriture, Sens } from '../types';
import { analyseCategories, totaliser } from '../utils/ledger';
import { dateFr, formatAr, libelleMois, montantAffiche, nombre } from '../utils/format';
import { Modale } from './Modale';
import { ApercuDepenses } from './ApercuDepenses';

/** Regroupe un libellé de sous-ligne en pôle / famille analytique pour l'analyse approfondie. */
function determinerPoleDetail(sens: Sens, libelleDetail: string, categorieParente: string): string {
  const t = libelleDetail.toUpperCase().trim();
  if (sens === 'RECETTE') {
    if (['MEDICAMENT', 'MÉDICAMENT', 'MEDIC', 'PHARMACIE', 'SERINGUE', 'OXYGENE', 'GANT', 'PRODUIT'].some(k => t.includes(k))) {
      return 'Pharmacie & Médicaments';
    }
    if (['BLOC', 'CHIRURGIE', 'OPERATION', 'OPÉRATION', 'ANESTHESIE'].some(k => t.includes(k))) {
      return 'Bloc opératoire & Chirurgie';
    }
    if (['ECHO', 'ÉCHO', 'RADIO', 'ECG', 'IMAGERIE'].some(k => t.includes(k))) {
      return 'Imagerie & Échographie';
    }
    if (['LABO', 'ANALYSE', 'TDR', 'ANAPATH'].some(k => t.includes(k))) {
      return 'Laboratoire & Analyses';
    }
    if (['HOSP', 'CHAMBRE', 'LOYER HOPITAL', 'LIT', 'EVASAN'].some(k => t.includes(k))) {
      return 'Hospitalisation & Chambres';
    }
    if (['DENTIST', 'EXTRACTION', 'PLOMBAGE', 'DETARTRAGE'].some(k => t.includes(k))) {
      return 'Dentisterie';
    }
    if (['MATERN', 'ACCOUCHEMENT', 'CPN', 'SAGE FEMME'].some(k => t.includes(k))) {
      return 'Maternité & Accouchements';
    }
    if (['CONSULTATION', 'OPHTALMO', 'VISITE', 'CERTIFICAT'].some(k => t.includes(k))) {
      return 'Consultations médicales';
    }
    if (['SOIN', 'PANSEMENT', 'VACCIN', 'INJECTION'].some(k => t.includes(k))) {
      return 'Soins infirmiers & Vaccins';
    }
    if (['REGLEMENT', 'RÈGLEMENT', 'REMBOURSEMENT', 'AVANCE', 'PRET', 'PRÊT', 'FACTURE'].some(k => t.includes(k))) {
      return 'Règlements & Remboursements';
    }
    return 'Autres prestations & patients';
  }

  // Côté DEPENSE : sous-familles analytiques détaillées
  if (['VERSEMENT', 'BNI', 'BFV', 'BOA', 'BANQUE', 'MVOLA', 'CHEQUE'].some(k => t.includes(k))) {
    return 'Versements bancaires & Trésorerie';
  }
  if (['QUINZAINE', 'QUIZAINE', 'AVANCE', 'PRET'].some(k => t.includes(k))) {
    return 'Avances & Quinzaines du personnel';
  }
  if (['SALAIRE', 'SOLDE DE TOUT COMPTE', '13EME'].some(k => t.includes(k))) {
    return 'Salaires mensuels';
  }
  if (['INDEMNITE', 'INDEMINITE', 'ONDEMNITE', 'GARDE', 'PRIME', 'CONGE', 'CNAPS', 'OSTIE', 'IRSA', 'SOCIAL', 'FAMANGIANA'].some(k => t.includes(k))) {
    return 'Indemnités, Gardes & Charges sociales';
  }
  if (['HONORAIRE', 'INTERIM', 'INTERMAIRE', 'VACATION', 'ORDRE', 'ANALYSE EXTERNE', 'ANAPATH'].some(k => t.includes(k))) {
    return 'Honoraires, Intérims & Sous-traitance médicale';
  }
  if (['MEDICAMENT', 'ARTESUNATE', 'SERUM', 'OXYGENE', 'VACCIN', 'PHARMACIE', 'CDM'].some(k => t.includes(k))) {
    return 'Médicaments, Sérums & Oxygène';
  }
  if (['PRODUIT BLOC', 'PRODUIT DENTAIRE', 'PRODUIT LABO', 'TDR', 'GANT', 'SERINGUE', 'REACTIF', 'CONSOMMABLE', 'CARNET', 'FICHE', 'EAU VIVE'].some(k => t.includes(k))) {
    return 'Consommables & Fournitures médicales';
  }
  if (['GASOIL', 'GAZOIL', 'ESSENCE', 'CARBURANT', 'LUBRIFIANT', 'HUILE'].some(k => t.includes(k))) {
    return 'Carburants & Lubrifiants (Groupe / Véhicules)';
  }
  if (['BAJAJ', 'TAXI', 'POSY', 'COLIS', 'TRANSPORT', 'DOCKER', 'COURSE', 'ENVOI'].some(k => t.includes(k))) {
    return 'Transport local, Bajaj & Expéditions colis';
  }
  if (['JIRAMA', 'ELECTRICITE', 'EAU', 'GAZ', 'VITOGAZ', 'CHARBON', 'AMPOULE', 'LED', 'NEON', 'PILE'].some(k => t.includes(k))) {
    return 'Eau, Électricité (JIRAMA), Gaz & Éclairage';
  }
  if (['STARLINK', 'INTERNET', 'CREDIT', 'TELMA', 'ORANGE', 'AIRTEL', 'YAS', 'CANAL', 'FLOTTE'].some(k => t.includes(k))) {
    return 'Télécommunications, Crédits & Internet (Starlink)';
  }
  if (['REMBOURSEMENT', 'RAMBOURSEMENT', 'REMBOURSSEMENT', 'RETOUR'].some(k => t.includes(k))) {
    return 'Remboursements patients & Rétrocessions';
  }
  if (['CONSTRUCTION', 'CIMENT', 'PARPAING', 'PEINTURE', 'PLOMBERIE', 'SOUDURE', 'BOIS', 'TOLE', 'TRAVAUX', 'REPARATION', 'MACON', 'MENUISIER'].some(k => t.includes(k))) {
    return 'Travaux, Bâtiment & Réparations';
  }
  return categorieParente || 'Autres charges d’exploitation';
}

interface SelectionAnalyse {
  sens: Sens;
  categorie: string | null;
}

function Repartition({
  lignes,
  sens,
  onOuvrirDetail,
}: {
  lignes: Ecriture[];
  sens: Sens;
  onOuvrirDetail: (sens: Sens, categorie: string | null) => void;
}) {
  const { total, categories } = analyseCategories(lignes, sens);
  const recette = sens === 'RECETTE';

  return (
    <section className="card p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOuvrirDetail(sens, null)}
          className="group flex items-center gap-2 text-left transition-colors hover:text-brand-700 dark:hover:text-brand-300"
          title={recette ? 'Ouvrir l’analyse approfondie des recettes' : 'Ouvrir l’aperçu des dépenses'}
        >
          {recette ? (
            <ArrowDownLeft size={20} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowUpRight size={20} className="text-rose-600 dark:text-rose-400" />
          )}
          <h3 className="text-base font-bold group-hover:underline">
            {recette ? 'Origine des recettes' : 'Répartition des dépenses'}
          </h3>
        </button>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{formatAr(total)}</span>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => onOuvrirDetail(sens, null)}
              aria-label={recette ? 'Analyse approfondie : Origine des recettes' : 'Aperçu : Répartition des dépenses'}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-600 dark:hover:bg-brand-950/60 dark:hover:text-brand-300"
            >
              <Eye size={13} />
              <span>Détails & aperçu</span>
            </button>
          )}
        </div>
      </div>

      {!categories.length ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Aucun mouvement sur cette période.
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map(c => (
            <div
              key={c.nom}
              role="button"
              tabIndex={0}
              onClick={() => onOuvrirDetail(sens, c.nom)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOuvrirDetail(sens, c.nom);
                }
              }}
              title={`Cliquez pour voir ${recette ? 'l’analyse et ' : ''}l’aperçu de « ${c.nom} »`}
              className="group -mx-2.5 cursor-pointer rounded-xl p-2.5 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800/60 dark:focus:bg-slate-800/60"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700 group-hover:text-brand-800 dark:text-slate-300 dark:group-hover:text-brand-300">
                  {c.nom}
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{c.nombre} pièce(s)</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatAr(c.montant)}{' '}
                  <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                    {c.part.toFixed(1).replace('.', ',')} %
                  </span>
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="img"
                aria-label={`${c.nom} : ${c.part.toFixed(1)} %`}
              >
                <div
                  className={`h-full rounded-full transition-all ${recette ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-rose-400 group-hover:bg-rose-500'}`}
                  style={{ width: `${c.part}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type ModeTriApercu = 'montant_desc' | 'montant_asc' | 'date_desc' | 'date_asc';

function ModaleAnalyseApprofondie({
  lignesPeriode,
  periode,
  selection,
  onChangerSelection,
  onFermer,
}: {
  lignesPeriode: Ecriture[];
  periode: string;
  selection: SelectionAnalyse;
  onChangerSelection: (suivante: SelectionAnalyse) => void;
  onFermer: () => void;
}) {
  const { sens, categorie } = selection;
  const recette = sens === 'RECETTE';
  const [poleFiltre, setPoleFiltre] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<ModeTriApercu>('montant_desc');
  const [depliees, setDepliees] = useState<Set<string>>(() => new Set());
  const [limiteApercu, setLimiteApercu] = useState(50);

  const totauxPeriode = useMemo(() => totaliser(lignesPeriode), [lignesPeriode]);
  const analyseGlobaleSens = useMemo(() => analyseCategories(lignesPeriode, sens), [lignesPeriode, sens]);

  // Écritures du sens et de la catégorie sélectionnée
  const ecrituresCibles = useMemo(() => {
    return lignesPeriode.filter(
      e => e.sens === sens && (categorie === null || e.categorie === categorie),
    );
  }, [lignesPeriode, sens, categorie]);

  // Calcul des indicateurs statistiques approfondis
  const stats = useMemo(() => {
    const nbPieces = ecrituresCibles.length;
    let total = 0;
    let nbSousLignes = 0;
    const montants: number[] = [];
    let pieceMax: Ecriture | null = null;
    let pieceMin: Ecriture | null = null;

    for (const e of ecrituresCibles) {
      total += e.montant;
      montants.push(e.montant);
      nbSousLignes += e.lignesDetail?.length || 1;
      if (!pieceMax || e.montant > pieceMax.montant) pieceMax = e;
      if (!pieceMin || e.montant < pieceMin.montant) pieceMin = e;
    }

    montants.sort((a, b) => a - b);
    const mediane =
      montants.length === 0
        ? 0
        : montants.length % 2 === 1
          ? montants[(montants.length - 1) / 2]
          : Math.round((montants[montants.length / 2 - 1] + montants[montants.length / 2]) / 2);

    const moyennePiece = nbPieces > 0 ? Math.round(total / nbPieces) : 0;
    const moyenneSousLigne = nbSousLignes > 0 ? Math.round(total / nbSousLignes) : 0;
    const partDuSens = analyseGlobaleSens.total > 0 ? (total / analyseGlobaleSens.total) * 100 : 0;

    return {
      total,
      nbPieces,
      nbSousLignes,
      moyennePiece,
      moyenneSousLigne,
      mediane,
      pieceMax,
      pieceMin,
      partDuSens,
    };
  }, [ecrituresCibles, analyseGlobaleSens.total]);

  // 1. Répartition approfondie par pôles / services (issue des sous-lignes lignesDetail)
  const repartitionPoles = useMemo(() => {
    const map = new Map<string, { nom: string; montant: number; nbLignes: number; idsPieces: Set<string> }>();
    for (const e of ecrituresCibles) {
      const details = e.lignesDetail?.length
        ? e.lignesDetail
        : [{ id: e.id, libelle: e.libelle, montant: e.montant }];
      for (const d of details) {
        const pole = determinerPoleDetail(sens, d.libelle, e.categorie);
        const existant = map.get(pole) ?? { nom: pole, montant: 0, nbLignes: 0, idsPieces: new Set<string>() };
        existant.montant += d.montant;
        existant.nbLignes += 1;
        existant.idsPieces.add(e.id);
        map.set(pole, existant);
      }
    }
    const base = stats.total > 0 ? stats.total : 1;
    return [...map.values()]
      .sort((a, b) => b.montant - a.montant)
      .map(p => ({
        nom: p.nom,
        montant: p.montant,
        nbLignes: p.nbLignes,
        nbPieces: p.idsPieces.size,
        part: Math.max(0, (p.montant / base) * 100),
      }));
  }, [ecrituresCibles, sens, stats.total]);

  // 2. Top 12 des sous-lignes / motifs exacts
  const topPostes = useMemo(() => {
    const map = new Map<string, { libelle: string; montant: number; occurrences: number }>();
    for (const e of ecrituresCibles) {
      const details = e.lignesDetail?.length
        ? e.lignesDetail
        : [{ id: e.id, libelle: e.libelle, montant: e.montant }];
      for (const d of details) {
        const cle = d.libelle.toUpperCase().trim();
        const existant = map.get(cle) ?? { libelle: cle, montant: 0, occurrences: 0 };
        existant.montant += d.montant;
        existant.occurrences += 1;
        map.set(cle, existant);
      }
    }
    const base = stats.total > 0 ? stats.total : 1;
    return [...map.values()]
      .filter(p => p.montant > 0)
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 12)
      .map(p => ({
        ...p,
        moyenne: Math.round(p.montant / p.occurrences),
        part: (p.montant / base) * 100,
      }));
  }, [ecrituresCibles, stats.total]);

  // 3. Répartition temporelle (par mois si plusieurs mois, sinon par jour)
  const repartitionTemporelle = useMemo(() => {
    const moisDistincts = new Set(ecrituresCibles.map(e => e.date.slice(0, 7)));
    const parMois = moisDistincts.size > 1;
    const map = new Map<string, { cle: string; etiquette: string; montant: number; nombre: number }>();

    for (const e of ecrituresCibles) {
      const cle = parMois ? e.date.slice(0, 7) : e.date;
      const etiquette = parMois ? libelleMois(cle) : dateFr(cle);
      const existant = map.get(cle) ?? { cle, etiquette, montant: 0, nombre: 0 };
      existant.montant += e.montant;
      existant.nombre += 1;
      map.set(cle, existant);
    }

    const base = stats.total > 0 ? stats.total : 1;
    const liste = [...map.values()].map(item => ({
      ...item,
      part: (item.montant / base) * 100,
    }));

    if (parMois) {
      liste.sort((a, b) => a.cle.localeCompare(b.cle));
    } else {
      liste.sort((a, b) => b.montant - a.montant);
    }

    return {
      parMois,
      nbJoursOuMoisActifs: liste.length,
      moyenneParPeriodeActive: liste.length > 0 ? Math.round(stats.total / liste.length) : 0,
      lignes: parMois ? liste : liste.slice(0, 10),
    };
  }, [ecrituresCibles, stats.total]);

  // 4. Répartition par tranches de montants
  const tranchesMontants = useMemo(() => {
    const defs = [
      { libelle: 'Moins de 50 000 Ar', min: 0, max: 49_999 },
      { libelle: '50 000 à 200 000 Ar', min: 50_000, max: 200_000 },
      { libelle: '200 000 à 1 000 000 Ar', min: 200_001, max: 1_000_000 },
      { libelle: 'Plus de 1 000 000 Ar', min: 1_000_001, max: Infinity },
    ];
    const base = stats.total > 0 ? stats.total : 1;
    return defs.map(t => {
      let nombrePieces = 0;
      let montantCumule = 0;
      for (const e of ecrituresCibles) {
        if (e.montant >= t.min && e.montant <= t.max) {
          nombrePieces += 1;
          montantCumule += e.montant;
        }
      }
      return {
        libelle: t.libelle,
        nombre: nombrePieces,
        montant: montantCumule,
        partMontant: (montantCumule / base) * 100,
        partNombre: stats.nbPieces > 0 ? (nombrePieces / stats.nbPieces) * 100 : 0,
      };
    });
  }, [ecrituresCibles, stats.total, stats.nbPieces]);

  // 5. Filtrage et tri pour l'aperçu des pièces
  const ecrituresApercu = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtrees = ecrituresCibles.filter(e => {
      if (poleFiltre) {
        const details = e.lignesDetail?.length
          ? e.lignesDetail
          : [{ id: e.id, libelle: e.libelle, montant: e.montant }];
        if (!details.some(d => determinerPoleDetail(sens, d.libelle, e.categorie) === poleFiltre)) {
          return false;
        }
      }
      if (!q) return true;
      const dansParent =
        e.numero.toLowerCase().includes(q) ||
        e.libelle.toLowerCase().includes(q) ||
        e.categorie.toLowerCase().includes(q) ||
        (e.tiers?.toLowerCase().includes(q) ?? false) ||
        (e.reference?.toLowerCase().includes(q) ?? false);
      if (dansParent) return true;
      return e.lignesDetail?.some(d => d.libelle.toLowerCase().includes(q)) ?? false;
    });

    return [...filtrees].sort((a, b) => {
      if (tri === 'montant_desc') return b.montant - a.montant;
      if (tri === 'montant_asc') return a.montant - b.montant;
      if (tri === 'date_desc') return b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero);
      return a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero);
    });
  }, [ecrituresCibles, poleFiltre, recherche, tri, sens]);

  const basculerPiece = (id: string) => {
    setDepliees(prev => {
      const copie = new Set(prev);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  };

  const toutDeplierOuReplier = () => {
    const visibles = ecrituresApercu.slice(0, limiteApercu);
    const toutesOuvertes = visibles.every(e => depliees.has(e.id));
    if (toutesOuvertes) {
      setDepliees(new Set());
    } else {
      setDepliees(new Set(visibles.map(e => e.id)));
    }
  };

  return (
    <Modale
      titre={recette ? 'Analyse approfondie des recettes' : 'Analyse approfondie des dépenses'}
      sousTitre={`${periode} · ${categorie ?? 'Toutes les catégories'}${poleFiltre ? ` · ${poleFiltre}` : ''}`}
      icone={
        recette ? (
          <ArrowDownLeft size={22} className="text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ArrowUpRight size={22} className="text-rose-600 dark:text-rose-400" />
        )
      }
      largeur="document"
      onFermer={onFermer}
      pied={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.nbPieces} pièce(s) · {stats.nbSousLignes} sous-ligne(s) · Total :{' '}
            <strong className="text-slate-800 dark:text-slate-200">{formatAr(stats.total)}</strong>
          </p>
          <button type="button" className="btn-secondary" onClick={onFermer}>
            Fermer l’aperçu
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 1. Bascule Dépenses / Recettes et filtre par catégorie */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setPoleFiltre(null);
                  setLimiteApercu(50);
                  onChangerSelection({ sens: 'DEPENSE', categorie: null });
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors sm:text-sm ${
                  !recette
                    ? 'bg-white text-rose-700 shadow-xs dark:bg-slate-800 dark:text-rose-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ArrowUpRight size={15} />
                Dépenses ({formatAr(totauxPeriode.depenses)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPoleFiltre(null);
                  setLimiteApercu(50);
                  onChangerSelection({ sens: 'RECETTE', categorie: null });
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors sm:text-sm ${
                  recette
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ArrowDownLeft size={15} />
                Recettes ({formatAr(totauxPeriode.recettes)})
              </button>
            </div>

            {(categorie !== null || poleFiltre !== null) && (
              <button
                type="button"
                onClick={() => {
                  setPoleFiltre(null);
                  onChangerSelection({ sens, categorie: null });
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                <X size={14} />
                Afficher toutes les catégories de {recette ? 'recettes' : 'dépenses'}
              </button>
            )}
          </div>

          {/* Pastilles des catégories */}
          <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Filtrer l’analyse par catégorie">
            <button
              type="button"
              onClick={() => {
                setPoleFiltre(null);
                setLimiteApercu(50);
                onChangerSelection({ sens, categorie: null });
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                categorie === null
                  ? recette
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-rose-600 bg-rose-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Toutes ({analyseGlobaleSens.categories.reduce((s, c) => s + c.nombre, 0)} pièces · 100 %)
            </button>
            {analyseGlobaleSens.categories.map(c => {
              const actif = categorie === c.nom;
              return (
                <button
                  key={c.nom}
                  type="button"
                  onClick={() => {
                    setPoleFiltre(null);
                    setLimiteApercu(50);
                    onChangerSelection({ sens, categorie: actif ? null : c.nom });
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    actif
                      ? recette
                        ? 'border-emerald-600 bg-emerald-600 font-semibold text-white'
                        : 'border-rose-600 bg-rose-600 font-semibold text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {c.nom}{' '}
                  <span className={actif ? 'opacity-90' : 'text-slate-400 dark:text-slate-500'}>
                    ({c.nombre} · {c.part.toFixed(1).replace('.', ',')} %)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Indicateurs statistiques approfondis (6 KPIs) */}
        <section aria-label="Indicateurs statistiques" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Montant cumulé
            </p>
            <p
              className={`mt-1.5 text-xl font-extrabold tabular-nums ${
                recette ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {formatAr(stats.total)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {stats.partDuSens.toFixed(1).replace('.', ',')} % du total des {recette ? 'recettes' : 'dépenses'} de la période
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Volume d’opérations
            </p>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {nombre(stats.nbPieces)} pièce(s)
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ventilées sur <strong>{nombre(stats.nbSousLignes)}</strong> sous-ligne(s) de détail
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Moyenne & Médiane
            </p>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {formatAr(stats.moyennePiece)}{' '}
              <span className="text-xs font-normal text-slate-400">/ pièce</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Médiane : <strong>{formatAr(stats.mediane)}</strong> · Moy./sous-ligne :{' '}
              <strong>{formatAr(stats.moyenneSousLigne)}</strong>
            </p>
          </div>

          {stats.pieceMax && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Opération la plus élevée (Max)
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatAr(stats.pieceMax.montant)}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={stats.pieceMax.libelle}>
                {dateFr(stats.pieceMax.date)} · {stats.pieceMax.numero} · {stats.pieceMax.libelle}
              </p>
            </div>
          )}

          {stats.pieceMin && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Opération la plus faible (Min)
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatAr(stats.pieceMin.montant)}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={stats.pieceMin.libelle}>
                {dateFr(stats.pieceMin.date)} · {stats.pieceMin.numero} · {stats.pieceMin.libelle}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Rythme d’activité
            </p>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatAr(repartitionTemporelle.moyenneParPeriodeActive)}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {repartitionTemporelle.parMois ? 'mois actif' : 'jour actif'}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sur {repartitionTemporelle.nbJoursOuMoisActifs}{' '}
              {repartitionTemporelle.parMois ? 'mois comptabilisé(s)' : 'journée(s) avec mouvement'}
            </p>
          </div>
        </section>

        {/* 3. Analyses approfondies des répartitions (Pôles détaillés + Top sous-lignes) */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 3A. Ventilation analytique des sous-lignes par pôle / service */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-brand-700 dark:text-brand-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Répartition approfondie par pôles & services (sous-lignes)
                </h3>
              </div>
              {poleFiltre && (
                <button
                  type="button"
                  onClick={() => setPoleFiltre(null)}
                  className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Analyse issue des <strong>{nombre(stats.nbSousLignes)} sous-lignes</strong> détaillées. Cliquez sur un pôle pour filtrer l’aperçu des pièces ci-dessous.
            </p>
            <div className="space-y-3">
              {repartitionPoles.map(p => {
                const actif = poleFiltre === p.nom;
                return (
                  <div
                    key={p.nom}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPoleFiltre(actif ? null : p.nom)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPoleFiltre(actif ? null : p.nom);
                      }
                    }}
                    className={`cursor-pointer rounded-lg p-2 transition-colors ${
                      actif
                        ? 'bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {p.nom}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({p.nbLignes} ligne{p.nbLignes > 1 ? 's' : ''})
                        </span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatAr(p.montant)}{' '}
                        <span className="ml-1 font-normal text-slate-400">
                          {p.part.toFixed(1).replace('.', ',')} %
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${recette ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, p.part)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3B. Top 12 des libellés exacts de sous-lignes */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-brand-700 dark:text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Principaux postes détaillés (Top {topPostes.length})
              </h3>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Postes de détail les plus importants en valeur cumulée, avec leur fréquence et leur montant moyen.
            </p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topPostes.map((p, idx) => (
                <div key={p.libelle} className="flex items-center justify-between gap-3 py-2 text-xs sm:text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={p.libelle}>
                      <span className="mr-1.5 inline-block w-5 font-mono text-xs text-slate-400">
                        #{idx + 1}
                      </span>
                      {p.libelle}
                    </p>
                    <p className="pl-6 text-[11px] text-slate-400 dark:text-slate-500">
                      {p.occurrences} occurrence(s) · Moy. {formatAr(p.moyenne)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{formatAr(p.montant)}</p>
                    <p className="text-[11px] text-slate-400">{p.part.toFixed(1).replace('.', ',')} %</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 4. Répartition temporelle & Répartition par tranches de montants */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 4A. Répartition temporelle */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Calendar size={18} className="text-brand-700 dark:text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {repartitionTemporelle.parMois
                  ? 'Évolution et répartition mensuelle'
                  : 'Journées les plus importantes de la période'}
              </h3>
            </div>
            <div className="space-y-2.5">
              {repartitionTemporelle.lignes.map(item => (
                <div key={item.cle}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                      {item.etiquette}{' '}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({item.nombre} pièce{item.nombre > 1 ? 's' : ''})
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatAr(item.montant)}{' '}
                      <span className="ml-1 font-normal text-slate-400">
                        {item.part.toFixed(1).replace('.', ',')} %
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${recette ? 'bg-emerald-500' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(100, item.part)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4B. Répartition par tranches de montants */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-700 dark:text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Structure par tranches de montants
              </h3>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Poids financier des petites, moyennes et grandes opérations sur la sélection.
            </p>
            <div className="space-y-3.5">
              {tranchesMontants.map(t => (
                <div key={t.libelle}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {t.libelle}{' '}
                      <span className="ml-1 text-xs text-slate-400">
                        ({t.nombre} pièce{t.nombre > 1 ? 's' : ''} · {t.partNombre.toFixed(0)} % des pièces)
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatAr(t.montant)}{' '}
                      <span className="ml-1 font-normal text-slate-400">
                        {t.partMontant.toFixed(1).replace('.', ',')} %
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-600 dark:bg-brand-500"
                      style={{ width: `${Math.min(100, t.partMontant)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 5. Aperçu détaillé des pièces et de leurs sous-lignes */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-brand-700 dark:text-brand-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Aperçu des {recette ? 'recettes' : 'dépenses'} ({ecrituresApercu.length} pièce(s))
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cliquez sur une écriture pour afficher ses sous-lignes de détail.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-52">
                <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="search"
                  value={recherche}
                  onChange={e => {
                    setRecherche(e.target.value);
                    setLimiteApercu(50);
                  }}
                  placeholder="Filtrer par libellé, n° pièce, sous-ligne…"
                  aria-label="Rechercher dans l’aperçu des pièces"
                  className="field !py-1.5 !pl-8 !text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                <ArrowUpDown size={14} className="text-slate-400" />
                <select
                  aria-label="Trier les pièces de l’aperçu"
                  value={tri}
                  onChange={e => setTri(e.target.value as ModeTriApercu)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="montant_desc">Montant décroissant</option>
                  <option value="montant_asc">Montant croissant</option>
                  <option value="date_desc">Date (plus récente)</option>
                  <option value="date_asc">Date (plus ancienne)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={toutDeplierOuReplier}
                className="btn-secondary !py-1.5 !text-xs"
              >
                <ListFilter size={13} />
                Sous-lignes
              </button>
            </div>
          </div>

          {ecrituresApercu.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucune pièce ne correspond à ce filtre.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ecrituresApercu.slice(0, limiteApercu).map(e => {
                const ouvert = depliees.has(e.id);
                const nbDetails = e.lignesDetail?.length ?? 0;
                const partPiece = stats.total > 0 ? (e.montant / stats.total) * 100 : 0;
                return (
                  <div key={e.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => basculerPiece(e.id)}
                      onKeyDown={evt => {
                        if (evt.key === 'Enter' || evt.key === ' ') {
                          evt.preventDefault();
                          basculerPiece(e.id);
                        }
                      }}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="text-slate-400">
                          {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {dateFr(e.date)}
                        </span>
                        <span className="badge badge-neutral shrink-0 font-mono text-[11px]">
                          {e.numero}
                        </span>
                        <span className="truncate font-semibold text-slate-800 dark:text-slate-200" title={e.libelle}>
                          {e.libelle}
                        </span>
                        <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 md:inline-block dark:bg-slate-800 dark:text-slate-300">
                          {e.categorie}
                        </span>
                        {nbDetails > 0 && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                            {nbDetails} sous-ligne{nbDetails > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span
                          className={`font-bold ${
                            recette ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {formatAr(e.montant)}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          ({partPiece.toFixed(1).replace('.', ',')} %)
                        </span>
                      </div>
                    </div>

                    {ouvert && e.lignesDetail && e.lignesDetail.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/90 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Montants en ariary</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                              <th className="pb-1.5 font-semibold">N°</th>
                              <th className="pb-1.5 font-semibold">Sous-ligne de détail</th>
                              <th className="pb-1.5 font-semibold">Pôle analytique</th>
                              <th className="pb-1.5 text-right font-semibold">Montant</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                            {e.lignesDetail.map((d, idx) => (
                              <tr key={d.id}>
                                <td className="py-1.5 pr-2 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-1.5 font-medium text-slate-700 dark:text-slate-200">{d.libelle}</td>
                                <td className="py-1.5 text-slate-500 dark:text-slate-400">
                                  {determinerPoleDetail(sens, d.libelle, e.categorie)}
                                </td>
                                <td
                                  className={`py-1.5 text-right font-semibold tabular-nums ${
                                    d.montant < 0
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {montantAffiche(d.montant)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {ecrituresApercu.length > limiteApercu && (
                <div className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => setLimiteApercu(n => n + 100)}
                    className="btn-secondary !py-1.5 !text-xs"
                  >
                    Afficher 100 pièces supplémentaires ({ecrituresApercu.length - limiteApercu} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Modale>
  );
}

export function Analyse({ lignes, periode, categoriesDepense = [], onModifierCategorieDepense, raisonLectureSeule }: {
  lignes: Ecriture[];
  periode: string;
  categoriesDepense?: string[];
  onModifierCategorieDepense?: (id: string, categorie: string) => Promise<boolean>;
  raisonLectureSeule?: string;
}) {
  const { recettes, depenses } = totaliser(lignes);
  const ratio = recettes > 0 ? (depenses / recettes) * 100 : null;
  const [selection, setSelection] = useState<SelectionAnalyse | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-lg border border-brand-100 bg-brand-50/60 p-3.5 text-sm leading-relaxed text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/50 dark:text-brand-200">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          Analyse de la période complète : <strong>{periode}</strong>. Cliquez sur <strong>Répartition des dépenses</strong>, sur <strong>Origine des recettes</strong> ou sur une catégorie pour ouvrir l’aperçu des pièces. Les recettes disposent aussi d’une analyse approfondie.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Repartition
          lignes={lignes}
          sens="DEPENSE"
          onOuvrirDetail={(sens, categorie) => setSelection({ sens, categorie })}
        />
        <Repartition
          lignes={lignes}
          sens="RECETTE"
          onOuvrirDetail={(sens, categorie) => setSelection({ sens, categorie })}
        />
      </div>
      <div className="card flex items-center gap-4 p-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
          <ChartNoAxesCombined size={24} />
        </div>
        <div>
          <h3 className="text-base font-semibold">Dépenses / recettes</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {ratio === null
              ? 'Aucune recette sur cette période : le ratio ne peut pas être calculé.'
              : `Les dépenses représentent ${nombre(Math.round(ratio))} % des recettes encaissées sur la période. Ce ratio ne tient pas compte du solde d’ouverture.`}
          </p>
        </div>
      </div>

      {selection?.sens === 'DEPENSE' && (
        <ApercuDepenses
          lignes={lignes}
          periode={periode}
          categorie={selection.categorie}
          categories={categoriesDepense}
          onToutesCategories={() => setSelection({ sens: 'DEPENSE', categorie: null })}
          onModifierCategorie={onModifierCategorieDepense}
          raisonLectureSeule={raisonLectureSeule}
          onFermer={() => setSelection(null)}
        />
      )}
      {selection?.sens === 'RECETTE' && (
        <ModaleAnalyseApprofondie
          lignesPeriode={lignes}
          periode={periode}
          selection={selection}
          onChangerSelection={setSelection}
          onFermer={() => setSelection(null)}
        />
      )}
    </div>
  );
}
