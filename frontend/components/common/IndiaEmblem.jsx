import React from 'react';

/**
 * High-precision vector graphic of the official State Emblem of India
 * (Ashoka Lion Capital, Ashoka Chakra, and Satyameva Jayate)
 * Rendered in metallic gold & warm orange (#FF9933) palette.
 */
export const IndiaEmblem = ({ className = "w-9 h-11", showText = false }) => {
  return (
    <div className={`inline-flex flex-col items-center shrink-0 ${className}`}>
      <svg 
        viewBox="0 0 100 120" 
        className="w-full h-full"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE082" />
            <stop offset="40%" stopColor="#FF9933" />
            <stop offset="80%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="saffronGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFB74D" />
            <stop offset="100%" stopColor="#FF9933" />
          </linearGradient>
        </defs>

        {/* --- Central & Flanking Lions (Ashoka Capital) --- */}
        {/* Central Lion Head & Mane */}
        <path 
          d="M50 4 C43 4 39 9 39 15 C39 18 41 21 44 23 C38 25 33 30 33 38 C33 46 38 52 44 54 C40 58 38 64 38 72 C38 80 46 86 50 88 C54 86 62 80 62 72 C62 64 60 58 56 54 C62 52 67 46 67 38 C67 30 62 25 56 23 C59 21 61 18 61 15 C61 9 57 4 50 4 Z" 
          fill="url(#goldGradient)"
        />

        {/* Left Lion Profile */}
        <path 
          d="M38 18 C33 16 28 20 28 27 C28 34 32 39 37 42 C34 46 32 52 32 60 C32 68 38 74 42 78 C39 70 38 62 40 54 C36 50 34 45 35 38 C35 32 39 27 42 24 Z" 
          fill="url(#goldGradient)" 
          opacity="0.9"
        />

        {/* Right Lion Profile */}
        <path 
          d="M62 18 C67 16 72 20 72 27 C72 34 68 39 63 42 C66 46 68 52 68 60 C68 68 62 74 58 78 C61 70 62 62 60 54 C64 50 66 45 65 38 C65 32 61 27 58 24 Z" 
          fill="url(#goldGradient)" 
          opacity="0.9"
        />

        {/* Facial details and mane fur accents */}
        <path d="M47 14 C47 16 48 18 50 18 C52 18 53 16 53 14 Z" fill="#FFF8E1" />
        <circle cx="46" cy="12" r="1.5" fill="#451A03" />
        <circle cx="54" cy="12" r="1.5" fill="#451A03" />
        <path d="M48 20 Q50 22 52 20" stroke="#451A03" strokeWidth="1" strokeLinecap="round" />

        {/* Muzzle & Whiskers */}
        <path d="M45 16 C47 17 53 17 55 16 C55 19 53 21 50 21 C47 21 45 19 45 16 Z" fill="#FFE082" />

        {/* Forelegs */}
        <rect x="42" y="55" width="4" height="30" rx="2" fill="url(#goldGradient)" />
        <rect x="54" y="55" width="4" height="30" rx="2" fill="url(#goldGradient)" />
        <rect x="47" y="52" width="6" height="33" rx="3" fill="url(#saffronGradient)" />

        {/* --- Abacus (Round Base) --- */}
        <rect x="22" y="87" width="56" height="6" rx="2" fill="url(#goldGradient)" />

        {/* Ashoka Chakra (Central Wheel) */}
        <circle cx="50" cy="100" r="8" fill="#FFFFFF" stroke="url(#goldGradient)" strokeWidth="2" />
        <circle cx="50" cy="100" r="2" fill="url(#goldGradient)" />
        {/* Chakra Spokes (24 rays representation) */}
        {[...Array(12)].map((_, i) => (
          <line
            key={i}
            x1="50"
            y1="93"
            x2="50"
            y2="107"
            stroke="#D97706"
            strokeWidth="0.8"
            transform={`rotate(${i * 15} 50 100)`}
          />
        ))}

        {/* Galloping Horse (Left of Chakra) */}
        <path d="M32 96 C30 94 28 95 27 98 C26 101 29 104 33 103 C34 101 35 97 32 96 Z" fill="url(#goldGradient)" />

        {/* Sacred Bull (Right of Chakra) */}
        <path d="M68 96 C70 94 72 95 73 98 C74 101 71 104 67 103 C66 101 65 97 68 96 Z" fill="url(#goldGradient)" />

        {/* Inverted Lotus Pedestal Base */}
        <path d="M18 109 C28 108 72 108 82 109 C80 114 20 114 18 109 Z" fill="url(#goldGradient)" />
        <rect x="15" y="114" width="70" height="4" rx="1.5" fill="url(#goldGradient)" />
      </svg>

      {showText && (
        <div className="text-[9px] font-black text-amber-500 tracking-wider text-center mt-0.5 leading-none">
          सत्यमेव जयते
        </div>
      )}
    </div>
  );
};
