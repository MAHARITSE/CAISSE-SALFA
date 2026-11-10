import { useEffect, useState } from 'react';
import type { Ecriture } from '../types';
import type { Utilisateur } from '../utils/api';
import { MODE_API, lireDemandes, envoyerDemande, type DemandePrecision } from '../utils/api';
import { Modale } from './Modale';

const CLE = 'salfa_demandes_precision';
function lireLocal(): DemandePrecision[] {
  const data = JSON.parse(localStorage.getItem(CLE) || '[]');
  if (!Array.isArray(data)) throw new Error('Les demandes locales sont illisibles.');
  return data;
}

export function DemandesPrecision({ utilisateur, ecritures, cible, fermer, editer }: {
  utilisateur: Utilisateur; ecritures: Ecriture[]; cible: Ecriture | null; fermer: () => void; editer: (e: Ecriture) => void;
}) {
  const [demandes, setDemandes] = useState<DemandePrecision[]>([]);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [historique, setHistorique] = useState(false);
  async function actualiser() {
    try { setDemandes(MODE_API ? await lireDemandes() : lireLocal()); setErreur(''); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Impossible de charger les demandes.'); }
  }
  useEffect(() => {
    void actualiser();
    const timer = window.setInterval(() => { void actualiser(); }, 60000);
    return () => window.clearInterval(timer);
  }, [utilisateur.id]);
  useEffect(() => { setMessage(''); }, [cible?.id]);
  async function creer() {
    if (!cible || !message.trim() || occupe) return;
    setOccupe(true);
    try {
      if (MODE_API) setDemandes(await envoyerDemande({ operation: 'creer', ecritureId: cible.id, message: message.trim() }));
      else {
        const toutes = lireLocal();
        const d: DemandePrecision = { id: Date.now(), ecritureId: cible.id, numero: cible.numero, message: message.trim(), auteur: utilisateur.nomComplet, creeLe: new Date().toISOString(), completeLe: null, completePar: null };
        const suivantes = [d, ...toutes]; localStorage.setItem(CLE, JSON.stringify(suivantes)); setDemandes(suivantes);
      }
      setErreur(''); fermer();
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Envoi impossible.'); }
    finally { setOccupe(false); }
  }
  async function completer(id: number) {
    if (occupe) return;
    setOccupe(true);
    try {
      if (MODE_API) setDemandes(await envoyerDemande({ operation: 'completer', id }));
      else {
        const suivantes = lireLocal().map(d => d.id === id && !d.completeLe ? { ...d, completeLe: new Date().toISOString(), completePar: utilisateur.nomComplet } : d);
        localStorage.setItem(CLE, JSON.stringify(suivantes)); setDemandes(suivantes);
      }
      setErreur('');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Mise à jour impossible.'); }
    finally { setOccupe(false); }
  }
  const enAttente = demandes.filter(d => !d.completeLe);
  const visibles = historique ? demandes : enAttente;
  return <>
    {(demandes.length > 0 || erreur) && <section className="card no-print p-4" aria-label="Demandes de précision">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Demandes de précision · {enAttente.length} en attente</h2><div className="flex gap-2"><button className="btn-secondary" onClick={() => void actualiser()}>Actualiser</button><button className="btn-secondary" onClick={() => setHistorique(!historique)}>{historique ? 'Masquer les demandes complétées' : 'Voir toutes les demandes'}</button></div></div>
      {erreur && <p role="alert" className="mt-2 text-sm text-rose-700">{erreur}</p>}
      {visibles.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucune demande en attente.</p>}
      <ul className="mt-2 space-y-2">{visibles.map(d => {
        const e = ecritures.find(x => x.id === d.ecritureId);
        return <li key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><div className="flex flex-wrap justify-between gap-2"><div><strong>{d.numero}</strong> · {d.completeLe ? `Complétée par ${d.completePar}` : 'En attente'}<p className="whitespace-pre-wrap mt-1">{d.message}</p><p className="mt-1 text-xs text-slate-500">Demandé par {d.auteur} · {new Date(d.creeLe).toLocaleString('fr-FR')}{!e && ' · Écriture indisponible ou exercice clôturé'}</p></div>{!d.completeLe && <div className="flex flex-wrap gap-2">{e && <button className="btn-secondary" onClick={() => editer(e)}>Modifier l’écriture</button>}<button className="btn-secondary" disabled={occupe || !e} onClick={() => void completer(d.id)}>Marquer complétée</button></div>}</div></li>;
      })}</ul>
    </section>}
    {cible && <Modale titre="Demander une précision" sousTitre={`Pièce ${cible.numero} · ${cible.libelle}`} onFermer={fermer}>
      <form onSubmit={e => { e.preventDefault(); void creer(); }}><label className="block text-sm font-semibold" htmlFor="demande-message">Que faut-il préciser ?</label><textarea id="demande-message" className="field mt-2" value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} required rows={4} placeholder="Par exemple : préciser la nature de cette dépense et sa catégorie." />{erreur && <p role="alert" className="mt-2 text-sm text-rose-700">{erreur}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={fermer}>Annuler</button><button className="btn-primary" disabled={occupe || !message.trim()}>Envoyer la demande</button></div></form>
    </Modale>}
  </>;
}
