import React, { useState } from 'react';
import {
  X,
  FileUp,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  Split,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  Percent,
  Plus,
  Trash2,
  HelpCircle,
  Clock,
  Ban,
  Filter,
  Edit3,
  Pencil,
  Tag,
  FileText,
  MinusCircle,
  Undo2,
  Paperclip,
  Eye,
  Download,
} from 'lucide-react';
import { Cantiere, ParsedInvoiceXML, Movement, SospesoItem, AttachmentPdf } from '../types';
import { parseFatturaElettronicaXML } from '../utils/xmlParser';
import { SAMPLE_INVOICES, SampleInvoice } from '../utils/sampleInvoices';
import { formatCurrency, formatDateItalian } from '../utils/calculations';
import { fileToAttachmentPdf, openOrDownloadPdf } from '../utils/pdfStorage';
import {
  findExistingPurchaseInvoiceLocations,
  InvoiceLocation,
  formatSingleDdtTag,
  buildFormattedTypeAndSubject,
} from '../utils/invoiceDuplicateHelper';
import { CantiereSearchSelect } from './CantiereSearchSelect';
import { CantiereModal } from './CantiereModal';

interface XmlImportModalProps {
  cantieri: Cantiere[];
  sospesi?: SospesoItem[];
  preselectedCantiereId?: string | null;
  onClose: () => void;
  onCommitAllocations: (
    movementsByCantiere: { cantiereId: string; movement: Movement }[],
    sospesiCommitList?: Omit<SospesoItem, 'id' | 'createdAt'>[]
  ) => void;
  onCommitSospesi?: (items: Omit<SospesoItem, 'id' | 'createdAt'>[]) => void;
  onOpenNewCantiere: () => void;
  onCreateNewCantiereDirectly?: (data: Partial<Cantiere>) => Cantiere;
}

type AllocationMode = 'whole' | 'by_ddt' | 'by_line';

interface LineAllocation {
  targetCantiereId: string;
  // Multi-split support
  isSplit: boolean;
  splits: Array<{ cantiereId: string; percentage: number; amount: number }>;
  aiSuggestion?: {
    suggestedCantiereId: string;
    confidence: number;
    reasoning: string;
  };
}

interface DdtAllocation {
  targetCantiereId: string;
  isSplit: boolean;
  splits: Array<{ cantiereId: string; percentage: number; amount: number }>;
  aiSuggestion?: {
    suggestedCantiereId: string;
    confidence: number;
    reasoning: string;
  };
}

export const XmlImportModal: React.FC<XmlImportModalProps> = ({
  cantieri,
  sospesi = [],
  preselectedCantiereId,
  onClose,
  onCommitAllocations,
  onCommitSospesi,
  onOpenNewCantiere,
  onCreateNewCantiereDirectly,
}) => {
  const [xmlContent, setXmlContent] = useState<string>('');
  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoiceXML | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Additional cantieri created on-the-fly during this import session
  const [localExtraCantieri, setLocalExtraCantieri] = useState<Cantiere[]>([]);

  // Merged cantieri list including any newly created cantieri during this modal session
  const allCantieri: Cantiere[] = React.useMemo(() => {
    const map = new Map<string, Cantiere>();
    cantieri.forEach((c) => map.set(c.id, c));
    localExtraCantieri.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [cantieri, localExtraCantieri]);

  // Duplicate invoice prompt state
  const [duplicatePromptLocations, setDuplicatePromptLocations] = useState<InvoiceLocation[] | null>(null);

  // Allocation Mode
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('by_line');
  // Leave empty / DA SELEZIONARE by default so the user must explicitly choose or confirm
  const [wholeInvoiceCantiereId, setWholeInvoiceCantiereId] = useState<string>('');
  const [showValidationErrors, setShowValidationErrors] = useState<boolean>(false);

  // Allocations mapping
  const [lineAllocations, setLineAllocations] = useState<Record<number, LineAllocation>>({});
  const [ddtAllocations, setDdtAllocations] = useState<Record<string, DdtAllocation>>({});

  // Mode 2 (by_ddt): which DDT drawers are expanded and which lines are excluded
  const [expandedDdts, setExpandedDdts] = useState<Record<string, boolean>>({});
  const [excludedLines, setExcludedLines] = useState<Record<number, boolean>>({});

  // AI Loading & Status
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // User-customizable Invoice Number (so it matches what is seen in accounting)
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState<string>('');
  // User-customizable Protocol Number (entered manually by user to match accounting registration protocol)
  const [customProtocol, setCustomProtocol] = useState<string>('');
  // User-customizable DDT Names (so each DDT can be renamed before being reported into the cantiere)
  const [customDdtNames, setCustomDdtNames] = useState<Record<string, string>>({});
  // Flag indicating whether this document is a Nota di Credito (Credit Note) with negative amounts
  const [isNotaDiCredito, setIsNotaDiCredito] = useState<boolean>(false);

  // Attached PDF of the purchase invoice
  const [attachedPdf, setAttachedPdf] = useState<AttachmentPdf | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  const handlePdfFileSelect = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Seleziona un file valido in formato PDF (.pdf).');
      return;
    }
    try {
      setIsUploadingPdf(true);
      const pdfData = await fileToAttachmentPdf(file);
      setAttachedPdf(pdfData);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Errore caricamento PDF:', err);
      setErrorMessage('Errore durante il caricamento del PDF: ' + (err.message || 'file non leggibile'));
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Helper to resolve custom DDT name or nice default
  const getDdtDisplayName = (numeroDDT: string) => {
    const custom = customDdtNames[numeroDDT]?.trim();
    if (custom) return custom;
    return numeroDDT.toUpperCase().startsWith('DDT') ? numeroDDT : `DDT ${numeroDDT}`;
  };

  // Real-time check if invoice is already present in any cantiere or sospesi
  const existingDuplicates = React.useMemo(() => {
    if (!parsedInvoice) return [];
    const invNum = (customInvoiceNumber && customInvoiceNumber.trim()) || parsedInvoice.datiDocumento.numero;
    return findExistingPurchaseInvoiceLocations(
      invNum,
      parsedInvoice.cedentePrestatore.denominazione,
      allCantieri,
      sospesi,
      parsedInvoice.fileName
    );
  }, [parsedInvoice, customInvoiceNumber, allCantieri, sospesi]);

  // Total Imponibile (considera solo l'imponibile e se ci sono più aliquote IVA somma tutti gli imponibili)
  const invoiceImponibile = React.useMemo(() => {
    if (!parsedInvoice) return 0;
    if (parsedInvoice.datiDocumento.totaleImponibile && parsedInvoice.datiDocumento.totaleImponibile !== 0) {
      return Math.abs(parsedInvoice.datiDocumento.totaleImponibile);
    }
    const linesSum = (parsedInvoice.righe || []).reduce((s, r) => s + Math.abs(r.prezzoTotale || 0), 0);
    if (linesSum > 0) return Math.round(linesSum * 100) / 100;
    return Math.abs(parsedInvoice.datiDocumento.importoTotale || 0);
  }, [parsedInvoice]);

  // Proponi i cantieri in ordine di CITTA - VIA
  const sortedCantieri = React.useMemo(() => {
    return [...cantieri].sort((a, b) => {
      const cityA = (a.city || '').trim().toLowerCase();
      const cityB = (b.city || '').trim().toLowerCase();
      const cityCmp = cityA.localeCompare(cityB, 'it');
      if (cityCmp !== 0) return cityCmp;
      const addrA = (a.address || '').trim().toLowerCase();
      const addrB = (b.address || '').trim().toLowerCase();
      return addrA.localeCompare(addrB, 'it');
    });
  }, [cantieri]);

  // Formatta etichetta cantiere per select: "CITTA - VIA (NOME CLIENTE)"
  const formatCantiereSelectOption = (c: Cantiere): string => {
    const city = (c.city || '').trim();
    const addr = (c.address || '').trim();
    const location = [city, addr].filter(Boolean).join(' - ');
    const clientName = (c.client || c.name || 'Cliente non specificato').trim();
    if (location) {
      return `${location} (${clientName})`;
    }
    return `${c.name} (${clientName})`;
  };

  // Context to know which allocation triggered the "Nuovo Cantiere" modal
  interface CreateCantiereTargetContext {
    mode: 'whole' | 'ddt' | 'line' | 'line_split';
    key?: string | number;
    splitIndex?: number;
  }
  const [createCantiereContext, setCreateCantiereContext] = useState<CreateCantiereTargetContext | null>(null);

  const openCreateCantiereModal = (context: CreateCantiereTargetContext) => {
    setCreateCantiereContext(context);
  };

  const handleSaveNewCantiereFromModal = (cantiereData: Partial<Cantiere>) => {
    let newCantiere: Cantiere;
    if (onCreateNewCantiereDirectly) {
      newCantiere = onCreateNewCantiereDirectly(cantiereData);
    } else {
      const upperName = (cantiereData.name || 'NUOVO CANTIERE').trim().toUpperCase();
      const upperCity = (cantiereData.city || cantieri[0]?.city || 'MILANO').trim().toUpperCase();
      const upperAddress = cantiereData.address?.trim() ? cantiereData.address.trim().toUpperCase() : '';

      newCantiere = {
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

    // Immediately register in local cantieri list so it shows up in combobox and select lists
    setLocalExtraCantieri((prev) => [...prev, newCantiere]);

    // Automatically select the newly created cantiere in the active allocation field
    if (createCantiereContext) {
      if (createCantiereContext.mode === 'whole') {
        setWholeInvoiceCantiereId(newCantiere.id);
        setErrorMessage(null);
      } else if (createCantiereContext.mode === 'ddt' && createCantiereContext.key) {
        setDdtAllocations((prev) => ({
          ...prev,
          [String(createCantiereContext.key)]: {
            ...prev[String(createCantiereContext.key)],
            targetCantiereId: newCantiere.id,
          },
        }));
        setErrorMessage(null);
      } else if (createCantiereContext.mode === 'line' && createCantiereContext.key !== undefined) {
        const lineNum = Number(createCantiereContext.key);
        setLineAllocations((prev) => ({
          ...prev,
          [lineNum]: {
            ...prev[lineNum],
            targetCantiereId: newCantiere.id,
          },
        }));
        setErrorMessage(null);
      } else if (
        createCantiereContext.mode === 'line_split' &&
        createCantiereContext.key !== undefined &&
        createCantiereContext.splitIndex !== undefined
      ) {
        const lineNum = Number(createCantiereContext.key);
        const sIdx = createCantiereContext.splitIndex;
        const currentLine = lineAllocations[lineNum];
        if (currentLine && currentLine.splits[sIdx]) {
          handleUpdateLineSplit(
            lineNum,
            sIdx,
            newCantiere.id,
            currentLine.splits[sIdx].percentage,
            parsedInvoice?.righe.find((r) => r.numeroLinea === lineNum)?.prezzoTotale || 0
          );
        }
        setErrorMessage(null);
      }
    }

    setCreateCantiereContext(null);
  };

  // Handle file select or drop (supports XML and PDF)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      handlePdfFileSelect(file);
      return;
    }
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const xmlFile = files.find(
      (f) => f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.p7m')
    );
    const pdfFile = files.find(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );

    if (pdfFile) {
      handlePdfFileSelect(pdfFile);
    }
    if (xmlFile) {
      readFile(xmlFile);
    } else if (!pdfFile && files[0]) {
      readFile(files[0]);
    }
  };

  const readFile = (file: File) => {
    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      handlePdfFileSelect(file);
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseAndSetXml(text, file.name);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Errore durante la lettura del file');
    };
    reader.readAsText(file);
  };

  const parseAndSetXml = (xmlStr: string, fileName = 'fattura.xml') => {
    try {
      setErrorMessage(null);
      const parsed = parseFatturaElettronicaXML(xmlStr, fileName);
      setParsedInvoice(parsed);
      setXmlContent(xmlStr);

      // If the electronic invoice XML includes an embedded PDF, use it automatically
      if (parsed.pdfAttachment && !attachedPdf) {
        setAttachedPdf(parsed.pdfAttachment);
      }

      // Initialize editable invoice number with what came from XML
      setCustomInvoiceNumber(parsed.datiDocumento.numero);
      setCustomProtocol('');

      // Auto-detect if document is a Nota di Credito (TD04, TD08 or NC text)
      const isNC =
        parsed.datiDocumento.tipoDocumento === 'TD04' ||
        parsed.datiDocumento.tipoDocumento === 'TD08' ||
        /nota\s+di\s+credito/i.test(parsed.datiDocumento.causale?.join(' ') || '') ||
        /^(NC|NDC|N\.C\.)/i.test(parsed.datiDocumento.numero);
      setIsNotaDiCredito(isNC);

      // Initialize default allocation for each line: leave EMPTY / DA SELEZIONARE as requested
      const initLines: Record<number, LineAllocation> = {};
      parsed.righe.forEach((r) => {
        initLines[r.numeroLinea] = {
          targetCantiereId: '',
          isSplit: false,
          splits: [
            { cantiereId: '', percentage: 100, amount: r.prezzoTotale },
          ],
        };
      });
      setLineAllocations(initLines);

      // Initialize default allocation and customizable names for each DDT: leave EMPTY / DA SELEZIONARE
      const initDdts: Record<string, DdtAllocation> = {};
      const initDdtNames: Record<string, string> = {};
      parsed.ddtList.forEach((d) => {
        initDdts[d.numeroDDT] = {
          targetCantiereId: '',
          isSplit: false,
          splits: [
            { cantiereId: '', percentage: 100, amount: d.totaleDDT || 0 },
          ],
        };
        initDdtNames[d.numeroDDT] = d.numeroDDT.toUpperCase().startsWith('DDT')
          ? d.numeroDDT
          : `DDT ${d.numeroDDT}`;
      });
      setDdtAllocations(initDdts);
      setCustomDdtNames(initDdtNames);
      setExcludedLines({});
      setWholeInvoiceCantiereId('');
      setShowValidationErrors(false);
      setExpandedDdts(parsed.ddtList.length > 0 ? { [parsed.ddtList[0].numeroDDT]: true } : {});

      if (parsed.ddtList.length > 0) {
        setAllocationMode('by_ddt');
      } else {
        setAllocationMode('by_line');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Errore nel parsing del file XML');
      setParsedInvoice(null);
    }
  };

  const handleLoadSample = (sample: SampleInvoice) => {
    parseAndSetXml(sample.xml, `${sample.supplier.replace(/\s+/g, '_')}.xml`);
  };

  // Trigger Gemini AI suggestion
  const handleAskGeminiAi = async () => {
    if (!parsedInvoice) return;
    if (allCantieri.length === 0) {
      setErrorMessage('Non ci sono cantieri registrati. Crea prima un cantiere.');
      return;
    }

    setIsAiLoading(true);
    setAiSuccessMessage(null);
    setErrorMessage(null);

    try {
      const itemsPayload =
        allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0
          ? parsedInvoice.ddtList.map((d) => {
              const connectedLines = parsedInvoice.righe.filter((r) =>
                d.riferimentoLinee.includes(r.numeroLinea)
              );
              const descriptions = connectedLines.map((l) => l.descrizione).join('; ');
              return {
                id: d.numeroDDT,
                description: `DDT ${d.numeroDDT} (data ${d.dataDDT || 'N/D'}): ${descriptions}`,
                amount: d.totaleDDT || 0,
                supplier: parsedInvoice.cedentePrestatore.denominazione,
                ddtNumber: d.numeroDDT,
                ddtDate: d.dataDDT,
              };
            })
          : parsedInvoice.righe.map((r) => ({
              id: String(r.numeroLinea),
              description: r.descrizione,
              amount: r.prezzoTotale,
              supplier: parsedInvoice.cedentePrestatore.denominazione,
              ddtNumber: r.ddtNumero,
              ddtDate: r.ddtData,
            }));

      const cantieriPayload = allCantieri.map((c: Cantiere) => ({
        id: c.id,
        name: c.name,
        client: c.client,
        city: c.city,
        year: c.year,
        notes: c.notes,
      }));

      const response = await fetch('/api/gemini/suggest-cantiere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          cantieri: cantieriPayload,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Errore nella richiesta di suggerimento AI');
      }

      const data = await response.json();
      const suggestions = data.suggestions as Array<{
        itemId: string;
        suggestedCantiereId: string;
        confidence: number;
        reasoning: string;
      }>;

      if (!suggestions || suggestions.length === 0) {
        throw new Error('Nessun suggerimento restituito dal modello');
      }

      // Apply suggestions to state
      if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
        setDdtAllocations((prev) => {
          const updated = { ...prev };
          suggestions.forEach((s) => {
            if (updated[s.itemId]) {
              updated[s.itemId] = {
                ...updated[s.itemId],
                targetCantiereId: s.suggestedCantiereId,
                aiSuggestion: {
                  suggestedCantiereId: s.suggestedCantiereId,
                  confidence: s.confidence,
                  reasoning: s.reasoning,
                },
              };
            }
          });
          return updated;
        });
      } else {
        setLineAllocations((prev) => {
          const updated = { ...prev };
          suggestions.forEach((s) => {
            const lineNum = parseInt(s.itemId, 10);
            if (updated[lineNum]) {
              updated[lineNum] = {
                ...updated[lineNum],
                targetCantiereId: s.suggestedCantiereId,
                aiSuggestion: {
                  suggestedCantiereId: s.suggestedCantiereId,
                  confidence: s.confidence,
                  reasoning: s.reasoning,
                },
              };
            }
          });
          return updated;
        });
      }

      setAiSuccessMessage(
        `Gemini AI ha analizzato ${suggestions.length} articoli e associato i cantieri con motivazione tecnica.`
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Errore durante l\'analisi AI');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Multi-split helpers for a line
  const handleToggleSplitLine = (lineNum: number, totalAmount: number) => {
    setLineAllocations((prev) => {
      const current = prev[lineNum];
      const nextIsSplit = !current.isSplit;
      if (nextIsSplit) {
        return {
          ...current,
          isSplit: true,
          splits: [
            { cantiereId: current.targetCantiereId || '', percentage: 50, amount: Math.round(totalAmount * 0.5 * 100) / 100 },
            { cantiereId: '', percentage: 50, amount: Math.round(totalAmount * 0.5 * 100) / 100 },
          ],
        };
      } else {
        return {
          ...current,
          isSplit: false,
          splits: [{ cantiereId: current.targetCantiereId, percentage: 100, amount: totalAmount }],
        };
      }
    });
  };

  const handleUpdateLineSplit = (
    lineNum: number,
    splitIndex: number,
    cantiereId: string,
    percentage: number,
    totalAmount: number
  ) => {
    setLineAllocations((prev) => {
      const current = prev[lineNum];
      const splits = [...current.splits];
      const newAmount = Math.round(((totalAmount * percentage) / 100) * 100) / 100;
      splits[splitIndex] = { cantiereId, percentage, amount: newAmount };
      return { ...current, splits };
    });
  };

  // Mode 2 (by_ddt): toggle expansion of a single DDT
  const toggleExpandDdt = (ddtNumber: string) => {
    setExpandedDdts((prev) => ({
      ...prev,
      [ddtNumber]: !prev[ddtNumber],
    }));
  };

  const handleExpandAllDdts = () => {
    if (!parsedInvoice) return;
    const allExp: Record<string, boolean> = {};
    parsedInvoice.ddtList.forEach((d) => {
      allExp[d.numeroDDT] = true;
    });
    setExpandedDdts(allExp);
  };

  const handleCollapseAllDdts = () => {
    setExpandedDdts({});
  };

  // Mode 2 (by_ddt): manually toggle exclusion of a specific line item
  const toggleExcludeLine = (lineNum: number) => {
    setExcludedLines((prev) => {
      const next = { ...prev };
      if (next[lineNum]) {
        delete next[lineNum];
      } else {
        next[lineNum] = true;
      }
      return next;
    });
  };

  // Mode 2 (by_ddt): Ripartizione proporzionale oneri accessori orfani (spese incasso, CONAI, spese amministrative)
  const [isOrphanExpensesExpanded, setIsOrphanExpensesExpanded] = useState<boolean>(true);

  const handleProrateOrphanExpenses = () => {
    if (!parsedInvoice || parsedInvoice.orphanExpenses.length === 0) return;
    const cantiereTotals = new Map<string, number>();
    let totalDdtActiveAssigned = 0;

    parsedInvoice.ddtList.forEach((ddt) => {
      const alloc = ddtAllocations[ddt.numeroDDT];
      if (!alloc || alloc.targetCantiereId === '__ignore__' || alloc.targetCantiereId === '__sospeso__' || !alloc.targetCantiereId) {
        return;
      }
      const connected = parsedInvoice.righe.filter((r) => ddt.riferimentoLinee.includes(r.numeroLinea));
      const active = connected.filter((r) => !excludedLines[r.numeroLinea]);
      const tot = connected.length > 0 ? active.reduce((s, r) => s + r.prezzoTotale, 0) : (ddt.totaleDDT || 0);
      if (tot > 0) {
        cantiereTotals.set(alloc.targetCantiereId, (cantiereTotals.get(alloc.targetCantiereId) || 0) + tot);
        totalDdtActiveAssigned += tot;
      }
    });

    if (cantiereTotals.size === 0 || totalDdtActiveAssigned <= 0) {
      setErrorMessage(
        'Assegna prima almeno un DDT a un cantiere valido per poter calcolare la ripartizione proporzionale delle spese accessorie.'
      );
      return;
    }

    if (cantiereTotals.size === 1) {
      const singleCantiereId = Array.from(cantiereTotals.keys())[0];
      setLineAllocations((prev) => {
        const next = { ...prev };
        parsedInvoice.orphanExpenses.forEach((exp) => {
          next[exp.numeroLinea] = {
            targetCantiereId: singleCantiereId,
            isSplit: false,
            splits: [{ cantiereId: singleCantiereId, percentage: 100, amount: exp.prezzoTotale }],
          };
        });
        return next;
      });
      setAiSuccessMessage(
        `Oneri accessori (€ ${parsedInvoice.totaleOneriAccessori.toFixed(2)}) imputati interamente all'unico cantiere dei DDT assegnati.`
      );
      setErrorMessage(null);
      return;
    }

    const cantiereList = Array.from(cantiereTotals.entries());
    setLineAllocations((prev) => {
      const next = { ...prev };
      parsedInvoice.orphanExpenses.forEach((exp) => {
        let allocatedAmountSoFar = 0;
        const splits = cantiereList.map(([cId, tot], idx) => {
          const isLast = idx === cantiereList.length - 1;
          const percentage = Math.round((tot / totalDdtActiveAssigned) * 1000) / 10;
          let amount = Math.round(((exp.prezzoTotale * tot) / totalDdtActiveAssigned) * 100) / 100;
          if (isLast) {
            amount = Math.round((exp.prezzoTotale - allocatedAmountSoFar) * 100) / 100;
          } else {
            allocatedAmountSoFar += amount;
          }
          return { cantiereId: cId, percentage, amount };
        });

        next[exp.numeroLinea] = {
          targetCantiereId: cantiereList[0][0],
          isSplit: true,
          splits,
        };
      });
      return next;
    });

    setAiSuccessMessage(
      `Oneri accessori (€ ${parsedInvoice.totaleOneriAccessori.toFixed(2)}) ripartiti proporzionalmente sui ${cantiereTotals.size} cantieri assegnati ai DDT.`
    );
    setErrorMessage(null);
  };

  const handleSetAllOrphanExpenses = (targetCantiereId: string) => {
    if (!parsedInvoice || parsedInvoice.orphanExpenses.length === 0) return;
    setLineAllocations((prev) => {
      const next = { ...prev };
      parsedInvoice.orphanExpenses.forEach((exp) => {
        next[exp.numeroLinea] = {
          targetCantiereId,
          isSplit: false,
          splits: [{ cantiereId: targetCantiereId, percentage: 100, amount: exp.prezzoTotale }],
        };
      });
      return next;
    });
    if (targetCantiereId) setErrorMessage(null);
  };

  // Live calculation of totals: Cantieri vs Sospesi vs Esclusi (Non Considerare) vs Da Selezionare con conservazione del segno algebrico
  const computedStats = React.useMemo(() => {
    if (!parsedInvoice) {
      return {
        cantieri: 0,
        sospesi: 0,
        cantieriPlusSospesi: 0,
        ignored: 0,
        unassigned: 0,
        unassignedCount: 0,
        total: 0,
        imponibileTotal: 0,
        isNotaDiCredito: false,
        differenzaQuadratura: 0,
        isQuadraturaPerfetta: true,
      };
    }
    let cantieriSum = 0;
    let sospesiSum = 0;
    let ignoredSum = 0;
    let unassignedSum = 0;
    let unassignedCount = 0;

    if (allocationMode === 'whole') {
      const tot = invoiceImponibile;
      if (wholeInvoiceCantiereId === '__ignore__') {
        ignoredSum += tot;
      } else if (wholeInvoiceCantiereId === '__sospeso__') {
        sospesiSum += tot;
      } else if (wholeInvoiceCantiereId && wholeInvoiceCantiereId.trim()) {
        cantieriSum += tot;
      } else {
        unassignedSum += tot;
        unassignedCount += 1;
      }
    } else if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
      // 1. DDT
      parsedInvoice.ddtList.forEach((ddt) => {
        const alloc = ddtAllocations[ddt.numeroDDT];
        const connectedLines = parsedInvoice.righe.filter((r) =>
          ddt.riferimentoLinee.includes(r.numeroLinea)
        );
        const activeLines = connectedLines.filter((r) => !excludedLines[r.numeroLinea]);
        const excludedLinesInDdt = connectedLines.filter((r) => excludedLines[r.numeroLinea]);

        // Calcolo rigorosamente algebrico (conserva i segni negativi per resi / storni)
        const ddtActiveTotal = connectedLines.length > 0
          ? Math.round(activeLines.reduce((sum, r) => sum + r.prezzoTotale, 0) * 100) / 100
          : (ddt.totaleDDT || 0);

        const ddtExcludedAmount = connectedLines.length > 0
          ? Math.round(excludedLinesInDdt.reduce((sum, r) => sum + r.prezzoTotale, 0) * 100) / 100
          : 0;

        ignoredSum += ddtExcludedAmount;

        if (!alloc || !alloc.targetCantiereId) {
          unassignedSum += ddtActiveTotal;
          unassignedCount++;
          return;
        }

        if (alloc.targetCantiereId === '__ignore__') {
          ignoredSum += ddtActiveTotal;
        } else if (alloc.targetCantiereId === '__sospeso__') {
          sospesiSum += ddtActiveTotal;
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            const splitActiveAmount = Math.round(((ddtActiveTotal * sp.percentage) / 100) * 100) / 100;
            if (sp.cantiereId === '__ignore__') {
              ignoredSum += splitActiveAmount;
            } else if (sp.cantiereId === '__sospeso__') {
              sospesiSum += splitActiveAmount;
            } else if (sp.cantiereId && sp.cantiereId.trim()) {
              cantieriSum += splitActiveAmount;
            } else {
              unassignedSum += splitActiveAmount;
              unassignedCount++;
            }
          });
        } else if (alloc.targetCantiereId && alloc.targetCantiereId.trim()) {
          cantieriSum += ddtActiveTotal;
        } else {
          unassignedSum += ddtActiveTotal;
          unassignedCount++;
        }
      });

      // 2. Oneri accessori orfani (spese incasso, CONAI, spese amministrative slegate dai DDT)
      if (parsedInvoice.orphanExpenses && parsedInvoice.orphanExpenses.length > 0) {
        parsedInvoice.orphanExpenses.forEach((exp) => {
          const alloc = lineAllocations[exp.numeroLinea];
          const expAmount = exp.prezzoTotale;
          if (!alloc || !alloc.targetCantiereId) {
            unassignedSum += expAmount;
            unassignedCount++;
            return;
          }
          if (alloc.targetCantiereId === '__ignore__') {
            ignoredSum += expAmount;
          } else if (alloc.targetCantiereId === '__sospeso__') {
            sospesiSum += expAmount;
          } else if (alloc.isSplit && alloc.splits.length > 0) {
            alloc.splits.forEach((sp) => {
              if (sp.cantiereId === '__ignore__') {
                ignoredSum += sp.amount;
              } else if (sp.cantiereId === '__sospeso__') {
                sospesiSum += sp.amount;
              } else if (sp.cantiereId && sp.cantiereId.trim()) {
                cantieriSum += sp.amount;
              } else {
                unassignedSum += sp.amount;
                unassignedCount++;
              }
            });
          } else if (alloc.targetCantiereId && alloc.targetCantiereId.trim()) {
            cantieriSum += expAmount;
          } else {
            unassignedSum += expAmount;
            unassignedCount++;
          }
        });
      }
    } else {
      // Modalità by_line: calcolo algebrico su ogni singola riga
      parsedInvoice.righe.forEach((line) => {
        const alloc = lineAllocations[line.numeroLinea];
        const lineTot = line.prezzoTotale;
        if (!alloc || !alloc.targetCantiereId) {
          unassignedSum += lineTot;
          unassignedCount++;
          return;
        }
        if (alloc.targetCantiereId === '__ignore__') {
          ignoredSum += lineTot;
        } else if (alloc.targetCantiereId === '__sospeso__') {
          sospesiSum += lineTot;
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            const spAmount = sp.amount;
            if (sp.cantiereId === '__ignore__') {
              ignoredSum += spAmount;
            } else if (sp.cantiereId === '__sospeso__') {
              sospesiSum += spAmount;
            } else if (sp.cantiereId && sp.cantiereId.trim()) {
              cantieriSum += spAmount;
            } else {
              unassignedSum += spAmount;
              unassignedCount++;
            }
          });
        } else if (alloc.targetCantiereId && alloc.targetCantiereId.trim()) {
          cantieriSum += lineTot;
        } else {
          unassignedSum += lineTot;
          unassignedCount++;
        }
      });
    }

    const sign = isNotaDiCredito ? -1 : 1;
    const roundedCantieri = Math.round(cantieriSum * sign * 100) / 100;
    const roundedSospesi = Math.round(sospesiSum * sign * 100) / 100;
    const roundedCantieriPlusSospesi = Math.round((roundedCantieri + roundedSospesi) * 100) / 100;
    const roundedIgnored = Math.round(ignoredSum * 100) / 100;
    const roundedUnassigned = Math.round(unassignedSum * sign * 100) / 100;

    // Quadratura con l'imponibile del fornitore:
    const totaleImponibileFornitore = Math.round(invoiceImponibile * sign * 100) / 100;
    const totaleAssegnato = Math.round((roundedCantieri + roundedSospesi + roundedIgnored * sign) * 100) / 100;
    const diffQuadratura = Math.round((totaleImponibileFornitore - totaleAssegnato) * 100) / 100;
    const isQuadraturaPerfetta = unassignedCount === 0 && Math.abs(diffQuadratura) < 0.01;

    return {
      cantieri: roundedCantieri,
      sospesi: roundedSospesi,
      cantieriPlusSospesi: roundedCantieriPlusSospesi,
      ignored: roundedIgnored,
      unassigned: roundedUnassigned,
      unassignedCount,
      total: Math.round(Math.abs(parsedInvoice.datiDocumento.importoTotale) * sign * 100) / 100,
      imponibileTotal: totaleImponibileFornitore,
      differenzaQuadratura: diffQuadratura,
      isQuadraturaPerfetta,
      isNotaDiCredito,
    };
  }, [
    parsedInvoice,
    allocationMode,
    wholeInvoiceCantiereId,
    ddtAllocations,
    lineAllocations,
    excludedLines,
    invoiceImponibile,
    isNotaDiCredito,
  ]);

  // Commit all allocations into movements and/or sospesi
  const handleConfirmAndCommit = (bypassDuplicateCheck = false) => {
    if (!parsedInvoice) return;

    // VALIDAZIONE OBBLIGATORIA DELLE DESTINAZIONI IN TUTTE LE MODALITÀ:
    // Nessuna casella deve rimanere vuota / "DA SELEZIONARE".
    // Tutte le caselle devono essere valorizzate con un cantiere, con la Scheda Sospesi (__sospeso__), o con Da Non Considerare (__ignore__).
    if (allocationMode === 'whole') {
      if (!wholeInvoiceCantiereId || !wholeInvoiceCantiereId.trim()) {
        setShowValidationErrors(true);
        setErrorMessage(
          'Attenzione: la casella del cantiere di destinazione non è valorizzata! Seleziona obbligatoriamente un Cantiere, la Scheda Sospesi, oppure "Da Non Considerare" prima di confermare.'
        );
        return;
      }
    } else if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
      const unassignedDdtList: string[] = [];
      parsedInvoice.ddtList.forEach((ddt) => {
        const alloc = ddtAllocations[ddt.numeroDDT];
        const connectedLines = parsedInvoice.righe.filter((r) =>
          ddt.riferimentoLinee.includes(r.numeroLinea)
        );
        const activeLines = connectedLines.filter((r) => !excludedLines[r.numeroLinea]);
        // Se tutte le righe sono state escluse manualmente, il DDT è già a posto (escluso)
        if (connectedLines.length > 0 && activeLines.length === 0) return;
        if (!alloc) {
          unassignedDdtList.push(getDdtDisplayName(ddt.numeroDDT));
          return;
        }
        if (alloc.targetCantiereId === '__ignore__') return;
        if (alloc.isSplit) {
          const hasEmpty = alloc.splits.some((sp) => !sp.cantiereId || !sp.cantiereId.trim());
          if (hasEmpty) {
            unassignedDdtList.push(`${getDdtDisplayName(ddt.numeroDDT)} (quote non assegnate)`);
          }
        } else if (!alloc.targetCantiereId || !alloc.targetCantiereId.trim()) {
          unassignedDdtList.push(getDdtDisplayName(ddt.numeroDDT));
        }
      });

      // Verifica anche che tutti gli eventuali oneri accessori orfani siano valorizzati
      const unassignedOrphans: string[] = [];
      if (parsedInvoice.orphanExpenses && parsedInvoice.orphanExpenses.length > 0) {
        parsedInvoice.orphanExpenses.forEach((exp) => {
          const alloc = lineAllocations[exp.numeroLinea];
          if (!alloc) {
            unassignedOrphans.push(`Riga ${exp.numeroLinea} ("${exp.descrizione.slice(0, 20)}...")`);
            return;
          }
          if (alloc.targetCantiereId === '__ignore__') return;
          if (alloc.isSplit) {
            const hasEmpty = alloc.splits.some((sp) => !sp.cantiereId || !sp.cantiereId.trim());
            if (hasEmpty) {
              unassignedOrphans.push(`Riga ${exp.numeroLinea} (quote non assegnate)`);
            }
          } else if (!alloc.targetCantiereId || !alloc.targetCantiereId.trim()) {
            unassignedOrphans.push(`Riga ${exp.numeroLinea} ("${exp.descrizione.slice(0, 20)}...")`);
          }
        });
      }

      if (unassignedDdtList.length > 0 || unassignedOrphans.length > 0) {
        setShowValidationErrors(true);
        const details: string[] = [];
        if (unassignedDdtList.length > 0) {
          details.push(`DDT da completare: ${unassignedDdtList.join(', ')}`);
        }
        if (unassignedOrphans.length > 0) {
          details.push(`Oneri accessori da completare: ${unassignedOrphans.join(', ')}`);
        }
        setErrorMessage(
          `Attenzione: ci sono elementi con casella di destinazione non valorizzata! Seleziona obbligatoriamente un Cantiere, i Sospesi, oppure 'Da Non Considerare'. ${details.join(' | ')}`
        );
        return;
      }
    } else {
      // Modalità by_line
      const unassignedLinesList: string[] = [];
      parsedInvoice.righe.forEach((line) => {
        const alloc = lineAllocations[line.numeroLinea];
        if (!alloc) {
          unassignedLinesList.push(`Riga ${line.numeroLinea}`);
          return;
        }
        if (alloc.targetCantiereId === '__ignore__') return;
        if (alloc.isSplit) {
          const hasEmpty = alloc.splits.some((sp) => !sp.cantiereId || !sp.cantiereId.trim());
          if (hasEmpty) {
            unassignedLinesList.push(`Riga ${line.numeroLinea} (quote non assegnate)`);
          }
        } else if (!alloc.targetCantiereId || !alloc.targetCantiereId.trim()) {
          unassignedLinesList.push(`Riga ${line.numeroLinea} ("${line.descrizione.slice(0, 24)}...")`);
        }
      });

      if (unassignedLinesList.length > 0) {
        setShowValidationErrors(true);
        setErrorMessage(
          `Attenzione: ci sono ${unassignedLinesList.length} righe con casella di destinazione non valorizzata! Seleziona per ciascuna un Cantiere, i Sospesi, oppure 'Da Non Considerare'. Righe da completare: ${unassignedLinesList.slice(0, 6).join(', ')}${unassignedLinesList.length > 6 ? ` e altre ${unassignedLinesList.length - 6}...` : ''}`
        );
        return;
      }
    }

    // Se tutti i controlli sono superati, resetta gli errori
    setShowValidationErrors(false);
    setErrorMessage(null);

    const commitList: { cantiereId: string; movement: Movement }[] = [];
    const sospesiCommitList: Omit<SospesoItem, 'id' | 'createdAt'>[] = [];
    const invoiceNum = (customInvoiceNumber && customInvoiceNumber.trim()) ? customInvoiceNumber.trim() : (parsedInvoice.datiDocumento.numero || '').trim();
    const invoiceDate = parsedInvoice.datiDocumento.data;
    const supplierName = (parsedInvoice.cedentePrestatore.denominazione || '').toUpperCase().trim();
    const manualProt = (customProtocol && customProtocol.trim()) ? customProtocol.trim() : '';
    const sign = isNotaDiCredito ? -1 : 1;
    const signedInvoiceImponibile = sign * Math.abs(invoiceImponibile);

    // Check if invoice has already been imported
    if (!bypassDuplicateCheck) {
      const existing = findExistingPurchaseInvoiceLocations(
        invoiceNum,
        supplierName,
        cantieri,
        sospesi,
        parsedInvoice.fileName
      );
      if (existing.length > 0) {
        setDuplicatePromptLocations(existing);
        return;
      }
    }

    if (allocationMode === 'whole') {
      if (wholeInvoiceCantiereId === '__ignore__') {
        // Excluded whole invoice
        onClose();
        return;
      }
      if (wholeInvoiceCantiereId === '__sospeso__') {
        sospesiCommitList.push({
          date: invoiceDate,
          docNumber: invoiceNum,
          supplier: supplierName,
          description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}Fattura intera da attribuire (${parsedInvoice.righe.length} articoli - Imponibile)`,
          amount: signedInvoiceImponibile,
          protocol: manualProt || `FORN-XML-${invoiceNum}`,
          status: 'in_attesa_cliente',
          customerNote: isNotaDiCredito
            ? 'Nota di credito da verificare a quale cantiere imputare.'
            : 'Da verificare a quale cantiere imputare l\'intera fornitura.',
          sourceFileName: parsedInvoice.fileName,
          attachmentPdf: attachedPdf || undefined,
        });
      } else {
        const wholeDdtTags = parsedInvoice.ddtList.map((d) =>
          formatSingleDdtTag(getDdtDisplayName(d.numeroDDT), d.dataDDT)
        );
        const wholeTypeAndSubject = wholeDdtTags.length > 0
          ? buildFormattedTypeAndSubject(supplierName, wholeDdtTags)
          : supplierName;

        commitList.push({
          cantiereId: wholeInvoiceCantiereId,
          movement: {
            id: `mov-xml-${Date.now()}-whole`,
            date: invoiceDate,
            docNumber: invoiceNum,
            typeAndSubject: wholeTypeAndSubject,
            protocol: manualProt || `FORN-XML-${invoiceNum}`,
            purchases: signedInvoiceImponibile,
            issued: 0,
            source: 'xml',
            attachmentPdf: attachedPdf || undefined,
            notes: `${isNotaDiCredito ? 'NOTA DI CREDITO - ' : ''}Importazione XML: ${parsedInvoice.fileName} - Fattura ${invoiceNum} (Totale Imponibile: € ${signedInvoiceImponibile.toFixed(2)})`,
            xmlRef: {
              supplier: supplierName,
              invoiceNum: invoiceNum,
            },
          },
        });
      }
    } else if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
      // Group DDTs and orphan expenses assigned to the same cantiere so they become a single unified movement
      const cantiereGroups = new Map<
        string,
        {
          cantiereId: string;
          totalPurchases: number;
          ddtItems: Array<{ numeroDDT: string; dataDDT?: string; amount: number; percentage?: number }>;
          orphanItems: Array<{ description: string; amount: number; percentage?: number }>;
        }
      >();

      // A. Raggruppa i blocchi merci dei DDT
      parsedInvoice.ddtList.forEach((ddt) => {
        const alloc = ddtAllocations[ddt.numeroDDT];
        if (!alloc) return;

        // CHECK DA NON CONSIDERARE
        if (alloc.targetCantiereId === '__ignore__') {
          return;
        }

        const connectedLines = parsedInvoice.righe.filter((r) =>
          ddt.riferimentoLinee.includes(r.numeroLinea)
        );
        const activeLines = connectedLines.filter((r) => !excludedLines[r.numeroLinea]);

        const ddtActiveTotal = connectedLines.length > 0
          ? Math.round(activeLines.reduce((sum, r) => sum + r.prezzoTotale, 0) * 100) / 100
          : (ddt.totaleDDT || 0);

        if (Math.abs(ddtActiveTotal) <= 0.0001) {
          // All lines excluded by user for this DDT
          return;
        }

        const descSummary = activeLines.map((l) => l.descrizione).slice(0, 3).join(', ');
        const customDdtName = getDdtDisplayName(ddt.numeroDDT);

        if (alloc.targetCantiereId === '__sospeso__') {
          sospesiCommitList.push({
            date: ddt.dataDDT || invoiceDate,
            docNumber: invoiceNum,
            supplier: supplierName,
            description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}${customDdtName}: ${descSummary}`,
            amount: sign * ddtActiveTotal,
            ddtNumber: customDdtName,
            ddtDate: ddt.dataDDT,
            protocol: manualProt || customDdtName,
            status: 'in_attesa_cliente',
            customerNote: isNotaDiCredito
              ? 'Nota di credito / DDT da stornare in attesa di chiarimento.'
              : 'DDT in attesa di destinazione da parte del committente/capocantiere.',
            sourceFileName: parsedInvoice.fileName,
            attachmentPdf: attachedPdf || undefined,
          });
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            if (sp.cantiereId === '__ignore__') return;
            const splitAmount = Math.round(((ddtActiveTotal * sp.percentage) / 100) * 100) / 100;
            if (Math.abs(splitAmount) <= 0.0001) return;

            if (sp.cantiereId === '__sospeso__') {
              sospesiCommitList.push({
                date: ddt.dataDDT || invoiceDate,
                docNumber: invoiceNum,
                supplier: supplierName,
                description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}${customDdtName} (quota ${sp.percentage}%): ${descSummary}`,
                amount: sign * splitAmount,
                ddtNumber: customDdtName,
                ddtDate: ddt.dataDDT,
                protocol: manualProt || customDdtName,
                status: 'in_attesa_cliente',
                customerNote: isNotaDiCredito
                  ? `Nota di credito: quota ${sp.percentage}% da stornare.`
                  : `Quota ${sp.percentage}% da definire col cliente.`,
                sourceFileName: parsedInvoice.fileName,
                attachmentPdf: attachedPdf || undefined,
              });
            } else {
              if (!cantiereGroups.has(sp.cantiereId)) {
                cantiereGroups.set(sp.cantiereId, {
                  cantiereId: sp.cantiereId,
                  totalPurchases: 0,
                  ddtItems: [],
                  orphanItems: [],
                });
              }
              const group = cantiereGroups.get(sp.cantiereId)!;
              group.totalPurchases += splitAmount;
              group.ddtItems.push({
                numeroDDT: ddt.numeroDDT,
                dataDDT: ddt.dataDDT,
                amount: splitAmount,
                percentage: sp.percentage < 100 ? sp.percentage : undefined,
              });
            }
          });
        } else {
          const cId = alloc.targetCantiereId;
          if (!cantiereGroups.has(cId)) {
            cantiereGroups.set(cId, {
              cantiereId: cId,
              totalPurchases: 0,
              ddtItems: [],
              orphanItems: [],
            });
          }
          const group = cantiereGroups.get(cId)!;
          group.totalPurchases += ddtActiveTotal;
          group.ddtItems.push({
            numeroDDT: ddt.numeroDDT,
            dataDDT: ddt.dataDDT,
            amount: ddtActiveTotal,
          });
        }
      });

      // B. Raggruppa e assegna gli oneri accessori orfani
      if (parsedInvoice.orphanExpenses && parsedInvoice.orphanExpenses.length > 0) {
        parsedInvoice.orphanExpenses.forEach((exp) => {
          const alloc = lineAllocations[exp.numeroLinea];
          if (!alloc || alloc.targetCantiereId === '__ignore__') return;
          const expAmount = exp.prezzoTotale;
          if (Math.abs(expAmount) <= 0.0001) return;

          if (alloc.targetCantiereId === '__sospeso__') {
            sospesiCommitList.push({
              date: invoiceDate,
              docNumber: invoiceNum,
              supplier: supplierName,
              description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}[ONERI ACCESSORI] ${exp.descrizione}`,
              amount: sign * expAmount,
              protocol: manualProt || `SPESE-${invoiceNum}`,
              status: 'in_attesa_cliente',
              customerNote: 'Spese accessorie / oneri slegati da DDT da chiarire col cliente.',
              sourceFileName: parsedInvoice.fileName,
              attachmentPdf: attachedPdf || undefined,
            });
          } else if (alloc.isSplit && alloc.splits.length > 0) {
            alloc.splits.forEach((sp) => {
              if (sp.cantiereId === '__ignore__') return;
              if (sp.cantiereId === '__sospeso__') {
                sospesiCommitList.push({
                  date: invoiceDate,
                  docNumber: invoiceNum,
                  supplier: supplierName,
                  description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}[ONERI ACCESSORI ${sp.percentage}%] ${exp.descrizione}`,
                  amount: sign * sp.amount,
                  protocol: manualProt || `SPESE-${invoiceNum}`,
                  status: 'in_attesa_cliente',
                  customerNote: `Spese accessorie quota ${sp.percentage}% in sospeso.`,
                  sourceFileName: parsedInvoice.fileName,
                  attachmentPdf: attachedPdf || undefined,
                });
              } else if (sp.cantiereId) {
                if (!cantiereGroups.has(sp.cantiereId)) {
                  cantiereGroups.set(sp.cantiereId, {
                    cantiereId: sp.cantiereId,
                    totalPurchases: 0,
                    ddtItems: [],
                    orphanItems: [],
                  });
                }
                const group = cantiereGroups.get(sp.cantiereId)!;
                group.totalPurchases += sp.amount;
                group.orphanItems.push({
                  description: exp.descrizione,
                  amount: sp.amount,
                  percentage: sp.percentage,
                });
              }
            });
          } else if (alloc.targetCantiereId) {
            const cId = alloc.targetCantiereId;
            if (!cantiereGroups.has(cId)) {
              cantiereGroups.set(cId, {
                cantiereId: cId,
                totalPurchases: 0,
                ddtItems: [],
                orphanItems: [],
              });
            }
            const group = cantiereGroups.get(cId)!;
            group.totalPurchases += expAmount;
            group.orphanItems.push({
              description: exp.descrizione,
              amount: expAmount,
            });
          }
        });
      }

      // Now create a single movement row per cantiere containing the unified sum of all DDTs and assigned orphan expenses
      let groupIdx = 0;
      cantiereGroups.forEach((group, cantiereId) => {
        const roundedTotal = Math.round(group.totalPurchases * 100) / 100;
        if (Math.abs(roundedTotal) <= 0.0001) return;

        // Format each DDT label strictly according to requirement: "DDT N. <numero> DEL <data in DD/MM/YYYY>"
        const ddtListLabels = group.ddtItems.map((d) => {
          const customName = getDdtDisplayName(d.numeroDDT);
          return formatSingleDdtTag(customName, d.dataDDT);
        });

        // Strictly: "FORNITORE (DDT N. ... DEL ...)" and NIENT'ALTRO
        const typeAndSubject = buildFormattedTypeAndSubject(supplierName, ddtListLabels);
        const ddtNamesOnly = group.ddtItems.map((d) => getDdtDisplayName(d.numeroDDT)).join(', ');
        const docNumber = invoiceNum; // ONLY invoice number as requested
        const protocol = manualProt || (group.ddtItems.length === 1 ? getDdtDisplayName(group.ddtItems[0].numeroDDT) : `DDT-VARI`);

        const dates = group.ddtItems.map((d) => d.dataDDT).filter(Boolean) as string[];
        const movementDate = dates.length > 0 ? dates.sort().reverse()[0] : invoiceDate;
        const signedPurchases = isNotaDiCredito ? -Math.abs(roundedTotal) : roundedTotal;

        const orphanTotal = group.orphanItems.reduce((acc, o) => acc + o.amount, 0);
        const orphanNote = orphanTotal !== 0 ? ` (incl. spese/oneri accessori: € ${orphanTotal.toFixed(2)})` : '';

        commitList.push({
          cantiereId,
          movement: {
            id: `mov-xml-${Date.now()}-${groupIdx++}`,
            date: movementDate,
            docNumber,
            typeAndSubject,
            protocol,
            purchases: signedPurchases,
            issued: 0,
            source: 'xml',
            attachmentPdf: attachedPdf || undefined,
            notes: `${isNotaDiCredito ? 'NOTA DI CREDITO - ' : ''}Fattura ${invoiceNum} - Totale di ${group.ddtItems.length} DDT (${ddtNamesOnly || 'Oneri'})${orphanNote}`,
            xmlRef: {
              supplier: supplierName,
              invoiceNum: invoiceNum,
            },
          },
        });
      });
    } else {
      // By line
      parsedInvoice.righe.forEach((line) => {
        const alloc = lineAllocations[line.numeroLinea];
        if (!alloc) return;

        // CHECK DA NON CONSIDERARE
        if (alloc.targetCantiereId === '__ignore__') {
          return;
        }

        const lineDdtName = line.ddtNumero ? getDdtDisplayName(line.ddtNumero) : '';
        const lineDocNumber = invoiceNum; // ONLY invoice number as requested

        if (alloc.targetCantiereId === '__sospeso__') {
          sospesiCommitList.push({
            date: line.ddtData || invoiceDate,
            docNumber: lineDocNumber,
            supplier: supplierName,
            description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}[R${line.numeroLinea}] ${line.descrizione}`,
            amount: sign * Math.abs(line.prezzoTotale),
            ddtNumber: lineDdtName || line.ddtNumero,
            ddtDate: line.ddtData,
            protocol: manualProt || `RIGA-${line.numeroLinea}`,
            status: 'in_attesa_cliente',
            customerNote: isNotaDiCredito
              ? 'Nota di credito / storno articolo da chiarire col cliente.'
              : 'Articolo non attribuito da chiarire con il cliente.',
            sourceFileName: parsedInvoice.fileName,
            attachmentPdf: attachedPdf || undefined,
          });
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp, spIdx) => {
            if (sp.cantiereId === '__ignore__') {
              return;
            }
            if (sp.cantiereId === '__sospeso__') {
              sospesiCommitList.push({
                date: line.ddtData || invoiceDate,
                docNumber: lineDocNumber,
                supplier: supplierName,
                description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}[R${line.numeroLinea}] ${line.descrizione} (quota ${sp.percentage}%)`,
                amount: sign * Math.abs(sp.amount),
                ddtNumber: lineDdtName || line.ddtNumero,
                ddtDate: line.ddtData,
                protocol: manualProt || `RIGA-${line.numeroLinea}`,
                status: 'in_attesa_cliente',
                customerNote: isNotaDiCredito
                  ? `Nota di credito: quota riga ${line.numeroLinea} (${sp.percentage}%) da stornare.`
                  : `Quota riga ${line.numeroLinea} (${sp.percentage}%) da attribuire.`,
                sourceFileName: parsedInvoice.fileName,
                attachmentPdf: attachedPdf || undefined,
              });
            } else {
              commitList.push({
                cantiereId: sp.cantiereId,
                movement: {
                  id: `mov-xml-${Date.now()}-line-${line.numeroLinea}-${spIdx}`,
                  date: line.ddtData || invoiceDate,
                  docNumber: lineDocNumber,
                  typeAndSubject: `${supplierName} - [R${line.numeroLinea}] ${line.descrizione} (quota ${sp.percentage}%)`,
                  protocol: manualProt || `RIGA-${line.numeroLinea}`,
                  purchases: sign * Math.abs(sp.amount),
                  issued: 0,
                  source: 'xml',
                  attachmentPdf: attachedPdf || undefined,
                  notes: `${isNotaDiCredito ? 'NOTA DI CREDITO - ' : ''}Quota riga ${line.numeroLinea} (${sp.percentage}%)`,
                  xmlRef: {
                    supplier: supplierName,
                    invoiceNum: invoiceNum,
                  },
                },
              });
            }
          });
        } else {
          commitList.push({
            cantiereId: alloc.targetCantiereId,
            movement: {
              id: `mov-xml-${Date.now()}-line-${line.numeroLinea}`,
              date: line.ddtData || invoiceDate,
              docNumber: lineDocNumber,
              typeAndSubject: `${supplierName} - [R${line.numeroLinea}] ${line.descrizione}`,
              protocol: manualProt || `RIGA-${line.numeroLinea}`,
              purchases: sign * Math.abs(line.prezzoTotale),
              issued: 0,
              source: 'xml',
              attachmentPdf: attachedPdf || undefined,
              notes: `${isNotaDiCredito ? 'NOTA DI CREDITO' : ''}${line.codiceArticolo ? ` - Cod. Art.: ${line.codiceArticolo}` : ''}`.trim() || undefined,
              xmlRef: {
                supplier: supplierName,
                invoiceNum: invoiceNum,
              },
            },
          });
        }
      });
    }

    if (onCommitAllocations) {
      onCommitAllocations(commitList, sospesiCommitList);
    } else if (sospesiCommitList.length > 0 && onCommitSospesi) {
      onCommitSospesi(sospesiCommitList);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Importatore Fatture Elettroniche XML (Acquisti)</span>
                <span className="text-[10px] uppercase font-extrabold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  FPR12 / FPA12 B2B
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Estrai righe e DDT, ripartisci su più cantieri con il supporto intelligente di Gemini AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Step 1: Upload or Choose Sample */}
          {!parsedInvoice ? (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-8 text-center transition-colors bg-slate-950/50 cursor-pointer"
              >
                <input
                  type="file"
                  accept=".xml,.p7m"
                  id="xml-file-input"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="xml-file-input" className="cursor-pointer block">
                  <FileUp className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <span className="text-sm font-bold text-white block">
                    Trascina qui il file XML della Fattura Elettronica, oppure clicca per selezionarlo
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Supporta formato ufficiale Agenzia Entrate FPR12 e FPA12 (.xml)
                  </span>
                </label>
              </div>

              {/* Step 1 PDF Attachment Option */}
              {attachedPdf ? (
                <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-5 w-5 text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">
                        PDF Fattura Allegato:
                      </span>
                      <span className="font-bold text-white block truncate">
                        {attachedPdf.fileName} ({Math.round(attachedPdf.fileSize / 1024)} KB)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openOrDownloadPdf(attachedPdf)}
                      className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/40 text-red-200 border border-red-500/50 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Visualizza o scarica PDF"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visualizza</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachedPdf(null)}
                      className="p-1 text-slate-400 hover:text-rose-300 rounded cursor-pointer"
                      title="Rimuovi allegato PDF"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Paperclip className="h-4 w-4 text-red-400 shrink-0" />
                    <span>Hai anche la copia di cortesia in PDF? Puoi allegarla subito (opzionale):</span>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      id="pdf-file-input-step1"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePdfFileSelect(file);
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="pdf-file-input-step1"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 whitespace-nowrap shadow-sm"
                    >
                      <FileUp className="h-3.5 w-3.5 text-red-400" />
                      <span>Allega Copia PDF</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Sample Invoices for Instant Test */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Oppure prova subito con una Fattura di Esempio realistica:
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {SAMPLE_INVOICES.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadSample(sample)}
                      className="text-left bg-slate-950 border border-slate-800 hover:border-emerald-500/50 p-3.5 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 uppercase mb-1">
                        <span>{sample.category}</span>
                        <span className="font-mono text-white text-xs">{formatCurrency(sample.total)}</span>
                      </div>
                      <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-300 transition-colors">
                        {sample.supplier}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {sample.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Parsed Invoice & Allocation Options */
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Fornitore Estratto:
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      P.IVA {parsedInvoice.cedentePrestatore.partitaIva}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5 truncate">
                    {parsedInvoice.cedentePrestatore.denominazione}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {parsedInvoice.cedentePrestatore.indirizzo} - {parsedInvoice.cedentePrestatore.comune} ({parsedInvoice.cedentePrestatore.provincia})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Editable Invoice Number Box for contabilità alignment */}
                  <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-2.5 text-left min-w-[220px] shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="custom-invoice-num" className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Pencil className="h-3 w-3" />
                        <span>N° Doc. (Fattura):</span>
                      </label>
                      {customInvoiceNumber !== parsedInvoice.datiDocumento.numero && (
                        <button
                          type="button"
                          onClick={() => setCustomInvoiceNumber(parsedInvoice.datiDocumento.numero)}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                          title="Ripristina numero originale dal file XML"
                        >
                          Ripristina ({parsedInvoice.datiDocumento.numero})
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="custom-invoice-num"
                        type="text"
                        value={customInvoiceNumber}
                        onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                        className="bg-slate-950 border border-slate-700 focus:border-amber-400 rounded px-2.5 py-1 text-xs font-bold font-mono text-white w-32 focus:outline-none shadow-inner"
                        placeholder={parsedInvoice.datiDocumento.numero}
                        title="Numero fattura riportato nella colonna N° Doc."
                      />
                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap font-mono">
                        del {formatDateItalian(parsedInvoice.datiDocumento.data)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Riportato nella colonna <strong className="text-white">N° Doc.</strong> del cantiere o dei sospesi
                    </span>
                  </div>

                  {/* Manual Protocol Number Box (N./PROT) from Accounting */}
                  <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-xl p-2.5 text-left min-w-[210px] shadow-sm bg-gradient-to-br from-slate-900 to-indigo-950/30">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="custom-protocol-num" className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                        <FileText className="h-3 w-3 text-indigo-400" />
                        <span>N./PROT (Protocollo):</span>
                      </label>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                        A mano
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="custom-protocol-num"
                        type="text"
                        value={customProtocol}
                        onChange={(e) => setCustomProtocol(e.target.value)}
                        className="bg-slate-950 border border-indigo-500/60 focus:border-indigo-400 rounded px-2.5 py-1 text-xs font-bold font-mono text-indigo-100 w-full focus:outline-none shadow-inner"
                        placeholder="Es. 142 o PROT-26/01"
                        title="Inserisci a mano il numero di protocollo di registrazione preso dalla contabilità"
                        autoFocus
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {customProtocol.trim() ? (
                        <span className="text-emerald-300 font-semibold">
                          ✓ Protocollo: <strong className="font-mono text-white">{customProtocol.trim()}</strong>
                        </span>
                      ) : (
                        <span>Inserisci protocollo per colonna <strong className="text-white">N./PROT</strong></span>
                      )}
                    </span>
                  </div>

                  {/* Tipo Documento: Fattura vs Nota di Credito (Storno con segno -) */}
                  <div className={`rounded-xl p-2.5 text-left min-w-[230px] shadow-sm border transition-all ${
                    isNotaDiCredito
                      ? 'bg-gradient-to-br from-rose-950/70 via-slate-900 to-rose-900/40 border-rose-500/70 shadow-rose-950/30 ring-1 ring-rose-500/30'
                      : 'bg-slate-900 border-slate-700/80'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <FileText className={`h-3 w-3 ${isNotaDiCredito ? 'text-rose-400' : 'text-slate-400'}`} />
                        <span>Tipo Documento:</span>
                      </span>
                      {isNotaDiCredito ? (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40 flex items-center gap-0.5">
                          <MinusCircle className="h-2.5 w-2.5" />
                          SEGNO (-)
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">
                          Normale (+)
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNotaDiCredito((prev) => !prev)}
                      className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-sm ${
                        isNotaDiCredito
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-rose-900/40'
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-600 hover:border-slate-500'
                      }`}
                      title={
                        isNotaDiCredito
                          ? 'Nota di credito attiva: gli importi avranno il segno meno (-). Clicca per commutare a fattura standard.'
                          : 'Clicca per indicare che si tratta di una Nota di Credito (importi con segno meno -)'
                      }
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isNotaDiCredito ? (
                          <>
                            <MinusCircle className="h-3.5 w-3.5 text-white shrink-0" />
                            <span className="truncate">NOTA DI CREDITO</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">Fattura Standard</span>
                          </>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded shrink-0 ${
                        isNotaDiCredito ? 'bg-black/30 text-rose-100' : 'bg-slate-900 text-amber-300'
                      }`}>
                        {isNotaDiCredito ? 'Storno (-)' : 'Commuta'}
                      </span>
                    </button>

                    <span className="text-[10px] block mt-1 leading-tight">
                      {isNotaDiCredito ? (
                        <span className="text-rose-300 font-semibold">
                          ✓ Importo con <strong className="text-white underline">segno meno (-)</strong>
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Clicca se è una <strong className="text-slate-300">Nota di Credito</strong>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Allegato PDF della Fattura (Richiesta: dammi la possibilità di allegare il PDF della fattura) */}
                  <div className={`rounded-xl p-2.5 text-left min-w-[240px] shadow-sm border transition-all ${
                    attachedPdf
                      ? 'bg-gradient-to-br from-red-950/50 via-slate-900 to-red-900/30 border-red-500/70 shadow-red-950/30 ring-1 ring-red-500/30'
                      : 'bg-slate-900 border-slate-700/80'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <FileText className={`h-3 w-3 ${attachedPdf ? 'text-red-400' : 'text-slate-400'}`} />
                        <span>Allegato PDF Fattura:</span>
                      </span>
                      {attachedPdf ? (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-red-500/20 text-red-300 rounded border border-red-500/40 flex items-center gap-0.5">
                          ✓ ALLEGATO
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">
                          Opzionale
                        </span>
                      )}
                    </div>

                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      ref={pdfInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePdfFileSelect(file);
                      }}
                      className="hidden"
                    />

                    {attachedPdf ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="font-bold text-white truncate max-w-[150px]" title={attachedPdf.fileName}>
                            {attachedPdf.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {Math.round(attachedPdf.fileSize / 1024)} KB
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOrDownloadPdf(attachedPdf)}
                            className="flex-1 py-1 px-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                            title="Apri o scarica il PDF della fattura"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Apri PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer border border-slate-700"
                            title="Sostituisci il PDF con un altro file"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachedPdf(null)}
                            className="p-1 text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg cursor-pointer border border-rose-900/40"
                            title="Rimuovi allegato PDF"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          disabled={isUploadingPdf}
                          onClick={() => pdfInputRef.current?.click()}
                          className="w-full py-1.5 px-2.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-600 hover:border-slate-500 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                          title="Allega il PDF della fattura per visualizzarlo nei cantieri e nei sospesi"
                        >
                          <FileUp className="h-3.5 w-3.5 text-red-400" />
                          <span>{isUploadingPdf ? 'Caricamento PDF...' : 'Allega PDF Fattura'}</span>
                        </button>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Sarà allegato ai movimenti e ai sospesi
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pl-4 border-l border-slate-800 text-right">
                    <span className="text-xs text-slate-400 block">
                      {isNotaDiCredito ? 'Totale Nota di Credito:' : 'Totale Documento:'}
                    </span>
                    <span className={`text-xl font-black font-mono ${isNotaDiCredito ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatCurrency(computedStats.total)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setParsedInvoice(null);
                      setXmlContent('');
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-300 text-xs underline cursor-pointer"
                  >
                    Cambia XML
                  </button>
                </div>
              </div>

              {/* Quadro di Quadratura Contabile & Controllo Fiscale */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Quadro di Quadratura Contabile & Fiscale
                    </span>
                    {parsedInvoice.quadratura && parsedInvoice.quadratura.isQuadraturaPerfetta && (
                      <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                        XML Verificato
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Controllo quadratura al centesimo: <strong className="text-white font-mono">{formatCurrency(computedStats.imponibileTotal)}</strong> (Imponibile Fornitore)
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Card 1: Imponibile Fattura */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      1. Imponibile Fattura
                    </span>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-white">
                      {formatCurrency(computedStats.imponibileTotal)}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {parsedInvoice.datiDocumento.riepilogoIVA && parsedInvoice.datiDocumento.riepilogoIVA.length > 1
                        ? `${parsedInvoice.datiDocumento.riepilogoIVA.length} aliquote IVA`
                        : 'Totale imponibile SDI'}
                    </span>
                  </div>

                  {/* Card 2: Imputato a Cantieri */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      2. Imputato Cantieri
                    </span>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-emerald-400">
                      {formatCurrency(computedStats.cantieri)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Movimenti nei cantieri
                    </span>
                  </div>

                  {/* Card 3: Scheda Sospesi */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                      3. Scheda Sospesi
                    </span>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-amber-400">
                      {formatCurrency(computedStats.sospesi)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      In attesa chiarimento
                    </span>
                  </div>

                  {/* Card 4: Da Non Considerare */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      4. Da Non Considerare
                    </span>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-slate-300">
                      {formatCurrency(computedStats.ignored)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Escluso dai costi cantiere
                    </span>
                  </div>
                </div>

                {/* Status Bar: Quadratura Perfetta vs Sbilancio */}
                {computedStats.isQuadraturaPerfetta ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>QUADRATURA CONTABILE PERFETTA AL CENTESIMO (Differenza: € 0,00)</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-200 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                      100% Imputato
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>
                        {computedStats.unassignedCount > 0 ? (
                          <>
                            Da completare: <strong>{computedStats.unassignedCount} {computedStats.unassignedCount === 1 ? 'elemento' : 'elementi'}</strong> ancora da destinare (importo: <strong className="font-mono text-white">{formatCurrency(computedStats.unassigned)}</strong>)
                          </>
                        ) : (
                          <>
                            Sbilancio di Quadratura con Imponibile Fattura:{' '}
                            <strong className="font-mono text-white">{formatCurrency(computedStats.differenzaQuadratura)}</strong>
                          </>
                        )}
                      </span>
                    </div>
                    {computedStats.unassignedCount > 0 && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                        {computedStats.unassignedCount} mancanti
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Duplicate invoice warning banner */}
              {existingDuplicates.length > 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>Attenzione: questa fattura risulta già presente nel sistema!</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                        Già registrata
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-300/90 leading-relaxed">
                      La fattura N° <strong className="font-mono text-white">{(customInvoiceNumber && customInvoiceNumber.trim()) || parsedInvoice.datiDocumento.numero}</strong> di <strong className="text-white">{parsedInvoice.cedentePrestatore.denominazione}</strong> è già registrata in {existingDuplicates.length === 1 ? '1 cantiere/scheda' : `${existingDuplicates.length} cantieri/schede`}:{' '}
                      <span className="font-semibold text-white">
                        {existingDuplicates.map((loc) => `${loc.cantiereName} (Doc: ${loc.docNumber})`).join('; ')}
                      </span>
                      . Al momento della conferma ti verrà richiesta conferma esplicita per procedere.
                    </div>
                  </div>
                </div>
              )}

              {/* Notification & AI Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 p-3.5 rounded-xl border border-indigo-500/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Assistente AI Gemini per Ripartizione Cantieri</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Analizza le descrizioni dei materiali e dei DDT per abbinare automaticamente ogni voce al cantiere più probabile.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleAskGeminiAi}
                  disabled={isAiLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>{isAiLoading ? 'Analisi in corso...' : 'Suggerisci Cantieri con Gemini AI'}</span>
                </button>
              </div>

              {aiSuccessMessage && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{aiSuccessMessage}</span>
                  </div>
                  <button
                    onClick={() => setAiSuccessMessage(null)}
                    className="text-xs text-indigo-300 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Validation Error Banner */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/15 border-2 border-rose-500/60 rounded-xl text-rose-200 text-xs flex items-start gap-2.5 shadow-lg animate-fadeIn">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="text-sm">⚠️ Destinazioni non completate</span>
                      <button
                        type="button"
                        onClick={() => setErrorMessage(null)}
                        className="text-rose-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Chiudi avviso"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-rose-200 leading-relaxed font-medium">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Quick Filters Toolbar */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Filtri e Assegnazione Rapida:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleExpandAllDdts}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Apri tutti i DDT per visualizzare e gestire le singole righe"
                      >
                        Espandi tutti i DDT
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAllDdts}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Comprimi tutti i DDT"
                      >
                        Comprimi tutti i DDT
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!parsedInvoice) return;
                      const sLines: Record<number, LineAllocation> = {};
                      parsedInvoice.righe.forEach((r) => {
                        sLines[r.numeroLinea] = { targetCantiereId: '__sospeso__', isSplit: false, splits: [] };
                      });
                      setLineAllocations(sLines);
                      const sDdts: Record<string, DdtAllocation> = {};
                      parsedInvoice.ddtList.forEach((d) => {
                        sDdts[d.numeroDDT] = { targetCantiereId: '__sospeso__', isSplit: false, splits: [] };
                      });
                      setDdtAllocations(sDdts);
                      setWholeInvoiceCantiereId('__sospeso__');
                      setErrorMessage(null);
                      setAiSuccessMessage('Tutti gli elementi impostati per la SCHEDA SOSPESI.');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Tutti a Sospesi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!parsedInvoice) return;
                      const sLines: Record<number, LineAllocation> = {};
                      parsedInvoice.righe.forEach((r) => {
                        sLines[r.numeroLinea] = { targetCantiereId: '', isSplit: false, splits: [{ cantiereId: '', percentage: 100, amount: r.prezzoTotale }] };
                      });
                      setLineAllocations(sLines);
                      const sDdts: Record<string, DdtAllocation> = {};
                      parsedInvoice.ddtList.forEach((d) => {
                        sDdts[d.numeroDDT] = { targetCantiereId: '', isSplit: false, splits: [{ cantiereId: '', percentage: 100, amount: d.totaleDDT || 0 }] };
                      });
                      setDdtAllocations(sDdts);
                      setWholeInvoiceCantiereId('');
                      setShowValidationErrors(false);
                      setErrorMessage(null);
                      setAiSuccessMessage('Tutte le caselle reimpostate su "DA SELEZIONARE".');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                    title="Resetta tutte le caselle su Da Selezionare"
                  >
                    <Undo2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Reimposta su "Da Selezionare"</span>
                  </button>
                </div>
              </div>

              {/* Allocation Mode Selector */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Scegli Modalità di Ripartizione nel Modulo Cantieri:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Mode 1: Whole */}
                  <button
                    onClick={() => setAllocationMode('whole')}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      allocationMode === 'whole'
                        ? 'border-amber-400 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>1. Intera {isNotaDiCredito ? 'Nota di Credito' : 'Fattura'} a 1 Cantiere</span>
                      {isNotaDiCredito && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40">
                          - €
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isNotaDiCredito
                        ? `Assegna il totale nota di credito (- € ${invoiceImponibile.toFixed(2)}) a una sola scheda (Iva esclusa).`
                        : `Assegna il totale imponibile (€ ${invoiceImponibile.toFixed(2)}) a una sola scheda (Iva esclusa).`}
                    </p>
                  </button>

                  {/* Mode 2: By DDT */}
                  <button
                    onClick={() => setAllocationMode('by_ddt')}
                    disabled={parsedInvoice.ddtList.length === 0}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      allocationMode === 'by_ddt'
                        ? 'border-amber-400 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    } ${parsedInvoice.ddtList.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>2. Ripartisci per DDT ({parsedInvoice.ddtList.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {parsedInvoice.ddtList.length > 0
                        ? 'Assegna ciascun documento di trasporto al suo cantiere.'
                        : 'Nessun DDT separato trovato nel file XML.'}
                    </p>
                  </button>

                  {/* Mode 3: By Line */}
                  <button
                    onClick={() => setAllocationMode('by_line')}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      allocationMode === 'by_line'
                        ? 'border-amber-400 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>3. Ripartisci per Singola Riga ({parsedInvoice.righe.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Massimo dettaglio: assegna o dividi ogni articolo su più cantieri.
                    </p>
                  </button>
                </div>
              </div>

              {/* Mode 1: Whole Invoice Selection */}
              {allocationMode === 'whole' && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="block text-xs font-bold text-slate-300">
                      {isNotaDiCredito ? (
                        <span>
                          Seleziona la Destinazione Contabile della <strong className="text-rose-400 uppercase">Nota di Credito</strong> (Imponibile storno: <strong className="text-rose-300 font-mono">- € {invoiceImponibile.toFixed(2)}</strong>):
                        </span>
                      ) : (
                        <span>
                          Seleziona la Destinazione Contabile dell'Intera Fattura (Imponibile: <strong className="text-emerald-300 font-mono">€ {invoiceImponibile.toFixed(2)}</strong>):
                        </span>
                      )}
                    </label>
                    {parsedInvoice.datiDocumento.riepilogoIVA && parsedInvoice.datiDocumento.riepilogoIVA.length > 1 && (
                      <span className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                        {parsedInvoice.datiDocumento.riepilogoIVA.length} aliquote IVA considerate: Tot. Imponibile {isNotaDiCredito ? '- ' : ''}€ {invoiceImponibile.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {isNotaDiCredito && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-200 flex items-center gap-2">
                      <MinusCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>
                        <strong>Nota di Credito:</strong> L'importo imponibile di <span className="font-mono font-bold text-white">- € {invoiceImponibile.toFixed(2)}</span> verrà importato nel cantiere con <strong>segno meno (-)</strong> riducendo gli acquisti.
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <CantiereSearchSelect
                        value={wholeInvoiceCantiereId}
                        hasError={showValidationErrors && !wholeInvoiceCantiereId}
                        onChange={(val) => {
                          if (val === '__create_new__') {
                            openCreateCantiereModal({ mode: 'whole' });
                            return;
                          }
                          setWholeInvoiceCantiereId(val);
                          if (val) setErrorMessage(null);
                        }}
                        cantieri={allCantieri}
                        onCreateNew={() => openCreateCantiereModal({ mode: 'whole' })}
                        showSospesiOption={true}
                        showIgnoreOption={true}
                        sospesiLabel="⚠️ Invia a SCHEDA SOSPESI (Da chiarire con il cliente)"
                        ignoreLabel="⛔ DA NON CONSIDERARE (Spese bancarie / Spese generali)"
                        placeholder="Cerca cantiere per nome o città..."
                        size="md"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => openCreateCantiereModal({ mode: 'whole' })}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      title="Crea direttamente un nuovo cantiere con la schermata standard"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Nuovo Cantiere</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: By DDT Selection */}
              {allocationMode === 'by_ddt' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Assegna ciascun Documento di Trasporto (DDT) al cantiere di competenza:
                    </div>
                    {isNotaDiCredito && (
                      <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1 self-start sm:self-auto">
                        <MinusCircle className="h-3 w-3 text-rose-400" />
                        <span>Nota di Credito: importi con segno meno (-)</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {parsedInvoice.ddtList.map((ddt) => {
                      const alloc = ddtAllocations[ddt.numeroDDT] || {
                        targetCantiereId: cantieri[0]?.id ?? '',
                        isSplit: false,
                        splits: [],
                      };
                      const connectedLines = parsedInvoice.righe.filter((r) =>
                        ddt.riferimentoLinee.includes(r.numeroLinea)
                      );
                      const isExpanded = Boolean(expandedDdts[ddt.numeroDDT]);
                      const activeLines = connectedLines.filter((r) => !excludedLines[r.numeroLinea]);
                      const excludedLinesInDdt = connectedLines.filter((r) => excludedLines[r.numeroLinea]);

                      const ddtOriginalTotal = ddt.totaleDDT || 0;
                      const ddtActiveTotal = connectedLines.length > 0
                        ? Math.round(activeLines.reduce((sum, r) => sum + r.prezzoTotale, 0) * 100) / 100
                        : ddtOriginalTotal;

                      const isEntireDdtIgnored = alloc.targetCantiereId === '__ignore__';

                      return (
                        <div
                          key={ddt.numeroDDT}
                          className={`p-4 rounded-xl border space-y-3 transition-colors ${
                            isEntireDdtIgnored
                              ? 'bg-slate-950/70 border-rose-900/50 opacity-80'
                              : 'bg-slate-950 border-slate-800 shadow-md'
                          }`}
                        >
                          {/* DDT Top Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                            <div className="space-y-2 flex-1 min-w-0">
                              {/* Editable DDT Name Input */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs shrink-0">
                                  <Tag className="h-3.5 w-3.5" />
                                  <span>Nome DDT nel Cantiere:</span>
                                </div>
                                <input
                                  type="text"
                                  value={customDdtNames[ddt.numeroDDT] ?? getDdtDisplayName(ddt.numeroDDT)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomDdtNames((prev) => ({
                                      ...prev,
                                      [ddt.numeroDDT]: val,
                                    }));
                                  }}
                                  className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold font-mono text-white focus:outline-none w-48 shadow-inner"
                                  placeholder={`DDT ${ddt.numeroDDT}`}
                                  title="Modifica il nome del DDT che verrà riportato nel cantiere"
                                />
                                {ddt.dataDDT && (
                                  <span className="text-xs font-semibold text-slate-400 font-mono">
                                    del {formatDateItalian(ddt.dataDDT)}
                                  </span>
                                )}
                                {customDdtNames[ddt.numeroDDT] && customDdtNames[ddt.numeroDDT] !== ddt.numeroDDT && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomDdtNames((prev) => ({
                                        ...prev,
                                        [ddt.numeroDDT]: ddt.numeroDDT,
                                      }));
                                    }}
                                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                    title="Ripristina numero originale da XML"
                                  >
                                    Ripristina ({ddt.numeroDDT})
                                  </button>
                                )}
                                {isEntireDdtIgnored && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    DDT ESCLUSO
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                                <span className="text-slate-300">
                                  Da XML: <strong className="font-mono text-slate-200">N° {ddt.numeroDDT}</strong>
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="text-[11px] text-slate-300">
                                  Riportato nel cantiere come:{' '}
                                  <strong className="text-emerald-400 font-mono font-bold">
                                    "{getDdtDisplayName(ddt.numeroDDT)}"
                                  </strong>
                                </span>
                                <span className="text-slate-600">•</span>
                                <span>{connectedLines.length} righe collegate</span>
                                {excludedLinesInDdt.length > 0 && (
                                  <>
                                    <span className="text-slate-600">•</span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      {excludedLinesInDdt.length} {excludedLinesInDdt.length === 1 ? 'riga esclusa' : 'righe escluse'}
                                    </span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-[11px] font-semibold text-emerald-400">
                                      {activeLines.length} attive
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                              <div className="text-right">
                                {excludedLinesInDdt.length > 0 ? (
                                  <div>
                                    <div className="text-[11px] text-slate-500 line-through font-mono">
                                      Tot: {formatCurrency(ddtOriginalTotal)}
                                    </div>
                                    <div className="font-mono text-base font-bold text-rose-300">
                                      {formatCurrency(ddtActiveTotal)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-mono text-base font-bold text-rose-300">
                                    {formatCurrency(ddtOriginalTotal)}
                                  </div>
                                )}
                              </div>

                              {/* Toggle open/close drawer button */}
                              <button
                                type="button"
                                onClick={() => toggleExpandDdt(ddt.numeroDDT)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm border ${
                                  isExpanded
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                                }`}
                                title="Apri il DDT per visualizzare e selezionare le singole righe da escludere"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    <span>Chiudi Righe DDT</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-4 w-4" />
                                    <span>Apri DDT ({connectedLines.length} righe)</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* AI Suggestion Badge if available */}
                          {alloc.aiSuggestion && (
                            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 flex items-start gap-2">
                              <Sparkles className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">
                                  Suggerimento Gemini ({alloc.aiSuggestion.confidence}%):{' '}
                                </span>
                                <span>{alloc.aiSuggestion.reasoning}</span>
                              </div>
                            </div>
                          )}

                          {/* Expanded DDT lines drawer */}
                          {isExpanded && (
                            <div className="pt-2 pb-1 space-y-2.5 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5 text-amber-400" />
                                  <span>Dettaglio Righe: {getDdtDisplayName(ddt.numeroDDT)} (XML N° {ddt.numeroDDT})</span>
                                </div>
                                {connectedLines.length > 0 && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExcludedLines((prev) => {
                                          const next = { ...prev };
                                          connectedLines.forEach((r) => {
                                            delete next[r.numeroLinea];
                                          });
                                          return next;
                                        });
                                      }}
                                      className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
                                    >
                                      ✓ Includi Tutte
                                    </button>
                                    <span className="text-slate-600">|</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExcludedLines((prev) => {
                                          const next = { ...prev };
                                          connectedLines.forEach((r) => {
                                            next[r.numeroLinea] = true;
                                          });
                                          return next;
                                        });
                                      }}
                                      className="text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
                                    >
                                      ✕ Escludi Tutte
                                    </button>
                                  </div>
                                )}
                              </div>

                              {connectedLines.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  Nessun riferimento esplicito alle righe per questo DDT nel file XML.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                                        <th className="py-2 px-2 w-36">Stato / Azione</th>
                                        <th className="py-2 px-2 w-14">Riga</th>
                                        <th className="py-2 px-3">Descrizione Materiale / Spesa</th>
                                        <th className="py-2 px-2 text-right w-24">Q.tà</th>
                                        <th className="py-2 px-3 text-right w-28">Importo</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {connectedLines.map((riga) => {
                                        const isExcluded = Boolean(excludedLines[riga.numeroLinea]);
                                        return (
                                          <tr
                                            key={riga.numeroLinea}
                                            className={`transition-colors ${
                                              isExcluded
                                                ? 'bg-rose-950/20 text-slate-500'
                                                : 'hover:bg-slate-800/40 text-slate-200'
                                            }`}
                                          >
                                            <td className="py-2 px-2">
                                              <button
                                                type="button"
                                                onClick={() => toggleExcludeLine(riga.numeroLinea)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                                  isExcluded
                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                                    : 'bg-slate-800 text-emerald-400 border border-slate-700 hover:border-rose-500/50 hover:text-rose-300'
                                                }`}
                                                title={
                                                  isExcluded
                                                    ? 'Clicca per re-includere questa riga nel cantiere'
                                                    : 'Clicca per escludere questa riga dal cantiere'
                                                }
                                              >
                                                {isExcluded ? (
                                                  <>
                                                    <Ban className="h-3 w-3 text-rose-400" />
                                                    <span>Esclusa</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Check className="h-3 w-3 text-emerald-400" />
                                                    <span>Inclusa</span>
                                                  </>
                                                )}
                                              </button>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-[11px] text-amber-400">
                                              R{riga.numeroLinea}
                                            </td>
                                            <td className="py-2 px-3">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                  className={
                                                    isExcluded ? 'line-through text-slate-500' : 'font-medium'
                                                  }
                                                >
                                                  {riga.descrizione}
                                                </span>
                                                {isExcluded && (
                                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 uppercase shrink-0">
                                                    Esclusa dal DDT
                                                  </span>
                                                )}
                                              </div>
                                              {riga.codiceArticolo && (
                                                <span className="text-[10px] text-slate-500 font-mono block">
                                                  Cod: {riga.codiceArticolo}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-slate-400">
                                              {riga.quantita ? `${riga.quantita} ${riga.unitaMisura || ''}` : '-'}
                                            </td>
                                            <td
                                              className={`py-2 px-3 text-right font-mono font-bold ${
                                                isExcluded ? 'line-through text-slate-500' : 'text-rose-300'
                                              }`}
                                            >
                                              {formatCurrency(riga.prezzoTotale)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-400 border-t border-slate-800/80">
                                <span>
                                  Righe attive da importare: <strong className="text-white">{activeLines.length}</strong> su {connectedLines.length}
                                </span>
                                <span>
                                  Totale attivo DDT: <strong className="text-rose-300 font-mono">{formatCurrency(ddtActiveTotal)}</strong>
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Target Cantiere Select & Ignore Toggle */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <label className="text-xs font-semibold text-slate-300 shrink-0">
                                Assegna a Cantiere:
                              </label>
                              <div className="flex-1 min-w-0">
                                <CantiereSearchSelect
                                  value={alloc.targetCantiereId}
                                  hasError={showValidationErrors && !alloc.targetCantiereId}
                                  onChange={(val) => {
                                    if (val === '__create_new__') {
                                      openCreateCantiereModal({ mode: 'ddt', key: ddt.numeroDDT });
                                      return;
                                    }
                                    setDdtAllocations((prev) => ({
                                      ...prev,
                                      [ddt.numeroDDT]: {
                                        ...prev[ddt.numeroDDT],
                                        targetCantiereId: val,
                                      },
                                    }));
                                    if (val) setErrorMessage(null);
                                  }}
                                  cantieri={allCantieri}
                                  onCreateNew={() => openCreateCantiereModal({ mode: 'ddt', key: ddt.numeroDDT })}
                                  showSospesiOption={true}
                                  showIgnoreOption={true}
                                  sospesiLabel="⚠️ Invia a SCHEDA SOSPESI (DDT da chiarire col cliente)"
                                  ignoreLabel="⛔ DA NON CONSIDERARE (Escludi l'intero DDT)"
                                  placeholder="Cerca cantiere per nome o città..."
                                  size="sm"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => openCreateCantiereModal({ mode: 'ddt', key: ddt.numeroDDT })}
                                className="px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                title="Crea direttamente un nuovo cantiere con la schermata standard"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Nuovo</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const isCurrentlyIgnored = alloc.targetCantiereId === '__ignore__';
                                setDdtAllocations((prev) => ({
                                  ...prev,
                                  [ddt.numeroDDT]: {
                                    ...prev[ddt.numeroDDT],
                                    targetCantiereId: isCurrentlyIgnored
                                      ? ''
                                      : '__ignore__',
                                  },
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                                alloc.targetCantiereId === '__ignore__'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-700'
                              }`}
                              title="Escludi o ripristina questo intero DDT dal conteggio dei cantieri"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span>{alloc.targetCantiereId === '__ignore__' ? 'DDT Escluso' : 'Escludi Tutto il DDT'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sezione Oneri Accessori e Spese Generali Documento (non vincolati a DDT) */}
                  {parsedInvoice.orphanExpenses && parsedInvoice.orphanExpenses.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3.5 shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag className="h-4 w-4 text-amber-400" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Oneri Accessori e Spese Generali Fattura (Slegate dai DDT)
                            </span>
                            <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                              {parsedInvoice.orphanExpenses.length} {parsedInvoice.orphanExpenses.length === 1 ? 'voce' : 'voci'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Spese d'incasso Ri.Ba., contributo CONAI, spese bancarie o oneri amministrativi che concorrono all'imponibile totale.
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Totale Oneri:</span>
                            <span className="font-mono text-base font-bold text-amber-400">
                              {formatCurrency(parsedInvoice.totaleOneriAccessori)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsOrphanExpensesExpanded(!isOrphanExpensesExpanded)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                            title="Espandi o comprimi l'elenco degli oneri accessori"
                          >
                            {isOrphanExpensesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Quick actions for orphan expenses */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-300">Assegnazione Rapida Spese:</span>
                          <button
                            type="button"
                            onClick={handleProrateOrphanExpenses}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                            title="Ripartisce le spese accessorie tra i cantieri assegnati in proporzione all'importo dei rispettivi DDT"
                          >
                            <Sparkles className="h-3 w-3 text-amber-300" />
                            <span>⚡ Ripartisci Proporzionalmente sui Cantieri dei DDT</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetAllOrphanExpenses('__sospeso__')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-pointer"
                          >
                            Tutte a Sospesi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAllOrphanExpenses('__ignore__')}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-pointer"
                          >
                            Non Considerare
                          </button>
                        </div>
                      </div>

                      {/* Table / List of orphan expenses */}
                      {isOrphanExpensesExpanded && (
                        <div className="space-y-2.5">
                          {parsedInvoice.orphanExpenses.map((exp) => {
                            const alloc = lineAllocations[exp.numeroLinea] || {
                              targetCantiereId: '',
                              isSplit: false,
                              splits: [{ cantiereId: '', percentage: 100, amount: exp.prezzoTotale }],
                            };

                            return (
                              <div
                                key={exp.numeroLinea}
                                className={`p-3 rounded-lg border transition-colors ${
                                  alloc.targetCantiereId === '__ignore__'
                                    ? 'bg-slate-950/60 border-rose-900/40 opacity-75'
                                    : 'bg-slate-950 border-slate-800'
                                }`}
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-amber-400">R{exp.numeroLinea}</span>
                                      <span className="text-xs font-semibold text-slate-200">{exp.descrizione}</span>
                                      {exp.isReturnOrDiscount && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                          Storno / Accredito
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-mono text-sm font-bold text-amber-300">
                                      {formatCurrency(exp.prezzoTotale)}
                                    </span>

                                    <div className="w-56">
                                      <CantiereSearchSelect
                                        value={alloc.isSplit ? '__split__' : alloc.targetCantiereId}
                                        hasError={showValidationErrors && !alloc.targetCantiereId && !alloc.isSplit}
                                        onChange={(val) => {
                                          if (val === '__split__') {
                                            setLineAllocations((prev) => ({
                                              ...prev,
                                              [exp.numeroLinea]: {
                                                ...prev[exp.numeroLinea],
                                                isSplit: true,
                                              },
                                            }));
                                            return;
                                          }
                                          setLineAllocations((prev) => ({
                                            ...prev,
                                            [exp.numeroLinea]: {
                                              ...prev[exp.numeroLinea],
                                              targetCantiereId: val,
                                              isSplit: false,
                                            },
                                          }));
                                        }}
                                        cantieri={allCantieri}
                                        onCreateNew={() => openCreateCantiereModal({ mode: 'line', key: exp.numeroLinea })}
                                        showSospesiOption={true}
                                        showIgnoreOption={true}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Multi-split details if prorated or manually split */}
                                {alloc.isSplit && alloc.splits && alloc.splits.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-800 text-xs">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                                        <Split className="h-3 w-3" />
                                        <span>Ripartizione proporzionale applicata ({alloc.splits.length} cantieri):</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLineAllocations((prev) => ({
                                            ...prev,
                                            [exp.numeroLinea]: {
                                              ...prev[exp.numeroLinea],
                                              isSplit: false,
                                              targetCantiereId: '',
                                            },
                                          }));
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                                      >
                                        Rimuovi ripartizione
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                      {alloc.splits.map((sp, sIdx) => {
                                        const cName = allCantieri.find((c) => c.id === sp.cantiereId)?.name || sp.cantiereId;
                                        return (
                                          <div key={sIdx} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                                            <span className="font-medium text-slate-300 truncate max-w-[120px]">{cName}</span>
                                            <span className="font-mono text-amber-400 font-bold">
                                              {formatCurrency(sp.amount)} <span className="text-slate-500 font-normal">({sp.percentage}%)</span>
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Preview of Grouped Cantiere Rows */}
                  {(() => {
                    const previewMap = new Map<
                      string,
                      {
                        cantiereName: string;
                        ddtLabels: string[];
                        ddtNames: string[];
                        total: number;
                        orphanTotal: number;
                      }
                    >();

                    parsedInvoice.ddtList.forEach((ddt) => {
                      const alloc = ddtAllocations[ddt.numeroDDT];
                      if (!alloc || alloc.targetCantiereId === '__ignore__' || alloc.targetCantiereId === '__sospeso__') return;
                      const cantiereObj = allCantieri.find((c: Cantiere) => c.id === alloc.targetCantiereId);
                      if (!cantiereObj) return;

                      const connected = parsedInvoice.righe.filter((r) => ddt.riferimentoLinee.includes(r.numeroLinea));
                      const active = connected.filter((r) => !excludedLines[r.numeroLinea]);
                      const activeTot = connected.length > 0
                        ? active.reduce((s, r) => s + r.prezzoTotale, 0)
                        : (ddt.totaleDDT || 0);
                      if (Math.abs(activeTot) <= 0.0001) return;

                      const dName = getDdtDisplayName(ddt.numeroDDT);
                      const ddtFormattedTag = formatSingleDdtTag(dName, ddt.dataDDT);

                      if (!previewMap.has(alloc.targetCantiereId)) {
                        previewMap.set(alloc.targetCantiereId, {
                          cantiereName: `${cantiereObj.name} (${cantiereObj.client} - ${cantiereObj.city})`,
                          ddtLabels: [],
                          ddtNames: [],
                          total: 0,
                          orphanTotal: 0,
                        });
                      }
                      const entry = previewMap.get(alloc.targetCantiereId)!;
                      entry.ddtLabels.push(ddtFormattedTag);
                      entry.ddtNames.push(dName);
                      entry.total += activeTot;
                    });

                    // Includi anche gli oneri accessori attribuiti ai cantieri
                    if (parsedInvoice.orphanExpenses && parsedInvoice.orphanExpenses.length > 0) {
                      parsedInvoice.orphanExpenses.forEach((exp) => {
                        const alloc = lineAllocations[exp.numeroLinea];
                        if (!alloc || alloc.targetCantiereId === '__ignore__' || alloc.targetCantiereId === '__sospeso__') return;
                        if (alloc.isSplit && alloc.splits.length > 0) {
                          alloc.splits.forEach((sp) => {
                            if (sp.cantiereId === '__ignore__' || sp.cantiereId === '__sospeso__' || !sp.cantiereId) return;
                            const cantiereObj = allCantieri.find((c: Cantiere) => c.id === sp.cantiereId);
                            if (!cantiereObj) return;
                            if (!previewMap.has(sp.cantiereId)) {
                              previewMap.set(sp.cantiereId, {
                                cantiereName: `${cantiereObj.name} (${cantiereObj.client} - ${cantiereObj.city})`,
                                ddtLabels: [],
                                ddtNames: [],
                                total: 0,
                                orphanTotal: 0,
                              });
                            }
                            const entry = previewMap.get(sp.cantiereId)!;
                            entry.total += sp.amount;
                            entry.orphanTotal = (entry.orphanTotal || 0) + sp.amount;
                          });
                        } else if (alloc.targetCantiereId) {
                          const cantiereObj = allCantieri.find((c: Cantiere) => c.id === alloc.targetCantiereId);
                          if (!cantiereObj) return;
                          if (!previewMap.has(alloc.targetCantiereId)) {
                            previewMap.set(alloc.targetCantiereId, {
                              cantiereName: `${cantiereObj.name} (${cantiereObj.client} - ${cantiereObj.city})`,
                              ddtLabels: [],
                              ddtNames: [],
                              total: 0,
                              orphanTotal: 0,
                            });
                          }
                          const entry = previewMap.get(alloc.targetCantiereId)!;
                          entry.total += exp.prezzoTotale;
                          entry.orphanTotal = (entry.orphanTotal || 0) + exp.prezzoTotale;
                        }
                      });
                    }

                    const previewEntries = Array.from(previewMap.values());
                    if (previewEntries.length === 0) return null;

                    const finalInvNum = (customInvoiceNumber && customInvoiceNumber.trim()) || parsedInvoice.datiDocumento.numero;

                    return (
                      <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Anteprima Riga Unica per Cantiere (dopo l'importazione):</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            I DDT dello stesso cantiere vengono uniti con il loro totale
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {previewEntries.map((pe, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="font-bold text-white flex items-center gap-2">
                                  <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span>{pe.cantiereName}</span>
                                </div>
                                <div className="text-[11px] text-slate-300">
                                  <span className="text-slate-400 font-semibold">TIPO DOC / FORNITORE / CLIENTE: </span>
                                  <span className="font-mono text-emerald-300 font-bold">
                                    {buildFormattedTypeAndSubject(parsedInvoice.cedentePrestatore.denominazione, pe.ddtLabels)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                                  <span>
                                    <span className="text-slate-400 font-semibold">N° DOC.: </span>
                                    <span className="font-mono text-amber-300 font-bold">
                                      {finalInvNum}
                                    </span>
                                  </span>
                                  <span className="text-slate-600">•</span>
                                  <span>
                                    <span className="text-slate-400 font-semibold">N./PROT: </span>
                                    <span className="font-mono text-slate-300">
                                      {customProtocol ? customProtocol.trim() : (pe.ddtNames.length === 1 ? pe.ddtNames[0] : 'DDT-VARI')}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                  {isNotaDiCredito ? 'Storno Acquisti (-):' : 'Totale Acquisti:'}
                                </span>
                                <span className={`font-mono text-base font-black ${isNotaDiCredito ? 'text-rose-400' : 'text-rose-300'}`}>
                                  {formatCurrency((isNotaDiCredito ? -1 : 1) * pe.total)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Mode 3: By Line Selection */}
              {allocationMode === 'by_line' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span>Righe di Dettaglio Materiali ({parsedInvoice.righe.length}):</span>
                    {isNotaDiCredito ? (
                      <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                        <MinusCircle className="h-3 w-3 text-rose-400" />
                        <span>Nota di Credito: importi delle righe con segno meno (-)</span>
                      </span>
                    ) : (
                      <span>Assegnazione / Ripartizione</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {parsedInvoice.righe.map((riga) => {
                      const alloc = lineAllocations[riga.numeroLinea] || {
                        targetCantiereId: cantieri[0]?.id ?? '',
                        isSplit: false,
                        splits: [],
                      };

                      return (
                        <div
                          key={riga.numeroLinea}
                          className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                            alloc.targetCantiereId === '__ignore__'
                              ? 'bg-slate-950/70 border-rose-900/50 opacity-80'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-xs font-bold text-amber-400">
                                R{riga.numeroLinea}
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  alloc.targetCantiereId === '__ignore__'
                                    ? 'text-slate-500 line-through'
                                    : 'text-white'
                                }`}
                              >
                                {riga.descrizione}
                              </span>
                              {riga.isReturnOrDiscount && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <MinusCircle className="h-3 w-3" />
                                  <span>RESO / STORNO</span>
                                </span>
                              )}
                              {riga.isOrphanExpense && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  <span>ONERE ACCESSORIO</span>
                                </span>
                              )}
                              {riga.isDescriptive && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                  DESCRITTIVA (€ 0,00)
                                </span>
                              )}
                              {alloc.targetCantiereId === '__ignore__' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  DA NON CONSIDERARE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {riga.quantita && (
                                <span className="text-xs text-slate-400">
                                  {riga.quantita} {riga.unitaMisura || 'pz'}
                                </span>
                              )}
                              <span
                                className={`font-mono text-xs font-bold ${
                                  alloc.targetCantiereId === '__ignore__'
                                    ? 'text-slate-500 line-through'
                                    : riga.prezzoTotale < 0
                                    ? 'text-amber-400'
                                    : 'text-rose-300'
                                }`}
                              >
                                {formatCurrency(riga.prezzoTotale)}
                              </span>
                            </div>
                          </div>

                          {/* AI Suggestion Badge */}
                          {alloc.aiSuggestion && (
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded text-[11px] text-indigo-300 flex items-start gap-2">
                              <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">
                                  Gemini AI ({alloc.aiSuggestion.confidence}%):{' '}
                                </span>
                                <span>{alloc.aiSuggestion.reasoning}</span>
                              </div>
                            </div>
                          )}

                          {/* Line allocation controls */}
                          {!alloc.isSplit ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-slate-800/80">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <CantiereSearchSelect
                                  value={alloc.targetCantiereId}
                                  hasError={showValidationErrors && !alloc.targetCantiereId}
                                  onChange={(val) => {
                                    if (val === '__create_new__') {
                                      openCreateCantiereModal({ mode: 'line', key: riga.numeroLinea });
                                      return;
                                    }
                                    setLineAllocations((prev) => ({
                                      ...prev,
                                      [riga.numeroLinea]: {
                                        ...prev[riga.numeroLinea],
                                        targetCantiereId: val,
                                      },
                                    }));
                                    if (val) setErrorMessage(null);
                                  }}
                                  cantieri={allCantieri}
                                  onCreateNew={() => openCreateCantiereModal({ mode: 'line', key: riga.numeroLinea })}
                                  showSospesiOption={true}
                                  showIgnoreOption={true}
                                  sospesiLabel="⚠️ Invia a SCHEDA SOSPESI (Da attribuire)"
                                  ignoreLabel="⛔ DA NON CONSIDERARE (Spese bancarie / Spese generali)"
                                  placeholder="Cerca cantiere per nome o città..."
                                  size="sm"
                                  className="flex-1 min-w-0"
                                />

                                <button
                                  type="button"
                                  onClick={() => openCreateCantiereModal({ mode: 'line', key: riga.numeroLinea })}
                                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                  title="Crea direttamente un nuovo cantiere con la schermata standard"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Nuovo</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isCurrentlyIgnored = alloc.targetCantiereId === '__ignore__';
                                    setLineAllocations((prev) => ({
                                      ...prev,
                                      [riga.numeroLinea]: {
                                        ...prev[riga.numeroLinea],
                                        targetCantiereId: isCurrentlyIgnored
                                          ? ''
                                          : '__ignore__',
                                        isSplit: false,
                                      },
                                    }));
                                  }}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                    alloc.targetCantiereId === '__ignore__'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                      : 'bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-700'
                                  }`}
                                  title="Escludi o ripristina questa riga dal conteggio dei cantieri"
                                >
                                  <Ban className="h-3 w-3" />
                                  <span>{alloc.targetCantiereId === '__ignore__' ? 'Esclusa' : 'Non Considerare'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSplitLine(riga.numeroLinea, riga.prezzoTotale)
                                  }
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                                  title="Ripartisci questa riga tra 2 o più cantieri"
                                >
                                  <Split className="h-3 w-3 text-amber-400" />
                                  <span>Ripartisci %</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Split view for this line */
                            <div className="p-2.5 bg-slate-900 rounded-lg border border-amber-500/30 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                                <span className="flex items-center gap-1">
                                  <Split className="h-3 w-3" />
                                  <span>Ripartizione Multipla su più Cantieri:</span>
                                </span>
                                <button
                                  onClick={() =>
                                    handleToggleSplitLine(riga.numeroLinea, riga.prezzoTotale)
                                  }
                                  className="text-slate-400 hover:text-white underline"
                                >
                                  Annulla ripartizione
                                </button>
                              </div>

                              {alloc.splits.map((sp, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <CantiereSearchSelect
                                      value={sp.cantiereId}
                                      hasError={showValidationErrors && !sp.cantiereId}
                                      onChange={(val) => {
                                        if (val === '__create_new__') {
                                          openCreateCantiereModal({ mode: 'line_split', key: riga.numeroLinea, splitIndex: sIdx });
                                          return;
                                        }
                                        handleUpdateLineSplit(
                                          riga.numeroLinea,
                                          sIdx,
                                          val,
                                          sp.percentage,
                                          riga.prezzoTotale
                                        );
                                        if (val) setErrorMessage(null);
                                      }}
                                      cantieri={allCantieri}
                                      onCreateNew={() => openCreateCantiereModal({ mode: 'line_split', key: riga.numeroLinea, splitIndex: sIdx })}
                                      showSospesiOption={true}
                                      showIgnoreOption={true}
                                      sospesiLabel="⚠️ Scheda Sospesi"
                                      ignoreLabel="⛔ DA NON CONSIDERARE"
                                      placeholder="Cerca cantiere per nome o città..."
                                      size="sm"
                                      className="flex-1 min-w-0"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => openCreateCantiereModal({ mode: 'line_split', key: riga.numeroLinea, splitIndex: sIdx })}
                                      className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                      title="Crea direttamente un nuovo cantiere con la schermata standard"
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span>Nuovo</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1 w-24">
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={sp.percentage}
                                      onChange={(e) => {
                                        const p = parseFloat(e.target.value) || 0;
                                        handleUpdateLineSplit(
                                          riga.numeroLinea,
                                          sIdx,
                                          sp.cantiereId,
                                          p,
                                          riga.prezzoTotale
                                        );
                                      }}
                                      className="w-14 bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-white text-xs"
                                    />
                                    <span className="text-slate-400">%</span>
                                  </div>

                                  <span className="w-20 text-right font-mono text-rose-300 font-semibold text-xs">
                                    {formatCurrency(sp.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Imponibile Accounting Breakdown */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
          {parsedInvoice && (
            <div className="flex flex-col gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              {/* Primary Accounting Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* 1. Imponibile Cantieri */}
                <div className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                  isNotaDiCredito
                    ? 'bg-rose-950/40 border-rose-500/40'
                    : 'bg-emerald-950/40 border-emerald-500/40'
                }`}>
                  <Building className={`h-4 w-4 mt-0.5 shrink-0 ${isNotaDiCredito ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-[10px] uppercase font-bold block tracking-wider ${
                      isNotaDiCredito ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      1. Imponibile Cantieri:
                    </span>
                    <span className={`text-base font-black font-mono block ${
                      isNotaDiCredito ? 'text-rose-300' : 'text-emerald-300'
                    }`}>
                      {formatCurrency(computedStats.cantieri)}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Destinato alle schede cantiere
                    </span>
                  </div>
                </div>

                {/* 2. Imponibile Sospesi */}
                <div className="p-2.5 rounded-lg border bg-amber-950/40 border-amber-500/40 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                      2. Imponibile a Sospesi:
                    </span>
                    <span className="text-base font-black font-mono text-amber-300 block">
                      {formatCurrency(computedStats.sospesi)}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Inviato a Scheda Sospesi
                    </span>
                  </div>
                </div>

                {/* 3. TOTALE DESTINATO + SOSPESI (Richiesto: è questo che deve quadrare con la contabilità) */}
                <div className="p-2.5 rounded-lg border-2 border-indigo-400/90 bg-indigo-950/70 ring-2 ring-indigo-500/20 shadow-md flex items-start gap-2.5 relative overflow-hidden">
                  <Layers className="h-4 w-4 mt-0.5 text-indigo-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-black text-indigo-300 tracking-wider">
                        TOT. DESTINATO + SOSPESI:
                      </span>
                      <span className="px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-200 text-[9px] font-bold border border-indigo-400/40 uppercase">
                        (1 + 2)
                      </span>
                    </div>
                    <span className="text-base font-black font-mono text-white block">
                      {formatCurrency(computedStats.cantieriPlusSospesi)}
                    </span>
                    <span className="text-[10px] text-indigo-300 font-semibold block truncate">
                      Totale registrato a sistema
                    </span>
                  </div>
                </div>

                {/* 4. Imponibile Fattura / Contabilità */}
                <div className="p-2.5 rounded-lg border bg-slate-950 border-slate-700 flex items-start gap-2.5">
                  <FileText className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider truncate">
                        Imponibile Fattura:
                      </span>
                      {isNotaDiCredito ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                          NC (-)
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          Contabilità
                        </span>
                      )}
                    </div>
                    <span className={`text-base font-black font-mono block ${isNotaDiCredito ? 'text-rose-300' : 'text-white'}`}>
                      {formatCurrency(computedStats.imponibileTotal)}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {parsedInvoice.datiDocumento.riepilogoIVA && parsedInvoice.datiDocumento.riepilogoIVA.length > 1
                        ? `${parsedInvoice.datiDocumento.riepilogoIVA.length} aliquote IVA considerate`
                        : 'Totale imponibile da quadrare'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Bar: Quadratura con la contabilità (Destinato + Sospesi vs Imponibile Contabile) */}
              {(() => {
                const diffWithAccounting = Math.round((Math.abs(computedStats.imponibileTotal) - Math.abs(computedStats.cantieriPlusSospesi)) * 100) / 100;
                const isExactMatch = Math.abs(diffWithAccounting) < 0.01;
                // Considera anche le voci "Non considerare" se l'utente le ha escluse volontariamente
                const diffWithIgnored = Math.round((diffWithAccounting - computedStats.ignored) * 100) / 100;
                const isMatchWithIgnored = Math.abs(diffWithIgnored) < 0.01 && computedStats.ignored > 0;

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isExactMatch ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>✓ QUADRATURA CONTABILE PERFETTA (100%): Totale Destinato + Sospesi ({formatCurrency(computedStats.cantieriPlusSospesi)}) coincide con l'imponibile contabile</span>
                        </div>
                      ) : isMatchWithIgnored ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>✓ Quadratura OK (Destinato + Sospesi + {formatCurrency(computedStats.ignored)} Non Considerati = Imponibile Fattura)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-lg border border-amber-500/40">
                          <Info className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>
                            {diffWithAccounting > 0
                              ? `Differenza da quadrare: mancano ${formatCurrency(diffWithAccounting)} all'imponibile contabile (Destinato + Sospesi: ${formatCurrency(computedStats.cantieriPlusSospesi)})`
                              : `Differenza: il Totale Destinato + Sospesi supera di ${formatCurrency(Math.abs(diffWithAccounting))} l'imponibile contabile`}
                          </span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap pl-1">
                        <span>Non Considerare: <strong className="text-rose-300 font-mono">{formatCurrency(computedStats.ignored)}</strong></span>
                        {computedStats.unassignedCount > 0 ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-400" />
                              <span>Da Selezionare: <strong className="font-mono text-white">{formatCurrency(computedStats.unassigned)}</strong> ({computedStats.unassignedCount} {computedStats.unassignedCount === 1 ? 'voce' : 'voci'})</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              <span>Tutte le voci valorizzate</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0 self-end sm:self-auto">
                      <span>Tot. Doc (con IVA): <strong className={isNotaDiCredito ? 'text-rose-300' : 'text-slate-300'}>{formatCurrency(computedStats.total)}</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Inline alert in footer if user clicked confirm with unassigned boxes */}
          {showValidationErrors && computedStats.unassignedCount > 0 && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center justify-between gap-2 animate-shake">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="font-semibold">
                  Impossibile confermare: ci sono ancora <strong>{computedStats.unassignedCount} caselle</strong> da valorizzare con un Cantiere, i Sospesi o 'Da Non Considerare'!
                </span>
              </div>
              <span className="text-[11px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40 shrink-0">
                {computedStats.unassignedCount} mancanti
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500 italic hidden sm:inline">
              {computedStats.unassignedCount > 0
                ? '⚠️ Seleziona una destinazione per tutte le voci prima di confermare la registrazione.'
                : 'Verifica che il totale imponibile destinato coincida con il totale imponibile registrato in contabilità.'}
            </span>

            <div className="flex items-center gap-2 justify-end shrink-0 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Annulla
              </button>

              {parsedInvoice && (
                <button
                  onClick={() => handleConfirmAndCommit(false)}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                    computedStats.unassignedCount > 0
                      ? 'bg-amber-600 hover:bg-amber-500 ring-1 ring-amber-400/50'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                  title={
                    computedStats.unassignedCount > 0
                      ? `Attenzione: ci sono ${computedStats.unassignedCount} caselle ancora da selezionare`
                      : 'Tutte le caselle sono valorizzate. Clicca per confermare e registrare nei cantieri'
                  }
                >
                  {computedStats.unassignedCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-200" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>
                    {computedStats.unassignedCount > 0
                      ? `Conferma (${computedStats.unassignedCount} da selezionare)`
                      : 'Conferma e Registra Movimenti nei Cantieri'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nuovo Cantiere identica alla schermata standard del tasto "Nuovo Cantiere" */}
      {createCantiereContext && (
        <CantiereModal
          zIndex="z-[80]"
          initialData={{
            city: allCantieri[0]?.city || '',
            year: 2026,
            status: 'attivo',
          }}
          onClose={() => setCreateCantiereContext(null)}
          onSave={handleSaveNewCantiereFromModal}
        />
      )}

      {/* Duplicate invoice confirmation modal */}
      {duplicatePromptLocations && parsedInvoice && (
        <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-left space-y-4 animate-scaleIn">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Fattura già importata
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  La fattura di acquisto <strong className="text-amber-300 font-mono">N° {(customInvoiceNumber && customInvoiceNumber.trim()) || parsedInvoice.datiDocumento.numero}</strong> del{' '}
                  <strong className="text-slate-200">{formatDateItalian(parsedInvoice.datiDocumento.data)}</strong> del fornitore{' '}
                  <strong className="text-white">{parsedInvoice.cedentePrestatore.denominazione}</strong> risulta già importata nel sistema nei seguenti cantieri:
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
                  <div className="text-right font-mono font-bold text-rose-300 whitespace-nowrap shrink-0">
                    {formatCurrency(loc.amount)}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-200">
              Sei sicuro di voler procedere comunque con l'importazione di questa fattura?
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
                  handleConfirmAndCommit(true);
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
