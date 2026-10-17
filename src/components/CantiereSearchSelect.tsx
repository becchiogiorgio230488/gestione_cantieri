import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Building, MapPin, AlertTriangle, Ban } from 'lucide-react';
import { Cantiere } from '../types';

export interface CantiereSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  cantieri: Cantiere[];
  onCreateNew?: () => void;
  showSospesiOption?: boolean;
  showIgnoreOption?: boolean;
  showUnassignedOption?: boolean;
  sospesiLabel?: string;
  ignoreLabel?: string;
  unassignedLabel?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  autoOpenSearch?: boolean;
  hasError?: boolean;
}

/**
 * Standard cantiere option label formatting:
 * "CITTA - VIA (CLIENTE)"
 */
export function formatCantiereLabel(c: Cantiere): string {
  const city = (c.city || '').trim().toUpperCase();
  const address = (c.address || '').trim().toUpperCase();
  const client = (c.client || c.name || '').trim().toUpperCase();

  let location = city;
  if (address) {
    location = location ? `${location} - ${address}` : address;
  }
  if (!location) {
    location = (c.name || 'CANTIERE').trim().toUpperCase();
  }

  if (client) {
    return `${location} (${client})`;
  }
  return location;
}

/**
 * Searchable Cantiere Combobox / Select Component
 * Allows instant search by cantiere NAME or CITY (plus address and client).
 * Supports special options: "+ Crea Nuovo Cantiere", "Scheda Sospesi", and "Da non considerare".
 */
export const CantiereSearchSelect: React.FC<CantiereSearchSelectProps> = ({
  value,
  onChange,
  cantieri,
  onCreateNew,
  showSospesiOption = true,
  showIgnoreOption = true,
  showUnassignedOption = true,
  sospesiLabel = '⚠️ Invia a SCHEDA SOSPESI (Da chiarire con il cliente)',
  ignoreLabel = '⛔ DA NON CONSIDERARE (Spese bancarie / Spese generali)',
  unassignedLabel = '⚠️ DA SELEZIONARE (Nessun cantiere)',
  placeholder = 'Cerca cantiere per nome o città...',
  className = '',
  size = 'md',
  disabled = false,
  hasError = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Autofocus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [isOpen]);

  // Sort cantieri by CITTA - VIA
  const sortedCantieri = useMemo(() => {
    return [...cantieri].sort((a, b) => {
      const cityA = (a.city || '').trim().toLowerCase();
      const cityB = (b.city || '').trim().toLowerCase();
      const cityCmp = cityA.localeCompare(cityB, 'it');
      if (cityCmp !== 0) return cityCmp;
      const addrA = (a.address || '').trim().toLowerCase();
      const addrB = (b.address || '').trim().toLowerCase();
      return addrA.localeCompare(addrB, 'it');
    });
  }, [cantieri]);

  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Filter cantieri by searchQuery across: NAME, CITY, ADDRESS, CLIENT
  const filteredCantieri = useMemo(() => {
    const q = normalizeText(searchQuery);
    if (!q) return sortedCantieri;

    return sortedCantieri.filter((c) => {
      const name = normalizeText(c.name || '');
      const city = normalizeText(c.city || '');
      const addr = normalizeText(c.address || '');
      const client = normalizeText(c.client || '');

      return (
        city.includes(q) ||
        name.includes(q) ||
        addr.includes(q) ||
        client.includes(q)
      );
    });
  }, [sortedCantieri, searchQuery]);

  // Find currently selected cantiere object
  const selectedCantiere = useMemo(() => {
    return cantieri.find((c) => c.id === value);
  }, [cantieri, value]);

  // Get display text for trigger button
  const selectedDisplay = useMemo(() => {
    if (value === '__sospeso__') {
      return {
        text: sospesiLabel,
        isSpecial: true,
        type: 'sospeso' as const,
      };
    }
    if (value === '__ignore__') {
      return {
        text: ignoreLabel,
        isSpecial: true,
        type: 'ignore' as const,
      };
    }
    if (selectedCantiere) {
      return {
        text: formatCantiereLabel(selectedCantiere),
        isSpecial: false,
        city: selectedCantiere.city,
        cantiere: selectedCantiere,
      };
    }
    return null;
  }, [value, selectedCantiere, sospesiLabel, ignoreLabel]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCantieri.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredCantieri.length) {
        handleSelect(filteredCantieri[highlightedIndex].id);
      } else if (filteredCantieri.length === 1) {
        handleSelect(filteredCantieri[0].id);
      }
    }
  };

  const isSmall = size === 'sm';

  return (
    <div className={`relative ${isOpen ? 'z-40' : 'z-0'} ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 shadow-sm ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800'
              : hasError && !value
              ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200 hover:border-rose-400 animate-pulse'
              : isOpen
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-slate-900'
              : value === '__ignore__'
              ? 'border-rose-500/50 bg-rose-950/20 text-rose-300 hover:border-rose-400'
              : value === '__sospeso__'
              ? 'border-amber-500/50 bg-amber-950/20 text-amber-300 hover:border-amber-400'
              : value
              ? 'border-slate-700 bg-slate-900 text-white hover:border-slate-600'
              : 'border-amber-500/70 bg-amber-500/10 text-amber-300 hover:border-amber-400 hover:bg-amber-500/15 shadow-inner'
          } ${isSmall ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-sm'}`}
          title="Clicca per cercare e scegliere il cantiere per nome o città"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Search className={`shrink-0 ${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${hasError && !value ? 'text-rose-400' : isOpen ? 'text-amber-400' : value ? 'text-slate-400' : 'text-amber-400'}`} />
            {selectedDisplay ? (
              <div className="truncate flex-1 font-medium">
                {selectedDisplay.isSpecial ? (
                  <span className={selectedDisplay.type === 'ignore' ? 'text-rose-300 font-bold' : 'text-amber-300 font-bold'}>
                    {selectedDisplay.text}
                  </span>
                ) : (
                  <span className="text-white font-semibold flex items-center gap-1.5 truncate">
                    {selectedDisplay.city && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0 border border-slate-700">
                        {selectedDisplay.city}
                      </span>
                    )}
                    <span className="truncate">{selectedDisplay.text}</span>
                  </span>
                )}
              </div>
            ) : (
              <span className={`font-bold flex items-center gap-1.5 truncate text-xs ${hasError ? 'text-rose-300' : 'text-amber-300'}`}>
                <span className={`px-1.5 py-0.2 rounded border text-[10px] uppercase font-black tracking-wider shrink-0 ${
                  hasError
                    ? 'bg-rose-500/30 border-rose-500 text-rose-200'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                }`}>
                  {hasError ? '🚨 OBBLIGATORIO: DA SELEZIONARE' : '⚠️ DA SELEZIONARE'}
                </span>
                <span className="truncate text-amber-300/80 font-normal hidden sm:inline">
                  {placeholder}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="p-0.5 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition-colors"
                title="Deseleziona / Riporta a 'DA SELEZIONARE'"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'
              } ${isOpen ? 'rotate-180 text-amber-400' : ''}`}
            />
          </div>
        </button>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[320px] max-w-full backdrop-blur-md animate-fadeIn"
          style={{ minWidth: isSmall ? '300px' : '360px' }}
        >
          {/* Search Header Input */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/90 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cerca per nome cantiere o città..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  title="Cancella ricerca"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {onCreateNew && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
                title="Crea direttamente un nuovo cantiere"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nuovo</span>
              </button>
            )}
          </div>

          {/* Quick Create option at top when searching or browsing */}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateNew();
              }}
              className="w-full px-3 py-2 text-left text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 border-b border-slate-800/80 flex items-center gap-2 transition-colors cursor-pointer group"
            >
              <div className="h-5 w-5 rounded bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 truncate">
                <span>➕ + CREA NUOVO CANTIERE...</span>
                {searchQuery.trim() && (
                  <span className="text-[11px] text-emerald-300/80 font-normal block">
                    Crea cantiere per "{searchQuery.trim()}"
                  </span>
                )}
              </div>
            </button>
          )}

          {/* Special Destinations: Sospesi & Ignore */}
          <div className="border-b border-slate-800/80 py-1 bg-slate-950/40">
            {showSospesiOption && (
              <button
                type="button"
                onClick={() => handleSelect('__sospeso__')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  value === '__sospeso__'
                    ? 'bg-amber-500/20 text-amber-200 font-bold'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{sospesiLabel}</span>
                </div>
                {value === '__sospeso__' && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              </button>
            )}

            {showIgnoreOption && (
              <button
                type="button"
                onClick={() => handleSelect('__ignore__')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  value === '__ignore__'
                    ? 'bg-rose-500/20 text-rose-200 font-bold'
                    : 'text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Ban className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{ignoreLabel}</span>
                </div>
                {value === '__ignore__' && <Check className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
              </button>
            )}

            {showUnassignedOption && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  !value
                    ? 'bg-amber-500/20 text-amber-200 font-bold'
                    : 'text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/30 border border-amber-500/50 font-bold text-amber-200">
                    NON ASSEGNATO
                  </span>
                  <span className="truncate">{unassignedLabel}</span>
                </div>
                {!value && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              </button>
            )}
          </div>

          {/* Scrollable list of Cantieri */}
          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-800/40">
            {filteredCantieri.length > 0 ? (
              filteredCantieri.map((c) => {
                const isSelected = c.id === value;
                const formatted = formatCantiereLabel(c);
                const city = (c.city || '').trim().toUpperCase();
                const address = (c.address || '').trim().toUpperCase();
                const client = (c.client || '').trim().toUpperCase();

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors cursor-pointer flex items-start justify-between gap-2 group ${
                      isSelected
                        ? 'bg-amber-500/15 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <MapPin
                        className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                          isSelected ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5 flex-wrap">
                          {city && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-amber-300 text-[10px] font-black uppercase">
                              {city}
                            </span>
                          )}
                          <span className="text-white">
                            {address ? `${address}` : c.name}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                          {client && (
                            <span>
                              Cliente: <strong className="text-slate-300">{client}</strong>
                            </span>
                          )}
                          {c.name && c.name !== address && (
                            <span className="text-slate-500 font-mono text-[10px]">
                              ({c.name})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                <p>Nessun cantiere trovato per "{searchQuery}".</p>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onCreateNew();
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Crea Nuovo Cantiere</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer showing count */}
          <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span>
              {filteredCantieri.length} cantier{filteredCantieri.length === 1 ? 'e' : 'i'} trovat{filteredCantieri.length === 1 ? 'o' : 'i'}
            </span>
            <span className="italic">Cerca per nome o città</span>
          </div>
        </div>
      )}
    </div>
  );
};
