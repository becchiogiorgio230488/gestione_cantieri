import React, { useState, useMemo } from 'react';
import {
  Users,
  Building,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Clock,
  Scale,
  Edit,
  Trash2,
  FileUp,
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Artigiano, CantiereCategory } from '../types';
import { calculateArtigianoTotals, formatCurrency } from '../utils/calculations';
import { ConfirmModal } from './ConfirmModal';

interface ArtigianiHomeViewProps {
  artigiani: Artigiano[];
  onSelectArtigiano: (artigianoId: string) => void;
  onOpenNewArtigiano: () => void;
  onEditArtigiano: (artigiano: Artigiano) => void;
  onDeleteArtigiano: (artigianoId: string) => void;
  onOpenXmlImportForArtigiano?: (artigianoId: string) => void;
  onOpenExcelImport?: () => void;
}

export const ArtigianiHomeView: React.FC<ArtigianiHomeViewProps> = ({
  artigiani,
  onSelectArtigiano,
  onOpenNewArtigiano,
  onEditArtigiano,
  onDeleteArtigiano,
  onOpenXmlImportForArtigiano,
  onOpenExcelImport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [artigianoToDelete, setArtigianoToDelete] = useState<Artigiano | null>(null);

  // Filtered artisans
  const filteredArtigiani = useMemo(() => {
    return artigiani.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.businessName && a.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.city && a.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.partitaIva && a.partitaIva.includes(searchTerm));

      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [artigiani, searchTerm, selectedCategory]);

  const getCategoryBadge = (cat: CantiereCategory) => {
    switch (cat) {
      case 'elettrico':
        return {
          label: 'Elettricista & Domotica',
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'idraulico':
        return {
          label: 'Idraulico & Termico',
          bg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          dot: 'bg-cyan-400',
        };
      case 'edile':
        return {
          label: 'Impresa Edile',
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      default:
        return {
          label: 'Impiantistica',
          bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
          dot: 'bg-indigo-400',
        };
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Title Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              HOME CANTIERI
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenExcelImport && (
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold border border-emerald-500/40 transition-all shadow-md cursor-pointer"
                title="Importa vecchi cantieri, saldi o schede da file Excel (.xls / .xlsx)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
                <span>Importa da Excel</span>
              </button>
            )}

            <button
              onClick={onOpenNewArtigiano}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-slate-950" />
              <span>+ Nuovo Cliente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca artigiano, ditta o città..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Tutti i Settori' },
            { id: 'elettrico', label: 'Elettrico' },
            { id: 'idraulico', label: 'Idraulico' },
            { id: 'edile', label: 'Edile' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Artigiani Grid / Cards */}
      {filteredArtigiani.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Users className="h-10 w-10 text-slate-500 mx-auto mb-3 opacity-50" />
          <p className="text-slate-300 font-semibold text-sm">Nessun artigiano trovato.</p>
          <p className="text-slate-500 text-xs mt-1">
            Modifica i filtri di ricerca o aggiungi un nuovo cliente allo studio.
          </p>
          <button
            onClick={onOpenNewArtigiano}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
          >
            + Aggiungi Nuovo Artigiano
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredArtigiani.map((art) => {
            const stats = calculateArtigianoTotals(art);
            const badge = getCategoryBadge(art.category);

            return (
              <div
                key={art.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-black text-lg group-hover:scale-105 transition-transform shadow-inner">
                        {art.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-base font-black text-white group-hover:text-amber-300 transition-colors tracking-tight">
                          {art.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          <span>{art.city || 'Italia'}</span>
                          {art.partitaIva && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px] text-slate-400">
                                P.IVA {art.partitaIva}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditArtigiano(art);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Modifica anagrafica artigiano"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setArtigianoToDelete(art);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={`Elimina artigiano ${art.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Business Name & Sector badge */}
                  <div className="mb-4">
                    {art.businessName && (
                      <p className="text-xs text-slate-300 font-medium line-clamp-1 mb-2">
                        {art.businessName}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>

                      {stats.totaleSospesiCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="h-3 w-3" />
                          <span>{stats.totaleSospesiCount} sospesi</span>
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          stats.isQuadraturaBilanciata
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                        title={
                          stats.isQuadraturaBilanciata
                            ? 'Mastrini contabilità generale quadrati'
                            : 'Quadratura mastrini da verificare'
                        }
                      >
                        <Scale className="h-3 w-3" />
                        <span>{stats.isQuadraturaBilanciata ? 'Mastri Quadrati' : 'Mastri da Allineare'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Financial KPI Matrix */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 mb-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Cantieri
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-bold text-white">
                          {stats.totaleCantieri}
                        </span>
                        <span className="text-[10px] text-emerald-400">
                          ({stats.cantieriAttivi} attivi)
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Margine Netto
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-bold text-emerald-400 font-mono">
                          {formatCurrency(stats.totaleUtile)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({stats.marginePercentuale}%)
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Tot. Acquisti
                      </span>
                      <span className="text-xs font-semibold text-rose-300 font-mono">
                        {formatCurrency(stats.totaleAcquisti)}
                      </span>
                    </div>

                    <div className="border-t border-slate-800/60 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Tot. Emesse
                      </span>
                      <span className="text-xs font-semibold text-blue-300 font-mono">
                        {formatCurrency(stats.totaleEmesse)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button (Drills to Level 2) */}
                <div className="space-y-2">
                  <button
                    onClick={() => onSelectArtigiano(art.id)}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md group-hover:shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Apri Prospetto Generale Cantieri</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  {onOpenXmlImportForArtigiano && (
                    <button
                      onClick={() => onOpenXmlImportForArtigiano(art.id)}
                      className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      <span>Importa XML per {art.name.split(' ')[0]}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Client Deletion */}
      <ConfirmModal
        isOpen={!!artigianoToDelete}
        title="Elimina Cliente Artigiano"
        message={
          artigianoToDelete ? (
            <div className="space-y-2">
              <p>
                Sei sicuro di voler eliminare definitivamente l'artigiano{' '}
                <strong className="text-white font-bold">"{artigianoToDelete.name}"</strong>?
              </p>
              {artigianoToDelete.businessName && (
                <p className="text-xs text-slate-400">
                  Ragione Sociale: {artigianoToDelete.businessName}
                </p>
              )}
              {artigianoToDelete.cantieri?.length > 0 ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 mt-2">
                  <strong>Attenzione:</strong> verranno eliminati anche tutti i{' '}
                  <strong className="underline">{artigianoToDelete.cantieri.length} cantieri</strong>{' '}
                  associati e tutte le relative registrazioni contabili.
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Nessun cantiere attivo associato.
                </p>
              )}
            </div>
          ) : (
            ''
          )
        }
        confirmText="Elimina Cliente"
        cancelText="Annulla"
        onConfirm={() => {
          if (artigianoToDelete) {
            onDeleteArtigiano(artigianoToDelete.id);
            setArtigianoToDelete(null);
          }
        }}
        onCancel={() => setArtigianoToDelete(null)}
      />
    </div>
  );
};
