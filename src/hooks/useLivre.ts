import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChargementLivre, DonneesCaisse, Sauvegarde } from '../types';
import { CLE_LIVRE, chargerLivre, sauvegarderLivre } from '../utils/storage';
import { migrerExercicesLegacy } from '../utils/ledger';
import { validerDonnees } from '../utils/validation';

export function useLivre() {
  const [etat, setEtat] = useState<ChargementLivre>(chargerLivre);
  const [messageSync, setMessageSync] = useState('');
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
    const synchroniser = (event: StorageEvent) => {
      if (event.key !== CLE_LIVRE && event.key !== null) return;
      setEtat(chargerLivre());
      setMessageSync('Le livre a été actualisé depuis un autre onglet. Vérifiez votre saisie avant de l’enregistrer.');
    };
    window.addEventListener('storage', synchroniser);
    return () => window.removeEventListener('storage', synchroniser);
  }, []);

  const muter = useCallback((transformation: (donnees: DonneesCaisse) => DonneesCaisse): boolean => {
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

  const recharger = useCallback(() => {
    const nouveau = chargerLivre();
    setEtat(nouveau);
    setMessageSync('');
    return !nouveau.erreur;
  }, []);

  const restaurer = useCallback((importe: Sauvegarde): Sauvegarde => {
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
  }, [etat]);

  return { ...etat, messageSync, muter, recharger, restaurer };
}
