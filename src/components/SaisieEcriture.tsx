import React, { useEffect, useState } from 'react';
import { Ecriture, Mode, Sens } from '../types';
import { MODES, categoriesPour } from '../utils/storage';
import { aujourdHui, formatAr } from '../utils/format';

interface SaisieEcritureProps {
  ecritureEnEdition: Ecriture | null;
  numeroSuivant: (sens: Sens, date: string) => string;
  suggestionsLibelle: string[];
  suggestionsTiers: string[];
  onEnregistrer: (ecriture: Ecriture) => void;
  onAnnulerEdition: () => void;
}

const champ =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';
const etiquette = 'block text-[11px] font-medium text-slate-500 mb-1';

const nouveau = (sens: Sens) => ({
  sens,
  date: aujourdHui(),
  libelle: '',
  categorie: categoriesPour(sens)[0],
  tiers: '',
  montant: '',
  mode: 'Espèces' as Mode,
  reference: '',
});

export const SaisieEcriture: React.FC<SaisieEcritureProps> = ({
  ecritureEnEdition,
  numeroSuivant,
  suggestionsLibelle,
  suggestionsTiers,
  onEnregistrer,
  onAnnulerEdition,
}) => {
  const [form, setForm] = useState(nouveau('RECETTE'));
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!ecritureEnEdition) return;
    setForm({
      sens: ecritureEnEdition.sens,
      date: ecritureEnEdition.date,
      libelle: ecritureEnEdition.libelle,
      categorie: ecritureEnEdition.categorie,
      tiers: ecritureEnEdition.tiers ?? '',
      montant: String(ecritureEnEdition.montant),
      mode: ecritureEnEdition.mode,
      reference: ecritureEnEdition.reference ?? '',
    });
    setErreur('');
    setConfirmation('');
  }, [ecritureEnEdition]);

  const estRecette = form.sens === 'RECETTE';
  const numero = ecritureEnEdition ? ecritureEnEdition.numero : numeroSuivant(form.sens, form.date);
  const montantNum = Number(form.montant) || 0;

  const changerSens = (sens: Sens) => {
    setForm(f => ({
      ...f,
      sens,
      categorie: categoriesPour(sens).includes(f.categorie) ? f.categorie : categoriesPour(sens)[0],
    }));
    setErreur('');
    setConfirmation('');
  };

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
    const maintenant = new Date().toISOString();
    const ecriture: Ecriture = {
      id: ecritureEnEdition ? ecritureEnEdition.id : `e-${Date.now()}`,
      numero,
      date: form.date,
      sens: form.sens,
      libelle: form.libelle.trim(),
      categorie: form.categorie,
      tiers: form.tiers.trim() || undefined,
      montant: montantNum,
      mode: form.mode,
      reference: form.reference.trim() || undefined,
      createdAt: ecritureEnEdition ? ecritureEnEdition.createdAt : maintenant,
    };
    onEnregistrer(ecriture);
    setConfirmation(
      ecritureEnEdition
        ? `Écriture ${numero} modifiée.`
        : `${estRecette ? 'Recette' : 'Dépense'} ${numero} enregistrée.`,
    );
    setErreur('');
    setForm(f => ({ ...f, libelle: '', montant: '', reference: '', tiers: '' }));
  };

  return (
    <form onSubmit={enregistrer} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          {ecritureEnEdition ? 'Modifier l écriture' : 'Nouvelle écriture'}
        </h2>
        <span className="text-[11px] font-mono text-slate-400">{numero}</span>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => changerSens('RECETTE')}
          className={`py-1.5 rounded text-xs font-semibold ${
            estRecette ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          Recette
        </button>
        <button
          type="button"
          onClick={() => changerSens('DEPENSE')}
          className={`py-1.5 rounded text-xs font-semibold ${
            !estRecette ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          Dépense
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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

        <label className="sm:col-span-2">
          <span className={etiquette}>Libellé</span>
          <input
            type="text"
            list="libelles-connus"
            className={champ}
            value={form.libelle}
            onChange={e => maj('libelle', e.target.value)}
            placeholder={estRecette ? 'Ex : recettes pharmacie du jour' : 'Ex : achat de consommables'}
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
            {categoriesPour(form.sens).map(c => (
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
            placeholder="Fournisseur, service, patient…"
          />
          <datalist id="tiers-connus">
            {suggestionsTiers.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
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
            placeholder="Pièce justificative"
          />
        </label>
      </div>

      {erreur ? (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erreur}</p>
      ) : confirmation ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{confirmation}</p>
      ) : null}

      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between gap-3 pt-2">
          {ecritureEnEdition ? (
            <button
              type="button"
              onClick={() => {
                onAnnulerEdition();
                setForm(f => ({ ...f, libelle: '', montant: '', reference: '', tiers: '' }));
                setErreur('');
                setConfirmation('');
              }}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Annuler la modification
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">N° attribué automatiquement</span>
          )}
          <span className="text-[11px] text-slate-400">{formatAr(montantNum)}</span>
        </div>

        <button
          type="submit"
          className={`w-full px-4 py-2.5 rounded-md text-white text-sm font-semibold shadow-sm ${
            estRecette ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
          }`}
        >
          {ecritureEnEdition
            ? 'Enregistrer les modifications'
            : estRecette
              ? 'Enregistrer la recette'
              : 'Enregistrer la dépense'}
        </button>
      </div>
    </form>
  );
};
