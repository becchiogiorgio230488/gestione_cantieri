import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  Loader2,
  ShieldCheck,
  RefreshCw,
  FolderArchive,
  Info,
} from 'lucide-react';
import { Artigiano, ParsedBackupInfo } from '../types';
import {
  exportFullBackupJSON,
  exportSingleClientBackupJSON,
  parseBackupJSON,
} from '../utils/storage';

interface BackupRestoreModalProps {
  artigiani: Artigiano[];
  initialTab?: 'export' | 'import';
  initialSelectedArtigianoId?: string;
  isSupabaseConnected?: boolean;
  onClose: () => void;
  onRestore: (
    restoredClients: Artigiano[],
    isFullOverwrite: boolean,
    targetClientId?: string
  ) => Promise<void> | void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  artigiani,
  initialTab = 'export',
  initialSelectedArtigianoId,
  isSupabaseConnected = false,
  onClose,
  onRestore,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // --- STATO ESPORTAZIONE ---
  const [exportScope, setExportScope] = useState<'full' | 'single'>('full');
  const [selectedExportArtigianoId, setSelectedExportArtigianoId] = useState<string>(
    initialSelectedArtigianoId || artigiani[0]?.id || ''
  );
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // --- STATO IMPORTAZIONE ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupInfo | null>(null);
  const [importModeForFull, setImportModeForFull] = useState<'all' | 'single_from_full'>('all');
  const [overwriteAllDb, setOverwriteAllDb] = useState<boolean>(false);
  const [selectedSingleFromFullId, setSelectedSingleFromFullId] = useState<string>('');
  const [isProcessingImport, setIsProcessingImport] = useState<boolean>(false);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Clienti totali e statistiche di esportazione
  const selectedExportArtigiano = artigiani.find((a) => a.id === selectedExportArtigianoId) || artigiani[0];
  const totalCantieriAll = artigiani.reduce((acc, a) => acc + (a.cantieri?.length || 0), 0);
  const totalSospesiAll = artigiani.reduce((acc, a) => acc + (a.sospesi?.length || 0), 0);
  const totalMovementsAll = artigiani.reduce(
    (acc, a) => acc + (a.cantieri || []).reduce((cAcc, c) => cAcc + (c.movements?.length || 0), 0),
    0
  );

  // Gestione download export
  const handleTriggerExport = () => {
    if (exportScope === 'full') {
      exportFullBackupJSON(artigiani);
      setExportSuccessMessage(`Backup completo di ${artigiani.length} clienti scaricato con successo!`);
    } else {
      if (!selectedExportArtigiano) return;
      exportSingleClientBackupJSON(selectedExportArtigiano);
      setExportSuccessMessage(`Backup per il cliente "${selectedExportArtigiano.name}" scaricato con successo!`);
    }
    setTimeout(() => setExportSuccessMessage(null), 4500);
  };

  // Gestione selezione file JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseBackupJSON(text);

      if (!result.isValid) {
        setImportErrorMessage(result.error || 'Il file non contiene un formato di backup riconosciuto.');
        setParsedBackup(null);
        return;
      }

      setParsedBackup(result);
      if (result.clients.length > 0) {
        setSelectedSingleFromFullId(result.clients[0].id);
      }
    };
    reader.onerror = () => {
      setImportErrorMessage('Impossibile leggere il file selezionato.');
      setParsedBackup(null);
    };
    reader.readAsText(file);
  };

  // Esecuzione ripristino
  const handleExecuteRestore = async () => {
    if (!parsedBackup || !parsedBackup.isValid) return;

    try {
      setIsProcessingImport(true);
      setImportErrorMessage(null);

      // CASO 1: Il backup caricato è di un SINGOLO cliente (o legacy con 1 solo cliente)
      if (parsedBackup.type === 'SINGLE_CLIENT_BACKUP' || parsedBackup.clients.length === 1) {
        const singleClient = parsedBackup.clients[0];
        await onRestore([singleClient], false, singleClient.id);
        setImportSuccessMessage(`Cliente "${singleClient.name}" e tutti i suoi cantieri ripristinati correttamente!`);
      }
      // CASO 2: Il backup è TOTALE e l'utente vuole ripristinare TUTTO il database
      else if (importModeForFull === 'all') {
        await onRestore(parsedBackup.clients, overwriteAllDb);
        setImportSuccessMessage(
          `Database ripristinato con successo: ${parsedBackup.clients.length} clienti sincronizzati!`
        );
      }
      // CASO 3: Il backup è TOTALE ma l'utente vuole estrarre e ripristinare SOLO un cliente specifico
      else {
        const clientToExtract = parsedBackup.clients.find((c) => c.id === selectedSingleFromFullId);
        if (!clientToExtract) {
          throw new Error('Seleziona un cliente valido dal file di backup.');
        }
        await onRestore([clientToExtract], false, clientToExtract.id);
        setImportSuccessMessage(
          `Dati estratti e ripristinati con successo solo per "${clientToExtract.name}"!`
        );
      }

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Errore durante il ripristino backup:', err);
      setImportErrorMessage(err?.message || 'Si è verificato un errore durante il ripristino dei dati.');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Trova cliente selezionato se si estrae da backup totale
  const clientSelectedFromFull = parsedBackup?.clients.find((c) => c.id === selectedSingleFromFullId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden my-auto animate-fadeIn text-slate-100">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Backup e Ripristino Dati</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  JSON Formattato
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestione esportazione e ricaricamento backup (totale o singolo cliente)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>1. Esporta Backup (.json)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>2. Ripristina Backup (.json)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          {/* ========================================================= */}
          {/* TAB 1: ESPORTAZIONE BACKUP */}
          {/* ========================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Notifica successo export */}
              {exportSuccessMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{exportSuccessMessage}</span>
                </div>
              )}

              {/* Scelta Ambito di Esportazione */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Seleziona l'ambito di esportazione:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opzione: Backup Completo */}
                  <label
                    onClick={() => setExportScope('full')}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      exportScope === 'full'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FolderArchive className={`h-4 w-4 ${exportScope === 'full' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span className="font-bold text-xs uppercase">Tutti i Dati (Completo)</span>
                      </div>
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'full'}
                        onChange={() => setExportScope('full')}
                        className="accent-amber-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Include l'intero archivio dello studio: tutti i clienti ({artigiani.length}), cantieri, fatture e sospesi.
                    </p>
                  </label>

                  {/* Opzione: Singolo Cliente */}
                  <label
                    onClick={() => setExportScope('single')}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      exportScope === 'single'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className={`h-4 w-4 ${exportScope === 'single' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span className="font-bold text-xs uppercase">Singolo Cliente</span>
                      </div>
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'single'}
                        onChange={() => setExportScope('single')}
                        className="accent-amber-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Esporta solo le schede e i cantieri di un determinato artigiano o committente selezionato.
                    </p>
                  </label>
                </div>
              </div>

              {/* Seleziona Cliente se esportazione singola */}
              {exportScope === 'single' && (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
                    Seleziona il cliente da esportare:
                  </label>
                  <select
                    value={selectedExportArtigianoId}
                    onChange={(e) => setSelectedExportArtigianoId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                  >
                    {artigiani.map((art) => (
                      <option key={art.id} value={art.id}>
                        {art.name} ({art.cantieri?.length || 0} cantieri, {art.sospesi?.length || 0} sospesi)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Box Riepilogo Dati di Esportazione */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-amber-400" />
                    Riepilogo File che verrà generato:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    {exportScope === 'full' ? 'type: "FULL_BACKUP"' : 'type: "SINGLE_CLIENT_BACKUP"'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Clienti</span>
                    <span className="text-sm font-extrabold text-white">
                      {exportScope === 'full' ? artigiani.length : 1}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Cantieri</span>
                    <span className="text-sm font-extrabold text-amber-400">
                      {exportScope === 'full' ? totalCantieriAll : selectedExportArtigiano?.cantieri?.length || 0}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Movimenti</span>
                    <span className="text-sm font-extrabold text-blue-400">
                      {exportScope === 'full'
                        ? totalMovementsAll
                        : (selectedExportArtigiano?.cantieri || []).reduce(
                            (acc, c) => acc + (c.movements?.length || 0),
                            0
                          )}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Sospesi</span>
                    <span className="text-sm font-extrabold text-rose-400">
                      {exportScope === 'full' ? totalSospesiAll : selectedExportArtigiano?.sospesi?.length || 0}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  Il file JSON conterrà la data di esportazione, il tipo di backup e tutta la gerarchia completa di
                  relazioni (anagrafica, cantieri, movimenti e sospesi).
                </p>
              </div>

              {/* Bottone Download */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTriggerExport}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    {exportScope === 'full'
                      ? `Scarica Backup Completo (${artigiani.length} Clienti)`
                      : `Scarica Backup Cliente: ${selectedExportArtigiano?.name || 'Selezionato'}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: RIPRISTINO BACKUP */}
          {/* ========================================================= */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Notifiche Errore o Successo */}
              {importErrorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{importErrorMessage}</span>
                </div>
              )}

              {importSuccessMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* File Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-400/70 bg-slate-950/60 hover:bg-slate-950 rounded-2xl p-6 text-center cursor-pointer transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <FileJson className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-white text-sm">
                  {selectedFileName ? selectedFileName : 'Trascina o seleziona il file di backup .JSON'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Compatibile sia con file di backup completi che con file di singoli clienti
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Sfoglia file dal computer</span>
                  </span>
                </div>
              </div>

              {/* File Analizzato con Successo */}
              {parsedBackup && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn">
                  {/* Banner Dati Riconosciuti */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                          parsedBackup.type === 'SINGLE_CLIENT_BACKUP' || parsedBackup.clients.length === 1
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {parsedBackup.type === 'SINGLE_CLIENT_BACKUP' || parsedBackup.clients.length === 1
                          ? 'Backup Singolo Cliente'
                          : 'Backup Completo Studio'}
                      </span>
                      {parsedBackup.exportedAt && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {new Date(parsedBackup.exportedAt).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">
                      {parsedBackup.clients.length} {parsedBackup.clients.length === 1 ? 'cliente rilevato' : 'clienti rilevati'}
                    </span>
                  </div>

                  {/* SCENARIO A: File di un SINGOLO cliente */}
                  {(parsedBackup.type === 'SINGLE_CLIENT_BACKUP' || parsedBackup.clients.length === 1) && (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Cliente da Ripristinare:
                          </span>
                          <span className="text-sm font-black text-white">
                            {parsedBackup.clients[0].name}
                          </span>
                          {parsedBackup.clients[0].businessName && (
                            <span className="text-xs text-slate-400 block line-clamp-1">
                              {parsedBackup.clients[0].businessName}
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-amber-400 font-bold block">
                            {parsedBackup.clients[0].cantieri?.length || 0} Cantieri
                          </span>
                          <span className="text-slate-400 text-[11px] block">
                            {parsedBackup.clients[0].sospesi?.length || 0} Sospesi
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                        <span>
                          <strong>Protezione Isolamento Dati:</strong> Verranno aggiornati o reinseriti esclusivamente i
                          cantieri, i movimenti e i sospesi di <strong>{parsedBackup.clients[0].name}</strong>. Tutti gli
                          altri clienti presenti nel database non subiranno alcuna modifica.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* SCENARIO B: File di Backup TOTALE (con più clienti) */}
                  {parsedBackup.type !== 'SINGLE_CLIENT_BACKUP' && parsedBackup.clients.length > 1 && (
                    <div className="space-y-3.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                        Come desideri gestire questo backup totale?
                      </label>

                      {/* Scelta Modalità per Backup Totale */}
                      <div className="space-y-2">
                        {/* Opzione 1: Ripristina tutti i clienti */}
                        <label
                          onClick={() => setImportModeForFull('all')}
                          className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                            importModeForFull === 'all'
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5 text-amber-400" />
                              Ripristina Tutti i {parsedBackup.clients.length} Clienti
                            </span>
                            <input
                              type="radio"
                              name="importModeForFull"
                              checked={importModeForFull === 'all'}
                              onChange={() => setImportModeForFull('all')}
                              className="accent-amber-500 cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Aggiorna o ripristina tutti i dati di tutti i cantieri contenuti nel file.
                          </p>
                        </label>

                        {/* Opzione Sovrascrittura Completa se "Ripristina Tutti" */}
                        {importModeForFull === 'all' && (
                          <div className="pl-3 py-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={overwriteAllDb}
                                onChange={(e) => setOverwriteAllDb(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500"
                              />
                              <span className="font-semibold text-rose-300">
                                Sostituisci integralmente l'intero database (rimuove record non presenti nel backup)
                              </span>
                            </label>
                          </div>
                        )}

                        {/* Opzione 2: Estrai solo un singolo cliente dal backup totale */}
                        <label
                          onClick={() => setImportModeForFull('single_from_full')}
                          className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                            importModeForFull === 'single_from_full'
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-amber-400" />
                              Estrai e ripristina SOLO UN SINGOLO CLIENTE da questo file
                            </span>
                            <input
                              type="radio"
                              name="importModeForFull"
                              checked={importModeForFull === 'single_from_full'}
                              onChange={() => setImportModeForFull('single_from_full')}
                              className="accent-amber-500 cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Non tocca gli altri clienti del database: estrae e carica soltanto il cliente selezionato.
                          </p>
                        </label>
                      </div>

                      {/* Dropdown selettore cliente da estrarre */}
                      {importModeForFull === 'single_from_full' && (
                        <div className="p-3 bg-slate-900 rounded-xl border border-amber-500/40 space-y-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
                            Seleziona il cliente da estrarre dal backup:
                          </label>
                          <select
                            value={selectedSingleFromFullId}
                            onChange={(e) => setSelectedSingleFromFullId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                          >
                            {parsedBackup.clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.cantieri?.length || 0} cantieri, {c.sospesi?.length || 0} sospesi)
                              </option>
                            ))}
                          </select>

                          {clientSelectedFromFull && (
                            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                              <span>Cantieri: {clientSelectedFromFull.cantieri?.length || 0}</span>
                              <span>Sospesi: {clientSelectedFromFull.sospesi?.length || 0}</span>
                              <span>P.IVA: {clientSelectedFromFull.partitaIva || 'N/D'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pulsante Conferma Ripristino */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={isProcessingImport}
                      onClick={handleExecuteRestore}
                      className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      {isProcessingImport ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                          <span>Ripristino e sincronizzazione in corso...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span>
                            {parsedBackup.type === 'SINGLE_CLIENT_BACKUP' || parsedBackup.clients.length === 1
                              ? `Conferma Ripristino Dati: ${parsedBackup.clients[0].name}`
                              : importModeForFull === 'all'
                              ? `Ripristina Tutti i ${parsedBackup.clients.length} Clienti`
                              : `Ripristina Solo Cliente: ${clientSelectedFromFull?.name || 'Selezionato'}`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>
              {isSupabaseConnected ? 'Sincronizzazione Supabase Attiva' : 'Archiviazione Locale (Offline)'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
