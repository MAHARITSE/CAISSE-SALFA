import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Plus,
  Settings,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { Ecriture, LigneDetail, MasqueSaisie, Sens } from '../types';
import { categoriesPour } from '../utils/storage';
import { aujourdHui, formatAr } from '../utils/format';

interface SaisieEcritureProps {
  ecritureEnEdition: Ecriture | null;
  sensInitial?: Sens;
  numeroSuivant: (sens: Sens, date: string) => string;
  suggestionsLibelle: string[];
  suggestionsTiers: string[];
  masques?: MasqueSaisie[];
  onOuvrirGestionMasques?: () => void;
  onEnregistrer: (ecriture: Ecriture) => void;
  onAnnulerEdition: () => void;
  onFermer?: () => void;
}

interface LigneGrid {
  id: string;
  description: string;
  montant: number;
}

export const SaisieEcriture: React.FC<SaisieEcritureProps> = ({
  ecritureEnEdition,
  sensInitial = 'RECETTE',
  numeroSuivant,
  suggestionsLibelle,
  suggestionsTiers,
  masques = [],
  onOuvrirGestionMasques,
  onEnregistrer,
  onAnnulerEdition,
  onFermer,
}) => {
  // Le sens est strictement verrouillé : +Recette ouvre SEULEMENT recette, +Dépense ouvre SEULEMENT dépense
  const sens: Sens = ecritureEnEdition ? ecritureEnEdition.sens : sensInitial;
  const estRecette = sens === 'RECETTE';

  const [date, setDate] = useState(aujourdHui());
  const [libelle, setLibelle] = useState('');
  const [observation, setObservation] = useState('');
  const [categorie, setCategorie] = useState(categoriesPour(sens)[0]);
  const [tiers, setTiers] = useState('');
  const [optionsAvancees, setOptionsAvancees] = useState(false);

  // Lignes de détail de la caisse (décomposition des montants)
  const [lignes, setLignes] = useState<LigneGrid[]>([]);

  // Saisie rapide dans la barre d'ajout
  const [saisieDescription, setSaisieDescription] = useState('');
  const [saisieMontant, setSaisieMontant] = useState('');

  // Fallback si montant direct sans décomposition
  const [montantSimple, setMontantSimple] = useState('');

  // Menu déroulant pour appliquer un masque de saisie
  const [menuMasquesOuvert, setMenuMasquesOuvert] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [erreur, setErreur] = useState('');
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Masques filtrés pour cette fenêtre (Recette ou Dépense)
  const masquesApplicables = masques.filter(m => m.sens === sens);

  // Fermer le dropdown si clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuMasquesOuvert(false);
      }
    }
    if (menuMasquesOuvert) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuMasquesOuvert]);

  // Initialisation à l'ouverture (création ou édition)
  useEffect(() => {
    if (ecritureEnEdition) {
      setDate(ecritureEnEdition.date);
      setLibelle(ecritureEnEdition.libelle);
      setObservation(ecritureEnEdition.observation ?? ecritureEnEdition.reference ?? '');
      setCategorie(ecritureEnEdition.categorie);
      setTiers(ecritureEnEdition.tiers ?? '');

      if (ecritureEnEdition.lignesDetail && ecritureEnEdition.lignesDetail.length > 0) {
        setLignes(
          ecritureEnEdition.lignesDetail.map(d => ({
            id: d.id,
            description: d.libelle,
            montant: d.montant,
          })),
        );
        setMontantSimple('');
      } else {
        setLignes([]);
        setMontantSimple(String(ecritureEnEdition.montant || ''));
      }
    } else {
      setDate(aujourdHui());
      setLibelle(''); // Pas de pré-remplissage du libellé
      setObservation('');
      setCategorie(categoriesPour(sens)[0]);
      setTiers('');
      setLignes([]);
      setMontantSimple('');
    }
    setSaisieDescription('');
    setSaisieMontant('');
    setMenuMasquesOuvert(false);
    setErreur('');
  }, [ecritureEnEdition, sens]);

  const numero = ecritureEnEdition ? ecritureEnEdition.numero : numeroSuivant(sens, date);

  // Calcul du montant total
  const montantTotalLignes = lignes.reduce((total, l) => total + l.montant, 0);
  const montantTotal = lignes.length > 0 ? montantTotalLignes : (Number(montantSimple) || 0);

  /** Ajoute une ligne dans la grille */
  const ajouterLigne = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const desc = saisieDescription.trim().toUpperCase();
    const mnt = Math.max(0, Math.round(Number(saisieMontant) || 0));

    if (!desc) {
      setErreur('Veuillez saisir une description pour la ligne.');
      descriptionInputRef.current?.focus();
      return;
    }
    if (mnt <= 0) {
      setErreur('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    setLignes(prev => [
      ...prev,
      {
        id: `lig-${Date.now()}-${prev.length}`,
        description: desc,
        montant: mnt,
      },
    ]);

    setSaisieDescription('');
    setSaisieMontant('');
    setErreur('');
    descriptionInputRef.current?.focus();
  };

  /** Supprime une ligne */
  const supprimerLigne = (id: string) => {
    setLignes(prev => prev.filter(l => l.id !== id));
  };

  /** Modifie le montant d'une ligne directement dans la grille */
  const modifierMontantLigne = (id: string, valeurStr: string) => {
    const mnt = Math.max(0, Math.round(Number(valeurStr) || 0));
    setLignes(prev => prev.map(l => (l.id === id ? { ...l, montant: mnt } : l)));
  };

  /** Applique un masque de saisie choisi par l'utilisateur */
  const appliquerMasque = (m: MasqueSaisie) => {
    const nouvelles: LigneGrid[] = m.lignes.map((l, idx) => ({
      id: `m-${Date.now()}-${idx}`,
      description: l.description,
      montant: l.montantDefaut || 0,
    }));
    setLignes(nouvelles);
    setMenuMasquesOuvert(false);
    setMontantSimple('');
    setErreur('');
  };

  const validerEnregistrement = (e: React.FormEvent) => {
    e.preventDefault();

    if (!libelle.trim()) {
      setErreur('Veuillez renseigner le libellé de l\'écriture.');
      return;
    }

    if (montantTotal <= 0) {
      setErreur('Le montant total doit être supérieur à 0.');
      return;
    }

    // Filtrer les sous-lignes valides (> 0) si présentes
    const sousLignesValides: LigneDetail[] = lignes
      .filter(l => l.montant > 0)
      .map(l => ({
        id: l.id,
        libelle: l.description,
        montant: l.montant,
      }));

    const maintenant = new Date().toISOString();
    const ecriture: Ecriture = {
      id: ecritureEnEdition ? ecritureEnEdition.id : `e-${Date.now()}`,
      numero,
      date,
      sens,
      libelle: libelle.trim(),
      observation: observation.trim() || undefined,
      reference: observation.trim() || undefined,
      categorie,
      tiers: tiers.trim() || undefined,
      montant: montantTotal,
      lignesDetail: sousLignesValides.length > 0 ? sousLignesValides : undefined,
      createdAt: ecritureEnEdition ? ecritureEnEdition.createdAt : maintenant,
    };

    onEnregistrer(ecriture);
    if (onFermer) {
      onFermer();
    }
  };

  return (
    <div className="w-full rounded-2xl bg-white shadow-2xl border border-slate-200/90 ring-1 ring-slate-900/5 overflow-hidden flex flex-col max-h-[90vh]">
      {/* En-tête modernisé avec accentuation subtile selon le sens */}
      <div
        className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
          estRecette
            ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/30 to-white border-emerald-100'
            : 'bg-gradient-to-r from-rose-50/90 via-orange-50/30 to-white border-rose-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              estRecette
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {estRecette ? (
              <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                {ecritureEnEdition
                  ? `Modifier l'écriture ${numero}`
                  : estRecette
                  ? 'Nouvelle Recette de Caisse'
                  : 'Nouvelle Dépense de Caisse'}
              </h2>
              <span
                className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                  estRecette
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {numero}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {estRecette
                ? 'Encaissement trésorerie · ventilation par départements'
                : 'Décaissement trésorerie · ventilation par postes de dépense'}
            </p>
          </div>
        </div>

        {onFermer && (
          <button
            type="button"
            onClick={onFermer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fermer (Échap)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Corps du formulaire avec scroll fluide */}
      <div className="p-6 overflow-y-auto space-y-5 flex-1">
        {/* Section 1 : Informations principales */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
            {/* DATE */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-600 mb-1">
                Date de l'opération
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                  required
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* LIBELLE */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-600 mb-1">
                Libellé principal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={libelle}
                onChange={e => setLibelle(e.target.value)}
                placeholder={
                  estRecette
                    ? 'Ex: RECETTE DU JOUR CAISSE PRINCIPALE...'
                    : 'Ex: ACHAT CARBURANT, REGLEMENT FOURNISSEUR...'
                }
                list="suggestions-libelle"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                required
              />
              <datalist id="suggestions-libelle">
                {suggestionsLibelle.map(l => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
          </div>

          {/* OBSERVATION */}
          <div>
            <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-600 mb-1">
              Observation / Référence pièce
            </label>
            <textarea
              value={observation}
              onChange={e => setObservation(e.target.value)}
              rows={2}
              placeholder="Ex: Facture N° 2026/04, chèque ou bordereau de versement, remarques..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 resize-none transition"
            />
          </div>

          {/* Options secondaires (Catégorie, Tiers / Bénéficiaire) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setOptionsAvancees(!optionsAvancees)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              {optionsAvancees ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>{optionsAvancees ? 'Masquer la catégorie et le tiers' : 'Spécifier la catégorie ou le tiers / bénéficiaire'}</span>
            </button>

            {optionsAvancees && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-600 mb-1">
                    Catégorie comptable
                  </label>
                  <select
                    value={categorie}
                    onChange={e => setCategorie(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  >
                    {categoriesPour(sens).map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-600 mb-1">
                    {estRecette ? 'Caissier / Déposant' : 'Bénéficiaire / Fournisseur'}
                  </label>
                  <input
                    type="text"
                    value={tiers}
                    onChange={e => setTiers(e.target.value)}
                    placeholder={estRecette ? 'Nom du caissier' : 'Nom du bénéficiaire'}
                    list="suggestions-tiers"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                  <datalist id="suggestions-tiers">
                    {suggestionsTiers.map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2 : Décomposition des montants / Grille de caisse */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Détail des montants
              </h3>
              {lignes.length > 0 && (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                  {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Menu déroulant Masque de saisie */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setMenuMasquesOuvert(!menuMasquesOuvert)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Masque de saisie</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {menuMasquesOuvert && (
                  <div className="absolute right-0 mt-1.5 z-40 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span>Modèles {estRecette ? 'Recette' : 'Dépense'}</span>
                      <span className="text-slate-400">{masquesApplicables.length} dispo</span>
                    </div>

                    <div className="py-1 max-h-52 overflow-y-auto space-y-1">
                      {masquesApplicables.length === 0 ? (
                        <p className="text-xs text-slate-400 italic px-2 py-3 text-center">
                          Aucun masque configuré.
                        </p>
                      ) : (
                        masquesApplicables.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => appliquerMasque(m)}
                            className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 transition cursor-pointer group"
                          >
                            <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                              {m.nom}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {m.lignes.length} postes : {m.lignes.map(l => l.description).join(', ')}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    {onOuvrirGestionMasques && (
                      <div className="pt-2 border-t border-slate-100 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuMasquesOuvert(false);
                            onOuvrirGestionMasques();
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 py-1.5 rounded-md transition cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-500" />
                          <span>Gérer les masques...</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {lignes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLignes([])}
                  className="text-xs text-slate-400 hover:text-rose-600 transition cursor-pointer"
                >
                  Vider la grille
                </button>
              )}
            </div>
          </div>

          {/* Barre d'ajout rapide modernisée */}
          <form
            onSubmit={ajouterLigne}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 grid grid-cols-1 sm:grid-cols-[1fr_180px_100px] gap-2 items-center"
          >
            <div>
              <input
                ref={descriptionInputRef}
                type="text"
                value={saisieDescription}
                onChange={e => setSaisieDescription(e.target.value)}
                placeholder={
                  estRecette
                    ? 'Description (ex: CONSULTATION, PHARMACIE...)'
                    : 'Description (ex: FRAIS DÉPLACEMENT, FOURNITURES...)'
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs uppercase font-medium text-slate-900 placeholder:normal-case placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
              />
            </div>

            <div className="relative">
              <input
                type="number"
                min={0}
                step={100}
                value={saisieMontant}
                onChange={e => setSaisieMontant(e.target.value)}
                placeholder="Montant"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-semibold text-right text-slate-900 placeholder:font-normal placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition pr-10"
              />
              <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono pointer-events-none">
                Ar
              </span>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-medium shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </form>

          {/* Grille modernisée */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3 text-left">Poste / Description</th>
                    <th className="py-2 px-4 w-44 text-right">Montant (MGA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 px-4 text-center">
                        <div className="max-w-xs mx-auto space-y-1.5">
                          <FileText className="w-6 h-6 text-slate-300 mx-auto" />
                          <p className="text-xs font-medium text-slate-600">Aucune ligne de détail</p>
                          <p className="text-[11px] text-slate-400">
                            Ajoutez des lignes via la barre ci-dessus, chargez un masque ou entrez un montant direct ci-dessous.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lignes.map((ligne, idx) => (
                      <tr
                        key={ligne.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => supprimerLigne(ligne.id)}
                            className="w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-1.5 px-3 font-semibold uppercase text-slate-800">
                          {idx + 1}. {ligne.description}
                        </td>
                        <td className="py-1.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={ligne.montant === 0 ? '' : ligne.montant}
                              onChange={e => modifierMontantLigne(ligne.id, e.target.value)}
                              placeholder="0"
                              className="w-28 rounded-md border border-transparent hover:border-slate-300 focus:border-slate-800 focus:bg-white px-2 py-1 text-right font-mono font-semibold text-slate-900 text-xs transition"
                            />
                            <span className="text-[11px] text-slate-400 font-mono">Ar</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saisie montant simple direct si aucune sous-ligne */}
          {lignes.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs">
              <span className="font-medium text-slate-700">Montant forfaitaire unique :</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={montantSimple}
                  onChange={e => setMontantSimple(e.target.value)}
                  placeholder="0"
                  className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-right font-mono font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                />
                <span className="font-mono text-xs text-slate-500 font-semibold">Ar</span>
              </div>
            </div>
          )}
        </div>

        {erreur && (
          <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}
      </div>

      {/* Barre inférieure / Total & Actions */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total {estRecette ? 'Recette' : 'Dépense'} :
          </span>
          <span
            className={`text-2xl font-bold font-mono tracking-tight ${
              estRecette ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatAr(montantTotal)}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onAnnulerEdition();
              if (onFermer) onFermer();
            }}
            className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={validerEnregistrement}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer active:scale-[0.98] ${
              estRecette
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{estRecette ? 'Enregistrer la recette' : 'Enregistrer la dépense'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaisieEcriture;
