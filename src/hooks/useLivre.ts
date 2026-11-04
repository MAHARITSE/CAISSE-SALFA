import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChargementLivre, DonneesCaisse, Sauvegarde } from '../types';
import { CLE_LIVRE, chargerLivre, sauvegarderLivre } from '../utils/storage';
import { migrerExercicesLegacy } from '../utils/ledger';
import { validerDonnees } from '../utils/validation';
import { MODE_API, chargerLivreApi, mutations } from '../utils/api';
import { entetesParDefaut } from '../utils/entete';
import { categoriesParDefaut } from '../utils/constants';

const LIVRE_VIDE: ChargementLivre = {
  livre: { format: 'CAISSE-SALFA', version: 1, revision: 0, updatedAt: new Date().toISOString(), ecritures: [], parametres: { soldeInitial: 0, exercice: undefined, reportPrecedent: null }, masques: [], compteurs: {}, exercicesClotures: [], entetes: entetesParDefaut(), categories: categoriesParDefaut() },
  erreur: null, avertissement: null, migration: false, normalisation: false,
};

export function useLivre() {
  const [etat, setEtat] = useState<ChargementLivre>(chargerLivre);
  const [messageSync, setMessageSync] = useState('');
  const [chargementApi, setChargementApi] = useState(MODE_API);
  const migrationTentee = useRef(false);

  const migrationLegacyTentee = useRef(false);
  useEffect(() => {
    if (etat.erreur || !etat.normalisation || migrationLegacyTentee.current) return;
    migrationLegacyTentee.current = true;
    try {
      // Livre antérieur aux exercices annuels : clôture les années passées, sans perte.
      const { livre, avertissement } = migrerExercicesLegacy(etat.livre, new Date().getFullYear());
      const enregistre = sauvegarderLivre(livre, etat.livre.revision, true);
      setEtat({ livre: enregistre, erreur: null, avertissement: avertissement ?? etat.avertissement, migration: false, normalisation: false });
    } catch (e) {
      setEtat(courant => ({ ...courant, normalisation: false, erreur: e instanceof Error ? e.message : 'Conversion des exercices non enregistrée.' }));
    }
    // La conversion ne doit être tentée qu'une fois, y compris avec React.StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!etat.migration || etat.erreur || migrationTentee.current) return;
    migrationTentee.current = true;
    try {
      const livre = sauvegarderLivre(etat.livre, 0, false);
      setEtat({ livre, migration: false, erreur: null, avertissement: etat.avertissement, normalisation: false });
    } catch (e) {
      setEtat(courant => ({ ...courant, migration: false, erreur: e instanceof Error ? e.message : 'Migration non enregistrée.' }));
    }
    // La migration ne doit être tentée qu'une fois, y compris avec React.StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (MODE_API) return;
    const synchroniser = (event: StorageEvent) => {
      if (event.key !== CLE_LIVRE && event.key !== null) return;
      setEtat(chargerLivre());
      setMessageSync('Le livre a été actualisé depuis un autre onglet. Vérifiez votre saisie avant de l’enregistrer.');
    };
    window.addEventListener('storage', synchroniser);
    return () => window.removeEventListener('storage', synchroniser);
  }, []);

  /** En mode API, le livre vient du serveur ; un échec affiche un message actionnable. */
  const chargerDepuisApi = useCallback(async (): Promise<boolean> => {
    setChargementApi(true);
    try {
      const livre = await chargerLivreApi();
      setEtat({ livre, erreur: null, avertissement: null, migration: false, normalisation: false });
      setMessageSync('');
      return true;
    } catch (e) {
      setEtat({ ...LIVRE_VIDE, erreur: e instanceof Error ? e.message : 'Chargement du livre impossible.' });
      return false;
    } finally {
      setChargementApi(false);
    }
  }, []);

  /** Après reconnexion ou changement de compte : recharge tout depuis le serveur. */
  const rechargerApi = useCallback(() => { void chargerDepuisApi(); }, [chargerDepuisApi]);

  const appliquer = useCallback((livre: Sauvegarde) => {
    setEtat({ livre, erreur: null, avertissement: null, migration: false, normalisation: false });
    setMessageSync('');
  }, []);

  const muter = useCallback((transformation: (donnees: DonneesCaisse) => DonneesCaisse): boolean => {
    if (MODE_API) {
      // Le serveur calcule et renvoie le livre complet : pas de mutation locale.
      return false;
    }
    try {
      const donnees = validerDonnees(transformation(etat.livre));
      const livre = sauvegarderLivre({ ...etat.livre, ...donnees }, etat.livre.revision);
      setEtat({ livre, erreur: null, avertissement: etat.avertissement, migration: false, normalisation: etat.normalisation });
      setMessageSync('');
      return true;
    } catch (e) {
      setEtat(courant => ({ ...courant, erreur: e instanceof Error ? e.message : 'Enregistrement impossible.' }));
      return false;
    }
  }, [etat]);

  /**
   * Mutation asynchrone en mode API : contrôle la révision, envoie la requête,
   * puis remplace le livre par celui renvoyé par le serveur.
   */
  const muterEnLigne = useCallback(async (action: (revision: number) => Promise<{ livre: Sauvegarde }>): Promise<boolean> => {
    try {
      const { livre } = await action(etat.livre.revision);
      appliquer(livre);
      return true;
    } catch (e) {
      setEtat(courant => ({ ...courant, erreur: e instanceof Error ? e.message : 'Enregistrement impossible.' }));
      return false;
    }
  }, [etat.livre.revision, appliquer]);

  const recharger = useCallback(() => {
    if (MODE_API) {
      void chargerDepuisApi();
      return true;
    }
    const nouveau = chargerLivre();
    setEtat(nouveau);
    setMessageSync('');
    return !nouveau.erreur;
  }, [chargerDepuisApi]);

  const restaurer = useCallback(async (importe: Sauvegarde): Promise<Sauvegarde> => {
    if (MODE_API) {
      const { livre } = await mutations.restauration(importe);
      appliquer(livre);
      return livre;
    }
    // La restauration est explicite ; l'appelant télécharge d'abord les données actuelles.
    try {
      const livre = sauvegarderLivre(importe, etat.erreur ? importe.revision : etat.livre.revision, true);
      setEtat({ livre, erreur: null, avertissement: null, migration: false, normalisation: false });
      setMessageSync('');
      return livre;
    } catch (e) {
      setEtat(courant => ({ ...courant, erreur: e instanceof Error ? e.message : 'Restauration impossible.' }));
      throw e;
    }
  }, [etat, appliquer]);

  return { ...etat, messageSync, muter, muterEnLigne, recharger, rechargerApi, restaurer, chargementApi };
}
