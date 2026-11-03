import { LigneJournal } from '../types';
import { dateFr, nombre } from './format';

interface OptionsExport {
  periode: string;
  soldeOuverture: number;
  recettes: number;
  depenses: number;
  soldeFin: number;
}

const cellule = (valeur: string | number): string => {
  const texte = String(valeur);
  return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

const ligne = (valeurs: (string | number)[]): string => valeurs.map(cellule).join(';');

/**
 * Exporte le livre journal dans un CSV lisible par Excel
 * (séparateur « ; » et BOM UTF-8, comme les classeurs français).
 */
export function exporterLivreCsv(lignes: LigneJournal[], options: OptionsExport): void {
  const contenu: string[] = [
    ligne(['CAISSE SALFA', 'Livre journal des recettes et dépenses']),
    ligne(['Période', options.periode]),
    ligne(['Solde d ouverture', nombre(options.soldeOuverture)]),
    '',
    ligne([
      'Date',
      'N° pièce',
      'Libellé',
      'Catégorie',
      'Tiers / service',
      'Observation / Réf',
      'Recette',
      'Dépense',
      'Solde',
    ]),
    ligne([
      '',
      '',
      'Report à nouveau',
      '',
      '',
      '',
      '',
      '',
      nombre(options.soldeOuverture),
    ]),
    ...lignes.flatMap(l => {
      const lignePrincipale = ligne([
        dateFr(l.date),
        l.numero,
        l.libelle,
        l.categorie,
        l.tiers ?? '',
        l.observation || l.reference || '',
        l.sens === 'RECETTE' ? nombre(l.montant) : '',
        l.sens === 'DEPENSE' ? nombre(l.montant) : '',
        nombre(l.solde),
      ]);

      if (l.lignesDetail && l.lignesDetail.length > 0) {
        const sousLignes = l.lignesDetail.map((d, idx) =>
          ligne([
            '',
            '',
            `  ↳ ${idx + 1}. ${d.libelle}`,
            'Détail poste',
            '',
            d.reference ?? '',
            l.sens === 'RECETTE' ? nombre(d.montant) : '',
            l.sens === 'DEPENSE' ? nombre(d.montant) : '',
            '',
          ]),
        );
        return [lignePrincipale, ...sousLignes];
      }
      return [lignePrincipale];
    }),
    ligne(['', '', 'TOTAUX DE LA PÉRIODE', '', '', '', nombre(options.recettes), nombre(options.depenses), nombre(options.soldeFin)]),
  ];

  const blob = new Blob(['\uFEFF' + contenu.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `livre_journal_${options.periode.replace(/\s+/g, '_').toLowerCase()}.csv`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
