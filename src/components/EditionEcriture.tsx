import React, { useState } from 'react';
import { Ecriture, Mode } from '../types';
import { CATEGORIES_DEPENSE, CATEGORIES_RECETTE, MODES } from '../utils/storage';
import { formatAr } from '../utils/format';

interface EditionEcritureProps {
  ecriture: Ecriture;
  onEnregistrer: (ecriture: Ecriture) => void;
  onAnnuler: () => void;
}

const champ =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';
const etiquette = 'block text-[11px] font-medium text-slate-500 mb-1';

/** Correction d'une écriture du livre (recette ou dépense). */
export const EditionEcriture: React.FC<EditionEcritureProps> = ({ ecriture, onEnregistrer, onAnnuler }) => {
  const [form, setForm] = useState({
    date: ecriture.date,
    libelle: ecriture.libelle,
    categorie: ecriture.categorie,
    tiers: ecriture.tiers ?? '',
    montant: String(ecriture.montant),
    mode: ecriture.mode,
    reference: ecriture.reference ?? '',
    observation: ecriture.observation ?? '',
  });
  const [erreur, setErreur] = useState('');

  const categories = [...new Set([
    ...(ecriture.sens === 'RECETTE' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE),
    ecriture.categorie,
  ])];

  const maj = (cle: keyof typeof form, valeur: string) => {
    setForm(f => ({ ...f, [cle]: valeur }));
    setErreur('');
  };

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(form.montant) || 0;
    if (!form.libelle.trim() || montant <= 0) {
      setErreur('Le libellé et un montant supérieur à 0 sont obligatoires.');
      return;
    }
    onEnregistrer({
      ...ecriture,
      date: form.date,
      libelle: form.libelle.trim(),
      categorie: form.categorie,
      tiers: form.tiers.trim() || undefined,
      montant,
      mode: form.mode as Mode,
      reference: form.reference.trim() || undefined,
      observation: form.observation.trim() || undefined,
    });
  };

  return (
    <form onSubmit={enregistrer} className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
          Modifier {ecriture.numero} — {ecriture.sens === 'RECETTE' ? 'recette' : 'dépense'}
        </h3>
        <span className="text-[11px] text-slate-500">{formatAr(Number(form.montant) || 0)}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={etiquette}>Date</span>
          <input type="date" className={champ} value={form.date} onChange={e => maj('date', e.target.value)} required />
        </label>
        <label>
          <span className={etiquette}>Montant (MGA)</span>
          <input
            type="number"
            min={1}
            step={100}
            className={champ}
            value={form.montant}
            onChange={e => maj('montant', e.target.value)}
            required
          />
        </label>
        <label className="sm:col-span-2">
          <span className={etiquette}>Libellé</span>
          <input
            type="text"
            className={champ}
            value={form.libelle}
            onChange={e => maj('libelle', e.target.value)}
            required
          />
        </label>
        <label>
          <span className={etiquette}>Catégorie</span>
          <select className={champ} value={form.categorie} onChange={e => maj('categorie', e.target.value)}>
            {categories.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiquette}>Tiers / P/c de</span>
          <input type="text" className={champ} value={form.tiers} onChange={e => maj('tiers', e.target.value)} />
        </label>
        <label>
          <span className={etiquette}>Mode</span>
          <select className={champ} value={form.mode} onChange={e => maj('mode', e.target.value)}>
            {MODES.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiquette}>Référence</span>
          <input
            type="text"
            className={champ}
            value={form.reference}
            onChange={e => maj('reference', e.target.value)}
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-4">
          <span className={etiquette}>Observation</span>
          <input
            type="text"
            className={champ}
            value={form.observation}
            onChange={e => maj('observation', e.target.value)}
          />
        </label>
      </div>

      {erreur ? (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erreur}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onAnnuler} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button type="submit" className="px-4 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold">
          Enregistrer les modifications
        </button>
      </div>
    </form>
  );
};
