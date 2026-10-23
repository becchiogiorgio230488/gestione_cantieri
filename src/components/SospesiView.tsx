import React, { useState, useRef, useMemo } from 'react';
import {
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Printer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building,
  Calendar,
  FileText,
  Save,
  X,
  Search,
  CheckSquare,
  Square,
  Lock,
  Paperclip,
  ArrowRightLeft,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Cantiere, SospesoItem, AttachmentPdf } from '../types';
import { formatCurrency, formatDateItalian, getTodayISODate } from '../utils/calculations';
import { exportSospesiExcel } from '../utils/excelExport';
import { CantiereSearchSelect, formatCantiereLabel } from './CantiereSearchSelect';
import { CantiereModal } from './CantiereModal';
import { openOrDownloadPdf } from '../utils/pdfStorage';
import { PdfAttachmentModal } from './PdfAttachmentModal';

interface SospesiViewProps {
  sospesi: SospesoItem[];
  cantieri: Cantiere[];
  artigianoName?: string;
  onBack?: () => void;
  onAssignToCantiere: (sospesoId: string, targetCantiereId: string, partialAmount?: number) => void;
  onAssignMultipleToCantiere?: (sospesiIds: string[], targetCantiereId: string) => void;
  onUpdateSospeso: (updated: SospesoItem) => void;
  onUpdateSospesoPdf?: (sospeso: SospesoItem, newPdf: AttachmentPdf | null) => void;
  onDeleteSospeso: (id: string) => void;
  onDeleteMultipleSospesi?: (ids: string[]) => void;
  onClearAllSospesi?: () => void;
  onAddManualSospeso: (item: Omit<SospesoItem, 'id' | 'createdAt'>) => void;
  onOpenExcelImport?: () => void;
  onPrintReport: () => void;
  onCreateNewCantiereDirectly?: (cantiereData: Partial<Cantiere>) => Cantiere;
}

export const SospesiView: React.FC<SospesiViewProps> = ({
  sospesi,
  cantieri,
  artigianoName,
  onBack,
  onAssignToCantiere,
  onAssignMultipleToCantiere,
  onUpdateSospeso,
  onUpdateSospesoPdf,
  onDeleteSospeso,
  onDeleteMultipleSospesi,
  onClearAllSospesi,
  onAddManualSospeso,
  onOpenExcelImport,
  onPrintReport,
  onCreateNewCantiereDirectly,
}) => {
  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // PDF attachment modal
  const [managingPdfSospeso, setManagingPdfSospeso] = useState<SospesoItem | null>(null);

  // Additional cantieri created on-the-fly during this session
  const [localExtraCantieri, setLocalExtraCantieri] = useState<Cantiere[]>([]);

  // Merged cantieri list
  const allCantieri: Cantiere[] = useMemo(() => {
    const map = new Map<string, Cantiere>();
    cantieri.forEach((c) => map.set(c.id, c));
    localExtraCantieri.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [cantieri, localExtraCantieri]);

  // Modal to create new cantiere on the fly
  const [isCreatingNewCantiere, setIsCreatingNewCantiere] = useState(false);
  const [createCantiereContext, setCreateCantiereContext] = useState<'single_action' | 'bulk' | null>(null);

  const handleSaveNewCantiere = (cantiereData: Partial<Cantiere>) => {
    let newC: Cantiere;
    if (onCreateNewCantiereDirectly) {
      newC = onCreateNewCantiereDirectly(cantiereData);
    } else {
      const upperName = (cantiereData.name || 'NUOVO CANTIERE').trim().toUpperCase();
      const upperCity = (cantiereData.city || cantieri[0]?.city || 'MILANO').trim().toUpperCase();
      const upperAddress = cantiereData.address?.trim() ? cantiereData.address.trim().toUpperCase() : '';
      newC = {
        id: `cantiere-${Date.now()}`,
        name: upperName,
        city: upperCity,
        address: upperAddress || '',
        date: cantiereData.date || new Date().toISOString().slice(0, 10),
        year: cantiereData.year || 2026,
        client: upperName,
        initialInventory: cantiereData.initialInventory || 0,
        finalInventory: cantiereData.finalInventory || 0,
        category: cantiereData.category || 'idraulico',
        status: cantiereData.status || 'attivo',
        notes: cantiereData.notes || '',
        movements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setLocalExtraCantieri((prev) => [...prev, newC]);

    if (createCantiereContext === 'single_action') {
      setActionTargetCantiereId(newC.id);
    } else if (createCantiereContext === 'bulk') {
      setBulkTargetCantiereId(newC.id);
    }

    setIsCreatingNewCantiere(false);
    setCreateCantiereContext(null);
  };

  const handleSavePdf = (newPdf: AttachmentPdf | null) => {
    if (!managingPdfSospeso) return;
    if (onUpdateSospesoPdf) {
      onUpdateSospesoPdf(managingPdfSospeso, newPdf);
    } else {
      onUpdateSospeso({
        ...managingPdfSospeso,
        attachmentPdf: newPdf || undefined,
      });
    }
    setManagingPdfSospeso(null);
  };

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetCantiereId, setBulkTargetCantiereId] = useState<string>('');
  const [bulkAssignConfirmTarget, setBulkAssignConfirmTarget] = useState<{
    items: SospesoItem[];
    cantiere: Cantiere;
  } | null>(null);
  const [isConfirmDeleteSelectedOpen, setIsConfirmDeleteSelectedOpen] = useState(false);

  // -------------------------------------------------------------
  // TRASH ACTION MODAL (Dual choice: Sposta in Cantiere OR Elimina definitivamente)
  // -------------------------------------------------------------
  const [actionItem, setActionItem] = useState<SospesoItem | null>(null);
  const [actionStep, setActionStep] = useState<'choose_action' | 'confirm_move' | 'confirm_delete'>('choose_action');
  const [actionTargetCantiereId, setActionTargetCantiereId] = useState<string>('');
  const [actionMoveAmountMode, setActionMoveAmountMode] = useState<'full' | 'partial'>('full');
  const [actionPartialAmountInput, setActionPartialAmountInput] = useState<string>('');

  const handleOpenActionModal = (item: SospesoItem) => {
    setActionItem(item);
    setActionStep('choose_action');
    setActionMoveAmountMode('full');
    setActionPartialAmountInput('');
    // Pre-select first available cantiere if none selected yet
    if (allCantieri.length > 0) {
      setActionTargetCantiereId(allCantieri[0].id);
    } else {
      setActionTargetCantiereId('');
    }
  };

  const handleConfirmActionMove = () => {
    if (!actionItem || !actionTargetCantiereId) return;
    const targetC = allCantieri.find((c) => c.id === actionTargetCantiereId);
    if (!targetC) return;

    const totalAmt = Math.round((Number(actionItem.amount) || 0) * 100) / 100;
    const parsedPartial = parseFloat(actionPartialAmountInput.replace(',', '.')) || 0;
    const isValidPartial = parsedPartial > 0 && parsedPartial < totalAmt;
    const isPartial = actionMoveAmountMode === 'partial' && isValidPartial;
    const moveAmt = isPartial ? Math.round(parsedPartial * 100) / 100 : totalAmt;

    onAssignToCantiere(actionItem.id, targetC.id, isPartial ? moveAmt : undefined);
    if (!isPartial) {
      setSelectedIds((prev) => prev.filter((id) => id !== actionItem.id));
    }
    setActionItem(null);
    setActionStep('choose_action');
  };

  const handleConfirmActionDelete = () => {
    if (!actionItem) return;
    onDeleteSospeso(actionItem.id);
    setSelectedIds((prev) => prev.filter((id) => id !== actionItem.id));
    setActionItem(null);
    setActionStep('choose_action');
  };

  // -------------------------------------------------------------
  // INLINE EDITING OF ROW (Fornitore, DDT, Importo, Data, Doc, Protocollo)
  // -------------------------------------------------------------
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<{
    date: string;
    docNumber: string;
    supplier: string;
    ddtNumber: string;
    protocol: string;
    amount: number;
    notes: string;
  } | null>(null);

  const handleStartEditRow = (s: SospesoItem) => {
    setEditingRowId(s.id);
    setEditRowData({
      date: s.date,
      docNumber: s.docNumber,
      supplier: s.supplier,
      ddtNumber: s.ddtNumber || '',
      protocol: s.protocol || '',
      amount: s.amount,
      notes: s.internalNote || s.customerNote || '',
    });
  };

  const handleSaveEditRow = () => {
    if (!editingRowId || !editRowData) return;
    const current = sospesi.find((s) => s.id === editingRowId);
    if (!current) return;

    const updated: SospesoItem = {
      ...current,
      date: editRowData.date,
      docNumber: editRowData.docNumber.trim(),
      supplier: editRowData.supplier.trim().toUpperCase(),
      ddtNumber: editRowData.ddtNumber.trim() || undefined,
      protocol: editRowData.protocol.trim() || undefined,
      amount: Math.round(Number(editRowData.amount) * 100) / 100 || 0,
      internalNote: editRowData.notes.trim() || undefined,
      customerNote: undefined,
    };

    onUpdateSospeso(updated);
    setEditingRowId(null);
    setEditRowData(null);
  };

  // -------------------------------------------------------------
  // QUICK ROW NOTE EDITING
  // -------------------------------------------------------------
  const [editingRowNoteId, setEditingRowNoteId] = useState<string | null>(null);
  const [editingRowNoteText, setEditingRowNoteText] = useState<string>('');

  const handleSaveRowNote = (s: SospesoItem) => {
    const text = editingRowNoteText.trim() || undefined;
    onUpdateSospeso({
      ...s,
      internalNote: text,
      customerNote: undefined,
    });
    setEditingRowNoteId(null);
  };

  // -------------------------------------------------------------
  // ADD MANUAL MOVEMENT FORM
  // -------------------------------------------------------------
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [newMovement, setNewMovement] = useState<{
    date: string;
    docNumber: string;
    supplier: string;
    ddtNumber: string;
    protocol: string;
    amount: number;
    notes: string;
  }>({
    date: getTodayISODate(),
    docNumber: '',
    supplier: '',
    ddtNumber: '',
    protocol: '',
    amount: 0,
    notes: '',
  });

  const handleSaveNewMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovement.docNumber.trim() || !newMovement.supplier.trim()) return;

    onAddManualSospeso({
      date: newMovement.date,
      docNumber: newMovement.docNumber.trim(),
      supplier: newMovement.supplier.trim().toUpperCase(),
      protocol: newMovement.protocol.trim() || undefined,
      ddtNumber: newMovement.ddtNumber.trim() || undefined,
      description: newMovement.ddtNumber ? `DDT ${newMovement.ddtNumber}` : 'Materiale sospeso',
      amount: Math.round(Number(newMovement.amount) * 100) / 100 || 0,
      status: 'in_attesa_cliente',
      internalNote: newMovement.notes.trim() || undefined,
      customerNote: undefined,
    });

    setIsAddingMovement(false);
    setNewMovement({
      date: getTodayISODate(),
      docNumber: '',
      supplier: '',
      ddtNumber: '',
      protocol: '',
      amount: 0,
      notes: '',
    });
  };

  // -------------------------------------------------------------
  // FILTERING & TOTALS
  // -------------------------------------------------------------
  const filteredSospesi = useMemo(() => {
    if (!searchTerm.trim()) return sospesi;
    const q = searchTerm.toLowerCase();
    return sospesi.filter((s) => {
      return (
        s.docNumber.toLowerCase().includes(q) ||
        s.supplier.toLowerCase().includes(q) ||
        (s.ddtNumber && s.ddtNumber.toLowerCase().includes(q)) ||
        (s.protocol && s.protocol.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.internalNote && s.internalNote.toLowerCase().includes(q))
      );
    });
  }, [sospesi, searchTerm]);

  const totSospesi = useMemo(() => {
    return sospesi.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  }, [sospesi]);

  const selectedItems = useMemo(() => {
    return sospesi.filter((s) => selectedIds.includes(s.id));
  }, [sospesi, selectedIds]);

  const selectedAmount = useMemo(() => {
    return selectedItems.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  }, [selectedItems]);

  const isAllFilteredSelected =
    filteredSospesi.length > 0 &&
    filteredSospesi.every((s) => selectedIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredSospesi.map((s) => s.id));
      setSelectedIds(selectedIds.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedIds, ...filteredSospesi.map((s) => s.id)]);
      setSelectedIds(Array.from(newSet));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Bulk actions handlers
  const handleAssignBulk = () => {
    const targetId = bulkTargetCantiereId;
    if (!targetId || selectedIds.length === 0) return;
    const targetC = allCantieri.find((c) => c.id === targetId);
    if (!targetC) return;
    setBulkAssignConfirmTarget({ items: selectedItems, cantiere: targetC });
  };

  const handleConfirmBulkAssign = () => {
    if (!bulkAssignConfirmTarget) return;
    const { items, cantiere } = bulkAssignConfirmTarget;
    const ids = items.map((i) => i.id);

    if (onAssignMultipleToCantiere) {
      onAssignMultipleToCantiere(ids, cantiere.id);
    } else {
      for (const id of ids) {
        onAssignToCantiere(id, cantiere.id);
      }
    }
    setSelectedIds([]);
    setBulkAssignConfirmTarget(null);
    setBulkTargetCantiereId('');
  };

  const handleConfirmDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (onDeleteMultipleSospesi) {
      onDeleteMultipleSospesi(selectedIds);
    } else {
      selectedIds.forEach((id) => onDeleteSospeso(id));
    }
    setSelectedIds([]);
    setIsConfirmDeleteSelectedOpen(false);
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Breadcrumb Navigation */}
      {onBack && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer group"
          >
            <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            <span>← Torna al Prospetto Generale {artigianoName ? `(${artigianoName})` : ''}</span>
          </button>
          <span className="font-mono text-[11px] text-slate-400">
            SCHEDA SOSPESI • REGISTRO MOVIMENTI
          </span>
        </div>
      )}

      {/* Top Banner / Summary Header */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-white tracking-tight uppercase">
                  SCHEDA SOSPESI • REGISTRO MOVIMENTI
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {sospesi.length} in attesa
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Documenti di costo e DDT non ancora assegnati a un cantiere.
                Usa l'azione cestino su ciascuna riga per <strong>spostare nel cantiere desiderato</strong> oppure per <strong>eliminare definitivamente</strong> la voce.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="text-right bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Totale Sospeso</span>
              <span className="text-xl font-black font-mono text-amber-400">
                {formatCurrency(totSospesi)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportSospesiExcel(sospesi, artigianoName)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
                title="Esporta la scheda sospesi in formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Esporta Excel</span>
              </button>
              <button
                type="button"
                onClick={onPrintReport}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                title="Stampa la scheda sospesi o salva come PDF"
              >
                <Printer className="h-4 w-4" />
                <span>Stampa / PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddingMovement(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
                title="Aggiungi una voce sospesa manualmente"
              >
                <Plus className="h-4 w-4" />
                <span>Nuova Voce</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar when items are selected */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300">
              {selectedIds.length} {selectedIds.length === 1 ? 'voce selezionata' : 'voci selezionate'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              Totale selezionato: <strong className="text-rose-300 font-mono">{formatCurrency(selectedAmount)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allCantieri.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-72 min-w-[220px]">
                  <CantiereSearchSelect
                    value={bulkTargetCantiereId}
                    onChange={setBulkTargetCantiereId}
                    cantieri={allCantieri}
                    onCreateNew={() => {
                      setCreateCantiereContext('bulk');
                      setIsCreatingNewCantiere(true);
                    }}
                    showSospesiOption={false}
                    showIgnoreOption={false}
                    showUnassignedOption={true}
                    unassignedLabel="Seleziona cantiere di destinazione..."
                    placeholder="Cerca cantiere per nome o città..."
                    size="sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAssignBulk}
                  disabled={!bulkTargetCantiereId}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                  title="Sposta tutte le voci selezionate nel cantiere scelto"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span>Sposta Selezionati</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsConfirmDeleteSelectedOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Cancella definitivamente tutte le voci selezionate"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Cancella Selezionati ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
              title="Deseleziona tutto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add Movement Inline Form (graphically identical to SchedaCantiereView) */}
      {isAddingMovement && (
        <form
          onSubmit={handleSaveNewMovement}
          className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-md space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-400" />
              <span>
                Nuova Voce Sospesa: <strong className="text-rose-400">ACQUISTO / COSTO</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsAddingMovement(false)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">DATA DOC.</label>
              <input
                type="date"
                required
                value={newMovement.date}
                onChange={(e) => setNewMovement({ ...newMovement, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">N° DOC.</label>
              <input
                type="text"
                required
                placeholder="es. FT-2026/012 o DDT 45"
                value={newMovement.docNumber}
                onChange={(e) => setNewMovement({ ...newMovement, docNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">FORNITORE</label>
              <input
                type="text"
                required
                placeholder="es. SONEPAR SPA"
                value={newMovement.supplier}
                onChange={(e) => setNewMovement({ ...newMovement, supplier: e.target.value.toUpperCase() })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white uppercase focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">RIF. DDT (OPZIONALE)</label>
              <input
                type="text"
                placeholder="es. DDT 45 del 12/01"
                value={newMovement.ddtNumber}
                onChange={(e) => setNewMovement({ ...newMovement, ddtNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">N./PROT</label>
              <input
                type="text"
                placeholder="es. PROT-26-015"
                value={newMovement.protocol}
                onChange={(e) => setNewMovement({ ...newMovement, protocol: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">IMPORTO ACQUISTI (€)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={newMovement.amount || ''}
                onChange={(e) =>
                  setNewMovement({ ...newMovement, amount: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-rose-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-6">
              <label className="block text-slate-400 font-semibold mb-1">
                NOTE SULLA RIGA (OPZIONALE)
              </label>
              <input
                type="text"
                placeholder="es. Da verificare con il committente..."
                value={newMovement.notes}
                onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingMovement(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-medium cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded font-bold transition-colors cursor-pointer"
            >
              Registra Movimento Sospeso
            </button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------- */}
      {/* THE MOVEMENTS GRID (Graphically identical to SchedaCantiereView) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Search & Count Header */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Registro Movimenti Sospesi
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
              {filteredSospesi.length} {filteredSospesi.length === 1 ? 'riga' : 'righe'}
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
              Totale costi:{' '}
              <strong className="text-rose-400 font-mono font-bold">
                {formatCurrency(
                  filteredSospesi.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)
                )}
              </strong>
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtra per n° doc, fornitore, ddt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Movements Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b-2 border-slate-800 uppercase tracking-wider text-[11px] font-extrabold">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                    title="Seleziona / Deseleziona tutti"
                  />
                </th>
                <th className="py-3 px-3.5 w-28">DATA DOC.</th>
                <th className="py-3 px-3.5 w-32">N° DOC.</th>
                <th className="py-3 px-4">TIPO DOC. / FORNITORE / CLIENTE</th>
                <th className="py-3 px-3 w-28">N./PROT</th>
                <th className="py-3 px-4 text-right w-32 text-rose-400">ACQUISTI (€)</th>
                <th className="py-3 px-3 text-right w-28">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredSospesi.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Nessuna voce sospesa!</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tutti i materiali e i DDT risultano correttamente assegnati ai cantieri di competenza.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSospesi.map((s) => {
                  const isEditing = editingRowId === s.id;
                  const isSelected = selectedIds.includes(s.id);
                  const rowNote = s.internalNote || s.customerNote;

                  // ---------------------------------------------
                  // INLINE EDIT MODE (when user clicks Edit2 icon)
                  // ---------------------------------------------
                  if (isEditing && editRowData) {
                    return (
                      <tr key={s.id} className="bg-slate-800/80">
                        <td className="p-2 text-center">
                          <span className="text-amber-400 text-xs font-bold">✎</span>
                        </td>
                        <td className="p-2">
                          <input
                            type="date"
                            value={editRowData.date}
                            onChange={(e) =>
                              setEditRowData({ ...editRowData, date: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editRowData.docNumber}
                            onChange={(e) =>
                              setEditRowData({ ...editRowData, docNumber: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2 space-y-1">
                          <input
                            type="text"
                            placeholder="Fornitore..."
                            value={editRowData.supplier}
                            onChange={(e) =>
                              setEditRowData({
                                ...editRowData,
                                supplier: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-semibold uppercase"
                          />
                          <input
                            type="text"
                            placeholder="Rif. DDT (es. DDT 45 del 12/01)..."
                            value={editRowData.ddtNumber}
                            onChange={(e) =>
                              setEditRowData({ ...editRowData, ddtNumber: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-amber-400/50 rounded px-1.5 py-0.5 text-[11px] text-amber-200 placeholder-slate-500"
                          />
                          <input
                            type="text"
                            placeholder="Note riga..."
                            value={editRowData.notes}
                            onChange={(e) =>
                              setEditRowData({ ...editRowData, notes: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-300 placeholder-slate-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="PROT..."
                            value={editRowData.protocol}
                            onChange={(e) =>
                              setEditRowData({ ...editRowData, protocol: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editRowData.amount}
                            onChange={(e) =>
                              setEditRowData({
                                ...editRowData,
                                amount: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right font-mono text-rose-300"
                          />
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={handleSaveEditRow}
                            className="p-1 text-emerald-400 hover:text-emerald-300 mr-1 cursor-pointer"
                            title="Salva modifiche"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRowId(null);
                              setEditRowData(null);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                            title="Annulla"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // ---------------------------------------------
                  // NORMAL DISPLAY ROW (Identical to SchedaCantiereView)
                  // ---------------------------------------------
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(s.id)}
                          className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                          title="Seleziona voce"
                        />
                      </td>

                      {/* DATA DOC. */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-300 text-xs">
                        {formatDateItalian(s.date)}
                      </td>

                      {/* N° DOC. */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{s.docNumber}</span>
                          {s.sourceFileName && (
                            <span className="px-1 py-0.2 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              XML
                            </span>
                          )}
                          {s.attachmentPdf ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openOrDownloadPdf(s.attachmentPdf!)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                title={`Visualizza/scarica copia PDF fattura (${s.attachmentPdf.fileName})`}
                              >
                                <FileText className="h-3 w-3 text-red-400" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setManagingPdfSospeso(s)}
                                className="p-0.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
                                title="Modifica, sostituisci o rimuovi il PDF allegato"
                              >
                                <Paperclip className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setManagingPdfSospeso(s)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                              title="Allega copia PDF della fattura a questa voce"
                            >
                              <Paperclip className="h-3 w-3 text-slate-400 hover:text-red-400" />
                              <span>+ PDF</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* TIPO DOC. / FORNITORE / CLIENTE */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-100 uppercase tracking-wide">
                            {s.supplier}
                          </span>
                          {s.ddtNumber && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-mono font-bold tracking-tight">
                              DDT {s.ddtNumber} {s.ddtDate ? `del ${s.ddtDate}` : ''}
                            </span>
                          )}
                        </div>

                        {/* Note editing / display */}
                        {editingRowNoteId === s.id ? (
                          <div className="mt-1.5 flex items-center gap-1.5 animate-fadeIn">
                            <input
                              type="text"
                              value={editingRowNoteText}
                              onChange={(e) => setEditingRowNoteText(e.target.value)}
                              placeholder="Scrivi nota per questa riga..."
                              className="w-full bg-slate-950 border border-amber-400 rounded px-2 py-1 text-xs text-white focus:outline-none shadow-inner"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRowNote(s);
                                } else if (e.key === 'Escape') {
                                  setEditingRowNoteId(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRowNote(s)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm shrink-0"
                              title="Salva nota"
                            >
                              <Save className="h-3 w-3" />
                              <span>Salva</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRowNoteId(null)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer transition-colors shrink-0"
                              title="Annulla"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {rowNote ? (
                              <div
                                onClick={() => {
                                  setEditingRowNoteId(s.id);
                                  setEditingRowNoteText(rowNote);
                                }}
                                className="group/note inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-800 text-amber-300/95 hover:text-amber-200 border border-slate-700/80 cursor-pointer text-xs transition-colors"
                                title="Clicca per modificare la nota di questa riga"
                              >
                                <FileText className="h-3 w-3 text-amber-400 shrink-0" />
                                <span className="font-sans font-medium">{rowNote}</span>
                                <Edit2 className="h-2.5 w-2.5 text-slate-400 opacity-0 group-hover/note:opacity-100 transition-opacity ml-0.5" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRowNoteId(s.id);
                                  setEditingRowNoteText('');
                                }}
                                className="text-[11px] text-slate-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                                title="Aggiungi una nota a questa riga"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Aggiungi nota</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* N./PROT */}
                      <td className="py-3 px-3 font-mono text-xs">
                        {s.protocol && s.protocol !== '-' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700/80 inline-block shadow-sm">
                            #{s.protocol}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* ACQUISTI (€) */}
                      <td
                        className={`py-3 px-4 text-right font-mono font-medium ${
                          s.amount < 0 ? 'text-purple-300 font-bold' : 'text-rose-300'
                        }`}
                      >
                        {s.amount !== 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {s.amount < 0 && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 font-sans font-bold border border-purple-500/30">
                                N.C.
                              </span>
                            )}
                            <span>{formatCurrency(s.amount)}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* AZIONI (Note, PDF, Edit, Trash) */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Note icon */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRowNoteId(s.id);
                              setEditingRowNoteText(rowNote || '');
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              rowNote
                                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                                : 'text-slate-400 hover:text-amber-400'
                            }`}
                            title={
                              rowNote
                                ? `Nota: "${rowNote}" (clicca per modificare)`
                                : 'Aggiungi nota su questa riga'
                            }
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>

                          {/* PDF icon */}
                          <button
                            type="button"
                            onClick={() => setManagingPdfSospeso(s)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              s.attachmentPdf
                                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                : 'text-slate-400 hover:text-red-400'
                            }`}
                            title={
                              s.attachmentPdf
                                ? `Gestisci PDF allegato (${s.attachmentPdf.fileName})`
                                : 'Allega PDF della fattura a questo documento'
                            }
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit row icon */}
                          <button
                            type="button"
                            onClick={() => handleStartEditRow(s)}
                            className="p-1 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                            title="Modifica riga (Fornitore, DDT, Importo, Data, Doc, Protocollo)"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Trash icon (Dual Choice: Sposta in un cantiere o Elimina definitivamente) */}
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(s)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Gestisci riga: Sposta in un Cantiere o Cancella Definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TRASH ACTION MODAL (Choice: 1. Sposta in Cantiere | 2. Elimina) */}
      {/* ------------------------------------------------------------- */}
      {actionItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    actionStep === 'confirm_delete'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {actionStep === 'confirm_delete' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {actionStep === 'choose_action' && 'Gestione Voce Sospesa'}
                    {actionStep === 'confirm_move' && 'Conferma Spostamento nel Cantiere'}
                    {actionStep === 'confirm_delete' && 'Conferma Cancellazione Definitiva'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {actionStep === 'choose_action' &&
                      'Scegli se spostare questo movimento in un cantiere oppure cancellarlo per sempre.'}
                    {actionStep === 'confirm_move' &&
                      'Verifica con attenzione il cantiere di destinazione prima di spostare la riga.'}
                    {actionStep === 'confirm_delete' &&
                      'Operazione irreversibile: la voce non sarà più recuperabile.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionItem(null);
                  setActionStep('choose_action');
                }}
                className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Highlight Card */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans font-bold">Documento:</span>
                <span className="text-white font-bold">{actionItem.docNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans font-bold">Data:</span>
                <span className="text-slate-200">{formatDateItalian(actionItem.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans font-bold">Fornitore:</span>
                <span className="text-amber-300 font-bold uppercase">{actionItem.supplier}</span>
              </div>
              {actionItem.ddtNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-bold">Riferimento DDT:</span>
                  <span className="text-amber-200">{actionItem.ddtNumber}</span>
                </div>
              )}
              {actionItem.protocol && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-bold">Protocollo:</span>
                  <span className="text-slate-300">#{actionItem.protocol}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-sans font-bold">Importo:</span>
                <span className="text-rose-400 font-bold text-sm">
                  {formatCurrency(actionItem.amount)}
                </span>
              </div>
            </div>

            {/* STEP 1: CHOOSE ACTION */}
            {actionStep === 'choose_action' && (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-slate-300">
                  Cosa desideri fare con questa voce? Scegli un'opzione:
                </p>

                {/* Option 1: Move to Cantiere */}
                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 hover:border-blue-500/50 transition-all space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg shrink-0">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-300">
                        1. Sposta in un Cantiere
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Cerca un cantiere esistente per nome o città, oppure creane uno nuovo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <CantiereSearchSelect
                      value={actionTargetCantiereId}
                      onChange={setActionTargetCantiereId}
                      cantieri={allCantieri}
                      onCreateNew={() => {
                        setCreateCantiereContext('single_action');
                        setIsCreatingNewCantiere(true);
                      }}
                      showSospesiOption={false}
                      showIgnoreOption={false}
                      showUnassignedOption={false}
                      placeholder="Cerca cantiere per nome o città..."
                      size="sm"
                    />

                    <div className="text-right pt-1">
                      <button
                        type="button"
                        onClick={() => setActionStep('confirm_move')}
                        disabled={!actionTargetCantiereId}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span>Procedi allo Spostamento nel Cantiere →</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Option 2: Delete Permanently */}
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 hover:border-rose-500/50 transition-all space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/20 text-rose-300 rounded-lg shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-300">
                        2. Elimina Definitivamente
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Elimina in modo irreversibile questo movimento contabile da tutti i registri.
                      </p>
                    </div>
                  </div>
                  <div className="text-right pt-1">
                    <button
                      type="button"
                      onClick={() => setActionStep('confirm_delete')}
                      className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Cancella Definitivamente...</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setActionItem(null);
                      setActionStep('choose_action');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CONFIRM MOVE TO CANTIERE (FULL OR PARTIAL AMOUNT) */}
            {actionStep === 'confirm_move' && actionItem && (() => {
              const targetC = allCantieri.find((c) => c.id === actionTargetCantiereId);
              const totalAmt = Math.round((Number(actionItem.amount) || 0) * 100) / 100;
              const parsedPartial = parseFloat(actionPartialAmountInput.replace(',', '.')) || 0;
              const isValidPartial = parsedPartial > 0 && parsedPartial < totalAmt;
              const isInvalidPartial = actionMoveAmountMode === 'partial' && !isValidPartial;
              const moveAmt = actionMoveAmountMode === 'partial' && isValidPartial ? Math.round(parsedPartial * 100) / 100 : totalAmt;
              const remainingAmt = Math.round((totalAmt - moveAmt) * 100) / 100;

              return (
                <div className="space-y-4 pt-1 animate-fadeIn">
                  <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-2">
                    <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-wider">
                      <Building className="h-4 w-4 text-blue-400 shrink-0" />
                      <span>Cantiere di Destinazione Selezionato:</span>
                    </div>

                    {targetC && (
                      <div className="bg-slate-900/90 p-3 rounded-lg border border-blue-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Nome Cantiere:
                          </span>
                          <span className="text-sm font-black text-amber-400 uppercase">
                            {targetC.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Committente / Cliente:
                          </span>
                          <span className="text-xs font-bold text-white uppercase">
                            {targetC.client || targetC.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Città &amp; Indirizzo:
                          </span>
                          <span className="text-xs font-semibold text-slate-200 uppercase">
                            {targetC.city}
                            {targetC.address ? ` - ${targetC.address}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">
                            Esercizio Fiscale:
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            Anno {targetC.year} • Stato {targetC.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dettagli documento in transito */}
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase">Documento da trasferire:</span>
                      <span className="text-white font-bold">{actionItem.docNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase">Data Documento:</span>
                      <span className="text-slate-200 font-mono">{formatDateItalian(actionItem.date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase">Fornitore:</span>
                      <span className="text-slate-200 font-medium">{actionItem.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase">N./PROT:</span>
                      <span className="text-slate-200 font-mono">{actionItem.protocol || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400 font-bold uppercase">Importo Attuale nei Sospesi:</span>
                      <span className="text-amber-400 font-mono font-bold text-sm">
                        {formatCurrency(totalAmt)}
                      </span>
                    </div>
                  </div>

                  {/* Scelta Quota: Intero importo o Importo Parziale */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Quanto desideri spostare in {targetC?.name || 'questo cantiere'}?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setActionMoveAmountMode('full')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          actionMoveAmountMode === 'full'
                            ? 'bg-blue-600/20 border-blue-500 text-white font-bold ring-1 ring-blue-500/50'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">Intero Importo</span>
                          <span className="font-mono font-bold text-blue-300">{formatCurrency(totalAmt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal">
                          Rimuove completamente la riga dalla Scheda Sospesi.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionMoveAmountMode('partial');
                          if (!actionPartialAmountInput) {
                            setActionPartialAmountInput((totalAmt / 2).toFixed(2));
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          actionMoveAmountMode === 'partial'
                            ? 'bg-blue-600/20 border-blue-500 text-white font-bold ring-1 ring-blue-500/50'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">Solo una Parte (Parziale)</span>
                          <span className="text-[10px] uppercase font-bold text-blue-400">Personalizzato</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal">
                          Sposta una quota; il resto rimane nei Sospesi.
                        </p>
                      </button>
                    </div>

                    {actionMoveAmountMode === 'partial' && (
                      <div className="pt-1.5 space-y-2 animate-fadeIn">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Inserisci la quota da imputare al cantiere (€):
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400 font-mono font-bold">€</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={totalAmt}
                              value={actionPartialAmountInput}
                              onChange={(e) => setActionPartialAmountInput(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-blue-500/60 rounded-lg text-sm font-bold font-mono text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder="0.00"
                              autoFocus
                            />
                          </div>
                          {parsedPartial <= 0 && (
                            <p className="text-[10px] text-rose-400 mt-1">
                              Inserisci una quota positiva superiore a 0.
                            </p>
                          )}
                          {parsedPartial >= totalAmt && (
                            <p className="text-[10px] text-amber-400 mt-1">
                              La quota parziale deve essere inferiore al totale (€ {totalAmt.toFixed(2)}). Se desideri spostare tutto, seleziona "Intero Importo".
                            </p>
                          )}
                        </div>

                        {/* Ripartizione live */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-blue-500/30">
                            <span className="block text-[10px] uppercase text-slate-400 font-bold">Imputato in {targetC?.name}:</span>
                            <span className="font-mono font-bold text-blue-300 text-sm">
                              {formatCurrency(isValidPartial ? parsedPartial : 0)}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Stessa data, doc, fornitore e protocollo
                            </span>
                          </div>
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="block text-[10px] uppercase text-slate-400 font-bold">Resta nei Sospesi:</span>
                            <span className="font-mono font-bold text-amber-300 text-sm">
                              {formatCurrency(isValidPartial ? remainingAmt : totalAmt)}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Rimanenza Scheda Sospesi
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p>
                      ✓ Nel cantiere di destinazione andranno a finire la <strong className="text-slate-200">stessa data ({formatDateItalian(actionItem.date)})</strong>, lo <strong className="text-slate-200">stesso n° doc ({actionItem.docNumber})</strong>, lo <strong className="text-slate-200">stesso fornitore ({actionItem.supplier})</strong> e lo <strong className="text-slate-200">stesso N./PROT ({actionItem.protocol || '-'})</strong>.
                    </p>
                    <p className="mt-1 text-slate-500">
                      I campi nota rimarranno vuoti e la colonna fornitore riporterà i riferimenti del DDT.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActionStep('choose_action')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      ← Torna Indietro (Annulla)
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmActionMove}
                      disabled={isInvalidPartial}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {actionMoveAmountMode === 'partial'
                          ? `Conferma e Sposta Quota (€ ${isValidPartial ? parsedPartial.toFixed(2) : '0.00'}) nel Cantiere`
                          : 'Conferma e Sposta nel Cantiere'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 2: CONFIRM PERMANENT DELETE */}
            {actionStep === 'confirm_delete' && (
              <div className="space-y-4 pt-1 animate-fadeIn">
                <div className="p-4 rounded-xl bg-rose-950/50 border-2 border-rose-500/70 text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                    <span>ATTENZIONE: CANCELLAZIONE DEFINITIVA IRREVERSIBILE</span>
                  </div>
                  <p className="text-xs leading-relaxed text-rose-200/90 font-medium">
                    Stai per eliminare per sempre questo documento dai Sospesi.
                    Questa operazione <strong className="text-white underline">non può essere annullata</strong> e la voce <strong className="text-white">non sarà più recuperabile</strong> in alcun registro.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActionStep('choose_action')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    ← Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmActionDelete}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Sì, Cancella Definitivamente</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BULK MOVE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {bulkAssignConfirmTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Conferma Spostamento Multiplo
                </h3>
                <p className="text-xs text-slate-400">
                  Verifica i dettagli del cantiere dove sposterai le{' '}
                  <strong className="text-amber-300">
                    {bulkAssignConfirmTarget.items.length} voci selezionate
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="bg-slate-950/90 p-3.5 rounded-xl border border-blue-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Cantiere Destinazione:</span>
                <span className="text-sm font-black text-amber-400 uppercase">
                  {bulkAssignConfirmTarget.cantiere.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Committente:</span>
                <span className="font-bold text-white uppercase">
                  {bulkAssignConfirmTarget.cantiere.client ||
                    bulkAssignConfirmTarget.cantiere.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Città &amp; Indirizzo:</span>
                <span className="text-slate-200 uppercase font-semibold">
                  {bulkAssignConfirmTarget.cantiere.city}
                  {bulkAssignConfirmTarget.cantiere.address
                    ? ` - ${bulkAssignConfirmTarget.cantiere.address}`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-bold uppercase">Voci da Spostare:</span>
                <span className="text-white font-mono font-bold">
                  {bulkAssignConfirmTarget.items.length} righe (Tot:{' '}
                  {formatCurrency(
                    bulkAssignConfirmTarget.items.reduce(
                      (acc, it) => acc + (Number(it.amount) || 0),
                      0
                    )
                  )}
                  )
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBulkAssignConfirmTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkAssign}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Conferma e Sposta Tutti</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BULK DELETE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {isConfirmDeleteSelectedOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Cancellazione Multipla ({selectedIds.length} voci)
                </h3>
                <p className="text-xs text-rose-300 font-semibold">
                  Operazione irreversibile
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Stai per eliminare per sempre{' '}
              <strong className="text-white">{selectedIds.length} voci selezionate</strong> dai
              Sospesi per un importo totale di{' '}
              <strong className="text-rose-400 font-mono">{formatCurrency(selectedAmount)}</strong>.
              Nessuna voce sarà più recuperabile.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteSelectedOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>Cancella Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CREATE NEW CANTIERE MODAL (Triggered from search dropdown) */}
      {/* ------------------------------------------------------------- */}
      {isCreatingNewCantiere && (
        <CantiereModal
          zIndex="z-[70]"
          onClose={() => {
            setIsCreatingNewCantiere(false);
            setCreateCantiereContext(null);
          }}
          onSave={handleSaveNewCantiere}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* PDF ATTACHMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {managingPdfSospeso && (
        <PdfAttachmentModal
          isOpen={Boolean(managingPdfSospeso)}
          sospeso={managingPdfSospeso}
          allCantieri={allCantieri}
          sospesi={sospesi}
          onSavePdf={handleSavePdf}
          onClose={() => setManagingPdfSospeso(null)}
        />
      )}
    </div>
  );
};
