import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpenCheck, Check, Layers, Pencil, PenLine, RotateCcw, ShieldCheck, Tags,
  Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { Modale } from './Modale';
import { Confirmation } from './Confirmation';
import { listerComptes, creerCompte, modifierCompte, supprimerCompte, LONGUEUR_MIN_MOT_DE_PASSE } from '../utils/utilisateurs';
import { ROLES, libelleRole, resumeDroits, type Compte, type Role } from '../utils/roles';

interface Props {
  /** Réglages de la caisse, ouverts depuis Administration. */
  onOuvrirModeles: () => void;
  onOuvrirCategories: () => void;
  onOuvrirEntete: () => void;
  /** Nombre de modèles, pour l'aperçu des réglages. */
  nombreModeles: number;
  /** Compte connecté : on ne se supprime pas soi-même par mégarde. */
  compteCourant?: { identifiant: string } | null;
}

type Formulaire =
  | { mode: 'creation'; identifiant: string; nomComplet: string; role: Role; motDePasse: string; actif: boolean }
  | { mode: 'edition'; id: string; identifiant: string; nomComplet: string; role: Role; motDePasse: string; actif: boolean };

const formulaireVide = (): Formulaire => ({
  mode: 'creation', identifiant: '', nomComplet: '', role: 'caissier', motDePasse: '', actif: true,
});

/**
 * Administration : qui peut faire quoi, et les réglages de la caisse.
 *
 * L'administrateur gère ici les comptes et leurs trois rôles ; les modèles de
 * saisie, les catégories et l'en-tête des bordereaux, auparavant éparpillés dans
 * le livre journal, sont désormais rangés à cet endroit.
 */
export function Administration({ onOuvrirModeles, onOuvrirCategories, onOuvrirEntete, nombreModeles, compteCourant }: Props) {
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<Compte | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  async function recharger() {
    try {
      setComptes(await listerComptes());
      setErreur('');
    } catch (e) {
      setComptes([]);
      setErreur(e instanceof Error ? e.message : 'Les comptes sont illisibles.');
    }
  }

  useEffect(() => { void recharger(); }, []);

  const parRole = useMemo(() => {
    const groupes: Record<Role, Compte[]> = { admin: [], caissier: [], comptable: [] };
    for (const compte of comptes ?? []) groupes[compte.role]?.push(compte);
    return groupes;
  }, [comptes]);

  async function enregistrer() {
    if (!formulaire) return;
    setEnCours(true);
    setErreur('');
    try {
      if (formulaire.mode === 'creation') {
        await creerCompte({
          identifiant: formulaire.identifiant,
          nomComplet: formulaire.nomComplet,
          role: formulaire.role,
          motDePasse: formulaire.motDePasse,
          actif: formulaire.actif,
        });
        setConfirmation(`Compte « ${formulaire.identifiant.trim().toLowerCase()} » créé.`);
      } else {
        await modifierCompte(formulaire.id, {
          nomComplet: formulaire.nomComplet,
          role: formulaire.role,
          actif: formulaire.actif,
          motDePasse: formulaire.motDePasse || undefined,
        });
        setConfirmation(`Compte « ${formulaire.identifiant} » mis à jour.`);
      }
      setFormulaire(null);
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’enregistrement a échoué.');
    } finally {
      setEnCours(false);
    }
  }

  const reglages = [
    { cle: 'modeles', titre: 'Modèles de saisie', detail: `${nombreModeles} modèle${nombreModeles > 1 ? 's' : ''} de bordereau`, icone: Layers, action: onOuvrirModeles },
    { cle: 'categories', titre: 'Catégories de saisie', detail: 'Recettes et dépenses, séparément', icone: Tags, action: onOuvrirCategories },
    { cle: 'entete', titre: 'En-tête des bordereaux', detail: 'Un seul en-tête pour les deux documents', icone: PenLine, action: onOuvrirEntete },
  ];

  return <div className="space-y-5">
    {erreur && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur}
    </p>}
    {confirmation && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
      <Check size={15} className="shrink-0" />{confirmation}
      <button type="button" className="ml-auto text-emerald-700 hover:underline" onClick={() => setConfirmation('')}>Fermer</button>
    </p>}

    {/* Réglages de la caisse : ils étaient dans le livre journal. */}
    <section className="card p-5" aria-label="Réglages de la caisse">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><BookOpenCheck size={17} className="text-brand-700" />Réglages de la caisse</h2>
          <p className="mt-1 text-[11px] text-slate-500">Modèles de saisie, catégories et en-tête des bordereaux : tout se règle ici.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {reglages.map(({ cle, titre, detail, icone: Icone, action }) => <button
          key={cle}
          type="button"
          onClick={action}
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-white"><Icone size={17} /></span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-800">{titre}</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{detail}</span>
          </span>
        </button>)}
      </div>
    </section>

    {/* Utilisateurs et rôles */}
    <section className="card p-5" aria-label="Utilisateurs de la caisse">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Users size={19} className="text-brand-700" />Utilisateurs</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Chaque compte ouvre exactement ce que son rôle autorise.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setErreur(''); setFormulaire(formulaireVide()); }}>
          <UserPlus size={16} />Nouvel utilisateur
        </button>
      </div>

      {/* Les trois rôles, rappelés en clair. */}
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {ROLES.map(role => <li key={role.valeur} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {role.valeur === 'admin' ? <ShieldCheck size={16} className="text-brand-700" /> : null}{role.libelle}
            </p>
            <span className="badge badge-neutral">{parRole[role.valeur].length}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-[13px]">{role.resume}</p>
          <p className="mt-1.5 text-xs uppercase tracking-wide text-slate-400">{resumeDroits(role.valeur)}</p>
        </li>)}
      </ul>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2.5 pr-3 font-semibold">Identifiant</th>
              <th className="py-2.5 pr-3 font-semibold">Nom complet</th>
              <th className="py-2.5 pr-3 font-semibold">Rôle</th>
              <th className="py-2.5 pr-3 font-semibold">Accès</th>
              <th className="py-2.5 pr-3 font-semibold">État</th>
              <th className="py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {comptes === null && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Chargement des comptes…</td></tr>}
            {comptes?.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Aucun compte enregistré.</td></tr>}
            {comptes?.map(compte => <tr key={compte.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-800 sm:text-sm">{compte.identifiant}</td>
              <td className="py-2.5 pr-3 text-slate-800">{compte.nomComplet}</td>
              <td className="py-2.5 pr-3"><span className={`badge ${compte.role === 'admin' ? 'badge-green' : 'badge-neutral'}`}>{libelleRole(compte.role)}</span></td>
              <td className="py-2.5 pr-3 text-xs text-slate-500 sm:text-sm">{resumeDroits(compte.role)}</td>
              <td className="py-2.5 pr-3">
                {compte.actif
                  ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Actif</span>
                  : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><span className="size-1.5 rounded-full bg-slate-300" />Désactivé</span>}
              </td>
              <td className="py-2.5">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Modifier ${compte.identifiant}`}
                    title="Modifier"
                    onClick={() => {
                      setErreur('');
                      setFormulaire({
                        mode: 'edition', id: compte.id, identifiant: compte.identifiant,
                        nomComplet: compte.nomComplet, role: compte.role, motDePasse: '', actif: compte.actif,
                      });
                    }}
                  ><Pencil size={14} /></button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Supprimer ${compte.identifiant}`}
                    title={compteCourant?.identifiant === compte.identifiant ? 'Impossible : c’est votre compte' : 'Supprimer'}
                    disabled={compteCourant?.identifiant === compte.identifiant}
                    onClick={() => setASupprimer(compte)}
                  ><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {formulaire && <Modale
      titre={formulaire.mode === 'creation' ? 'Nouvel utilisateur' : `Modifier « ${formulaire.identifiant} »`}
      sousTitre="Le rôle décide des pages ouvertes ; le mot de passe n’est jamais relu à l’écran."
      icone={<UserPlus size={20} />}
      onFermer={() => setFormulaire(null)}
      pied={<div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => setFormulaire(null)}>Annuler</button>
        <button type="button" className="btn-primary" onClick={() => void enregistrer()} disabled={enCours}>
          <Check size={15} />{formulaire.mode === 'creation' ? 'Créer le compte' : 'Enregistrer'}
        </button>
      </div>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-700">Identifiant</span>
          <input
            className="field"
            value={formulaire.identifiant}
            maxLength={80}
            disabled={formulaire.mode === 'edition'}
            placeholder="caisse"
            onChange={e => setFormulaire({ ...formulaire, identifiant: e.target.value })}
          />
          <span className="mt-1 block text-[10px] text-slate-500">Lettres, chiffres, points, tirets ; il ne change plus après création.</span>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-700">Nom complet</span>
          <input
            className="field"
            value={formulaire.nomComplet}
            maxLength={120}
            placeholder="Lydia — Caissière"
            onChange={e => setFormulaire({ ...formulaire, nomComplet: e.target.value })}
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-semibold text-slate-700">Rôle</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLES.map(role => <label
              key={role.valeur}
              className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${formulaire.role === role.valeur ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="radio"
                  name="role"
                  className="accent-brand-700"
                  checked={formulaire.role === role.valeur}
                  onChange={() => setFormulaire({ ...formulaire, role: role.valeur })}
                />{role.libelle}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{role.resume}</span>
            </label>)}
          </div>
        </fieldset>

        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-700">
            {formulaire.mode === 'creation' ? 'Mot de passe' : 'Nouveau mot de passe (facultatif)'}
          </span>
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={formulaire.motDePasse}
            placeholder={formulaire.mode === 'creation' ? `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum` : 'Laisser vide pour ne pas changer'}
            onChange={e => setFormulaire({ ...formulaire, motDePasse: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-xs">
          <input
            type="checkbox"
            className="accent-brand-700"
            checked={formulaire.actif}
            onChange={e => setFormulaire({ ...formulaire, actif: e.target.checked })}
          />
          <span className="font-semibold text-slate-700">Compte actif</span>
          <span className="ml-auto text-[10px] text-slate-500">Un compte désactivé ne peut plus se connecter.</span>
        </label>
      </div>
    </Modale>}

    {aSupprimer && <Confirmation
      titre="Supprimer cet utilisateur ?"
      danger
      libelleConfirmer="Supprimer le compte"
      onAnnuler={() => setASupprimer(null)}
      onConfirmer={async () => {
        try {
          await supprimerCompte(aSupprimer.id);
          setConfirmation(`Compte « ${aSupprimer.identifiant} » supprimé.`);
          setASupprimer(null);
          await recharger();
        } catch (e) {
          setErreur(e instanceof Error ? e.message : 'La suppression a échoué.');
          setASupprimer(null);
        }
      }}
    >
      <p className="mb-3">Le compte « <strong>{aSupprimer.nomComplet}</strong> » ({aSupprimer.identifiant}) ne pourra plus se connecter.</p>
      <p className="text-xs text-slate-500">Les écritures déjà saisies restent dans le livre journal : rien n’est supprimé côté caisse.</p>
    </Confirmation>}

    <p className="flex items-center gap-2 text-[11px] text-slate-500">
      <RotateCcw size={13} />Les rôles se contrôlent aussi côté serveur : un caissier n’obtient rien de plus en changeant d’adresse.
      <span className="ml-auto inline-flex items-center gap-1"><X size={12} />Aucune couleur de rôle ne remplace une permission.</span>
    </p>
  </div>;
}
