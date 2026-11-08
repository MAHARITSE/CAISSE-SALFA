import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Layers, Plus, Trash2, AlertCircle, ListPlus } from 'lucide-react';
import type { Categories, Ecriture, MasqueSaisie, Sens } from '../types';
import { MAX_DETAILS, MONTANT_MAX } from '../utils/constants';
import { aujourdHui, formatAr, masqueMajuscules, parserMontant } from '../utils/format';
import { ChampMontant } from './ChampMontant';
import { identifiant } from '../utils/ledger';
import { validerEcriture } from '../utils/validation';
import { Modale } from './Modale';
import { Confirmation } from './Confirmation';

interface SaisieEcritureProps {
  ecritureEnEdition: Ecriture | null;
  sensInitial: Sens;
  exercice: number;
  numeroSuivant: (sens: Sens, date: string) => string | null;
  suggestionsTiers: string[];
  masques: MasqueSaisie[];
  /** Catégories gérées dans le livre, distinctes par sens. */
  categories: Categories;
  onOuvrirGestionCategories: () => void;
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

export function SaisieEcriture({ ecritureEnEdition: edition, sensInitial, exercice, numeroSuivant, suggestionsTiers, masques, categories: categoriesDuLivre, onOuvrirGestionCategories, erreurExterne, onOuvrirGestionMasques, onEnregistrer, onFermer }: SaisieEcritureProps) {
  const sens = edition?.sens ?? sensInitial;
  const estRecette = sens === 'RECETTE';
  const formId = useId();
  const [date, setDate] = useState(edition?.date ?? aujourdHui());
  const [libelle, setLibelle] = useState(edition?.libelle ?? '');
  const categoriesPourSens = sens === 'RECETTE' ? categoriesDuLivre.recette : categoriesDuLivre.depense;
  const [categorie, setCategorie] = useState(edition?.categorie ?? categoriesPourSens[0] ?? '');
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
  const compositionEnCours = useRef(false);
  const libelleRef = useRef<HTMLInputElement>(null);
  const posteRef = useRef<HTMLInputElement>(null);
  const erreurRef = useRef<HTMLDivElement>(null);
  const masquesPourSens = masques.filter(m => m.sens === sens);

  // Un message d'erreur vit en bas d'un formulaire long : on l'amène sous les yeux.
  useEffect(() => {
    const bloc = erreurRef.current;
    if (!erreur || !bloc || typeof bloc.scrollIntoView !== 'function') return;
    bloc.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [erreur]);

  // Positionne immédiatement le curseur à la fin du champ libellé pour continuer la saisie sans clic.
  function positionnerCurseurFinLibelle(texte?: string) {
    requestAnimationFrame(() => {
      const el = libelleRef.current;
      if (!el) return;
      el.focus();
      const pos = texte !== undefined ? texte.length : el.value.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Une écriture éditée garde sa catégorie d'origine, même retirée de la liste.
  const categories = [...new Set([...categoriesPourSens, ...(edition ? [edition.categorie] : [])])];
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
    setLignes(prev => [...prev, { id: identifiant('d'), description: masqueMajuscules(nouveauPoste.trim()), montant: String(montant) }]);
    setNouveauPoste(''); setNouveauMontant(''); setErreur(''); changer();
    posteRef.current?.focus();
  }

  function appliquerMasque(m: MasqueSaisie) {
    setLignes(m.lignes.map(l => ({ id: identifiant('d'), description: masqueMajuscules(l.description), montant: l.montantDefaut ? String(l.montantDefaut) : '' })));
    setDetaille(true);
    setErreur('');
    changer();

    // Rattaché au modèle : libellé prérempli et reprise de saisie directement à la fin du champ
    const libelleAAppliquer = m.libelle ? masqueMajuscules(m.libelle) : (libelle.trim() ? libelle : masqueMajuscules(m.nom));
    setLibelle(libelleAAppliquer);
    positionnerCurseurFinLibelle(libelleAAppliquer);
  }

  function choisirMasque(id: string) {
    const m = masques.find(m => m.id === id && m.sens === sens);
    if (!m) return;
    if (lignes.length > 0 || parserMontant(montantSimple)) setMasqueAConfirmer(m);
    else appliquerMasque(m);
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (soumission.current || compositionEnCours.current) return;
    setErreur('');
    try {
      // Ne jamais perdre un poste encore présent dans la zone d'ajout.
      if (detaille && (nouveauPoste.trim() || nouveauMontant.trim())) {
        throw new Error('Ajoutez le poste en cours avec « Ajouter » ou Entrée, ou videz ses champs avant d’enregistrer.');
      }
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
        libelle: masqueMajuscules(libelle.trim()), categorie,
        tiers: tiers.trim() || undefined,
        reference: reference.trim() || undefined, observation: observation.trim() || undefined,
        montant,
        lignesDetail: detaille ? lignesRetenues.map(l => ({ id: l.id, libelle: masqueMajuscules(l.description.trim()), montant: parserMontant(l.montant)! })) : undefined,
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
      soumission.current = false;
      setErreur(e instanceof Error ? e.message : 'Saisie invalide.');
    }
  }

  const toucheAjout = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Dans les deux champs d'ajout, Entrée valide le poste, pas le formulaire.
    // La composition IME et l'activation normale du bouton restent intactes.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || compositionEnCours.current || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (!e.repeat) ajouterPoste();
  };

  return (
    <>
      <Modale titre={edition ? `Modifier ${edition.numero}` : estRecette ? 'Nouvelle recette' : 'Nouvelle dépense'}
        sousTitre={`${numero} · ${estRecette ? 'Encaissement' : 'Décaissement'} en ariary (MGA)`}
        icone={estRecette ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} className="text-rose-600 dark:text-rose-400" />}
        enteteClass={estRecette ? 'bg-emerald-50/70' : 'bg-rose-50/70'} onFermer={demanderFermeture}
        pied={<div className="flex flex-wrap items-center justify-between gap-3"><div><span className="label">Total {estRecette ? 'recette' : 'dépense'}</span><p aria-live="polite" className={`text-2xl font-bold tabular-nums ${estRecette ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatAr(total)}</p></div><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={demanderFermeture}>Annuler</button><button type="submit" form={formId} className={estRecette ? 'btn-primary' : 'btn-danger'} disabled={enregistrement}><Check size={16} />{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</button></div></div>}>
        <form id={formId} onSubmit={enregistrer} className="space-y-5" onChange={changer}
          onCompositionStart={() => { compositionEnCours.current = true; }}
          onCompositionEnd={() => { compositionEnCours.current = false; }}>
          {/* Choix de modèle en haut du formulaire avec reprise de saisie directe */}
          {masquesPourSens.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 dark:border-brand-900/60 dark:bg-brand-950/40">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-xs dark:bg-brand-600">
                  <Layers size={18} />
                </span>
                <div>
                  <label htmlFor={`${formId}-modele-rapide`} className="text-xs font-bold text-slate-800 dark:text-slate-100 sm:text-sm">
                    Modèle de saisie
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Préremplit les postes et le libellé avec curseur direct à la fin du champ
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id={`${formId}-modele-rapide`}
                  className="field !w-auto min-w-44 !py-1.5 !text-xs font-semibold sm:!text-sm"
                  aria-label="Choisir un modèle de saisie"
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      choisirMasque(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Choisir un modèle…</option>
                  {masquesPourSens.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nom} ({m.lignes.length} postes){m.libelle ? ` — ${m.libelle}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !text-xs sm:!text-sm"
                  onClick={onOuvrirGestionMasques}
                  title="Gérer les modèles de saisie"
                >
                  <Layers size={14} />
                  Gérer les modèles
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor={`${formId}-date`}>Date de l’opération *</label><input id={`${formId}-date`} className="field" type="date" min={`${exercice}-01-01`} max={`${exercice}-12-31`} required value={date} onChange={e => setDate(e.target.value)} autoFocus /></div>
            <div className="flex items-end"><p className="flex min-h-[42px] w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 sm:text-[13px] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"><span className="size-2 shrink-0 rounded-full bg-emerald-500" />Caisse en espèces — aucun autre mode n’est géré</p></div>
          </div>
          <div><label className="label" htmlFor={`${formId}-libelle`}>Libellé de l’écriture *</label><input ref={libelleRef} id={`${formId}-libelle`} className="field saisie-majuscules" required maxLength={200} value={libelle} onChange={e => setLibelle(e.target.value)} autoComplete="off" placeholder={estRecette ? 'Ex. RECETTES JOURNALIERES — CAISSE PRINCIPALE' : 'Ex. ACHAT DE CARBURANT — AMBULANCE'} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="flex items-end justify-between gap-2"><label className="label" htmlFor={`${formId}-categorie`}>Catégorie *</label><button type="button" className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline sm:text-sm" onClick={onOuvrirGestionCategories}>Gérer</button></div><select id={`${formId}-categorie`} className="field" value={categorie} onChange={e => setCategorie(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor={`${formId}-tiers`}>{estRecette ? 'Service / déposant' : 'Bénéficiaire / fournisseur'}</label><input id={`${formId}-tiers`} className="field" maxLength={200} value={tiers} onChange={e => setTiers(e.target.value)} list={`${formId}-tiers-list`} placeholder="Nom ou service (facultatif)" /><datalist id={`${formId}-tiers-list`}>{suggestionsTiers.map(t => <option key={t} value={t} />)}</datalist></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor={`${formId}-reference`}>Référence de la pièce</label><input id={`${formId}-reference`} className="field" maxLength={200} value={reference} onChange={e => setReference(e.target.value)} placeholder="Facture, chèque, bordereau…" /></div>
            <div><label className="label" htmlFor={`${formId}-observation`}>Observation</label><input id={`${formId}-observation`} className="field" maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Information complémentaire (facultatif)" /></div>
          </div>
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 p-4 space-y-4" aria-label="Montants de l’écriture">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Montant de l’opération</h3>
              <div className="segmented" aria-label="Mode de saisie du montant"><button type="button" aria-pressed={!detaille} onClick={() => { setDetaille(false); changer(); }}>Montant unique</button><button type="button" aria-pressed={detaille} onClick={() => { setDetaille(true); changer(); }}>Détail par postes</button></div>
            </div>
            {!detaille ? <div><ChampMontant id={`${formId}-montant`} label="Montant total (Ar) *" className="text-xl font-bold" valeur={montantSimple} onChange={setMontantSimple} placeholder="0" obligatoire aide={`Montant entier en ariary, séparé par milliers. Maximum : ${formatAr(MONTANT_MAX)}.`} /></div> : <>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Un modèle de saisie, choisi en haut du formulaire, remplit les postes d’un seul geste.</p><button type="button" className="btn-secondary" onClick={onOuvrirGestionMasques}><Layers size={16} />Gérer les modèles</button></div>
              <div className="grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:grid-cols-[1fr_150px_auto]" onKeyDown={toucheAjout}>
                <div><label className="label" htmlFor={`${formId}-poste`}>Poste</label><input ref={posteRef} id={`${formId}-poste`} className="field saisie-majuscules" maxLength={200} value={nouveauPoste} onChange={e => setNouveauPoste(e.target.value)} placeholder="Consultation…" /></div>
                <div><ChampMontant id={`${formId}-mnt-poste`} label="Montant (Ar)" valeur={nouveauMontant} onChange={setNouveauMontant} placeholder="0" /></div>
                <button type="button" className="btn-secondary self-end" onClick={ajouterPoste}><Plus size={16} /><span className="sm:sr-only xl:not-sr-only">Ajouter</span></button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Appuyez sur Entrée ou sur Ajouter pour ajouter le poste. Montants en ariary.</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full min-w-[420px] text-sm"><thead className="bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"><tr><th className="p-2 text-left">Poste *</th><th className="p-2 text-right">Montant *</th><th className="w-10"><span className="sr-only">Actions</span></th></tr></thead><tbody>
                  {!lignes.length && <tr><td colSpan={3} className="p-6 text-center text-sm text-slate-500 dark:text-slate-400"><ListPlus className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={26} />Ajoutez un poste ou appliquez un modèle.</td></tr>}
                  {lignes.map((l, i) => <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-1.5"><input className="field saisie-majuscules min-w-36" aria-label={`Libellé du poste ${i + 1}`} maxLength={200} value={l.description} onChange={e => { setLignes(prev => prev.map(x => x.id === l.id ? { ...x, description: e.target.value } : x)); changer(); }} /></td><td className="p-1.5"><ChampMontant label="" etiquetteSeule={`Montant du poste ${i + 1}`} id={`${formId}-mnt-${l.id}`} className="w-32" valeur={l.montant} placeholder="0" onChange={valeur => { setLignes(prev => prev.map(x => x.id === l.id ? { ...x, montant: valeur } : x)); changer(); }} /></td><td className="p-1.5"><button type="button" tabIndex={-1} className="icon-button hover:text-rose-600" aria-label={`Supprimer le poste ${i + 1}`} title={`Supprimer le poste ${i + 1}`} onClick={() => { setLignes(prev => prev.filter(x => x.id !== l.id)); changer(); }}><Trash2 size={16} /></button></td></tr>)}
                </tbody></table>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Le total est calculé automatiquement sur les postes complétés. Un seul poste suffit pour enregistrer ; les lignes laissées vides sont ignorées.</p>
            </>}
          </section>
          {Number(date.slice(0, 4)) !== exercice && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"><AlertCircle size={17} className="shrink-0" /><p>Cette date n’appartient pas à l’exercice {exercice} ouvert. Les écritures doivent toutes être rattachées à l’année en cours de clôture.</p></div>}
          {(erreur || erreurExterne) && <div ref={erreurRef} role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs leading-relaxed text-rose-800 dark:text-rose-300"><AlertCircle size={17} className="shrink-0" /><div>{erreur && <p>{erreur}</p>}{erreurExterne && <p className="mt-1">{erreurExterne}</p>}</div></div>}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">* Champs obligatoires. {edition ? 'Le numéro et la date de création d’origine sont conservés.' : 'Le numéro définitif est attribué au moment de l’enregistrement.'}</p>
        </form>
      </Modale>
      {confirmerFermeture && <Confirmation titre="Abandonner la saisie ?" onAnnuler={() => setConfirmerFermeture(false)} onConfirmer={onFermer} libelleConfirmer="Abandonner les modifications"><p>Les modifications de ce formulaire ne sont pas encore enregistrées. Voulez-vous les abandonner ?</p></Confirmation>}
      {masqueAConfirmer && <Confirmation titre="Remplacer les montants ?" onAnnuler={() => setMasqueAConfirmer(null)} onConfirmer={() => { appliquerMasque(masqueAConfirmer); setMasqueAConfirmer(null); }} libelleConfirmer="Appliquer le modèle"><p>Le modèle « {masqueAConfirmer.nom} » remplacera les postes et le montant unique actuellement saisis. Les autres informations sont conservées.</p></Confirmation>}
    </>
  );
}
