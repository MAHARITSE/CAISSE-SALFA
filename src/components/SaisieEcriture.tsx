import { useId, useRef, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Layers, Plus, Trash2, AlertCircle, ListPlus } from 'lucide-react';
import type { Ecriture, MasqueSaisie, Sens } from '../types';
import { categoriesPour, MAX_DETAILS, MONTANT_MAX } from '../utils/constants';
import { aujourdHui, formatAr, parserMontant } from '../utils/format';
import { identifiant } from '../utils/ledger';
import { validerEcriture } from '../utils/validation';
import { Modale } from './Modale';
import { Confirmation } from './Confirmation';

interface SaisieEcritureProps {
  ecritureEnEdition: Ecriture | null;
  sensInitial: Sens;
  exercice: number;
  numeroSuivant: (sens: Sens, date: string) => string | null;
  suggestionsLibelle: string[];
  suggestionsTiers: string[];
  masques: MasqueSaisie[];
  erreurExterne?: string | null;
  onOuvrirGestionMasques: () => void;
  onEnregistrer: (ecriture: Ecriture) => boolean | Promise<boolean>;
  onFermer: () => void;
}

interface LigneBrouillon { id: string; description: string; montant: string }

/** Un poste n'est retenu que s'il porte un libellé et un montant positif. */
function posteRempli(ligne: LigneBrouillon): boolean {
  return ligne.description.trim() !== '' && (parserMontant(ligne.montant) ?? 0) > 0;
}

export function SaisieEcriture({ ecritureEnEdition: edition, sensInitial, exercice, numeroSuivant, suggestionsLibelle, suggestionsTiers, masques, erreurExterne, onOuvrirGestionMasques, onEnregistrer, onFermer }: SaisieEcritureProps) {
  const sens = edition?.sens ?? sensInitial;
  const estRecette = sens === 'RECETTE';
  const formId = useId();
  const [date, setDate] = useState(edition?.date ?? aujourdHui());
  const [libelle, setLibelle] = useState(edition?.libelle ?? '');
  const [categorie, setCategorie] = useState(edition?.categorie ?? categoriesPour(sens)[0]);
  const [tiers, setTiers] = useState(edition?.tiers ?? '');
  const [reference, setReference] = useState(edition?.reference ?? '');
  const [observation, setObservation] = useState(edition?.observation ?? '');
  const [montantSimple, setMontantSimple] = useState(edition?.lignesDetail?.length ? '' : edition ? String(edition.montant) : '');
  const [detaille, setDetaille] = useState(Boolean(edition?.lignesDetail?.length));
  const [lignes, setLignes] = useState<LigneBrouillon[]>(edition?.lignesDetail?.map(d => ({ id: d.id, description: d.libelle, montant: String(d.montant) })) ?? []);
  const [nouveauPoste, setNouveauPoste] = useState('');
  const [nouveauMontant, setNouveauMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [modifie, setModifie] = useState(false);
  const [confirmerFermeture, setConfirmerFermeture] = useState(false);
  const [masqueAConfirmer, setMasqueAConfirmer] = useState<MasqueSaisie | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const soumission = useRef(false);
  const categories = [...new Set([...categoriesPour(sens), ...(edition ? [edition.categorie] : [])])];
  const numero = edition?.numero ?? (
    /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? Number(date.slice(0, 4)) === exercice
        ? numeroSuivant(sens, date) ?? 'Attribué à l’enregistrement'
        : `Hors exercice ${exercice}`
      : 'Attribué à l’enregistrement');
  const lignesRetenues = lignes.filter(posteRempli);
  const total = detaille ? lignesRetenues.reduce((s, l) => s + (parserMontant(l.montant) ?? 0), 0) : parserMontant(montantSimple) ?? 0;
  const changer = () => setModifie(true);

  function demanderFermeture() {
    if (modifie) setConfirmerFermeture(true);
    else onFermer();
  }

  function ajouterPoste() {
    const montant = parserMontant(nouveauMontant);
    if (!nouveauPoste.trim()) { setErreur('Renseignez le libellé du poste à ajouter.'); return; }
    if (montant === null || montant <= 0) { setErreur('Le montant du poste doit être un entier supérieur à zéro, sans décimale.'); return; }
    if (lignes.length >= MAX_DETAILS) { setErreur(`Un bordereau peut contenir ${MAX_DETAILS} postes au maximum.`); return; }
    setLignes(prev => [...prev, { id: identifiant('d'), description: nouveauPoste.trim(), montant: String(montant) }]);
    setNouveauPoste(''); setNouveauMontant(''); setErreur(''); changer();
  }

  function appliquerMasque(m: MasqueSaisie) {
    setLignes(m.lignes.map(l => ({ id: identifiant('d'), description: l.description, montant: l.montantDefaut ? String(l.montantDefaut) : '' })));
    setDetaille(true); setErreur(''); changer();
  }

  function choisirMasque(id: string) {
    const m = masques.find(m => m.id === id && m.sens === sens);
    if (!m) return;
    if (lignes.length > 0 || parserMontant(montantSimple)) setMasqueAConfirmer(m);
    else appliquerMasque(m);
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (soumission.current) return;
    setErreur('');
    try {
      // Un seul poste complété suffit : les lignes vides ou incomplètes ne sont pas retenues.
      if (detaille && !lignesRetenues.length) {
        throw new Error('Renseignez au moins un poste (libellé et montant) ou choisissez « Montant unique ».');
      }
      const montant = detaille
        ? lignesRetenues.reduce((s, l) => s + parserMontant(l.montant)!, 0)
        : parserMontant(montantSimple);
      if (montant === null || montant <= 0) throw new Error('Saisissez un montant entier supérieur à zéro. Les décimales et les montants vides ne sont pas acceptés.');
      const brouillon: Ecriture = {
        id: edition?.id ?? identifiant(), numero, date, sens,
        libelle: libelle.trim(), categorie,
        tiers: tiers.trim() || undefined,
        reference: reference.trim() || undefined, observation: observation.trim() || undefined,
        montant,
        lignesDetail: detaille ? lignesRetenues.map(l => ({ id: l.id, libelle: l.description.trim(), montant: parserMontant(l.montant)! })) : undefined,
        createdAt: edition?.createdAt ?? new Date().toISOString(),
      };
      const valide = validerEcriture(brouillon);
      soumission.current = true;
      setEnregistrement(true);
      let reussi: boolean;
      try { reussi = await onEnregistrer(valide); }
      finally { setEnregistrement(false); }
      if (!reussi) {
        soumission.current = false;
        setErreur('L’écriture n’a pas été enregistrée. Votre saisie est conservée : corrigez le problème indiqué puis réessayez.');
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Saisie invalide.');
    }
  }

  const toucheAjout = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); ajouterPoste(); } };

  return (
    <>
      <Modale titre={edition ? `Modifier ${edition.numero}` : estRecette ? 'Nouvelle recette' : 'Nouvelle dépense'}
        sousTitre={`${numero} · ${estRecette ? 'Encaissement' : 'Décaissement'} en ariary (MGA)`}
        icone={estRecette ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} className="text-rose-600" />}
        enteteClass={estRecette ? 'bg-emerald-50/70' : 'bg-rose-50/70'} onFermer={demanderFermeture}
        pied={<div className="flex flex-wrap items-center justify-between gap-3"><div><span className="label">Total {estRecette ? 'recette' : 'dépense'}</span><p className={`text-2xl font-bold tabular-nums ${estRecette ? 'text-emerald-700' : 'text-rose-700'}`}>{formatAr(total)}</p></div><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={demanderFermeture}>Annuler</button><button type="submit" form={formId} className={estRecette ? 'btn-primary' : 'btn-danger'} disabled={enregistrement}><Check size={16} />{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</button></div></div>}>
        <form id={formId} onSubmit={enregistrer} className="space-y-5" onChange={changer}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor={`${formId}-date`}>Date de l’opération *</label><input id={`${formId}-date`} className="field" type="date" min={`${exercice}-01-01`} max={`${exercice}-12-31`} required value={date} onChange={e => setDate(e.target.value)} autoFocus /></div>
            <div className="flex items-end"><p className="flex h-[38px] w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-500"><span className="size-1.5 rounded-full bg-emerald-500" />Caisse en espèces — aucun autre mode n’est géré</p></div>
          </div>
          <div><label className="label" htmlFor={`${formId}-libelle`}>Libellé de l’écriture *</label><input id={`${formId}-libelle`} className="field" required maxLength={200} value={libelle} onChange={e => setLibelle(e.target.value)} list={`${formId}-libelles`} placeholder={estRecette ? 'Ex. Recettes journalières — caisse principale' : 'Ex. Achat de carburant — ambulance'} /><datalist id={`${formId}-libelles`}>{suggestionsLibelle.map(l => <option key={l} value={l} />)}</datalist></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor={`${formId}-categorie`}>Catégorie *</label><select id={`${formId}-categorie`} className="field" value={categorie} onChange={e => setCategorie(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor={`${formId}-tiers`}>{estRecette ? 'Service / déposant' : 'Bénéficiaire / fournisseur'}</label><input id={`${formId}-tiers`} className="field" maxLength={200} value={tiers} onChange={e => setTiers(e.target.value)} list={`${formId}-tiers-list`} placeholder="Nom ou service (facultatif)" /><datalist id={`${formId}-tiers-list`}>{suggestionsTiers.map(t => <option key={t} value={t} />)}</datalist></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor={`${formId}-reference`}>Référence de la pièce</label><input id={`${formId}-reference`} className="field" maxLength={200} value={reference} onChange={e => setReference(e.target.value)} placeholder="Facture, chèque, bordereau…" /></div>
            <div><label className="label" htmlFor={`${formId}-observation`}>Observation</label><input id={`${formId}-observation`} className="field" maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Information complémentaire (facultatif)" /></div>
          </div>
          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4" aria-label="Montants de l’écriture">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Montant de l’opération</h3>
              <div className="segmented" aria-label="Mode de saisie du montant"><button type="button" aria-pressed={!detaille} onClick={() => { setDetaille(false); changer(); }}>Montant unique</button><button type="button" aria-pressed={detaille} onClick={() => { setDetaille(true); changer(); }}>Détail par postes</button></div>
            </div>
            {!detaille ? <div><label className="label" htmlFor={`${formId}-montant`}>Montant total (Ar) *</label><input id={`${formId}-montant`} className="field text-right text-lg font-semibold tabular-nums" inputMode="numeric" value={montantSimple} onChange={e => setMontantSimple(e.target.value)} placeholder="0" required={!detaille} /><p className="mt-1.5 text-[11px] text-slate-500">Montant entier en ariary. Maximum : {formatAr(MONTANT_MAX)}.</p></div> : <>
              <div className="flex flex-wrap items-end gap-2"><div className="min-w-40 flex-1"><label className="label" htmlFor={`${formId}-modele`}>Modèle de bordereau</label><select id={`${formId}-modele`} className="field" value="" onChange={e => choisirMasque(e.target.value)}><option value="">Choisir un modèle…</option>{masques.filter(m => m.sens === sens).map(m => <option key={m.id} value={m.id}>{m.nom} ({m.lignes.length} postes)</option>)}</select></div><button type="button" className="btn-secondary" onClick={onOuvrirGestionMasques}><Layers size={15} />Gérer les modèles</button></div>
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_150px_auto]">
                <div><label className="label" htmlFor={`${formId}-poste`}>Poste</label><input id={`${formId}-poste`} className="field" maxLength={200} value={nouveauPoste} onChange={e => setNouveauPoste(e.target.value)} onKeyDown={toucheAjout} placeholder="Consultation…" /></div>
                <div><label className="label" htmlFor={`${formId}-mnt-poste`}>Montant (Ar)</label><input id={`${formId}-mnt-poste`} className="field text-right tabular-nums" inputMode="numeric" value={nouveauMontant} onChange={e => setNouveauMontant(e.target.value)} onKeyDown={toucheAjout} placeholder="0" /></div>
                <button type="button" className="btn-secondary self-end" onClick={ajouterPoste}><Plus size={16} /><span className="sm:sr-only xl:not-sr-only">Ajouter</span></button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[420px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">Poste *</th><th className="p-2 text-right">Montant (Ar) *</th><th className="w-10"><span className="sr-only">Actions</span></th></tr></thead><tbody>
                  {!lignes.length && <tr><td colSpan={3} className="p-6 text-center text-slate-500"><ListPlus className="mx-auto mb-2 text-slate-300" size={24} />Ajoutez un poste ou appliquez un modèle.</td></tr>}
                  {lignes.map((l, i) => <tr key={l.id} className="border-t border-slate-100"><td className="p-1.5"><input className="field min-w-36" aria-label={`Libellé du poste ${i + 1}`} maxLength={200} value={l.description} onChange={e => { setLignes(prev => prev.map(x => x.id === l.id ? { ...x, description: e.target.value } : x)); changer(); }} /></td><td className="p-1.5"><input className="field w-32 text-right tabular-nums" aria-label={`Montant du poste ${i + 1}`} inputMode="numeric" value={l.montant} placeholder="0" onChange={e => { setLignes(prev => prev.map(x => x.id === l.id ? { ...x, montant: e.target.value } : x)); changer(); }} /></td><td className="p-1.5"><button type="button" className="icon-button hover:text-rose-600" aria-label={`Supprimer le poste ${i + 1}`} onClick={() => { setLignes(prev => prev.filter(x => x.id !== l.id)); changer(); }}><Trash2 size={15} /></button></td></tr>)}
                </tbody></table>
              </div>
              <p className="text-[11px] text-slate-500">Le total est calculé automatiquement sur les postes complétés. Un seul poste suffit pour enregistrer ; les lignes laissées vides sont ignorées.</p>
            </>}
          </section>
          {Number(date.slice(0, 4)) !== exercice && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><AlertCircle size={17} className="shrink-0" /><p>Cette date n’appartient pas à l’exercice {exercice} ouvert. Les écritures doivent toutes être rattachées à l’année en cours de clôture.</p></div>}
          {(erreur || erreurExterne) && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800"><AlertCircle size={17} className="shrink-0" /><div>{erreur && <p>{erreur}</p>}{erreurExterne && <p className="mt-1">{erreurExterne}</p>}</div></div>}
          <p className="text-[11px] text-slate-500">* Champs obligatoires. {edition ? 'Le numéro et la date de création d’origine sont conservés.' : 'Le numéro définitif est attribué au moment de l’enregistrement.'}</p>
        </form>
      </Modale>
      {confirmerFermeture && <Confirmation titre="Abandonner la saisie ?" onAnnuler={() => setConfirmerFermeture(false)} onConfirmer={onFermer} libelleConfirmer="Abandonner les modifications"><p>Les modifications de ce formulaire ne sont pas encore enregistrées. Voulez-vous les abandonner ?</p></Confirmation>}
      {masqueAConfirmer && <Confirmation titre="Remplacer les montants ?" onAnnuler={() => setMasqueAConfirmer(null)} onConfirmer={() => { appliquerMasque(masqueAConfirmer); setMasqueAConfirmer(null); }} libelleConfirmer="Appliquer le modèle"><p>Le modèle « {masqueAConfirmer.nom} » remplacera les postes et le montant unique actuellement saisis. Les autres informations sont conservées.</p></Confirmation>}
    </>
  );
}
