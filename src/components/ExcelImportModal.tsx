import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  Database,
  FileText,
  Clock,
  Info,
  Check,
  RefreshCw,
  FolderPlus,
  Trash2,
  Hash,
  MapPin,
  User,
} from 'lucide-react';
import { Artigiano, Cantiere, Movement, SospesoItem } from '../types';
import {
  ExcelImportType,
  ExcelParseResult,
  ParsedSingolaSchedaData,
  ParsedSospesiData,
  ParsedProspettoGeneraleData,
  parseUploadedExcel,
} from '../utils/excelImportParser';
import { formatCurrency, formatDateItalian } from '../utils/calculations';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artigiani: Artigiano[];
  currentArtigianoId?: string | null;
  currentCantiereId?: string | null;
  onCommitSingolaScheda: (params: {
    targetArtigianoId: string;
    cantiereData: {
      id?: string;
      name: string;
      city: string;
      address: string;
      client: string;
      year: number;
      initialInventory: number;
    };
    movements: Movement[];
    isNewCantiere: boolean;
  }) => Promise<void> | void;
  onCommitSospesi: (params: {
    targetArtigianoId: string;
    items: SospesoItem[];
  }) => Promise<void> | void;
  onCommitProspettoGenerale: (params: {
    targetArtigianoId: string;
    cantieri: Array<{
      name: string;
      city: string;
      address: string;
      client: string;
      initialInventory: number;
      finalInventory: number;
    }>;
  }) => Promise<void> | void;
  isSupabaseConnected?: boolean;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  artigiani,
  currentArtigianoId,
  currentCantiereId,
  onCommitSingolaScheda,
  onCommitSospesi,
  onCommitProspettoGenerale,
  isSupabaseConnected = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [importType, setImportType] = useState<ExcelImportType>('singola_scheda');
  const [selectedArtigianoId, setSelectedArtigianoId] = useState<string>(
    currentArtigianoId || artigiani[0]?.id || ''
  );
  const [selectedTargetCantiereId, setSelectedTargetCantiereId] = useState<string>(
    currentCantiereId || 'new'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Editable header fields for single cantiere preview
  const [customCantiereName, setCustomCantiereName] = useState<string>('');
  const [customCity, setCustomCity] = useState<string>('');
  const [customAddress, setCustomAddress] = useState<string>('');
  const [customCommittente, setCustomCommittente] = useState<string>('');
  const [customYear, setCustomYear] = useState<number>(2026);
  const [customRI, setCustomRI] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetArtigiano = useMemo(() => {
    return artigiani.find((a) => a.id === selectedArtigianoId) || artigiani[0];
  }, [artigiani, selectedArtigianoId]);

  // Handle file loading and initial parsing
  const handleProcessFile = async (selectedFile: File) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setFile(selectedFile);

      const buffer = await selectedFile.arrayBuffer();
      setFileBuffer(buffer);

      const parsed = parseUploadedExcel(buffer, selectedFile.name);
      setParseResult(parsed);
      setSelectedSheet(parsed.selectedSheet);
      setImportType(parsed.detectedType);

      // Pre-fill editable header if singola scheda
      if (parsed.singolaScheda) {
        setCustomCantiereName(parsed.singolaScheda.header.cantiereName);
        setCustomCity(parsed.singolaScheda.header.city);
        setCustomAddress(parsed.singolaScheda.header.address);
        setCustomCommittente(parsed.singolaScheda.header.committente);
        setCustomYear(parsed.singolaScheda.header.year);
        setCustomRI(parsed.singolaScheda.header.initialInventory);

        // Check if an existing cantiere in targetArtigiano matches by name
        if (targetArtigiano) {
          const match = targetArtigiano.cantieri.find(
            (c) =>
              c.name.trim().toLowerCase() ===
              parsed.singolaScheda?.header.cantiereName.trim().toLowerCase()
          );
          if (match) {
            setSelectedTargetCantiereId(match.id);
          } else {
            setSelectedTargetCantiereId('new');
          }
        }
      }
    } catch (err: any) {
      console.error('Error parsing Excel file:', err);
      setErrorMsg(
        err.message || 'Errore durante la lettura del file Excel (.xls / .xlsx).'
      );
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-parse when changing sheet or forcing a type
  const handleReparse = (newType?: ExcelImportType, newSheet?: string) => {
    if (!fileBuffer || !file) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const typeToUse = newType || importType;
      const sheetToUse = newSheet !== undefined ? newSheet : selectedSheet;

      const parsed = parseUploadedExcel(
        fileBuffer,
        file.name,
        typeToUse,
        sheetToUse
      );
      setParseResult(parsed);
      setSelectedSheet(parsed.selectedSheet);
      setImportType(typeToUse);

      if (parsed.singolaScheda) {
        setCustomCantiereName(parsed.singolaScheda.header.cantiereName);
        setCustomCity(parsed.singolaScheda.header.city);
        setCustomAddress(parsed.singolaScheda.header.address);
        setCustomCommittente(parsed.singolaScheda.header.committente);
        setCustomYear(parsed.singolaScheda.header.year);
        setCustomRI(parsed.singolaScheda.header.initialInventory);
      }
    } catch (err: any) {
      console.error('Error re-parsing Excel:', err);
      setErrorMsg(err.message || 'Errore nel cambio visualizzazione foglio.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.name.endsWith('.xls') ||
        droppedFile.name.endsWith('.xlsx')
      ) {
        handleProcessFile(droppedFile);
      } else {
        setErrorMsg('Per favore seleziona un file Excel valido (.xls o .xlsx).');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !targetArtigiano) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);

      if (importType === 'singola_scheda' && parseResult.singolaScheda) {
        const isNew = selectedTargetCantiereId === 'new';
        const cantiereData = {
          id: isNew ? undefined : selectedTargetCantiereId,
          name: customCantiereName || parseResult.singolaScheda.header.cantiereName,
          city: customCity || parseResult.singolaScheda.header.city || 'Milano',
          address: customAddress || parseResult.singolaScheda.header.address || '',
          client: customCommittente || parseResult.singolaScheda.header.committente || customCantiereName,
          year: customYear || parseResult.singolaScheda.header.year || 2026,
          initialInventory: customRI >= 0 ? customRI : parseResult.singolaScheda.header.initialInventory || 0,
        };

        const movements: Movement[] = parseResult.singolaScheda.movements.map(
          (m, idx) => ({
            id: `mov-imp-${Date.now()}-${idx}`,
            date: m.date,
            docNumber: m.docNumber || 'S.N.',
            typeAndSubject: m.typeAndSubject,
            protocol: m.protocol || '',
            purchases: m.purchases,
            issued: m.issued,
            notes: m.isSpecialRI ? 'Rimanenze Iniziali importate da Excel' : 'Importato da Excel',
            source: 'manuale',
            attachmentPdf: undefined, // Explicitly undefined/null for historical Excel imports
          })
        );

        await onCommitSingolaScheda({
          targetArtigianoId: selectedArtigianoId,
          cantiereData,
          movements,
          isNewCantiere: isNew,
        });
      } else if (importType === 'scheda_sospesi' && parseResult.sospesi) {
        const sospesiItems: SospesoItem[] = parseResult.sospesi.items.map(
          (item, idx) => ({
            id: `sosp-imp-${Date.now()}-${idx}`,
            date: item.date,
            docNumber: item.docNumber || 'S.N.',
            supplier: item.supplier.toUpperCase(),
            description: item.description,
            amount: item.amount,
            protocol: item.protocol || undefined,
            client: item.client || undefined,
            status: 'in_attesa_cliente',
            customerNote: 'Importato da Scheda Sospesi Excel',
            attachmentPdf: undefined,
            createdAt: new Date().toISOString(),
          })
        );

        await onCommitSospesi({
          targetArtigianoId: selectedArtigianoId,
          items: sospesiItems,
        });
      } else if (importType === 'prospetto_generale' && parseResult.prospettoGenerale) {
        const cantieriToCommit = parseResult.prospettoGenerale.cantieri.map((c) => ({
          name: c.name,
          city: c.city,
          address: c.address,
          client: c.client,
          initialInventory: c.initialInventory,
          finalInventory: c.finalInventory,
        }));

        await onCommitProspettoGenerale({
          targetArtigianoId: selectedArtigianoId,
          cantieri: cantieriToCommit,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error committing Excel import:', err);
      setErrorMsg(err.message || 'Errore durante il salvataggio dei dati nel database.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Importazione da File Excel (.xls / .xlsx)</span>
                {isSupabaseConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    <Database className="h-3 w-3 text-emerald-400" />
                    Supabase Cloud
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Carica fogli storici per Singola Scheda Cantiere, Scheda Sospesi o Prospetto Generale
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 text-sm">
          {/* Target Artisan Selection */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Building className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ditta / Cliente di destinazione:
                </div>
                <div className="text-sm font-black text-white">
                  {targetArtigiano?.name || 'Seleziona Ditta'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="select-artisan-import" className="text-xs text-slate-400">
                Imputa a:
              </label>
              <select
                id="select-artisan-import"
                value={selectedArtigianoId}
                onChange={(e) => setSelectedArtigianoId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
              >
                {artigiani.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.name} ({art.cantieri?.length || 0} cantieri)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Upload / Drag and Drop Area */}
          {!parseResult ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                dragOver
                  ? 'border-emerald-400 bg-emerald-950/20 scale-[0.99]'
                  : 'border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <UploadCloud className="h-8 w-8 animate-pulse" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Trascina qui il file Excel o <span className="text-emerald-400 underline">sfoglia</span>
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Supporta i formati <strong>.xlsx</strong> e <strong>.xls</strong>. Riconosce automaticamente Singola Scheda Cantiere, Scheda Sospesi e Prospetto Generale.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  1. Scheda Cantiere (Acquisti / Emesse)
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  2. Scheda Sospesi (DDT / Fornitori)
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  3. Prospetto Generale Cantieri (R.I. / R.F.)
                </span>
              </div>
            </div>
          ) : (
            /* File Loaded & Controls */
            <div className="space-y-5">
              {/* File Info Bar & Sheet Switcher */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{file?.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({Math.round((file?.size || 0) / 1024)} KB)
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Foglio selezionato:</span>
                      {parseResult.sheetNames.length > 1 ? (
                        <select
                          value={selectedSheet}
                          onChange={(e) => {
                            setSelectedSheet(e.target.value);
                            handleReparse(undefined, e.target.value);
                          }}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-emerald-300 font-bold focus:outline-none"
                        >
                          {parseResult.sheetNames.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong className="text-emerald-400 font-mono">
                          {selectedSheet}
                        </strong>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFile(null);
                      setFileBuffer(null);
                      setParseResult(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Cambia File</span>
                  </button>
                </div>
              </div>

              {/* Import Type Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Tipologia di Foglio Riconosciuta:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleReparse('singola_scheda')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importType === 'singola_scheda'
                        ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase text-amber-300">
                        1. Singola Scheda Cantiere
                      </span>
                      {importType === 'singola_scheda' && (
                        <Check className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Intestazione cantiere + movimenti DATA, DOC, ACQUISTI, EMESSE
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReparse('scheda_sospesi')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importType === 'scheda_sospesi'
                        ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase text-amber-300">
                        2. Scheda Sospesi
                      </span>
                      {importType === 'scheda_sospesi' && (
                        <Check className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Fatture e DDT da attribuire con DATA, FORNITORE, IMPORTO
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReparse('prospetto_generale')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importType === 'prospetto_generale'
                        ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase text-amber-300">
                        3. Prospetto Generale
                      </span>
                      {importType === 'prospetto_generale' && (
                        <Check className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Elenco globale cantieri con R.I., Acquisti, Emesse e R.F.
                    </p>
                  </button>
                </div>
              </div>

              {/* Warnings if any */}
              {parseResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    {parseResult.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 1 PREVIEW: SINGOLA SCHEDA CANTIERE                    */}
              {/* ======================================================== */}
              {importType === 'singola_scheda' && parseResult.singolaScheda && (
                <div className="space-y-4">
                  {/* Cantiere Header Detected & Config */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-amber-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                          Dati Anagrafici Cantiere Rilevati
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        (Puoi modificare i campi prima del salvataggio)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          NOME CANTIERE
                        </label>
                        <input
                          type="text"
                          value={customCantiereName}
                          onChange={(e) => setCustomCantiereName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          CITTÀ
                        </label>
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          INDIRIZZO
                        </label>
                        <input
                          type="text"
                          value={customAddress}
                          onChange={(e) => setCustomAddress(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                          placeholder="es. Via Roma 15"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          COMMITTENTE (DEL:)
                        </label>
                        <input
                          type="text"
                          value={customCommittente}
                          onChange={(e) => setCustomCommittente(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          ANNO
                        </label>
                        <input
                          type="number"
                          value={customYear}
                          onChange={(e) => setCustomYear(parseInt(e.target.value, 10) || 2026)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          RIMANENZE INIZIALI (R.I.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customRI}
                          onChange={(e) => setCustomRI(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Target Cantiere in Database */}
                    <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-300">
                          Azione nel database:
                        </span>
                      </div>
                      <select
                        value={selectedTargetCantiereId}
                        onChange={(e) => setSelectedTargetCantiereId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-400"
                      >
                        <option value="new">
                          + Crea nuovo cantiere: "{customCantiereName || 'Nuovo Cantiere'}"
                        </option>
                        {targetArtigiano?.cantieri?.map((c) => (
                          <option key={c.id} value={c.id}>
                            Aggiungi a cantiere esistente: {c.name} ({c.city})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Movimenti Identificati
                      </div>
                      <div className="text-lg font-black text-white">
                        {parseResult.singolaScheda.movements.length} righe
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Totale Acquisti
                      </div>
                      <div className="text-lg font-black text-rose-400">
                        {formatCurrency(parseResult.singolaScheda.totalPurchases)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Totale Emesse
                      </div>
                      <div className="text-lg font-black text-emerald-400">
                        {formatCurrency(parseResult.singolaScheda.totalIssued)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Righe Totali Escluse
                      </div>
                      <div className="text-lg font-black text-slate-400 font-mono">
                        {parseResult.singolaScheda.ignoredRowsCount} formule/totali
                      </div>
                    </div>
                  </div>

                  {/* Movements Preview Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Anteprima Movimenti da Importare
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Allegato PDF impostato a NULL (storico Excel)
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">DATA DOC.</th>
                            <th className="py-2 px-3">N° DOC.</th>
                            <th className="py-2 px-3">TIPO DOC. / FORNITORE / CLIENTE</th>
                            <th className="py-2 px-3">N./PROT</th>
                            <th className="py-2 px-3 text-right">ACQUISTI</th>
                            <th className="py-2 px-3 text-right">EMESSE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {parseResult.singolaScheda.movements.map((m, idx) => (
                            <tr
                              key={m.id || idx}
                              className={`hover:bg-slate-900/40 transition-colors ${
                                m.isSpecialRI ? 'bg-amber-500/10 font-bold' : ''
                              }`}
                            >
                              <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                                {formatDateItalian(m.date)}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-white font-medium">
                                {m.docNumber || '-'}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-200">
                                {m.typeAndSubject}
                                {m.isSpecialRI && (
                                  <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-amber-400 text-slate-950 font-bold uppercase">
                                    RI
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                                {m.protocol || '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap text-rose-300 font-bold">
                                {m.purchases > 0 ? formatCurrency(m.purchases) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap text-emerald-300 font-bold">
                                {m.issued > 0 ? formatCurrency(m.issued) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2 PREVIEW: SCHEDA SOSPESI                             */}
              {/* ======================================================== */}
              {importType === 'scheda_sospesi' && parseResult.sospesi && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Voci Sospese Trovate
                      </div>
                      <div className="text-lg font-black text-amber-300">
                        {parseResult.sospesi.items.length} righe
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Totale Importo Sospeso
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        {formatCurrency(parseResult.sospesi.totalAmount)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Righe Totali Escluse
                      </div>
                      <div className="text-lg font-black text-slate-400 font-mono">
                        {parseResult.sospesi.ignoredRowsCount} formule/totali
                      </div>
                    </div>
                  </div>

                  {/* Sospesi Table Preview */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Anteprima Scheda Sospesi da Importare
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Verranno inserite nella tabella sospesi di Supabase
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">DATA</th>
                            <th className="py-2 px-3">N. FATTURA</th>
                            <th className="py-2 px-3">FORNITORE</th>
                            <th className="py-2 px-3">NS. PROT.</th>
                            <th className="py-2 px-3 text-right">IMPORTO</th>
                            <th className="py-2 px-3">DESCRIZIONE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {parseResult.sospesi.items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                                {formatDateItalian(item.date)}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-white font-medium">
                                {item.docNumber}
                              </td>
                              <td className="py-2 px-3 font-sans font-bold text-amber-300 whitespace-nowrap">
                                {item.supplier}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                                {item.protocol || '-'}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap text-amber-400 font-bold">
                                {formatCurrency(item.amount)}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-300 max-w-xs truncate">
                                {item.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3 PREVIEW: PROSPETTO GENERALE CANTIERI                */}
              {/* ======================================================== */}
              {importType === 'prospetto_generale' && parseResult.prospettoGenerale && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Cantieri Rilevati
                      </div>
                      <div className="text-lg font-black text-cyan-300">
                        {parseResult.prospettoGenerale.cantieri.length} schede
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Totale R.I.
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        {formatCurrency(parseResult.prospettoGenerale.totalRI)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Totale R.F.
                      </div>
                      <div className="text-lg font-black text-emerald-400">
                        {formatCurrency(parseResult.prospettoGenerale.totalRF)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Righe Escluse (Totali)
                      </div>
                      <div className="text-lg font-black text-slate-400 font-mono">
                        {parseResult.prospettoGenerale.ignoredRowsCount} righe
                      </div>
                    </div>
                  </div>

                  {/* Cantieri Preview Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Anteprima Cantieri & Rimanenze da Importare / Aggiornare
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Crea o aggiorna le schede con R.I. e R.F.
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">NOME CLIENTE / CANTIERE</th>
                            <th className="py-2 px-3">CITTA'</th>
                            <th className="py-2 px-3">INDIRIZZO</th>
                            <th className="py-2 px-3 text-right">R.I.</th>
                            <th className="py-2 px-3 text-right">ACQUISTI</th>
                            <th className="py-2 px-3 text-right">EMESSE</th>
                            <th className="py-2 px-3 text-right">R.F.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {parseResult.prospettoGenerale.cantieri.map((c, idx) => (
                            <tr key={c.id || idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-2 px-3 font-sans font-bold text-white">
                                {c.name}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-300">
                                {c.city}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-400">
                                {c.address || '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-amber-300 font-bold whitespace-nowrap">
                                {c.initialInventory > 0 ? formatCurrency(c.initialInventory) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-rose-300 whitespace-nowrap">
                                {c.purchases > 0 ? formatCurrency(c.purchases) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-300 whitespace-nowrap">
                                {c.issued > 0 ? formatCurrency(c.issued) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-cyan-300 font-bold whitespace-nowrap">
                                {c.finalInventory > 0 ? formatCurrency(c.finalInventory) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>Errore: </strong>
                {errorMsg}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Annulla
          </button>

          <div className="flex items-center gap-3">
            {parseResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Salvataggio su Supabase in corso...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Conferma e Salva su Database</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
