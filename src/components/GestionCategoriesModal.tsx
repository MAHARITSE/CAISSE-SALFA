import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Plus, RotateCcw, Save, Tag, Trash2 } from 'lucide-react';
import type { Categories, Sens } from '../types';
import { MAX_CATEGORIES, MAX_LONGUEUR_CATEGORIE, categoriesParDefaut } from '../utils/constants';
import { masqueMajuscules } from '../utils/format';
import { Modale } from './Modale';

interface Props {
  categories: Categories;
  erreurExterne?: string | null;
  onEnregistrer: (sens: Sens, categories: string[]) => boolean | Promise<boolean>;
  onFermer: () => void;
}

const ONGLETS: Array<{ cle: Sens; libelle: string }> = [
  { cle: 'RECETTE', libelle: 'Recettes' },
  { cle: 'DEPENSE', libelle: 'Dépenses' },
];

/** Comparaison sans tenir compte de la casse : « Divers » et « DIVERS » sont la même catégorie. */
const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Gestion des catégories de saisie.
 *
 * Les recettes et les dépenses ont chacune leur liste : ajouter une catégorie
 * côté recettes ne la fait jamais apparaître côté dépenses. Une catégorie
 * utilisée par des écritures existantes peut être retirée de la liste : les
 * pièces déjà enregistrées gardent leur libellé.
 */
export function GestionCategoriesModal({ categories, erreurExterne, onEnregistrer, onFermer }: Props) {
  const formId = useId();
  const [sens, setSens] = useState<Sens>('RECETTE');
  const [brouillon, setBrouillon] = useState<Categories>(() => ({
    recette: [...categories.recette],
    depense: [...categories.depense],
  }));
  const [nouvelle, setNouvelle] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const cle = sens === 'RECETTE' ? 'recette' : 'depense';
  const liste = brouillon[cle];
  const autre = sens === 'RECETTE' ? 'dépenses' : 'recettes';

  function changerListe(valeur: string[]) {
    setBrouillon(etat => ({ ...etat, [cle]: valeur }));
    setErreur('');
  }

  function ajouter() {
    const nom = nouvelle.trim();
    if (!nom) { setErreur('Saisissez le nom de la catégorie.'); return; }
    if (nom.length > MAX_LONGUEUR_CATEGORIE) { setErreur(`${MAX_LONGUEUR_CATEGORIE} caractères maximum.`); return; }
    if (liste.some(c => memeNom(c, nom))) { setErreur('Cette catégorie figure déjà dans la liste.'); return; }
    if (liste.length >= MAX_CATEGORIES) { setErreur(`${MAX_CATEGORIES} catégories maximum.`); return; }
    changerListe([...liste, nom]);
    setNouvelle('');
  }

  function renommer(index: number, nom: string) {
    changerListe(liste.map((c, i) => i === index ? nom : c));
  }

  function deplacer(index: number, delta: number) {
    const copie = [...liste];
    const cible = index + delta;
    if (cible < 0 || cible >= copie.length) return;
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    changerListe(copie);
  }

  function restaurer() {
    const parDefaut = categoriesParDefaut();
    changerListe(sens === 'RECETTE' ? parDefaut.recette : parDefaut.depense);
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    const nettoyee = liste.map(c => c.trim());
    if (!nettoyee.length) { setErreur(`La liste des catégories de ${sens === 'RECETTE' ? 'recettes' : 'dépenses'} ne peut pas être vide.`); return; }
    if (nettoyee.some(c => !c)) { setErreur('Une catégorie ne peut pas être vide : supprimez-la plutôt.'); return; }
    const doublon = nettoyee.find((c, i) => nettoyee.findIndex(d => memeNom(d, c)) !== i);
    if (doublon) { setErreur(`La catégorie « ${doublon} » apparaît deux fois.`); return; }
    setEnCours(true);
    try {
      // Seule la liste affichée change : l'autre sens garde ses catégories.
      if (await onEnregistrer(sens, nettoyee)) onFermer();
      else setErreur('Les catégories n’ont pas été enregistrées.');
    } finally { setEnCours(false); }
  }

  return <Modale
    titre="Catégories de saisie"
    sousTitre="Les recettes et les dépenses ont chacune leurs catégories."
    icone={<Tag size={21} />}
    onFermer={onFermer}
    pied={<div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="btn-secondary" onClick={restaurer}><RotateCcw size={15} />Restaurer la liste par défaut</button>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={onFermer}>Annuler</button>
        <button type="submit" form={formId} className="btn-primary" disabled={enCours}><Save size={16} />{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </div>}
  >
    <form id={formId} onSubmit={enregistrer} className="space-y-5">
      <div role="tablist" aria-label="Type de catégories" className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {ONGLETS.map(onglet => <button
          key={onglet.cle}
          type="button"
          role="tab"
          aria-selected={onglet.cle === sens}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${onglet.cle === sens ? 'bg-white dark:bg-slate-900 text-brand-800 dark:text-brand-300 shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-brand-700'}`}
          onClick={() => { setSens(onglet.cle); setErreur(''); }}
        >{onglet.libelle} <span className="font-normal text-slate-400 dark:text-slate-500">({brouillon[onglet.cle === 'RECETTE' ? 'recette' : 'depense'].length})</span></button>)}
      </div>

      <p className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2.5 text-xs leading-relaxed text-sky-900 dark:text-sky-200 sm:text-sm">
        Cette liste ne concerne que les <strong>{sens === 'RECETTE' ? 'recettes' : 'dépenses'}</strong> ; celle des {autre} reste inchangée.
        Retirer une catégorie ne modifie aucune écriture déjà enregistrée.
      </p>

      <div className="grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor={`${formId}-nouvelle`}>Nouvelle catégorie</label>
          <input
            id={`${formId}-nouvelle`}
            className="field"
            maxLength={MAX_LONGUEUR_CATEGORIE}
            value={nouvelle}
            onChange={e => { setNouvelle(e.target.value); setErreur(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } }}
            placeholder="Ex. Imagerie médicale"
          />
        </div>
        <button type="button" className="btn-secondary self-end" onClick={ajouter}><Plus size={16} />Ajouter</button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {!liste.length && <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Aucune catégorie : ajoutez-en une ou restaurez la liste par défaut.</p>}
        {liste.map((categorie, index) => <div key={index} className="flex items-center gap-2 p-2">
          <span className="w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">{index + 1}</span>
          <input
            className="field min-w-0"
            aria-label={`Catégorie ${index + 1}`}
            maxLength={MAX_LONGUEUR_CATEGORIE}
            value={categorie}
            onChange={e => renommer(index, masqueMajuscules(e.target.value))}
          />
          <div className="flex shrink-0">
            <button type="button" className="icon-button" disabled={index === 0} aria-label={`Monter la catégorie ${index + 1}`} onClick={() => deplacer(index, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-button" disabled={index === liste.length - 1} aria-label={`Descendre la catégorie ${index + 1}`} onClick={() => deplacer(index, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="icon-button hover:text-rose-600" aria-label={`Supprimer la catégorie ${index + 1}`} onClick={() => changerListe(liste.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
          </div>
        </div>)}
      </div>

      {(erreur || erreurExterne) && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3.5 text-sm text-rose-800 dark:text-rose-300"><AlertCircle size={18} className="shrink-0" />{erreur || erreurExterne}</p>}
    </form>
  </Modale>;
}
