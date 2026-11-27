import React from 'react';

interface AuthBannerProps {
  caption?: string;
  className?: string;
}

export const AuthBanner: React.FC<AuthBannerProps> = ({
  caption = 'Evalúa, compara y toma decisiones seguras en la adopción de software libre con GuiosPro.',
  className = '',
}) => {
  return (
    <div
      className={`w-full h-full min-h-[400px] lg:min-h-0 bg-[#F7A35F] rounded-[32px] p-6 sm:p-8 lg:p-8 xl:p-10 flex flex-col justify-between items-center text-center relative overflow-hidden select-none ${className}`}
    >
      {/* Círculos decorativos en naranja claro #FBB982 */}
      <div className="absolute -top-12 -right-12 w-72 h-72 rounded-full bg-[#FBB982]/60 pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#FBB982]/60 pointer-events-none" />

      {/* Espaciador superior */}
      <div className="w-full h-4" />

      {/* Tarjeta flotante central con la lista de verificación */}
      <div className="relative my-auto flex flex-col items-center z-10">
        <div className="bg-white rounded-[24px] p-7 w-[260px] relative shadow-none border border-white/40">
          {/* Pastilla flotante superior: Adopción viable */}
          <div className="absolute -top-3.5 right-3 bg-[#F9E8A0] text-[#5B4A12] text-[11px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
            Adopción viable
          </div>

          {/* Lista de chequeo con checkboxes e ítems */}
          <div className="space-y-4 pt-1">
            {/* Ítem 1 */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[#4A8F93] flex items-center justify-center text-white shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="h-3 w-32 bg-[#D5ECEC] rounded-full" />
            </div>

            {/* Ítem 2 */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[#4A8F93] flex items-center justify-center text-white shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="h-3 w-20 bg-[#D5ECEC] rounded-full" />
            </div>

            {/* Ítem 3 */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[#4A8F93] flex items-center justify-center text-white shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="h-3 w-28 bg-[#D5ECEC] rounded-full" />
            </div>

            {/* Ítem 4 (Pendiente en amarillo) */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[#F9E8A0] shrink-0" />
              <div className="h-3 w-16 bg-[#D5ECEC] rounded-full" />
            </div>
          </div>

          {/* Insignia circular oscura en la esquina inferior izquierda */}
          <div className="absolute -bottom-4 -left-4 w-11 h-11 rounded-full bg-[#1F3340] flex items-center justify-center text-white shadow-none">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Cita / Frase destacada en Newsreader cursiva */}
        <p className="mt-9 text-base sm:text-lg font-serif italic text-[#1F3340] max-w-[280px] leading-snug font-normal text-center">
          {caption}
        </p>
      </div>

      {/* Puntos de carrusel */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2 z-10">
        <span className="w-6 h-2 rounded-full bg-[#1F3340]" />
        <span className="w-2 h-2 rounded-full bg-[#1F3340]/30" />
        <span className="w-2 h-2 rounded-full bg-[#1F3340]/30" />
      </div>
    </div>
  );
};
