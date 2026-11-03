import React from 'react';
import { MasqueEnteteConfig } from '../types';

interface MasqueEnteteViewProps {
  config: MasqueEnteteConfig;
  /** Réduit les tailles pour l'aperçu dans la fenêtre de réglage. */
  compact?: boolean;
}

/**
 * Rendu unique de l'entête du masque, partagé par l'aperçu, l'écran de saisie
 * et le document imprimé (même présentation à l'écran et sur papier).
 */
export const MasqueEnteteView: React.FC<MasqueEnteteViewProps> = ({ config, compact = false }) => {
  if (config.mode === 'image' && config.image) {
    return (
      <div className="flex justify-center bg-white">
        <img
          src={config.image}
          alt="Entête du masque de saisie des dépenses"
          className={compact ? 'max-h-28 max-w-full object-contain' : 'w-full max-h-40 object-contain'}
        />
      </div>
    );
  }

  const lineClass = (index: number) => {
    const base = compact ? 'leading-tight' : 'leading-snug';
    switch (index) {
      case 0:
        return `${base} font-extrabold uppercase tracking-wide ${compact ? 'text-[11px]' : 'text-sm'}`;
      case 1:
        return `${base} italic ${compact ? 'text-[9px]' : 'text-[11px]'}`;
      case 2:
        return `${base} font-bold uppercase ${compact ? 'text-[10px]' : 'text-xs'}`;
      case 3:
        return `${base} italic ${compact ? 'text-[9px]' : 'text-[11px]'}`;
      case 4:
        return `${base} font-semibold ${compact ? 'text-[9px]' : 'text-[11px]'}`;
      default:
        return `${base} ${compact ? 'text-[8.5px]' : 'text-[10.5px]'} text-slate-700`;
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white">
      {config.logoGauche ? (
        <img
          src={config.logoGauche}
          alt="Logo gauche"
          className={compact ? 'h-14 w-auto object-contain shrink-0' : 'h-20 w-auto object-contain shrink-0'}
        />
      ) : null}

      <div className="flex-1 min-w-0 text-center text-slate-900 space-y-0.5">
        {config.lignes.map((ligne, i) => (
          <div key={i} className={lineClass(i)}>
            {ligne || '\u00A0'}
          </div>
        ))}
      </div>

      {config.logoDroit ? (
        <img
          src={config.logoDroit}
          alt="Logo droit"
          className={compact ? 'h-12 w-auto object-contain shrink-0' : 'h-16 w-auto object-contain shrink-0'}
        />
      ) : null}
    </div>
  );
};
