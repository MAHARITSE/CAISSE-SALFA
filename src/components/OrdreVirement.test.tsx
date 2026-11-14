import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  COTES_ORDRE_VIR,
  FeuilleOrdreVirement,
  ModaleOrdreVirement,
  decouperRib,
  hauteurTotaleFeuille,
  montantOrdre,
} from './OrdreVirement';
import { enteteParDefaut } from '../utils/entete';
import type { CompteVirement, Virement } from '../utils/virements';

const compte: CompteVirement = {
  id: 'b1', banque: 'BNI/C', numeroCompte: '00005 00041 43200100200 85',
  titulaire: 'SALFA — HOPITALY LOTERANA TOLIARY TANAMBAO', adresse: 'BP 99 — Toliara', codeBanque: '00005',
};

const virement: Virement = {
  id: 'v1', numero: 'VD-2026-0007', compteId: 'b1', date: '2026-11-12', sens: 'DEPENSE',
  libelle: 'ACHAT OXYGENE', categorie: 'Médical', tiers: 'SOCIETE OXYGENE MADA',
  reference: 'FACT-2026-118', observation: 'Urgence pédiatrie', montant: 2_657_400,
  beneficiaireAdresse: 'Lot II M 45 Antananarivo', beneficiaireBanque: 'BOA', beneficiaireCompte: '00004 00010 98765432101 42',
  createdAt: '2026-11-12T08:00:00.000Z',
};

describe('ordre de virement bancaire (formulaire BNI 114018)', () => {
  it('reproduit le formulaire BNI Madagascar 114018 en un seul exemplaire, sans souche ni trait de découpe', () => {
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const logo = container.querySelector('img.ordre-virement__logo') as HTMLImageElement;
    expect(logo).not.toBeNull();
    expect(logo.alt).toBe('BNI Madagascar');
    expect(logo.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(screen.getByLabelText('Ordre de virement')).toBeInTheDocument();
    expect(screen.queryByText(/Découper ici/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/moitié haute/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/souche/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/EXEMPLAIRE BANQUE/i)).not.toBeInTheDocument();
    expect(COTES_ORDRE_VIR.hauteurOrdre).toBe(114);
    expect(COTES_ORDRE_VIR.margeFeuille + COTES_ORDRE_VIR.hauteurOrdre).toBeLessThanOrEqual(COTES_ORDRE_VIR.demiFeuille);
    expect(container.querySelectorAll('.ordre-virement-feuille__cadre')).toHaveLength(1);
    expect(container.querySelectorAll('.ordre-virement')).toHaveLength(1);
    // Un seul cadre bénéficiaire « Virer au crédit du compte de » (sans second cadre vierge n° 2).
    expect(container.querySelectorAll('.ordre-virement__beneficiaire')).toHaveLength(1);
    expect(screen.getAllByText('VIRER AU CREDIT DU COMPTE DE')).toHaveLength(1);
    expect([...container.querySelectorAll('.ordre-virement__rang')].map(r => r.textContent)).toEqual(['1']);
  });

  it('tient intégralement dans la moitié supérieure de la page A4 (< 148,5 mm)', () => {
    const occupe = hauteurTotaleFeuille();
    expect(occupe).toBe(2 * 6 + 114);
    expect(occupe).toBeLessThanOrEqual(COTES_ORDRE_VIR.demiFeuille);
    expect(COTES_ORDRE_VIR.hauteurFeuille - occupe).toBeGreaterThanOrEqual(COTES_ORDRE_VIR.securite);
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const feuille = container.querySelector('.ordre-virement-feuille') as HTMLElement;
    expect(feuille.style.getPropertyValue('--ordre-hauteur-ordre')).toBe('114mm');
    expect(feuille.style.getPropertyValue('--ordre-hauteur-feuille')).toBe('297mm');
    expect(feuille.style.getPropertyValue('--ordre-marge')).toBe('6mm');
  });

  it('reprend toutes les rubriques du formulaire 114018 et place le libellé en observation du donneur d’ordre', () => {
    const { container } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    for (const texte of [
      'ORDRE DE VIREMENT', 'EN ARIARY', 'CLIENT DONNEUR D’ORDRE', 'RIB (2)',
      'LES FRAIS ET COMMISSIONS', 'CORRESPONDANTS SUIVANTS LES CONDITIONS TARIFAIRES EN VIGUEUR',
      'VIRER AU CREDIT DU COMPTE DE', 'MONTANT (en chiffres)', 'Compte ou RIB (2)',
      'TOTAL A VIRER (en lettres)', 'TOTAL A VIRER (en chiffres)', 'Signature du donneur d’ordre',
      'Observations du donneur d’ordre', '(1) Cocher la case correspondante',
      '(2) RIB Relevé d’Identité Bancaire pour les établissements autres que BNI Madagascar',
      '114018 - FOCUSPrint - 11/2019',
    ]) expect(screen.getAllByText(texte).length).toBeGreaterThan(0);

    // Cadre bénéficiaire unique rempli.
    expect(screen.getAllByText('SOCIETE OXYGENE MADA')).toHaveLength(1);
    expect(screen.getAllByText('Lot II M 45 Antananarivo')).toHaveLength(1);
    expect(screen.getAllByText('BOA')).toHaveLength(1);
    expect(container).toHaveTextContent('00004 00010 98765432101 42');

    // Donneur d'ordre : titulaire, adresse et RIB dans les 4 mêmes cases (5 - 5 - 11 - 2).
    expect(screen.getAllByText('SALFA — HOPITALY LOTERANA TOLIARY TANAMBAO')).toHaveLength(1);
    expect(container).toHaveTextContent('00005 00041 43200100200 85');
    const bacs = [...container.querySelectorAll('.ordre-virement__rib-bac')];
    expect(bacs).toHaveLength(3);
    expect([...bacs[0].querySelectorAll('.ordre-virement__rib-case')].map(c => c.textContent)).toEqual([
      '00005', '00041', '43200100200', '85',
    ]);
    expect([...bacs[1].querySelectorAll('.ordre-virement__rib-case')].map(c => c.textContent)).toEqual([
      '00005', '00041', '43200100200', '85',
    ]);
    expect([...bacs[2].querySelectorAll('.ordre-virement__rib-case')].map(c => c.textContent)).toEqual([
      '00004', '00010', '98765432101', '42',
    ]);

    // Libellé du virement repris comme « Observations du donneur d'ordre ».
    const observation = container.querySelector('.ordre-virement__observation');
    expect(observation).toHaveTextContent('ACHAT OXYGENE');
    expect(observation).not.toHaveTextContent('Urgence pédiatrie');

    // Référence et date.
    expect(container.querySelector('.ordre-virement__reference')).toHaveTextContent('FACT-2026-118 — VD-2026-0007');
    expect(container.querySelector('.ordre-virement__date')).toHaveTextContent('A Toliara le 12/11/2026');
    expect(container.querySelector('.ordre-virement__signature-cadre')).not.toBeNull();
  });

  it('découpe correctement un RIB complet de 23 chiffres ou un numéro partiel dans les 4 cases du masque', () => {
    expect(decouperRib('00005 00041 43200100200 85')).toEqual({
      banque: '00005', guichet: '00041', compte: '43200100200', cle: '85',
    });
    expect(decouperRib('00005000414320010020085')).toEqual({
      banque: '00005', guichet: '00041', compte: '43200100200', cle: '85',
    });
    expect(decouperRib('00004 00010 987654')).toEqual({
      banque: '00004', guichet: '00010', compte: '987654', cle: '',
    });
    expect(decouperRib('', '00005')).toEqual({
      banque: '00005', guichet: '', compte: '', cle: '',
    });
  });

  it('écrit le montant en chiffres et en lettres avec initiales majuscules et centimes directs', () => {
    const { container, unmount } = render(<FeuilleOrdreVirement virement={{ ...virement, libelle: 'mamamamamama' }} compte={compte} entete={enteteParDefaut()} />);
    expect(montantOrdre(2_657_400)).toBe('2\u202f657\u202f400,00');
    expect(screen.getAllByText('2 657 400,00')).toHaveLength(2);
    expect(screen.getAllByText('Deux Millions Six Cent Cinquante-Sept Mille Quatre Cents Ariary')).toHaveLength(1);
    expect(container.querySelector('.ordre-virement__observation')).toHaveTextContent('MAMAMAMAMAMA');
    unmount();

    const { unmount: unmount2 } = render(<FeuilleOrdreVirement virement={{ ...virement, montant: 1_100_000.2 }} compte={compte} entete={enteteParDefaut()} />);
    expect(screen.getAllByText('1 100 000,20')).toHaveLength(2);
    expect(screen.getAllByText('Un Million Cent Mille Ariary Vingt')).toHaveLength(1);
    unmount2();

    render(<FeuilleOrdreVirement virement={{ ...virement, montant: 2_657_400.75 }} compte={compte} entete={enteteParDefaut()} />);
    expect(screen.getAllByText('2 657 400,75')).toHaveLength(2);
    expect(screen.getAllByText('Deux Millions Six Cent Cinquante-Sept Mille Quatre Cents Ariary Soixante-Quinze')).toHaveLength(1);
  });

  it('coche « occasionnel » par défaut et « permanent » sur demande', () => {
    const { unmount } = render(<FeuilleOrdreVirement virement={virement} compte={compte} entete={enteteParDefaut()} />);
    const cases = document.querySelectorAll('.ordre-virement__case-carre');
    expect([...cases].map(c => c.textContent)).toEqual(['', '✕']);
    unmount();
    render(<FeuilleOrdreVirement virement={{ ...virement, permanent: true }} compte={compte} entete={enteteParDefaut()} />);
    expect([...document.querySelectorAll('.ordre-virement__case-carre')].map(c => c.textContent)).toEqual(['✕', '']);
  });

  it('laisse en blanc les mentions absentes du virement, sans bloquer l’impression', () => {
    const { container } = render(<FeuilleOrdreVirement
      virement={{ ...virement, libelle: '', tiers: '', beneficiaireAdresse: undefined, beneficiaireBanque: undefined, beneficiaireCompte: undefined, observation: '' }}
      compte={{ id: 'b2', banque: 'BOA', numeroCompte: '' }}
      entete={entetePardefautSafe()}
    />);
    // Pour une banque autre que BNI, le nom de la banque s'affiche en texte.
    expect(container.querySelector('img.ordre-virement__logo')).toBeNull();
    expect(screen.getByText('BOA')).toBeInTheDocument();
    expect(screen.getAllByText(/HOPITALY LOTERANA TOLIARY TANAMBAO/).length).toBeGreaterThan(0);
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
