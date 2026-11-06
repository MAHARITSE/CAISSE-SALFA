import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, ListFilter, Pencil, Search } from 'lucide-react';
import type { Ecriture } from '../types';
import { dateFr, formatAr, montantAffiche } from '../utils/format';
import { determinerPoleDetail } from '../utils/analyse';
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
  const [editions, setEditions] = useState<Set<string>>(() => new Set());
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

  // La part de chaque pièce est calculée sur la catégorie sélectionnée,
  // indépendamment de la recherche et de la pagination de l'aperçu.
  const totalSelection = useMemo(() => lignes.reduce((total, e) =>
    e.sens === 'DEPENSE' && (categorie === null || e.categorie === categorie) ? total + e.montant : total, 0), [lignes, categorie]);

  function fermerEdition(id: string) {
    setEditions(avant => { const apres = new Set(avant); apres.delete(id); return apres; });
    setChoix(avant => { const apres = { ...avant }; delete apres[id]; return apres; });
  }

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
      fermerEdition(e.id);
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

  function basculerToutes() {
    const visibles = ecritures.slice(0, limite);
    const toutesOuvertes = visibles.every(e => depliees.has(e.id));
    setDepliees(avant => {
      const apres = new Set(avant);
      for (const e of visibles) {
        if (toutesOuvertes) apres.delete(e.id); else apres.add(e.id);
      }
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
          <button type="button" className="btn-secondary !text-xs" onClick={basculerToutes} disabled={ecritures.length === 0}>
            <ListFilter size={14} /> Sous-lignes
          </button>
          {categorie !== null && <button type="button" className="btn-secondary" onClick={() => { onToutesCategories(); setLimite(50); }}>Toutes les catégories</button>}
        </div>
        {raisonLectureSeule && !onModifierCategorie && <p className="text-sm text-slate-600 dark:text-slate-400">{raisonLectureSeule}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{message}</p>}
        {erreur && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">{erreur}</p>}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {ecritures.length === 0 && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Aucune pièce ne correspond à ce filtre.</p>}
          {ecritures.slice(0, limite).map(e => {
            const ouvert = depliees.has(e.id);
            const edition = editions.has(e.id);
            const nouvelle = choix[e.id] ?? e.categorie;
            const partPiece = totalSelection > 0 ? (e.montant / totalSelection) * 100 : 0;
            return (
              <article key={e.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs sm:text-sm">
                  <button type="button" aria-expanded={ouvert} onClick={() => basculer(e.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 text-left hover:text-brand-700 dark:hover:text-brand-300">
                    <span className="text-slate-400">{ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">{dateFr(e.date)}</span>
                    <span className="badge badge-neutral shrink-0 font-mono text-[11px]">{e.numero}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200" title={e.libelle}>{e.libelle}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{e.categorie}</span>
                    {Boolean(e.lignesDetail?.length) && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">{e.lignesDetail?.length} sous-ligne(s)</span>}
                  </button>
                  {onModifierCategorie && !edition && <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 !text-xs"
                    aria-label={`Modifier la catégorie de ${e.numero}`}
                    title="Modifier la catégorie"
                    disabled={enregistrement !== null}
                    onClick={() => { setErreur(''); setEditions(avant => new Set(avant).add(e.id)); }}
                  ><Pencil size={13} /> Catégorie</button>}
                  <div className="shrink-0 text-right tabular-nums">
                    <strong className="text-rose-700 dark:text-rose-400">{formatAr(e.montant)}</strong>
                    <span className="ml-2 text-xs text-slate-400">({partPiece.toFixed(1).replace('.', ',')} %)</span>
                  </div>
                </div>
                {onModifierCategorie && edition && <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
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
                  <button type="button" className="btn-secondary !text-xs" aria-label={`Annuler la modification de catégorie de ${e.numero}`} disabled={enregistrement !== null} onClick={() => { fermerEdition(e.id); setErreur(''); }}>Annuler</button>
                </div>}
                {ouvert && (e.lignesDetail?.length ? <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/90 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="mb-1 text-xs text-slate-500">Montants en ariary</p>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400"><th className="pb-1.5 font-semibold">N°</th><th className="pb-1.5 font-semibold">Sous-ligne de détail</th><th className="pb-1.5 font-semibold">Pôle analytique</th><th className="pb-1.5 text-right font-semibold">Montant</th></tr></thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">{e.lignesDetail.map((d, index) => <tr key={d.id}><td className="py-1.5 pr-2 font-mono text-slate-400">{index + 1}</td><td className="py-1.5 font-medium text-slate-700 dark:text-slate-200">{d.libelle}</td><td className="py-1.5 text-slate-500 dark:text-slate-400">{determinerPoleDetail('DEPENSE', d.libelle, e.categorie)}</td><td className={`py-1.5 text-right font-semibold tabular-nums ${d.montant < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>{montantAffiche(d.montant)}</td></tr>)}</tbody>
                  </table>
                </div> : <p className="border-t border-slate-100 px-6 py-2.5 text-xs text-slate-500 dark:border-slate-800">Aucune sous-ligne de détail.</p>)}
              </article>
            );
          })}
          {ecritures.length > limite && <div className="p-3 text-center"><button type="button" className="btn-secondary !text-xs" onClick={() => setLimite(n => n + 100)}>Afficher 100 pièces supplémentaires ({ecritures.length - limite} restantes)</button></div>}
        </div>
      </div>
    </Modale>
  );
}
