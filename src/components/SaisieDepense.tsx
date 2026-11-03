import React, { useState } from 'react';
import { Ecriture, Mode } from '../types';
import { CATEGORIES_DEPENSE, MODES } from '../utils/storage';
import { aujourdHui, formatAr } from '../utils/format';

interface SaisieDepenseProps {
  numeroSuivant: (date: string) => string;
  suggestionsLibelle: string[];
  suggestionsTiers: string[];
  onEnregistrer: (ecriture: Ecriture) => void;
}

const champ =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';
const etiquette = 'block text-[11px] font-medium text-slate-500 mb-1';

const vide = () => ({
  date: aujourdHui(),
  libelle: '',
  categorie: CATEGORIES_DEPENSE[0],
  tiers: '',
  montant: '',
  mode: 'Espèces' as Mode,
  reference: '',
});

export const SaisieDepense: React.FC<SaisieDepenseProps> = ({
  numeroSuivant,
  suggestionsLibelle,
  suggestionsTiers,
  onEnregistrer,
}) => {
  const [form, setForm] = useState(vide);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const numero = numeroSuivant(form.date);
  const montantNum = Number(form.montant) || 0;

  const maj = (champModifie: keyof typeof form, valeur: string) => {
    setForm(f => ({ ...f, [champModifie]: valeur }));
    setErreur('');
  };

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.libelle.trim() || montantNum <= 0) {
      setErreur('Le libellé et un montant supérieur à 0 sont obligatoires.');
      return;
    }
    const ecriture: Ecriture = {
      id: `e-${Date.now()}`,
      numero,
      date: form.date,
      sens: 'DEPENSE',
      libelle: form.libelle.trim(),
      categorie: form.categorie,
      tiers: form.tiers.trim() || undefined,
      montant: montantNum,
      mode: form.mode,
      reference: form.reference.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onEnregistrer(ecriture);
    setConfirmation(`Dépense ${numero} enregistrée.`);
    setErreur('');
    setForm(f => ({ ...f, libelle: '', montant: '', reference: '', tiers: '' }));
  };

  return (
    <form onSubmit={enregistrer} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Dépense de caisse</h2>
          <p className="text-[11px] text-slate-500">Sortie d espèces, chèque, virement ou mobile money.</p>
        </div>
        <span className="text-[11px] font-mono text-slate-400">{numero}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className={etiquette}>Date</span>
          <input
            type="date"
            className={champ}
            value={form.date}
            onChange={e => maj('date', e.target.value)}
            required
          />
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
            placeholder="0"
            required
          />
          <span className="block text-[11px] text-slate-400 mt-1">{formatAr(montantNum)}</span>
        </label>

        <label>
          <span className={etiquette}>Mode</span>
          <select className={champ} value={form.mode} onChange={e => maj('mode', e.target.value)}>
            {MODES.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span className={etiquette}>Libellé</span>
          <input
            type="text"
            list="libelles-connus"
            className={champ}
            value={form.libelle}
            onChange={e => maj('libelle', e.target.value)}
            placeholder="Ex : achat de consommables médicaux"
            required
          />
          <datalist id="libelles-connus">
            {suggestionsLibelle.map(l => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>

        <label>
          <span className={etiquette}>Catégorie</span>
          <select className={champ} value={form.categorie} onChange={e => maj('categorie', e.target.value)}>
            {[...new Set([...CATEGORIES_DEPENSE, form.categorie])].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          <span className={etiquette}>Tiers / service</span>
          <input
            type="text"
            list="tiers-connus"
            className={champ}
            value={form.tiers}
            onChange={e => maj('tiers', e.target.value)}
            placeholder="Fournisseur, service…"
          />
          <datalist id="tiers-connus">
            {suggestionsTiers.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label className="sm:col-span-2">
          <span className={etiquette}>Référence</span>
          <input
            type="text"
            className={champ}
            value={form.reference}
            onChange={e => maj('reference', e.target.value)}
            placeholder="Pièce justificative"
          />
        </label>
      </div>

      {erreur ? (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erreur}</p>
      ) : confirmation ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{confirmation}</p>
      ) : null}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">N° attribué automatiquement</span>
          <span className="text-[11px] text-slate-400">{formatAr(montantNum)}</span>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-md bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800"
        >
          Enregistrer la dépense
        </button>
      </div>
    </form>
  );
};
