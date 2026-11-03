import React, { useState } from 'react';
import { Depense, MasqueDepense, ModePaiement } from '../types';
import { CATEGORIES, MODES } from '../utils/storage';
import { aujourdHui, formatAr } from '../utils/format';
import { MasqueDepenses } from './MasqueDepenses';

interface SaisieDepenseProps {
  numero: string;
  masques: MasqueDepense[];
  onEnregistrer: (depense: Depense) => void;
  onAjouterMasque: (masque: MasqueDepense) => void;
  onSupprimerMasque: (id: string) => void;
}

const champ =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';
const etiquette = 'block text-[11px] font-medium text-slate-500 mb-1';

export const SaisieDepense: React.FC<SaisieDepenseProps> = ({
  numero,
  masques,
  onEnregistrer,
  onAjouterMasque,
  onSupprimerMasque,
}) => {
  const [date, setDate] = useState(aujourdHui());
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [beneficiaire, setBeneficiaire] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('Espèces');
  const [notes, setNotes] = useState('');
  const [appliqueId, setAppliqueId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const montantNum = Number(montant) || 0;

  const appliquer = (masque: MasqueDepense) => {
    setLibelle(masque.libelle);
    setMontant(masque.montant > 0 ? String(masque.montant) : '');
    setCategorie(masque.categorie);
    setBeneficiaire(masque.beneficiaire);
    setModePaiement(masque.modePaiement);
    setAppliqueId(masque.id);
    setErreur('');
    setMessage(`Masque appliqué : ${masque.designation}.`);
  };

  const ajouterAuMasque = () => {
    if (!libelle.trim()) {
      setErreur('Renseignez le libellé avant de l ajouter au masque.');
      return;
    }
    if (masques.some(m => m.libelle.toLowerCase() === libelle.trim().toLowerCase())) {
      setErreur('Cette dépense figure déjà dans le masque.');
      return;
    }
    const nouveau: MasqueDepense = {
      id: `m-${Date.now()}`,
      designation: libelle.trim().slice(0, 60),
      libelle: libelle.trim(),
      montant: montantNum,
      categorie,
      beneficiaire: beneficiaire.trim(),
      modePaiement,
    };
    onAjouterMasque(nouveau);
    setAppliqueId(nouveau.id);
    setErreur('');
    setMessage('Dépense ajoutée au masque.');
  };

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!libelle.trim() || montantNum <= 0 || !beneficiaire.trim()) {
      setErreur('Libellé, montant (> 0) et bénéficiaire sont obligatoires.');
      return;
    }
    const depense: Depense = {
      id: `d-${Date.now()}`,
      numero,
      date,
      libelle: libelle.trim(),
      montant: montantNum,
      categorie,
      beneficiaire: beneficiaire.trim(),
      modePaiement,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onEnregistrer(depense);
    setLibelle('');
    setMontant('');
    setNotes('');
    setBeneficiaire('');
    setAppliqueId(null);
    setErreur('');
    setMessage(`Dépense enregistrée sous le n° ${numero}.`);
  };

  return (
    <div className="space-y-4">
      <MasqueDepenses
        masques={masques}
        appliqueId={appliqueId}
        onAppliquer={appliquer}
        onSupprimer={onSupprimerMasque}
        onAjouterDepuisSaisie={ajouterAuMasque}
        peutAjouter={!!libelle.trim()}
      />

      <form onSubmit={enregistrer} className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Nouvelle dépense</h2>
          <span className="text-xs text-slate-400 font-mono">{numero}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={etiquette}>Date</span>
            <input type="date" className={champ} value={date} onChange={e => setDate(e.target.value)} required />
          </label>

          <label>
            <span className={etiquette}>Montant (MGA)</span>
            <input
              type="number"
              min={1}
              step={100}
              className={champ}
              value={montant}
              onChange={e => setMontant(e.target.value)}
              placeholder="0"
              required
            />
            <span className="block text-[11px] text-slate-400 mt-1">{formatAr(montantNum)}</span>
          </label>

          <label className="sm:col-span-2">
            <span className={etiquette}>Libellé</span>
            <input
              type="text"
              className={champ}
              value={libelle}
              onChange={e => setLibelle(e.target.value)}
              placeholder="Ex : achat de consommables médicaux"
              required
            />
          </label>

          <label>
            <span className={etiquette}>Catégorie</span>
            <select className={champ} value={categorie} onChange={e => setCategorie(e.target.value)}>
              {[...new Set([...CATEGORIES, categorie])].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            <span className={etiquette}>Bénéficiaire</span>
            <input
              type="text"
              className={champ}
              value={beneficiaire}
              onChange={e => setBeneficiaire(e.target.value)}
              placeholder="Fournisseur, agent…"
              required
            />
          </label>

          <label>
            <span className={etiquette}>Mode de règlement</span>
            <select
              className={champ}
              value={modePaiement}
              onChange={e => setModePaiement(e.target.value as ModePaiement)}
            >
              {MODES.map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>

          <label>
            <span className={etiquette}>Référence (facultatif)</span>
            <input
              type="text"
              className={champ}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bon de commande, facture…"
            />
          </label>
        </div>

        {erreur ? <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erreur}</p> : null}
        {!erreur && message ? (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{message}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setLibelle('');
              setMontant('');
              setBeneficiaire('');
              setNotes('');
              setAppliqueId(null);
              setErreur('');
              setMessage('');
            }}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Effacer
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            Enregistrer la dépense
          </button>
        </div>
      </form>
    </div>
  );
};
