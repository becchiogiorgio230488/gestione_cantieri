import React, { useState } from 'react';
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
  Send,
  HelpCircle,
  FileText,
  Save,
  X,
  Search,
  CheckSquare,
  Square,
  Lock,
  EyeOff,
} from 'lucide-react';
import { Cantiere, SospesoItem, Movement } from '../types';
import { formatCurrency, formatDateItalian, getTodayISODate } from '../utils/calculations';
import { exportSospesiExcel } from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';

interface SospesiViewProps {
  sospesi: SospesoItem[];
  cantieri: Cantiere[];
  artigianoName?: string;
  onBack?: () => void;
  onAssignToCantiere: (sospesoId: string, targetCantiereId: string) => void;
  onAssignMultipleToCantiere?: (sospesiIds: string[], targetCantiereId: string) => void;
  onUpdateSospeso: (updated: SospesoItem) => void;
  onDeleteSospeso: (id: string) => void;
  onDeleteMultipleSospesi?: (ids: string[]) => void;
  onClearAllSospesi?: () => void;
  onAddManualSospeso: (item: Omit<SospesoItem, 'id' | 'createdAt'>) => void;
  onPrintReport: () => void;
}

export const SospesiView: React.FC<SospesiViewProps> = ({
  sospesi,
  cantieri,
  artigianoName,
  onBack,
  onAssignToCantiere,
  onAssignMultipleToCantiere,
  onUpdateSospeso,
  onDeleteSospeso,
  onDeleteMultipleSospesi,
  onClearAllSospesi,
  onAddManualSospeso,
  onPrintReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetByItem, setSelectedTargetByItem] = useState<Record<string, string>>({});
  const [sospesoToDelete, setSospesoToDelete] = useState<SospesoItem | null>(null);
  const [isConfirmDeleteSelectedOpen, setIsConfirmDeleteSelectedOpen] = useState(false);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetCantiereId, setBulkTargetCantiereId] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Adding manual sospeso
  const [isAdding, setIsAdding] = useState(false);
  const [manualDate, setManualDate] = useState(getTodayISODate());
  const [manualDoc, setManualDoc] = useState('');
  const [manualSupplier, setManualSupplier] = useState('');
  const [manualClient, setManualClient] = useState('');
  const [manualProtocol, setManualProtocol] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualInternalNote, setManualInternalNote] = useState('');

  // Editing customer note
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  // Editing internal note (only visible on screen)
  const [editingInternalNoteId, setEditingInternalNoteId] = useState<string | null>(null);
  const [editInternalNote, setEditInternalNote] = useState('');

  const totSospesi = sospesi.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  const filteredSospesi = sospesi.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.docNumber.toLowerCase().includes(q) ||
      s.supplier.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.client && s.client.toLowerCase().includes(q)) ||
      (s.protocol && s.protocol.toLowerCase().includes(q)) ||
      (s.internalNote && s.internalNote.toLowerCase().includes(q)) ||
      (s.customerNote && s.customerNote.toLowerCase().includes(q))
    );
  });

  // Calculate selected total
  const selectedItems = sospesi.filter((s) => selectedIds.includes(s.id));
  const selectedAmount = selectedItems.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  const isAllFilteredSelected =
    filteredSospesi.length > 0 &&
    filteredSospesi.every((s) => selectedIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect filtered items
      const filteredIdSet = new Set(filteredSospesi.map((s) => s.id));
      setSelectedIds(selectedIds.filter((id) => !filteredIdSet.has(id)));
    } else {
      // Add all filtered items to selection
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

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirmDeleteSingle = () => {
    if (sospesoToDelete) {
      onDeleteSospeso(sospesoToDelete.id);
      setSelectedIds((prev) => prev.filter((id) => id !== sospesoToDelete.id));
      setSospesoToDelete(null);
    }
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

  const handleConfirmClearAll = () => {
    if (onClearAllSospesi) {
      onClearAllSospesi();
    } else if (onDeleteMultipleSospesi) {
      onDeleteMultipleSospesi(sospesi.map((s) => s.id));
    } else {
      sospesi.forEach((s) => onDeleteSospeso(s.id));
    }
    setSelectedIds([]);
    setIsConfirmClearAllOpen(false);
  };

  const handleAssignBulk = () => {
    const targetId = bulkTargetCantiereId || cantieri[0]?.id;
    if (!targetId || selectedIds.length === 0) return;

    if (onAssignMultipleToCantiere) {
      onAssignMultipleToCantiere(selectedIds, targetId);
    } else {
      for (const id of selectedIds) {
        onAssignToCantiere(id, targetId);
      }
    }
    setSelectedIds([]);
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(manualAmount.replace(',', '.')) || 0;
    if (amountNum <= 0 || !manualDoc || !manualSupplier) {
      setManualError('Inserisci N° Documento, Fornitore e un Importo valido.');
      return;
    }
    setManualError(null);

    onAddManualSospeso({
      date: manualDate,
      docNumber: manualDoc.trim(),
      supplier: manualSupplier.toUpperCase().trim(),
      client: manualClient.trim() || undefined,
      protocol: manualProtocol.trim() || undefined,
      description: manualDesc || 'Materiale da attribuire al cantiere',
      amount: amountNum,
      status: 'in_attesa_cliente',
      customerNote: manualNote.trim() || undefined,
      internalNote: manualInternalNote.trim() || undefined,
    });

    setIsAdding(false);
    setManualDoc('');
    setManualSupplier('');
    setManualClient('');
    setManualProtocol('');
    setManualDesc('');
    setManualAmount('');
    setManualNote('');
    setManualInternalNote('');
  };

  const handleStartEdit = (s: SospesoItem) => {
    setEditingId(s.id);
    setEditNote(s.customerNote || '');
  };

  const handleSaveEdit = (s: SospesoItem) => {
    onUpdateSospeso({
      ...s,
      customerNote: editNote.trim() || undefined,
    });
    setEditingId(null);
  };

  const handleStartEditInternalNote = (s: SospesoItem) => {
    setEditingInternalNoteId(s.id);
    setEditInternalNote(s.internalNote || '');
  };

  const handleSaveEditInternalNote = (s: SospesoItem) => {
    onUpdateSospeso({
      ...s,
      internalNote: editInternalNote.trim() || undefined,
    });
    setEditingInternalNoteId(null);
  };

  const handleExecuteAssign = (sospesoId: string) => {
    const targetCantiereId = selectedTargetByItem[sospesoId] || cantieri[0]?.id;
    if (!targetCantiereId) {
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => id !== sospesoId));
    onAssignToCantiere(sospesoId, targetCantiereId);
  };

  return (
    <div className="space-y-6 pb-16">
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
            SCHEDA SOSPESI • DDT E RIGHE DA ATTRIBUIRE
          </span>
        </div>
      )}

      {/* Top Banner / Header Actions */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-tight uppercase">
                  SCHEDA SOSPESI • DDT E RIGHE DA ATTRIBUIRE
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {sospesi.length} in attesa
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Materiali e documenti di trasporto (DDT) estratti dalle fatture XML non ancora associati con certezza a un cantiere.
                Puoi attribuirli, esportarli in Excel/PDF oppure cancellarli singolarmente o in blocco.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="text-right bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Totale Sospeso</span>
              <span className="text-xl font-black font-mono text-amber-400">
                {formatCurrency(totSospesi)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4 text-slate-950" />
                <span>+ Aggiungi Sospeso</span>
              </button>

              <button
                onClick={() => exportSospesiExcel(sospesi)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                title="Esporta foglio Excel della Scheda Sospesi"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                onClick={onPrintReport}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                title="Stampa report da sottoporre al cliente/capocantiere"
              >
                <Printer className="h-4 w-4" />
                <span>Report per Cliente (PDF)</span>
              </button>

              {/* Bottoni Cancellazione Tutti i Sospesi */}
              {sospesi.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsConfirmClearAllOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  title="Cancella tutte le voci registrate nei sospesi"
                >
                  <Trash2 className="h-4 w-4 text-rose-400" />
                  <span>Svuota Sospesi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Add Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateManual}
          className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-md space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Inserisci Nuova Voce o DDT da Chiarire nei Sospesi</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">DATA DOC.</label>
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">N° DOCUMENTO / DDT *</label>
              <input
                type="text"
                required
                placeholder="es. DDT 124/B"
                value={manualDoc}
                onChange={(e) => setManualDoc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">FORNITORE *</label>
              <input
                type="text"
                required
                placeholder="es. EDILIZIA S.P.A."
                value={manualSupplier}
                onChange={(e) => setManualSupplier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">IMPORTO (€) *</label>
              <input
                type="text"
                required
                placeholder="es. 340,50"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">CLIENTE</label>
              <input
                type="text"
                placeholder="es. Ditta Rossi / Committente"
                value={manualClient}
                onChange={(e) => setManualClient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">N./PROT (PROTOCOLLO)</label>
              <input
                type="text"
                placeholder="es. 142 o PROT-26/01"
                value={manualProtocol}
                onChange={(e) => setManualProtocol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">DESCRIZIONE MATERIALE / FORNITURA</label>
              <input
                type="text"
                placeholder="es. Fornitura pannelli isolanti e collante"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">NOTE PER IL CLIENTE (STAMPATA SUL REPORT)</label>
              <input
                type="text"
                placeholder="es. Chiedere conferma a quale cantiere appartiene"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-4 bg-indigo-950/20 border border-indigo-500/30 p-2.5 rounded-lg">
              <label className="block text-indigo-300 font-semibold mb-1 flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-indigo-400" />
                <span>NOTA INTERNA (SOLO A VIDEO - Non verrà stampata né esportata in Excel)</span>
              </label>
              <input
                type="text"
                placeholder="es. Da chiedere a Marco De Luca se l'ordine era per il cantiere Villa..."
                value={manualInternalNote}
                onChange={(e) => setManualInternalNote(e.target.value)}
                className="w-full bg-slate-950 border border-indigo-500/40 rounded px-2.5 py-1.5 text-indigo-100 placeholder-indigo-400/50 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {manualError && (
            <p className="text-xs text-rose-400 font-semibold">{manualError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-medium cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded font-bold transition-colors cursor-pointer"
            >
              Inserisci nei Sospesi
            </button>
          </div>
        </form>
      )}

      {/* Sospesi Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Search header & Selection counter */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Registro Materiali da Attribuire
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {filteredSospesi.length} voci trovate
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per fornitore, n° doc, descrizione..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Bulk Action Toolbar when items are selected */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
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
              {cantieri.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={bulkTargetCantiereId || cantieri[0]?.id}
                    onChange={(e) => setBulkTargetCantiereId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-400 max-w-xs"
                  >
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.client})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssignBulk}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Sposta tutte le voci selezionate nel cantiere scelto"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
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
                onClick={handleDeselectAll}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                title="Deseleziona tutto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b-2 border-slate-800 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                    title="Seleziona / Deseleziona tutti"
                  />
                </th>
                <th className="py-3 px-2.5 w-24">DATA DOC.</th>
                <th className="py-3 px-2.5 w-28">N° DOC.</th>
                <th className="py-3 px-3 w-48">TIPO DOC. / FORNITORE</th>
                <th className="py-3 px-3 w-32">CLIENTE</th>
                <th className="py-3 px-2.5 w-24">N./PROT</th>
                <th className="py-3 px-3 text-right w-24 text-rose-300">IMPORTO (€)</th>
                <th className="py-3 px-3.5 w-64 text-indigo-300 bg-indigo-950/20">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-indigo-400" />
                    <span>NOTA INTERNA (SOLO A VIDEO)</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 w-44">NOTE PER IL CLIENTE</th>
                <th className="py-3 px-3 w-64 text-center text-amber-400">ATTRIBUISCI A CANTIERE</th>
                <th className="py-3 px-2 text-right w-16">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredSospesi.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Nessuna voce sospesa!</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tutti i materiali e i DDT risultano correttamente assegnati ai cantieri di competenza.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSospesi.map((s) => {
                  const isEditingCustomerNote = editingId === s.id;
                  const isEditingInternalNote = editingInternalNoteId === s.id;
                  const currentTarget = selectedTargetByItem[s.id] || cantieri[0]?.id || '';
                  const isSelected = selectedIds.includes(s.id);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox per selezione multipla */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(s.id)}
                          className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                          title="Seleziona voce"
                        />
                      </td>

                      {/* DATA DOC. */}
                      <td className="py-3 px-2.5 font-mono text-slate-300 text-xs whitespace-nowrap">
                        {formatDateItalian(s.date)}
                      </td>

                      {/* N° DOC. (Numero fattura) */}
                      <td className="py-3 px-2.5 font-mono font-bold text-amber-300 whitespace-nowrap text-xs">
                        {s.docNumber}
                      </td>

                      {/* TIPO DOC. / FORNITORE */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white uppercase text-xs">
                          {s.supplier}
                        </div>
                        {s.ddtNumber && (
                          <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                            DDT: {s.ddtNumber} {s.ddtDate ? `(${formatDateItalian(s.ddtDate)})` : ''}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {s.description}
                        </div>
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-3 text-slate-300 text-xs font-medium">
                        {s.client || <span className="text-slate-600">-</span>}
                      </td>

                      {/* N./PROT (Protocollo contabile a mano) */}
                      <td className="py-3 px-2.5 font-mono text-slate-300 text-xs font-semibold whitespace-nowrap">
                        {s.protocol ? (
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">
                            {s.protocol}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* IMPORTO (€) */}
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-xs">
                        <span className={s.amount < 0 ? 'text-purple-300' : 'text-rose-300'}>
                          {s.amount < 0 && (
                            <span className="text-[10px] px-1 py-0.5 mr-1 rounded bg-purple-500/20 text-purple-300 font-sans font-bold border border-purple-500/30">
                              N.C.
                            </span>
                          )}
                          {formatCurrency(s.amount)}
                        </span>
                      </td>

                      {/* NOTA INTERNA (SOLO A VIDEO - Non stampata né esportata in Excel) */}
                      <td className="py-3 px-3.5 bg-indigo-950/10">
                        {isEditingInternalNote ? (
                          <div className="space-y-1.5 min-w-[220px]">
                            <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Lock className="h-3 w-3 text-indigo-400" />
                                <span>Nota interna a video</span>
                              </span>
                              <span className="text-[9px] text-indigo-400/80 font-normal">
                                Non stampata
                              </span>
                            </div>
                            <textarea
                              value={editInternalNote}
                              onChange={(e) => setEditInternalNote(e.target.value)}
                              rows={2}
                              className="w-full bg-slate-950 border border-indigo-400/80 rounded p-1.5 text-xs text-white focus:outline-none shadow-inner"
                              placeholder="Cose da chiedere al cliente per risolvere il sospeso..."
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEditInternalNote(s)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Salva nota interna"
                              >
                                <Save className="h-3 w-3" />
                                <span>Salva</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInternalNoteId(null)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer transition-colors"
                                title="Annulla"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditInternalNote(s)}
                            className="cursor-pointer group flex items-start justify-between gap-1.5 p-1 rounded hover:bg-indigo-950/40 transition-colors"
                            title="Clicca per inserire o modificare la nota interna (rimane solo a video)"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[9px] uppercase font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30 flex items-center gap-1 shrink-0">
                                  <Lock className="h-2.5 w-2.5 text-indigo-400" />
                                  <span>Solo a video</span>
                                </span>
                              </div>
                              <p className={`text-xs ${s.internalNote ? 'text-indigo-100 font-medium' : 'text-slate-500 italic'}`}>
                                {s.internalNote || 'Scrivi cosa chiedere al cliente...'}
                              </p>
                            </div>
                            <Edit2 className="h-3 w-3 text-indigo-400/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                          </div>
                        )}
                      </td>

                      {/* NOTE PER IL CLIENTE (STAMPATE SUL REPORT PDF) */}
                      <td className="py-3 px-3.5">
                        {isEditingCustomerNote ? (
                          <div className="flex items-center gap-1.5 min-w-[160px]">
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full bg-slate-950 border border-amber-400 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              placeholder="Nota per il cliente..."
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(s)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer shrink-0"
                              title="Salva nota cliente"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-slate-800 text-slate-400 rounded cursor-pointer shrink-0"
                              title="Annulla"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(s)}
                            className="cursor-pointer group flex items-center justify-between gap-1 p-1 rounded hover:bg-slate-800/60 transition-colors"
                            title="Clicca per modificare la nota cliente (stampata nel PDF)"
                          >
                            <span className="text-xs text-amber-300/90 group-hover:underline truncate max-w-[150px]">
                              {s.customerNote || 'Aggiungi nota cliente...'}
                            </span>
                            <Edit2 className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* 1-Click Move to Cantiere */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={currentTarget}
                            onChange={(e) => {
                              setSelectedTargetByItem({
                                ...selectedTargetByItem,
                                [s.id]: e.target.value,
                              });
                            }}
                            className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-amber-400 max-w-[180px]"
                          >
                            {cantieri.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.client})
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleExecuteAssign(s.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                            title="Sposta definitivamente questo movimento nella Scheda Cantiere"
                          >
                            <span>Sposta</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Azioni: Bottone Cancella Singola Voce */}
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSospesoToDelete(s)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-600/90 rounded-lg transition-colors cursor-pointer"
                          title="Elimina questa voce dalla Scheda Sospesi"
                        >
                          <Trash2 className="h-4 w-4 text-rose-400 hover:text-white transition-colors" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              I movimenti nei Sospesi non incidono ancora sui costi dei cantieri fino a quando non vengono attribuiti.
            </span>
          </div>
          <div className="flex items-center gap-4">
            {sospesi.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(true)}
                className="text-rose-400 hover:text-rose-300 font-medium underline text-xs cursor-pointer"
              >
                Cancella tutti i {sospesi.length} sospesi
              </button>
            )}
            <span className="font-semibold text-slate-300">
              Importo totale sospeso:{' '}
              <strong className="text-amber-400 font-mono text-sm">{formatCurrency(totSospesi)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Modal 1: Confirmation for Single Sospeso Deletion */}
      <ConfirmModal
        isOpen={!!sospesoToDelete}
        title="Elimina Voce Sospesa"
        message={
          sospesoToDelete ? (
            <div className="space-y-2">
              <p>Eliminare definitivamente questa registrazione dalla Scheda Sospesi?</p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
                <div>
                  <span className="text-slate-400">Data:</span> {formatDateItalian(sospesoToDelete.date)} •{' '}
                  <span className="text-slate-400">Doc:</span> {sospesoToDelete.docNumber}
                </div>
                <div className="text-white font-sans font-semibold">
                  {sospesoToDelete.supplier} - {sospesoToDelete.description}
                </div>
                <div className="text-amber-400 font-bold">
                  Importo: {formatCurrency(sospesoToDelete.amount)}
                </div>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText="Elimina Voce"
        cancelText="Annulla"
        onConfirm={handleConfirmDeleteSingle}
        onCancel={() => setSospesoToDelete(null)}
      />

      {/* Modal 2: Confirmation for Multiple Sospesi Deletion */}
      <ConfirmModal
        isOpen={isConfirmDeleteSelectedOpen}
        title={`Elimina ${selectedIds.length} Voci Sospese`}
        message={
          <div className="space-y-2">
            <p>
              Sei sicuro di voler eliminare definitivamente le{' '}
              <strong className="text-white">{selectedIds.length} voci sospese selezionate</strong>?
            </p>
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
              <div className="text-rose-200">
                Numero di registrazioni selezionate: <strong>{selectedIds.length}</strong>
              </div>
              <div className="text-rose-300 font-bold font-mono">
                Totale importo da eliminare: {formatCurrency(selectedAmount)}
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Questa azione non potrà essere annullata.
            </p>
          </div>
        }
        confirmText={`Elimina ${selectedIds.length} Voci`}
        cancelText="Annulla"
        onConfirm={handleConfirmDeleteSelected}
        onCancel={() => setIsConfirmDeleteSelectedOpen(false)}
      />

      {/* Modal 3: Confirmation for Clearing ALL Sospesi */}
      <ConfirmModal
        isOpen={isConfirmClearAllOpen}
        title="Cancella Tutti i Sospesi"
        message={
          <div className="space-y-2">
            <p>
              Sei sicuro di voler cancellare <strong className="text-rose-400">TUTTE</strong> le registrazioni della Scheda Sospesi?
            </p>
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
              <div className="text-rose-200">
                Voci totali da eliminare: <strong>{sospesi.length}</strong>
              </div>
              <div className="text-rose-300 font-bold font-mono text-sm">
                Importo totale azzerato: {formatCurrency(totSospesi)}
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Verranno rimosse tutte le voci in sospeso dell'artigiano corrente.
            </p>
          </div>
        }
        confirmText="Cancella Tutti i Sospesi"
        cancelText="Annulla"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setIsConfirmClearAllOpen(false)}
      />
    </div>
  );
};
