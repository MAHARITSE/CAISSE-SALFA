import { describe, expect, it } from 'vitest';
import { ajouterCompteVirement, ajouterComptesVirement, modifierCompteVirement, ajouterVirement, modifierVirement, peutGererVirements, registreVirementsVide, validerRegistreVirements, type NouvelleOperationVirement } from './virements';

const compte = { id: 'b1', banque: 'BNI', numeroCompte: '000001' };
const operation: NouvelleOperationVirement = { id: 'v1', compteId: 'b1', date: '2026-03-01', sens: 'RECETTE', libelle: 'Versement', categorie: 'Divers', tiers: '', reference: '', observation: '', montant: 1000, createdAt: '2026-03-01T12:00:00Z' };

describe('règles du registre de virements indépendant', () => {
  it('réserve la gestion au comptable et à l’administrateur', () => {
    expect(peutGererVirements('admin')).toBe(true);
    expect(peutGererVirements('comptable')).toBe(true);
    expect(peutGererVirements('caissier')).toBe(false);
  });
  it('autorise un numéro non renseigné et la modification sans casser les références', () => {
    const initial = ajouterComptesVirement(registreVirementsVide(), [
      { id: 'c', banque: 'BNI/C', numeroCompte: '' },
      { id: 'd', banque: 'BNI/D', numeroCompte: '' },
    ]);
    const avecEcriture = ajouterVirement(initial, { ...operation, compteId: 'c' });
    const modifie = modifierCompteVirement(avecEcriture, { ...initial.comptes[0], numeroCompte: 'TEST' });
    expect(modifie.ecritures[0].compteId).toBe(modifie.comptes[0].id);
    expect(modifie.comptes[1].numeroCompte).toBe('');
    expect(() => ajouterComptesVirement(initial, [{ id: 'c2', banque: 'bni/c', numeroCompte: '' }])).toThrow(/existe déjà/);
    expect(() => modifierCompteVirement(initial, { id: 'introuvable', banque: 'X', numeroCompte: '' })).toThrow(/introuvable/);
  });
  it('gère plusieurs comptes et des séries de numéros distinctes par type et année', () => {
    let registre = ajouterCompteVirement(registreVirementsVide(), compte);
    registre = ajouterCompteVirement(registre, { id: 'b2', banque: 'BOA', numeroCompte: '42' });
    registre = ajouterVirement(registre, operation);
    registre = ajouterVirement(registre, { ...operation, id: 'v2', compteId: 'b2', sens: 'DEPENSE' });
    registre = ajouterVirement(registre, { ...operation, id: 'v3', date: '2027-03-01' });
    expect(registre.ecritures.map(e => e.numero)).toEqual(['VR-2026-0001', 'VD-2026-0001', 'VR-2027-0001']);
    expect(registre.comptes).toHaveLength(2);
    expect(registre).not.toHaveProperty('solde');
  });
  it('refuse les comptes inconnus, les doublons et les écritures invalides', () => {
    const registre = ajouterCompteVirement(registreVirementsVide(), compte);
    expect(() => ajouterCompteVirement(registre, { id: 'b2', banque: 'bni', numeroCompte: '000001' })).toThrow(/existe déjà/);
    expect(() => ajouterVirement(registre, { ...operation, compteId: 'absent' })).toThrow(/introuvable/);
    expect(() => ajouterVirement(registre, { ...operation, montant: 0 })).toThrow(/positif/);
    expect(() => ajouterVirement(registre, { ...operation, date: '2026-02-30' })).toThrow(/date réelle/);
  });
  it('préserve le numéro et empêche le recyclage même après le retrait d’une pièce', () => {
    const registre = ajouterVirement(ajouterCompteVirement(registreVirementsVide(), compte), operation);
    const premier = registre.ecritures[0];
    expect(modifierVirement(registre, { ...premier, libelle: 'Corrigé' }).ecritures[0].numero).toBe('VR-2026-0001');
    expect(() => modifierVirement(registre, { ...premier, sens: 'DEPENSE' })).toThrow(/identité/);
    expect(() => modifierVirement(registre, { ...premier, date: '2027-01-01' })).toThrow(/année/);
    const suivant = ajouterVirement({ ...registre, ecritures: [] }, { ...operation, id: 'v2' });
    expect(suivant.ecritures[0].numero).toBe('VR-2026-0002');
    expect(() => validerRegistreVirements({ ...registre, compteurs: {} })).toThrow(/manquant/);
  });
});
