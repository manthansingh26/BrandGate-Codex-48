import React from 'react';

interface BrandGateLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'badge' | 'badge-dark' | 'mark' | 'full';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  xs: { badge: 'h-6 w-6', text: 'text-base', sub: 'text-[9px]' },
  sm: { badge: 'h-8 w-8', text: 'text-lg', sub: 'text-[10px]' },
  md: { badge: 'h-11 w-11', text: 'text-2xl', sub: 'text-xs' },
  lg: { badge: 'h-14 w-14', text: 'text-3xl', sub: 'text-xs' },
  xl: { badge: 'h-20 w-20', text: 'text-4xl', sub: 'text-sm' },
};

export const BrandGateLogo: React.FC<BrandGateLogoProps> = ({
  size = 'sm',
  variant = 'full',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
  const currentSize = sizeMap[size];

  const badgeSrc =
    variant === 'badge-dark'
      ? '/brandgate-badge-dark.png'
      : variant === 'mark'
      ? '/brandgate-logo-teal.png'
      : '/brandgate-badge-teal.png';

  const markElement = (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 ${currentSize.badge}`}
    >
      <img
        src={badgeSrc}
        alt="BrandGate Logo Mark"
        className="h-full w-full object-contain drop-shadow-md rounded-lg"
      />
    </div>
  );

  if (variant === 'badge' || variant === 'badge-dark' || variant === 'mark') {
    return (
      <div className={`inline-flex items-center ${className}`} onClick={onClick}>
        {markElement}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 cursor-pointer group select-none ${className}`}
    >
      {markElement}
      <div className="flex flex-col justify-center">
        <span
          className={`font-black tracking-tight text-white flex items-center leading-none ${currentSize.text}`}
        >
          BrandGate
        </span>
        {showSubtitle && (
          <span
            className={`text-zinc-400 font-mono uppercase tracking-widest block font-medium mt-1 leading-none ${currentSize.sub}`}
          >
            Pre-Publication Gate
          </span>
        )}
      </div>
    </div>
  );
};
