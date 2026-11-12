import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import policeNormale from '../assets/fonts/DejaVuSans.ttf?inline';
import policeGrasse from '../assets/fonts/DejaVuSans-Bold.ttf?inline';
import type { LigneJournal, Sens } from '../types';
import type { EnteteDocument } from './entete';
import { dateFr, montantAffiche } from './format';

const MARGE = 10;
const BAS = 284;

function installerPolices(pdf: jsPDF) {
  for (const [nom, style, source] of [
    ['DejaVuSans.ttf', 'normal', policeNormale],
    ['DejaVuSans-Bold.ttf', 'bold', policeGrasse],
  ] as const) {
    pdf.addFileToVFS(nom, source.slice(source.indexOf(',') + 1));
    pdf.addFont(nom, 'DejaVu', style);
  }
  pdf.setFont('DejaVu', 'normal');
}

/** Reproduit le bandeau configuré pour les bordereaux ; les images gardent leur position. */
function dessinerEntete(pdf: jsPDF, entete: EnteteDocument): number {
  let bas = MARGE;
  if (entete.mode === 'image' && entete.image) {
    const image = pdf.getImageProperties(entete.image);
    const largeur = Math.min(190, 80 * image.width / image.height);
    const hauteur = largeur * image.height / image.width;
    pdf.addImage(entete.image, image.fileType, (210 - largeur) / 2, MARGE, largeur, hauteur);
    bas = MARGE + hauteur;
  } else {
    let y = MARGE;
    for (const ligne of entete.lignes.filter(l => l.texte.trim())) {
      pdf.setFont('DejaVu', ligne.gras ? 'bold' : 'normal');
      pdf.setFontSize(ligne.taille);
      const lignes = pdf.splitTextToSize(ligne.texte, 158) as string[];
      const pas = ligne.taille * 0.3528 * 1.3;
      const align = ligne.alignement === 'gauche' ? 'left' : ligne.alignement === 'droite' ? 'right' : 'center';
      const x = align === 'left' ? 26 : align === 'right' ? 184 : 105;
      for (const texte of lignes) {
        y += pas;
        pdf.text(texte, x, y, { align });
        if (ligne.souligne) {
          const largeur = pdf.getTextWidth(texte);
          const debut = align === 'center' ? x - largeur / 2 : align === 'right' ? x - largeur : x;
          pdf.line(debut, y + 0.5, debut + largeur, y + 0.5);
        }
      }
    }
    bas = Math.max(bas, y + 2);
    for (const image of entete.images.filter(i => i.source)) {
      const proprietes = pdf.getImageProperties(image.source);
      const hauteur = image.largeur * proprietes.height / proprietes.width;
      if (image.y + hauteur > BAS - 30) throw new Error('Une image de l’en-tête est trop basse pour l’export PDF.');
      pdf.addImage(image.source, proprietes.fileType, image.x, image.y, image.largeur, hauteur);
      bas = Math.max(bas, image.y + hauteur);
    }
  }
  if (bas > BAS - 30) throw new Error('L’en-tête est trop grand pour l’export PDF.');
  return bas + 6;
}

function description(ligne: LigneJournal): string {
  const informations = [ligne.tiers && `Tiers : ${ligne.tiers}`, ligne.reference && `Réf. : ${ligne.reference}`, ligne.observation && `Observation : ${ligne.observation}`].filter(Boolean);
  const details = (ligne.lignesDetail ?? []).map(d => `  • ${d.libelle} : ${montantAffiche(d.montant)}${d.reference ? ` (${d.reference})` : ''}`);
  return [ligne.libelle, ...informations, ...details].join('\n');
}

/** Génère un vrai PDF téléchargeable, sans modifier la sélection ni les soldes. */
export function genererPdfEcritures(lignes: LigneJournal[], entete: EnteteDocument, periode: string, virements = false): jsPDF {
  if (!lignes.length) throw new Error('Aucune écriture à exporter.');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  installerPolices(pdf);
  pdf.setProperties({ title: 'État des écritures de caisse', subject: `Période : ${periode}` });
  let premiere = true;
  for (const sens of ['RECETTE', 'DEPENSE'] as Sens[]) {
    const groupe = lignes.filter(l => l.sens === sens);
    if (!groupe.length) continue;
    if (!premiere) pdf.addPage();
    premiere = false;
    let y = dessinerEntete(pdf, entete);
    pdf.setFont('DejaVu', 'bold');
    pdf.setFontSize(13);
    pdf.text(`ÉTAT DES ${virements ? 'VIREMENTS - ' : ''}${sens === 'RECETTE' ? 'RECETTES' : 'DÉPENSES'}`, 105, y, { align: 'center' });
    y += 6;
    const categories = [...new Set(groupe.map(l => l.categorie.trim()).filter(Boolean))];
    const objet = categories.length ? categories.join(', ') : 'Non renseignée';
    // AutoTable assure le retour à la ligne et la pagination pour les longues listes.
    autoTable(pdf, {
      startY: y, margin: { left: MARGE, right: MARGE, top: MARGE, bottom: 15 }, theme: 'plain',
      styles: { font: 'DejaVu', fontSize: 9, cellPadding: 1.2, overflow: 'linebreak' },
      body: [[`Période : ${periode}\nObjet : ${objet}`]],
    });
    const dernier = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: dernier + 3, margin: { left: MARGE, right: MARGE, top: 15, bottom: 15 },
      head: [['Date', 'N° pièce', 'Libellé / détails', 'Catégorie', 'Montant (Ar)']],
      body: groupe.map(l => [dateFr(l.date), l.numero, description(l), l.categorie, montantAffiche(l.montant)]),
      foot: [[{ content: `TOTAL ${sens === 'RECETTE' ? 'RECETTES' : 'DÉPENSES'}`, colSpan: 4 }, montantAffiche(groupe.reduce((total, l) => total + l.montant, 0))]],
      showHead: 'everyPage', showFoot: 'lastPage', theme: 'grid',
      styles: { font: 'DejaVu', fontSize: 8, cellPadding: 1.4, overflow: 'linebreak', valign: 'top', textColor: [20, 20, 20], lineColor: [160, 160, 160], lineWidth: 0.1 },
      headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [230, 235, 240], textColor: [20, 20, 20] },
      footStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [245, 245, 245], textColor: [20, 20, 20] },
      columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 29 }, 2: { cellWidth: 65 }, 3: { cellWidth: 43 }, 4: { cellWidth: 32, halign: 'right' } },
    });
  }
  // Une seule signature, sur la dernière page, en bas du document.
  const fin = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  if (fin > 255) pdf.addPage();
  pdf.setFont('DejaVu', 'bold');
  pdf.setFontSize(10);
  pdf.text('Le Gestionnaire', 168, 264, { align: 'center' });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont('DejaVu', 'normal'); pdf.setFontSize(8);
    pdf.text(`Page ${page} / ${pages}`, 200, 290, { align: 'right' });
  }
  return pdf;
}

/** Ouvre le document dans la visionneuse PDF du navigateur, sans téléchargement. */
export function ouvrirEtatPourImpression(lignes: LigneJournal[], entete: EnteteDocument, periode: string, fenetre: Window, virements = false): void {
  const pdf = genererPdfEcritures(lignes, entete, periode, virements);
  // Les visionneuses qui acceptent l'action PDF ouvrent directement l'impression.
  // Les autres laissent le bouton Imprimer de leur visionneuse accessible.
  pdf.autoPrint();
  const url = URL.createObjectURL(pdf.output('blob'));
  try {
    fenetre.location.replace(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  const verifierFermeture = window.setInterval(() => {
    if (fenetre.closed) { window.clearInterval(verifierFermeture); URL.revokeObjectURL(url); }
  }, 30000);
}
