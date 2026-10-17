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
} from 'lucide-react';
import { Cantiere, ParsedInvoiceXML, Movement, SospesoItem } from '../types';
import { parseFatturaElettronicaXML } from '../utils/xmlParser';
import { SAMPLE_INVOICES, SampleInvoice } from '../utils/sampleInvoices';
import { formatCurrency, formatDateItalian } from '../utils/calculations';
import {
  findExistingPurchaseInvoiceLocations,
  InvoiceLocation,
  formatSingleDdtTag,
  buildFormattedTypeAndSubject,
} from '../utils/invoiceDuplicateHelper';
import { CantiereSearchSelect } from './CantiereSearchSelect';

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

  // Duplicate invoice prompt state
  const [duplicatePromptLocations, setDuplicatePromptLocations] = useState<InvoiceLocation[] | null>(null);

  // Allocation Mode
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('by_line');
  const [wholeInvoiceCantiereId, setWholeInvoiceCantiereId] = useState<string>(
    preselectedCantiereId || (cantieri[0]?.id ?? '')
  );

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
      cantieri,
      sospesi,
      parsedInvoice.fileName
    );
  }, [parsedInvoice, customInvoiceNumber, cantieri, sospesi]);

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

  // State for Quick Cantiere Creation directly from any dropdown
  interface QuickCreateTargetContext {
    mode: 'whole' | 'ddt' | 'line' | 'line_split';
    key?: string | number;
    splitIndex?: number;
  }
  const [quickCreateContext, setQuickCreateContext] = useState<QuickCreateTargetContext | null>(null);
  const [quickCity, setQuickCity] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [quickClient, setQuickClient] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);

  const openQuickCreate = (context: QuickCreateTargetContext) => {
    setQuickCreateContext(context);
    setQuickCity(cantieri[0]?.city || '');
    setQuickAddress('');
    setQuickClient('');
    setQuickName('');
    setQuickError(null);
  };

  const handleExecuteQuickCreateCantiere = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCity.trim() || !quickClient.trim()) {
      setQuickError('Inserisci obbligatoriamente Città e Nome del Cliente.');
      return;
    }
    setQuickError(null);

    const generatedName = quickName.trim()
      ? quickName.trim().toUpperCase()
      : `${quickCity.trim().toUpperCase()} - ${(quickAddress.trim() || quickClient.trim()).toUpperCase()}`;

    let newCantiere: Cantiere;
    if (onCreateNewCantiereDirectly) {
      newCantiere = onCreateNewCantiereDirectly({
        city: quickCity.trim().toUpperCase(),
        address: quickAddress.trim().toUpperCase(),
        client: quickClient.trim().toUpperCase(),
        name: generatedName,
      });
    } else {
      newCantiere = {
        id: `cantiere-${Date.now()}`,
        name: generatedName,
        city: quickCity.trim().toUpperCase(),
        address: quickAddress.trim().toUpperCase(),
        client: quickClient.trim().toUpperCase(),
        date: new Date().toISOString().slice(0, 10),
        year: 2026,
        initialInventory: 0,
        finalInventory: 0,
        category: 'elettrico',
        status: 'attivo',
        notes: '',
        movements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Automatically select the newly created cantiere in the active allocation field
    if (quickCreateContext) {
      if (quickCreateContext.mode === 'whole') {
        setWholeInvoiceCantiereId(newCantiere.id);
      } else if (quickCreateContext.mode === 'ddt' && quickCreateContext.key) {
        setDdtAllocations((prev) => ({
          ...prev,
          [String(quickCreateContext.key)]: {
            ...prev[String(quickCreateContext.key)],
            targetCantiereId: newCantiere.id,
          },
        }));
      } else if (quickCreateContext.mode === 'line' && quickCreateContext.key !== undefined) {
        const lineNum = Number(quickCreateContext.key);
        setLineAllocations((prev) => ({
          ...prev,
          [lineNum]: {
            ...prev[lineNum],
            targetCantiereId: newCantiere.id,
          },
        }));
      } else if (
        quickCreateContext.mode === 'line_split' &&
        quickCreateContext.key !== undefined &&
        quickCreateContext.splitIndex !== undefined
      ) {
        const lineNum = Number(quickCreateContext.key);
        const sIdx = quickCreateContext.splitIndex;
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
      }
    }

    setQuickCreateContext(null);
    setQuickCity('');
    setQuickAddress('');
    setQuickClient('');
    setQuickName('');
  };

  // Handle file select or drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const readFile = (file: File) => {
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

      // Initialize default allocation for each line
      const defaultCantiere = preselectedCantiereId || (cantieri[0]?.id ?? '');
      const initLines: Record<number, LineAllocation> = {};
      parsed.righe.forEach((r) => {
        initLines[r.numeroLinea] = {
          targetCantiereId: defaultCantiere,
          isSplit: false,
          splits: [
            { cantiereId: defaultCantiere, percentage: 100, amount: r.prezzoTotale },
          ],
        };
      });
      setLineAllocations(initLines);

      // Initialize default allocation and customizable names for each DDT
      const initDdts: Record<string, DdtAllocation> = {};
      const initDdtNames: Record<string, string> = {};
      parsed.ddtList.forEach((d) => {
        initDdts[d.numeroDDT] = {
          targetCantiereId: defaultCantiere,
          isSplit: false,
          splits: [
            { cantiereId: defaultCantiere, percentage: 100, amount: d.totaleDDT || 0 },
          ],
        };
        initDdtNames[d.numeroDDT] = d.numeroDDT.toUpperCase().startsWith('DDT')
          ? d.numeroDDT
          : `DDT ${d.numeroDDT}`;
      });
      setDdtAllocations(initDdts);
      setCustomDdtNames(initDdtNames);
      setExcludedLines({});
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
    if (cantieri.length === 0) {
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

      const cantieriPayload = cantieri.map((c) => ({
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
        const c1 = cantieri[0]?.id ?? '';
        const c2 = cantieri[1]?.id ?? c1;
        return {
          ...current,
          isSplit: true,
          splits: [
            { cantiereId: c1, percentage: 50, amount: Math.round(totalAmount * 0.5 * 100) / 100 },
            { cantiereId: c2, percentage: 50, amount: Math.round(totalAmount * 0.5 * 100) / 100 },
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

  // Live calculation of totals: Cantieri vs Sospesi vs Esclusi (Non Considerare)
  const computedStats = React.useMemo(() => {
    if (!parsedInvoice) return { cantieri: 0, sospesi: 0, ignored: 0, total: 0, imponibileTotal: 0, isNotaDiCredito: false };
    let cantieriSum = 0;
    let sospesiSum = 0;
    let ignoredSum = 0;

    if (allocationMode === 'whole') {
      const tot = invoiceImponibile;
      if (wholeInvoiceCantiereId === '__ignore__') ignoredSum += tot;
      else if (wholeInvoiceCantiereId === '__sospeso__') sospesiSum += tot;
      else cantieriSum += tot;
    } else if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
      parsedInvoice.ddtList.forEach((ddt) => {
        const alloc = ddtAllocations[ddt.numeroDDT];
        if (!alloc) return;

        const connectedLines = parsedInvoice.righe.filter((r) =>
          ddt.riferimentoLinee.includes(r.numeroLinea)
        );
        const activeLines = connectedLines.filter((r) => !excludedLines[r.numeroLinea]);
        const excludedLinesInDdt = connectedLines.filter((r) => excludedLines[r.numeroLinea]);

        const ddtActiveTotal = connectedLines.length > 0
          ? Math.round(activeLines.reduce((sum, r) => sum + Math.abs(r.prezzoTotale), 0) * 100) / 100
          : Math.abs(ddt.totaleDDT || 0);

        const ddtExcludedAmount = connectedLines.length > 0
          ? Math.round(excludedLinesInDdt.reduce((sum, r) => sum + Math.abs(r.prezzoTotale), 0) * 100) / 100
          : 0;

        if (alloc.targetCantiereId === '__ignore__') {
          ignoredSum += Math.abs(ddt.totaleDDT || 0);
        } else if (alloc.targetCantiereId === '__sospeso__') {
          sospesiSum += ddtActiveTotal;
          ignoredSum += ddtExcludedAmount;
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            const splitActiveAmount = Math.round(((ddtActiveTotal * sp.percentage) / 100) * 100) / 100;
            if (sp.cantiereId === '__ignore__') ignoredSum += splitActiveAmount;
            else if (sp.cantiereId === '__sospeso__') sospesiSum += splitActiveAmount;
            else cantieriSum += splitActiveAmount;
          });
          ignoredSum += ddtExcludedAmount;
        } else {
          cantieriSum += ddtActiveTotal;
          ignoredSum += ddtExcludedAmount;
        }
      });
    } else {
      parsedInvoice.righe.forEach((line) => {
        const alloc = lineAllocations[line.numeroLinea];
        const lineTot = Math.abs(line.prezzoTotale);
        if (!alloc) return;
        if (alloc.targetCantiereId === '__ignore__') {
          ignoredSum += lineTot;
        } else if (alloc.targetCantiereId === '__sospeso__') {
          sospesiSum += lineTot;
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            const spAmount = Math.abs(sp.amount);
            if (sp.cantiereId === '__ignore__') ignoredSum += spAmount;
            else if (sp.cantiereId === '__sospeso__') sospesiSum += spAmount;
            else cantieriSum += spAmount;
          });
        } else {
          cantieriSum += lineTot;
        }
      });
    }

    const sign = isNotaDiCredito ? -1 : 1;
    return {
      cantieri: Math.round(cantieriSum * sign * 100) / 100,
      sospesi: Math.round(sospesiSum * sign * 100) / 100,
      ignored: Math.round(ignoredSum * 100) / 100,
      total: Math.round(Math.abs(parsedInvoice.datiDocumento.importoTotale) * sign * 100) / 100,
      imponibileTotal: Math.round(invoiceImponibile * sign * 100) / 100,
      isNotaDiCredito,
    };
  }, [parsedInvoice, allocationMode, wholeInvoiceCantiereId, ddtAllocations, lineAllocations, excludedLines, invoiceImponibile, isNotaDiCredito]);

  // Commit all allocations into movements and/or sospesi
  const handleConfirmAndCommit = (bypassDuplicateCheck = false) => {
    if (!parsedInvoice) return;

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
      if (!wholeInvoiceCantiereId) {
        setErrorMessage('Seleziona il cantiere di destinazione o Scheda Sospesi.');
        return;
      }
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
            notes: `${isNotaDiCredito ? 'NOTA DI CREDITO - ' : ''}Importazione XML: ${parsedInvoice.fileName} - Fattura ${invoiceNum} (Totale Imponibile: € ${signedInvoiceImponibile.toFixed(2)})`,
            xmlRef: {
              supplier: supplierName,
              invoiceNum: invoiceNum,
            },
          },
        });
      }
    } else if (allocationMode === 'by_ddt' && parsedInvoice.ddtList.length > 0) {
      // Group DDTs assigned to the same cantiere so they become a single unified movement
      const cantiereGroups = new Map<
        string,
        {
          cantiereId: string;
          totalPurchases: number;
          ddtItems: Array<{ numeroDDT: string; dataDDT?: string; amount: number; percentage?: number }>;
        }
      >();

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
          ? Math.round(activeLines.reduce((sum, r) => sum + Math.abs(r.prezzoTotale), 0) * 100) / 100
          : Math.abs(ddt.totaleDDT || 0);

        if (ddtActiveTotal <= 0) {
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
            amount: sign * Math.abs(ddtActiveTotal),
            ddtNumber: customDdtName,
            ddtDate: ddt.dataDDT,
            protocol: manualProt || customDdtName,
            status: 'in_attesa_cliente',
            customerNote: isNotaDiCredito
              ? 'Nota di credito / DDT da stornare in attesa di chiarimento.'
              : 'DDT in attesa di destinazione da parte del committente/capocantiere.',
            sourceFileName: parsedInvoice.fileName,
          });
        } else if (alloc.isSplit && alloc.splits.length > 0) {
          alloc.splits.forEach((sp) => {
            if (sp.cantiereId === '__ignore__') return;
            const splitAmount = Math.round(((ddtActiveTotal * sp.percentage) / 100) * 100) / 100;
            if (splitAmount <= 0) return;

            if (sp.cantiereId === '__sospeso__') {
              sospesiCommitList.push({
                date: ddt.dataDDT || invoiceDate,
                docNumber: invoiceNum,
                supplier: supplierName,
                description: `${isNotaDiCredito ? '[NOTA DI CREDITO] ' : ''}${customDdtName} (quota ${sp.percentage}%): ${descSummary}`,
                amount: sign * Math.abs(splitAmount),
                ddtNumber: customDdtName,
                ddtDate: ddt.dataDDT,
                protocol: manualProt || customDdtName,
                status: 'in_attesa_cliente',
                customerNote: isNotaDiCredito
                  ? `Nota di credito: quota ${sp.percentage}% da stornare.`
                  : `Quota ${sp.percentage}% da definire col cliente.`,
                sourceFileName: parsedInvoice.fileName,
              });
            } else {
              if (!cantiereGroups.has(sp.cantiereId)) {
                cantiereGroups.set(sp.cantiereId, {
                  cantiereId: sp.cantiereId,
                  totalPurchases: 0,
                  ddtItems: [],
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

      // Now create a single movement row per cantiere containing the unified sum of all DDTs
      let groupIdx = 0;
      cantiereGroups.forEach((group, cantiereId) => {
        const roundedTotal = Math.round(group.totalPurchases * 100) / 100;
        if (roundedTotal <= 0) return;

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
        const signedPurchases = sign * Math.abs(roundedTotal);

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
            notes: `${isNotaDiCredito ? 'NOTA DI CREDITO - ' : ''}Fattura ${invoiceNum} - Totale unico di ${group.ddtItems.length} DDT (${ddtNamesOnly})`,
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
                      setAiSuccessMessage('Tutti gli elementi impostati per la SCHEDA SOSPESI.');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Tutti a Sospesi</span>
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
                        onChange={(val) => {
                          if (val === '__create_new__') {
                            openQuickCreate({ mode: 'whole' });
                            return;
                          }
                          setWholeInvoiceCantiereId(val);
                        }}
                        cantieri={cantieri}
                        onCreateNew={() => openQuickCreate({ mode: 'whole' })}
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
                      onClick={() => openQuickCreate({ mode: 'whole' })}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      title="Crea direttamente un nuovo cantiere da questo elenco"
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
                                  onChange={(val) => {
                                    if (val === '__create_new__') {
                                      openQuickCreate({ mode: 'ddt', key: ddt.numeroDDT });
                                      return;
                                    }
                                    setDdtAllocations((prev) => ({
                                      ...prev,
                                      [ddt.numeroDDT]: {
                                        ...prev[ddt.numeroDDT],
                                        targetCantiereId: val,
                                      },
                                    }));
                                  }}
                                  cantieri={cantieri}
                                  onCreateNew={() => openQuickCreate({ mode: 'ddt', key: ddt.numeroDDT })}
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
                                onClick={() => openQuickCreate({ mode: 'ddt', key: ddt.numeroDDT })}
                                className="px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                title="Crea direttamente un nuovo cantiere"
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
                                      ? (cantieri[0]?.id || '')
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

                  {/* Live Preview of Grouped Cantiere Rows */}
                  {(() => {
                    const previewMap = new Map<
                      string,
                      {
                        cantiereName: string;
                        ddtLabels: string[];
                        ddtNames: string[];
                        total: number;
                      }
                    >();

                    parsedInvoice.ddtList.forEach((ddt) => {
                      const alloc = ddtAllocations[ddt.numeroDDT];
                      if (!alloc || alloc.targetCantiereId === '__ignore__' || alloc.targetCantiereId === '__sospeso__') return;
                      const cantiereObj = cantieri.find((c) => c.id === alloc.targetCantiereId);
                      if (!cantiereObj) return;

                      const connected = parsedInvoice.righe.filter((r) => ddt.riferimentoLinee.includes(r.numeroLinea));
                      const active = connected.filter((r) => !excludedLines[r.numeroLinea]);
                      const activeTot = connected.length > 0
                        ? active.reduce((s, r) => s + Math.abs(r.prezzoTotale), 0)
                        : Math.abs(ddt.totaleDDT || 0);
                      if (activeTot <= 0) return;

                      const dName = getDdtDisplayName(ddt.numeroDDT);
                      const ddtFormattedTag = formatSingleDdtTag(dName, ddt.dataDDT);

                      if (!previewMap.has(alloc.targetCantiereId)) {
                        previewMap.set(alloc.targetCantiereId, {
                          cantiereName: `${cantiereObj.name} (${cantiereObj.client} - ${cantiereObj.city})`,
                          ddtLabels: [],
                          ddtNames: [],
                          total: 0,
                        });
                      }
                      const entry = previewMap.get(alloc.targetCantiereId)!;
                      entry.ddtLabels.push(ddtFormattedTag);
                      entry.ddtNames.push(dName);
                      entry.total += activeTot;
                    });

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
                                  onChange={(val) => {
                                    if (val === '__create_new__') {
                                      openQuickCreate({ mode: 'line', key: riga.numeroLinea });
                                      return;
                                    }
                                    setLineAllocations((prev) => ({
                                      ...prev,
                                      [riga.numeroLinea]: {
                                        ...prev[riga.numeroLinea],
                                        targetCantiereId: val,
                                      },
                                    }));
                                  }}
                                  cantieri={cantieri}
                                  onCreateNew={() => openQuickCreate({ mode: 'line', key: riga.numeroLinea })}
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
                                  onClick={() => openQuickCreate({ mode: 'line', key: riga.numeroLinea })}
                                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                  title="Crea direttamente un nuovo cantiere"
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
                                          ? (cantieri[0]?.id || '')
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
                                  <div className="flex-1 min-w-0">
                                    <CantiereSearchSelect
                                      value={sp.cantiereId}
                                      onChange={(val) => {
                                        if (val === '__create_new__') {
                                          openQuickCreate({ mode: 'line_split', key: riga.numeroLinea, splitIndex: sIdx });
                                          return;
                                        }
                                        handleUpdateLineSplit(
                                          riga.numeroLinea,
                                          sIdx,
                                          val,
                                          sp.percentage,
                                          riga.prezzoTotale
                                        );
                                      }}
                                      cantieri={cantieri}
                                      onCreateNew={() => openQuickCreate({ mode: 'line_split', key: riga.numeroLinea, splitIndex: sIdx })}
                                      showSospesiOption={true}
                                      showIgnoreOption={true}
                                      sospesiLabel="⚠️ Scheda Sospesi"
                                      ignoreLabel="⛔ DA NON CONSIDERARE"
                                      placeholder="Cerca cantiere per nome o città..."
                                      size="sm"
                                      className="flex-1 min-w-0"
                                    />
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              {/* Primary Accounting Comparison Box */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  isNotaDiCredito
                    ? 'bg-rose-950/60 border-rose-500/50'
                    : 'bg-emerald-950/60 border-emerald-500/40'
                }`}>
                  <Building className={`h-4 w-4 shrink-0 ${isNotaDiCredito ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <div>
                    <span className={`text-[10px] uppercase font-bold block tracking-wider ${
                      isNotaDiCredito ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      Totale Imponibile Destinato:
                    </span>
                    <span className={`text-base font-black font-mono ${
                      isNotaDiCredito ? 'text-rose-300' : 'text-emerald-300'
                    }`}>
                      {formatCurrency(computedStats.cantieri)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Totale Imponibile {isNotaDiCredito ? 'Nota di Credito' : 'Fattura'} (Contabilità):
                    </span>
                    <span className={`text-base font-black font-mono ${isNotaDiCredito ? 'text-rose-300' : 'text-white'}`}>
                      {formatCurrency(computedStats.imponibileTotal)}
                    </span>
                  </div>
                  {isNotaDiCredito && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                      Nota di Credito (-)
                    </span>
                  )}
                  {parsedInvoice.datiDocumento.riepilogoIVA && parsedInvoice.datiDocumento.riepilogoIVA.length > 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {parsedInvoice.datiDocumento.riepilogoIVA.length} aliquote IVA
                    </span>
                  )}
                </div>

                {/* Match / Difference status badge */}
                <div className="flex items-center">
                  {Math.abs(computedStats.cantieri - computedStats.imponibileTotal) < 0.01 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/30">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Coincide con l'imponibile contabile (100%)</span>
                    </div>
                  ) : (
                    <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>
                          {Math.abs(computedStats.cantieri) < Math.abs(computedStats.imponibileTotal)
                            ? `Mancano ${formatCurrency(Math.abs(computedStats.imponibileTotal) - Math.abs(computedStats.cantieri))} all'imponibile contabile`
                            : `Supera di ${formatCurrency(Math.abs(computedStats.cantieri) - Math.abs(computedStats.imponibileTotal))} l'imponibile contabile`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Sospesi: <strong className="text-amber-300 font-mono">{formatCurrency(computedStats.sospesi)}</strong> • Non Considerare: <strong className="text-rose-300 font-mono">{formatCurrency(computedStats.ignored)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary details and Total doc */}
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
                <span className="hidden xl:inline">Tot. Doc (con IVA): <strong className={isNotaDiCredito ? 'text-rose-300' : 'text-slate-300'}>{formatCurrency(computedStats.total)}</strong></span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500 italic hidden sm:inline">
              Verifica che il totale imponibile destinato coincida con il totale imponibile registrato in contabilità.
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Conferma e Registra Movimenti nei Cantieri</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Create Cantiere Modal directly from dropdown */}
      {quickCreateContext && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleIn text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Building className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Crea Nuovo Cantiere Rapido</h3>
              </div>
              <button
                onClick={() => setQuickCreateContext(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Inserisci i dati del cantiere. Verrà creato istantaneamente e subito selezionato per questa assegnazione.
            </p>

            {quickError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{quickError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteQuickCreateCantiere} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Città Cantiere <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  placeholder="es. MILANO, MONZA, ROMA..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white uppercase focus:outline-none focus:border-emerald-400 font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Via / Indirizzo e N° Civico:
                </label>
                <input
                  type="text"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  placeholder="es. VIA ROMA 10, CORSO ITALIA 45..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white uppercase focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nome Cliente / Committente <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={quickClient}
                  onChange={(e) => setQuickClient(e.target.value)}
                  placeholder="es. ROSSI MARIO, CONDOMINIO VERDI, SRL AZIENDA..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white uppercase focus:outline-none focus:border-emerald-400 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">
                  Denominazione Cantiere (opzionale):
                </label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder={
                    quickCity.trim()
                      ? `${quickCity.toUpperCase()} - ${(quickAddress.trim() || quickClient.trim()).toUpperCase()}`
                      : 'Auto-generato da Città e Indirizzo'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 uppercase focus:outline-none focus:border-emerald-400 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickCreateContext(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Crea Cantiere e Assegna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
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
