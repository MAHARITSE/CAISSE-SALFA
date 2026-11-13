import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { COTES_ORDRE_VIR, FeuilleOrdreVirement, ModaleOrdreVirement, hauteurTotaleFeuille, montantOrdre } from './OrdreVirement';
import { enteteParDefaut } from '../utils/entete';
import type { CompteVirement, Virement } from '../utils/virements';

const compte: CompteVirement = {
  id: 'b1', banque: 'BNI/C', numeroCompte: '00005 12345678901',
  titulaire: 'SALFA — HOPITALY LOTERANA TOLIARY TANAMBAO', adresse: 'BP 99 — Toliara', codeBanque: '00005',
};

const virement: Virement = {
  id: 'v1', numero: 'VD-2026-0007', compteId: 'b1', date: '2026-11-12', sens: 'DEPENSE',
  libelle: 'ACHAT OXYGENE', categorie: 'Médical', tiers: 'SOCIETE OXYGENE MADA',
  reference: 'FACT-2026-118', observation: 'Urgence pédiatrie', montant: 2_657_400,
  beneficiaireAdresse: 'Lot II M 45 Antananarivo', beneficiaireBanque: 'BOA', beneficiaireCompte: '00004 98765432101',
  createdAt: '2026-11-12T08:00:00.000Z',
};

describe('ordre de virement bancaire (formulaire BNI 114018)', () => {
  it('imprime deux ordres complets sur la même feuille A4, séparés par un trait de découpe', () => {
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    // Aucune image dans l'application : la banque est écrite en toutes lettres.
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getAllByText(/BANQUE\s*:\s*BNI\/C/)).toHaveLength(2);
    // Deux blocs : exemplaire banque et souche.
    expect(screen.getByLabelText('Ordre de virement — exemplaire pour la banque')).toBeInTheDocument();
    expect(screen.getByLabelText('Ordre de virement — souche à conserver')).toBeInTheDocument();
    expect(screen.getByText(/Découper ici/)).toBeInTheDocument();
    // Chaque moitié tient dans une demi-feuille A4 : environ 135 mm.
    expect(COTES_ORDRE_VIR.hauteurMoitie).toBe(135);
    expect(container.querySelectorAll('.ordre-virement-feuille__moitie')).toHaveLength(2);
    for (const moitie of container.querySelectorAll('.ordre-virement-feuille__moitie')) {
      expect((moitie as HTMLElement).style.height).toBe('');
      expect(moitie.querySelector('.ordre-virement')).not.toBeNull();
    }
  });

  it('tient sur une seule page A4, avec une marge de sécurité sous le second ordre', () => {
    // Les deux moitiés, la bande de découpe et les marges restent sous 297 mm :
    // aucune imprimante ne peut donc sortir une seconde page presque vide.
    const occupe = hauteurTotaleFeuille();
    expect(occupe).toBe(2 * 5 + 2 * 135 + 10);
    expect(COTES_ORDRE_VIR.hauteurFeuille - occupe).toBeGreaterThanOrEqual(COTES_ORDRE_VIR.securite);
    // Les cotes du calcul sont celles réellement appliquées à la feuille.
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const feuille = container.querySelector('.ordre-virement-feuille') as HTMLElement;
    expect(feuille.style.getPropertyValue('--ordre-hauteur-moitie')).toBe('135mm');
    expect(feuille.style.getPropertyValue('--ordre-hauteur-feuille')).toBe('297mm');
    expect(feuille.style.getPropertyValue('--ordre-marge')).toBe('5mm');
    expect(feuille.style.getPropertyValue('--ordre-hauteur-decoupe')).toBe('10mm');
  });

  it('répartit chaque bande du formulaire dans la hauteur imprimée', () => {
    // Barème vertical du CSS : la somme des bandes fixes et des réserves souples
    // doit tenir dans la moitié de feuille, sans compression ni contenu masqué.
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const bandes = [
      '.ordre-virement__entete', '.ordre-virement__client', '.ordre-virement__instruction',
      '.ordre-virement__debiter', '.ordre-virement__beneficiaire', '.ordre-virement__total',
      '.ordre-virement__signature', '.ordre-virement__observations', '.ordre-virement__date',
    ];
    for (const bande of bandes) expect(container.querySelectorAll(bande)).toHaveLength(2);
  });

  it('reprend les mentions du modèle et les informations du virement', () => {
    render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    for (const texte of [
      'ORDRE DE VIREMENT', 'EN ARIARY', 'CLIENT DONNEUR D’ORDRE', 'VIRER AU CREDIT DU COMPTE DE',
      'TOTAL A VIRER (en lettres)', 'TOTAL A VIRER (en chiffres)', 'Signature du donneur d’ordre',
      'Observations du donneur d’ordre',
    ]) expect(screen.getAllByText(texte).length).toBeGreaterThan(0);
    // Bénéficiaire, adresse, banque et compte du bénéficiaire sont imprimés.
    expect(screen.getAllByText('SOCIETE OXYGENE MADA').length).toBe(2);
    expect(screen.getAllByText('Lot II M 45 Antananarivo').length).toBe(2);
    expect(screen.getAllByText('BOA').length).toBe(2);
    expect(screen.getAllByText('00004 98765432101').length).toBe(2);
    // Donneur d'ordre : compte débité et RIB.
    expect(screen.getAllByText('00005 12345678901').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('SALFA — HOPITALY LOTERANA TOLIARY TANAMBAO').length).toBe(4);
    // Pièce et date.
    expect(screen.getAllByText('Pièce VD-2026-0007').length).toBe(2);
    expect(screen.getAllByText('A Toliara, le 12/11/2026').length).toBe(2);
  });

  it('écrit le montant en chiffres et en lettres, comme le modèle', () => {
    render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    expect(montantOrdre(2_657_400)).toBe('2\u202f657\u202f400,00');
    // Les espaces fines insécables sont normalisées par le lecteur de texte.
    expect(screen.getAllByText('2 657 400,00').length).toBe(4);
    expect(screen.getAllByText('deux millions six cent cinquante-sept mille quatre cents Ariary').length).toBe(2);
  });

  it('coche « occasionnel » par défaut et « permanent » sur demande', () => {
    const { unmount } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const cases = document.querySelectorAll('.ordre-virement__case-carre');
    // Deux blocs de deux cases : occasionnel coché, permanent vide.
    expect([...cases].map(c => c.textContent)).toEqual(['', '✕', '', '✕']);
    unmount();
    render(<FeuilleOrdreVirement virement={{ ...virement, permanent: true }} compte={compte} entete={enteteParDefaut()} />);
    expect([...document.querySelectorAll('.ordre-virement__case-carre')].map(c => c.textContent)).toEqual(['✕', '', '✕', '']);
  });

  it('laisse en blanc les mentions absentes du virement, sans bloquer l’impression', () => {
    const { container } = render(<FeuilleOrdreVirement
      virement={{ ...virement, tiers: '', beneficiaireAdresse: undefined, beneficiaireBanque: undefined, beneficiaireCompte: undefined, observation: '' }}
      compte={{ id: 'b2', banque: 'BNI/D', numeroCompte: '' }}
      entete={entetePardefautSafe()}
    />);
    // Le nom du donneur d'ordre vient de l'en-tête de l'hôpital, faute de titulaire saisi.
    expect(screen.getAllByText(/HOPITALY LOTERANA TOLIARY TANAMBAO/).length).toBeGreaterThan(0);
    // Aucune valeur inventée : les cases restent vides.
    const valeurs = [...container.querySelectorAll('.ordre-virement__valeur')].map(v => v.textContent);
    expect(valeurs).toContain('');
  });

  it('imprime directement la feuille sans aperçu et libère le registre après impression', () => {
    vi.useFakeTimers();
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => {});
    const fermer = vi.fn();
    render(<ModaleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} onFermer={fermer} />);
    expect(document.body).toHaveClass('has-print-ordre-virement');
    expect(document.querySelector('.print-ordre-virement style')?.textContent)
      .toBe('@media print { @page { size: A4 portrait; margin: 0; } }');
    act(() => vi.advanceTimersByTime(60));
    expect(imprimer).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.print-ordre-virement')).not.toBeNull();
    fireEvent(window, new Event('afterprint'));
    expect(fermer).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('libère le registre si le navigateur ne signale jamais la fin de l’impression', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const fermer = vi.fn();
    const erreur = vi.fn();
    render(<ModaleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} onFermer={fermer} onErreur={erreur} />);
    act(() => vi.advanceTimersByTime(30050));
    expect(erreur).toHaveBeenCalledTimes(1);
    expect(fermer).toHaveBeenCalledTimes(1);
  });
});

/** En-tête vide : le formulaire doit retomber sur l'identité livrée. */
function entetePardefautSafe() {
  return { ...enteteParDefaut(), lignes: [] };
}
