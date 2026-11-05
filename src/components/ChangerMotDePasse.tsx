import { useId, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Modale } from './Modale';
import { changerMonMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from '../utils/utilisateurs';

/**
 * Changement de son propre mot de passe.
 *
 * Aucun administrateur n'intervient : chacun ouvre ce formulaire depuis
 * l'en-tête et choisit son mot de passe. L'ancien est exigé — une session
 * laissée ouverte ne suffit donc pas à s'approprier le compte.
 *
 * Sur WAMP, le serveur hache en bcrypt et ne renvoie jamais le secret ; en
 * démonstration, le stockage du navigateur reçoit un SHA-256 salé.
 */
export function ChangerMotDePasse({ utilisateur, onFermer, onFait }: {
  utilisateur: string;
  onFermer: () => void;
  onFait: (message: string) => void;
}) {
  const id = useId();
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const assezLong = nouveau.length >= LONGUEUR_MIN_MOT_DE_PASSE;
  const concordent = nouveau !== '' && nouveau === confirmation;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    if (!actuel) { setErreur('Saisissez votre mot de passe actuel.'); return; }
    if (!assezLong) { setErreur(`Le nouveau mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`); return; }
    if (!concordent) { setErreur('Les deux saisies du nouveau mot de passe diffèrent.'); return; }
    setEnCours(true);
    try {
      await changerMonMotDePasse(actuel, nouveau);
      onFait(`Mot de passe de « ${utilisateur} » modifié. Il sera demandé à la prochaine connexion.`);
    } catch (erreurEnvoi) {
      setErreur(erreurEnvoi instanceof Error ? erreurEnvoi.message : 'Le mot de passe n’a pas pu être modifié.');
    } finally {
      setEnCours(false);
    }
  }

  const type = afficher ? 'text' : 'password';

  return <Modale
    titre="Changer mon mot de passe"
    sousTitre={`Compte « ${utilisateur} » — vous seul choisissez ce mot de passe.`}
    icone={<KeyRound size={21} />}
    largeur="petite"
    onFermer={onFermer}
    pied={<div className="flex justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onFermer}>Annuler</button>
      <button type="submit" form={id} className="btn-primary" disabled={enCours}>
        {enCours ? <><Loader2 size={16} className="animate-spin" />Enregistrement…</> : <><Check size={16} />Changer le mot de passe</>}
      </button>
    </div>}
  >
    <form id={id} onSubmit={envoyer} className="space-y-4">
      <div>
        <label className="label" htmlFor={`${id}-actuel`}>Mot de passe actuel</label>
        <div className="relative">
          <input
            id={`${id}-actuel`}
            type={type}
            className="field pr-10"
            autoComplete="new-password"
            required
            autoFocus
            value={actuel}
            onChange={e => { setActuel(e.target.value); setErreur(''); }}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600"
            aria-label={afficher ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            title={afficher ? 'Masquer' : 'Afficher'}
            onClick={() => setAfficher(v => !v)}
          >{afficher ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-nouveau`}>Nouveau mot de passe</label>
        <input
          id={`${id}-nouveau`}
          type={type}
          className="field"
          autoComplete="new-password"
          required
          value={nouveau}
          onChange={e => { setNouveau(e.target.value); setErreur(''); }}
        />
        <p className={`mt-1 text-[11px] ${nouveau && !assezLong ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum.
        </p>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-confirmation`}>Confirmer le nouveau mot de passe</label>
        <input
          id={`${id}-confirmation`}
          type={type}
          className="field"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={e => { setConfirmation(e.target.value); setErreur(''); }}
        />
        {confirmation !== '' && !concordent && <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-400">Les deux saisies diffèrent.</p>}
      </div>

      {erreur && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-300">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />{erreur}
      </p>}
    </form>
  </Modale>;
}
