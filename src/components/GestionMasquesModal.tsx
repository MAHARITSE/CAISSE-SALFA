import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Edit3,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { MasqueSaisie, Sens } from '../types';

interface GestionMasquesModalProps {
  masques: MasqueSaisie[];
  onSauvegarderMasques: (nouveauxMasques: MasqueSaisie[]) => void;
  onFermer: () => void;
}

export const GestionMasquesModal: React.FC<GestionMasquesModalProps> = ({
  masques,
  onSauvegarderMasques,
  onFermer,
}) => {
  const [filtreSens, setFiltreSens] = useState<'TOUS' | 'RECETTE' | 'DEPENSE'>('TOUS');
  const [enCreation, setEnCreation] = useState(false);
  const [masqueEnEdition, setMasqueEnEdition] = useState<MasqueSaisie | null>(null);

  // Formulaire d'édition / création
  const [formNom, setFormNom] = useState('');
  const [formSens, setFormSens] = useState<Sens>('RECETTE');
  const [formDescription, setFormDescription] = useState('');
  const [formLignes, setFormLignes] = useState<string[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState('');
  const [erreur, setErreur] = useState('');

  // Confirmation de suppression interne (évite window.confirm)
  const [masqueASupprimer, setMasqueASupprimer] = useState<MasqueSaisie | null>(null);

  // Fermer la modale avec Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (masqueASupprimer) {
          setMasqueASupprimer(null);
        } else if (enCreation) {
          fermerFormulaire();
        } else {
          onFermer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [masqueASupprimer, enCreation, onFermer]);

  const ouvrirCreation = () => {
    setMasqueEnEdition(null);
    setFormNom('');
    setFormSens('RECETTE');
    setFormDescription('');
    setFormLignes([]);
    setNouvelleLigne('');
    setErreur('');
    setEnCreation(true);
  };

  const ouvrirEdition = (m: MasqueSaisie) => {
    setMasqueEnEdition(m);
    setFormNom(m.nom);
    setFormSens(m.sens);
    setFormDescription(m.description || '');
    setFormLignes(m.lignes.map(l => l.description));
    setNouvelleLigne('');
    setErreur('');
    setEnCreation(true);
  };

  const fermerFormulaire = () => {
    setEnCreation(false);
    setMasqueEnEdition(null);
    setErreur('');
  };

  const ajouterLigne = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const txt = nouvelleLigne.trim().toUpperCase();
    if (!txt) return;
    if (formLignes.includes(txt)) {
      setErreur(`La ligne "${txt}" figure déjà dans ce masque.`);
      return;
    }
    setFormLignes(prev => [...prev, txt]);
    setNouvelleLigne('');
    setErreur('');
  };

  const supprimerLigne = (index: number) => {
    setFormLignes(prev => prev.filter((_, i) => i !== index));
  };

  const enregistrerMasque = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNom.trim()) {
      setErreur('Veuillez renseigner un titre ou nom pour ce masque.');
      return;
    }
    if (formLignes.length === 0) {
      setErreur('Veuillez ajouter au moins une ligne de poste.');
      return;
    }

    const nouveauMasque: MasqueSaisie = {
      id: masqueEnEdition ? masqueEnEdition.id : `masque-${Date.now()}`,
      nom: formNom.trim(),
      sens: formSens,
      description: formDescription.trim() || undefined,
      lignes: formLignes.map(desc => ({ description: desc })),
    };

    if (masqueEnEdition) {
      const maj = masques.map(m => (m.id === masqueEnEdition.id ? nouveauMasque : m));
      onSauvegarderMasques(maj);
    } else {
      onSauvegarderMasques([...masques, nouveauMasque]);
    }

    fermerFormulaire();
  };

  const confirmerSuppressionMasque = () => {
    if (!masqueASupprimer) return;
    onSauvegarderMasques(masques.filter(m => m.id !== masqueASupprimer.id));
    setMasqueASupprimer(null);
  };

  const masquesFiltres = masques.filter(m =>
    filtreSens === 'TOUS' ? true : m.sens === filtreSens,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto no-print">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200/90 ring-1 ring-slate-900/5 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête modernisé */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                Gestion des Masques de Saisie
              </h2>
              <p className="text-xs text-slate-500">
                Modèles préconfigurés pour automatiser la décomposition des recettes et dépenses
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFermer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!enCreation ? (
            <>
              {/* Barre d'outils (Filtres segmentés + Bouton Nouveau) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/70 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFiltreSens('TOUS')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                      filtreSens === 'TOUS'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tous ({masques.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltreSens('RECETTE')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                      filtreSens === 'RECETTE'
                        ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    Recettes ({masques.filter(m => m.sens === 'RECETTE').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltreSens('DEPENSE')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                      filtreSens === 'DEPENSE'
                        ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    Dépenses ({masques.filter(m => m.sens === 'DEPENSE').length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={ouvrirCreation}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-medium shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau masque</span>
                </button>
              </div>

              {/* Liste des masques */}
              <div className="space-y-3">
                {masquesFiltres.length === 0 ? (
                  <div className="py-12 text-center">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">Aucun masque de saisie</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Créez votre premier modèle pour remplir les sous-lignes en un clic.
                    </p>
                  </div>
                ) : (
                  masquesFiltres.map(m => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                              {m.nom}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                m.sens === 'RECETTE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {m.sens === 'RECETTE' ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              <span>{m.sens === 'RECETTE' ? 'Recette' : 'Dépense'}</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {m.lignes.length} poste{m.lignes.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {m.description && (
                            <p className="text-xs text-slate-500 mt-1">{m.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => ouvrirEdition(m)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMasqueASupprimer(m)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      </div>

                      {/* Aperçu des lignes du masque sous forme de badges textuels discrets */}
                      <div className="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-slate-100">
                        {m.lignes.map((l, lIdx) => (
                          <span
                            key={lIdx}
                            className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 uppercase"
                          >
                            {l.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Formulaire d'ajout / modification de masque */
            <form onSubmit={enregistrerMasque} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {masqueEnEdition ? `Modifier le masque : ${masqueEnEdition.nom}` : 'Nouveau masque de saisie'}
                </h3>
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  ← Revenir à la liste
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Nom du modèle <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNom}
                    onChange={e => setFormNom(e.target.value)}
                    placeholder="Ex: Recette Urgences, Fournitures bureau..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Type d'opération <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1 bg-slate-100/70">
                    <button
                      type="button"
                      onClick={() => setFormSens('RECETTE')}
                      className={`py-1.5 text-xs font-medium rounded-md cursor-pointer transition ${
                        formSens === 'RECETTE'
                          ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Recette
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSens('DEPENSE')}
                      className={`py-1.5 text-xs font-medium rounded-md cursor-pointer transition ${
                        formSens === 'DEPENSE'
                          ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dépense
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                  Description / Remarque (optionnel)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Ex: Modèle des 12 départements de consultations et soins"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                />
              </div>

              {/* Lignes du masque */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Postes inclus ({formLignes.length})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Ces lignes seront injectées dans la grille lors de l'application
                  </span>
                </div>

                {/* Formulaire ajout ligne */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nouvelleLigne}
                    onChange={e => setNouvelleLigne(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        ajouterLigne();
                      }
                    }}
                    placeholder="Saisir un libellé de poste (ex: ECHOGRAPHIE, PHARMACIE...)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs uppercase font-medium text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => ajouterLigne()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-medium shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* Liste des postes du masque */}
                <div className="border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {formLignes.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400 italic">
                      Aucun poste ajouté. Saisissez un nom ci-dessus puis cliquez sur Ajouter.
                    </p>
                  ) : (
                    formLignes.map((ligne, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 w-5">{idx + 1}.</span>
                          <span className="font-semibold text-slate-800 uppercase">{ligne}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => supprimerLigne(idx)}
                          className="w-6 h-6 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Supprimer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {erreur && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{erreur}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{masqueEnEdition ? 'Mettre à jour le masque' : 'Enregistrer le masque'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pied de modale */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Confirmation de suppression d'un masque */}
      {masqueASupprimer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Supprimer ce masque ?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer le masque de saisie{' '}
              <strong className="text-slate-900 font-semibold">{masqueASupprimer.nom}</strong> ? Cette opération est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMasqueASupprimer(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmerSuppressionMasque}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionMasquesModal;
