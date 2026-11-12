import { describe, expect, it } from 'vitest';
import { ajouterCompteVirement, ajouterComptesVirement, modifierCompteVirement, supprimerCompteVirement, ajouterTiers, modifierTiers, supprimerTiersVirement, ajouterVirement, modifierVirement, peutGererVirements, registreVirementsVide, validerRegistreVirements, type NouvelleOperationVirement, type Tiers } from './virements';

const compte = { id: 'b1', banque: 'BNI', numeroCompte: '000001' };
const client: Tiers = { id: 't-client', type: 'CLIENT', nom: 'Association FANILO', telephone: '034 00 000 00', adresse: 'Toliara', banque: '', numeroCompte: '' };
const fournisseur: Tiers = { id: 't-four', type: 'FOURNISSEUR', nom: 'SOCIETE OXYGENE', telephone: '020 00 000 00', adresse: 'Lot II Antananarivo', banque: 'BOA', numeroCompte: '00004 98765432101' };
/** Un registre prêt à recevoir des virements : compte bancaire et fiches. */
const base = () => ajouterTiers(ajouterTiers(ajouterCompteVirement(registreVirementsVide(), compte), client), fournisseur);
const operation: NouvelleOperationVirement = { id: 'v1', compteId: 'b1', date: '2026-03-01', sens: 'RECETTE', libelle: 'Versement', categorie: 'Divers', tiers: client.nom, tiersId: client.id, reference: '', observation: '', montant: 1000, createdAt: '2026-03-01T12:00:00Z' };
const depense: NouvelleOperationVirement = { ...operation, id: 'v-d', sens: 'DEPENSE', tiers: fournisseur.nom, tiersId: fournisseur.id };

describe('règles du registre de virements indépendant', () => {
  it('réserve la gestion au comptable et à l’administrateur', () => {
    expect(peutGererVirements('admin')).toBe(true);
    expect(peutGererVirements('comptable')).toBe(true);
    expect(peutGererVirements('caissier')).toBe(false);
  });
  it('autorise un numéro non renseigné et la modification sans casser les références', () => {
    const initial = ajouterTiers(ajouterTiers(ajouterComptesVirement(registreVirementsVide(), [
      { id: 'c', banque: 'BNI/C', numeroCompte: '' },
      { id: 'd', banque: 'BNI/D', numeroCompte: '' },
    ]), client), fournisseur);
    const avecEcriture = ajouterVirement(initial, { ...operation, compteId: 'c' });
    const modifie = modifierCompteVirement(avecEcriture, { ...initial.comptes[0], numeroCompte: 'TEST' });
    expect(modifie.ecritures[0].compteId).toBe(modifie.comptes[0].id);
    expect(modifie.comptes[1].numeroCompte).toBe('');
    expect(() => ajouterComptesVirement(initial, [{ id: 'c2', banque: 'bni/c', numeroCompte: '' }])).toThrow(/existe déjà/);
    expect(() => modifierCompteVirement(initial, { id: 'introuvable', banque: 'X', numeroCompte: '' })).toThrow(/introuvable/);
  });
  it('gère plusieurs comptes et des séries de numéros distinctes par type et année', () => {
    let registre = ajouterCompteVirement(base(), { id: 'b2', banque: 'BOA', numeroCompte: '42' });
    registre = ajouterCompteVirement(registre, { id: 'b3', banque: 'CCP', numeroCompte: '77' });
    registre = ajouterVirement(registre, operation);
    registre = ajouterVirement(registre, { ...depense, id: 'v2', compteId: 'b2' });
    registre = ajouterVirement(registre, { ...operation, id: 'v3', date: '2027-03-01' });
    expect(registre.ecritures.map(e => e.numero)).toEqual(['VR-2026-0001', 'VD-2026-0001', 'VR-2027-0001']);
    expect(registre.comptes).toHaveLength(3);
    expect(registre).not.toHaveProperty('solde');
  });
  it('refuse les comptes inconnus, les doublons et les écritures invalides', () => {
    const registre = base();
    expect(() => ajouterCompteVirement(registre, { id: 'b2', banque: 'bni', numeroCompte: '000001' })).toThrow(/existe déjà/);
    expect(() => ajouterVirement(registre, { ...operation, compteId: 'absent' })).toThrow(/introuvable/);
    expect(() => ajouterVirement(registre, { ...operation, montant: 0 })).toThrow(/positif/);
    expect(() => ajouterVirement(registre, { ...operation, date: '2026-02-30' })).toThrow(/date réelle/);
  });
  it('préserve le numéro et empêche le recyclage même après le retrait d’une pièce', () => {
    const registre = ajouterVirement(base(), operation);
    const premier = registre.ecritures[0];
    expect(modifierVirement(registre, { ...premier, libelle: 'Corrigé' }).ecritures[0].numero).toBe('VR-2026-0001');
    expect(() => modifierVirement(registre, { ...premier, sens: 'DEPENSE' })).toThrow(/identité/);
    expect(() => modifierVirement(registre, { ...premier, date: '2027-01-01' })).toThrow(/année/);
    const suivant = ajouterVirement({ ...registre, ecritures: [] }, { ...operation, id: 'v2' });
    expect(suivant.ecritures[0].numero).toBe('VR-2026-0002');
    expect(() => validerRegistreVirements({ ...registre, compteurs: {} })).toThrow(/manquant/);
  });

  it('supprime un compte sans virement et refuse celui qui en porte', () => {
    const registre = ajouterVirement(base(), operation);
    // Le compte porte la pièce : le retirer rendrait son ordre de virement orphelin.
    expect(() => supprimerCompteVirement(registre, compte.id))
      .toThrow('Ce compte porte des virements : il ne peut pas être supprimé. Corrigez son RIB plutôt.');
    const libre = ajouterComptesVirement(registre, [{ id: 'b9', banque: 'BNI/D', numeroCompte: '' }]);
    const apres = supprimerCompteVirement(libre, 'b9');
    expect(apres.comptes.map(c => c.id)).toEqual([compte.id]);
    expect(apres.ecritures).toHaveLength(1);
    expect(() => supprimerCompteVirement(apres, 'b9')).toThrow('Compte bancaire introuvable.');
  });

  it('gère les fiches clients et fournisseurs, RIB obligatoire pour un fournisseur', () => {
    const registre = base();
    expect(registre.tiers.map(t => t.type)).toEqual(['CLIENT', 'FOURNISSEUR']);
    // Un fournisseur sans RIB ne peut pas être payé par virement : la fiche est refusée.
    expect(() => ajouterTiers(registre, { id: 't-p', type: 'FOURNISSEUR', nom: 'SANS RIB', telephone: '', adresse: '', banque: '', numeroCompte: '' }))
      .toThrow(/établissement bancaire du fournisseur/i);
    expect(() => ajouterTiers(registre, { id: 't-p', type: 'FOURNISSEUR', nom: 'SANS RIB', telephone: '', adresse: '', banque: 'BOA', numeroCompte: '' }))
      .toThrow(/compte ou RIB du fournisseur/i);
    // Un client, lui, n'a rien à virer : son RIB reste vide.
    expect(() => ajouterTiers(registre, { id: 't-c2', type: 'CLIENT', nom: 'CLIENT SANS BANQUE', telephone: '', adresse: '', banque: '', numeroCompte: '' })).not.toThrow();
    // Deux fiches du même nom pour le même rôle sont un doublon.
    expect(() => ajouterTiers(registre, { ...client, id: 't-bis' })).toThrow(/déjà enregistré/);
    // Une fiche utilisée ne se supprime pas, une fiche libre oui.
    const avecVirement = ajouterVirement(registre, operation);
    expect(() => supprimerTiersVirement(avecVirement, client.id)).toThrow(/porte des virements/);
    const libre = ajouterTiers(avecVirement, { id: 't-libre', type: 'FOURNISSEUR', nom: 'AUTRE FOURNISSEUR', telephone: '', adresse: '', banque: 'BNI', numeroCompte: '00005 111' });
    expect(supprimerTiersVirement(libre, 't-libre').tiers.map(t => t.id)).not.toContain('t-libre');
    expect(() => modifierTiers(registre, { ...fournisseur, id: 'absent' })).toThrow(/introuvable/);
    expect(modifierTiers(registre, { ...fournisseur, telephone: '020 11 111 11' }).tiers.find(t => t.id === fournisseur.id)?.telephone).toBe('020 11 111 11');
  });

  it('exige un bénéficiaire enregistré, du bon type et avec son RIB pour une DED', () => {
    const registre = base();
    // Sans fiche, pas de virement : le nom et le RIB imprimés viennent d'elle.
    expect(() => ajouterVirement(registre, { ...operation, tiersId: undefined })).toThrow(/Choisissez le client/);
    // Un fournisseur ne règle pas une recette, et un client ne reçoit pas une DED.
    expect(() => ajouterVirement(registre, { ...operation, tiersId: fournisseur.id })).toThrow(/fiche client/);
    expect(() => ajouterVirement(registre, { ...depense, tiersId: client.id })).toThrow(/fiche fournisseur/);
    expect(() => ajouterVirement(registre, { ...depense, tiersId: 'absent' })).toThrow(/introuvable/);
    // Une fiche fournisseur dont le RIB a été vidé est refusée à la validation,
    // comme à l'enregistrement depuis l'écran des fiches.
    expect(() => validerRegistreVirements({
      ...registre,
      tiers: registre.tiers.map(t => t.id === fournisseur.id ? { ...t, banque: '', numeroCompte: '' } : t),
    })).toThrow(/établissement bancaire du fournisseur/);
    // Les virements saisis avant les fiches restent lisibles et modifiables :
    // leur tiers est écrit à la main, sans fiche rattachée.
    const ancien = validerRegistreVirements({
      ...registre,
      ecritures: [{ ...operation, numero: 'VR-2026-0001', tiersId: undefined, tiers: 'DONATEUR ANONYME' }],
      compteurs: { 'VR-2026': 1 },
    });
    expect(ancien.ecritures[0].tiersId).toBeUndefined();
    expect(modifierVirement(ancien, { ...ancien.ecritures[0], libelle: 'Corrigé' }).ecritures[0].libelle).toBe('Corrigé');
  });
});
