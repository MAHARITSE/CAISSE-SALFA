import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { Ecriture } from '../types';
import { dateFr, formatAr, montantAffiche } from '../utils/format';
import { Modale } from './Modale';

type Tri = 'montant_desc' | 'montant_asc' | 'date_desc' | 'date_asc';

interface Props {
  lignes: Ecriture[];
  periode: string;
  categorie: string | null;
  categories: string[];
  onToutesCategories: () => void;
  onModifierCategorie?: (id: string, categorie: string) => Promise<boolean>;
  raisonLectureSeule?: string;
  onFermer: () => void;
}

/** Aperçu des pièces de dépense, avec correction explicite de leur catégorie. */
export function ApercuDepenses({ lignes, periode, categorie, categories, onToutesCategories, onModifierCategorie, raisonLectureSeule, onFermer }: Props) {
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('montant_desc');
  const [limite, setLimite] = useState(50);
  const [depliees, setDepliees] = useState<Set<string>>(() => new Set());
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const ecritures = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter(e => {
      if (e.sens !== 'DEPENSE' || (categorie !== null && e.categorie !== categorie)) return false;
      if (!q) return true;
      return [e.numero, e.libelle, e.categorie, e.tiers, e.reference, ...(e.lignesDetail ?? []).map(d => d.libelle)]
        .some(texte => texte?.toLowerCase().includes(q));
    }).sort((a, b) => {
      if (tri === 'montant_desc') return b.montant - a.montant;
      if (tri === 'montant_asc') return a.montant - b.montant;
      if (tri === 'date_desc') return b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero);
      return a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero);
    });
  }, [lignes, categorie, recherche, tri]);

  async function enregistrer(e: Ecriture) {
    const nouvelle = choix[e.id] ?? e.categorie;
    if (!onModifierCategorie || enregistrement || nouvelle === e.categorie || !categories.includes(nouvelle)) return;
    setEnregistrement(e.id);
    setMessage('');
    setErreur('');
    try {
      const reussi = await onModifierCategorie(e.id, nouvelle);
      if (!reussi) {
        setErreur(`La catégorie de ${e.numero} n’a pas été enregistrée. Vérifiez le message d’erreur et réessayez.`);
        return;
      }
      setChoix(precedents => {
        const copie = { ...precedents };
        delete copie[e.id];
        return copie;
      });
      setMessage(`Catégorie de ${e.numero} enregistrée : ${nouvelle}.${categorie && categorie !== nouvelle ? ' La pièce ne correspond plus à la catégorie affichée.' : ''}`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'La catégorie n’a pas pu être enregistrée.');
    } finally {
      setEnregistrement(null);
    }
  }

  function basculer(id: string) {
    setDepliees(avant => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id); else apres.add(id);
      return apres;
    });
  }

  return (
    <Modale
      titre={`Aperçu des dépenses (${ecritures.length} pièce(s))`}
      sousTitre={`${periode} · ${categorie ?? 'Toutes les catégories'}`}
      icone={<ArrowUpRight size={22} className="text-rose-600 dark:text-rose-400" />}
      largeur="document"
      onFermer={onFermer}
      pied={<div className="flex justify-end"><button type="button" className="btn-secondary" onClick={onFermer}>Fermer l’aperçu</button></div>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input type="search" className="field !pl-9 !text-sm" aria-label="Rechercher dans l’aperçu des dépenses" placeholder="Rechercher une pièce, un libellé, une sous-ligne…" value={recherche} onChange={e => { setRecherche(e.target.value); setLimite(50); }} />
          </div>
          <select className="field !w-auto !text-sm" aria-label="Trier les dépenses de l’aperçu" value={tri} onChange={e => setTri(e.target.value as Tri)}>
            <option value="montant_desc">Montant décroissant</option>
            <option value="montant_asc">Montant croissant</option>
            <option value="date_desc">Date (plus récente)</option>
            <option value="date_asc">Date (plus ancienne)</option>
          </select>
          {categorie !== null && <button type="button" className="btn-secondary" onClick={() => { onToutesCategories(); setLimite(50); }}>Toutes les catégories</button>}
        </div>
        {raisonLectureSeule && !onModifierCategorie && <p className="text-sm text-slate-600 dark:text-slate-400">{raisonLectureSeule}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{message}</p>}
        {erreur && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">{erreur}</p>}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {ecritures.length === 0 && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Aucune pièce ne correspond à ce filtre.</p>}
          {ecritures.slice(0, limite).map(e => {
            const ouvert = depliees.has(e.id);
            const nouvelle = choix[e.id] ?? e.categorie;
            return (
              <article key={e.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" aria-expanded={ouvert} onClick={() => basculer(e.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left text-sm hover:text-brand-700 dark:hover:text-brand-300">
                    {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-mono text-xs text-slate-500">{dateFr(e.date)}</span>
                    <span className="badge badge-neutral font-mono text-xs">{e.numero}</span>
                    <span className="font-semibold">{e.libelle}</span>
                    {Boolean(e.lignesDetail?.length) && <span className="text-xs text-slate-500">{e.lignesDetail?.length} sous-ligne(s)</span>}
                  </button>
                  <strong className="tabular-nums text-rose-700 dark:text-rose-400">{formatAr(e.montant)}</strong>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {onModifierCategorie ? <>
                    <label className="min-w-48 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Catégorie
                      <select aria-label={`Catégorie de ${e.numero}`} className="field mt-1 !text-sm" value={nouvelle} disabled={enregistrement !== null} onChange={event => setChoix(avant => ({ ...avant, [e.id]: event.target.value }))}>
                        {!categories.includes(e.categorie) && <option value={e.categorie}>{e.categorie}</option>}
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <button type="button" className="btn-secondary !text-xs" aria-label={`Enregistrer la catégorie de ${e.numero}`} disabled={enregistrement !== null || nouvelle === e.categorie} onClick={() => void enregistrer(e)}>
                      {enregistrement === e.id ? 'Enregistrement…' : 'Enregistrer la catégorie'}
                    </button>
                  </> : <p className="text-sm text-slate-600 dark:text-slate-300">Catégorie : <strong>{e.categorie}</strong></p>}
                </div>
                {ouvert && (e.lignesDetail?.length ? <div className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                  <p className="mb-1 text-xs text-slate-500">Montants en ariary</p>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th className="py-1">Sous-ligne de détail</th><th className="py-1 text-right">Montant</th></tr></thead>
                    <tbody>{e.lignesDetail.map(d => <tr key={d.id}><td className="py-1">{d.libelle}</td><td className="py-1 text-right tabular-nums">{montantAffiche(d.montant)}</td></tr>)}</tbody>
                  </table>
                </div> : <p className="mt-3 text-xs text-slate-500">Aucune sous-ligne de détail.</p>)}
              </article>
            );
          })}
          {ecritures.length > limite && <div className="p-3 text-center"><button type="button" className="btn-secondary !text-xs" onClick={() => setLimite(n => n + 100)}>Afficher 100 pièces supplémentaires ({ecritures.length - limite} restantes)</button></div>}
        </div>
      </div>
    </Modale>
  );
}
