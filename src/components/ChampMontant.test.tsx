import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChampMontant, formaterSaisieMontant, normaliserMontantDecimal } from './ChampMontant';
import { parserMontant, parserMontantDecimal } from '../utils/format';

function Conteneur({ autoriserDecimales = false }: { autoriserDecimales?: boolean }) {
  const [valeur, setValeur] = useState('');
  return <ChampMontant
    label="Montant (Ar)"
    valeur={valeur}
    onChange={setValeur}
    placeholder={autoriserDecimales ? '0,00' : '0'}
    autoriserDecimales={autoriserDecimales}
  />;
}

describe('ChampMontant (entiers de caisse et décimales des virements)', () => {
  it('garde la saisie entière stricte par défaut pour la caisse en espèces', async () => {
    const user = userEvent.setup();
    render(<Conteneur />);
    const champ = screen.getByLabelText('Montant (Ar)');
    await user.type(champ, '12500');
    expect(champ).toHaveValue('12\u202f500');
    expect(parserMontant(champ instanceof HTMLInputElement ? champ.value : '')).toBe(12500);
  });

  it('accepte deux chiffres après la virgule (ou le point) pour les virements et complète à ,00 en sortie', async () => {
    const user = userEvent.setup();
    render(<Conteneur autoriserDecimales />);
    const champ = screen.getByLabelText('Montant (Ar)') as HTMLInputElement;
    await user.type(champ, '12500,5');
    expect(champ).toHaveValue('12\u202f500,5');
    expect(parserMontantDecimal(champ.value)).toBe(12500.5);

    await user.tab();
    expect(champ).toHaveValue('12\u202f500,50');
    expect(parserMontantDecimal(champ.value)).toBe(12500.5);
  });

  it('limite à deux chiffres après la virgule et convertit le point du pavé numérique en virgule', async () => {
    const user = userEvent.setup();
    render(<Conteneur autoriserDecimales />);
    const champ = screen.getByLabelText('Montant (Ar)') as HTMLInputElement;
    await user.type(champ, '4890.759');
    expect(champ).toHaveValue('4\u202f890,75');
    expect(parserMontantDecimal(champ.value)).toBe(4890.75);
    expect(formaterSaisieMontant('0,05', false, true)).toBe('0,05');
    expect(normaliserMontantDecimal('5000')).toBe('5\u202f000,00');
  });
});
