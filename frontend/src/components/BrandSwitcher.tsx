import React from 'react';
import { Brand } from '../types';
import { Building2, ChevronDown, Check } from 'lucide-react';

interface BrandSwitcherProps {
  availableBrands: Brand[];
  activeBrand: Brand | null;
  onSelectBrand: (brand: Brand) => void;
  className?: string;
  variant?: 'compact' | 'full' | 'pills';
}

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({
  availableBrands,
  activeBrand,
  onSelectBrand,
  className = '',
  variant = 'compact',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'pills') {
    return (
      <div
        className={`flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-2.5 ${className}`}
        id="brand-switcher-pills"
      >
        <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 mr-0.5 sm:mr-1 shrink-0">
          <Building2 className="h-3.5 w-3.5 text-teal-400" />
          Workspace:
        </span>
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2">
          {availableBrands.map((b) => {
            const isSelected = activeBrand?.id === b.id;
            return (
              <button
                key={b.id}
                id={`brand-pill-${b.id}`}
                onClick={() => onSelectBrand(b)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                  isSelected
                    ? 'bg-teal-400 text-black font-semibold shadow-md shadow-teal-500/10'
                    : 'bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id="brand-switcher">
      <button
        type="button"
        id="brand-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 font-medium transition-all focus:outline-none focus:ring-1 focus:ring-teal-400"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Building2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[200px] font-sans">
          {activeBrand?.name || 'Select Workspace'}
        </span>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id="brand-switcher-menu"
          className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 rounded-xl bg-[#090D14] border border-zinc-800 shadow-xl shadow-black/60 z-50 py-1.5 focus:outline-none backdrop-blur-md"
        >
          <div className="px-3 py-1.5 border-b border-zinc-800/80 mb-1">
            <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">
              Active Brand Workspace
            </span>
          </div>
          {availableBrands.map((b) => {
            const isSelected = activeBrand?.id === b.id;
            return (
              <button
                key={b.id}
                id={`brand-select-${b.id}`}
                onClick={() => {
                  onSelectBrand(b);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-teal-500/10 text-teal-300 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-sans font-medium text-white">{b.name}</span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {b.id === '00000000-0000-0000-0000-000000000001'
                      ? 'Cookware / FMCG'
                      : b.id === '00000000-0000-0000-0000-000000000002'
                      ? 'Audio Electronics'
                      : 'Workspace'}
                  </span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-teal-400 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
