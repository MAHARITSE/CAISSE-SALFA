import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const serveur = vi.hoisted(() => ({ lire: vi.fn(), modifier: vi.fn() }));
vi.mock('../utils/api', () => ({ MODE_API: true, lireMessages: serveur.lire, modifierMessages: serveur.modifier }));
vi.mock('../utils/utilisateurs', () => ({ listerComptes: vi.fn() }));
import { Messagerie } from './Messagerie';
const utilisateur = { id: 1, identifiant: 'admin', nomComplet: 'Admin', role: 'admin' as const };
const message = { id: 7, auteurId: 2, destinataireId: 1, auteurNom: 'Caisse', destinataireNom: 'Admin', contenu: 'Bonjour', creeLe: '2026-01-01T12:00:00Z', luLe: null };
const comptes = [{ id: 2, identifiant: 'caisse', nomComplet: 'Caisse', enLigne: 1 }, { id: 3, identifiant: 'autre', nomComplet: 'Autre', enLigne: 0 }];
function simulerAudio() {
  const demarrer = vi.fn();
  const arreter = vi.fn();
  const tampon = {} as AudioBuffer;
  const source = { buffer: null as AudioBuffer | null, connect: vi.fn(), disconnect: vi.fn(), start: demarrer, stop: arreter, onended: null };
  const audio = { state: 'running', destination: {}, close: vi.fn().mockResolvedValue(undefined), resume: vi.fn(), decodeAudioData: vi.fn().mockResolvedValue(tampon), createBufferSource: vi.fn(() => source) };
  audio.resume.mockImplementation(async () => { audio.state = 'running'; });
  const constructeur = vi.fn(function () { return audio; });
  vi.stubGlobal('AudioContext', constructeur);
  return { audio, constructeur, demarrer, arreter, source, tampon };
}
afterEach(() => { serveur.lire.mockReset(); serveur.modifier.mockReset(); vi.unstubAllGlobals(); });
describe('messagerie serveur', () => {
  it('affiche les personnes en ligne même sans conversation et transmet les suppressions', async () => {
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    serveur.modifier.mockResolvedValue({ comptes, messages: [] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Messagerie utilisateur={utilisateur} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    expect(within(screen.getByRole('button', { name: /Caisse.*Bonjour/ })).getByLabelText('En ligne')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Autre/ })).getByLabelText('Hors ligne')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Caisse.*Bonjour/ }));
    expect(within(screen.getByLabelText('Conversation avec Caisse')).getByText('En ligne')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer toute la conversation' }));
    await waitFor(() => expect(serveur.modifier).toHaveBeenCalledWith({ operation: 'supprimer_conversation', correspondantId: '2' }));
    await screen.findByText(/Sélectionnez un utilisateur/);
  });
  it('joue le son des nouveaux messages même sans permission de notification système', async () => {
    const { audio, demarrer, source, tampon } = simulerAudio();
    vi.stubGlobal('Notification', undefined);
    serveur.lire.mockResolvedValue({ comptes, messages: [] });
    render(<Messagerie utilisateur={utilisateur} />);
    const boutonMessages = await screen.findByRole('button', { name: 'Messages privés' });
    fireEvent.pointerDown(boutonMessages);
    fireEvent.click(boutonMessages);
    expect(screen.queryByText('Son et notifications')).not.toBeInTheDocument();
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(demarrer).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(serveur.lire).toHaveBeenCalled());
    expect(demarrer).toHaveBeenCalledTimes(1);
    expect(source.buffer).toBe(tampon);
    const octets = new Uint8Array(audio.decodeAudioData.mock.calls[0][0]);
    expect(Array.from(octets.slice(0, 4))).toEqual([82, 73, 70, 70]); // RIFF
    expect(octets.length).toBe(68072);
  });
});

it('active le son au premier geste dans la caisse sans ouvrir la messagerie', async () => {
  const { demarrer, constructeur } = simulerAudio();
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  render(<><button>Autre action dans la caisse</button><Messagerie utilisateur={utilisateur} /></>);
  await act(async () => { await Promise.resolve(); });
  expect(serveur.lire).toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Autre action dans la caisse' }));
  expect(constructeur).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog', { name: 'Messages privés' })).not.toBeInTheDocument();
  serveur.lire.mockResolvedValue({ comptes, messages: [message] });
  // Déclenche le rafraîchissement périodique sans ouvrir la messagerie.
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(demarrer).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

it('la cloche active et désactive le son, même si les notifications sont bloquées', async () => {
  const { ControlesFlottants } = await import('./ControlesFlottants');
  const { demarrer } = simulerAudio();
  const demander = vi.fn();
  vi.stubGlobal('Notification', { permission: 'denied', requestPermission: demander });
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  render(<><Messagerie utilisateur={utilisateur} /><ControlesFlottants /></>);
  await act(async () => { await Promise.resolve(); });
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Désactiver le son des messages' }));
  fireEvent.click(screen.getByRole('button', { name: 'Désactiver le son des messages' }));
  expect(localStorage.getItem('salfa_son_messages')).toBe('0');
  serveur.lire.mockResolvedValue({ comptes, messages: [message] });
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(demarrer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Activer le son des messages' }));
  expect(localStorage.getItem('salfa_son_messages')).toBe('1');
  serveur.lire.mockResolvedValue({ comptes, messages: [message, { ...message, id: 8 }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(demarrer).toHaveBeenCalledOnce();
  expect(demander).not.toHaveBeenCalled();
  expect(screen.queryByText(/Son et notifications/)).not.toBeInTheDocument();
  vi.useRealTimers();
});

it('joue le fichier en arrière-plan et arrête le son avec la cloche', async () => {
  const { ControlesFlottants } = await import('./ControlesFlottants');
  const etatInitial = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  const { demarrer, arreter } = simulerAudio();
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  try {
    render(<><button>Action caisse</button><Messagerie utilisateur={utilisateur} /><ControlesFlottants /></>);
    await act(async () => { await Promise.resolve(); });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Action caisse' }));
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(demarrer).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Messages privés' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver le son des messages' }));
    expect(arreter).toHaveBeenLastCalledWith();
    serveur.lire.mockResolvedValue({ comptes, messages: [message, { ...message, id: 8 }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(demarrer).toHaveBeenCalledOnce();
  } finally {
    if (etatInitial) Object.defineProperty(document, 'visibilityState', etatInitial);
    else delete (document as unknown as Record<string, unknown>).visibilityState;
    vi.useRealTimers();
  }
});

it('réactualise les messages au retour sur l’onglet ou au rétablissement du réseau', async () => {
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  render(<Messagerie utilisateur={utilisateur} />);
  await waitFor(() => expect(serveur.lire).toHaveBeenCalledTimes(1));
  fireEvent(window, new Event('online'));
  await waitFor(() => expect(serveur.lire).toHaveBeenCalledTimes(2));
  const etatInitial = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  try {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(serveur.lire).toHaveBeenCalledTimes(3));
  } finally {
    if (etatInitial) Object.defineProperty(document, 'visibilityState', etatInitial);
    else delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

it('reprend un contexte audio suspendu avant de jouer un nouveau message', async () => {
  const { audio, demarrer } = simulerAudio();
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  try {
    render(<><button>Action caisse</button><Messagerie utilisateur={utilisateur} /></>);
    await act(async () => { await Promise.resolve(); });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Action caisse' }));
    audio.state = 'suspended';
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(audio.resume).toHaveBeenCalledOnce();
    expect(demarrer).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});


it('ne joue pas un son en cours de chargement après la désactivation, même si la cloche est réactivée', async () => {
  const { ControlesFlottants } = await import('./ControlesFlottants');
  const { audio, demarrer, tampon } = simulerAudio();
  let terminer!: (value: AudioBuffer) => void;
  audio.decodeAudioData.mockReturnValueOnce(new Promise(resolve => { terminer = resolve; }));
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  try {
    render(<><button>Action caisse</button><Messagerie utilisateur={utilisateur} /><ControlesFlottants /></>);
    await act(async () => { await Promise.resolve(); });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Action caisse' }));
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(audio.decodeAudioData).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver le son des messages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activer le son des messages' }));
    await act(async () => { terminer(tampon); });
    expect(demarrer).not.toHaveBeenCalled();
    serveur.lire.mockResolvedValue({ comptes, messages: [message, { ...message, id: 8 }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(demarrer).toHaveBeenCalledOnce();
    expect(audio.decodeAudioData).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('réessaie le décodage du fichier si une première tentative échoue', async () => {
  const { audio, demarrer } = simulerAudio();
  audio.decodeAudioData.mockRejectedValueOnce(new Error('décodage'));
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  vi.useFakeTimers();
  try {
    render(<><button>Action caisse</button><Messagerie utilisateur={utilisateur} /></>);
    await act(async () => { await Promise.resolve(); });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Action caisse' }));
    serveur.lire.mockResolvedValue({ comptes, messages: [message] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(demarrer).not.toHaveBeenCalled();
    serveur.lire.mockResolvedValue({ comptes, messages: [message, { ...message, id: 8 }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(audio.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(demarrer).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});


it('permet de tester le son intégré et indique les échecs ou la désactivation', async () => {
  const { ControlesFlottants } = await import('./ControlesFlottants');
  const { audio, demarrer } = simulerAudio();
  serveur.lire.mockResolvedValue({ comptes, messages: [] });
  render(<><Messagerie utilisateur={utilisateur} /><ControlesFlottants /></>);
  fireEvent.click(await screen.findByRole('button', { name: 'Messages privés' }));
  const tester = screen.getByRole('button', { name: 'Tester le son des messages' });
  audio.decodeAudioData.mockRejectedValueOnce(new Error('décodage'));
  fireEvent.click(tester);
  expect(await screen.findByText(/Impossible de jouer le son/)).toBeVisible();
  fireEvent.click(tester);
  expect(await screen.findByText(/Son de test joué/)).toBeVisible();
  expect(demarrer).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Désactiver le son des messages' }));
  fireEvent.click(tester);
  expect(await screen.findByText(/Le son des messages est désactivé/)).toBeVisible();
  expect(demarrer).toHaveBeenCalledOnce();
});
