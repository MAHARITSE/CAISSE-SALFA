import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ecritureTest } from '../test/fixtures';
import { genererLivreExcel } from './export-excel';

describe('export Excel du journal', () => {
  it('crée un vrai classeur avec montants numériques, filtre et détails sans double comptage', async () => {
    const lignes = [{ ...ecritureTest({ libelle: '=1+1', reference: 'F-1', observation: 'Note', lignesDetail: [
      { id: 'a', libelle: 'Consultation', montant: 4000 },
      { id: 'b', libelle: 'Pharmacie', reference: 'Q-1', montant: 6000 },
    ] }), solde: 10000 }];
    const source = genererLivreExcel(lignes, { periode: 'novembre 2026', soldeOuverture: 0, recettes: 10000, depenses: 0, soldeFin: 10000, selection: true });
    const octets = await source.xlsx.writeBuffer();
    const relu = new ExcelJS.Workbook();
    await relu.xlsx.load(octets);
    const feuille = relu.getWorksheet('Livre journal')!;
    expect(feuille.getCell('B2').value).toBe('novembre 2026');
    expect(feuille.getCell('B3').value).toBe('Sélection filtrée');
    expect(feuille.getCell('C8').value).toBe('=1+1'); // Une chaîne, pas une formule Excel.
    expect(feuille.getCell('F8').value).toBe('F-1');
    expect(feuille.getCell('G8').value).toBe('Note');
    expect(feuille.getCell('H8').value).toBeNull();
    expect(feuille.getCell('H9').value).toBe(4000);
    expect(feuille.getCell('H10').value).toBe(6000);
    expect(feuille.getCell('G10').value).toBe('Q-1');
    expect(feuille.getCell('H11').value).toBe(10000);
    expect(feuille.getCell('J12').value).toBe(10000);
  });
});
