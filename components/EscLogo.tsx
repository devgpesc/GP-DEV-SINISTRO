
import React from 'react';

interface EscLogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const EscLogo: React.FC<EscLogoProps> = ({ className = "w-10 h-10", classNameText = "text-xl", showText = true }) => {
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
      >
        {/* Desenho do S Hexagonal baseado na logo original */}
        <path d="M21 7 L 12 2 L 3 7 L 12 12 L 21 17 L 12 22 L 3 17" />
      </svg>
      
      {showText && (
        <div className={`leading-none font-bold tracking-tight ${classNameText}`}>
          <div>ESC</div>
          <div className="text-[0.6em] font-medium tracking-widest opacity-80">INFORMÁTICA</div>
        </div>
      )}
    </div>
  );
};

export default EscLogo;
