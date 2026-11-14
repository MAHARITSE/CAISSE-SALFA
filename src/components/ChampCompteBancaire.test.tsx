import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ChampCompteBancaire,
  MASQUE_COMPTE_BANCAIRE,
  formaterCompteBancaire,
  formaterSaisieCompteBancaire,
} from './ChampCompteBancaire';

function Conteneur() {
  const [valeur, setValeur] = useState('');
  return <ChampCompteBancaire label="Numéro de compte / RIB" valeur={valeur} onChange={setValeur} />;
}

describe('masque de saisie des numéros de compte bancaire', () => {
  it('groupe les chiffres en 5 - 5 - 11 - 2 comme 00005 00041 43200100200 85', () => {
    expect(formaterSaisieCompteBancaire('00005000414320010020085')).toBe('00005 00041 43200100200 85');
    expect(formaterSaisieCompteBancaire('00005-00041-43200100200-85999')).toBe('00005 00041 43200100200 85');
    expect(formaterSaisieCompteBancaire('0000500041')).toBe('00005 00041');
    expect(formaterSaisieCompteBancaire('')).toBe('');
  });

  it('formate l’affichage d’un compte enregistré selon le même masque', () => {
    expect(formaterCompteBancaire('00005000414320010020085')).toBe('00005 00041 43200100200 85');
    expect(formaterCompteBancaire('000414320010020085', '00005')).toBe('00005 00041 43200100200 85');
    expect(formaterCompteBancaire('ANCIEN-COMPTE')).toBe('ANCIEN-COMPTE');
  });

  it('applique le masque au fil de la frappe et affiche l’exemple en placeholder', async () => {
    const user = userEvent.setup();
    render(<Conteneur />);
    const champ = screen.getByLabelText('Numéro de compte / RIB');
    expect(champ).toHaveAttribute('placeholder', MASQUE_COMPTE_BANCAIRE);
    await user.type(champ, '00005000414320010020085');
    expect(champ).toHaveValue('00005 00041 43200100200 85');
  });
});
