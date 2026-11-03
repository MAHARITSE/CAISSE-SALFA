import React, { useEffect, useMemo, useState } from 'react';
import { Ecriture, LigneJournal, MasqueSaisie, Parametres, Sens } from './types';
import {
  chargerEcritures,
  chargerMasques,
  chargerParametres,
  enregistrerEcritures,
  enregistrerMasques,
  enregistrerParametres,
  prochainNumero,
} from './utils/storage';
import { libelleMois, moisCourant, formatAr } from './utils/format';
import { exporterLivreCsv } from './utils/export';
import { SaisieEcriture } from './components/SaisieEcriture';
import { Synthese } from './components/Synthese';
import { LivreJournal } from './components/LivreJournal';
import { GestionMasquesModal } from './components/GestionMasquesModal';
import { AlertTriangle, Layers, Plus, Trash2 } from 'lucide-react';

const parDate = (a: Ecriture, b: Ecriture) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

export function App() {
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [parametres, setParametres] = useState<Parametres>({ soldeInitial: 0 });
  const [masques, setMasques] = useState<MasqueSaisie[]>([]);
  const [modalMasquesOuverte, setModalMasquesOuverte] = useState(false);
  const [mois, setMois] = useState(moisCourant());
  const [toutAfficher, setToutAfficher] = useState(false);
  const [filtreSens, setFiltreSens] = useState<'TOUS' | 'RECETTE' | 'DEPENSE'>('TOUS');
  const [recherche, setRecherche] = useState('');
  const [enEdition, setEnEdition] = useState<Ecriture | null>(null);
  const [modalSaisieOuverte, setModalSaisieOuverte] = useState(false);
  const [sensSaisie, setSensSaisie] = useState<Sens>('RECETTE');
  const [ecritureASupprimer, setEcritureASupprimer] = useState<Ecriture | null>(null);

  useEffect(() => {
    const liste = chargerEcritures();
    setEcritures(liste);
    setParametres(chargerParametres());
    setMasques(chargerMasques());
    // Au premier affichage, ouvrir le mois de la dernière écriture
    // plutôt qu'un mois vide.
    if (liste.length > 0 && !liste.some(e => e.date.startsWith(moisCourant()))) {
      setMois(liste[liste.length - 1].date.slice(0, 7));
    }
  }, []);

  const sauvegarder = (liste: Ecriture[]) => {
    setEcritures(liste);
    enregistrerEcritures(liste);
  };

  /** Livre complet avec solde cumulé, toutes périodes confondues. */
  const avecSolde = useMemo<LigneJournal[]>(() => {
    let solde = parametres.soldeInitial;
    return [...ecritures].sort(parDate).map(e => {
      solde += e.sens === 'RECETTE' ? e.montant : -e.montant;
      return { ...e, solde };
    });
  }, [ecritures, parametres.soldeInitial]);

  const duMois = useMemo(
    () => (toutAfficher ? avecSolde : avecSolde.filter(e => e.date.startsWith(mois))),
    [avecSolde, mois, toutAfficher],
  );

  const soldeOuverture = useMemo(() => {
    if (toutAfficher) return parametres.soldeInitial;
    const precedentes = avecSolde.filter(e => e.date < `${mois}-01`);
    return precedentes.length ? precedentes[precedentes.length - 1].solde : parametres.soldeInitial;
  }, [avecSolde, mois, toutAfficher, parametres.soldeInitial]);

  const duMoisFiltre = useMemo(
    () => (filtreSens === 'TOUS' ? duMois : duMois.filter(e => e.sens === filtreSens)),
    [duMois, filtreSens],
  );

  const q = recherche.trim().toLowerCase();
  const lignes = useMemo(
    () =>
      q
        ? duMoisFiltre.filter(e => {
            const champsPrincipaux = [e.libelle, e.categorie, e.numero, e.tiers, e.reference, e.observation];
            const champsDetails = e.lignesDetail
              ? e.lignesDetail.flatMap(d => [d.libelle, d.reference])
              : [];
            return [...champsPrincipaux, ...champsDetails]
              .filter(Boolean)
              .some(v => String(v).toLowerCase().includes(q));
          })
        : duMoisFiltre,
    [duMoisFiltre, q],
  );

  const recettes = duMois.filter(e => e.sens === 'RECETTE').reduce((s, e) => s + e.montant, 0);
  const depenses = duMois.filter(e => e.sens === 'DEPENSE').reduce((s, e) => s + e.montant, 0);
  const soldeFin = duMois.length ? duMois[duMois.length - 1].solde : soldeOuverture;
  const periode = toutAfficher ? 'Toutes périodes' : libelleMois(mois);

  const suggestionsLibelle = useMemo(
    () => [...new Set(ecritures.map(e => e.libelle).filter(Boolean))].slice(-60),
    [ecritures],
  );
  const suggestionsTiers = useMemo(
    () => [...new Set(ecritures.map(e => e.tiers).filter((t): t is string => !!t))].slice(-60),
    [ecritures],
  );

  const ouvrirNouvelleEcriture = (sens: Sens) => {
    setEnEdition(null);
    setSensSaisie(sens);
    setModalSaisieOuverte(true);
  };

  const ouvrirEdition = (ecriture: Ecriture) => {
    setEnEdition(ecriture);
    setSensSaisie(ecriture.sens);
    setModalSaisieOuverte(true);
  };

  const fermerModalSaisie = () => {
    setModalSaisieOuverte(false);
    setEnEdition(null);
  };

  const enregistrer = (ecriture: Ecriture) => {
    const existe = ecritures.some(e => e.id === ecriture.id);
    sauvegarder(existe ? ecritures.map(e => (e.id === ecriture.id ? ecriture : e)) : [...ecritures, ecriture]);
    setEnEdition(null);
    setModalSaisieOuverte(false);
  };

  const supprimer = (id: string) => {
    const cible = ecritures.find(e => e.id === id);
    if (!cible) return;
    setEcritureASupprimer(cible);
  };

  const confirmerSuppression = () => {
    if (!ecritureASupprimer) return;
    sauvegarder(ecritures.filter(e => e.id !== ecritureASupprimer.id));
    if (enEdition?.id === ecritureASupprimer.id) setEnEdition(null);
    setEcritureASupprimer(null);
  };

  const changerSoldeInitial = (montant: number) => {
    const suivant = { ...parametres, soldeInitial: montant };
    setParametres(suivant);
    enregistrerParametres(suivant);
  };

  const sauvegarderMasques = (liste: MasqueSaisie[]) => {
    setMasques(liste);
    enregistrerMasques(liste);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ecritureASupprimer) {
          setEcritureASupprimer(null);
        } else if (modalSaisieOuverte) {
          fermerModalSaisie();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ecritureASupprimer, modalSaisieOuverte]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">CAISSE SALFA — Livre journal</h1>
            <p className="text-[11px] text-slate-500">Trésorerie de l hôpital : recettes et dépenses</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exporterLivreCsv(lignes, { periode, soldeOuverture, recettes, depenses, soldeFin })
              }
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Exporter Excel (CSV)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Imprimer
            </button>
          </div>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-5 sm:px-6">
        <Synthese
          soldeInitial={parametres.soldeInitial}
          onSoldeInitial={changerSoldeInitial}
          recettes={recettes}
          depenses={depenses}
          soldeFin={soldeFin}
          periode={periode}
        />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 no-print bg-white p-2.5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={mois}
                onChange={e => {
                  setMois(e.target.value || moisCourant());
                  setToutAfficher(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium"
                aria-label="Mois affiché"
              />
              <button
                type="button"
                onClick={() => setToutAfficher(v => !v)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                  toutAfficher
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Tout afficher
              </button>
            </div>

            {/* Boutons d'action Recette / Dépense avec ouverture modale */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ouvrirNouvelleEcriture('RECETTE')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                title="Créer une nouvelle recette (ouverture modale)"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Recette</span>
              </button>
              <button
                type="button"
                onClick={() => ouvrirNouvelleEcriture('DEPENSE')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                title="Créer une nouvelle dépense (ouverture modale)"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Dépense</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMasquesOuverte(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition cursor-pointer"
                title="Gérer les masques de saisie (consulter, créer, modifier ou supprimer)"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Masques de saisie</span>
              </button>
            </div>

            {/* Filtre type de mouvement */}
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFiltreSens('TOUS')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  filtreSens === 'TOUS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFiltreSens('RECETTE')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  filtreSens === 'RECETTE' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                Recettes
              </button>
              <button
                type="button"
                onClick={() => setFiltreSens('DEPENSE')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  filtreSens === 'DEPENSE' ? 'bg-rose-700 text-white shadow-xs' : 'text-rose-800 hover:text-rose-950'
                }`}
              >
                Dépenses
              </button>
            </div>

            <input
              type="search"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher un libellé, poste, n°…"
              className="ml-auto w-full sm:w-64 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              aria-label="Recherche"
            />
          </div>

          <LivreJournal
            lignes={lignes}
            soldeOuverture={soldeOuverture}
            periode={periode}
            recettes={recettes}
            depenses={depenses}
            soldeFin={soldeFin}
            enEditionId={enEdition?.id ?? null}
            onEditer={ouvrirEdition}
            onSupprimer={supprimer}
          />
        </div>

        {/* Modal de saisie / modification d'écriture */}
        {modalSaisieOuverte && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto no-print animate-in fade-in duration-150">
            <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <SaisieEcriture
                ecritureEnEdition={enEdition}
                sensInitial={sensSaisie}
                numeroSuivant={(sens: Sens, date: string) => prochainNumero(ecritures, sens, date)}
                suggestionsLibelle={suggestionsLibelle}
                suggestionsTiers={suggestionsTiers}
                masques={masques}
                onOuvrirGestionMasques={() => setModalMasquesOuverte(true)}
                onEnregistrer={enregistrer}
                onAnnulerEdition={fermerModalSaisie}
                onFermer={fermerModalSaisie}
              />
            </div>
          </div>
        )}

        {/* Modal de gestion des masques de saisie */}
        {modalMasquesOuverte && (
          <GestionMasquesModal
            masques={masques}
            onSauvegarderMasques={sauvegarderMasques}
            onFermer={() => setModalMasquesOuverte(false)}
          />
        )}

        {/* Modal de confirmation de suppression modernisé */}
        {ecritureASupprimer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 no-print animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/90 ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Confirmer la suppression</h3>
                  <p className="text-xs text-slate-500">Cette action retirera définitivement l'écriture de la caisse</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 mb-5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Numéro</span>
                  <span className="font-mono font-semibold text-slate-800">{ecritureASupprimer.numero}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium text-slate-800">{ecritureASupprimer.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Libellé</span>
                  <span className="font-semibold text-slate-900 uppercase truncate max-w-[200px]">
                    {ecritureASupprimer.libelle}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Montant total</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      ecritureASupprimer.sens === 'RECETTE' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatAr(ecritureASupprimer.montant)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEcritureASupprimer(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmerSuppression}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer définitivement</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
