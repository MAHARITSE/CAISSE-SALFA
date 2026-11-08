import { describe, expect, it } from 'vitest';
import { verrouillerDefilement } from './verrouDefilement';

describe('verrou partagé de défilement', () => {
  it('ne libère pas les autres fenêtres si la même fermeture est appelée deux fois', () => {
    const corps = document.createElement('body');
    const premier = verrouillerDefilement(corps);
    const second = verrouillerDefilement(corps);
    premier();
    premier();
    expect(corps.style.overflow).toBe('hidden');
    second();
    expect(corps.style.overflow).toBe('');
  });

  it('capture à nouveau le style initial pour une nouvelle série de fenêtres', () => {
    const corps = document.createElement('body');
    verrouillerDefilement(corps)();
    corps.style.setProperty('overflow', 'scroll', 'important');
    const liberer = verrouillerDefilement(corps);
    expect(corps.style.overflow).toBe('hidden');
    liberer();
    expect(corps.style.overflow).toBe('scroll');
    expect(corps.style.getPropertyPriority('overflow')).toBe('important');
  });

  it('ne mélange pas les verrous de documents différents', () => {
    const premier = document.createElement('body');
    const second = document.createElement('body');
    const libererPremier = verrouillerDefilement(premier);
    const libererSecond = verrouillerDefilement(second);
    libererPremier();
    expect(premier.style.overflow).toBe('');
    expect(second.style.overflow).toBe('hidden');
    libererSecond();
    expect(second.style.overflow).toBe('');
  });
});
