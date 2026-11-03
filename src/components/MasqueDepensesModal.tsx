import React, { useEffect, useMemo, useState } from 'react';
import { CaisseTransaction, CompteBancaire, MasqueDepense, PaymentMode } from '../types';
import { formatCurrencyMGA } from '../utils/numberToWords';
import {
  CATEGORIES_DEPENSE_MASQUE,
  PAYMENT_MODES,
  masqueVide,
  prochainCodeMasque,
  trierMasques,
} from '../utils/masqueDepenses';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ListPlus,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';

interface MasqueDepensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  masques: MasqueDepense[];
  banques: CompteBancaire[];
  transactions: CaisseTransaction[];
  onSaveMasques: (masques: MasqueDepense[]) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none';
const labelClass = 'block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wide';

/**
 * Fenêtre de gestion du masque : ajout, modification, duplication et retrait
 * des dépenses du masque de saisie (même principe d'ajout/modification que
 * l'entête des bulletins de SALAIRE SALFA : brouillon local puis Enregistrer).
 */
export const MasqueDepensesModal: React.FC<MasqueDepensesModalProps> = ({
  isOpen,
  onClose,
  masques,
  banques,
  transactions,
  onSaveMasques,
}) => {
  const [liste, setListe] = useState<MasqueDepense[]>(() => trierMasques(masques));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initial = trierMasques(masques);
      setListe(initial);
      setSelectedId(initial[0]?.id ?? null);
      setError('');
    }
  }, [isOpen, masques]);

  const selected = useMemo(() => liste.find(m => m.id === selectedId) ?? null, [liste, selectedId]);

  if (!isOpen) return null;

  const update = (id: string, patch: Partial<MasqueDepense>) => {
    setListe(old =>
      old.map(m => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)),
    );
  };

  const ajouter = () => {
    const nouveau = masqueVide(liste);
    setListe(old => [...old, nouveau]);
    setSelectedId(nouveau.id);
    setError('');
  };

  const ajouterDepuisTransaction = (tx: CaisseTransaction) => {
    if (!tx) return;
    const nouveau: MasqueDepense = {
      ...masqueVide(liste),
      designation: tx.libelle.slice(0, 60),
      libelle: tx.libelle,
      categorie: tx.categorie,
      beneficiaire: tx.beneficiaire,
      modePaiement: tx.modePaiement,
      montantDefaut: tx.montant,
      compteBanqueId: tx.compteBanqueId,
      notes: tx.notes ?? '',
    };
    setListe(old => [...old, nouveau]);
    setSelectedId(nouveau.id);
    setError('');
  };

  const dupliquer = (m: MasqueDepense) => {
    const copie: MasqueDepense = {
      ...m,
      id: `mdep-${Date.now()}`,
      code: prochainCodeMasque(liste),
      designation: `${m.designation} (copie)`,
      ordre: liste.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setListe(old => [...old, copie]);
    setSelectedId(copie.id);
  };

  const supprimer = (m: MasqueDepense) => {
    if (!window.confirm(`Retirer « ${m.designation || m.code} » du masque de saisie ?`)) return;
    const restants = liste.filter(x => x.id !== m.id);
    setListe(restants);
    if (selectedId === m.id) setSelectedId(restants[0]?.id ?? null);
  };

  const enregistrer = () => {
    const invalide = liste.find(m => !m.designation.trim() || !m.libelle.trim());
    if (invalide) {
      setSelectedId(invalide.id);
      setError(
        `Complétez le nom dans le masque et le libellé de la dépense « ${invalide.code} » avant d enregistrer.`,
      );
      return;
    }
    onSaveMasques(trierMasques(liste).map((m, i) => ({ ...m, ordre: i })));
    onClose();
  };

  const depensesDisponibles = transactions.filter(t => t.type === 'DEPENSE').slice(0, 12);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-3 flex items-center justify-center overflow-y-auto no-print"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="masque-gestion-title"
        className="w-full max-w-5xl my-6 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="masque-gestion-title" className="text-lg font-bold text-slate-900">
                Gérer le masque de saisie des dépenses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Les dépenses actives du masque peuvent être appelées en un clic dans la saisie et figurent sur le
                document imprimé.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] max-h-[72vh] overflow-hidden">
          {/* Liste des dépenses du masque */}
          <div className="border-r border-slate-200 flex flex-col min-h-0">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2 bg-white">
              <button
                type="button"
                onClick={ajouter}
                className="flex-1 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle dépense
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {liste.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  Aucune dépense dans le masque. Cliquez sur « Nouvelle dépense » ou reprenez une dépense existante.
                </p>
              ) : (
                liste.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left p-3 transition-colors ${
                      m.id === selectedId ? 'bg-teal-50 border-l-4 border-teal-600' : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{m.code}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          m.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {m.actif ? 'Dans le masque' : 'Hors masque'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {m.designation || '(sans nom)'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {m.categorie} — {formatCurrencyMGA(m.montantDefaut || 0)}
                    </div>
                  </button>
                ))
              )}
            </div>

            {depensesDisponibles.length > 0 ? (
              <div className="p-3 border-t border-slate-200 bg-slate-50/70">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                  Reprendre une dépense saisie
                </label>
                <select
                  value=""
                  onChange={e => {
                    const tx = transactions.find(t => t.id === e.target.value);
                    if (tx) ajouterDepuisTransaction(tx);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="">-- choisir dans la mémoire de caisse --</option>
                  {depensesDisponibles.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.numeroPiece} — {t.libelle.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* Formulaire d'ajout / modification */}
          <div className="min-h-0 overflow-y-auto">
            {!selected ? (
              <div className="h-full min-h-64 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <ListPlus className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Sélectionnez une dépense du masque</p>
                <p className="text-xs">ou créez-en une nouvelle pour l appeler ensuite dans la saisie.</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      Code du masque
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-800">{selected.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.actif}
                        onChange={e => update(selected.id, { actif: e.target.checked })}
                        className="accent-teal-600"
                      />
                      Inclure dans le masque
                    </label>
                    <button
                      type="button"
                      onClick={() => dupliquer(selected)}
                      title="Dupliquer"
                      className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimer(selected)}
                      title="Retirer du masque"
                      className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Nom dans le masque *</span>
                    <input
                      className={inputClass}
                      value={selected.designation}
                      placeholder="Ex: Consommables médicaux"
                      onChange={e => update(selected.id, { designation: e.target.value })}
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Libellé de la dépense *</span>
                    <input
                      className={inputClass}
                      value={selected.libelle}
                      placeholder="Ex: Achat consommables médicaux et seringues"
                      onChange={e => update(selected.id, { libelle: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Catégorie budgétaire</span>
                    <select
                      className={inputClass}
                      value={selected.categorie}
                      onChange={e => update(selected.id, { categorie: e.target.value })}
                    >
                      {[...new Set([...CATEGORIES_DEPENSE_MASQUE, selected.categorie])].filter(Boolean).map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Bénéficiaire / Tiers</span>
                    <input
                      className={inputClass}
                      value={selected.beneficiaire}
                      placeholder="Fournisseur, agent, organisme…"
                      onChange={e => update(selected.id, { beneficiaire: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Mode de règlement</span>
                    <select
                      className={inputClass}
                      value={selected.modePaiement}
                      onChange={e => update(selected.id, { modePaiement: e.target.value as PaymentMode })}
                    >
                      {PAYMENT_MODES.map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Montant proposé (MGA)</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      className={inputClass}
                      value={selected.montantDefaut || ''}
                      onChange={e => update(selected.id, { montantDefaut: Number(e.target.value) || 0 })}
                    />
                  </label>

                  {selected.modePaiement === 'Virement' ? (
                    <label className="block sm:col-span-2">
                      <span className={labelClass}>Compte bancaire source</span>
                      <select
                        className={inputClass}
                        value={selected.compteBanqueId ?? ''}
                        onChange={e => update(selected.id, { compteBanqueId: e.target.value || undefined })}
                      >
                        <option value="">-- choisir au moment de la saisie --</option>
                        {banques.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.nomBanque}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Référence / remarques</span>
                    <textarea
                      rows={2}
                      className={`${inputClass} resize-none`}
                      value={selected.notes ?? ''}
                      placeholder="Bon de commande, facture, autorisation…"
                      onChange={e => update(selected.id, { notes: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {error ? (
          <p role="alert" className="mx-5 mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-slate-200 bg-slate-50/60">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            {liste.filter(m => m.actif).length} dépense(s) active(s) sur {liste.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Enregistrer le masque
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
