import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Building,
  PlusCircle,
  FileSpreadsheet,
  Printer,
  FileUp,
  Receipt,
  Clock,
  Search,
  Edit,
  Trash2,
  Save,
  RotateCcw,
  HelpCircle,
  Plus,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Scale,
} from 'lucide-react';
import { Artigiano, Cantiere, QuadraturaContabile, MastrinoItem } from '../types';
import {
  calculateCantiereTotals,
  computeCantiereRF,
  formatCurrency,
} from '../utils/calculations';
import {
  exportProspettoGeneraleExcel,
  exportSingleCantiereExcel,
} from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';

interface ProspettoGeneraleViewProps {
  artigiano: Artigiano;
  onBackToHome: () => void;
  onSelectCantiere: (cantiereId: string) => void;
  onOpenNewCantiere: () => void;
  onEditCantiere: (cantiere: Cantiere) => void;
  onDeleteCantiere: (cantiereId: string) => void;
  onOpenXmlImport: () => void;
  onOpenFatturaEmessa: () => void;
  onNavigateToSospesi: () => void;
  onUpdateQuadratura: (updated: QuadraturaContabile) => void;
  onPrintProspetto: () => void;
  onUpdateCantiere?: (cantiere: Cantiere) => void;
  onEditArtigiano?: (artigiano: Artigiano) => void;
  onDeleteArtigiano?: (artigianoId: string) => void;
}

export const ProspettoGeneraleView: React.FC<ProspettoGeneraleViewProps> = ({
  artigiano,
  onBackToHome,
  onSelectCantiere,
  onOpenNewCantiere,
  onEditCantiere,
  onDeleteCantiere,
  onOpenXmlImport,
  onOpenFatturaEmessa,
  onNavigateToSospesi,
  onUpdateQuadratura,
  onPrintProspetto,
  onUpdateCantiere,
  onEditArtigiano,
  onDeleteArtigiano,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'city' | 'address' | 'ri' | 'acquisti' | 'emesse' | 'rf' | 'marginePercentuale'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [cantiereToDelete, setCantiereToDelete] = useState<Cantiere | null>(null);
  const [isConfirmDeleteArtigianoOpen, setIsConfirmDeleteArtigianoOpen] = useState(false);
  const [isQuadraturaSaved, setIsQuadraturaSaved] = useState(false);

  // Quick inline name editing state
  const [editingNameCantiereId, setEditingNameCantiereId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');

  const handleStartEditName = (c: Cantiere) => {
    setEditingNameCantiereId(c.id);
    setTempName(c.name.toUpperCase());
  };

  const handleSaveQuickName = (c: Cantiere) => {
    if (onUpdateCantiere) {
      const upperName = (tempName.trim() || c.name).toUpperCase();
      onUpdateCantiere({
        ...c,
        name: upperName,
        client: upperName, // Nome cantiere e committente coincidono sempre
        city: c.city.toUpperCase(),
        address: c.address ? c.address.toUpperCase() : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingNameCantiereId(null);
  };

  // Quick inline address editing state
  const [editingAddressCantiereId, setEditingAddressCantiereId] = useState<string | null>(null);
  const [tempAddress, setTempAddress] = useState<string>('');

  const handleStartEditAddress = (c: Cantiere) => {
    setEditingAddressCantiereId(c.id);
    setTempAddress(c.address || '');
  };

  const handleSaveQuickAddress = (c: Cantiere) => {
    if (onUpdateCantiere) {
      onUpdateCantiere({
        ...c,
        name: c.name.toUpperCase(),
        client: c.name.toUpperCase(),
        city: c.city.toUpperCase(),
        address: tempAddress.trim() ? tempAddress.trim().toUpperCase() : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingAddressCantiereId(null);
  };

  // Default standard accounts if none exist
  const defaultAcquistiMastri: MastrinoItem[] = [
    { id: 'm-acq-1', code: 'C/430000', description: 'ACQUISTI MERCI', amount: 0 },
    { id: 'm-acq-2', code: 'C/441120', description: 'LAVORAZIONI DI TERZI', amount: 0 },
    { id: 'm-acq-3', code: 'C/450200', description: 'LOCAZIONI PASSIVE ALTRI BENI', amount: 0 },
  ];

  const defaultVenditeMastri: MastrinoItem[] = [
    { id: 'm-ven-1', code: 'C/310000', description: 'VENDITA MERCI', amount: 0 },
    { id: 'm-ven-2', code: 'C/310740', description: 'RICAVI PER SERVIZI', amount: 0 },
    { id: 'm-ven-3', code: 'C/310750', description: 'ALTRI RICAVI', amount: 0 },
  ];

  // Editable Mastrini Lists (In quadratura mastrini si possono inserire, modificare e cancellare descrizioni e importi)
  const [mastriniAcquistiList, setMastriniAcquistiList] = useState<MastrinoItem[]>(() => {
    if (artigiano.quadratura?.mastriniAcquistiDetails && artigiano.quadratura.mastriniAcquistiDetails.length > 0) {
      return artigiano.quadratura.mastriniAcquistiDetails;
    }
    const legacy = Number(artigiano.quadratura?.mastrinoAcquisti) || 0;
    return defaultAcquistiMastri.map((d, idx) => ({
      ...d,
      amount: idx === 0 && legacy > 0 ? legacy : 0,
    }));
  });

  const [mastriniVenditeList, setMastriniVenditeList] = useState<MastrinoItem[]>(() => {
    if (artigiano.quadratura?.mastriniVenditeDetails && artigiano.quadratura.mastriniVenditeDetails.length > 0) {
      return artigiano.quadratura.mastriniVenditeDetails;
    }
    const legacy = Number(artigiano.quadratura?.mastrinoVendite) || 0;
    return defaultVenditeMastri.map((d, idx) => ({
      ...d,
      amount: idx === 0 && legacy > 0 ? legacy : 0,
    }));
  });

  const [quadraturaNotes, setQuadraturaNotes] = useState<string>(
    artigiano.quadratura?.notes || ''
  );

  // Sospesi Totals
  const totSospesiCount = artigiano.sospesi ? artigiano.sospesi.length : 0;
  const totSospesiImporto = useMemo(() => {
    return (artigiano.sospesi || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [artigiano.sospesi]);

  // Computed cantieri row data
  const cantieriRows = useMemo(() => {
    return (artigiano.cantieri || []).map((c) => {
      const t = calculateCantiereTotals(c);
      const ri = Number(c.initialInventory) || 0;
      const acquisti = t.totaleAcquisti;
      const emesse = t.totaleEmesse;
      // REGOLA SPECIFICA:
      // RF (rimanenze finali) = ri + acquisti - emesse,
      // valorizzato SOLO se le emesse sono minori della somma delle rimanenze iniziali e degli acquisti.
      const rf = computeCantiereRF(ri, acquisti, emesse);

      return {
        cantiere: c,
        name: (c.name || 'CANTIERE').toUpperCase(),
        city: (c.city || '-').toUpperCase(),
        address: c.address ? c.address.toUpperCase() : '-',
        ri,
        acquisti,
        emesse,
        rf,
        finalInventory: t.finalInventory,
        margineEffettivo: t.margineEffettivo,
        marginePercentuale: t.marginePercentuale,
        isPositive: t.isPositive,
      };
    });
  }, [artigiano.cantieri]);

  // Filter & Sort
  const filteredAndSortedCantieri = useMemo(() => {
    let list = cantieriRows.filter((r) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [cantieriRows, searchTerm, sortField, sortDirection]);

  // Totali cantieri
  const cantieriTotals = useMemo(() => {
    let sumRI = 0;
    let sumAcquisti = 0;
    let sumEmesse = 0;
    let sumRF = 0;
    let sumUtile = 0;

    for (const r of cantieriRows) {
      sumRI += r.ri;
      sumAcquisti += r.acquisti;
      sumEmesse += r.emesse;
      sumRF += r.rf;
      sumUtile += r.margineEffettivo;
    }

    sumRI = Math.round(sumRI * 100) / 100;
    sumAcquisti = Math.round(sumAcquisti * 100) / 100;
    sumEmesse = Math.round(sumEmesse * 100) / 100;
    sumRF = Math.round(sumRF * 100) / 100;
    sumUtile = Math.round(sumUtile * 100) / 100;

    // Percentuale di margine complessiva calcolata su tutti i cantieri (ESCLUDENDO i sospesi come richiesto)
    const ricaviDenom = sumEmesse + (sumRF > 0 ? sumRF : 0);
    const totalMarginePercentuale =
      ricaviDenom > 0 ? Math.round((sumUtile / ricaviDenom) * 1000) / 10 : 0;

    return {
      sumRI,
      sumAcquisti,
      sumEmesse,
      sumRF,
      sumUtile,
      totalMarginePercentuale,
      count: cantieriRows.length,
    };
  }, [cantieriRows]);

  // Grand Totals: Cantieri + Sospesi
  const totalAcquistiConSospesi = useMemo(() => {
    return Math.round((cantieriTotals.sumAcquisti + totSospesiImporto) * 100) / 100;
  }, [cantieriTotals.sumAcquisti, totSospesiImporto]);

  // Quadratura Mastrini Sums
  const totMastriniAcquisti = useMemo(() => {
    return Math.round(
      mastriniAcquistiList.reduce((acc, m) => acc + (Number(m.amount) || 0), 0) * 100
    ) / 100;
  }, [mastriniAcquistiList]);

  const totMastriniVendite = useMemo(() => {
    return Math.round(
      mastriniVenditeList.reduce((acc, m) => acc + (Number(m.amount) || 0), 0) * 100
    ) / 100;
  }, [mastriniVenditeList]);

  // Sbilanci
  const sbilancioAcquisti = useMemo(() => {
    return Math.round((totMastriniAcquisti - totalAcquistiConSospesi) * 100) / 100;
  }, [totMastriniAcquisti, totalAcquistiConSospesi]);

  const sbilancioRicavi = useMemo(() => {
    return Math.round((totMastriniVendite - cantieriTotals.sumEmesse) * 100) / 100;
  }, [totMastriniVendite, cantieriTotals.sumEmesse]);

  const isAcquistiQuadrati = Math.abs(sbilancioAcquisti) < 0.05;
  const isVenditeQuadrate = Math.abs(sbilancioRicavi) < 0.05;
  const isComplessivoQuadrato = isAcquistiQuadrati && isVenditeQuadrate;

  // Sorting Handler
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Mastrini Acquisti Handlers: Add, Edit, Delete
  const handleAddMastrinoAcquisti = () => {
    const newItem: MastrinoItem = {
      id: `m-acq-${Date.now()}`,
      code: `C/${430000 + mastriniAcquistiList.length * 100}`,
      description: 'NUOVO CONTO ACQUISTI',
      amount: 0,
    };
    setMastriniAcquistiList((prev) => [...prev, newItem]);
  };

  const handleUpdateMastrinoAcquisti = (id: string, field: 'description' | 'amount' | 'code', val: any) => {
    setMastriniAcquistiList((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (field === 'amount') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 0;
          return { ...m, amount: num };
        }
        return { ...m, [field]: val };
      })
    );
  };

  const handleDeleteMastrinoAcquisti = (id: string) => {
    setMastriniAcquistiList((prev) => prev.filter((m) => m.id !== id));
  };

  // Mastrini Vendite Handlers: Add, Edit, Delete
  const handleAddMastrinoVendite = () => {
    const newItem: MastrinoItem = {
      id: `m-ven-${Date.now()}`,
      code: `C/${310000 + mastriniVenditeList.length * 100}`,
      description: 'NUOVO CONTO RICAVI',
      amount: 0,
    };
    setMastriniVenditeList((prev) => [...prev, newItem]);
  };

  const handleUpdateMastrinoVendite = (id: string, field: 'description' | 'amount' | 'code', val: any) => {
    setMastriniVenditeList((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (field === 'amount') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 0;
          return { ...m, amount: num };
        }
        return { ...m, [field]: val };
      })
    );
  };

  const handleDeleteMastrinoVendite = (id: string) => {
    setMastriniVenditeList((prev) => prev.filter((m) => m.id !== id));
  };

  // Auto align button
  const handleAutoAlignQuadratura = () => {
    if (mastriniAcquistiList.length === 0) {
      setMastriniAcquistiList([
        { id: `m-acq-${Date.now()}`, code: 'C/430000', description: 'ACQUISTI MERCI', amount: totalAcquistiConSospesi },
      ]);
    } else {
      setMastriniAcquistiList((prev) =>
        prev.map((m, idx) => (idx === 0 ? { ...m, amount: totalAcquistiConSospesi } : { ...m, amount: 0 }))
      );
    }

    if (mastriniVenditeList.length === 0) {
      setMastriniVenditeList([
        { id: `m-ven-${Date.now()}`, code: 'C/310000', description: 'VENDITA MERCI', amount: cantieriTotals.sumEmesse },
      ]);
    } else {
      setMastriniVenditeList((prev) =>
        prev.map((m, idx) => (idx === 0 ? { ...m, amount: cantieriTotals.sumEmesse } : { ...m, amount: 0 }))
      );
    }
  };

  const handleSaveQuadratura = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedQ: QuadraturaContabile = {
      mastrinoAcquisti: totMastriniAcquisti,
      mastrinoVendite: totMastriniVendite,
      mastriniAcquistiDetails: mastriniAcquistiList,
      mastriniVenditeDetails: mastriniVenditeList,
      dataVerifica: new Date().toISOString().split('T')[0],
      notes: quadraturaNotes || 'Allineato secondo mastrini contabili',
    };
    onUpdateQuadratura(updatedQ);
    setIsQuadraturaSaved(true);
    setTimeout(() => setIsQuadraturaSaved(false), 2500);
  };

  return (
    <div className="space-y-6 pb-20 text-slate-100 font-sans">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>← Torna a HOME CANTIERI</span>
        </button>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span>PROSPETTO CANTIERI</span>
          <span>/</span>
          <strong className="text-white">{artigiano.name}</strong>
        </div>
      </div>

      {/* Artisan Prospetto Header Banner */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Artisan Title & Details */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PROSPETTO GENERALE CANTIERI
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {artigiano.name}
              </h1>

              {/* Quick Edit & Delete for this client */}
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-lg p-0.5">
                {onEditArtigiano && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditArtigiano(artigiano);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
                    title={`Modifica anagrafica ${artigiano.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                {onDeleteArtigiano && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsConfirmDeleteArtigianoOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                    title={`Elimina cliente ${artigiano.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Direct access to Scheda Sospesi */}
            <button
              onClick={onNavigateToSospesi}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer ${
                totSospesiCount > 0
                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/40 hover:bg-amber-900/60 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Apri Scheda Sospesi (DDT e righe in attesa di attribuzione)"
            >
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Scheda Sospesi</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950">
                {totSospesiCount}
              </span>
            </button>

            {/* XML Import */}
            <button
              onClick={onOpenXmlImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md cursor-pointer"
            >
              <FileUp className="h-4 w-4" />
              <span>Importa XML</span>
            </button>

            {/* Fattura Emessa */}
            <button
              onClick={onOpenFatturaEmessa}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
            >
              <Receipt className="h-4 w-4" />
              <span>Fattura Emessa</span>
            </button>

            {/* Nuovo Cantiere */}
            <button
              onClick={onOpenNewCantiere}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-slate-950" />
              <span>+ Nuovo Cantiere</span>
            </button>

            {/* Excel Export Prospetto + Cantieri */}
            <button
              onClick={() => exportProspettoGeneraleExcel(artigiano)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm cursor-pointer"
              title="Esporta foglio Excel (.xlsx) con tabella formattata, totali e quadratura"
            >
              <FileSpreadsheet className="h-4 w-4 text-white" />
              <span>Esporta Prospetto Excel</span>
            </button>

            {/* Print Report */}
            <button
              onClick={onPrintProspetto}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Stampa Report A4"
            >
              <Printer className="h-4 w-4 text-slate-300" />
              <span>Stampa</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABELLA PROSPETTO CANTIERI (Stile coerente con il gestionale) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4 text-amber-400" />
              <span>ELENCO CANTIERI</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {filteredAndSortedCantieri.length} cantieri
            </span>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca cliente, cantiere, città o via..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Tabella con le colonne richieste */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b-2 border-slate-800 uppercase tracking-wider text-[11px] font-bold select-none">
                {/* NOME CLIENTE */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>NOME CANTIERE</span>
                    {sortField === 'name' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* CITTA' */}
                <th
                  onClick={() => handleSort('city')}
                  className="py-3.5 px-3 w-32 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CITTA'</span>
                    {sortField === 'city' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* INDIRIZZO */}
                <th
                  onClick={() => handleSort('address')}
                  className="py-3.5 px-3.5 w-60 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>INDIRIZZO</span>
                    {sortField === 'address' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* R.I. */}
                <th
                  onClick={() => handleSort('ri')}
                  className="py-3.5 px-3 text-right w-28 cursor-pointer hover:text-white transition-colors text-slate-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>R.I.</span>
                    {sortField === 'ri' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* ACQUISTI */}
                <th
                  onClick={() => handleSort('acquisti')}
                  className="py-3.5 px-3.5 text-right w-32 cursor-pointer hover:text-white transition-colors text-rose-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>ACQUISTI</span>
                    {sortField === 'acquisti' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* EMESSE */}
                <th
                  onClick={() => handleSort('emesse')}
                  className="py-3.5 px-3.5 text-right w-32 cursor-pointer hover:text-white transition-colors text-blue-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>EMESSE</span>
                    {sortField === 'emesse' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* R.F. */}
                <th
                  onClick={() => handleSort('rf')}
                  className="py-3.5 px-3.5 text-right w-32 cursor-pointer hover:text-white transition-colors text-emerald-400"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>R.F.</span>
                    {sortField === 'rf' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* % MARGINE / UTILE */}
                <th
                  onClick={() => handleSort('marginePercentuale')}
                  className="py-3.5 px-3.5 text-right w-28 cursor-pointer hover:text-white transition-colors text-amber-400"
                  title="Percentuale di margine / utile sul lavoro del cantiere"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>% UTILE</span>
                    {sortField === 'marginePercentuale' && (
                      <span className="text-amber-400 font-mono text-[10px]">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* AZIONI */}
                <th className="py-3.5 px-3 text-right w-24">AZIONI</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredAndSortedCantieri.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Building className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Nessun cantiere trovato</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inserisci un nuovo cantiere o importa le fatture elettroniche XML.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedCantieri.map((row) => {
                  const c = row.cantiere;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCantiere(c.id)}
                      className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    >
                      {/* NOME CANTIERE (MODIFICABILE - SEMPRE IN MAIUSCOLO) */}
                      <td
                        className="py-3.5 px-4 font-bold text-white group-hover:text-amber-300 transition-colors uppercase"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingNameCantiereId === c.id ? (
                          <div className="flex items-center gap-1.5 min-w-[220px]">
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value.toUpperCase())}
                              placeholder="es. ROSSI MARIO"
                              className="w-full bg-slate-950 border border-amber-400 rounded px-2 py-1 text-white text-xs font-bold uppercase focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveQuickName(c);
                                } else if (e.key === 'Escape') {
                                  setEditingNameCantiereId(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveQuickName(c)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer shrink-0"
                              title="Salva nome cantiere"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingNameCantiereId(null)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                              title="Annulla"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1 group/name">
                            <span
                              onClick={() => onSelectCantiere(c.id)}
                              className="cursor-pointer hover:underline"
                            >
                              {row.name.toUpperCase()}
                            </span>
                            <button
                              onClick={() => handleStartEditName(c)}
                              className="opacity-0 group-hover/name:opacity-100 p-1 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-opacity cursor-pointer shrink-0"
                              title="Modifica nome cantiere"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* CITTA' (SEMPRE IN MAIUSCOLO) */}
                      <td className="py-3.5 px-3 text-slate-300 uppercase font-medium">
                        {row.city.toUpperCase()}
                      </td>

                      {/* INDIRIZZO (MODIFICABILE - SEMPRE IN MAIUSCOLO) */}
                      <td
                        className="py-3.5 px-3.5 text-slate-400 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingAddressCantiereId === c.id ? (
                          <div className="flex items-center gap-1.5 min-w-[200px]">
                            <input
                              type="text"
                              value={tempAddress}
                              onChange={(e) => setTempAddress(e.target.value.toUpperCase())}
                              placeholder="es. VIA GARIBALDI 42"
                              className="w-full bg-slate-950 border border-amber-400 rounded px-2 py-1 text-white text-xs font-bold uppercase focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveQuickAddress(c);
                                } else if (e.key === 'Escape') {
                                  setEditingAddressCantiereId(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveQuickAddress(c)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer shrink-0"
                              title="Salva indirizzo"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingAddressCantiereId(null)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                              title="Annulla"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1 group/addr uppercase font-medium">
                            <span className={row.address && row.address !== '-' ? 'text-slate-300' : 'text-slate-500 italic normal-case'}>
                              {row.address && row.address !== '-' ? row.address.toUpperCase() : 'Aggiungi indirizzo'}
                            </span>
                            <button
                              onClick={() => handleStartEditAddress(c)}
                              className="opacity-0 group-hover/addr:opacity-100 p-1 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-opacity cursor-pointer shrink-0"
                              title="Modifica indirizzo cantiere"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* R.I. */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {row.ri > 0 ? formatCurrency(row.ri) : '-'}
                      </td>

                      {/* ACQUISTI */}
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-rose-300 whitespace-nowrap">
                        {row.acquisti > 0 ? formatCurrency(row.acquisti) : '-'}
                      </td>

                      {/* EMESSE */}
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-blue-300 whitespace-nowrap">
                        {row.emesse > 0 ? formatCurrency(row.emesse) : '-'}
                      </td>

                      {/* R.F. (Calcolato con formula: RI + ACQUISTI - EMESSE se emesse < RI + ACQUISTI) */}
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {row.rf > 0 ? formatCurrency(row.rf) : '-'}
                      </td>

                      {/* % MARGINE / UTILE CANTIERE */}
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black font-mono ${
                            row.marginePercentuale >= 25
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : row.marginePercentuale >= 10
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : row.marginePercentuale > 0
                              ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20'
                              : row.marginePercentuale === 0
                              ? 'text-slate-400 bg-slate-800/40 border border-slate-700/40'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                          title={`Utile netto: ${row.margineEffettivo >= 0 ? '+' : ''}${formatCurrency(row.margineEffettivo)}`}
                        >
                          {row.marginePercentuale > 0 ? `+${row.marginePercentuale}%` : `${row.marginePercentuale}%`}
                        </span>
                      </td>

                      {/* AZIONI */}
                      <td
                        className="py-3.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditCantiere(c)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Modifica cantiere"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => exportSingleCantiereExcel(c, artigiano.name)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Scarica file XLS formattato di questo cantiere"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setCantiereToDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title={`Elimina cantiere ${c.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* RIGA SCHEDA SOSPESI (DDT DA ATTRIBUIRE) */}
              <tr className="bg-amber-500/5 border-t border-slate-800 font-semibold text-xs text-amber-300">
                <td className="py-3 px-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">
                    SCHEDA SOSPESI (DDT e forniture da chiarire)
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-400">
                  {totSospesiCount} voci
                </td>
                <td className="py-3 px-3.5 text-slate-400">
                  <button
                    type="button"
                    onClick={onNavigateToSospesi}
                    className="text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Gestisci e attribuisci</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-400">-</td>
                {/* Costi sospesi inclusi nel totale acquisti */}
                <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                  {totSospesiImporto > 0 ? formatCurrency(totSospesiImporto) : '-'}
                </td>
                <td className="py-3 px-3.5 text-right font-mono text-slate-400">-</td>
                <td className="py-3 px-3.5 text-right font-mono text-slate-400">-</td>
                <td className="py-3 px-3.5 text-right font-mono text-slate-500 font-bold">-</td>
                <td className="py-3 px-3"></td>
              </tr>
            </tbody>

            {/* RIGA TOTALI A FONDO TABELLA */}
            <tfoot>
              <tr className="bg-slate-950 border-t-2 border-slate-700 font-bold text-white text-xs">
                <td className="py-4 px-4 uppercase tracking-wider text-amber-400">
                  TOTALI GENERALI
                </td>
                <td className="py-4 px-3 text-slate-400 font-normal">
                  {cantieriTotals.count} cantieri
                </td>
                <td className="py-4 px-3.5 text-slate-400 font-normal">
                  {totSospesiCount > 0 ? `+ ${totSospesiCount} sospesi` : '-'}
                </td>

                {/* Totale R.I. */}
                <td className="py-4 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                  {cantieriTotals.sumRI > 0 ? formatCurrency(cantieriTotals.sumRI) : '-'}
                </td>

                {/* Totale ACQUISTI (Cantieri + Sospesi) */}
                <td className="py-4 px-3.5 text-right font-mono font-black text-rose-300 text-sm whitespace-nowrap">
                  {formatCurrency(totalAcquistiConSospesi)}
                </td>

                {/* Totale EMESSE */}
                <td className="py-4 px-3.5 text-right font-mono font-black text-blue-300 text-sm whitespace-nowrap">
                  {formatCurrency(cantieriTotals.sumEmesse)}
                </td>

                {/* Totale R.F. */}
                <td className="py-4 px-3.5 text-right font-mono font-black text-emerald-400 text-sm whitespace-nowrap">
                  {formatCurrency(cantieriTotals.sumRF)}
                </td>

                {/* Totale % MARGINE / UTILE CANTIERI (ESCLUSI SOSPESI) */}
                <td className="py-4 px-3.5 text-right font-mono font-black text-sm whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black font-mono shadow-sm ${
                      cantieriTotals.totalMarginePercentuale >= 25
                        ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                        : cantieriTotals.totalMarginePercentuale >= 10
                        ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30'
                        : cantieriTotals.totalMarginePercentuale > 0
                        ? 'text-blue-300 bg-blue-500/20 border border-blue-500/30'
                        : cantieriTotals.totalMarginePercentuale === 0
                        ? 'text-slate-300 bg-slate-800 border border-slate-700'
                        : 'text-rose-300 bg-rose-500/20 border border-rose-500/30'
                    }`}
                    title={`Margine complessivo totale cantieri: ${cantieriTotals.sumUtile >= 0 ? '+' : ''}${formatCurrency(cantieriTotals.sumUtile)} (Sospesi esclusi)`}
                  >
                    {cantieriTotals.totalMarginePercentuale > 0
                      ? `+${cantieriTotals.totalMarginePercentuale}%`
                      : `${cantieriTotals.totalMarginePercentuale}%`}
                  </span>
                </td>

                <td className="py-4 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Table footer helper note */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Clicca su qualunque riga per accedere alla <strong>Scheda Dettaglio Cantiere</strong>. La colonna <strong>% UTILE</strong> indica la redditività calcolata su ciascun cantiere, e a fondo tabella la percentuale complessiva di tutti i cantieri (esclusi sospesi).
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SEZIONE QUADRATURA MASTRINI (Piena gestione Mastrini: Inserisci, Modifica, Cancella) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 space-y-5">
        {/* Header Sezione Quadratura */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 shrink-0">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                  QUADRATURA CONTABILE MASTRINI
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isComplessivoQuadrato
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isComplessivoQuadrato ? 'CONTI QUADRATI' : 'SBILANCIO DA VERIFICARE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inserisci, modifica o cancella liberamente i mastrini di costo e ricavo dalla contabilità generale per la riconciliazione con i cantieri e i sospesi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAutoAlignQuadratura}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-lg text-xs font-semibold border border-purple-500/30 transition-colors cursor-pointer"
              title="Allinea automaticamente i mastrini ai totali cantieri + sospesi"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Allinea a Cantieri</span>
            </button>

            <button
              type="button"
              onClick={handleSaveQuadratura}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isQuadraturaSaved ? 'Salvato!' : 'Salva Mastrini'}</span>
            </button>
          </div>
        </div>

        {/* Due Tabelle: Mastri Acquisti (Costi) e Mastri Vendite (Ricavi) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TABELLA 1: LATO ACQUISTI (COSTI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between">
            <div>
              {/* Header Tabella Acquisti */}
              <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      TABELLA MASTRINI ACQUISTI (COSTI)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Acquisti merci, lavorazioni terzi, locazioni passive, spese di cantiere
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddMastrinoAcquisti}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="Aggiungi nuovo mastrino acquisti"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Inserisci Mastrino</span>
                </button>
              </div>

              {/* Tabella Reale Acquisti */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/70">
                      <th className="py-2.5 px-3 w-28">CONTO / COD.</th>
                      <th className="py-2.5 px-3">DESCRIZIONE CONTO / MASTRO</th>
                      <th className="py-2.5 px-3 text-right w-36 text-rose-300">IMPORTO (€)</th>
                      <th className="py-2.5 px-2 text-center w-12">AZIONI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                    {mastriniAcquistiList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                          Nessun mastrino d'acquisto inserito. Clicca su "+ Inserisci Mastrino".
                        </td>
                      </tr>
                    ) : (
                      mastriniAcquistiList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                          {/* Codice conto */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.code || ''}
                              onChange={(e) => handleUpdateMastrinoAcquisti(item.id, 'code', e.target.value.toUpperCase())}
                              placeholder="es. C/430000"
                              className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-amber-300 font-mono font-semibold focus:outline-none focus:border-rose-400 uppercase"
                            />
                          </td>

                          {/* Descrizione modificabile */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateMastrinoAcquisti(item.id, 'description', e.target.value.toUpperCase())}
                              placeholder="DESCRIZIONE (ES. ACQUISTI MERCI)"
                              className="w-full bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs text-white uppercase font-bold focus:outline-none focus:border-rose-400"
                            />
                          </td>

                          {/* Importo modificabile */}
                          <td className="py-2 px-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono font-bold">
                                €
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.amount || ''}
                                onChange={(e) => handleUpdateMastrinoAcquisti(item.id, 'amount', e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-slate-950 border border-slate-700/80 rounded pl-6 pr-2 py-1 text-xs text-right font-mono font-black text-rose-300 focus:outline-none focus:border-rose-400"
                              />
                            </div>
                          </td>

                          {/* Azione elimina */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteMastrinoAcquisti(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Elimina mastrino"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-950 text-xs font-black">
                      <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-slate-300">
                        TOTALE MASTRINI ACQUISTI:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm font-black text-rose-300">
                        {formatCurrency(totMastriniAcquisti)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick add row button at bottom */}
            <div className="p-2 bg-slate-950 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAddMastrinoAcquisti}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-dashed border-rose-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Aggiungi riga Mastrino Costi (Acquisti Merci, Noleggi, ecc.)</span>
              </button>
            </div>
          </div>

          {/* TABELLA 2: LATO VENDITE (RICAVI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between">
            <div>
              {/* Header Tabella Vendite */}
              <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      TABELLA MASTRINI VENDITE (RICAVI)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Fatturato vendite, ricavi prestazioni, altri ricavi operativi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddMastrinoVendite}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="Aggiungi nuovo mastrino vendite"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Inserisci Mastrino</span>
                </button>
              </div>

              {/* Tabella Reale Vendite */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/70">
                      <th className="py-2.5 px-3 w-28">CONTO / COD.</th>
                      <th className="py-2.5 px-3">DESCRIZIONE CONTO / MASTRO</th>
                      <th className="py-2.5 px-3 text-right w-36 text-blue-300">IMPORTO (€)</th>
                      <th className="py-2.5 px-2 text-center w-12">AZIONI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                    {mastriniVenditeList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                          Nessun mastrino di ricavo inserito. Clicca su "+ Inserisci Mastrino".
                        </td>
                      </tr>
                    ) : (
                      mastriniVenditeList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                          {/* Codice conto */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.code || ''}
                              onChange={(e) => handleUpdateMastrinoVendite(item.id, 'code', e.target.value.toUpperCase())}
                              placeholder="es. C/310000"
                              className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-amber-300 font-mono font-semibold focus:outline-none focus:border-blue-400 uppercase"
                            />
                          </td>

                          {/* Descrizione modificabile */}
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateMastrinoVendite(item.id, 'description', e.target.value.toUpperCase())}
                              placeholder="DESCRIZIONE (ES. VENDITA MERCI)"
                              className="w-full bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs text-white uppercase font-bold focus:outline-none focus:border-blue-400"
                            />
                          </td>

                          {/* Importo modificabile */}
                          <td className="py-2 px-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono font-bold">
                                €
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.amount || ''}
                                onChange={(e) => handleUpdateMastrinoVendite(item.id, 'amount', e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-slate-950 border border-slate-700/80 rounded pl-6 pr-2 py-1 text-xs text-right font-mono font-black text-blue-300 focus:outline-none focus:border-blue-400"
                              />
                            </div>
                          </td>

                          {/* Azione elimina */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteMastrinoVendite(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Elimina mastrino"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-950 text-xs font-black">
                      <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-slate-300">
                        TOTALE MASTRINI VENDITE:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm font-black text-blue-300">
                        {formatCurrency(totMastriniVendite)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick add row button at bottom */}
            <div className="p-2 bg-slate-950 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAddMastrinoVendite}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-dashed border-blue-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Aggiungi riga Mastrino Ricavi (Vendita Merci, Servizi, ecc.)</span>
              </button>
            </div>
          </div>
        </div>

        {/* RICONCILIAZIONE SBILANCI (MASTRINI VS CANTIERI + SOSPESI) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Scale className="h-4 w-4 text-amber-400" />
                <span>RISULTATO DELLA QUADRATURA CONTI (MASTRINI VS CANTIERI)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Confronto contabile tra i mastrini di bilancio e i totali effettivi delle schede cantieri + sospesi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                isComplessivoQuadrato
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isComplessivoQuadrato ? '✓ QUADRATURA PERFETTA (€ 0,00)' : '⚠️ PRESENZA DI SBILANCI'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Box 1: Costi Cantieri + Sospesi */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Costi Cantieri + Sospesi
              </div>
              <div className="text-sm font-mono font-bold text-rose-300">
                {formatCurrency(totalAcquistiConSospesi)}
              </div>
              <div className="text-[10px] text-slate-500">
                Cantieri: {formatCurrency(cantieriTotals.sumAcquisti)} • Sospesi: {formatCurrency(totSospesiImporto)}
              </div>
            </div>

            {/* Box 2: Totale Mastrini Acquisti */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Mastrini Costi Bilancio
              </div>
              <div className="text-sm font-mono font-bold text-rose-300">
                {formatCurrency(totMastriniAcquisti)}
              </div>
              <div className="text-[10px] text-slate-500">
                {mastriniAcquistiList.length} mastrini di costo inseriti
              </div>
            </div>

            {/* Box 3: Sbilancio Acquisti */}
            <div className={`p-3 rounded-lg border space-y-1 ${
              isAcquistiQuadrati
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Sbilancio Acquisti (Costi)
              </div>
              <div className="text-base font-mono font-black">
                {isAcquistiQuadrati ? '€ 0,00' : formatCurrency(sbilancioAcquisti)}
              </div>
              <div className="text-[10px] font-semibold">
                {isAcquistiQuadrati ? '✓ QUADRATO' : 'DELTA DA RICONCILIARE'}
              </div>
            </div>

            {/* Box 4: Sbilancio Ricavi */}
            <div className={`p-3 rounded-lg border space-y-1 ${
              isVenditeQuadrate
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Sbilancio Ricavi
              </div>
              <div className="text-base font-mono font-black">
                {isVenditeQuadrate ? '€ 0,00' : formatCurrency(sbilancioRicavi)}
              </div>
              <div className="text-[10px] font-semibold">
                {isVenditeQuadrate ? '✓ QUADRATO' : 'DELTA DA RICONCILIARE'}
              </div>
            </div>
          </div>
        </div>

        {/* Note e Salva */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <input
            type="text"
            value={quadraturaNotes}
            onChange={(e) => setQuadraturaNotes(e.target.value)}
            placeholder="Note di quadratura (es. Riconciliato con mastrini al 31/12...)"
            className="w-full sm:flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />

          <button
            type="button"
            onClick={handleSaveQuadratura}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{isQuadraturaSaved ? 'Salvato!' : 'Salva Dati Mastrini'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Cantiere Deletion */}
      <ConfirmModal
        isOpen={!!cantiereToDelete}
        title="Elimina Scheda Cantiere"
        message={
          cantiereToDelete ? (
            <div className="space-y-2">
              <p>
                Sei sicuro di voler eliminare la scheda cantiere{' '}
                <strong className="text-white font-bold">"{cantiereToDelete.name}"</strong>?
              </p>
              <p className="text-xs text-slate-400">
                Committente: {cantiereToDelete.client} • Città: {cantiereToDelete.city}
              </p>
              {cantiereToDelete.movements?.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  <strong>Attenzione:</strong> verranno cancellati tutti i{' '}
                  <strong className="underline">{cantiereToDelete.movements.length} movimenti contabili</strong>{' '}
                  registrati su questo cantiere.
                </div>
              )}
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

      {/* Confirmation Modal for Artisan Deletion */}
      <ConfirmModal
        isOpen={isConfirmDeleteArtigianoOpen}
        title="Elimina Cliente Artigiano"
        message={
          <div className="space-y-2">
            <p>
              Sei sicuro di voler eliminare definitivamente l'artigiano{' '}
              <strong className="text-white font-bold">"{artigiano.name}"</strong>?
            </p>
          </div>
        }
        confirmText="Elimina Cliente"
        cancelText="Annulla"
        onConfirm={() => {
          if (onDeleteArtigiano) {
            onDeleteArtigiano(artigiano.id);
          }
          setIsConfirmDeleteArtigianoOpen(false);
        }}
        onCancel={() => setIsConfirmDeleteArtigianoOpen(false)}
      />
    </div>
  );
};
