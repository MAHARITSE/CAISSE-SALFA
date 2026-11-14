import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Building2, Check, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import type { ActionVirement } from '../utils/api';
import { identifiant } from '../utils/ledger';
import { libelleTiers, ribComplet, type RegistreVirements, type Tiers } from '../utils/virements';
import { ChampCompteBancaire, formaterCompteBancaire } from './ChampCompteBancaire';
import { Modale } from './Modale';

/**
 * Clients (recettes) et fournisseurs (DED), réglés depuis le livre des virements.
 *
 * Chaque fiche porte ce que l'ordre de virement imprimé doit montrer : le nom,
 * l'adresse et, pour un fournisseur, l'établissement bancaire et son compte ou
 * RIB. Un fournisseur sans RIB est refusé dès la saisie : l'ordre partirait
 * incomplet et la banque ne saurait pas où créditer l'argent.
 *
 * Une fiche déjà utilisée par un virement ne se supprime pas : les pièces
 * émises portent son nom et son RIB, elles doivent rester lisibles. On la
 * corrige à la place.
 */

interface Props {
  registre: RegistreVirements;
  onMutation: (action: ActionVirement) => Promise<boolean>;
  erreurExterne: string | null;
}

type Formulaire = {
  type: Tiers['type']; nom: string; telephone: string; adresse: string; banque: string; numeroCompte: string;
};

const formulaireVide = (type: Tiers['type']): Formulaire =>
  ({ type, nom: '', telephone: '', adresse: '', banque: '', numeroCompte: '' });

export function GestionTiersVirements({ registre, onMutation, erreurExterne }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [edite, setEdite] = useState<Tiers | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide('FOURNISSEUR'));
  const [erreurChamp, setErreurChamp] = useState('');
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Tiers | null>(null);

  /** Un virement par fiche : c'est ce qui interdit de la retirer. */
  const virementsParFiche = useMemo(() => {
    const compte = new Map<string, number>();
    for (const v of registre.ecritures) if (v.tiersId) compte.set(v.tiersId, (compte.get(v.tiersId) ?? 0) + 1);
    return compte;
  }, [registre.ecritures]);

  const clients = registre.tiers.filter(t => t.type === 'CLIENT');
  const fournisseurs = registre.tiers.filter(t => t.type === 'FOURNISSEUR');

  function ouvrir(fiche?: Tiers, type: Tiers['type'] = 'FOURNISSEUR') {
    setEdite(fiche ?? null);
    setFormulaire(fiche
      ? {
        type: fiche.type, nom: fiche.nom, telephone: fiche.telephone,
        adresse: fiche.adresse, banque: fiche.banque, numeroCompte: formaterCompteBancaire(fiche.numeroCompte),
      }
      : formulaireVide(type));
    setErreurChamp(''); setErreur('');
    setOuvert(true);
  }

  function champ<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setFormulaire(f => ({ ...f, [cle]: valeur }));
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    if (occupe) return;
    const fiche: Tiers = {
      id: edite?.id ?? identifiant('tiers'),
      type: formulaire.type,
      nom: formulaire.nom.trim(),
      telephone: formulaire.telephone.trim(),
      adresse: formulaire.adresse.trim(),
      banque: formulaire.banque.trim(),
      numeroCompte: formulaire.numeroCompte.trim(),
    };
    if (!fiche.nom) { setErreurChamp('Renseignez le nom du client ou du fournisseur.'); return; }
    if (fiche.type === 'FOURNISSEUR' && !ribComplet(fiche)) {
      setErreurChamp('Renseignez le RIB du fournisseur : établissement bancaire et compte. Il s’imprime sur l’ordre de virement.');
      return;
    }
    setOccupe(true); setErreurChamp(''); setErreur('');
    try {
      const action: ActionVirement = edite ? { operation: 'modifier_tiers', tiers: fiche } : { operation: 'ajouter_tiers', tiers: fiche };
      if (await onMutation(action)) {
        setOuvert(false); setEdite(null);
        setConfirmation(edite ? `Fiche « ${fiche.nom} » modifiée.` : `Fiche « ${fiche.nom} » ajoutée.`);
      } else setErreurChamp('Fiche non enregistrée. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreurChamp(e instanceof Error ? e.message : 'Fiche non enregistrée.');
    } finally { setOccupe(false); }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    const fiche = aSupprimer;
    setOccupe(true); setErreur('');
    try {
      if (await onMutation({ operation: 'supprimer_tiers', tiersId: fiche.id })) {
        setASupprimer(null);
        setConfirmation(`Fiche « ${fiche.nom} » supprimée.`);
      } else setErreur('Fiche non supprimée. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Fiche non supprimée.');
    } finally { setOccupe(false); }
  }

  const liste = (titre: string, fiches: Tiers[], type: Tiers['type'], icone: ReactNode) => <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">{icone}{titre}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{fiches.length}</span>
      </h3>
      <button type="button" className="btn-secondary" onClick={() => ouvrir(undefined, type)}><Plus size={15} />{type === 'CLIENT' ? 'Ajouter un client' : 'Ajouter un fournisseur'}</button>
    </div>
    {fiches.length === 0
      ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {type === 'CLIENT'
          ? 'Aucun client : une recette par virement se reçoit toujours d’un client enregistré.'
          : 'Aucun fournisseur : une DED par virement se paie toujours à un fournisseur enregistré, RIB compris.'}
      </p>
      : <ul className="space-y-2">{fiches.map(fiche => {
        const utilisations = virementsParFiche.get(fiche.id) ?? 0;
        return <li key={fiche.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {fiche.nom}
              {fiche.type === 'FOURNISSEUR' && !ribComplet(fiche) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">RIB à compléter</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {[fiche.telephone, fiche.adresse].filter(Boolean).join(' · ') || 'Ni téléphone ni adresse'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {fiche.type === 'FOURNISSEUR'
                ? (ribComplet(fiche) ? `RIB : ${fiche.banque} — ${formaterCompteBancaire(fiche.numeroCompte)}` : 'RIB non renseigné')
                : 'Client : aucune coordonnée bancaire nécessaire'}
              {' · '}{utilisations} virement(s)
            </p>
          </div>
          <div className="flex gap-1">
            <button type="button" className="icon-button" title="Modifier la fiche" aria-label={`Modifier ${fiche.nom}`} onClick={() => ouvrir(fiche)}><Pencil size={15} /></button>
            <button
              type="button"
              className="icon-button disabled:opacity-40"
              title={utilisations > 0 ? 'Cette fiche porte des virements : elle ne peut pas être supprimée.' : 'Supprimer la fiche'}
              aria-label={`Supprimer ${fiche.nom}`}
              disabled={utilisations > 0}
              onClick={() => { setASupprimer(fiche); setErreur(''); }}
            ><Trash2 size={15} /></button>
          </div>
        </li>;
      })}</ul>}
  </div>;

  return <div className="space-y-4">
    <div>
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><UserRound size={17} className="text-brand-700 dark:text-brand-300" />Clients et fournisseurs</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Le bénéficiaire d’un virement vient de ces fiches : un client pour une recette, un fournisseur pour une DED.
        Le RIB du fournisseur est obligatoire, car il s’imprime sur l’ordre de virement remis à la banque.
      </p>
    </div>

    {(erreur || erreurExterne) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur || erreurExterne}
    </p>}
    {confirmation && !erreur && !erreurExterne && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      <Check size={15} className="shrink-0" />{confirmation}
      <button type="button" className="ml-auto hover:underline" onClick={() => setConfirmation('')}>Fermer</button>
    </p>}

    <div className="grid gap-4 lg:grid-cols-2">
      {liste('Fournisseurs — DED', fournisseurs, 'FOURNISSEUR', <Building2 size={15} className="text-brand-700 dark:text-brand-300" />)}
      {liste('Clients — recettes', clients, 'CLIENT', <UserRound size={15} className="text-brand-700 dark:text-brand-300" />)}
    </div>

    {ouvert && <Modale titre={edite ? `Modifier la fiche ${edite.nom}` : formulaire.type === 'CLIENT' ? 'Ajouter un client' : 'Ajouter un fournisseur'} onFermer={() => { if (!occupe) { setOuvert(false); setErreurChamp(''); } }}>
      <form className="space-y-3" onSubmit={e => void enregistrer(e)}>
        <label className="label">Fiche<select className="field" value={formulaire.type} onChange={e => champ('type', e.target.value as Tiers['type'])}>
          <option value="FOURNISSEUR">Fournisseur (DED)</option>
          <option value="CLIENT">Client (recette)</option>
        </select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Nom<input className="field" required maxLength={200} value={formulaire.nom} onChange={e => champ('nom', e.target.value)} /></label>
          <label className="label">Téléphone<input className="field" maxLength={40} value={formulaire.telephone} onChange={e => champ('telephone', e.target.value)} /></label>
        </div>
        <label className="label">Adresse<input className="field" maxLength={200} value={formulaire.adresse} onChange={e => champ('adresse', e.target.value)} placeholder="Lot II M 45 — Antananarivo" /></label>
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">RIB {formulaire.type === 'FOURNISSEUR' ? '(obligatoire)' : '(facultatif)'}</legend>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Ces mentions sont imprimées sur l’ordre de virement remis à la banque.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Établissement bancaire<input className="field" maxLength={120} value={formulaire.banque} onChange={e => champ('banque', e.target.value)} placeholder="BNI, BOA, CCP…" /></label>
            <div><ChampCompteBancaire label="Compte ou RIB" valeur={formulaire.numeroCompte} onChange={v => champ('numeroCompte', v)} /></div>
          </div>
        </fieldset>
        {erreurChamp && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{erreurChamp}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={occupe} onClick={() => setOuvert(false)}>Annuler</button>
          <button className="btn-primary" disabled={occupe}>{edite ? 'Enregistrer les modifications' : 'Ajouter la fiche'}</button>
        </div>
      </form>
    </Modale>}

    {aSupprimer && <Modale titre={`Supprimer la fiche ${aSupprimer.nom} ?`} onFermer={() => { if (!occupe) setASupprimer(null); }} largeur="petite">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Cette fiche n’a aucun virement : la supprimer ne modifie ni le registre bancaire ni les ordres déjà imprimés.</p>
        <p className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">{libelleTiers(aSupprimer)}</p>
        {erreur && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={occupe} onClick={() => setASupprimer(null)}>Annuler</button>
          <button type="button" className="btn-danger" disabled={occupe} onClick={() => void supprimer()}>Supprimer la fiche</button>
        </div>
      </div>
    </Modale>}
  </div>;
}
