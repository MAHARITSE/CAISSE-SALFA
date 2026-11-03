import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChargementLivre, DonneesCaisse, Sauvegarde } from '../types';
import { CLE_LIVRE, chargerLivre, sauvegarderLivre } from '../utils/storage';
import { validerDonnees } from '../utils/validation';

export function useLivre() {
  const [etat, setEtat] = useState<ChargementLivre>(chargerLivre);
  const [messageSync, setMessageSync] = useState('');
  const migrationTentee = useRef(false);

  useEffect(() => {
    if (!etat.migration || etat.erreur || migrationTentee.current) return;
    migrationTentee.current = true;
    try {
      const livre = sauvegarderLivre(etat.livre, 0);
      setEtat({ livre, migration: false, erreur: null, avertissement: etat.avertissement });
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
      setEtat({ livre, erreur: null, avertissement: etat.avertissement, migration: false });
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
      const livre = sauvegarderLivre(importe, etat.erreur ? importe.revision : etat.livre.revision, Boolean(etat.erreur));
      setEtat({ livre, erreur: null, avertissement: null, migration: false });
      setMessageSync('');
      return livre;
    } catch (e) {
      setEtat(courant => ({ ...courant, erreur: e instanceof Error ? e.message : 'Restauration impossible.' }));
      throw e;
    }
  }, [etat]);

  return { ...etat, messageSync, muter, recharger, restaurer };
}
