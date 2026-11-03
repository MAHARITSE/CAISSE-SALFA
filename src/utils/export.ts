import type { LigneJournal } from '../types';
import { dateFr } from './format';

export interface OptionsExport {
  periode: string;
  soldeOuverture: number;
  recettes: number;
  depenses: number;
  soldeFin: number;
  selection?: boolean;
}

/** Neutralise les formules Excel sans modifier les montants numériques. */
export function celluleCsv(valeur: string | number): string {
  if (typeof valeur === 'number') return String(valeur);
  const dangereux = /^[\s]*[=+\-@]/.test(valeur) || /^[\t\r\n]/.test(valeur);
  const texte = dangereux ? `'${valeur}` : valeur;
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

const ligne = (valeurs: (string | number)[]): string => valeurs.map(celluleCsv).join(';');

/** CSV UTF-8, séparateur ;, montants numériques non doublés sur les pièces détaillées. */
export function genererLivreCsv(lignes: LigneJournal[], options: OptionsExport): string {
  const contenu: string[] = [
    ligne(['CAISSE SALFA', 'Livre journal des recettes et dépenses']),
    ligne(['Période', options.periode]),
    ligne(['Vue', options.selection ? 'Sélection filtrée' : 'Période complète']),
    ligne(['Solde d’ouverture', options.soldeOuverture]),
    '',
    ligne(['Date', 'N° pièce', 'Libellé', 'Catégorie', 'Tiers / service', 'Mode', 'Référence', 'Observation', 'Recette (MGA)', 'Dépense (MGA)', 'Solde cumulé (MGA)']),
    ligne(['', '', 'Report à nouveau', '', '', '', '', '', '', '', options.soldeOuverture]),
    ...lignes.flatMap(l => {
      const detail = l.lignesDetail && l.lignesDetail.length > 0;
      const principale = ligne([
        dateFr(l.date), l.numero, l.libelle, l.categorie, l.tiers ?? '', l.mode ?? 'Non précisé',
        l.reference ?? '', l.observation ?? '',
        !detail && l.sens === 'RECETTE' ? l.montant : '',
        !detail && l.sens === 'DEPENSE' ? l.montant : '',
        l.solde,
      ]);
      if (!detail) return [principale];
      return [principale, ...l.lignesDetail!.map((d, idx) => ligne([
        '', '', `  ↳ ${idx + 1}. ${d.libelle}`, 'Détail du poste', '', '', d.reference ?? '', '',
        l.sens === 'RECETTE' ? d.montant : '', l.sens === 'DEPENSE' ? d.montant : '', '',
      ]))];
    }),
    ligne(['', '', options.selection ? 'TOTAUX DE LA SÉLECTION' : 'TOTAUX DE LA PÉRIODE', '', '', '', '', '', options.recettes, options.depenses, '']),
    ligne(['', '', 'SOLDE DE CLÔTURE — PÉRIODE COMPLÈTE', '', '', '', '', '', '', '', options.soldeFin]),
  ];
  return '\uFEFF' + contenu.join('\r\n');
}

export function telecharger(contenu: string, nom: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exporterLivreCsv(lignes: LigneJournal[], options: OptionsExport): void {
  telecharger(genererLivreCsv(lignes, options), `livre_journal_${options.periode.replace(/\s+/g, '_').toLowerCase()}.csv`, 'text/csv;charset=utf-8;');
}
