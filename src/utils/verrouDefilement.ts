interface VerrouDefilement {
  nombre: number;
  valeurInitiale: string;
  prioriteInitiale: string;
}

// Les fenêtres peuvent se fermer ensemble, ou dans un ordre différent de leur
// ouverture. Restaurer l'état capturé par chaque fenêtre laisserait parfois
// « hidden » sur le body, ce qui désactive la roulette après leur fermeture.
const verrous = new WeakMap<HTMLElement, VerrouDefilement>();

/** Retourne une libération idempotente ; seule la dernière restaure le style. */
export function verrouillerDefilement(corps: HTMLElement): () => void {
  let verrou = verrous.get(corps);
  if (!verrou) {
    verrou = {
      nombre: 0,
      valeurInitiale: corps.style.getPropertyValue('overflow'),
      prioriteInitiale: corps.style.getPropertyPriority('overflow'),
    };
    verrous.set(corps, verrou);
    corps.style.setProperty('overflow', 'hidden');
  }
  verrou.nombre++;
  const actif = verrou;
  let libere = false;
  return () => {
    if (libere) return;
    libere = true;
    actif.nombre--;
    if (actif.nombre > 0) return;
    if (actif.valeurInitiale) {
      corps.style.setProperty('overflow', actif.valeurInitiale, actif.prioriteInitiale);
    } else {
      corps.style.removeProperty('overflow');
    }
    verrous.delete(corps);
  };
}
