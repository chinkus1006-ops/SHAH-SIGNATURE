import React from 'react';
import { useApp } from '../context/AppContext';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  light = false,
  showTagline = true,
  className = '',
}) => {
  const { businessSettings } = useApp();

  // Official logo image assets uploaded by owner Ronak
  const DEFAULT_FULL_LOGO = '/assets/aistudio/1783851770902_86d18057.png';
  const OFFICIAL_FULL_LOGO = businessSettings?.businessLogo || DEFAULT_FULL_LOGO;
  const OFFICIAL_BADGE_LOGO = '/assets/aistudio/file_000000006498720893b792c190ab070e_3db2f77e.png';

  // Height specifications for the official horizontal logo
  const fullHeights = {
    sm: 'h-7 sm:h-8',
    md: 'h-9 sm:h-10',
    lg: 'h-11 sm:h-12',
    xl: 'h-14 sm:h-16',
  };

  // Badge icon dimensions
  const badgeSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const titleSizes = {
    sm: 'text-sm tracking-wider',
    md: 'text-base sm:text-lg tracking-widest',
    lg: 'text-xl sm:text-2xl tracking-widest',
    xl: 'text-2xl sm:text-3xl tracking-widest',
  };

  const taglineSizes = {
    sm: 'text-[8px]',
    md: 'text-[9px] sm:text-[10px]',
    lg: 'text-[11px] sm:text-xs',
    xl: 'text-xs sm:text-sm',
  };

  // If icon-only requested, display the owner's round badge emblem
  if (variant === 'icon-only') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={OFFICIAL_BADGE_LOGO}
          alt={businessSettings?.brandName || 'SHAH SIGNATURE'}
          className={`${badgeSizes[size]} object-contain rounded-full shadow-sm hover:scale-105 transition-transform duration-300`}
          loading="eager"
        />
      </div>
    );
  }

  // If full banner requested, render the owner's official horizontal logo with full proportions
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <div className="relative group flex items-center">
          <img
            src={OFFICIAL_FULL_LOGO}
            onError={e => {
              const img = e.currentTarget;
              if (!img.src.endsWith(DEFAULT_FULL_LOGO)) {
                img.src = DEFAULT_FULL_LOGO;
              }
            }}
            alt={`${businessSettings?.brandName || 'SHAH SIGNATURE'} - ${businessSettings?.tagline || 'ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.'}`}
            className={`${fullHeights[size]} w-auto object-contain max-w-[280px] sm:max-w-[360px] drop-shadow-sm transition-all duration-300`}
            loading="eager"
          />
        </div>
      </div>
    );
  }

  // Compact variant: Round official emblem + typography
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      <img
        src={OFFICIAL_BADGE_LOGO}
        alt="SHAH SIGNATURE Emblem"
        className={`${badgeSizes[size]} shrink-0 object-contain rounded-full shadow-xs`}
        loading="eager"
      />

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-brand font-black uppercase tracking-wider ${titleSizes[size]} ${light ? 'text-[#060B18]' : 'text-white'}`}>
            SHAH
          </span>
          <span className={`font-brand font-black uppercase tracking-wider bg-gradient-to-r from-[#00D2C4] via-[#0284C7] to-[#0B132B] bg-clip-text text-transparent ${titleSizes[size]}`}>
            SIGNATURE
          </span>
        </div>

        {showTagline && (
          <div className={`mt-0.5 font-bold tracking-widest uppercase text-[#0284C7] ${taglineSizes[size]} truncate max-w-[210px] sm:max-w-[340px]`}>
            {businessSettings.tagline || 'ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.'}
          </div>
        )}
      </div>
    </div>
  );
};
