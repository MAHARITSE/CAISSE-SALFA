import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { soldeCloture } from './ledger';
import { validerSauvegarde } from './validation';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('sauvegarde migrée depuis caisse.xlsx et ligne caisse.xlsx', () => {
  it('valide intégralement la sauvegarde JSON (7 342 écritures et 19 231 sous-lignes)', () => {
    const brut = JSON.parse(readFileSync(join(racine, 'sauvegarde_caisse_salfa.json'), 'utf8'));
    const livre = validerSauvegarde(brut);

    // Exercices clôturés 2024 (1 écriture) et 2025 (3 580 écritures) + exercice ouvert 2026 (3 761 écritures)
    expect(livre.exercicesClotures).toHaveLength(2);
    expect(livre.exercicesClotures[0].annee).toBe(2024);
    expect(livre.exercicesClotures[0].ecritures).toHaveLength(1);
    expect(livre.exercicesClotures[0].soldeCloture).toBe(12_596_600);

    expect(livre.exercicesClotures[1].annee).toBe(2025);
    expect(livre.exercicesClotures[1].ecritures).toHaveLength(3580);
    expect(livre.exercicesClotures[1].soldeOuverture).toBe(12_596_600);
    expect(livre.exercicesClotures[1].soldeCloture).toBe(4_626_500);

    expect(livre.parametres.exercice).toBe(2026);
    expect(livre.parametres.soldeInitial).toBe(4_626_500);
    expect(livre.ecritures).toHaveLength(3761);
    expect(soldeCloture(livre)).toBe(17_097_930);

    // Vérification du nombre total d'écritures et de sous-lignes
    const toutesEcritures = [
      ...livre.exercicesClotures[0].ecritures,
      ...livre.exercicesClotures[1].ecritures,
      ...livre.ecritures,
    ];
    expect(toutesEcritures).toHaveLength(7342);

    const totalSousLignes = toutesEcritures.reduce((acc, e) => acc + (e.lignesDetail?.length ?? 0), 0);
    expect(totalSousLignes).toBe(19231);

    // Vérification que chaque écriture a une catégorie reconnue de son sens
    const catsRecette = new Set(livre.categories.recette);
    const catsDepense = new Set(livre.categories.depense);
    for (const e of toutesEcritures) {
      if (e.sens === 'RECETTE') {
        expect(catsRecette.has(e.categorie)).toBe(true);
      } else {
        expect(catsDepense.has(e.categorie)).toBe(true);
      }
    }
  });

  it('génère le fichier SQL complet sauvegarde_caisse_salfa.sql avec toutes les relations', () => {
    const sql = readFileSync(join(racine, 'sauvegarde_caisse_salfa.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS salfa_ecritures');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS salfa_details');
    expect(sql).toContain('INSERT INTO salfa_clotures');
    expect(sql).toContain('INSERT INTO salfa_ecritures');
    expect(sql).toContain('INSERT INTO salfa_details');
    expect(sql).toContain("'RC-2024-0001'");
    expect(sql).toContain("'RC-2025-0926'");
    expect(sql).toContain("'DP-2025-2654'");
    expect(sql).toContain("'RC-2026-1010'");
    expect(sql).toContain("'DP-2026-2751'");
  });
});
