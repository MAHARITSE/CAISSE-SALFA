import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom n’implante pas encore la couche supérieure native de <dialog>.
// Les tests navigateur Playwright vérifient le vrai comportement modal.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
  this.querySelector<HTMLElement>('[autofocus]')?.focus();
};
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
window.print = vi.fn();
HTMLAnchorElement.prototype.click = vi.fn();
// FileReader est disponible dans jsdom ; Blob.text ne l'est pas toujours.
if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
