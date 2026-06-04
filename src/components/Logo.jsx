import React from 'react';

export default function Logo({ size = "md", showText = true }) {
  // Ajuste dinâmico de escala
  const dimensions = {
    sm: { h: 32, textClass: "text-lg" },
    md: { h: 48, textClass: "text-2xl" },
    lg: { h: 72, textClass: "text-4xl" }
  }[size] || { h: 48, textClass: "text-2xl" };

  return (
    <div className="flex items-center gap-3 select-none">
      {/* SÍMBOLO ABSTRATO: O "Chute do Raio Certeiro" */}
      <svg 
        height={dimensions.h} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_12px_rgba(0,119,255,0.6)]"
      >
        {/* Círculo de Fundo Sutil (Nebula Core / Midnight Veil) */}
        <circle cx="50" cy="50" r="45" fill="#1A1C3A" stroke="#26283A" strokeWidth="3" />
        
        {/* Vetor de Mira / Precisão (Cobalt Haze) */}
        <path d="M 50 15 L 50 25 M 50 75 L 50 85 M 15 50 L 25 50 M 75 50 L 85 50" stroke="#80B2FF" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        
        {/* O Raio Dinâmico / Elemento de Ação (Electric Cobalt) */}
        <path 
          d="M58 20 L32 54 L48 54 L40 82 L70 44 L52 44 Z" 
          fill="#0077FF" 
          stroke="#F0F8FF" 
          strokeWidth="2"
          strokeLinejoin="round"
        />

      </svg>

      {/* TIPOGRAFIA INTEGRADA */}
      {showText && (
        <div className="flex tracking-tighter italic font-black uppercase leading-none">
          <span className="text-[#B0C4DE] font-light">i</span>
          <span className="text-[#0077FF] drop-shadow-[0_0_8px_rgba(0,119,255,0.4)]">Chute</span>
        </div>
      )}
    </div>
  );
}