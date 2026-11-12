import { useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ActionVirement } from '../utils/api';
import { identifiant } from '../utils/ledger';
import type { CompteVirement, RegistreVirements } from '../utils/virements';
import { Modale } from './Modale';

/**
 * Comptes bancaires et RIB de la caisse, réglés depuis Administration.
 *
 * Chaque compte porte l'identité imprimée sur l'ordre de virement remis à la
 * banque : banque, numéro de compte, code banque du RIB, titulaire et adresse
 * du donneur d'ordre. Un numéro peut rester vide et être complété plus tard,
 * mais la banque doit alors le recevoir écrit à la main.
 *
 * La suppression est refusée dès qu'un virement s'appuie sur le compte : sans
 * lui, les ordres déjà émis et leurs réimpressions perdraient leur RIB.
 */

interface Props {
  registre: RegistreVirements;
  onMutation: (action: ActionVirement) => Promise<boolean>;
  erreurExterne: string | null;
}

type Formulaire = { banque: string; numeroCompte: string; titulaire: string; adresse: string; codeBanque: string };

const formulaireVide = (): Formulaire => ({ banque: '', numeroCompte: '', titulaire: '', adresse: '', codeBanque: '' });

/** Numéro lisible : les groupes du RIB sont séparés à l'impression comme à l'écran. */
export const libelleCompte = (compte: CompteVirement): string =>
  `${compte.banque} — ${compte.numeroCompte || 'numéro non renseigné'}`;

export function GestionComptesBancaires({ registre, onMutation, erreurExterne }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [edite, setEdite] = useState<CompteVirement | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide());
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [aSupprimer, setASupprimer] = useState<CompteVirement | null>(null);

  const nomsBniManquants = ['BNI/C', 'BNI/D'].filter(nom => !registre.comptes.some(c => c.banque.toLocaleUpperCase('fr') === nom));

  function ouvrir(compte?: CompteVirement) {
    setEdite(compte ?? null);
    setFormulaire(compte
      ? {
        banque: compte.banque, numeroCompte: compte.numeroCompte,
        titulaire: compte.titulaire ?? '', adresse: compte.adresse ?? '', codeBanque: compte.codeBanque ?? '',
      }
      : formulaireVide());
    setErreur('');
    setOuvert(true);
  }

  function champ<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) {
    setFormulaire(f => ({ ...f, [cle]: valeur }));
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    if (occupe) return;
    if (!formulaire.banque.trim()) { setErreur('Renseignez le nom de la banque ou du compte.'); return; }
    if (formulaire.codeBanque.trim() && !/^\d{5}$/.test(formulaire.codeBanque.trim())) {
      setErreur('Le code banque du RIB comporte cinq chiffres.');
      return;
    }
    setOccupe(true); setErreur('');
    try {
      const compte: CompteVirement = {
        id: edite?.id ?? identifiant('banque'),
        banque: formulaire.banque.trim(),
        numeroCompte: formulaire.numeroCompte.trim(),
        ...(formulaire.titulaire.trim() ? { titulaire: formulaire.titulaire.trim() } : {}),
        ...(formulaire.adresse.trim() ? { adresse: formulaire.adresse.trim() } : {}),
        ...(formulaire.codeBanque.trim() ? { codeBanque: formulaire.codeBanque.trim() } : {}),
      };
      const action: ActionVirement = edite ? { operation: 'modifier_compte', compte } : { operation: 'ajouter_compte', compte };
      if (await onMutation(action)) {
        setOuvert(false); setEdite(null); setFormulaire(formulaireVide());
        setConfirmation(edite ? `Compte ${compte.banque} modifié.` : `Compte ${compte.banque} ajouté.`);
      } else setErreur('Compte non enregistré. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Compte non enregistré.');
    } finally { setOccupe(false); }
  }

  async function preparerComptesBni() {
    if (occupe || !nomsBniManquants.length) return;
    setOccupe(true); setErreur('');
    try {
      const nouveaux = nomsBniManquants.map(banque => ({ id: identifiant('banque'), banque, numeroCompte: '' }));
      if (await onMutation({ operation: 'ajouter_comptes', comptes: nouveaux })) setConfirmation(`Compte(s) ${nouveaux.map(c => c.banque).join(' et ')} préparé(s), à compléter par leur RIB.`);
      else setErreur('Comptes non enregistrés. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Comptes non enregistrés.');
    } finally { setOccupe(false); }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    const compte = aSupprimer;
    setOccupe(true); setErreur('');
    try {
      if (await onMutation({ operation: 'supprimer_compte', compteId: compte.id })) {
        setASupprimer(null);
        setConfirmation(`Compte ${compte.banque} supprimé.`);
      } else setErreur('Compte non supprimé. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Compte non supprimé.');
    } finally { setOccupe(false); }
  }

  const virementsDuCompte = (compte: CompteVirement) => registre.ecritures.filter(v => v.compteId === compte.id).length;
  const complet = (compte: CompteVirement) => Boolean(compte.numeroCompte.trim());

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Landmark size={17} className="text-brand-700 dark:text-brand-300" />Comptes bancaires et RIB</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Le RIB des comptes de l’hôpital est imprimé sur chaque ordre de virement remis à la banque.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {nomsBniManquants.length > 0 && <button type="button" className="btn-secondary" disabled={occupe} onClick={() => void preparerComptesBni()}><Plus size={15} />Préparer BNI/C et BNI/D</button>}
        <button type="button" className="btn-primary" onClick={() => ouvrir()}><Plus size={15} />Ajouter un compte</button>
      </div>
    </div>

    {(erreur || erreurExterne) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur || erreurExterne}
    </p>}
    {confirmation && !erreur && !erreurExterne && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      <Check size={15} className="shrink-0" />{confirmation}
      <button type="button" className="ml-auto hover:underline" onClick={() => setConfirmation('')}>Fermer</button>
    </p>}

    {registre.comptes.length === 0
      ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">Aucun compte bancaire. Ajoutez celui de l’hôpital pour saisir des virements.</p>
      : <ul className="space-y-2">{registre.comptes.map(compte => <li key={compte.id}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {libelleCompte(compte)}
            {!complet(compte) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">RIB à compléter</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {compte.codeBanque ? `Code banque ${compte.codeBanque}` : 'Code banque non renseigné'}
            {compte.titulaire ? ` · ${compte.titulaire}` : ''}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {virementsDuCompte(compte)} virement(s) rattaché(s)
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="icon-button" title="Modifier le compte et son RIB" aria-label={`Modifier le compte ${compte.banque}`} onClick={() => ouvrir(compte)}><Pencil size={15} /></button>
          <button
            type="button"
            className="icon-button disabled:opacity-40"
            title={virementsDuCompte(compte) > 0 ? 'Ce compte porte des virements : il ne peut pas être supprimé.' : 'Supprimer le compte'}
            aria-label={`Supprimer le compte ${compte.banque}`}
            disabled={virementsDuCompte(compte) > 0}
            onClick={() => { setASupprimer(compte); setErreur(''); }}
          ><Trash2 size={15} /></button>
        </div>
      </li>)}</ul>}

    {ouvert && <Modale titre={edite ? `Modifier le compte ${edite.banque}` : 'Ajouter un compte bancaire'} onFermer={() => { if (!occupe) { setOuvert(false); setErreur(''); } }}>
      <form className="space-y-3" onSubmit={e => void enregistrer(e)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Banque<input className="field" required maxLength={120} value={formulaire.banque} onChange={e => champ('banque', e.target.value)} /></label>
          <label className="label">Numéro de compte / RIB<input className="field" maxLength={120} value={formulaire.numeroCompte} onChange={e => champ('numeroCompte', e.target.value)} placeholder="00005 12345678901" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Titulaire du compte (donneur d’ordre)<input className="field" maxLength={200} value={formulaire.titulaire} onChange={e => champ('titulaire', e.target.value)} placeholder="SALFA — Hôpital Loterana Toliary Tanambao" /></label>
          <label className="label">Adresse du titulaire<input className="field" maxLength={200} value={formulaire.adresse} onChange={e => champ('adresse', e.target.value)} placeholder="BP 99 — Toliara" /></label>
        </div>
        <label className="label">Code banque du RIB (5 chiffres)<input className="field" inputMode="numeric" maxLength={5} value={formulaire.codeBanque} onChange={e => champ('codeBanque', e.target.value.replace(/\D/g, ''))} placeholder="00005" /></label>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Le numéro peut être renseigné plus tard : l’ordre de virement imprimé garde alors une ligne vide à compléter à la main. Titulaire, adresse et code banque figurent sur l’ordre remis à la banque.</p>
        {erreur && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={occupe} onClick={() => setOuvert(false)}>Annuler</button>
          <button className="btn-primary" disabled={occupe}>{edite ? 'Enregistrer les modifications' : 'Ajouter le compte'}</button>
        </div>
      </form>
    </Modale>}

    {aSupprimer && <Modale titre={`Supprimer le compte ${aSupprimer.banque} ?`} onFermer={() => { if (!occupe) setASupprimer(null); }} largeur="petite">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Ce compte n’a aucun virement : le supprimer ne modifie ni le livre de caisse ni les ordres déjà imprimés.</p>
        <p className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">{libelleCompte(aSupprimer)}</p>
        {erreur && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={occupe} onClick={() => setASupprimer(null)}>Annuler</button>
          <button type="button" className="btn-danger" disabled={occupe} onClick={() => void supprimer()}>Supprimer le compte</button>
        </div>
      </div>
    </Modale>}
  </div>;
}
