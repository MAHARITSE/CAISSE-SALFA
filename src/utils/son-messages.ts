/** Préférence partagée entre les onglets d'un même navigateur. */
export const CLE_SON_MESSAGES = 'salfa_son_messages';
export const EVENEMENT_SON_MESSAGES = 'salfa-son-messages';
export function lireSonMessages(): boolean {
  try { return localStorage.getItem(CLE_SON_MESSAGES) !== '0'; } catch { return true; }
}
export function reglerSonMessages(actif: boolean): void {
  try { localStorage.setItem(CLE_SON_MESSAGES, actif ? '1' : '0'); } catch { /* préférence conservée dans l'onglet courant */ }
  window.dispatchEvent(new CustomEvent(EVENEMENT_SON_MESSAGES, { detail: actif }));
}
