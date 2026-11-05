import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModaleProps {
  titre: string;
  sousTitre?: string;
  icone?: ReactNode;
  onFermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
  /** `document` : une feuille imprimable, qui mérite toute la largeur de l'écran. */
  largeur?: 'petite' | 'normale' | 'large' | 'document';
  enteteClass?: string;
}

/** Native dialog : focus piégé, arrière-plan inerte et fermeture Échap accessibles. */
export function Modale({ titre, sousTitre, icone, onFermer, children, pied, largeur = 'normale', enteteClass = '' }: ModaleProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titreId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflowPrecedent;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titreId}
      className={`modal-shell no-print ${largeur === 'petite' ? 'max-w-md' : largeur === 'large' ? 'max-w-4xl' : largeur === 'document' ? 'max-w-6xl' : 'max-w-3xl'}`}
      onCancel={e => { e.preventDefault(); onFermer(); }}
      onClick={e => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onFermer();
      }}
    >
      <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800 ${enteteClass}`}>
        <div className="flex min-w-0 items-center gap-3">
          {icone && <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-brand-700 shadow-xs dark:bg-slate-800 dark:text-brand-400">{icone}</div>}
          <div className="min-w-0">
            <h2 id={titreId} className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">{titre}</h2>
            {sousTitre && <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{sousTitre}</p>}
          </div>
        </div>
        <button type="button" className="icon-button shrink-0" onClick={onFermer} aria-label={`Fermer ${titre}`} title="Fermer (Échap)"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      {pied && <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">{pied}</div>}
    </dialog>
  );
}
