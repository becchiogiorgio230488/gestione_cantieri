import React, { useState } from 'react';
import {
  FileSpreadsheet,
  PlusCircle,
  Download,
  Building,
  RotateCcw,
  LayoutDashboard,
  Clock,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { Artigiano, NavigationLevel } from '../types';
import { exportBackupJSON, resetAllDataToDefaults } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';

interface HeaderProps {
  artigiani: Artigiano[];
  selectedArtigianoId: string | null;
  selectedCantiereId: string | null;
  navLevel: NavigationLevel;
  isSupabaseConnected?: boolean;
  onNavigateHome: () => void;
  onNavigateToProspetto: (artigianoId?: string) => void;
  onNavigateToScheda: (cantiereId?: string) => void;
  onNavigateToSospesi: () => void;
  onSelectArtigiano: (artigianoId: string) => void;
  onOpenNewArtigiano: () => void;
  onOpenNewCantiere?: () => void;
  onOpenFatturaEmessa?: () => void;
  onOpenXmlImport?: () => void;
  onOpenExcelImport?: () => void;
  onOpenSupabaseSync?: () => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  artigiani,
  selectedArtigianoId,
  selectedCantiereId,
  navLevel,
  isSupabaseConnected,
  onNavigateHome,
  onNavigateToProspetto,
  onNavigateToScheda,
  onNavigateToSospesi,
  onSelectArtigiano,
  onOpenNewArtigiano,
  onOpenExcelImport,
  onOpenSupabaseSync,
  onResetData,
}) => {
  const currentArtigiano =
    artigiani.find((a) => a.id === selectedArtigianoId) || artigiani[0];

  const currentCantiere = currentArtigiano?.cantieri?.find(
    (c) => c.id === selectedCantiereId
  );

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const totSospesiCount = currentArtigiano?.sospesi?.length || 0;

  const handleBackup = () => {
    exportBackupJSON(artigiani);
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="text-left flex items-center gap-3 cursor-pointer group focus:outline-none"
              title="HOME CANTIERI"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Building className="h-6 w-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tight text-white group-hover:text-amber-300 transition-colors">
                    GESTIONE CANTIERI
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Quick Actions: Solo Nuovo Cliente e Backup */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Nuovo Cliente */}
            <button
              onClick={onOpenNewArtigiano}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-sm cursor-pointer"
              title="Registra un nuovo cliente / artigiano"
            >
              <PlusCircle className="h-4 w-4 text-slate-950" />
              <span>+ Nuovo Cliente</span>
            </button>

            {/* Importa da Excel */}
            {onOpenExcelImport && (
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/40 transition-all shadow-sm cursor-pointer"
                title="Importa vecchi cantieri e dati storici da file Excel (.xls / .xlsx)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
                <span className="hidden sm:inline">Importa Excel</span>
                <span className="sm:hidden">Excel</span>
              </button>
            )}

            {/* Supabase Cloud Status */}
            {onOpenSupabaseSync && (
              <button
                type="button"
                onClick={onOpenSupabaseSync}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                  isSupabaseConnected
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title={
                  isSupabaseConnected
                    ? 'Supabase Cloud Connesso (Realtime attivo) - Clicca per gestire'
                    : 'Configura o gestisci sincronizzazione Supabase'
                }
              >
                <Cloud className={`h-4 w-4 ${isSupabaseConnected ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">
                  {isSupabaseConnected ? 'Supabase Realtime' : 'Supabase Cloud'}
                </span>
                {isSupabaseConnected && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            )}

            {/* Backup */}
            <button
              onClick={handleBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              title="Scarica backup JSON completo dei dati"
            >
              <Download className="h-4 w-4 text-slate-400" />
              <span>Backup</span>
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Ripristina dati iniziali di esempio"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 3-Level Breadcrumb Navigation Bar */}
        <div className="flex items-center border-t border-slate-800/80 py-2.5 text-xs overflow-x-auto gap-2">
          {/* Level 1 Link */}
          <button
            onClick={onNavigateHome}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
              navLevel === 'home_artigiani'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building className="h-3.5 w-3.5 text-amber-400" />
            <span>HOME CANTIERI</span>
          </button>

          {currentArtigiano && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />

              {/* Level 2 Link */}
              <button
                onClick={() => onNavigateToProspetto(currentArtigiano.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  navLevel === 'prospetto_cantieri'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-cyan-400" />
                <span>
                  LIVELLO 2: Prospetto Generale ({currentArtigiano.name})
                </span>
              </button>

              {/* Sospesi Link (Artisan Sospesi) */}
              <button
                onClick={onNavigateToSospesi}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  navLevel === 'scheda_sospesi'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Sospesi</span>
                {totSospesiCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    {totSospesiCount}
                  </span>
                )}
              </button>
            </>
          )}

          {currentCantiere && navLevel === 'scheda_cantiere' && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />

              {/* Level 3 Link */}
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                <span>LIVELLO 3: {currentCantiere.name}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Ripristina Dati di Esempio"
        message={
          <div className="space-y-2">
            <p>
              Vuoi davvero ripristinare i dati di esempio iniziali dello studio (Sirna Massimo, Rossi Impianti, Verdi Edilizia)?
            </p>
            <p className="text-xs text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl">
              Attenzione: tutte le modifiche correnti, nuovi clienti e cantieri creati verranno sovrascritti.
            </p>
          </div>
        }
        confirmText="Ripristina Dati"
        cancelText="Annulla"
        onConfirm={() => {
          resetAllDataToDefaults();
          onResetData();
          setIsResetModalOpen(false);
        }}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </header>
  );
};
