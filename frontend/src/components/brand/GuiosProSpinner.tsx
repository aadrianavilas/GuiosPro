import React from 'react';

export interface GuiosProSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  className?: string;
  label?: string;
  labelClassName?: string;
  fullscreen?: boolean;
}

/**
 * Spinner oficial GuiosPro:
 * 4 cuadritos redondeados con la paleta de colores institucional (Turquesa, Naranja, Terracota, Amarillo)
 * sin fondo oscuro, con animación secuencial de opacidad en el sentido de las manecillas del reloj.
 */
export const GuiosProSpinner: React.FC<GuiosProSpinnerProps> = ({
  size = 'md',
  className = '',
  label,
  labelClassName = 'text-xs text-[#4F6170] font-medium tracking-wide',
  fullscreen = false,
}) => {
  const getDimension = () => {
    if (typeof size === 'number') return `${size}px`;
    switch (size) {
      case 'xs':
        return '16px';
      case 'sm':
        return '24px';
      case 'md':
        return '36px';
      case 'lg':
        return '48px';
      case 'xl':
        return '64px';
      default:
        return size;
    }
  };

  const dimension = getDimension();

  const spinnerSvg = (
    <svg
      viewBox="0 0 68 68"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={{ width: dimension, height: dimension }}
      aria-label="Cargando..."
    >
      <style>{`
        @keyframes guiospro-square-fade {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          25% {
            opacity: 0.2;
            transform: scale(0.88);
          }
          60%, 100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .guios-sq-tl {
          animation: guiospro-square-fade 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
          animation-delay: 0s;
          transform-origin: 15px 15px;
        }
        .guios-sq-tr {
          animation: guiospro-square-fade 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
          animation-delay: 0.3s;
          transform-origin: 53px 15px;
        }
        .guios-sq-br {
          animation: guiospro-square-fade 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
          animation-delay: 0.6s;
          transform-origin: 53px 53px;
        }
        .guios-sq-bl {
          animation: guiospro-square-fade 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
          animation-delay: 0.9s;
          transform-origin: 15px 53px;
        }
      `}</style>
      {/* 1. Izquierda Superior: Turquesa #7FBFC1 */}
      <rect
        className="guios-sq-tl"
        x="0"
        y="0"
        width="30"
        height="30"
        rx="9"
        fill="#7FBFC1"
      />
      {/* 2. Derecha Superior: Naranja #F7A35F */}
      <rect
        className="guios-sq-tr"
        x="38"
        y="0"
        width="30"
        height="30"
        rx="9"
        fill="#F7A35F"
      />
      {/* 3. Derecha Inferior: Terracota #B8421A */}
      <rect
        className="guios-sq-br"
        x="38"
        y="38"
        width="30"
        height="30"
        rx="9"
        fill="#B8421A"
      />
      {/* 4. Izquierda Inferior: Amarillo #F9E8A0 */}
      <rect
        className="guios-sq-bl"
        x="0"
        y="38"
        width="30"
        height="30"
        rx="9"
        fill="#F9E8A0"
      />
    </svg>
  );

  if (fullscreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[260px] w-full p-8 gap-3.5 animate-fade-in">
        {spinnerSvg}
        {label && <p className={labelClassName}>{label}</p>}
      </div>
    );
  }

  if (label) {
    return (
      <div className="inline-flex flex-col items-center justify-center gap-2.5">
        {spinnerSvg}
        <p className={labelClassName}>{label}</p>
      </div>
    );
  }

  return spinnerSvg;
};
