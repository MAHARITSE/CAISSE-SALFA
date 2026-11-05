import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ControlesFlottants, NIVEAUX_TAILLE, TAILLE_DEFAUT } from './ControlesFlottants';

describe('ControlesFlottants', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.fontSize = '';
  });

  it('affiche le bouton de bascule de thème et les boutons + et -', () => {
    render(<ControlesFlottants />);
    expect(screen.getByRole('button', { name: /mode sombre|mode clair/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réduire la taille de police/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /augmenter la taille de police/i })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('bascule entre mode clair et mode sombre au clic', async () => {
    const user = userEvent.setup();
    render(<ControlesFlottants />);

    const boutonTheme = screen.getByRole('button', { name: /mode sombre|mode clair/i });
    const etaitSombreInitial = document.documentElement.classList.contains('dark');

    await user.click(boutonTheme);
    expect(document.documentElement.classList.contains('dark')).toBe(!etaitSombreInitial);
    expect(localStorage.getItem('salfa_theme')).toBe(!etaitSombreInitial ? 'dark' : 'light');

    await user.click(boutonTheme);
    expect(document.documentElement.classList.contains('dark')).toBe(etaitSombreInitial);
    expect(localStorage.getItem('salfa_theme')).toBe(etaitSombreInitial ? 'dark' : 'light');
  });

  it('augmente la taille de la police avec le bouton +', async () => {
    const user = userEvent.setup();
    render(<ControlesFlottants />);

    const boutonPlus = screen.getByRole('button', { name: /augmenter la taille de police/i });
    await user.click(boutonPlus);

    // Taille suivante après 16px est 17px
    expect(document.documentElement.style.fontSize).toBe('17px');
    expect(localStorage.getItem('salfa_taille_police')).toBe('17');
    expect(screen.getByText(`${Math.round((17 / TAILLE_DEFAUT) * 100)}%`)).toBeInTheDocument();
  });

  it('réduit la taille de la police avec le bouton -', async () => {
    const user = userEvent.setup();
    render(<ControlesFlottants />);

    const boutonMoins = screen.getByRole('button', { name: /réduire la taille de police/i });
    await user.click(boutonMoins);

    // Taille précédente avant 16px est 15px
    expect(document.documentElement.style.fontSize).toBe('15px');
    expect(localStorage.getItem('salfa_taille_police')).toBe('15');
    expect(screen.getByText(`${Math.round((15 / TAILLE_DEFAUT) * 100)}%`)).toBeInTheDocument();
  });

  it('désactive le bouton - quand la taille minimale est atteinte', async () => {
    localStorage.setItem('salfa_taille_police', String(NIVEAUX_TAILLE[0]));
    render(<ControlesFlottants />);

    const boutonMoins = screen.getByRole('button', { name: /réduire la taille de police/i });
    expect(boutonMoins).toBeDisabled();
  });

  it('désactive le bouton + quand la taille maximale est atteinte', async () => {
    const max = NIVEAUX_TAILLE[NIVEAUX_TAILLE.length - 1];
    localStorage.setItem('salfa_taille_police', String(max));
    render(<ControlesFlottants />);

    const boutonPlus = screen.getByRole('button', { name: /augmenter la taille de police/i });
    expect(boutonPlus).toBeDisabled();
  });

  it('réinitialise à 100% au clic sur le pourcentage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('salfa_taille_police', '20');
    render(<ControlesFlottants />);

    const badgePourcentage = screen.getByText(`${Math.round((20 / TAILLE_DEFAUT) * 100)}%`);
    await user.click(badgePourcentage);

    expect(document.documentElement.style.fontSize).toBe('16px');
    expect(localStorage.getItem('salfa_taille_police')).toBe('16');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
