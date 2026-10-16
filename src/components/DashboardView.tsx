import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  FileUp,
  Receipt,
  MapPin,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  Edit,
  Scale,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Cantiere, QuadraturaContabile, SospesoItem } from '../types';
import {
  calculateCantiereTotals,
  computeQuadratura,
  formatCurrency,
} from '../utils/calculations';
import {
  exportSingleCantiereExcel,
  exportProspettoGeneraleExcel,
} from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';

interface DashboardViewProps {
  cantieri: Cantiere[];
  sospesi: SospesoItem[];
  quadratura: QuadraturaContabile;
  onSelectCantiere: (cantiereId: string) => void;
  onEditCantiere: (cantiere: Cantiere) => void;
  onDeleteCantiere: (cantiereId: string) => void;
  onOpenNewCantiere: () => void;
  onOpenXmlImport: () => void;
  onOpenFatturaEmessa: () => void;
  onOpenQuadraturaModal: () => void;
  onNavigateToSospesi: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cantieri,
  sospesi,
  quadratura,
  onSelectCantiere,
  onEditCantiere,
  onDeleteCantiere,
  onOpenNewCantiere,
  onOpenXmlImport,
  onOpenFatturaEmessa,
  onOpenQuadraturaModal,
  onNavigateToSospesi,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cantiereToDelete, setCantiereToDelete] = useState<Cantiere | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Compute Overall KPI statistics
  const globalStats = useMemo(() => {
    let totFatturato = 0;
    let totAcquisti = 0;
    let totRI = 0;
    let totRF = 0;
    let totUtile = 0;
    let cantieriAttivi = 0;

    for (const c of cantieri) {
      const t = calculateCantiereTotals(c);
      totFatturato += t.totaleEmesse;
      totAcquisti += t.totaleAcquisti;
      totRI += t.initialInventory;
      totRF += t.finalInventory;
      totUtile += t.margineEffettivo;
      if (c.status === 'attivo') cantieriAttivi++;
    }

    const totCostiComplessivi = totAcquisti + totRI;
    const denominatoreRicavi = totFatturato + totRF;
    const margineMedio =
      denominatoreRicavi > 0 ? (totUtile / denominatoreRicavi) * 100 : 0;

    return {
      totFatturato,
      totAcquisti,
      totRI,
      totRF,
      totCostiComplessivi,
      totUtile,
      margineMedio: Math.round(margineMedio * 10) / 10,
      cantieriAttivi,
      totali: cantieri.length,
    };
  }, [cantieri]);

  // Quadratura calculation
  const qResult = useMemo(() => {
    return computeQuadratura(cantieri, quadratura);
  }, [cantieri, quadratura]);

  const totSospesiAmount = useMemo(() => {
    return sospesi.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [sospesi]);

  const isQuadraturaBilanciata =
    Math.abs(qResult.deltaAcquisti - totSospesiAmount) < 0.05 &&
    qResult.isVenditeQuadrate;

  // Filtered cantieri
  const filteredCantieri = useMemo(() => {
    return cantieri.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' || c.category === selectedCategory;
      const matchesStatus =
        selectedStatus === 'all' || c.status === selectedStatus;
      const matchesYear =
        selectedYear === 'all' || c.year.toString() === selectedYear;

      return matchesSearch && matchesCat && matchesStatus && matchesYear;
    });
  }, [cantieri, searchTerm, selectedCategory, selectedStatus, selectedYear]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Cantieri */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Cantieri &amp; Clienti
            </span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Building className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {cantieri.length}
            </span>
            <span className="text-xs font-medium text-emerald-400">
              {globalStats.cantieriAttivi} attivi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Anno contabile principale <strong>2026</strong>
          </p>
        </div>

        {/* Card 2: Totale Fatturato (Emesse) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Fatturato Emesso a Clienti
            </span>
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Receipt className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {formatCurrency(globalStats.totFatturato)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Rimanenze Finali R.F.: {formatCurrency(globalStats.totRF)}
          </p>
        </div>

        {/* Card 3: Totale Spese (Acquisti + RI) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Costi Totali (Acquisti + R.I.)
            </span>
            <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {formatCurrency(globalStats.totCostiComplessivi)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Acquisti: {formatCurrency(globalStats.totAcquisti)} • R.I.: {formatCurrency(globalStats.totRI)}
          </p>
        </div>

        {/* Card 4: Utile Netto Globale & Margine */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Utile Netto Complessivo (con RF)
            </span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
              {formatCurrency(globalStats.totUtile)}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {globalStats.margineMedio}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Margine netto effettivo su fatturato</p>
        </div>
      </div>

      {/* Two Special Banners: Quadratura Contabile & Scheda Sospesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banner 1: Quadratura Contabile */}
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Quadratura con Contabilità Generale
                </span>
              </div>
              {isQuadraturaBilanciata ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-3 w-3" /> QUADRATO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="h-3 w-3" /> SBILANCIO DA VERIFICARE
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300">
              Mastro Acquisti Bilancio: <strong className="font-mono text-white">{formatCurrency(quadratura.mastrinoAcquisti)}</strong> • 
              Totale Cantieri: <span className="font-mono text-slate-400">{formatCurrency(globalStats.totAcquisti)}</span>
              {totSospesiAmount > 0 && (
                <span> + Sospesi: <span className="font-mono text-amber-300">{formatCurrency(totSospesiAmount)}</span></span>
              )}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-purple-500/20 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Allineamento Mastro vs Cantieri
            </span>
            <button
              onClick={onOpenQuadraturaModal}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Verifica Quadratura</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Banner 2: Scheda Sospesi */}
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Scheda Sospesi (DDT da Attribuire)
                </span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {sospesi.length} VOCI
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Materiali in attesa di conferma committente: <strong className="font-mono text-amber-400">{formatCurrency(totSospesiAmount)}</strong>.
              Stampa il report per il cliente o sposta con un click le voci ai cantieri corretti.
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Richieste di chiarimento aperte
            </span>
            <button
              onClick={onNavigateToSospesi}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Apri Scheda Sospesi</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar & Search / Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per cliente, cantiere, città o indirizzo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenXmlImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Importa Fattura XML</span>
            </button>

            <button
              onClick={onOpenFatturaEmessa}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Fattura Emessa</span>
            </button>

            <button
              onClick={onOpenNewCantiere}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Nuovo Cantiere</span>
            </button>

            <button
              onClick={() =>
                exportProspettoGeneraleExcel(cantieri, quadratura, sospesi)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-all cursor-pointer"
              title="Esporta il Prospetto Generale Clienti e Cantieri in Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Esporta Prospetto (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Selects & View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Filtra:
            </span>

            {/* Anno */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-amber-400"
            >
              <option value="2026">Anno 2026</option>
              <option value="2025">Anno 2025</option>
              <option value="all">Tutti gli anni</option>
            </select>

            {/* Categoria */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Tutti i settori</option>
              <option value="elettrico">Elettrico</option>
              <option value="idraulico">Idraulico / Termoidraulico</option>
              <option value="edile">Edile / Muratori</option>
              <option value="misto">Misto / Ristrutturazione</option>
            </select>

            {/* Stato */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Tutti gli stati</option>
              <option value="attivo">Attivo</option>
              <option value="completato">Completato</option>
              <option value="preventivo">Preventivo</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Z-Prospetto Clienti
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'cards'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Schede
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Z-PROSPETTO GENERALE CANTIERI Table or Cards */}
      {filteredCantieri.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <AlertCircle className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">
            Nessun cantiere o cliente trovato
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Nessun elemento corrisponde ai filtri impostati. Prova a modificare i criteri o registrare un nuovo cliente.
          </p>
          <button
            onClick={onOpenNewCantiere}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Crea Primo Cantiere</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Official Z-PROSPETTO GENERALE CANTIERI Table */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* Table Header Banner */}
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span>Z-PROSPETTO GENERALE CLIENTI &amp; CANTIERI 2026</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Totale clienti: {filteredCantieri.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b-2 border-slate-800 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">CLIENTE / COMMITTENTE</th>
                  <th className="py-3 px-3">CANTIERE</th>
                  <th className="py-3 px-3">CITTÀ &amp; INDIRIZZO</th>
                  <th className="py-3 px-3 text-right">R.I. (INIZIALI)</th>
                  <th className="py-3 px-3 text-right text-rose-300">ACQUISTI</th>
                  <th className="py-3 px-3 text-right text-blue-300">EMESSE</th>
                  <th className="py-3 px-3 text-right text-emerald-300">R.F. (FINALI)</th>
                  <th className="py-3 px-3 text-right text-amber-300">UTILE NETTO</th>
                  <th className="py-3 px-2.5 text-center">MARGINE %</th>
                  <th className="py-3 px-3 text-right">AZIONI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredCantieri.map((c) => {
                  const totals = calculateCantiereTotals(c);
                  const isPositive = totals.isPositive;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => onSelectCantiere(c.id)}
                    >
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                          {c.client}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-300">
                            {c.category}
                          </span>
                          <span>• Anno {c.year}</span>
                        </div>
                      </td>

                      {/* Nome Cantiere */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-100 line-clamp-1">{c.name}</div>
                        {c.notes && <div className="text-[11px] text-slate-400 line-clamp-1">{c.notes}</div>}
                      </td>

                      {/* Città & Indirizzo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-300">
                          <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="font-medium">{c.city}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.address ? c.address : '-'}
                        </div>
                      </td>

                      {/* Rimanenze Iniziali (RI) */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {formatCurrency(c.initialInventory)}
                      </td>

                      {/* Acquisti */}
                      <td className="py-3.5 px-3 text-right font-mono text-rose-300 font-medium whitespace-nowrap">
                        {formatCurrency(totals.totaleAcquisti)}
                      </td>

                      {/* Emesse */}
                      <td className="py-3.5 px-3 text-right font-mono text-blue-300 font-bold whitespace-nowrap">
                        {formatCurrency(totals.totaleEmesse)}
                      </td>

                      {/* Rimanenze Finali (RF) */}
                      <td className="py-3.5 px-3 text-right font-mono text-emerald-300 font-medium whitespace-nowrap">
                        {formatCurrency(c.finalInventory)}
                      </td>

                      {/* Utile Netto Effettivo */}
                      <td className="py-3.5 px-3 text-right font-mono font-extrabold whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(totals.margineEffettivo)}
                        </span>
                      </td>

                      {/* Margine % */}
                      <td className="py-3.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                            totals.marginePercentuale >= 25
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : totals.marginePercentuale >= 10
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {totals.marginePercentuale}%
                        </span>
                      </td>

                      {/* Azioni */}
                      <td
                        className="py-3.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectCantiere(c.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Apri Scheda Dettaglio Cantiere"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => exportSingleCantiereExcel(c)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Esporta Scheda Cantiere in Excel"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => onEditCantiere(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Modifica dati cliente e cantiere"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setCantiereToDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Elimina cantiere"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totali Generali Footer */}
              <tfoot>
                <tr className="bg-slate-950 font-bold border-t-2 border-slate-700 text-slate-200">
                  <td colSpan={3} className="py-3 px-4 uppercase text-xs">
                    TOTALE GENERALE PROSPETTO ({filteredCantieri.length} cantieri)
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatCurrency(globalStats.totRI)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-300">
                    {formatCurrency(globalStats.totAcquisti)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-blue-300">
                    {formatCurrency(globalStats.totFatturato)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-300">
                    {formatCurrency(globalStats.totRF)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                    {formatCurrency(globalStats.totUtile)}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono text-emerald-400">
                    {globalStats.margineMedio}%
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCantieri.map((c) => {
            const totals = calculateCantiereTotals(c);
            const isPositive = totals.isPositive;

            return (
              <div
                key={c.id}
                onClick={() => onSelectCantiere(c.id)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-amber-400/50 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] uppercase font-bold bg-slate-800 text-amber-400 border border-slate-700">
                      {c.category}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        c.status === 'attivo'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {c.client}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium line-clamp-1">
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4 line-clamp-1">
                    {c.city} {c.address ? `• ${c.address}` : ''} ({c.year})
                  </p>

                  {/* Financial Mini Table */}
                  <div className="bg-slate-950/60 rounded-lg p-3 space-y-2 text-xs border border-slate-800/80">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Rimanenze Iniziali (R.I.):</span>
                      <span className="font-mono text-slate-300">
                        {formatCurrency(c.initialInventory)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Acquisti Materiali:</span>
                      <span className="font-mono text-rose-300 font-semibold">
                        {formatCurrency(totals.totaleAcquisti)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Fatturato Emesso:</span>
                      <span className="font-mono text-blue-300 font-bold">
                        {formatCurrency(totals.totaleEmesse)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Rimanenze Finali (R.F.):</span>
                      <span className="font-mono text-emerald-300 font-medium">
                        {formatCurrency(c.finalInventory)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="font-semibold text-slate-200">Utile Netto Effettivo:</span>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatCurrency(totals.margineEffettivo)}
                        </span>
                        <span className="text-[10px] ml-1.5 text-slate-400">
                          ({totals.marginePercentuale}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>{c.movements.length} movimenti registrati</span>
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => exportSingleCantiereExcel(c)}
                      className="p-1 hover:text-emerald-400"
                      title="Esporta Excel"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEditCantiere(c)}
                      className="p-1 hover:text-blue-400"
                      title="Modifica"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSelectCantiere(c.id)}
                      className="p-1 hover:text-amber-400"
                      title="Apri scheda"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCantiereToDelete(c)}
                      className="p-1 hover:text-rose-400"
                      title="Elimina cantiere"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cantiereToDelete}
        title="Elimina Cantiere"
        message={
          cantiereToDelete ? (
            <div className="space-y-2">
              <p>
                Eliminare definitivamente il cantiere{' '}
                <strong className="text-white font-bold">"{cantiereToDelete.name}"</strong>?
              </p>
              <p className="text-xs text-slate-400">
                Committente: {cantiereToDelete.client} • Città: {cantiereToDelete.city}
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmText="Elimina Cantiere"
        cancelText="Annulla"
        onConfirm={() => {
          if (cantiereToDelete) {
            onDeleteCantiere(cantiereToDelete.id);
            setCantiereToDelete(null);
          }
        }}
        onCancel={() => setCantiereToDelete(null)}
      />
    </div>
  );
};
