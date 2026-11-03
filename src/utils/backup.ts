import type { Sauvegarde } from '../types';
import { aujourdHui } from './format';
import { MAX_IMPORT_OCTETS } from './constants';
import { donneesSecours } from './storage';
import { exiger, validerSauvegarde } from './validation';
import { telecharger } from './export';

export function nomSauvegarde(prefixe = 'sauvegarde_caisse_salfa'): string {
  const heure = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${prefixe}_${aujourdHui()}_${heure}.json`;
}

export function preparerSauvegarde(livre: Sauvegarde): string {
  return JSON.stringify({ ...validerSauvegarde(livre), exportedAt: new Date().toISOString() }, null, 2);
}

export function exporterSauvegarde(livre: Sauvegarde): void {
  telecharger(preparerSauvegarde(livre), nomSauvegarde(), 'application/json;charset=utf-8');
}

/** Export brut, non destructif, des anciennes clés et d'un stockage éventuellement corrompu. */
export function exporterSecours(): void {
  telecharger(JSON.stringify({ format: 'CAISSE-SALFA-SECOURS-BRUT', exportedAt: new Date().toISOString(), cles: donneesSecours() }, null, 2),
    nomSauvegarde('secours_brut_caisse_salfa'), 'application/json;charset=utf-8');
}

export function lireSauvegarde(contenu: string): Sauvegarde {
  exiger(new Blob([contenu]).size <= MAX_IMPORT_OCTETS, 'Fichier trop volumineux : 8 Mo maximum.');
  let brut: unknown;
  try { brut = JSON.parse(contenu); }
  catch { throw new Error('Le fichier ne contient pas de JSON valide. Choisissez une sauvegarde JSON exportée depuis CAISSE SALFA.'); }
  return validerSauvegarde(brut);
}
