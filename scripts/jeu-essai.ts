/**
 * Jeu de données de démonstration : les trois derniers mois.
 *
 * Script utilitaire (non embarqué dans l'application). Il utilise le vrai
 * moteur du livre — validation, numérotation, compteurs — puis écrit une
 * sauvegarde JSON importable depuis « Données & sauvegardes ».
 *
 *   npx vite-node scripts/jeu-essai.ts -- --mois 2026-11
 */
import { writeFileSync } from 'node:fs';
import { creerDonnees } from '../src/utils/ledger';
import { validerSauvegarde } from '../src/utils/validation';
import type { Ecriture, LigneDetail, Sauvegarde, Sens } from '../src/types';
import { CATEGORIES_DEPENSE, CATEGORIES_RECETTE, MODE_UNIQUE } from '../src/utils/constants';

const argument = process.argv.find(a => a.startsWith('--mois='))?.slice('--mois='.length)
  ?? process.argv[process.argv.indexOf('--mois') + 1];
if (!argument || !/^\d{4}-\d{2}$/.test(argument)) {
  console.error('Usage : npx vite-node scripts/jeu-essai.ts -- --mois AAAA-MM');
  process.exit(1);
}
const [anneeNombre, moisNombre] = argument.split('-').map(Number);

type Poste = { description: string; reference: string; montant: number };

interface Modele {
  jour: number;
  sens: Sens;
  libelle: string;
  categorie: string;
  tiers?: string;
  observation?: string;
  postes: Poste[];
  /** Pièces ajoutées en fin de mois : elles varient d'un mois à l'autre. */
  finDeMois?: boolean;
}

const recette = (jour: number, libelle: string, categorie: string, postes: Poste[], extra: Partial<Modele> = {}): Modele =>
  ({ jour, sens: 'RECETTE', libelle, categorie, tiers: 'Caisse principale', postes, ...extra });

const depense = (jour: number, libelle: string, categorie: string, postes: Poste[], extra: Partial<Modele> = {}): Modele =>
  ({ jour, sens: 'DEPENSE', libelle, categorie, postes, ...extra });

/** Recettes du carnet de caisse, relevées chaque semaine. */
const recettesSemaine = (jour: number, semaine: number, facteur: number, finDeMois = false): Modele => {
  const postes: Poste[] = [
    { description: 'CONSULTATION', reference: `Q-CONS-${jour}`, montant: Math.round(320_000 * facteur) },
    { description: 'LABORATOIRE', reference: `Q-LABO-${jour}`, montant: Math.round(185_000 * facteur) },
    { description: 'MEDICAMENT', reference: `Q-PHAR-${jour}`, montant: Math.round(410_000 * facteur) },
    { description: 'ECHOGRAPHIE', reference: `Q-ECHO-${jour}`, montant: Math.round(120_000 * facteur) },
    { description: 'SOINS', reference: `Q-SOIN-${jour}`, montant: Math.round(95_000 * facteur) },
    { description: 'MATERNITE', reference: `Q-MATE-${jour}`, montant: Math.round(210_000 * facteur) },
    { description: 'HOSPITALISATION', reference: `Q-HOSP-${jour}`, montant: Math.round(275_000 * facteur) },
  ];
  return recette(jour, `Recettes de la semaine ${semaine}`, 'Recettes journalières', postes, { finDeMois });
};

const modeles: Modele[] = [
  // --- Semaine 1 ---
  recettesSemaine(2, 1, 1),
  depense(3, 'Achat médicaments pharmacie', 'Achats médicaments',
    [
      { description: 'ANTIBIOTIQUES', reference: 'FAC-1001', montant: 420_000 },
      { description: 'ANTIPALUDIQUES', reference: 'FAC-1001', montant: 265_000 },
      { description: 'PERFUSIONS', reference: 'FAC-1002', montant: 110_000 },
    ],
    { tiers: 'Pharmacie du Sud', observation: 'Livraison du lundi, bon de réception n° 44.' }),
  depense(4, 'Carburant groupe électrogène et ambulance', 'Carburant & transport',
    [{ description: 'GASOIL réservoir', reference: 'STA-221', montant: 160_000 }],
    { tiers: 'Station Total Antananarivo' }),
  depense(5, 'Prestation de nettoyage', 'Divers',
    [{ description: 'Ménage salles et couloirs', reference: 'PM-09', montant: 85_000 }], { tiers: 'Société HAZO' }),
  recettesSemaine(9, 2, 0.92),

  // --- Semaine 2 ---
  depense(10, 'Consultations médicales : honoraires', 'Honoraires',
    [
      { description: 'Médecin généraliste', reference: 'HON-10', montant: 180_000 },
      { description: 'Sage-femme', reference: 'HON-11', montant: 95_000 },
    ],
    { tiers: 'Dr RAKOTO' }),
  depense(11, 'Régularisation : consultation annulée', 'Divers',
    [{ description: 'Consultation du 8 remboursée au patient', reference: 'RGL-08', montant: 20_000 }],
    { tiers: 'Patient M. R.', observation: 'Pièce de démonstration : annulation d’une consultation.' }),
  depense(13, 'Consommables médicaux', 'Consommables médicaux',
    [
      { description: 'GANTS latex (boîtes)', reference: 'FAC-1104', montant: 78_000 },
      { description: 'SERINGUES 5 ml', reference: 'FAC-1104', montant: 52_000 },
      { description: 'COMPRESSES stériles', reference: 'FAC-1105', montant: 34_000 },
    ],
    { tiers: 'Medical Export' }),
  depense(14, 'Facture d’électricité JIRAMA', 'Eau & électricité',
    [{ description: 'Électricité du mois précédent', reference: 'JIR-8891', montant: 340_000 }],
    { tiers: 'JIRAMA' }),
  recettesSemaine(16, 3, 1.06),

  // --- Semaine 3 ---
  depense(17, 'Maintenance du concentrateur d’oxygène', 'Maintenance & équipements',
    [{ description: 'Remplacement filtre et révision', reference: 'TECH-77', montant: 195_000 }],
    { tiers: 'Biomed Services' }),
  depense(18, 'Fournitures de bureau', 'Fournitures de bureau',
    [
      { description: 'RAMES papier A4', reference: 'PAP-31', montant: 45_000 },
      { description: 'REGISTRES et carnets', reference: 'PAP-31', montant: 30_000 },
    ],
    { tiers: 'Papeterie Tana' }),
  depense(19, 'Mission : supervision du dispensaire', 'Frais de mission',
    [{ description: 'Transport et per diem', reference: 'OM-12', montant: 120_000 }],
    { tiers: 'Antsirabe' }),
  recettesSemaine(23, 4, 0.97),

  // --- Semaine 4 ---
  depense(24, 'Abonnement internet et téléphone', 'Téléphone & internet',
    [{ description: 'Fibre du mois', reference: 'TEL-552', montant: 89_000 }], { tiers: 'Telma' }),
  depense(26, 'Achat médicaments (complément)', 'Achats médicaments',
    [{ description: 'SÉRUM glucosé', reference: 'FAC-1130', montant: 140_000 }], { tiers: 'Pharmacie du Sud' }),
  recettesSemaine(30, 5, 1.02),
];

/**
 * Variations propres à chaque mois : décembre est plus chargé (fêtes),
 * janvier plus calme, novembre intermédiaire.
 */
const variations: Record<number, Modele[]> = {
  12: [
    recette(20, 'Subvention de la tutelle', 'Subventions & dons',
      [{ description: 'Appui au fonctionnement', reference: 'SUB-2025-12', montant: 1_500_000 }],
      { tiers: 'Département de santé', finDeMois: true }),
    depense(22, 'Prime de fin d’année (acompte)', 'Salaires & primes',
      [
        { description: 'Prime personnel soignant', reference: 'PAIE-12', montant: 600_000 },
        { description: 'Prime personnel administratif', reference: 'PAIE-12', montant: 240_000 },
      ],
      { tiers: 'Personnel', finDeMois: true }),
  ],
  11: [
    recette(20, 'Don d’une association partenaire', 'Subventions & dons',
      [{ description: 'Appui matériel médical', reference: 'DON-11', montant: 400_000 }],
      { tiers: 'Association Soa', finDeMois: true }),
  ],
  1: [
    depense(21, 'Entretien des locaux après les fêtes', 'Maintenance & équipements',
      [{ description: 'Peinture et réparations', reference: 'ENT-01', montant: 230_000 }],
      { tiers: 'Artisan local', finDeMois: true }),
    recette(22, 'Remboursement assurance', 'Remboursements',
      [{ description: 'Dossier patient 2025-118', reference: 'ASS-118', montant: 380_000 }],
      { tiers: 'Assurance', finDeMois: true }),
  ],
};

function dateIso(annee: number, mois: number, jour: number): string {
  const fin = new Date(annee, mois, 0).getDate();
  return `${annee}-${String(mois).padStart(2, '0')}-${String(Math.min(jour, fin)).padStart(2, '0')}`;
}

const idsPostes = new Map<string, number>();
function identifiant(prefixe: string, cle: string): string {
  const n = (idsPostes.get(cle) ?? 0) + 1;
  idsPostes.set(cle, n);
  return `${prefixe}-${cle}-${n}`;
}

const mois: Array<{ annee: number; mois: number }> = [];
for (let i = 2; i >= 0; i--) {
  const d = new Date(anneeNombre, moisNombre - 1 - i, 1);
  mois.push({ annee: d.getFullYear(), mois: d.getMonth() + 1 });
}

const donnees = creerDonnees(mois[mois.length - 1].annee);
donnees.parametres = {
  soldeInitial: 1_250_000,
  exercice: mois[mois.length - 1].annee,
  reportPrecedent: { annee: mois[mois.length - 1].annee - 1, solde: 1_250_000 },
};

const ecritures: Ecriture[] = [];
const compteurs: Record<string, number> = {};

for (const { annee, mois: m } of mois) {
  const duMois = [...modeles.filter(x => !x.finDeMois), ...(variations[m] ?? [])]
    .sort((a, b) => a.jour - b.jour || (a.sens === b.sens ? 0 : a.sens === 'RECETTE' ? -1 : 1));
  // La numérotation est annuelle : un compteur par année, pas par mois.
  let rc = compteurs[`RC-${annee}`] ?? 0;
  let dp = compteurs[`DP-${annee}`] ?? 0;
  for (const modele of duMois) {
    const numero = modele.sens === 'RECETTE' ? `RC-${annee}-${String(++rc).padStart(4, '0')}` : `DP-${annee}-${String(++dp).padStart(4, '0')}`;
    const date = dateIso(annee, m, modele.jour);
    const lignesDetail: LigneDetail[] = modele.postes.map(poste => ({
      id: identifiant('p', `${annee}${m}${numero}${poste.description}`),
      libelle: poste.description,
      reference: poste.reference,
      montant: poste.montant,
    }));
    ecritures.push({
      id: `essai-${annee}-${numero}`,
      numero,
      date,
      sens: modele.sens,
      libelle: modele.libelle,
      categorie: modele.categorie,
      tiers: modele.tiers,
      montant: lignesDetail.reduce((total, ligne) => total + ligne.montant, 0),
      lignesDetail,
      mode: MODE_UNIQUE,
      observation: modele.observation,
      createdAt: `${date}T08:30:00.000Z`,
    });
  }
  compteurs[`RC-${annee}`] = Math.max(compteurs[`RC-${annee}`] ?? 0, rc);
  compteurs[`DP-${annee}`] = Math.max(compteurs[`DP-${annee}`] ?? 0, dp);
}

// Contrôle de cohérence avec les listes de l'application.
const recettes = new Set(ecritures.filter(e => e.sens === 'RECETTE').map(e => e.categorie));
const depenses = new Set(ecritures.filter(e => e.sens === 'DEPENSE').map(e => e.categorie));
for (const categorie of recettes) if (!CATEGORIES_RECETTE.includes(categorie)) throw new Error(`Catégorie de recette inconnue : ${categorie}`);
for (const categorie of depenses) if (!CATEGORIES_DEPENSE.includes(categorie)) throw new Error(`Catégorie de dépense inconnue : ${categorie}`);

const sauvegarde: Sauvegarde = validerSauvegarde({
  ...donnees,
  // L'en-tête n'est pas figé : le livre affiche celui livré par l'application.
  entetes: undefined,
  format: 'CAISSE-SALFA',
  version: 1,
  revision: 0,
  updatedAt: new Date().toISOString(),
  exportedAt: new Date().toISOString(),
  ecritures,
  compteurs,
});

// Deux noms pointent le même contenu : le fichier à importer, et celui lu par demo/charger-demo.html.
const suffixe = mois.map(x => `${x.annee}-${String(x.mois).padStart(2, '0')}`).join('_');
const chemin = `demo/jeu_essai_caisse_salfa_${suffixe}.json`;
// L'en-tête n'est jamais figé dans le jeu d'essai : le livre reprend celui
// livré par l'application (textes et logos), même après une mise à jour.
const contenu = JSON.stringify(sauvegarde, (cle, valeur) => (cle === 'entetes' ? undefined : valeur), 2);
writeFileSync(chemin, contenu, 'utf8');
writeFileSync('demo/jeu-essai.json', contenu, 'utf8');

const totalRecettes = ecritures.filter(e => e.sens === 'RECETTE').reduce((s, e) => s + e.montant, 0);
const totalDepenses = ecritures.filter(e => e.sens === 'DEPENSE').reduce((s, e) => s + e.montant, 0);
console.log(`${chemin}`);
console.log(`${mois.map(x => `${String(x.mois).padStart(2, '0')}/${x.annee}`).join(' · ')} — ${ecritures.length} écritures`);
console.log(`Recettes ${totalRecettes.toLocaleString('fr-FR')} Ar · Dépenses ${totalDepenses.toLocaleString('fr-FR')} Ar · Solde ${(1_250_000 + totalRecettes - totalDepenses).toLocaleString('fr-FR')} Ar`);
