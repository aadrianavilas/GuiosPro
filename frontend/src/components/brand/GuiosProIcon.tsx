import React from 'react';

interface GuiosProIconProps {
  className?: string;
  size?: number | string;
}

export const GuiosProIcon: React.FC<GuiosProIconProps> = ({ className = 'w-8 h-8', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Icono GuiosPro"
    >
      <rect width="100" height="100" rx="26" fill="#243642" />
      <rect x="16" y="16" width="30" height="30" rx="9" fill="#7FBFC1" />
      <rect x="54" y="16" width="30" height="30" rx="9" fill="#F7A35F" />
      <rect x="16" y="54" width="30" height="30" rx="9" fill="#F9E8A0" />
      <rect x="54" y="54" width="30" height="30" rx="9" fill="#B8421A" />
    </svg>
  );
};
