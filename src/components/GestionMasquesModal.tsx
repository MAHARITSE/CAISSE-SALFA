import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, Layers, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import type { MasqueSaisie, Sens } from '../types';
import { MAX_DETAILS } from '../utils/constants';
import { formatAr, masqueMajuscules, parserMontant } from '../utils/format';
import { ChampMontant } from './ChampMontant';
import { identifiant } from '../utils/ledger';
import { Modale } from './Modale';
import { Confirmation } from './Confirmation';

interface Props {
  masques: MasqueSaisie[];
  erreurExterne?: string | null;
  onSauvegarderMasques: (masques: MasqueSaisie[]) => boolean | Promise<boolean>;
  onFermer: () => void;
}
interface Poste { id: string; description: string; montant: string }

export function GestionMasquesModal({ masques, erreurExterne, onSauvegarderMasques, onFermer }: Props) {
  const formId = useId();
  const [filtre, setFiltre] = useState<'TOUS' | Sens>('TOUS');
  const [formulaire, setFormulaire] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [sens, setSens] = useState<Sens>('RECETTE');
  const [description, setDescription] = useState('');
  const [libelleModele, setLibelleModele] = useState('');
  const [postes, setPostes] = useState<Poste[]>([]);
  const [nouveau, setNouveau] = useState('');
  const [nouveauMontant, setNouveauMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [modifie, setModifie] = useState(false);
  const [aSupprimer, setASupprimer] = useState<MasqueSaisie | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [quitter, setQuitter] = useState<'liste' | 'fermer' | null>(null);

  function ouvrir(m?: MasqueSaisie) {
    setEditionId(m?.id ?? null); setNom(m?.nom ?? ''); setSens(m?.sens ?? 'RECETTE');
    setDescription(m?.description ?? '');
    setLibelleModele(m?.libelle ?? '');
    setPostes(m?.lignes.map(l => ({ id: identifiant('p'), description: l.description, montant: l.montantDefaut == null ? '' : String(l.montantDefaut) })) ?? []);
    setNouveau(''); setNouveauMontant(''); setErreur(''); setModifie(false); setFormulaire(true);
  }
  function fermer() {
    if (formulaire && modifie) setQuitter('fermer');
    else onFermer();
  }
  function ajouter() {
    const description = nouveau.trim();
    if (!description) { setErreur('Saisissez le nom du poste.'); return; }
    if (postes.some(p => p.description.toLowerCase() === description.toLowerCase())) { setErreur('Ce poste figure déjà dans le modèle.'); return; }
    if (postes.length >= MAX_DETAILS) { setErreur(`${MAX_DETAILS} postes maximum par modèle.`); return; }
    const montant = nouveauMontant.trim() ? parserMontant(nouveauMontant) : 0;
    if (montant === null) { setErreur('Le montant par défaut doit être un entier positif ou nul.'); return; }
    setPostes(p => [...p, { id: identifiant('p'), description, montant: montant ? String(montant) : '' }]);
    setNouveau(''); setNouveauMontant(''); setErreur(''); setModifie(true);
  }
  function deplacer(index: number, delta: number) {
    setPostes(p => { const copie = [...p]; [copie[index], copie[index + delta]] = [copie[index + delta], copie[index]]; return copie; });
    setModifie(true);
  }
  async function enregistrer(e: FormEvent) {
    e.preventDefault(); setErreur('');
    if (!nom.trim() || !postes.length) { setErreur('Un modèle doit avoir un nom et au moins un poste.'); return; }
    if (postes.some(p => !p.description.trim() || (p.montant.trim() && parserMontant(p.montant) === null))) {
      setErreur('Vérifiez les libellés et les montants par défaut (entiers positifs ou nuls).'); return;
    }
    const m: MasqueSaisie = {
      id: editionId ?? identifiant('masque'), nom: nom.trim(), sens,
      description: description.trim() || undefined,
      libelle: libelleModele.trim() || undefined,
      lignes: postes.map(p => ({ description: p.description.trim(), montantDefaut: p.montant.trim() ? parserMontant(p.montant)! : undefined })),
    };
    setEnregistrement(true);
    let reussi: boolean;
    try { reussi = await onSauvegarderMasques(editionId ? masques.map(x => x.id === editionId ? m : x) : [...masques, m]); }
    finally { setEnregistrement(false); }
    if (reussi) {
      setFormulaire(false); setModifie(false);
    } else setErreur('Le modèle n’a pas été enregistré. Votre saisie reste disponible.');
  }

  const visibles = masques.filter(m => filtre === 'TOUS' || m.sens === filtre);
  return <>
    <Modale titre={formulaire ? editionId ? 'Modifier le modèle' : 'Nouveau modèle de saisie' : 'Modèles de saisie'}
      sousTitre="Préparez vos bordereaux récurrents. Les écritures déjà enregistrées ne sont pas modifiées."
      icone={<Layers size={21} />} onFermer={fermer}
      pied={formulaire ? <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => { if (modifie) setQuitter('liste'); else setFormulaire(false); }}>Retour aux modèles</button><button className="btn-primary" type="submit" form={formId} disabled={enregistrement}><Save size={16} />{enregistrement ? 'Enregistrement…' : 'Enregistrer le modèle'}</button></div> : <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500 dark:text-slate-400">{masques.length} modèle(s) enregistré(s)</p><button className="btn-secondary" onClick={fermer}>Fermer</button></div>}>
      {!formulaire ? <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="segmented">{(['TOUS', 'RECETTE', 'DEPENSE'] as const).map(f => <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>{f === 'TOUS' ? 'Tous' : f === 'RECETTE' ? 'Recettes' : 'Dépenses'}</button>)}</div><button className="btn-primary" onClick={() => ouvrir()}><Plus size={16} />Nouveau modèle</button></div>
        {!visibles.length && <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center"><Layers className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={32} /><p className="text-base font-semibold">Aucun modèle pour cette vue</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Créez un modèle adapté à vos opérations.</p></div>}
        {visibles.map(m => <article key={m.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3"><div><span className={`badge ${m.sens === 'RECETTE' ? 'badge-green' : 'badge-red'}`}>{m.sens === 'RECETTE' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{m.sens === 'RECETTE' ? 'Recette' : 'Dépense'}</span><h3 className="mt-2 text-base font-semibold">{m.nom}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{m.description || `${m.lignes.length} postes prédéfinis`}</p>{m.libelle && <p className="mt-1.5 text-xs font-semibold text-brand-800 dark:text-brand-300">Libellé rattaché : « {m.libelle} »</p>}</div><div className="flex shrink-0 gap-1"><button className="icon-button" aria-label={`Modifier ${m.nom}`} onClick={() => ouvrir(m)}><Pencil size={16} /></button><button className="icon-button hover:text-rose-600" aria-label={`Supprimer ${m.nom}`} onClick={() => setASupprimer(m)}><Trash2 size={16} /></button></div></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{m.lignes.slice(0, 6).map((l, i) => <span key={`${l.description}-${i}`} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{l.description}{l.montantDefaut ? ` · ${formatAr(l.montantDefaut)}` : ''}</span>)}{m.lignes.length > 6 && <span className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">+{m.lignes.length - 6} autres</span>}</div>
        </article>)}
      </div> : <form id={formId} className="space-y-4" onSubmit={enregistrer} onChange={() => setModifie(true)}>
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><div><label className="label" htmlFor={`${formId}-nom`}>Nom du modèle *</label><input id={`${formId}-nom`} className="field" required maxLength={120} value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex. Recettes du jour" autoFocus /></div><div><label className="label" htmlFor={`${formId}-sens`}>Type d’opération *</label><select id={`${formId}-sens`} className="field" value={sens} onChange={e => setSens(e.target.value as Sens)}><option value="RECETTE">Recette</option><option value="DEPENSE">Dépense</option></select></div></div>
        <div><label className="label" htmlFor={`${formId}-description`}>Description</label><input id={`${formId}-description`} className="field" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="À quoi sert ce modèle ?" /></div>
        <div><label className="label" htmlFor={`${formId}-libelle-modele`}>Libellé associé de l’écriture</label><input id={`${formId}-libelle-modele`} className="field" maxLength={200} value={libelleModele} onChange={e => setLibelleModele(masqueMajuscules(e.target.value))} placeholder="Ex. RECETTES JOURNALIERES DU SERVICE" /><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ce libellé préremplira automatiquement l’écriture au choix de ce modèle (modifiable lors de la saisie).</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/60"><h3 className="text-base font-semibold">Postes du bordereau ({postes.length})</h3><div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><div><label className="label" htmlFor={`${formId}-nouveau`}>Libellé</label><input id={`${formId}-nouveau`} className="field" maxLength={200} value={nouveau} onChange={e => setNouveau(masqueMajuscules(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } }} placeholder="Ex. CONSULTATION" /></div><div><ChampMontant id={`${formId}-montant`} label="Montant par défaut" valeur={nouveauMontant} onChange={setNouveauMontant} placeholder="Facultatif (Ar)" /></div><button type="button" className="btn-secondary self-end" onClick={ajouter}><Plus size={16} />Ajouter</button></div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-800">{!postes.length && <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Ajoutez au moins un poste.</p>}{postes.map((p, i) => <div key={p.id} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 p-2"><input className="field min-w-0" aria-label={`Libellé du poste ${i + 1}`} maxLength={200} value={p.description} onChange={e => { setPostes(prev => prev.map(x => x.id === p.id ? { ...x, description: masqueMajuscules(e.target.value) } : x)); setModifie(true); }} /><ChampMontant label="" etiquetteSeule={`Montant par défaut du poste ${i + 1}`} valeur={p.montant} placeholder="0 Ar" onChange={valeur => { setPostes(prev => prev.map(x => x.id === p.id ? { ...x, montant: valeur } : x)); setModifie(true); }} /><div className="flex"><button type="button" tabIndex={-1} className="icon-button" disabled={i === 0} aria-label={`Monter le poste ${i + 1}`} onClick={() => deplacer(i, -1)}><ArrowUp size={15} /></button><button type="button" tabIndex={-1} className="icon-button" disabled={i === postes.length - 1} aria-label={`Descendre le poste ${i + 1}`} onClick={() => deplacer(i, 1)}><ArrowDown size={15} /></button><button type="button" tabIndex={-1} className="icon-button hover:text-rose-600" aria-label={`Supprimer le poste ${i + 1}`} onClick={() => { setPostes(prev => prev.filter(x => x.id !== p.id)); setModifie(true); }}><Trash2 size={15} /></button></div></div>)}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Un montant par défaut facultatif préremplit le poste. L’ordre des postes est conservé.</p>
        </div>
      </form>}
      {(erreur || erreurExterne) && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-300"><AlertCircle size={16} className="shrink-0" /><div>{erreur}{erreurExterne && <p className="mt-1">{erreurExterne}</p>}</div></div>}
    </Modale>
    {aSupprimer && <Confirmation titre="Supprimer ce modèle ?" danger libelleConfirmer="Supprimer le modèle" onAnnuler={() => setASupprimer(null)} onConfirmer={async () => { if (await onSauvegarderMasques(masques.filter(m => m.id !== aSupprimer.id))) setASupprimer(null); }}><p>Le modèle « {aSupprimer.nom} » sera supprimé. Les écritures qui l’ont utilisé restent intactes.</p></Confirmation>}
    {quitter && <Confirmation titre="Abandonner les modifications ?" libelleConfirmer="Abandonner" onAnnuler={() => setQuitter(null)} onConfirmer={() => { const action = quitter; setQuitter(null); if (action === 'fermer') onFermer(); else { setFormulaire(false); setModifie(false); } }}><p>Les modifications du modèle ne sont pas enregistrées.</p></Confirmation>}
  </>;
}
