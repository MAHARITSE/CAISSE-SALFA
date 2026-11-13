import { describe, expect, it } from 'vitest';
import {
  ecrituresExemple, exempleDisponible, fichesExemple, fichesExempleManquantes, jeuDeDemonstration,
  registreExemple, resumeExemple, virementsExempleManquants,
} from './demonstration';
import { ajouterCompteVirement, ajouterTiers, registreVirementsVide } from './virements';
import { livreTest } from '../test/fixtures';
import { validerSauvegarde } from './validation';
import { totaliser } from './ledger';

const annee = 2026;

describe('jeu de démonstration', () => {
  it('produit des écritures numérotées par les règles réelles, dans l’exercice demandé', () => {
    const ecritures = ecrituresExemple(annee);
    expect(ecritures.length).toBeGreaterThanOrEqual(8);
    for (const e of ecritures) expect(e.date.startsWith(`${annee}-`)).toBe(true);
    // Recettes et dépenses ont chacune leur série, comme une saisie manuelle.
    expect(ecritures.filter(e => e.sens === 'RECETTE').map(e => e.numero)).toEqual(['RC-2026-0001', 'RC-2026-0002', 'RC-2026-0003']);
    expect(ecritures.filter(e => e.sens === 'DEPENSE').map(e => e.numero)).toEqual(['DP-2026-0001', 'DP-2026-0002', 'DP-2026-0003', 'DP-2026-0004', 'DP-2026-0005']);
    // Les bordereaux détaillés ont leurs lignes, dont la somme fait le total.
    const detaillee = ecritures[0];
    expect(detaillee.lignesDetail).toHaveLength(4);
    expect(detaillee.lignesDetail!.reduce((s, l) => s + l.montant, 0)).toBe(detaillee.montant);
  });

  it('crée deux comptes bancaires avec leur RIB, des fiches clients et fournisseurs, et des virements', () => {
    const registre = registreExemple(annee);
    expect(registre.comptes.map(c => c.banque)).toEqual(['BNI/C', 'BNI/D']);
    expect(registre.comptes.every(c => c.numeroCompte && c.codeBanque === '00005')).toBe(true);
    expect(registre.tiers.filter(t => t.type === 'CLIENT')).toHaveLength(4);
    expect(registre.tiers.filter(t => t.type === 'FOURNISSEUR')).toHaveLength(5);
    // Chaque fournisseur porte un RIB complet, comme l'exige la saisie d'une DED.
    for (const f of registre.tiers.filter(t => t.type === 'FOURNISSEUR')) {
      expect(f.banque).not.toBe('');
      expect(f.numeroCompte).not.toBe('');
    }
    expect(registre.ecritures.map(v => v.numero)).toEqual([
      'VR-2026-0001', 'VD-2026-0001', 'VR-2026-0002', 'VD-2026-0002', 'VD-2026-0003', 'VR-2026-0003',
    ]);
    // La DED d'exemple part avec les mentions de son ordre de virement.
    expect(registre.ecritures[1]).toMatchObject({ tiers: 'SOCIÉTÉ OXYGÈNE MADA', beneficiaireBanque: 'BOA' });
  });

  it('assemble un livre complet et valide, prêt à remplacer un livre vide', () => {
    const livre = livreTest();
    const exemple = jeuDeDemonstration(livre, annee);
    const valide = validerSauvegarde(exemple);
    expect(valide.parametres.exercice).toBe(annee);
    expect(valide.virements?.ecritures).toHaveLength(6);
    const totaux = totaliser(valide.ecritures);
    expect(totaux.recettes).toBeGreaterThan(0);
    expect(totaux.depenses).toBeGreaterThan(0);
    // La révision du livre en place est reprise : la sauvegarde la remplace ensuite.
    expect(valide.revision).toBe(livre.revision);
  });

  it('n’est proposé que sur un livre vide', () => {
    // Un livre neuf n'a rien : les exemples sont proposés ; une seule pièce les retire.
    expect(exempleDisponible(livreTest())).toBe(true);
    expect(exempleDisponible(livreTest({ ecritures: ecrituresExemple(annee) }))).toBe(false);
    expect(exempleDisponible(livreTest({ virements: registreExemple(annee) }))).toBe(false);
  });

  it('résume ce qui sera chargé, pour la confirmation', () => {
    expect(resumeExemple(annee)).toContain(`${annee}`);
    expect(resumeExemple(annee)).toMatch(/écritures de caisse et 6 virements/);
  });

  it('ajoute à un registre en service les seules fiches manquantes, jamais les virements', () => {
    const vide = registreVirementsVide();
    expect(fichesExempleManquantes(vide).comptes).toHaveLength(2);
    expect(fichesExempleManquantes(vide).tiers).toHaveLength(9);
    expect(virementsExempleManquants(vide)).toHaveLength(6);

    // BNI/C existe déjà : il n'est pas reproposé, les autres fiches si.
    const existant = ajouterCompteVirement(vide, fichesExemple().comptes[0]);
    expect(fichesExempleManquantes(existant).comptes.map(c => c.banque)).toEqual(['BNI/D']);
    const avecClient = ajouterTiers(existant, fichesExemple().tiers[0]);
    expect(fichesExempleManquantes(avecClient).tiers.map(t => t.nom)).not.toContain('ASSOCIATION FANILO');

    // Dès qu'un virement existe, plus aucun virement d'exemple n'est proposé.
    expect(virementsExempleManquants(registreExemple(annee))).toEqual([]);
  });
});
