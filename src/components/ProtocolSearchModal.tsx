import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  Building,
  Clock,
  ArrowRight,
  Printer,
  Hash,
  Receipt,
  Layers,
  ChevronRight,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Cantiere, SospesoItem, AttachmentPdf } from '../types';
import {
  searchByProtocol,
  groupResultsByProtocol,
  getAllDistinctProtocols,
  ProtocolSearchResultItem,
  ProtocolGroupResult,
} from '../utils/protocolSearchHelper';
import { formatCurrency, formatDateItalian } from '../utils/calculations';
import { openOrDownloadPdf } from '../utils/pdfStorage';

interface ProtocolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  cantieri: Cantiere[];
  sospesi?: SospesoItem[];
  initialProtocol?: string;
  onNavigateToCantiere?: (cantiereId: string) => void;
  onNavigateToSospesi?: () => void;
}

export const ProtocolSearchModal: React.FC<ProtocolSearchModalProps> = ({
  isOpen,
  onClose,
  cantieri,
  sospesi = [],
  initialProtocol = '',
  onNavigateToCantiere,
  onNavigateToSospesi,
}) => {
  const [query, setQuery] = useState(initialProtocol || '');

  // Synchronize when initialProtocol changes from props
  useEffect(() => {
    if (initialProtocol) {
      setQuery(initialProtocol);
    }
  }, [initialProtocol, isOpen]);

  // All distinct protocols in the system for quick filter pills
  const availableProtocols = useMemo(() => {
    return getAllDistinctProtocols(cantieri, sospesi);
  }, [cantieri, sospesi]);

  // Filtered movements based on search query
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchByProtocol(query, cantieri, sospesi);
  }, [query, cantieri, sospesi]);

  // Grouped results by protocol
  const groupedResults = useMemo(() => {
    return groupResultsByProtocol(searchResults);
  }, [searchResults]);

  // Overall totals across the entire search results
  const overallTotals = useMemo(() => {
    let cantieriTotal = 0;
    let sospesiTotal = 0;
    let totalPurchases = 0;
    const distinctCantieri = new Set<string>();

    searchResults.forEach((r) => {
      totalPurchases += r.purchases;
      if (r.sourceType === 'cantiere') {
        cantieriTotal += r.purchases;
        distinctCantieri.add(r.cantiereName);
      } else {
        sospesiTotal += r.purchases;
      }
    });

    return {
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      cantieriTotal: Math.round(cantieriTotal * 100) / 100,
      sospesiTotal: Math.round(sospesiTotal * 100) / 100,
      rowsCount: searchResults.length,
      cantieriCount: distinctCantieri.size,
    };
  }, [searchResults]);

  if (!isOpen) return null;

  const handleSelectProtocolChip = (p: string) => {
    setQuery(p);
  };

  const handleGoToDestination = (item: ProtocolSearchResultItem) => {
    onClose();
    if (item.sourceType === 'cantiere' && item.cantiereId && onNavigateToCantiere) {
      onNavigateToCantiere(item.cantiereId);
    } else if (item.sourceType === 'sospeso' && onNavigateToSospesi) {
      onNavigateToSospesi();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Ricerca Fattura per Numero di Protocollo</span>
              </h2>
              <p className="text-xs text-slate-400">
                Verifica in quali cantieri e righe di costo è stata imputata la fattura con il suo N./PROT contabile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {searchResults.length > 0 && (
              <button
                type="button"
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                title="Stampa elenco"
              >
                <Printer className="h-3.5 w-3.5 text-slate-300" />
                <span>Stampa</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Auto-suggestions */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Inserisci il numero di protocollo (es. 142, 2026/045, PROT-12)..."
              autoFocus
              className="w-full pl-11 pr-10 py-3 bg-slate-950 border-2 border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-white placeholder-slate-500 rounded-xl font-mono text-sm sm:text-base outline-none transition-all shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                title="Cancella ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick-filter Chips of Registered Protocols */}
          {availableProtocols.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-amber-400" />
                  <span>Protocolli registrati nel gestionale ({availableProtocols.length}):</span>
                </span>
                <span className="text-slate-500 font-normal">Clicca per selezionare</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {availableProtocols.slice(0, 24).map((p) => {
                  const isSelected = query.trim().toLowerCase() === p.protocol.toLowerCase();
                  return (
                    <button
                      key={p.protocol}
                      type="button"
                      onClick={() => handleSelectProtocolChip(p.protocol)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-md shadow-amber-500/20'
                          : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <span>#{p.protocol}</span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded-full font-sans font-bold ${
                          isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {p.count} righe
                      </span>
                    </button>
                  );
                })}
                {availableProtocols.length > 24 && (
                  <span className="text-[11px] text-slate-500 self-center pl-1">
                    +{availableProtocols.length - 24} altri...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {!query.trim() ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800/60 border border-slate-700 text-slate-400">
                <Hash className="h-8 w-8 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white">Nessun protocollo inserito</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Digita nella barra in alto il numero di registrazione o protocollo (N./PROT) della fattura, oppure
                seleziona uno dei protocolli veloci registrati per consultare la ripartizione dei costi.
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-white">Nessuna fattura trovata</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Nessun movimento o DDT registrato con il protocollo{' '}
                <strong className="text-amber-300 font-mono">"{query}"</strong>. Controlla il numero o verifica se la
                fattura è stata registrata con prefissi differenti.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Total Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Grand Total */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border-2 border-amber-500/30 shadow-md">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Totale Complessivo</span>
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                    {formatCurrency(overallTotals.totalPurchases)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Somma di tutti gli importi per la ricerca
                  </div>
                </div>

                {/* Cantieri Total */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Imputato nei Cantieri</span>
                    <Building className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {formatCurrency(overallTotals.cantieriTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ripartito su {overallTotals.cantieriCount} cantieri distinti
                  </div>
                </div>

                {/* Sospesi Total */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>In Scheda Sospesi</span>
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {formatCurrency(overallTotals.sospesiTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    DDT e importi ancora da attribuire
                  </div>
                </div>

                {/* Rows Count */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Righe Trovate</span>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {overallTotals.rowsCount} righe
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Su {groupedResults.length} protocollo/i rilevati
                  </div>
                </div>
              </div>

              {/* Grouped Breakdown by Protocol */}
              <div className="space-y-6">
                {groupedResults.map((group) => (
                  <div
                    key={group.protocol}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
                  >
                    {/* Group Header with Protocol Badge & Group Total */}
                    <div className="p-3.5 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg font-mono text-xs font-black bg-amber-400 text-slate-950 shadow-sm">
                          PROT. #{group.protocol}
                        </span>
                        <div className="text-xs text-slate-300">
                          {group.docNumbers.length > 0 && (
                            <span>
                              Doc: <strong className="text-white">{group.docNumbers.join(', ')}</strong>
                            </span>
                          )}
                          {group.suppliers.length > 0 && (
                            <span className="text-slate-400 ml-2 hidden sm:inline">
                              • {group.suppliers.slice(0, 2).join(' / ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Totale Protocollo
                          </span>
                          <span className="text-sm sm:text-base font-extrabold font-mono text-amber-300">
                            {formatCurrency(group.totalPurchases)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table of items belonging to this protocol */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px] font-bold">
                            <th className="py-2.5 px-3">DESTINAZIONE / CANTIERE</th>
                            <th className="py-2.5 px-3 w-24">DATA DOC.</th>
                            <th className="py-2.5 px-3 w-32">N° DOC.</th>
                            <th className="py-2.5 px-3">TIPO DOC. / FORNITORE</th>
                            <th className="py-2.5 px-3 text-right w-28 text-rose-400">IMPORTO (€)</th>
                            <th className="py-2.5 px-3 text-center w-24">PDF</th>
                            <th className="py-2.5 px-3 text-right w-32">AZIONE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-300">
                          {group.items.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-800/40 transition-colors group"
                            >
                              {/* Cantiere / Destinazione */}
                              <td className="py-2.5 px-3">
                                {item.sourceType === 'cantiere' ? (
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-white">
                                      <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                      <span>{item.cantiereName}</span>
                                    </div>
                                    {(item.cantiereCity || item.cantiereAddress) && (
                                      <div className="text-[11px] text-slate-400 pl-5">
                                        {[item.cantiereCity, item.cantiereAddress].filter(Boolean).join(' - ')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    <span>SCHEDA SOSPESI (In attesa)</span>
                                  </div>
                                )}
                              </td>

                              {/* Data Doc */}
                              <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-300">
                                {formatDateItalian(item.date)}
                              </td>

                              {/* N° Doc */}
                              <td className="py-2.5 px-3 whitespace-nowrap font-medium text-white">
                                <div className="flex items-center gap-1">
                                  <span>{item.docNumber}</span>
                                  {item.source === 'xml' && (
                                    <span className="px-1 py-0.2 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                      XML
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Tipo Doc / Fornitore */}
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-100">{item.typeAndSubject}</div>
                                {item.notes && (
                                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                    {item.notes}
                                  </div>
                                )}
                              </td>

                              {/* Importo */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-300 whitespace-nowrap">
                                {formatCurrency(item.purchases)}
                              </td>

                              {/* PDF */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {item.attachmentPdf ? (
                                  <button
                                    type="button"
                                    onClick={() => openOrDownloadPdf(item.attachmentPdf!)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                    title={`Apri ${item.attachmentPdf.fileName}`}
                                  >
                                    <FileText className="h-3 w-3 text-red-400" />
                                    <span>PDF</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-600 text-[11px]">-</span>
                                )}
                              </td>

                              {/* Azioni */}
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleGoToDestination(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-200 border border-slate-700 hover:border-amber-400 transition-all cursor-pointer"
                                  title={
                                    item.sourceType === 'cantiere'
                                      ? `Apri scheda ${item.cantiereName}`
                                      : 'Apri Scheda Sospesi'
                                  }
                                >
                                  <span>{item.sourceType === 'cantiere' ? 'Vai al Cantiere' : 'Vai a Sospesi'}</span>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>
              Ricerca in tempo reale su <strong>{cantieri.length} cantieri</strong> e{' '}
              <strong>{sospesi.length} sospesi</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
