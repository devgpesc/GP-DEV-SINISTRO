import React from 'react';

interface EscLogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const EscLogo: React.FC<EscLogoProps> = ({
  className = 'w-10 h-10',
  classNameText = 'text-xl',
  showText = true
}) => {
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {/* Marca proprietaria inspirada no simbolo do Grupo Esc Sistemas. */}
        <path d="M21 7 L 12 2 L 3 7 L 12 12 L 21 17 L 12 22 L 3 17" />
        <path d="M7.5 9.5h8.25l2.75-2.5" opacity="0.78" />
        <path d="M16.5 14.5H8.25L5.5 17" opacity="0.78" />
      </svg>

      {showText && (
        <div className={`leading-none font-bold tracking-tight ${classNameText}`}>
          <div>
            Events<span className="text-blue-500">Car</span>
          </div>
          <div className="text-[0.48em] font-semibold tracking-widest opacity-80 uppercase">
            Grupo Esc Sistemas
          </div>
        </div>
      )}
    </div>
  );
};

export default EscLogo;
