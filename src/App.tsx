import React, { useEffect, useMemo, useState } from 'react';
import { Ecriture, LigneJournal, Parametres, Sens } from './types';
import {
  chargerEcritures,
  chargerParametres,
  enregistrerEcritures,
  enregistrerParametres,
  prochainNumero,
} from './utils/storage';
import { libelleMois, moisCourant } from './utils/format';
import { exporterLivreCsv } from './utils/export';
import { SaisieEcriture } from './components/SaisieEcriture';
import { Synthese } from './components/Synthese';
import { LivreJournal } from './components/LivreJournal';

const parDate = (a: Ecriture, b: Ecriture) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

export function App() {
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [parametres, setParametres] = useState<Parametres>({ soldeInitial: 0 });
  const [mois, setMois] = useState(moisCourant());
  const [toutAfficher, setToutAfficher] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [enEdition, setEnEdition] = useState<Ecriture | null>(null);

  useEffect(() => {
    const liste = chargerEcritures();
    setEcritures(liste);
    setParametres(chargerParametres());
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

  const q = recherche.trim().toLowerCase();
  const lignes = useMemo(
    () =>
      q
        ? duMois.filter(e =>
            [e.libelle, e.categorie, e.numero, e.tiers, e.reference, e.mode]
              .filter(Boolean)
              .some(v => String(v).toLowerCase().includes(q)),
          )
        : duMois,
    [duMois, q],
  );

  const recettes = lignes.filter(e => e.sens === 'RECETTE').reduce((s, e) => s + e.montant, 0);
  const depenses = lignes.filter(e => e.sens === 'DEPENSE').reduce((s, e) => s + e.montant, 0);
  const soldeFin = lignes.length ? lignes[lignes.length - 1].solde : soldeOuverture;
  const periode = toutAfficher ? 'Toutes périodes' : libelleMois(mois);

  const suggestionsLibelle = useMemo(
    () => [...new Set(ecritures.map(e => e.libelle).filter(Boolean))].slice(-60),
    [ecritures],
  );
  const suggestionsTiers = useMemo(
    () => [...new Set(ecritures.map(e => e.tiers).filter((t): t is string => !!t))].slice(-60),
    [ecritures],
  );

  const enregistrer = (ecriture: Ecriture) => {
    const existe = ecritures.some(e => e.id === ecriture.id);
    sauvegarder(existe ? ecritures.map(e => (e.id === ecriture.id ? ecriture : e)) : [...ecritures, ecriture]);
    setEnEdition(null);
  };

  const supprimer = (id: string) => {
    const cible = ecritures.find(e => e.id === id);
    if (!cible) return;
    if (!window.confirm(`Supprimer l écriture ${cible.numero} — ${cible.libelle} ?`)) return;
    sauvegarder(ecritures.filter(e => e.id !== id));
    if (enEdition?.id === id) setEnEdition(null);
  };

  const changerSoldeInitial = (montant: number) => {
    const suivant = { ...parametres, soldeInitial: montant };
    setParametres(suivant);
    enregistrerParametres(suivant);
  };

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

        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3 no-print">
            <SaisieEcriture
              ecritureEnEdition={enEdition}
              numeroSuivant={(sens: Sens, date: string) => prochainNumero(ecritures, sens, date)}
              suggestionsLibelle={suggestionsLibelle}
              suggestionsTiers={suggestionsTiers}
              onEnregistrer={enregistrer}
              onAnnulerEdition={() => setEnEdition(null)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 no-print">
              <input
                type="month"
                value={mois}
                onChange={e => {
                  setMois(e.target.value || moisCourant());
                  setToutAfficher(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                aria-label="Mois affiché"
              />
              <button
                type="button"
                onClick={() => setToutAfficher(v => !v)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  toutAfficher
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Tout afficher
              </button>
              <input
                type="search"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Rechercher un libellé, un n°…"
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
              onEditer={setEnEdition}
              onSupprimer={supprimer}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
