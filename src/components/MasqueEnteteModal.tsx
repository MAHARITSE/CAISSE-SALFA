import React, { useEffect, useState } from 'react';
import { Settings2, Upload, X, RotateCcw, AlertCircle, Image as ImageIcon, Type } from 'lucide-react';
import { MasqueEnteteConfig } from '../types';
import {
  ENTETE_LABELS,
  defaultEnteteMasque,
  loadEnteteMasque,
  readEnteteImage,
  saveEnteteMasque,
} from '../utils/masqueDepenses';
import { MasqueEnteteView } from './MasqueEntete';

interface MasqueEnteteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (config: MasqueEnteteConfig) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none';

/**
 * Fenêtre d'ajout / modification de l'entête du masque de saisie des dépenses.
 * Même logique que le BulletinHeaderModal de SALAIRE SALFA : mode image
 * complète ou textes + logos personnalisés, aperçu, restauration, enregistrement.
 */
export const MasqueEnteteModal: React.FC<MasqueEnteteModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [draft, setDraft] = useState<MasqueEnteteConfig>(loadEnteteMasque);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(loadEnteteMasque());
      setError('');
      setUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const upload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'logoGauche' | 'logoDroit',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const data = await readEnteteImage(file);
      setDraft(old => ({ ...old, [field]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image illisible.');
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (uploading) return;
    if (draft.mode === 'image' && !draft.image) {
      setError("Choisissez une image d'entête ou repassez en mode « Textes et logos personnalisés ».");
      return;
    }
    if (draft.mode === 'personnalise' && !draft.lignes.some(l => l.trim())) {
      setError('Renseignez au moins une ligne de texte pour cet entête.');
      return;
    }
    try {
      saveEnteteMasque(draft);
      onSaved(draft);
    } catch {
      setError(
        "Enregistrement impossible : espace de stockage insuffisant ou navigateur en mode privé. Essayez des images plus légères.",
      );
    }
  };

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
        aria-labelledby="masque-entete-title"
        className="w-full max-w-3xl my-6 rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 id="masque-entete-title" className="text-lg font-bold text-slate-900">
                Entête du masque de saisie des dépenses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Le réglage s applique au masque affiché et au document imprimé. Il est conservé dans ce navigateur.
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

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <fieldset>
            <legend className="text-sm font-bold text-slate-800 mb-2">Mode d entête</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="mode-entete-masque"
                  checked={draft.mode === 'image'}
                  onChange={() => setDraft(old => ({ ...old, mode: 'image' }))}
                />
                <ImageIcon className="w-4 h-4 text-slate-500" />
                Image complète
              </label>
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="mode-entete-masque"
                  checked={draft.mode === 'personnalise'}
                  onChange={() => setDraft(old => ({ ...old, mode: 'personnalise' }))}
                />
                <Type className="w-4 h-4 text-slate-500" />
                Textes et logos personnalisés
              </label>
            </div>
          </fieldset>

          {draft.mode === 'image' ? (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800" htmlFor="entete-image">
                Image complète de l entête
              </label>
              <input
                id="entete-image"
                type="file"
                accept="image/png,image/jpeg"
                onChange={e => upload(e, 'image')}
                className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                PNG ou JPEG, 1 Mo maximum. Une image horizontale est recommandée.
              </p>
              {draft.image ? (
                <button
                  type="button"
                  onClick={() => setDraft(old => ({ ...old, image: '' }))}
                  className="text-xs underline text-slate-600"
                >
                  Retirer cette image
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {(
                  [
                    ['logoGauche', 'Logo gauche'],
                    ['logoDroit', 'Logo droit'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                    <label className="block text-sm font-bold text-slate-800 mb-1" htmlFor={field}>
                      {label}
                    </label>
                    <input
                      id={field}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={e => upload(e, field)}
                      className="block w-full text-xs file:mr-2 file:px-2.5 file:py-1.5 file:rounded-lg file:border-0 file:bg-white file:text-slate-700 file:font-semibold"
                    />
                    {draft[field] ? (
                      <button
                        type="button"
                        onClick={() => setDraft(old => ({ ...old, [field]: '' }))}
                        className="text-xs underline text-slate-600 mt-1"
                      >
                        Retirer ce logo
                      </button>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">PNG ou JPEG, 1 Mo maximum.</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {draft.lignes.map((line, i) => (
                  <label key={i} className="block text-sm">
                    <span className="font-bold block mb-1 text-slate-700">{ENTETE_LABELS[i]}</span>
                    <input
                      className={inputClass}
                      value={line}
                      maxLength={160}
                      onChange={e => {
                        const text = e.target.value;
                        setDraft(old => ({
                          ...old,
                          lignes: old.lignes.map((v, n) => (n === i ? text : v)),
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200">
            <label className="block text-sm">
              <span className="font-bold block mb-1 text-slate-700">Titre du document</span>
              <input
                className={inputClass}
                value={draft.titreDocument}
                maxLength={120}
                onChange={e => setDraft(old => ({ ...old, titreDocument: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold block mb-1 text-slate-700">Lignes de la feuille vierge</span>
              <input
                type="number"
                min={1}
                max={30}
                className={inputClass}
                value={draft.nbLignesVierges}
                onChange={e =>
                  setDraft(old => ({ ...old, nbLignesVierges: Number(e.target.value) || 1 }))
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold block mb-1 text-slate-700">Mention de pied de page</span>
              <input
                className={inputClass}
                value={draft.mentionPied}
                maxLength={180}
                onChange={e => setDraft(old => ({ ...old, mentionPied: e.target.value }))}
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800 mb-2">Aperçu de l entête</p>
            <div className="bg-white border border-slate-300 rounded-xl p-3 min-h-24 flex items-center justify-center">
              {draft.mode === 'image' && !draft.image ? (
                <span className="text-xs text-slate-400">Aucune image sélectionnée</span>
              ) : (
                <div className="w-full">
                  <MasqueEnteteView config={draft} compact />
                  <div className="mt-2 pt-2 border-t border-slate-300 text-center text-[11px] font-bold uppercase tracking-wide text-slate-800">
                    {draft.titreDocument}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-between gap-2 p-5 border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              setDraft(defaultEnteteMasque());
              setError('');
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurer l entête fourni
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={uploading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Enregistrer l entête
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
