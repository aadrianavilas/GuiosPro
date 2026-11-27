import React from 'react';
import { GuiosProIcon } from './GuiosProIcon';

interface GuiosProLogoProps {
  className?: string;
  iconClassName?: string;
  textSize?: string;
  showSubtitle?: boolean;
}

export const GuiosProLogo: React.FC<GuiosProLogoProps> = ({
  className = 'flex items-center gap-2.5',
  iconClassName = 'w-8 h-8 shrink-0',
  textSize = 'text-xl',
  showSubtitle = false,
}) => {
  return (
    <div className={className}>
      <GuiosProIcon className={iconClassName} />
      <div className="flex flex-col leading-none">
        <span className={`font-bold tracking-tight text-[#243642] ${textSize}`}>
          Guios<span className="text-[#B8421A] italic font-serif">Pro</span>
        </span>
        {showSubtitle && (
          <span className="text-[8px] uppercase font-bold text-[#4F6170] tracking-widest mt-0.5">
            SOFTWARE LIBRE
          </span>
        )}
      </div>
    </div>
  );
};
