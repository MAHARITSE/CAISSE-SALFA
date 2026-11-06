#!/usr/bin/env node
/**
 * Import et conversion de la sauvegarde Excel de l'ancien logiciel
 * (`caisse.xlsx` + `ligne caisse.xlsx`) vers la nouvelle application CAISSE SALFA.
 *
 * Génère :
 *   1. `sauvegarde_caisse_salfa.sql` : sauvegarde SQL complète prête à importer
 *      dans MySQL / MariaDB / phpMyAdmin (`caisse_salfa`).
 *   2. `sauvegarde_caisse_salfa.json` : sauvegarde JSON complète prête à restaurer
 *      depuis l'écran « Données & sauvegardes » de l'application.
 *   3. `deploy/wamp/api/installation/salfa_install.sql` : schéma + données migrées
 *      pour que l'installation automatique WAMP et `caisse-salfa.sql` embarquent
 *      directement l'historique complet 2024–2026.
 *
 * Usage :
 *   node scripts/importer-excel.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. Lecteur minimaliste de fichiers .xlsx (ZIP + XML OpenXML sans dépendance)
// ---------------------------------------------------------------------------

/** Extrait les fichiers XML d'une archive ZIP (.xlsx). */
function extraireZip(chemin) {
  const tampon = readFileSync(chemin);
  // Recherche de l'End of Central Directory (EOCD : 0x06054b50)
  let posEocd = -1;
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 65557); i--) {
    if (tampon.readUInt32LE(i) === 0x06054b50) {
      posEocd = i;
      break;
    }
  }
  if (posEocd < 0) throw new Error(`Archive ZIP invalide : ${chemin}`);

  const nbEntrees = tampon.readUInt16LE(posEocd + 10);
  let posCentral = tampon.readUInt32LE(posEocd + 16);
  const fichiers = new Map();

  for (let i = 0; i < nbEntrees; i++) {
    if (tampon.readUInt32LE(posCentral) !== 0x02014b50) {
      throw new Error(`En-tête central ZIP invalide dans ${chemin}`);
    }
    const methode = tampon.readUInt16LE(posCentral + 10);
    const tailleCompressee = tampon.readUInt32LE(posCentral + 20);
    const longNom = tampon.readUInt16LE(posCentral + 28);
    const longExtra = tampon.readUInt16LE(posCentral + 30);
    const longCommentaire = tampon.readUInt16LE(posCentral + 32);
    const offsetLocal = tampon.readUInt32LE(posCentral + 42);
    const nom = tampon.subarray(posCentral + 46, posCentral + 46 + longNom).toString('utf8');

    const longNomLocal = tampon.readUInt16LE(offsetLocal + 26);
    const longExtraLocal = tampon.readUInt16LE(offsetLocal + 28);
    const debutDonnees = offsetLocal + 30 + longNomLocal + longExtraLocal;
    const donneesCompressees = tampon.subarray(debutDonnees, debutDonnees + tailleCompressee);

    if (methode === 0) {
      fichiers.set(nom, donneesCompressees);
    } else if (methode === 8) {
      fichiers.set(nom, inflateRawSync(donneesCompressees));
    }
    posCentral += 46 + longNom + longExtra + longCommentaire;
  }
  return fichiers;
}

/** Décode les entités XML courantes. */
function decoderXml(texte) {
  return texte
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Convertit une référence de colonne Excel (A, B, ..., H) en index 0-based. */
function indexColonne(refColonne) {
  let idx = 0;
  for (let i = 0; i < refColonne.length; i++) {
    idx = idx * 26 + (refColonne.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/** Lit la première feuille d'un classeur .xlsx et renvoie les lignes sous forme de tableaux. */
function lireFeuilleXlsx(chemin) {
  const archive = extraireZip(chemin);
  const chainesPartagees = [];

  if (archive.has('xl/sharedStrings.xml')) {
    const xmlChaines = archive.get('xl/sharedStrings.xml').toString('utf8');
    const regexSi = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let matchSi;
    while ((matchSi = regexSi.exec(xmlChaines)) !== null) {
      const bloc = matchSi[1];
      const regexT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
      let matchT;
      let texte = '';
      while ((matchT = regexT.exec(bloc)) !== null) {
        texte += decoderXml(matchT[1]);
      }
      chainesPartagees.push(texte);
    }
  }

  const xmlFeuille = archive.get('xl/worksheets/sheet1.xml').toString('utf8');
  const lignes = [];
  const regexRow = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let matchRow;

  while ((matchRow = regexRow.exec(xmlFeuille)) !== null) {
    const contenuRow = matchRow[1];
    const valeurs = [];
    const regexCell = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let matchCell;

    while ((matchCell = regexCell.exec(contenuRow)) !== null) {
      const attrs = matchCell[1];
      const corps = matchCell[2] || '';
      const matchRef = /\br="([A-Z]+)\d+"/.exec(attrs);
      const col = matchRef ? indexColonne(matchRef[1]) : valeurs.length;
      const matchType = /\bt="([^"]+)"/.exec(attrs);
      const typeCell = matchType ? matchType[1] : '';
      const matchVal = /<v>([\s\S]*?)<\/v>/.exec(corps);

      let valeur = null;
      if (matchVal) {
        const brut = decoderXml(matchVal[1]);
        valeur = typeCell === 's' ? (chainesPartagees[Number(brut)] ?? '') : brut;
      } else if (typeCell === 'inlineStr') {
        const matchT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(corps);
        valeur = matchT ? decoderXml(matchT[1]) : '';
      }
      valeurs[col] = valeur;
    }
    lignes.push(valeurs);
  }
  return lignes;
}

/** Convertit un numéro de série de date Excel (base 1899-12-30) en AAAA-MM-JJ. */
function dateExcelVersIso(serie) {
  const jours = Math.floor(Number(serie));
  const ms = Date.UTC(1899, 11, 30) + jours * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Normalise les espaces d'un texte sur une seule ligne. */
function nettoyerTexte(texte) {
  return String(texte ?? '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// 2. Classification automatique par catégories (Recettes & Dépenses)
// ---------------------------------------------------------------------------

/** Classifie une écriture de RECETTE selon son libellé et ses sous-lignes. */
function classifierRecette(libelle, sousLignes) {
  const lib = libelle.toUpperCase();
  const descs = sousLignes.map(l => l.libelle.toUpperCase()).join(' ');
  const tout = `${lib} ${descs}`;

  if (
    [
      'RECETTE DU', 'RECETTES DU', 'RECETTE CAISSE', 'RECETTECAISSE', 'RECETTES CAISSE',
      'RECETTE GARDE', 'RECETTEGARDE', 'RECETTES GARDE', 'RECETTE JOURNAL', 'CAISSE GARDE',
      'CAISSE LYDIE', 'CAISSE RASOANANDRASANA', 'CAISSE FENO', 'CAISSE SOANDRASA', 'CAISSE ZAFIHITA',
    ].some(k => lib.includes(k))
    || (sousLignes.length > 1 && descs.includes('PRESTATION'))
  ) {
    return 'Recettes journalières';
  }
  if (['ANALYSE', 'LABO', 'TDR'].some(k => tout.includes(k))) {
    return 'Laboratoire';
  }
  if (['VENTE', 'MEDICAMENT', 'PHARMACIE', 'SERINGUE', 'OXYGENE', 'CARNET', 'PRODUIT', 'GANT'].some(k => tout.includes(k))) {
    return 'Pharmacie';
  }
  if (['ECHO', 'RADIO', 'ECG'].some(k => tout.includes(k))) {
    return 'Imagerie';
  }
  if (['MATERNITE', 'ACCOUCHEMENT', 'SAGE FEMME'].some(k => tout.includes(k))) {
    return 'Maternité';
  }
  if (['HOSPITALISATION', 'FRAIS HOSP', 'CHAMBRE', 'BLOC', 'CHIRURGIE', 'EVASAN', 'OPERATION'].some(k => tout.includes(k))) {
    return 'Hospitalisation';
  }
  if (['CONSULTATION', 'SOIN', 'DENTISTE', 'OPHTALMO', 'CERTIFICAT', 'VISITE', 'VACCIN', 'PANSEMENT'].some(k => tout.includes(k))) {
    return 'Consultations';
  }
  if (['DON ', 'DONS ', 'SUBVENTION'].some(k => tout.includes(k))) {
    return 'Subventions & dons';
  }
  if (
    ['REMBOURSEMENT', 'RAMBOURSEMENT', 'REMBOURSSEMENT', 'REMBOURSEMEN', 'RECOUVREMENT',
     'REGLEMENT', 'REGELEMENT', 'REGLEMEN', 'REGLMENT', 'RESTE NON', 'RETOUR', 'VERSEMENT',
     'AVANCE', 'PRET', 'PRELEVEMENT', 'TROP PERCU', 'CAUTION'].some(k => tout.includes(k))
  ) {
    return 'Remboursements';
  }
  if (['RAPPORT A NOUVEAU', 'REPORT A NOUVEAU', 'SOLDE', 'ECART', 'ERREUR'].some(k => tout.includes(k))) {
    return 'Autres recettes';
  }
  return 'Recettes journalières';
}

/** Classifie une écriture de DEPENSE selon son libellé et ses sous-lignes. */
function classifierDepense(libelle, sousLignes) {
  const lib = libelle.toUpperCase();
  const descs = sousLignes.map(l => l.libelle.toUpperCase()).join(' ');
  const tout = `${lib} ${descs}`;

  // 1. Versements bancaires & mouvements de trésorerie
  if (
    ['VERSEMENT', 'VERSEMNET', 'VERSMENT', 'VERSEMEN', 'VESREMENT', 'BNI', 'BFV', 'BOA', 'APPRO CAISSE', 'ECHANGE CHEQUE', 'REGULARISATION MVOLA'].some(k => tout.includes(k))
    && !['REMBOURSEMENT', 'SALAIRE', 'INDEMNITE', 'FRAIS MEDICAUX'].some(k => tout.includes(k))
  ) {
    return 'Versements bancaires';
  }

  // 2. Remboursements & rétrocessions patients / factures
  if (
    ['REMBOURSEMENT', 'RAMBOURSEMENT', 'REMBOURSSEMENT', 'REMBOURSEMEN', 'REMBOURSEMET', 'REMBOURSMENT', 'REMBOURCEMENT', 'REMB ', 'RETOUR ', 'AVOIR FACTURE'].some(k => tout.includes(k))
  ) {
    return 'Remboursements & rétrocessions';
  }

  // 3. Salaires, avances, quinzaines, primes, indemnités et œuvres sociales du personnel
  if (
    [
      'SALAIRE', 'QUINZAINE', 'QUIZAINE', 'QUINZINE', 'AVANCE SPECIAL', 'AVANCE EXCEPTION', 'COMPLEMENT AVANCE',
      'INDEMNITE', 'INDEMINITE', 'ONDEMNITE', 'SOLDE DE TOUT COMPTE', 'PRIME', 'CONGE', 'GARDE NOUVEL AN',
      'RESTAURATION GARDE', 'RESTAURATION HEURE', 'FAMANGIANA', 'NAMANGY', 'FANAOVAMBELOMA', 'SOCIAL', 'FANOMEZANA',
      'CNAPS', 'OSTIE', 'IRSA', ' PENSION', '13EME MOIS', 'GRATIFICATION', 'EXCURSION', 'EXCURSSION',
      'EXCURTION', 'BONNE ANNEE', 'POT D\'ADIEU', 'POT ADIEU', 'RETRAITE', 'CADEAU', 'CEDEAU', 'FETE', 'FETY',
      'BAF ', 'AIDE SCOLAIRE', 'VALOPY MARIAZY', 'MONTURE LUNETTE', 'RAFRAICHISSEMENT EQUIPE', 'BONBON NOEL',
      'SAKAFO SY LAMBAHOANY', 'TENUE', 'TEE SHURT',
    ].some(k => tout.includes(k))
    || (/\b(AVANCE|PRET)\b/.test(lib) && !['CONSTRUCTION', 'TRAVAUX', 'MACHINE', 'MATERIEL', 'FOURNITURE', 'CONFECTION', 'PEINTURE', 'PLOMBERIE', 'SOUDURE', 'MENUISERIE'].some(k => lib.includes(k)))
  ) {
    return 'Salaires & primes';
  }

  // 4. Honoraires médicaux, intérimaires, vacations, analyses externes, cotisations d'ordre
  if (
    [
      'HONORAIRE', 'INTERIMAIRE', 'INTERMAIRE', 'INERIMAIRE', 'INTERIM', 'VACATION', 'BENEVOLE', 'VOLONTAIRE',
      'ANALYSE EXTERNE', 'ANALYSES EXTERNES', 'ANAPATH', 'ORDRE DE MEDECIN', 'ORDRE DU MEDECIN',
      'ORDRE DES MEDECINS', 'ORDRE DE SAGE', 'ORDRE DES INFIRMIER', 'ORDRES DES INFIRMIER', 'ORDRE D\'INFIRMIER',
      'KARATRY NY MPITSABO', 'CONTROLEUR', 'OPHTALMO', 'MAHASOLO', 'PAIEMENT DR ',
    ].some(k => tout.includes(k))
  ) {
    return 'Honoraires';
  }

  // 5. Achats de médicaments et produits pharmaceutiques
  if (
    [
      'MEDICAMENT', 'ARTESUNATE', 'ARTHESUNATE', 'PHARMACIE', 'SERUM', 'VACCIN', 'OXYGENE', 'CDM',
      'METRIS', 'LIDOCAINE', 'XYLO', 'LOXEN', 'SATERTONE', 'SUR EAU 10 FLCS', 'PARACETAMOL', 'AMOXICILLINE',
      'AMPICILLINE', 'GENTAMICINE', 'CEFTRIAXONE', 'CIPROFLOXACINE', 'METRONIDAZOLE', 'DICLOFENAC',
      'IBUPROFENE', 'OMEPRAZOLE', 'QUININE', 'INSULINE', 'ADRENALINE', 'ATROPINE', 'DIAZEPAM',
      'OXYTOCINE', 'MISOPROSTOL', 'BUPIVACAINE', 'KETAMINE', 'PROPOFOL', 'FENTANYL', 'TRAMADOL',
      'SALBUTAMOL', 'FUROSEMIDE', 'CAPTOPRIL', 'NIFEDIPINE', 'VITAMINE', 'CALCIUM', 'MAGNESIUM',
      'GLUCOSE', 'RINGER', 'SSI', 'SGI', 'BETADINE', 'DAKIN', 'EAU OXYGENEE', 'POLYVIDONE',
    ].some(k => tout.includes(k))
    && !['CREDIT PHARMACIE', 'FRAIS BAJAJ'].some(k => lib.includes(k))
  ) {
    return 'Achats médicaments';
  }

  // 6. Consommables médicaux, bloc, laboratoire, dentisterie, petit matériel médical
  if (
    [
      'PRODUIT BLOC', 'PRODUIT DENTAIRE', 'PRODUIT LABO', 'CONSOMMABLE', 'TDR',
      'EAU VIVE', 'EAU DISTILLE', 'EAU DEMINERALISE', 'CHRISTALLINE', 'CRISTALLINE', 'KIT BEBE',
      'SACHET', 'SERINGUE', 'GANT', 'COMPRESSE', 'SPARADRAP', 'ALCOOL', 'COTON', 'BANDE',
      'SONDE', 'CATHETER', 'REACTIF', 'BISTOURI', 'FIL SUTURE', 'VICRYL', 'NYLON', 'CARNET BLOC',
      'FICHE', 'CARNET', 'ORDONNANCE', 'BLOUSE', 'MASQUE', 'CHARLOTTE', 'RASOIR', 'VERRE A JETER',
      'MOUCHOIR', 'THERMOMETRE', 'TENSIOMETRE', 'ATELLE', 'PLATRE', 'RADIO', 'ECHO', 'TISSUS BLOC',
      'BAC A LINGE', 'AIGUILLE', 'PERFUSEUR', 'TRANSFUSEUR', 'TUBE', 'LAME', 'SPECULUM', 'DOIGTIER',
      'PAPIER HYGIENIQUE', 'PAPIER ESSUIE', 'GEL ', 'FORMOL', 'PETROLE LABO', 'POMPE POIRE',
      'BAVOIR DENTISTE', 'DRAP', 'BADISA',
    ].some(k => tout.includes(k))
  ) {
    return 'Consommables médicaux';
  }

  // 7. Eau, électricité, JIRAMA, gaz et matériel d'éclairage
  if (
    [
      'JIRAMA', 'ELECTRICITE', 'ELECTRIQUE', 'FACTURE EAU', 'AMPOULE', 'PRISE', 'RALONGE', 'RALLONGE',
      'INTERRUPTEUR', 'INTERUPTEUR', 'CABLE ELECTRIQUE', 'FUSIBLE', 'DISJONCTEUR', 'PILE', 'MIRA',
      'CHARBON', 'TUBE NEON', 'NEON', 'PROJECTEUR', 'LAMPE', 'TOURCHE', 'VITOGAZ', 'GAZ', 'LED ',
      '01 LED', '02 LED', 'DOUILLE', 'BALLAST', 'STARTER', 'COMPTEUR',
    ].some(k => tout.includes(k))
  ) {
    return 'Eau & électricité';
  }

  // 8. Téléphone, internet, Starlink, crédits de communication, abonnements
  if (
    [
      'STARLINK', 'INTERNET', 'WIFI', 'TELMA', 'AIRTEL', 'ORANGE', 'YAS', 'ACHAT CREDIT',
      'CREDIT RAPPORT', 'CREDIT GARDE', 'CREDIT ADMNISTRATIF', 'CREDIT ADMINISTRATIF',
      'CREDIT PHARMACIE', 'CREDIT FLOTTE', 'FLOTTE', 'FORFAIT', 'ENVOI LETTRE', 'CREDIT',
      'CANAL PLUS', 'CANAL+', 'CANAL +', 'CARTE 2 G', 'CHARGEUR', 'ABONNEMENT', 'TELEPHONE',
    ].some(k => tout.includes(k))
  ) {
    return 'Téléphone & internet';
  }

  // 9. Frais de mission, déplacements, réunions, réceptions
  if (
    [
      'MISSION', 'BILLET D\'AVION', 'BILLET AVION', 'BILLETS D\'AVION', 'VOYAGE', 'DEPLACEMENT',
      'PERDIEM', 'PER DIEM', 'HEBERGEMENT', 'HOTEL', 'NUITEE', 'SYNODE', 'JOBILY', 'FVV',
      'RESTAURATION', 'RESATAURATION', 'REUNION', 'JETON DE PRESENCE', 'JETONS CA', 'LOCATION SALLE',
      'TRAITEUR', 'RECEPTION',
    ].some(k => tout.includes(k))
  ) {
    return 'Frais de mission';
  }

  // 10. Carburant, transport, courses, expéditions de colis
  if (
    [
      'CARBURANT', 'GASOIL', 'GAZOIL', 'ESSENCE', 'LUBRIFIANT', 'HUILE MOTEUR', 'HUILE ',
      'FRAIS COLIS', 'FRAIS COLI', 'FRAIS POSY', 'POSY', 'COLIS', 'BAJAJ', 'TAXI', 'TRANSPORT',
      'DOCKER', 'NITATITRA', 'FRAIS DE ROUTE', 'LAVAGE AUTO', 'LAVAGE VOITURE', 'PNEU',
      'DISTRIBUTION', 'DISTRUB', 'ENVOI', 'COURSE', 'CYCLO', 'POUSSE', 'STATIONNEMENT', 'FREIN',
    ].some(k => tout.includes(k))
  ) {
    return 'Carburant & transport';
  }

  // 11. Fournitures de bureau, papeterie, impressions
  if (
    [
      'FOURNITURE DE BUREAU', 'FOURNITURES DE BUREAU', 'BUREAU', 'PAPIER', 'PAPER ONE', 'RAME',
      'ENVELOPPE', 'STYLO', 'CAHIER', 'REGISTRE', 'ENCRE', 'TONER', 'CARTOUCHE',
      'PHOTOCOPIE', 'IMPRESSION', 'CLASSEUR', 'INTERCALAIRE', 'AGRAFE', 'AGRAFFE', 'ATTACHE',
      'TROMBONE', 'SCOTCH', 'SCOUTCH', 'CACHET', 'CHEMISE', 'MARQUEUR', 'MARKER', 'SOULIGNEUR',
      'CORRECTEUR', 'BLOC NOTE', 'CALCULATRICE', 'TIMBRE', 'COLLE', 'CISEAU', 'REGLE',
      'ADMINISTRATIF', 'PLASTIFICATION', 'AFFICHAGE', 'RUBAN', 'ARCHIVAGE', 'RELIURE',
      'LIVRE', 'LEGALISATION',
    ].some(k => tout.includes(k))
  ) {
    return 'Fournitures de bureau';
  }

  // 12. Maintenance, travaux, réparations, équipements, mobilier, entretien
  if (
    [
      'REPARATION', 'REPARTION', 'PLOMBERIE', 'PLOMBIER', 'CONSTRUCTION', 'CONSTRUC', 'CIMENT',
      'PARPAING', 'PARPING', 'PARPIN', 'CHAUX', 'PEINTURE', 'PEINTRE', 'LOKO', 'SPRIT', 'BOMBE',
      'BOIS', 'PLANCHE', 'TOLE', 'CLOU', 'POINTE', 'VIS', 'BOULON', 'ECROU', 'SOUDURE', 'SOUDEUR',
      'MACON', 'MENUISIER', 'MENUISERIE', 'CHARPENTIER', 'ELECTRICIEN', 'MACHINE', 'MATERIEL',
      'EQUIPEMENT', 'IMPRIMANTE', 'ORDINATEUR', 'CLAVIER', 'SOURIS', 'RAM 2G', 'CARTE MERE',
      'PATES THERMIQUE', 'ROUTEUR', 'MIKROTIK', 'COFFRE FORT', 'MONITAIRE', 'MONITEUR',
      'CLIMATISEUR', 'VENTILATEUR', 'VENTILO', 'FRIGO', 'REFRIGERATEUR', 'MATELAS', 'LIT',
      'CHAISE', 'TABLE', 'ARMOIRE', 'RIDEAU', 'SERVIETTE', 'DEBAUCHAGE', 'DEBOUCHAGE',
      'DEBAUCHERT', 'VIDANGE', 'WWC', 'WC', 'ENTRETIEN', 'MAINTENANCE', 'CLE', 'SERRURE',
      'SERURE', 'CADENAS', 'VACHETTE', 'CANNON', 'PAUMELLE', 'CHARNIERE', 'VERROU', 'TARGETTE',
      'BLOC ALU', 'ROBINET', 'TUYAU', 'TYAU', 'COUDE', 'TEFLON', 'EVIER', 'LAVABO', 'DOUCHE',
      'SIPHON', 'FLEXIBLE', 'FOURNITURE INTERIEUR', 'FOURNITURES INTERIEUR', 'SAVON', 'JAVEL',
      'BALAI', 'BROUSSE', 'BROSSE', 'SERPILLERE', 'SEAU', 'BASSINE', 'POUBELLE', 'EPONGE',
      'PRODUIT ENTRETIEN', 'DESODORISANT', 'INSECTICIDE', 'MATERIAUX', 'TRAVAUX', 'NOUVEAU BLOC',
      'GROUPE', 'PRESSEUR', 'VOITURE', 'MOTO', 'BATTERIE', 'PIECE', 'BACHE', 'CHAPITEAU',
      'BARARATA', 'CABLE', 'ORDURE', 'FER', 'GRAVIER', 'SABLE', 'BRIQUE', 'CARREAU', 'VITRE',
      'PORTE', 'FENETRE', 'TOIT', 'PLAFOND', 'CONFECTION', 'CONFECT', 'DISQUE', 'TAMIS',
      'ANGADY', 'RATEAU', 'BIDON', 'JARDIN', 'COUR', 'NETTOYAGE', 'MONTRE', 'SPEAKER', 'PINCE',
      'TOURNEVIS', 'MARTEAU', 'SCIE', 'BROUETTE', 'PELLE', 'PISTON', 'RAMPE', 'FIL ',
      'MAIN D\'OEUVRE', 'MAIN D\' OEVRE', 'MARMITE', 'FATAPERA', 'TONDEUSE', 'NAMAFA',
      'DEBARRASSAGE', 'NAMONO KIDORO', 'NANDIO PANNEAU', 'NANITRANA VOANIO',
    ].some(k => tout.includes(k))
  ) {
    return 'Maintenance & équipements';
  }

  return 'Divers';
}

// ---------------------------------------------------------------------------
// 3. Lecture et mise en relation de `caisse.xlsx` et `ligne caisse.xlsx`
// ---------------------------------------------------------------------------

const lignesCaisseBrutes = lireFeuilleXlsx(join(racine, 'caisse.xlsx'));
const lignesDetailBrutes = lireFeuilleXlsx(join(racine, 'ligne caisse.xlsx'));

// Regroupement des sous-lignes par IDCAISSE_SALFA
const detailsParCaisse = new Map();
for (let i = 1; i < lignesDetailBrutes.length; i++) {
  const r = lignesDetailBrutes[i];
  if (!r || !r[1]) continue;
  const idDetail = String(r[1]).trim();
  const libelle = nettoyerTexte(r[2] || 'DÉTAIL');
  const montant = Math.round(Number(r[3] || 0));
  const idCaisse = String(r[4]).trim();

  if (!detailsParCaisse.has(idCaisse)) {
    detailsParCaisse.set(idCaisse, []);
  }
  detailsParCaisse.get(idCaisse).push({
    id: idDetail,
    libelle,
    montant,
  });
}

// Correction de la saisie 3603 (2025-02-25, INDEMNITE ET DIVERS RETENUE DR ULIC, crédit 968 300 Ar) :
// Les deux retenues (avance sur salaire 200 000 Ar et frais médicaux 31 700 Ar) avaient été saisies
// sans le signe moins dans l'ancien logiciel (1 200 000 - 200 000 - 31 700 = 968 300 Ar).
if (detailsParCaisse.has('3603')) {
  for (const d of detailsParCaisse.get('3603')) {
    if ((d.id === '10278' || d.id === '10279') && d.montant > 0) {
      d.montant = -d.montant;
    }
  }
}

// Lecture des écritures parentes
const ecrituresBrutes = [];
for (let i = 1; i < lignesCaisseBrutes.length; i++) {
  const r = lignesCaisseBrutes[i];
  if (!r || !r[1]) continue;
  const id = String(r[1]).trim();
  const date = dateExcelVersIso(r[2]);
  const libelle = nettoyerTexte(r[3] || 'OPÉRATION');
  const debit = Math.round(Number(r[4] || 0));
  const credit = Math.round(Number(r[5] || 0));
  const observation = nettoyerTexte(r[6] || '');
  const sens = debit > 0 ? 'RECETTE' : 'DEPENSE';
  const montant = debit > 0 ? debit : credit;

  const sousLignes = detailsParCaisse.get(id) || [];
  if (sousLignes.length === 0) {
    throw new Error(`Aucune sous-ligne trouvée pour IDCAISSE_SALFA=${id}`);
  }
  const sommeDetails = sousLignes.reduce((acc, d) => acc + d.montant, 0);
  if (sommeDetails !== montant) {
    throw new Error(
      `Incohérence de montant sur IDCAISSE_SALFA=${id} (${libelle}) : parent=${montant}, somme détails=${sommeDetails}`,
    );
  }

  const categorie = sens === 'RECETTE'
    ? classifierRecette(libelle, sousLignes)
    : classifierDepense(libelle, sousLignes);

  ecrituresBrutes.push({
    id,
    idNum: Number(id),
    date,
    annee: Number(date.slice(0, 4)),
    sens,
    libelle,
    categorie,
    observation: observation || undefined,
    montant,
    lignesDetail: sousLignes.map((d, ordre) => ({
      id: d.id,
      libelle: d.libelle,
      montant: d.montant,
      ordre,
    })),
  });
}

// Tri chronologique par date puis par IDCAISSE_SALFA croissant
ecrituresBrutes.sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.idNum - b.idNum;
});

// Attribution des numéros de pièce (RC-AAAA-NNNN / DP-AAAA-NNNN) et horodatages déterministes
const compteurs = {};
const indexParJour = new Map();

for (const e of ecrituresBrutes) {
  const prefixe = e.sens === 'RECETTE' ? 'RC' : 'DP';
  const cleCompteur = `${prefixe}-${e.annee}`;
  compteurs[cleCompteur] = (compteurs[cleCompteur] || 0) + 1;
  e.numero = `${cleCompteur}-${String(compteurs[cleCompteur]).padStart(4, '0')}`;

  // Horodatage séquentiel dans la journée (à partir de 08:00:00) pour garantir
  // le même ordre de tri entre MySQL (ORDER BY date, cree_le, id) et le front-end.
  const rangJour = indexParJour.get(e.date) || 0;
  indexParJour.set(e.date, rangJour + 1);
  const secondesTotales = 8 * 3600 + rangJour;
  const hh = String(Math.floor(secondesTotales / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secondesTotales % 3600) / 60)).padStart(2, '0');
  const ss = String(secondesTotales % 60).padStart(2, '0');
  e.creeLeSql = `${e.date} ${hh}:${mm}:${ss}.000`;
  e.createdAtIso = `${e.date}T${hh}:${mm}:${ss}.000Z`;
}

// Séparation par exercice :
// - 2024 : exercice clôturé (1 écriture, solde d'ouverture 0 -> solde de clôture 12 596 600 Ar)
// - 2025 : exercice clôturé (3 580 écritures, solde d'ouverture 12 596 600 Ar -> solde de clôture 4 626 500 Ar)
// - 2026 : exercice ouvert en cours (3 761 écritures, solde d'ouverture reporté 4 626 500 Ar -> solde actuel 17 097 930 Ar)
const parAnnee = new Map();
for (const e of ecrituresBrutes) {
  if (!parAnnee.has(e.annee)) parAnnee.set(e.annee, []);
  parAnnee.get(e.annee).push(e);
}

function calculerTotaux(liste, soldeOuverture) {
  let recettes = 0;
  let depenses = 0;
  for (const e of liste) {
    if (e.sens === 'RECETTE') recettes += e.montant;
    else depenses += e.montant;
  }
  return {
    soldeOuverture,
    recettes,
    depenses,
    soldeCloture: soldeOuverture + recettes - depenses,
  };
}

const ecritures2024 = parAnnee.get(2024) || [];
const totaux2024 = calculerTotaux(ecritures2024, 0);

const ecritures2025 = parAnnee.get(2025) || [];
const totaux2025 = calculerTotaux(ecritures2025, totaux2024.soldeCloture);

const ecritures2026 = parAnnee.get(2026) || [];
const totaux2026 = calculerTotaux(ecritures2026, totaux2025.soldeCloture);

// ---------------------------------------------------------------------------
// 4. Génération du SQL (`salfa_install.sql` et `sauvegarde_caisse_salfa.sql`)
// ---------------------------------------------------------------------------

function sqlTexte(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function construireBlocsDonneesSql({ modeRemplacement = false } = {}) {
  const lignesSql = [];

  if (modeRemplacement) {
    lignesSql.push('-- Nettoyage préalable des écritures existantes avant import de la sauvegarde');
    lignesSql.push('DELETE FROM salfa_details;');
    lignesSql.push('DELETE FROM salfa_ecritures;');
    lignesSql.push('DELETE FROM salfa_clotures;');
    lignesSql.push('DELETE FROM salfa_compteurs;');
    lignesSql.push('');
  }

  lignesSql.push('-- Livre unique et paramètres de l\'exercice 2026 ouvert (report 2025 : 4 626 500 Ar)');
  lignesSql.push('INSERT INTO salfa_livre (id, revision) VALUES (1, 1)');
  lignesSql.push('  ON DUPLICATE KEY UPDATE revision = GREATEST(revision, VALUES(revision));');
  lignesSql.push(
    `INSERT INTO salfa_parametres (id, solde_initial, exercice, report_annee, report_solde) VALUES (1, ${totaux2025.soldeCloture}, 2026, 2025, ${totaux2025.soldeCloture})`,
  );
  lignesSql.push(
    '  ON DUPLICATE KEY UPDATE solde_initial = VALUES(solde_initial), exercice = VALUES(exercice), report_annee = VALUES(report_annee), report_solde = VALUES(report_solde);',
  );
  lignesSql.push('');

  // Clôtures 2024 et 2025
  lignesSql.push('-- Exercices clôturés (2024 et 2025)');
  lignesSql.push(
    'INSERT INTO salfa_clotures (annee, cloture_le, solde_ouverture, recettes, depenses, solde_cloture) VALUES',
  );
  lignesSql.push(
    `  (2024, '2024-12-31 23:59:59.000', ${totaux2024.soldeOuverture}, ${totaux2024.recettes}, ${totaux2024.depenses}, ${totaux2024.soldeCloture}),`,
  );
  lignesSql.push(
    `  (2025, '2025-12-31 23:59:59.000', ${totaux2025.soldeOuverture}, ${totaux2025.recettes}, ${totaux2025.depenses}, ${totaux2025.soldeCloture})`,
  );
  lignesSql.push(
    '  ON DUPLICATE KEY UPDATE cloture_le = VALUES(cloture_le), solde_ouverture = VALUES(solde_ouverture), recettes = VALUES(recettes), depenses = VALUES(depenses), solde_cloture = VALUES(solde_cloture);',
  );
  lignesSql.push('');

  // Compteurs de numérotation
  lignesSql.push('-- Compteurs de pièces par exercice');
  const entreesCompteurs = Object.entries(compteurs).sort(([a], [b]) => a.localeCompare(b));
  lignesSql.push('INSERT INTO salfa_compteurs (cle, valeur) VALUES');
  lignesSql.push(
    entreesCompteurs.map(([cle, val]) => `  (${sqlTexte(cle)}, ${val})`).join(',\n'),
  );
  lignesSql.push('  ON DUPLICATE KEY UPDATE valeur = VALUES(valeur);');
  lignesSql.push('');

  // Écritures de caisse par lots de 250
  lignesSql.push(`-- Écritures de caisse (${ecrituresBrutes.length} pièces : 2024, 2025 et 2026)`);
  const TAILLE_LOT_ECRITURES = 250;
  for (let i = 0; i < ecrituresBrutes.length; i += TAILLE_LOT_ECRITURES) {
    const lot = ecrituresBrutes.slice(i, i + TAILLE_LOT_ECRITURES);
    lignesSql.push(
      'INSERT INTO salfa_ecritures (id, numero, date, sens, libelle, categorie, tiers, reference, observation, montant, annee_archive, cree_le, modifie_le) VALUES',
    );
    lignesSql.push(
      lot
        .map(e => {
          const anneeArchive = e.annee < 2026 ? String(e.annee) : 'NULL';
          return `  (${sqlTexte(e.id)}, ${sqlTexte(e.numero)}, ${sqlTexte(e.date)}, ${sqlTexte(e.sens)}, ${sqlTexte(e.libelle)}, ${sqlTexte(e.categorie)}, NULL, NULL, ${sqlTexte(e.observation)}, ${e.montant}, ${anneeArchive}, ${sqlTexte(e.creeLeSql)}, NULL)`;
        })
        .join(',\n'),
    );
    lignesSql.push(
      '  ON DUPLICATE KEY UPDATE numero = VALUES(numero), date = VALUES(date), sens = VALUES(sens), libelle = VALUES(libelle), categorie = VALUES(categorie), observation = VALUES(observation), montant = VALUES(montant), annee_archive = VALUES(annee_archive), cree_le = VALUES(cree_le);',
    );
  }
  lignesSql.push('');

  // Sous-lignes de détail par lots de 500
  const tousLesDetails = [];
  for (const e of ecrituresBrutes) {
    for (const d of e.lignesDetail) {
      tousLesDetails.push({
        id: d.id,
        ecritureId: e.id,
        libelle: d.libelle,
        montant: d.montant,
        ordre: d.ordre,
      });
    }
  }

  lignesSql.push(`-- Lignes de détail (${tousLesDetails.length} sous-lignes liées aux ${ecrituresBrutes.length} écritures)`);
  const TAILLE_LOT_DETAILS = 500;
  for (let i = 0; i < tousLesDetails.length; i += TAILLE_LOT_DETAILS) {
    const lot = tousLesDetails.slice(i, i + TAILLE_LOT_DETAILS);
    lignesSql.push(
      'INSERT INTO salfa_details (id, ecriture_id, libelle, reference, montant, ordre) VALUES',
    );
    lignesSql.push(
      lot
        .map(
          d =>
            `  (${sqlTexte(d.id)}, ${sqlTexte(d.ecritureId)}, ${sqlTexte(d.libelle)}, NULL, ${d.montant}, ${d.ordre})`,
        )
        .join(',\n'),
    );
    lignesSql.push(
      '  ON DUPLICATE KEY UPDATE ecriture_id = VALUES(ecriture_id), libelle = VALUES(libelle), montant = VALUES(montant), ordre = VALUES(ordre);',
    );
  }

  return lignesSql.join('\n');
}

// Lecture de l'en-tête de schéma de `salfa_install.sql` (jusqu'à "-- Livre unique et paramètres initiaux")
const cheminInstallSql = join(racine, 'deploy', 'wamp', 'api', 'installation', 'salfa_install.sql');
const installActuel = readFileSync(cheminInstallSql, 'utf8');
const marqueurLivre = '-- Livre unique et paramètres';
const indexMarqueur = installActuel.indexOf(marqueurLivre);
if (indexMarqueur < 0) {
  throw new Error('Marqueur "-- Livre unique et paramètres" introuvable dans salfa_install.sql');
}
const schemaTablesSql = installActuel.slice(0, indexMarqueur).trimEnd();

const blocCategoriesEtMasquesSql = `-- Catégories de saisie par défaut, séparées par sens (modifiables depuis l'application)
INSERT INTO salfa_categories (sens, nom, ordre) VALUES
  ('RECETTE', 'Recettes journalières', 0),
  ('RECETTE', 'Consultations', 1),
  ('RECETTE', 'Pharmacie', 2),
  ('RECETTE', 'Laboratoire', 3),
  ('RECETTE', 'Hospitalisation', 4),
  ('RECETTE', 'Maternité', 5),
  ('RECETTE', 'Imagerie', 6),
  ('RECETTE', 'Subventions & dons', 7),
  ('RECETTE', 'Remboursements', 8),
  ('RECETTE', 'Autres recettes', 9),
  ('DEPENSE', 'Achats médicaments', 0),
  ('DEPENSE', 'Consommables médicaux', 1),
  ('DEPENSE', 'Fournitures de bureau', 2),
  ('DEPENSE', 'Carburant & transport', 3),
  ('DEPENSE', 'Maintenance & équipements', 4),
  ('DEPENSE', 'Salaires & primes', 5),
  ('DEPENSE', 'Frais de mission', 6),
  ('DEPENSE', 'Honoraires', 7),
  ('DEPENSE', 'Eau & électricité', 8),
  ('DEPENSE', 'Téléphone & internet', 9),
  ('DEPENSE', 'Remboursements & rétrocessions', 10),
  ('DEPENSE', 'Versements bancaires', 11),
  ('DEPENSE', 'Divers', 12)
  ON DUPLICATE KEY UPDATE nom = nom;

-- Modèles de saisie par défaut (facultatifs, supprimables depuis l'application)
INSERT INTO salfa_masques (id, nom, sens, description, ordre) VALUES
  ('masque-recettes-hopital', 'Bordereau recettes hôpital', 'RECETTE', 'Les 12 postes du carnet de caisse hospitalier.', 0),
  ('masque-depenses-courantes', 'Charges courantes & fonctionnement', 'DEPENSE', 'Dépenses périodiques d’exploitation.', 1)
  ON DUPLICATE KEY UPDATE nom = VALUES(nom);

-- Réexécutable : les postes des deux modèles livrés sont remplacés, pas dupliqués.
DELETE FROM salfa_masque_lignes WHERE masque_id IN ('masque-recettes-hopital', 'masque-depenses-courantes');

INSERT INTO salfa_masque_lignes (masque_id, description, montant_defaut, ordre) VALUES
  ('masque-recettes-hopital', 'CONSULTATION', NULL, 0),
  ('masque-recettes-hopital', 'ECHOGRAPHIE', NULL, 1),
  ('masque-recettes-hopital', 'CHAMBRE', NULL, 2),
  ('masque-recettes-hopital', 'LABORATOIRE', NULL, 3),
  ('masque-recettes-hopital', 'MATERNITE', NULL, 4),
  ('masque-recettes-hopital', 'MEDICAMENT', NULL, 5),
  ('masque-recettes-hopital', 'SOINS', NULL, 6),
  ('masque-recettes-hopital', 'HOSPITALISATION', NULL, 7),
  ('masque-recettes-hopital', 'DENTISTERIE', NULL, 8),
  ('masque-recettes-hopital', 'BLOC', NULL, 9),
  ('masque-recettes-hopital', 'DIVERS', NULL, 10),
  ('masque-recettes-hopital', 'VACCIN', NULL, 11),
  ('masque-depenses-courantes', 'ACHATS MEDICAMENTS', NULL, 0),
  ('masque-depenses-courantes', 'FOURNITURES MEDICALES', NULL, 1),
  ('masque-depenses-courantes', 'CARBURANT', NULL, 2),
  ('masque-depenses-courantes', 'EAU & ELECTRICITE', NULL, 3),
  ('masque-depenses-courantes', 'ENTRETIEN & REPARATIONS', NULL, 4);`;

// 4a. Mise à jour de `deploy/wamp/api/installation/salfa_install.sql`
const nouveauInstallSql = `${schemaTablesSql}\n\n${blocCategoriesEtMasquesSql}\n\n${construireBlocsDonneesSql({ modeRemplacement: false })}\n`;
writeFileSync(cheminInstallSql, nouveauInstallSql, 'utf8');

// 4b. Génération de `sauvegarde_caisse_salfa.sql` à la racine du dépôt
const sqlSauvegardeRacine = `-- ============================================================================
-- CAISSE SALFA — Sauvegarde SQL complète migrée depuis l'ancien logiciel
-- Source : caisse.xlsx (7 342 écritures) + ligne caisse.xlsx (19 231 lignes)
-- ============================================================================
-- Relations préservées :
--   - salfa_ecritures.id = IDCAISSE_SALFA (7 342 écritures de caisse)
--   - salfa_details.id   = IDLIGNE_CAISSE (19 231 sous-lignes liées via ecriture_id)
-- Exercices :
--   - 2024 (clôturé) :   1 écriture  | Solde clôture :  12 596 600 Ar
--   - 2025 (clôturé) : 3 580 écritures | Solde clôture :   4 626 500 Ar
--   - 2026 (ouvert)  : 3 761 écritures | Solde actuel  :  17 097 930 Ar
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+03:00';

${schemaTablesSql.split('\n').slice(10).join('\n')}

${blocCategoriesEtMasquesSql}

${construireBlocsDonneesSql({ modeRemplacement: true })}

-- Comptes de départ (mots de passe par défaut : admin123 / comptable123)
INSERT INTO salfa_utilisateurs (identifiant, nom_complet, mdp_hash, role, actif) VALUES
  ('admin', 'Administrateur SALFA', '$2y$10$ebBbfpC7B4.N95cDdkcF0Ohs7yffBpL1sHM8pL812jG6.AfdWKy4m', 'admin', 1),
  ('comptable', 'Comptable SALFA', '$2y$10$f6d6fW/m/H/iA.6s/p1lUeh5I5F530B1mD6iT4N.8uT.G076w5S8m', 'comptable', 1)
ON DUPLICATE KEY UPDATE
  nom_complet = VALUES(nom_complet),
  actif = 1;
`;
writeFileSync(join(racine, 'sauvegarde_caisse_salfa.sql'), sqlSauvegardeRacine, 'utf8');

// ---------------------------------------------------------------------------
// 5. Génération de `sauvegarde_caisse_salfa.json` (format CAISSE-SALFA v1)
// ---------------------------------------------------------------------------

function formaterEcritureJson(e) {
  return {
    id: e.id,
    numero: e.numero,
    date: e.date,
    sens: e.sens,
    libelle: e.libelle,
    categorie: e.categorie,
    ...(e.observation ? { observation: e.observation } : {}),
    montant: e.montant,
    lignesDetail: e.lignesDetail.map(d => ({
      id: d.id,
      libelle: d.libelle,
      montant: d.montant,
    })),
    createdAt: e.createdAtIso,
  };
}

const sauvegardeJson = {
  format: 'CAISSE-SALFA',
  version: 1,
  exportedAt: '2026-11-06T12:00:00.000Z',
  revision: 1,
  updatedAt: '2026-11-06T12:00:00.000Z',
  parametres: {
    soldeInitial: totaux2025.soldeCloture,
    exercice: 2026,
    reportPrecedent: {
      annee: 2025,
      solde: totaux2025.soldeCloture,
    },
  },
  categories: {
    recette: [
      'Recettes journalières',
      'Consultations',
      'Pharmacie',
      'Laboratoire',
      'Hospitalisation',
      'Maternité',
      'Imagerie',
      'Subventions & dons',
      'Remboursements',
      'Autres recettes',
    ],
    depense: [
      'Achats médicaments',
      'Consommables médicaux',
      'Fournitures de bureau',
      'Carburant & transport',
      'Maintenance & équipements',
      'Salaires & primes',
      'Frais de mission',
      'Honoraires',
      'Eau & électricité',
      'Téléphone & internet',
      'Remboursements & rétrocessions',
      'Versements bancaires',
      'Divers',
    ],
  },
  compteurs,
  masques: [
    {
      id: 'masque-recettes-hopital',
      nom: 'Bordereau recettes hôpital',
      sens: 'RECETTE',
      description: 'Les 12 postes du carnet de caisse hospitalier.',
      lignes: [
        { description: 'CONSULTATION' },
        { description: 'ECHOGRAPHIE' },
        { description: 'CHAMBRE' },
        { description: 'LABORATOIRE' },
        { description: 'MATERNITE' },
        { description: 'MEDICAMENT' },
        { description: 'SOINS' },
        { description: 'HOSPITALISATION' },
        { description: 'DENTISTERIE' },
        { description: 'BLOC' },
        { description: 'DIVERS' },
        { description: 'VACCIN' },
      ],
    },
    {
      id: 'masque-depenses-courantes',
      nom: 'Charges courantes & fonctionnement',
      sens: 'DEPENSE',
      description: 'Dépenses périodiques d’exploitation.',
      lignes: [
        { description: 'ACHATS MEDICAMENTS' },
        { description: 'FOURNITURES MEDICALES' },
        { description: 'CARBURANT' },
        { description: 'EAU & ELECTRICITE' },
        { description: 'ENTRETIEN & REPARATIONS' },
      ],
    },
  ],
  ecritures: ecritures2026.map(formaterEcritureJson),
  exercicesClotures: [
    {
      annee: 2024,
      clotureLe: '2024-12-31T23:59:59.000Z',
      soldeOuverture: totaux2024.soldeOuverture,
      recettes: totaux2024.recettes,
      depenses: totaux2024.depenses,
      soldeCloture: totaux2024.soldeCloture,
      ecritures: ecritures2024.map(formaterEcritureJson),
    },
    {
      annee: 2025,
      clotureLe: '2025-12-31T23:59:59.000Z',
      soldeOuverture: totaux2025.soldeOuverture,
      recettes: totaux2025.recettes,
      depenses: totaux2025.depenses,
      soldeCloture: totaux2025.soldeCloture,
      ecritures: ecritures2025.map(formaterEcritureJson),
    },
  ],
};

writeFileSync(
  join(racine, 'sauvegarde_caisse_salfa.json'),
  JSON.stringify(sauvegardeJson),
  'utf8',
);

// Affichage du récapitulatif
const statsCategories = {};
for (const e of ecrituresBrutes) {
  const cle = `${e.sens} | ${e.categorie}`;
  if (!statsCategories[cle]) statsCategories[cle] = { nb: 0, total: 0 };
  statsCategories[cle].nb += 1;
  statsCategories[cle].total += e.montant;
}

console.log('✓ Import Excel terminé avec succès :');
console.log(`  - Écritures totales (caisse.xlsx)       : ${ecrituresBrutes.length}`);
console.log(`  - Sous-lignes totales (ligne caisse.xlsx): ${lignesDetailBrutes.length - 1}`);
console.log(`  - Exercice 2024 (clôturé) : ${ecritures2024.length} écriture(s), solde clôture = ${totaux2024.soldeCloture.toLocaleString('fr-FR')} Ar`);
console.log(`  - Exercice 2025 (clôturé) : ${ecritures2025.length} écriture(s), solde clôture = ${totaux2025.soldeCloture.toLocaleString('fr-FR')} Ar`);
console.log(`  - Exercice 2026 (ouvert)  : ${ecritures2026.length} écriture(s), solde actuel  = ${totaux2026.soldeCloture.toLocaleString('fr-FR')} Ar`);
console.log('\nRépartition par catégorie :');
for (const [cle, val] of Object.entries(statsCategories).sort((a, b) => b[1].nb - a[1].nb)) {
  console.log(`  ${cle.padEnd(42)} : ${String(val.nb).padStart(4)} écritures | ${val.total.toLocaleString('fr-FR').padStart(16)} Ar`);
}
