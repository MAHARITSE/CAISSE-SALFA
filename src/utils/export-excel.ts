import ExcelJS from 'exceljs';
import type { LigneJournal } from '../types';
import { dateFr } from './format';
import type { OptionsExport } from './export';

/** Classeur Excel : montants numériques, chaînes littérales et détail non doublé. */
export function genererLivreExcel(lignes: LigneJournal[], options: OptionsExport): ExcelJS.Workbook {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'Caisse SALFA';
  const feuille = classeur.addWorksheet('Livre journal', { views: [{ state: 'frozen', ySplit: 6 }] });
  feuille.columns = [
    { width: 14 }, { width: 20 }, { width: 38 }, { width: 25 }, { width: 23 },
    { width: 20 }, { width: 30 }, { width: 20 }, { width: 20 }, { width: 22 },
  ];
  feuille.addRow(['CAISSE SALFA', 'Livre journal des recettes et dépenses']);
  feuille.addRow(['Période', options.periode]);
  feuille.addRow(['Vue', options.selection ? 'Sélection filtrée' : 'Période complète']);
  feuille.addRow(['Solde d’ouverture', options.soldeOuverture]);
  feuille.addRow([]);
  feuille.addRow(['Date', 'N° pièce', 'Libellé', 'Catégorie', 'Tiers / service', 'Référence', 'Observation', 'Recette (MGA)', 'Dépense (MGA)', 'Solde cumulé (MGA)']);
  feuille.addRow(['', '', 'Report à nouveau', '', '', '', '', '', '', options.soldeOuverture]);
  for (const ligne of lignes) {
    const detail = !!ligne.lignesDetail?.length;
    feuille.addRow([
      dateFr(ligne.date), ligne.numero, ligne.libelle, ligne.categorie, ligne.tiers ?? '', ligne.reference ?? '', ligne.observation ?? '',
      !detail && ligne.sens === 'RECETTE' ? ligne.montant : null,
      !detail && ligne.sens === 'DEPENSE' ? ligne.montant : null, ligne.solde,
    ]);
    for (const [index, poste] of (ligne.lignesDetail ?? []).entries()) {
      feuille.addRow(['', '', `  ↳ ${index + 1}. ${poste.libelle}`, 'Détail du poste', '', '', poste.reference ?? '',
        ligne.sens === 'RECETTE' ? poste.montant : null, ligne.sens === 'DEPENSE' ? poste.montant : null, null]);
    }
  }
  const total = feuille.addRow(['', '', options.selection ? 'TOTAUX DE LA SÉLECTION' : 'TOTAUX DE LA PÉRIODE', '', '', '', '', options.recettes, options.depenses, null]);
  const solde = feuille.addRow(['', '', 'SOLDE DE CLÔTURE — PÉRIODE COMPLÈTE', '', '', '', '', '', '', options.soldeFin]);
  feuille.getRow(1).font = { bold: true, size: 13 };
  feuille.getRow(6).font = { bold: true };
  feuille.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF1' } };
  total.font = { bold: true }; solde.font = { bold: true };
  for (const colonne of [8, 9, 10]) feuille.getColumn(colonne).numFmt = '#,##0.00';
  feuille.getCell('B4').numFmt = '#,##0.00';
  return classeur;
}

export async function exporterLivreExcel(lignes: LigneJournal[], options: OptionsExport): Promise<void> {
  const buffer = await genererLivreExcel(lignes, options).xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  const nom = options.periode.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  lien.download = `livre_journal_${nom || 'selection'}.xlsx`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
