import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modale } from './Modale';

function Fenetres({ parent = true, enfant = true }: { parent?: boolean; enfant?: boolean }) {
  return <>
    {parent && <Modale key="parent" titre="Saisie" onFermer={vi.fn()}>Formulaire</Modale>}
    {enfant && <Modale key="enfant" titre="Confirmation" onFermer={vi.fn()}>Confirmer</Modale>}
  </>;
}

afterEach(() => { document.body.style.removeProperty('overflow'); });

describe('défilement avec plusieurs fenêtres', () => {
  it('reste bloqué si la première fenêtre se ferme avant la dernière', () => {
    const { rerender, unmount } = render(<Fenetres />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Fenetres parent={false} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('libère la roulette après la fermeture simultanée des deux fenêtres', () => {
    const { unmount } = render(<Fenetres />);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('garde la page bloquée après fermeture de la seule fenêtre supérieure', () => {
    const { rerender, unmount } = render(<Fenetres />);
    rerender(<Fenetres enfant={false} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restaure la valeur et la priorité CSS initiales même en StrictMode', () => {
    document.body.style.setProperty('overflow', 'auto', 'important');
    const { unmount } = render(<StrictMode><Fenetres /></StrictMode>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
  });
});
