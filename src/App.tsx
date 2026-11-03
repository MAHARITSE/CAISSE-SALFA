import React, { useEffect, useMemo, useState } from 'react';
import { Depense, MasqueDepense, Onglet } from './types';
import {
  chargerDepenses,
  chargerMasques,
  enregistrerDepenses,
  enregistrerMasques,
  prochainNumero,
} from './utils/storage';
import { SaisieDepense } from './components/SaisieDepense';
import { Journal } from './components/Journal';

export function App() {
  const [onglet, setOnglet] = useState<Onglet>('saisie');
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [masques, setMasques] = useState<MasqueDepense[]>([]);

  useEffect(() => {
    setDepenses(chargerDepenses());
    setMasques(chargerMasques());
  }, []);

  const numero = useMemo(() => prochainNumero(depenses), [depenses]);
  const totalDepenses = useMemo(() => depenses.reduce((s, d) => s + d.montant, 0), [depenses]);

  const ajouterDepense = (depense: Depense) => {
    const liste = [depense, ...depenses];
    setDepenses(liste);
    enregistrerDepenses(liste);
  };

  const ajouterMasque = (masque: MasqueDepense) => {
    const liste = [...masques, masque];
    setMasques(liste);
    enregistrerMasques(liste);
  };

  const supprimerMasque = (id: string) => {
    const liste = masques.filter(m => m.id !== id);
    setMasques(liste);
    enregistrerMasques(liste);
  };

  const onglets: { id: Onglet; label: string }[] = [
    { id: 'saisie', label: 'Saisie' },
    { id: 'journal', label: 'Journal' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">CAISSE SALFA</span>
            <span className="text-[11px] text-slate-400">dépenses</span>
          </div>
          <nav className="flex items-center gap-1">
            {onglets.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  onglet === o.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {o.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        {onglet === 'saisie' ? (
          <SaisieDepense
            numero={numero}
            masques={masques}
            onEnregistrer={ajouterDepense}
            onAjouterMasque={ajouterMasque}
            onSupprimerMasque={supprimerMasque}
          />
        ) : (
          <Journal depenses={depenses} />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-6 text-[11px] text-slate-400">
        Total des dépenses enregistrées : {totalDepenses.toLocaleString('fr-FR')} Ar
      </footer>
    </div>
  );
}

export default App;
