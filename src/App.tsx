import React, { useEffect, useMemo, useState } from 'react';
import { BordereauRecette, Ecriture, LigneJournal, Parametres } from './types';
import {
  chargerEcritures,
  chargerParametres,
  enregistrerEcritures,
  enregistrerParametres,
  prochainNumero,
} from './utils/storage';
import { libelleMois, moisCourant } from './utils/format';
import { exporterLivreCsv } from './utils/export';
import { RecetteCaisse } from './components/RecetteCaisse';
import { SaisieDepense } from './components/SaisieDepense';
import { EditionEcriture } from './components/EditionEcriture';
import { Synthese } from './components/Synthese';
import { LivreJournal } from './components/LivreJournal';

type Vue = 'saisie' | 'journal';
type TypeSaisie = 'RECETTE' | 'DEPENSE';

const parDate = (a: Ecriture, b: Ecriture) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

export function App() {
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [parametres, setParametres] = useState<Parametres>({ soldeInitial: 0 });
  const [vue, setVue] = useState<Vue>('saisie');
  const [typeSaisie, setTypeSaisie] = useState<TypeSaisie>('RECETTE');
  const [mois, setMois] = useState(moisCourant());
  const [toutAfficher, setToutAfficher] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [enEdition, setEnEdition] = useState<Ecriture | null>(null);

  useEffect(() => {
    const liste = chargerEcritures();
    setEcritures(liste);
    setParametres(chargerParametres());
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
            [e.libelle, e.categorie, e.numero, e.tiers, e.reference, e.observation, e.mode]
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

  /** Le bordereau papier devient une écriture de recette par ligne renseignée. */
  const enregistrerBordereau = (bordereau: BordereauRecette) => {
    let liste = [...ecritures];
    const maintenant = new Date().toISOString();

    bordereau.lignes
      .filter(ligne => ligne.montant > 0)
      .forEach((ligne, index) => {
        liste = [
          ...liste,
          {
            id: `e-${Date.now()}-${index}`,
            numero: prochainNumero(liste, 'RECETTE', bordereau.date),
            date: bordereau.date,
            sens: 'RECETTE',
            libelle: ligne.categorie,
            categorie: ligne.categorie,
            tiers: bordereau.pourCompteDe || undefined,
            montant: ligne.montant,
            mode: 'Espèces',
            reference: ligne.reference || undefined,
            observation: ligne.observation || undefined,
            createdAt: maintenant,
          },
        ];
      });

    sauvegarder(liste);
    setVue('journal');
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">CAISSE SALFA — Livre journal</h1>
            <p className="text-[11px] text-slate-500">Trésorerie de l hôpital : recettes et dépenses</p>
          </div>

          <nav className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {(
              [
                ['saisie', 'Saisie'],
                ['journal', 'Journal'],
              ] as [Vue, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVue(id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold ${
                  vue === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

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

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="no-print">
          <Synthese
            soldeInitial={parametres.soldeInitial}
            onSoldeInitial={changerSoldeInitial}
            recettes={recettes}
            depenses={depenses}
            soldeFin={soldeFin}
            periode={periode}
          />
        </div>

        {vue === 'saisie' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1 no-print">
              {(
                [
                  ['RECETTE', 'Recette de caisse'],
                  ['DEPENSE', 'Dépense'],
                ] as [TypeSaisie, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTypeSaisie(id)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${
                    typeSaisie === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {typeSaisie === 'RECETTE' ? (
              <RecetteCaisse onEnregistrer={enregistrerBordereau} />
            ) : (
              <SaisieDepense
                numeroSuivant={(date: string) => prochainNumero(ecritures, 'DEPENSE', date)}
                suggestionsLibelle={suggestionsLibelle}
                suggestionsTiers={suggestionsTiers}
                onEnregistrer={enregistrer}
              />
            )}
          </div>
        ) : (
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

            {enEdition ? (
              <EditionEcriture
                key={enEdition.id}
                ecriture={enEdition}
                onEnregistrer={enregistrer}
                onAnnuler={() => setEnEdition(null)}
              />
            ) : null}

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
        )}
      </main>
    </div>
  );
}

export default App;
