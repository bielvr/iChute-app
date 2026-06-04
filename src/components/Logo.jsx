import React from 'react';

export default function Logo({ size = 'sm', showText = true }) {
  // Definição dinâmica do tamanho do ícone do raio/alvo
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex items-center gap-2 select-none">
      {/* ÍCONE VETORIAL DO ALVO COM RAIO */}
      <div className={`${iconSizes[size]} bg-[#161933] border border-[#26283A] rounded-full flex items-center justify-center relative shadow-md flex-shrink-0`}>
        {/* Retículo do Alvo */}
        <div className="absolute inset-1 border border-dashed border-gray-700/40 rounded-full"></div>
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gray-700/20 -translate-x-1/2"></div>
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gray-700/20 -translate-y-1/2"></div>
        
        {/* Ícone do Raio Central */}
        <svg 
          className="w-1/2 h-1/2 text-[#0077FF] drop-shadow-[0_0_6px_rgba(0,119,255,0.6)] relative z-10 animate-pulse" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M11 21h-1l1-7H5l9-11h1l-1 7h6l-9 11z" />
        </svg>
      </div>

      {/* TIPOGRAFIA INTEGRADA (À prova de cortes de renderização) */}
      {showText && (
        <div className="flex tracking-tighter italic font-black uppercase leading-none min-w-max pl-1.5 pr-2 items-center">
          {/* Mudamos para items-center e usamos flex-row para controle total */}
          <span className="text-[#B0C4DE] font-light inline-block pr-1 transform scale-x-95 translate-y-[-0.5px]">
            i
          </span>
          <span className="text-[#0077FF] drop-shadow-[0_0_8px_rgba(0,119,255,0.3)] inline-block">
            Chute
          </span>
        </div>
      )}
    </div>
  );
}