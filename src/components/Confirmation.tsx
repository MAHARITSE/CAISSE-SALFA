import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modale } from './Modale';

interface ConfirmationProps {
  titre: string;
  children: ReactNode;
  onAnnuler: () => void;
  onConfirmer: () => unknown | Promise<unknown>;
  libelleConfirmer?: string;
  danger?: boolean;
}

export function Confirmation({ titre, children, onAnnuler, onConfirmer, libelleConfirmer = 'Confirmer', danger = false }: ConfirmationProps) {
  const [enCours, setEnCours] = useState(false);
  async function confirmer() {
    setEnCours(true);
    try { await onConfirmer(); } finally { setEnCours(false); }
  }
  return (
    <Modale titre={titre} onFermer={onAnnuler} largeur="petite"
      icone={<AlertTriangle size={20} className={danger ? 'text-rose-600' : 'text-amber-600'} />}
      pied={<div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={onAnnuler} autoFocus>Annuler</button><button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => void confirmer()} disabled={enCours}>{enCours ? 'En cours…' : libelleConfirmer}</button></div>}>
      <div className="text-sm leading-relaxed text-slate-600">{children}</div>
    </Modale>
  );
}
