import type { ExerciceCloture, Sauvegarde } from '../types';
import { aujourdHui } from './format';
import { MAX_IMPORT_OCTETS } from './constants';
import { donneesSecours } from './storage';
import { exiger, validerSauvegarde } from './validation';
import { entetesParDefaut } from './entete';
import { categoriesParDefaut } from './constants';
import { telecharger } from './export';

export function nomSauvegarde(prefixe = 'sauvegarde_caisse_salfa'): string {
  const heure = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${prefixe}_${aujourdHui()}_${heure}.json`;
}

export function preparerSauvegarde(livre: Sauvegarde): string {
  return JSON.stringify({ ...validerSauvegarde(livre), exportedAt: new Date().toISOString() }, null, 2);
}

export function exporterSauvegarde(livre: Sauvegarde, prefixe = 'sauvegarde_caisse_salfa'): void {
  telecharger(preparerSauvegarde(livre), nomSauvegarde(prefixe), 'application/json;charset=utf-8');
}

/** Archive autonome d'un exercice clôturé : réimportable comme sauvegarde complète. */
export function preparerArchiveExercice(archive: ExerciceCloture): string {
  const livre: Sauvegarde = {
    format: 'CAISSE-SALFA', version: 1, revision: 0, updatedAt: archive.clotureLe,
    exportedAt: new Date().toISOString(),
    ecritures: archive.ecritures,
    parametres: {
      soldeInitial: archive.soldeOuverture, exercice: archive.annee,
      reportPrecedent: null,
    },
    masques: [], compteurs: {}, exercicesClotures: [], entetes: entetesParDefaut(), categories: categoriesParDefaut(),
  };
  return JSON.stringify(validerSauvegarde(livre), null, 2);
}

export function exporterArchiveExercice(archive: ExerciceCloture): void {
  exporterSqlLivre(lireSauvegarde(preparerArchiveExercice(archive)), `archive_caisse_salfa_${archive.annee}`);
}

/** Export brut, non destructif, des anciennes clés et d'un stockage éventuellement corrompu. */
export function exporterSecours(): void {
  const base64 = encoderBase64(JSON.stringify({ format: 'CAISSE-SALFA-SECOURS-BRUT', exportedAt: new Date().toISOString(), cles: donneesSecours() }));
  const sql = `-- CAISSE SALFA : données brutes de diagnostic, non restaurables automatiquement.\nCREATE TABLE IF NOT EXISTS salfa_secours_brut (contenu LONGTEXT NOT NULL);\nINSERT INTO salfa_secours_brut (contenu) VALUES (CONVERT(FROM_BASE64('${base64}') USING utf8mb4));\n`;
  telecharger(sql, nomSauvegarde('secours_brut_caisse_salfa').replace(/\.json$/, '.sql'), 'application/sql;charset=utf-8');
}

export function lireSauvegarde(contenu: string): Sauvegarde {
  exiger(new Blob([contenu]).size <= MAX_IMPORT_OCTETS, 'Fichier trop volumineux : 8 Mo maximum.');
  let brut: unknown;
  try { brut = JSON.parse(contenu); }
  catch { throw new Error('Le fichier ne contient pas de JSON valide. Choisissez une sauvegarde JSON exportée depuis CAISSE SALFA.'); }
  return validerSauvegarde(brut);
}

/** Un commentaire SQL porte un instantané validé du livre ; aucun SQL n'est exécuté à la restauration. */
const MARQUEUR_SQL = '-- SALFA-LIVRE-V1:';
export const MAX_SQL_OCTETS = 24 * 1024 * 1024;

function encoderBase64(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

/** Export local : script SQL autonome stockant l'instantané du navigateur, sans comptes. */
export function preparerSqlLivre(livre: Sauvegarde): string {
  const json = preparerSauvegarde(livre);
  exiger(new Blob([json]).size <= MAX_IMPORT_OCTETS, 'Livre trop volumineux pour la restauration automatique : 8 Mo maximum.');
  const base64 = encoderBase64(json);
  return `-- CAISSE SALFA — sauvegarde du livre local (sans comptes)\n${MARQUEUR_SQL}${base64}\n\nCREATE TABLE IF NOT EXISTS salfa_sauvegarde_locale (contenu LONGTEXT NOT NULL);\nINSERT INTO salfa_sauvegarde_locale (contenu) VALUES (CONVERT(FROM_BASE64('${base64}') USING utf8mb4));\n`;
}

export function exporterSqlLivre(livre: Sauvegarde, prefixe = 'sauvegarde_caisse_salfa'): void {
  telecharger(preparerSqlLivre(livre), nomSauvegarde(prefixe).replace(/\.json$/, '.sql'), 'application/sql;charset=utf-8');
}

export function lireSauvegardeSql(contenu: string): Sauvegarde {
  exiger(new Blob([contenu]).size <= MAX_SQL_OCTETS, 'Fichier trop volumineux : 24 Mo maximum.');
  const correspondances = [...contenu.matchAll(/^-- SALFA-LIVRE-V1:([A-Za-z0-9+/=]+)\r?$/gm)];
  exiger(correspondances.length === 1, 'Fichier SQL non compatible : choisissez une sauvegarde SQL récente exportée depuis cette application. Les anciens dumps peuvent être importés avec phpMyAdmin.');
  let json: string;
  try {
    const binaire = atob(correspondances[0][1]);
    const octets = Uint8Array.from(binaire, c => c.charCodeAt(0));
    json = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch { throw new Error('L’instantané du livre dans le fichier SQL est invalide.'); }
  return lireSauvegarde(json);
}
