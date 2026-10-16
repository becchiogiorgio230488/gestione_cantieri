import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  FileUp,
  Receipt,
  Sparkles,
  ChevronDown,
  Building,
  Calendar,
  MapPin,
  TrendingUp,
  AlertCircle,
  Coins,
  CheckCircle,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { Cantiere, Movement, SospesoItem } from '../types';
import { calculateCantiereTotals, formatCurrency, formatDateItalian, getTodayISODate } from '../utils/calculations';
import { exportSingleCantiereExcel } from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';
import { findLinkedInvoiceMovementsAcrossCantieri } from '../utils/invoiceDuplicateHelper';

interface SchedaCantiereViewProps {
  cantiere: Cantiere;
  allCantieri: Cantiere[];
  sospesi?: SospesoItem[];
  artigianoName?: string;
  onBack: () => void;
  onSelectCantiere: (id: string) => void;
  onUpdateCantiere: (updated: Cantiere) => void;
  onDeleteMovementFromAllCantieri?: (
    cantiereId: string,
    movement: Movement,
    linkedCantiereIds: string[],
    linkedSospesiIds: string[]
  ) => void;
  onDeleteCantiere?: (cantiereId: string) => void;
  onOpenXmlImport: () => void;
  onOpenFatturaEmessa: () => void;
  onPrint: () => void;
}

export const SchedaCantiereView: React.FC<SchedaCantiereViewProps> = ({
  cantiere,
  allCantieri,
  sospesi = [],
  artigianoName,
  onBack,
  onSelectCantiere,
  onUpdateCantiere,
  onDeleteMovementFromAllCantieri,
  onDeleteCantiere,
  onOpenXmlImport,
  onOpenFatturaEmessa,
  onPrint,
}) => {
  const totals = calculateCantiereTotals(cantiere);
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [linkedInvoiceToDelete, setLinkedInvoiceToDelete] = useState<{
    movement: Movement;
    linkedInfo: ReturnType<typeof findLinkedInvoiceMovementsAcrossCantieri>;
  } | null>(null);
  const [isConfirmDeleteCantiereOpen, setIsConfirmDeleteCantiereOpen] = useState(false);
  const [newMovementError, setNewMovementError] = useState<string | null>(null);

  // Quick edit state for Header fields (Initial Inventory RI & Final Inventory RF)
  const [isEditingRI, setIsEditingRI] = useState(false);
  const [riValue, setRiValue] = useState<string>(cantiere.initialInventory.toString());

  const [isEditingRF, setIsEditingRF] = useState(false);
  const [rfValue, setRfValue] = useState<string>((cantiere.finalInventory || 0).toString());

  // Quick edit state for Cantiere Name
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState<string>(cantiere.name || '');

  // Quick edit state for Address and City
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressValue, setAddressValue] = useState<string>(cantiere.address || '');
  const [cityValue, setCityValue] = useState<string>(cantiere.city || '');

  // Search filter for movements
  const [movSearch, setMovSearch] = useState('');

  // Quick inline add movement state
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [newMovementType, setNewMovementType] = useState<'acquisto' | 'emessa'>('acquisto');
  const [newMovement, setNewMovement] = useState<Partial<Movement>>({
    date: getTodayISODate(),
    docNumber: '',
    typeAndSubject: '',
    protocol: '',
    purchases: 0,
    issued: 0,
    notes: '',
  });

  // Editing existing movement
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [editMovementData, setEditMovementData] = useState<Movement | null>(null);

  const handleSaveRI = () => {
    const parsed = parseFloat(riValue.replace(',', '.')) || 0;
    onUpdateCantiere({
      ...cantiere,
      initialInventory: Math.round(parsed * 100) / 100,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingRI(false);
  };

  const handleSaveRF = () => {
    const parsed = parseFloat(rfValue.replace(',', '.')) || 0;
    onUpdateCantiere({
      ...cantiere,
      finalInventory: Math.round(parsed * 100) / 100,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingRF(false);
  };

  const handleSaveAddress = () => {
    onUpdateCantiere({
      ...cantiere,
      address: addressValue.trim() ? addressValue.trim().toUpperCase() : undefined,
      city: (cityValue.trim() || cantiere.city).toUpperCase(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditingAddress(false);
  };

  const handleSaveName = () => {
    const upperName = (nameValue.trim() || cantiere.name).toUpperCase();
    onUpdateCantiere({
      ...cantiere,
      name: upperName,
      client: upperName, // Nome cantiere e committente coincidono sempre
      updatedAt: new Date().toISOString(),
    });
    setIsEditingName(false);
  };

  useEffect(() => {
    setNameValue(cantiere.name || '');
    setAddressValue(cantiere.address || '');
    setCityValue(cantiere.city || '');
    setRiValue(cantiere.initialInventory.toString());
    setRfValue((cantiere.finalInventory || 0).toString());
  }, [cantiere]);

  const handleStartAddMovement = (type: 'acquisto' | 'emessa') => {
    setNewMovementType(type);
    setNewMovement({
      date: getTodayISODate(),
      docNumber: type === 'acquisto' ? 'Fatt. Acq. ' : '2/00',
      typeAndSubject: type === 'emessa' ? 'EMESSE' : '',
      protocol:
        type === 'emessa'
          ? '2/00'
          : `PROT-${new Date().getFullYear().toString().slice(-2)}-${String(cantiere.movements.length + 1).padStart(3, '0')}`,
      purchases: 0,
      issued: 0,
      notes: '',
    });
    setIsAddingMovement(true);
  };

  const handleSaveNewMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const rawType = (newMovement.typeAndSubject || '').trim();
    const finalTypeAndSubject =
      newMovementType === 'emessa'
        ? (rawType || 'EMESSE')
        : rawType;

    if (!newMovement.docNumber || !finalTypeAndSubject) {
      setNewMovementError('Inserisci il N° Documento prima di salvare.');
      return;
    }
    setNewMovementError(null);

    const rawProt = (newMovement.protocol || '').trim();
    const rawDoc = (newMovement.docNumber || '').trim();
    const finalProtocol =
      newMovementType === 'emessa'
        ? (rawProt || rawDoc)
        : rawProt;

    const movement: Movement = {
      id: `mov-${Date.now()}`,
      date: newMovement.date || getTodayISODate(),
      docNumber: newMovement.docNumber.trim(),
      typeAndSubject: finalTypeAndSubject,
      protocol: finalProtocol,
      purchases: newMovementType === 'acquisto' ? Number(newMovement.purchases) || 0 : 0,
      issued: newMovementType === 'emessa' ? Number(newMovement.issued) || 0 : 0,
      notes: newMovement.notes || '',
      source: 'manuale',
    };

    onUpdateCantiere({
      ...cantiere,
      movements: [...cantiere.movements, movement],
      updatedAt: new Date().toISOString(),
    });

    setIsAddingMovement(false);
  };

  const handleDeleteMovement = (mov: Movement) => {
    const linkedInfo = findLinkedInvoiceMovementsAcrossCantieri(
      mov,
      cantiere.id,
      allCantieri,
      sospesi
    );

    if (linkedInfo.isLinkedToMultiple) {
      setLinkedInvoiceToDelete({
        movement: mov,
        linkedInfo,
      });
    } else {
      setMovementToDelete(mov);
    }
  };

  const handleStartEditMovement = (mov: Movement) => {
    setEditingMovementId(mov.id);
    setEditMovementData({ ...mov });
  };

  const handleSaveEditMovement = () => {
    if (!editMovementData) return;
    onUpdateCantiere({
      ...cantiere,
      movements: cantiere.movements.map((m) => (m.id === editMovementData.id ? editMovementData : m)),
      updatedAt: new Date().toISOString(),
    });
    setEditingMovementId(null);
    setEditMovementData(null);
  };

  const filteredMovements = cantiere.movements.filter((m) => {
    if (!movSearch) return true;
    const q = movSearch.toLowerCase();
    return (
      m.docNumber.toLowerCase().includes(q) ||
      m.typeAndSubject.toLowerCase().includes(q) ||
      m.protocol.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Navigation & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>← Torna al Prospetto {artigianoName ? `(${artigianoName})` : 'Generale'}</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
            LIVELLO 3 • SCHEDA CANTIERE
          </span>

          {/* Quick Switch Dropdown */}
          <div className="relative">
            <select
              value={cantiere.id}
              onChange={(e) => onSelectCantiere(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium focus:outline-none focus:border-amber-400 appearance-none cursor-pointer"
            >
              {allCantieri.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.client})
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleStartAddMovement('acquisto')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Acquisto / Costo</span>
          </button>

          <button
            onClick={() => handleStartAddMovement('emessa')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Fattura Emessa</span>
          </button>

          <button
            onClick={() => {
              setNameValue(cantiere.name.toUpperCase());
              setIsEditingName(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Modifica nome cantiere"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Modifica Nome Cantiere</span>
          </button>

          <button
            onClick={() => {
              setAddressValue(cantiere.address || '');
              setCityValue(cantiere.city || '');
              setIsEditingAddress(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Modifica indirizzo cantiere"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Modifica Indirizzo</span>
          </button>

          <button
            onClick={onOpenXmlImport}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            title="Importa file XML fattura elettronica fornitore"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>Importa XML</span>
          </button>

          <button
            onClick={() => exportSingleCantiereExcel(cantiere, artigianoName)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Scarica file XLS (.xlsx) formattato del singolo cantiere con formule dei totali"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Scarica XLS Cantiere</span>
          </button>

          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Stampa scheda cantiere o salva in PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stampa / PDF</span>
          </button>

          {onDeleteCantiere && (
            <button
              onClick={() => setIsConfirmDeleteCantiereOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title={`Elimina cantiere ${cantiere.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Elimina Cantiere</span>
            </button>
          )}
        </div>
      </div>

      {/* Z CANTIERI 2026 HEADER (Original Layout Structure) */}
      <div className="bg-slate-900 border-2 border-amber-500/30 rounded-xl overflow-hidden shadow-lg">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-slate-950" />
            <span className="font-black text-sm tracking-wide uppercase">
              MODELLO Z CANTIERI 2026 • SCHEDA CANTIERE UFFICIALE
            </span>
          </div>
        </div>

        {/* Key Header Fields (As defined in Z CANTIERI modulo 2026.xls + Address and RF) */}
        <div className="p-5 space-y-4 bg-slate-900 text-xs sm:text-sm">
          {/* Row 1: 3 balanced cards (Nome Cantiere, Città & Indirizzo modificabile, Esercizio & Stato) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Campo 1: CANTIERE (MODIFICABILE - SEMPRE IN MAIUSCOLO) */}
            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Nome Cantiere
                </span>
                {!isEditingName && (
                  <button
                    onClick={() => {
                      setNameValue(cantiere.name.toUpperCase());
                      setIsEditingName(true);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    title="Modifica nome cantiere"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Modifica</span>
                  </button>
                )}
              </div>

              {isEditingName ? (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Nome Cantiere (Cognome Nome in Maiuscolo)
                    </label>
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value.toUpperCase())}
                      placeholder="es. ROSSI MARIO"
                      className="w-full bg-slate-900 border border-amber-400 rounded px-2.5 py-1 text-white text-xs font-bold uppercase focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveName();
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleSaveName}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Salva Nome</span>
                    </button>
                    <button
                      onClick={() => {
                        setNameValue(cantiere.name.toUpperCase());
                        setIsEditingName(false);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Annulla</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-extrabold text-base text-white uppercase">{cantiere.name.toUpperCase()}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Coincide sempre con il cliente / committente
                  </p>
                  {cantiere.notes && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{cantiere.notes}</p>
                  )}
                </>
              )}
            </div>

            {/* Campo 2: CITTÀ & INDIRIZZO (MODIFICABILE - SEMPRE IN MAIUSCOLO) */}
            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Città &amp; Indirizzo
                </span>
                {!isEditingAddress && (
                  <button
                    onClick={() => {
                      setAddressValue((cantiere.address || '').toUpperCase());
                      setCityValue(cantiere.city.toUpperCase());
                      setIsEditingAddress(true);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    title="Modifica indirizzo cantiere"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Modifica</span>
                  </button>
                )}
              </div>

              {isEditingAddress ? (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Indirizzo (Via e Civico in Maiuscolo)
                    </label>
                    <input
                      type="text"
                      value={addressValue}
                      onChange={(e) => setAddressValue(e.target.value.toUpperCase())}
                      placeholder="es. VIA GARIBALDI 42"
                      className="w-full bg-slate-900 border border-amber-400 rounded px-2.5 py-1 text-white text-xs font-bold uppercase focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Città (in Maiuscolo)
                    </label>
                    <input
                      type="text"
                      value={cityValue}
                      onChange={(e) => setCityValue(e.target.value.toUpperCase())}
                      placeholder="es. MONZA"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs font-bold uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleSaveAddress}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Salva Indirizzo</span>
                    </button>
                    <button
                      onClick={() => {
                        setAddressValue((cantiere.address || '').toUpperCase());
                        setCityValue(cantiere.city.toUpperCase());
                        setIsEditingAddress(false);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Annulla</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-bold text-base text-slate-100 flex items-center gap-1.5 uppercase">
                    <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{cantiere.city.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 font-semibold uppercase">
                    {cantiere.address ? cantiere.address.toUpperCase() : <span className="text-slate-500 italic normal-case">Indirizzo non specificato (clicca Modifica)</span>}
                  </div>
                </>
              )}
            </div>

            {/* Campo 3: ESERCIZIO & STATO (Nome Cantiere e Committente coincidono) */}
            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
              <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                Esercizio &amp; Stato
              </span>
              <div className="font-extrabold text-base text-slate-100">
                Anno Fiscale {cantiere.year}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-1 font-mono">
                <span className="text-slate-400">Stato cantiere:</span>
                <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase">
                  {cantiere.status}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Rimanenze Iniziali e Finali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campo 4: RIMANENZE INIZIALI (RI) */}
            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Rimanenze Iniziali (R.I.)
                </span>
                {!isEditingRI && (
                  <button
                    onClick={() => setIsEditingRI(true)}
                    className="text-[11px] text-slate-400 hover:text-amber-400 underline cursor-pointer"
                  >
                    Modifica R.I.
                  </button>
                )}
              </div>

              {isEditingRI ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={riValue}
                    onChange={(e) => setRiValue(e.target.value)}
                    className="w-28 px-2 py-1 bg-slate-900 border border-amber-400 text-white rounded font-mono text-sm focus:outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRI}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                    title="Salva RI"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setRiValue(cantiere.initialInventory.toString());
                      setIsEditingRI(false);
                    }}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                    title="Annulla"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="font-extrabold text-lg font-mono text-white">
                  {formatCurrency(cantiere.initialInventory)}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-0.5">
                Materiali o rimanenze caricate all'avvio del cantiere
              </p>
            </div>

            {/* Campo 5: RIMANENZE FINALI (RF) */}
            <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Rimanenze Finali (R.F.)
                </span>
                {!isEditingRF && (
                  <button
                    onClick={() => setIsEditingRF(true)}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                  >
                    Modifica R.F.
                  </button>
                )}
              </div>

              {isEditingRF ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={rfValue}
                    onChange={(e) => setRfValue(e.target.value)}
                    className="w-28 px-2 py-1 bg-slate-900 border border-emerald-400 text-white rounded font-mono text-sm focus:outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRF}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                    title="Salva RF"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setRfValue((cantiere.finalInventory || 0).toString());
                      setIsEditingRF(false);
                    }}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                    title="Annulla"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="font-extrabold text-lg font-mono text-white">
                  {formatCurrency(cantiere.finalInventory)}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-0.5">
                Materiali a terra o rimanenze a fine cantiere
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Movement Inline Form */}
      {isAddingMovement && (
        <form
          onSubmit={handleSaveNewMovement}
          className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-md space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-400" />
              <span>
                Nuovo Movimento Contabile:{' '}
                <strong className={newMovementType === 'acquisto' ? 'text-rose-400' : 'text-blue-400'}>
                  {newMovementType === 'acquisto' ? 'ACQUISTO / COSTO' : 'FATTURA EMESSA'}
                </strong>
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
                placeholder={newMovementType === 'emessa' ? 'es. 2/00' : 'es. FT-2026/012 o DDT 45'}
                value={newMovement.docNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (newMovementType === 'emessa') {
                    setNewMovement({
                      ...newMovement,
                      docNumber: val,
                      protocol: val, // il protocollo è sempre uguale al numero di fattura
                    });
                  } else {
                    setNewMovement({ ...newMovement, docNumber: val });
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                <span>{newMovementType === 'emessa' ? 'DESCRIZIONE MOVIMENTO' : 'TIPO DOC. / FORNITORE / CLIENTE'}</span>
                {newMovementType === 'emessa' && (
                  <span className="text-[10px] text-emerald-400 font-bold">Standard: EMESSE</span>
                )}
              </label>
              <input
                type="text"
                required
                placeholder={newMovementType === 'emessa' ? 'EMESSE' : 'es. Sonepar SpA - Cavi e magnetotermici'}
                value={newMovement.typeAndSubject}
                onChange={(e) => setNewMovement({ ...newMovement, typeAndSubject: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {newMovementType === 'emessa' ? 'N./PROT (= N° FATT.)' : 'N./PROT'}
              </label>
              <input
                type="text"
                placeholder={newMovementType === 'emessa' ? 'es. 2/00' : 'es. PROT-26-015'}
                value={newMovement.protocol}
                onChange={(e) => setNewMovement({ ...newMovement, protocol: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {newMovementType === 'acquisto' ? 'IMPORTO ACQUISTI (€)' : 'IMPORTO EMESSE (€)'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={newMovementType === 'acquisto' ? newMovement.purchases : newMovement.issued}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (newMovementType === 'acquisto') {
                    setNewMovement({ ...newMovement, purchases: val });
                  } else {
                    setNewMovement({ ...newMovement, issued: val });
                  }
                }}
                className={`w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-amber-400 ${
                  newMovementType === 'acquisto' ? 'text-rose-300' : 'text-blue-300'
                }`}
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
              Registra Movimento
            </button>
          </div>
        </form>
      )}

      {/* Movements Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Search & Count Header */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Registro Movimenti di Cantiere
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
              {cantiere.movements.length} righe
            </span>
          </div>

          <input
            type="text"
            placeholder="Filtra movimenti per n° doc, fornitore..."
            value={movSearch}
            onChange={(e) => setMovSearch(e.target.value)}
            className="w-full sm:w-64 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* The Movements Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b-2 border-slate-800 uppercase tracking-wider text-[11px] font-extrabold">
                <th className="py-3 px-3.5 w-28">DATA DOC.</th>
                <th className="py-3 px-3.5 w-32">N° DOC.</th>
                <th className="py-3 px-4">TIPO DOC. / FORNITORE / CLIENTE</th>
                <th className="py-3 px-3 w-28">N./PROT</th>
                <th className="py-3 px-4 text-right w-32 text-rose-400">ACQUISTI (€)</th>
                <th className="py-3 px-4 text-right w-32 text-blue-400">EMESSE (€)</th>
                <th className="py-3 px-3 text-right w-20">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Nessun movimento registrato. Inserisci un acquisto o una fattura emessa.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isEditing = editingMovementId === m.id;

                  if (isEditing && editMovementData) {
                    return (
                      <tr key={m.id} className="bg-slate-800/80">
                        <td className="p-2">
                          <input
                            type="date"
                            value={editMovementData.date}
                            onChange={(e) =>
                              setEditMovementData({ ...editMovementData, date: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editMovementData.docNumber}
                            onChange={(e) =>
                              setEditMovementData({ ...editMovementData, docNumber: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editMovementData.typeAndSubject}
                            onChange={(e) =>
                              setEditMovementData({
                                ...editMovementData,
                                typeAndSubject: e.target.value,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editMovementData.protocol}
                            onChange={(e) =>
                              setEditMovementData({ ...editMovementData, protocol: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editMovementData.purchases}
                            onChange={(e) =>
                              setEditMovementData({
                                ...editMovementData,
                                purchases: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right font-mono text-rose-300"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editMovementData.issued}
                            onChange={(e) =>
                              setEditMovementData({
                                ...editMovementData,
                                issued: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right font-mono text-blue-300"
                          />
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <button
                            onClick={handleSaveEditMovement}
                            className="p-1 text-emerald-400 hover:text-emerald-300 mr-1"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingMovementId(null)}
                            className="p-1 text-slate-400 hover:text-slate-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* DATA DOC. */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-300 text-xs">
                        {formatDateItalian(m.date)}
                      </td>

                      {/* N° DOC. */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-white">
                        {m.docNumber}
                        {m.source === 'xml' && (
                          <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            XML
                          </span>
                        )}
                        {m.source === 'fattura_emessa' && (
                          <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            EMESSA
                          </span>
                        )}
                      </td>

                      {/* TIPO DOC. / FORNITORE / CLIENTE */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{m.typeAndSubject}</div>
                        {m.notes && <div className="text-xs text-slate-400 mt-0.5">{m.notes}</div>}
                      </td>

                      {/* N./PROT */}
                      <td className="py-3 px-3 font-mono text-slate-400 text-xs">{m.protocol || '-'}</td>

                      {/* ACQUISTI */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-rose-300">
                        {m.purchases !== 0 ? formatCurrency(m.purchases) : '-'}
                      </td>

                      {/* EMESSE */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${m.issued < 0 ? 'text-purple-300' : 'text-blue-300'}`}>
                        {m.issued !== 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {m.issued < 0 && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 font-sans font-bold border border-purple-500/30">
                                N.C.
                              </span>
                            )}
                            <span>{formatCurrency(m.issued)}</span>
                          </div>
                        ) : '-'}
                      </td>

                      {/* AZIONI */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEditMovement(m)}
                            className="p-1 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                            title="Modifica riga"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMovement(m)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            title="Elimina riga"
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

        {/* ORIGINAL TOTALS SECTION AT BOTTOM (Modulo Z-2026) */}
        <div className="bg-slate-950 border-t-2 border-slate-700 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
            Riepilogo Totali di Chiusura Cantiere (Z-Cantieri Modulo 2026)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            {/* Blocco 1: Totale senza RI */}
            <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[11px]">
                <span>1. Totale Senza R.I.</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Acquisti registrati:</span>
                <span className="font-mono text-rose-300">{formatCurrency(totals.totaleAcquisti)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Fatturato emesso:</span>
                <span className="font-mono text-blue-300">{formatCurrency(totals.totaleEmesse)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-white text-xs">Margine grezzo:</span>
                <span className="font-mono font-bold text-slate-100">
                  {formatCurrency(totals.margineSenzaRI)}
                </span>
              </div>
            </div>

            {/* Blocco 2: Totale comprensivo di RI & RF */}
            <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[11px]">
                <span>2. Comprensivo di R.I. &amp; R.F.</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Costi con R.I. (+ {formatCurrency(totals.initialInventory)}):</span>
                <span className="font-mono text-rose-300">
                  {formatCurrency(totals.totaleAcquistiConRI)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Rimanenze Finali R.F.:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  + {formatCurrency(totals.finalInventory)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-white text-xs">Utile Netto Effettivo:</span>
                <span
                  className={`font-mono font-extrabold ${
                    totals.isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(totals.margineEffettivo)}
                </span>
              </div>
            </div>

            {/* Blocco 3: Margine / Utile di cantiere & Redditività */}
            <div
              className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                totals.isPositive
                  ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/40'
                  : 'bg-gradient-to-br from-rose-950/40 to-slate-900 border-rose-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-300">
                  <span>Margine / Utile di Cantiere</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      totals.isPositive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {totals.isPositive ? 'IN UTILE' : 'IN PERDITA'}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-white">
                  {formatCurrency(totals.margineEffettivo)}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Margine % sul lavoro:</span>
                <span
                  className={`text-sm font-black font-mono ${
                    totals.marginePercentuale >= 25
                      ? 'text-emerald-400'
                      : totals.marginePercentuale >= 10
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {totals.marginePercentuale}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Movement Deletion */}
      <ConfirmModal
        isOpen={!!movementToDelete}
        title="Elimina Movimento Contabile"
        message={
          movementToDelete ? (
            <div className="space-y-2">
              <p>
                Eliminare definitivamente la seguente riga dalla scheda cantiere?
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
                <div>
                  <span className="text-slate-400">Data:</span> {formatDateItalian(movementToDelete.date)} •{' '}
                  <span className="text-slate-400">Doc:</span> {movementToDelete.docNumber}
                </div>
                <div className="text-white font-sans font-semibold">
                  {movementToDelete.typeAndSubject}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {movementToDelete.purchases !== 0 && (
                    <span className="text-rose-400 font-bold">
                      Costo Acquisto: {formatCurrency(movementToDelete.purchases)}
                    </span>
                  )}
                  {movementToDelete.issued !== 0 && (
                    <span className={movementToDelete.issued < 0 ? 'text-purple-400 font-bold' : 'text-blue-400 font-bold'}>
                      {movementToDelete.issued < 0 ? 'Nota di Credito Emessa: ' : 'Fattura Emessa: '}
                      {formatCurrency(movementToDelete.issued)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText="Elimina Riga"
        cancelText="Annulla"
        onConfirm={() => {
          if (movementToDelete) {
            onUpdateCantiere({
              ...cantiere,
              movements: cantiere.movements.filter((m) => m.id !== movementToDelete.id),
              updatedAt: new Date().toISOString(),
            });
            setMovementToDelete(null);
          }
        }}
        onCancel={() => setMovementToDelete(null)}
      />

      {/* Modal for Deleting Invoice Linked to Multiple Cantieri or Sospesi */}
      {linkedInvoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl text-left space-y-4 animate-scaleIn">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Fattura presente in più cantieri o schede
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  La fattura <strong className="text-amber-300 font-mono">N° {linkedInvoiceToDelete.linkedInfo.invoiceNum || linkedInvoiceToDelete.movement.docNumber}</strong>{' '}
                  {linkedInvoiceToDelete.linkedInfo.supplierOrClient && (
                    <span>({linkedInvoiceToDelete.linkedInfo.supplierOrClient}) </span>
                  )}
                  risulta inserita sia in questo cantiere sia in altri cantieri (o nei sospesi):
                </p>
              </div>
            </div>

            {/* List of occurrences */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Presenza registrata nel gestionale:
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 max-h-56 overflow-y-auto">
                {/* Current cantiere */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-amber-500/30 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white flex items-center gap-1.5 truncate">
                      <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>{cantiere.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        Cantiere Attuale
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      Doc: {linkedInvoiceToDelete.movement.docNumber} • Data: {formatDateItalian(linkedInvoiceToDelete.movement.date)}
                    </div>
                  </div>
                  <div className={`font-mono font-bold whitespace-nowrap ${
                    linkedInvoiceToDelete.movement.issued < 0
                      ? 'text-purple-300'
                      : linkedInvoiceToDelete.movement.purchases !== 0
                      ? 'text-rose-300'
                      : 'text-blue-300'
                  }`}>
                    {linkedInvoiceToDelete.movement.purchases !== 0
                      ? formatCurrency(linkedInvoiceToDelete.movement.purchases)
                      : formatCurrency(linkedInvoiceToDelete.movement.issued)}
                  </div>
                </div>

                {/* Other cantieri */}
                {linkedInvoiceToDelete.linkedInfo.otherCantieriMatches.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
                        <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{m.cantiereName}</span>
                        {m.client && <span className="text-[11px] text-slate-400 font-normal">({m.client})</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        Doc: {m.movement.docNumber} • Data: {formatDateItalian(m.movement.date)}
                      </div>
                    </div>
                    <div className={`font-mono font-bold whitespace-nowrap ${
                      m.movement.issued < 0 ? 'text-purple-300' : 'text-slate-300'
                    }`}>
                      {m.movement.purchases !== 0
                        ? formatCurrency(m.movement.purchases)
                        : formatCurrency(m.movement.issued)}
                    </div>
                  </div>
                ))}

                {/* Sospesi */}
                {linkedInvoiceToDelete.linkedInfo.sospesiMatches.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5 truncate">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span>Scheda Sospesi</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        Doc: {s.docNumber} • {s.description}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-amber-300 whitespace-nowrap">
                      {formatCurrency(s.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-200">
              Come desideri procedere con l'eliminazione?
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setLinkedInvoiceToDelete(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors text-center"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateCantiere({
                    ...cantiere,
                    movements: cantiere.movements.filter((m) => m.id !== linkedInvoiceToDelete.movement.id),
                    updatedAt: new Date().toISOString(),
                  });
                  setLinkedInvoiceToDelete(null);
                }}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors text-center"
              >
                Cancella solo da questo cantiere
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteMovementFromAllCantieri) {
                    const linkedCantiereIds = linkedInvoiceToDelete.linkedInfo.otherCantieriMatches.map((m) => m.cantiereId);
                    const linkedSospesiIds = linkedInvoiceToDelete.linkedInfo.sospesiMatches.map((s) => s.id);
                    onDeleteMovementFromAllCantieri(
                      cantiere.id,
                      linkedInvoiceToDelete.movement,
                      linkedCantiereIds,
                      linkedSospesiIds
                    );
                  } else {
                    onUpdateCantiere({
                      ...cantiere,
                      movements: cantiere.movements.filter((m) => m.id !== linkedInvoiceToDelete.movement.id),
                      updatedAt: new Date().toISOString(),
                    });
                  }
                  setLinkedInvoiceToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>Cancella da TUTTI i cantieri (e sospesi)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cantiere Deletion (from Scheda Cantiere) */}
      {onDeleteCantiere && (
        <ConfirmModal
          isOpen={isConfirmDeleteCantiereOpen}
          title="Elimina Scheda Cantiere"
          message={
            <div className="space-y-2">
              <p>
                Sei sicuro di voler eliminare definitivamente il cantiere{' '}
                <strong className="text-white font-bold">"{cantiere.name}"</strong>?
              </p>
              <p className="text-xs text-slate-400">
                Committente: {cantiere.client} • Città: {cantiere.city}
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                Verranno eliminati tutti i{' '}
                <strong className="underline">{cantiere.movements.length} movimenti contabili</strong>{' '}
                e verrai reindirizzato al Prospetto Generale.
              </div>
            </div>
          }
          confirmText="Elimina Cantiere"
          cancelText="Annulla"
          onConfirm={() => {
            setIsConfirmDeleteCantiereOpen(false);
            onDeleteCantiere(cantiere.id);
          }}
          onCancel={() => setIsConfirmDeleteCantiereOpen(false)}
        />
      )}
    </div>
  );
};
