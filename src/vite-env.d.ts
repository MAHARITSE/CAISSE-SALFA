/// <reference types="vite/client" />

/**
 * Ressources embarquées par Vite. Les logos des imprimés sont importés comme
 * modules : Vite les recopie dans `assets/` (hachés) et l'application y accède
 * sans requête réseau, à l'écran comme sur le serveur WAMP.
 */
declare module '*.png' {
  const source: string;
  export default source;
}

/** `?inline` : l'image est incorporée en data URL dans le paquet. */
declare module '*.png?inline' {
  const source: string;
  export default source;
}
