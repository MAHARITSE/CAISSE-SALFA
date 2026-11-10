import { describe, expect, it } from 'vitest';
import { initiales, nomProfil } from './App';

describe('présentation du profil dans l’en-tête', () => {
  it('évite de répéter le rôle ajouté au nom et ne prend pas le tiret comme initiale', () => {
    expect(nomProfil('Lydia — Caissière', 'Caissière')).toBe('Lydia');
    expect(initiales(nomProfil('Lydia — Caissière', 'Caissière'))).toBe('L');
    expect(initiales('Lydia — Caissière')).toBe('LC');
  });
  it('préserve les noms ordinaires et les noms composés', () => {
    expect(nomProfil('Jean - Paul', 'Caissière')).toBe('Jean - Paul');
    expect(initiales('Jean - Paul')).toBe('JP');
    expect(initiales('---')).toBe('CS');
  });
});
