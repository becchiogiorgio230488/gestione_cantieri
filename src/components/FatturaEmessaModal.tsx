import React, { useState } from 'react';
import {
  X,
  Receipt,
  Building,
  PlusCircle,
  Calendar,
  CheckCircle,
  Sparkles,
  FileUp,
  MapPin,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Layers,
  FileText,
  Info,
} from 'lucide-react';
import { Cantiere, CantiereCategory, Movement, ParsedFatturaEmessaXML } from '../types';
import { formatCurrency, formatDateItalian, getTodayISODate } from '../utils/calculations';
import { parseFatturaEmessaXML } from '../utils/xmlParser';
import { SAMPLE_ISSUED_INVOICES, SampleIssuedInvoice } from '../utils/sampleInvoices';
import {
  findExistingIssuedInvoiceLocations,
  InvoiceLocation,
} from '../utils/invoiceDuplicateHelper';

interface FatturaEmessaModalProps {
  cantieri: Cantiere[];
  preselectedCantiereId?: string | null;
  onClose: () => void;
  onCreateIssuedInvoice: (data: {
    createNewCantiere: boolean;
    cantiereId?: string;
    newCantiereData?: {
      name: string;
      city: string;
      address?: string;
      date: string;
      year: number;
      client: string;
      initialInventory: number;
      category: CantiereCategory;
      notes?: string;
    };
    movement: Movement;
  }) => void;
}

export const FatturaEmessaModal: React.FC<FatturaEmessaModalProps> = ({
  cantieri,
  preselectedCantiereId,
  onClose,
  onCreateIssuedInvoice,
}) => {
  // Tabs: XML Import vs Manual Entry
  const [activeTab, setActiveTab] = useState<'xml_import' | 'manual'>('xml_import');

  // XML State
  const [xmlContent, setXmlContent] = useState<string>('');
  const [parsedXml, setParsedXml] = useState<ParsedFatturaEmessaXML | null>(null);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Verification & Form State
  const [createNewCantiere, setCreateNewCantiere] = useState<boolean>(cantieri.length === 0);
  const [selectedCantiereId, setSelectedCantiereId] = useState<string>(
    preselectedCantiereId || (cantieri[0]?.id ?? '')
  );

  // Editable fields (prefilled from XML or manual)
  const [docNumber, setDocNumber] = useState('2/00');
  const [date, setDate] = useState(getTodayISODate());
  const [client, setClient] = useState('');
  // Il protocollo interno studio per le fatture emesse è sempre il numero di fattura
  const [protocol, setProtocol] = useState('2/00');
  const [amount, setAmount] = useState<string>('');
  // Nella descrizione del movimento cantiere basta scrivere EMESSE
  const [description, setDescription] = useState('EMESSE');
  const [notes, setNotes] = useState('');

  // Cantiere Address rule specific fields (solo via e numero civico)
  const [cantiereAddress, setCantiereAddress] = useState('');
  const [newCantiereName, setNewCantiereName] = useState('');
  const [newCantiereCity, setNewCantiereCity] = useState('');
  const [initialInventory, setInitialInventory] = useState<string>('0');
  const [formError, setFormError] = useState<string | null>(null);

  // Duplicate prompt state
  const [duplicatePromptLocations, setDuplicatePromptLocations] = useState<InvoiceLocation[] | null>(null);

  // File drop / upload handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readXmlFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readXmlFile(file);
  };

  const readXmlFile = (file: File) => {
    setXmlError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processXmlText(text, file.name);
      }
    };
    reader.onerror = () => {
      setXmlError('Errore durante la lettura del file XML.');
    };
    reader.readAsText(file);
  };

  const processXmlText = (xmlStr: string, fileName = 'fattura_emessa.xml') => {
    try {
      setXmlError(null);
      const parsed = parseFatturaEmessaXML(xmlStr, fileName);
      setParsedXml(parsed);
      setXmlContent(xmlStr);
      setIsVerifying(true);

      // Pre-fill fields according to parsed data & new business rules
      setClient(parsed.committente.denominazione);
      const invoiceNumber = parsed.datiDocumento.numero || '2/00';
      setDocNumber(invoiceNumber);
      // REGOLA 1: Il protocollo interno studio è SEMPRE il numero di fattura (es. 2/00 -> 2/00)
      setProtocol(invoiceNumber);
      setDate(parsed.datiDocumento.data || getTodayISODate());
      // REGOLA: Importa solo l'imponibile; se ci sono due o più aliquote IVA, importa la somma di tutti gli imponibili
      // In caso di Nota di Credito (TD04/TD08), l'importo deve essere importato con segno negativo a storno dei ricavi
      const isNotaCredito =
        parsed.datiDocumento.isNotaCredito ||
        parsed.datiDocumento.tipoDocumento === 'TD04' ||
        parsed.datiDocumento.tipoDocumento === 'TD08';

      let taxableToImport = parsed.datiDocumento.imponibileTotale !== 0
        ? parsed.datiDocumento.imponibileTotale
        : parsed.datiDocumento.importoTotale;

      if (isNotaCredito && taxableToImport > 0) {
        taxableToImport = -Math.abs(taxableToImport);
      }

      setAmount(taxableToImport.toFixed(2));
      // REGOLA 5: Nella descrizione del cantiere basta scrivere EMESSE
      setDescription('EMESSE');
      // REGOLA 3: Solo via e civico senza dati catastali
      setCantiereAddress(parsed.indirizzoCantiereProposto);
      setNewCantiereCity(parsed.cittaCantiereSuggerita);
      // REGOLA 2: Nome cantiere = Cognome nome in MAIUSCOLO senza "cantiere" e senza paese tra parentesi
      setNewCantiereName(parsed.nomeCantiereSuggerito);
      setCreateNewCantiere(true);
    } catch (err: any) {
      console.error(err);
      setXmlError(err.message || 'Errore nel parsing del file XML della fattura emessa.');
      setParsedXml(null);
    }
  };

  const handleSelectSample = (sample: SampleIssuedInvoice) => {
    processXmlText(sample.xml, sample.name + '.xml');
  };

  const handleSubmit = (e?: React.FormEvent, bypassDuplicateCheck = false) => {
    if (e) e.preventDefault();

    const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
    if (numericAmount === 0 || isNaN(numericAmount)) {
      setFormError('Inserisci un importo valido (positivo per fattura o negativo per nota di credito TD04).');
      return;
    }

    // Check if issued invoice has already been registered
    if (!bypassDuplicateCheck) {
      const existing = findExistingIssuedInvoiceLocations(docNumber.trim(), cantieri);
      if (existing.length > 0) {
        setDuplicatePromptLocations(existing);
        return;
      }
    }

    // Per le fatture emesse il protocollo interno studio è sempre il numero di fattura
    const finalProtocol = protocol.trim() || docNumber.trim() || '2/00';

    if (createNewCantiere) {
      const upperName = newCantiereName.toUpperCase().trim();
      const upperCity = newCantiereCity.toUpperCase().trim();
      if (!upperName || !upperCity) {
        setFormError('Compila il Nome Cantiere e la Città.');
        return;
      }

      setFormError(null);
      const movement: Movement = {
        id: `mov-emessa-${Date.now()}`,
        date,
        docNumber: docNumber.trim(),
        // REGOLA 5: Quando si inserisce una fattura emessa nel cantiere nella descrizione basta scrivere EMESSE
        typeAndSubject: 'EMESSE',
        // REGOLA 1: Protocollo interno studio = numero di fattura
        protocol: finalProtocol,
        purchases: 0,
        issued: numericAmount,
        notes: notes || (parsedXml ? `Importata da XML: ${parsedXml.fileName}` : undefined),
        source: 'fattura_emessa',
        xmlRef: {
          supplier: client || newCantiereName || 'COMMITTENTE',
          invoiceNum: docNumber.trim(),
        },
      };

      onCreateIssuedInvoice({
        createNewCantiere: true,
        newCantiereData: {
          // Nome cantiere in maiuscolo
          name: newCantiereName.toUpperCase().trim(),
          city: newCantiereCity.toUpperCase().trim(),
          // Solo via e numero civico in maiuscolo
          address: cantiereAddress.toUpperCase().trim() || '',
          date,
          year: new Date(date).getFullYear() || 2026,
          // Nome cantiere e committente coincidono sempre: tieni solo il nome cantiere
          client: newCantiereName.toUpperCase().trim(),
          initialInventory: parseFloat(initialInventory.replace(',', '.')) || 0,
          category: 'misto', // compatibilità interna: categoria lavori rimossa dall'interfaccia
          notes: notes || undefined,
        },
        movement,
      });
    } else {
      if (!selectedCantiereId) {
        setFormError('Seleziona una Scheda Cantiere di destinazione.');
        return;
      }

      setFormError(null);

      const movement: Movement = {
        id: `mov-emessa-${Date.now()}`,
        date,
        docNumber: docNumber.trim(),
        // REGOLA 5: Quando si inserisce una fattura emessa nel cantiere nella descrizione basta scrivere EMESSE
        typeAndSubject: 'EMESSE',
        // REGOLA 1: Protocollo interno studio = numero di fattura
        protocol: finalProtocol,
        purchases: 0,
        issued: numericAmount,
        notes: notes || (parsedXml ? `Importata da XML: ${parsedXml.fileName}` : undefined),
        source: 'fattura_emessa',
        xmlRef: {
          supplier: client || 'COMMITTENTE',
          invoiceNum: docNumber.trim(),
        },
      };

      onCreateIssuedInvoice({
        createNewCantiere: false,
        cantiereId: selectedCantiereId,
        movement,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full my-8 p-5 sm:p-6 shadow-2xl relative text-left"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 border-b border-slate-800 pb-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Importazione Fattura Emessa (Vendita)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Ricavi Cantieri
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analisi intelligente XML con confronto testata/corpo per l'indirizzo cantiere e verifica preventiva prima della registrazione.
            </p>
          </div>
        </div>

        {/* Tabs: XML Import vs Manual */}
        <div className="flex items-center gap-2 mb-5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('xml_import')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'xml_import'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Importazione Intelligente XML (Consigliato)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Inserimento Rapido Manuale</span>
          </button>
        </div>

        {/* TAB 1: XML IMPORT & VERIFICATION SCREEN */}
        {activeTab === 'xml_import' && !isVerifying && (
          <div className="space-y-5">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-6 sm:p-8 text-center transition-colors bg-slate-950/50 flex flex-col items-center justify-center gap-3 cursor-pointer relative"
            >
              <input
                type="file"
                accept=".xml,text/xml"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <FileUp className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Trascina qui il file XML della Fattura Emessa oppure clicca per selezionarlo
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supporta formato FatturaPA / B2B FPR12 (.xml)
                </p>
              </div>
            </div>

            {/* Error Message */}
            {xmlError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{xmlError}</span>
              </div>
            )}

            {/* Preloaded realistic test scenarios */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Oppure prova uno scenario di test già pronto:</span>
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SAMPLE_ISSUED_INVOICES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="text-left p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-white group-hover:text-amber-300 mb-1">
                      <span>{sample.name}</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(sample.amount)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {sample.scenario}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400/90 font-medium">
                      <span>Regola: {sample.ruleExpected === 'corpo_diverso' ? 'Corpo ≠ Testata (Indirizzo cantiere da corpo)' : 'Sede coincide con cantiere'}</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VERIFICATION SCREEN (Schermata di verifica preventiva richiesta) */}
        {activeTab === 'xml_import' && isVerifying && parsedXml && (
          <div className="space-y-5">
            {/* Header of verification screen */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Schermata di Verifica Preventiva Fattura Emessa
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    File: <span className="font-mono text-amber-300">{parsedXml.fileName}</span> — Verifica l'estrazione e modifica prima di registrare.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVerifying(false);
                  setParsedXml(null);
                }}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Carica altro file
              </button>
            </div>

            {/* RULE APPLICATION BANNER (Testata vs Corpo) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-amber-400" />
                  <span>Analisi Indirizzo Cantiere (Regola di Business)</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    parsedXml.regolaIndirizzoApplicata === 'corpo_diverso'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  }`}
                >
                  {parsedXml.regolaIndirizzoApplicata === 'corpo_diverso'
                    ? 'Regola: Corpo ≠ Testata'
                    : 'Regola: Sede Testata'}
                </span>
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. Header address */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    <span>Sede Committente in Testata:</span>
                  </span>
                  <p className="text-slate-200 font-medium">{parsedXml.indirizzoTestata}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {parsedXml.committente.denominazione} • P.IVA {parsedXml.committente.partitaIva || parsedXml.committente.codiceFiscale || 'N/D'}
                  </p>
                </div>

                {/* 2. Body address */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-amber-400" />
                    <span>Indirizzo rilevato nel Corpo (Dati resa / cantiere):</span>
                  </span>
                  <p className="text-slate-200 font-medium">
                    {parsedXml.indirizzoCorpo || (
                      <span className="text-slate-500 italic">Nessun indirizzo alternativo nel corpo</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {parsedXml.indirizzoCorpo ? 'Rilevato in DatiTrasporto/Righe/AltriDati' : 'Corrisponde alla sede o non presente'}
                  </p>
                </div>
              </div>

              {/* Explanation note */}
              <div
                className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                  parsedXml.regolaIndirizzoApplicata === 'corpo_diverso'
                    ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500/30'
                    : 'bg-blue-950/40 text-blue-200 border-blue-500/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Esito Regola: </strong>
                    <span>{parsedXml.spiegazioneRegola}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dati Fiscali XML: Imponibile vs Totale Documento */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-emerald-400" />
                  <span>Dati Fiscali XML: Solo Imponibile (Regola Contabile)</span>
                </span>
                {parsedXml.datiDocumento.isNotaCredito ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                    Nota di Credito ({parsedXml.datiDocumento.tipoDocumento}) • Importo Negativo a Storno
                  </span>
                ) : (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      parsedXml.datiDocumento.riepilogoIVA && parsedXml.datiDocumento.riepilogoIVA.length > 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {parsedXml.datiDocumento.riepilogoIVA && parsedXml.datiDocumento.riepilogoIVA.length > 1
                      ? `${parsedXml.datiDocumento.riepilogoIVA.length} Aliquote IVA (Totale Imponibili)`
                      : 'Importa Solo Imponibile'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {/* 1. Imponibile Importato */}
                <div
                  className={`p-3 rounded-lg bg-slate-900 border ${
                    parsedXml.datiDocumento.isNotaCredito ? 'border-purple-500/40' : 'border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold block ${
                      parsedXml.datiDocumento.isNotaCredito ? 'text-purple-400' : 'text-emerald-400'
                    }`}
                  >
                    {parsedXml.datiDocumento.isNotaCredito
                      ? 'Imponibile Nota Credito (Storno):'
                      : 'Totale Imponibile (Da Importare):'}
                  </span>
                  <div
                    className={`font-mono font-extrabold text-base mt-0.5 ${
                      parsedXml.datiDocumento.isNotaCredito ? 'text-purple-300' : 'text-emerald-300'
                    }`}
                  >
                    {formatCurrency(parsedXml.datiDocumento.imponibileTotale)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {parsedXml.datiDocumento.isNotaCredito
                      ? 'Importo negativo registrato nella colonna EMESSE'
                      : 'Registrato nella colonna EMESSE del cantiere'}
                  </span>
                </div>

                {/* 2. Totale Documento Lordo */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Totale Fattura (Con IVA):
                  </span>
                  <div className="text-slate-300 font-mono font-bold text-base mt-0.5">
                    {formatCurrency(parsedXml.datiDocumento.importoTotale)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Importo lordo comprensivo di imposta
                  </span>
                </div>

                {/* 3. Dettaglio Aliquote IVA */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Riepilogo IVA Documento:
                  </span>
                  {parsedXml.datiDocumento.riepilogoIVA && parsedXml.datiDocumento.riepilogoIVA.length > 0 ? (
                    <div className="space-y-1 mt-1 font-mono text-[11px]">
                      {parsedXml.datiDocumento.riepilogoIVA.map((r, i) => (
                        <div key={i} className="flex justify-between items-center text-slate-300">
                          <span>IVA {r.aliquotaIVA}%:</span>
                          <span className="font-semibold text-emerald-300">
                            imp. {formatCurrency(r.imponibile)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-300 font-mono text-xs mt-1">
                      Imponibile: {formatCurrency(parsedXml.datiDocumento.imponibileTotale)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VERIFICATION / MANUAL FORM */}
        {(activeTab === 'manual' || (activeTab === 'xml_import' && isVerifying)) && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Destination Mode: New Cantiere vs Existing Cantiere */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Destinazione Contabile del Ricavo
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    createNewCantiere
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="destMode"
                    checked={createNewCantiere}
                    onChange={() => setCreateNewCantiere(true)}
                    className="mt-0.5 text-amber-500 focus:ring-amber-400"
                  />
                  <div>
                    <span className="text-xs font-bold block text-white">
                      Crea Nuova Scheda Cantiere
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Apre automaticamente una nuova scheda con l'indirizzo cantiere determinato
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    !createNewCantiere
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  } ${cantieri.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="destMode"
                    disabled={cantieri.length === 0}
                    checked={!createNewCantiere}
                    onChange={() => setCreateNewCantiere(false)}
                    className="mt-0.5 text-amber-500 focus:ring-amber-400"
                  />
                  <div>
                    <span className="text-xs font-bold block text-white">
                      Assegna a Cantiere Esistente
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Registra l'importo nella colonna EMESSE di un cantiere già aperto
                    </span>
                  </div>
                </label>
              </div>

              {!createNewCantiere && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Seleziona Scheda Cantiere:
                  </label>
                  <select
                    value={selectedCantiereId}
                    onChange={(e) => setSelectedCantiereId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                  >
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.toUpperCase()} ({c.city.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* If New Cantiere, configure cantiere name, address, city, RI */}
            {createNewCantiere && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Dati Nuova Scheda Cantiere (Verifica e Modifica Libera)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Solo Via e Civico • Nome in Maiuscolo
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Nome Cantiere (COGNOME NOME in maiuscolo) *
                    </label>
                    <input
                      type="text"
                      value={newCantiereName}
                      onChange={(e) => setNewCantiereName(e.target.value.toUpperCase())}
                      placeholder="es. ROSSI MARIO"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Senza la scritta cantiere e senza il paese tra parentesi
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Indirizzo Cantiere (Solo Via e Civico in Maiuscolo) *
                    </label>
                    <input
                      type="text"
                      value={cantiereAddress}
                      onChange={(e) => setCantiereAddress(e.target.value.toUpperCase())}
                      placeholder="es. VIA MONTE NAPOLEONE 18"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Solo via e numero civico in maiuscolo (esclusi dati catastali e note)
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Città Cantiere (in Maiuscolo) *
                    </label>
                    <input
                      type="text"
                      value={newCantiereCity}
                      onChange={(e) => setNewCantiereCity(e.target.value.toUpperCase())}
                      placeholder="es. MONZA"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      R.I. (Rimanenze Iniziali all'avvio)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">€</span>
                      <input
                        type="text"
                        value={initialInventory}
                        onChange={(e) => setInitialInventory(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Document Details Form */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Dati Documento Fiscale (Fattura Emessa)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nome Cantiere (Committente) *
                  </label>
                  <input
                    type="text"
                    value={createNewCantiere ? newCantiereName : (cantieri.find(c => c.id === selectedCantiereId)?.name || client)}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase();
                      setClient(upper);
                      if (createNewCantiere) {
                        setNewCantiereName(upper);
                      }
                    }}
                    placeholder="es. ROSSI MARIO"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Coincide sempre con il cantiere</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    N° Fattura Emessa *
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDocNumber(val);
                      // Il protocollo interno studio per le fatture emesse è sempre il numero di fattura
                      setProtocol(val);
                    }}
                    placeholder="es. 2/00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Data Documento *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <span>Importo Emesso (Solo Imponibile) *</span>
                      {parseFloat(amount.replace(',', '.')) < 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                          Nota di Credito (Negativo)
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = amount.trim();
                        if (!clean) return;
                        if (clean.startsWith('-')) {
                          setAmount(clean.substring(1));
                        } else {
                          setAmount('-' + clean);
                        }
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Cambia segno tra positivo e negativo per Nota di Credito"
                    >
                      ± Inverti Segno (+ / -)
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">€</span>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="es. 8500.00 o -1500.00"
                      className={`w-full bg-slate-900 border rounded-lg pl-8 pr-3 py-2 font-mono font-bold text-sm focus:outline-none focus:border-amber-400 ${
                        parseFloat(amount.replace(',', '.')) < 0
                          ? 'text-purple-300 border-purple-500/50'
                          : 'text-white border-slate-700'
                      }`}
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Importa solo l'imponibile. Per le <strong className="text-purple-300">Note di Credito (TD04)</strong> l'importo è registrato con <strong className="text-purple-300">segno negativo</strong> a storno ricavi.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Protocollo Interno Studio</span>
                    <span className="text-[10px] text-amber-400 font-normal">Sempre = N° Fattura</span>
                  </label>
                  <input
                    type="text"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    placeholder="es. 2/00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se la fattura è la 2/00 il protocollo è 2/00
                  </p>
                </div>

                <div className="sm:col-span-2 md:col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Descrizione Movimento</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Standard: EMESSE</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="EMESSE"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nel cantiere verrà registrato nella colonna Tipo Doc. come <strong className="text-emerald-400">EMESSE</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Conferma e Registra Fattura Emessa</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Duplicate issued invoice confirmation modal */}
      {duplicatePromptLocations && (
        <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-left space-y-4 animate-scaleIn">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Fattura Emessa già presente
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  La fattura emessa <strong className="text-amber-300 font-mono">N° {docNumber.trim()}</strong> risulta già registrata nel sistema nei seguenti cantieri:
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 max-h-52 overflow-y-auto">
              {duplicatePromptLocations.map((loc, idx) => (
                <div key={idx} className="text-xs flex items-center justify-between gap-2 border-b border-slate-800/80 last:border-0 pb-1.5 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
                      <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>{loc.cantiereName}</span>
                      {loc.client && <span className="text-[11px] text-slate-400 truncate">({loc.client})</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      Doc: {loc.docNumber} • Data: {formatDateItalian(loc.date)}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400 whitespace-nowrap shrink-0">
                    {formatCurrency(loc.amount)}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-200">
              Sei sicuro di voler procedere comunque con l'importazione di questa fattura emessa?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDuplicatePromptLocations(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                No, non importare
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicatePromptLocations(null);
                  handleSubmit(undefined, true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Sì, procedi con l'importazione</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
