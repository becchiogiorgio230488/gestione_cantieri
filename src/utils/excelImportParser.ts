import * as XLSX from 'xlsx';
import { Cantiere, Movement, SospesoItem } from '../types';

export type ExcelImportType = 'singola_scheda' | 'scheda_sospesi' | 'prospetto_generale';

export interface ParsedSingolaSchedaData {
  header: {
    cantiereName: string;
    dittaName: string;
    city: string;
    address: string;
    committente: string;
    year: number;
    initialInventory: number;
  };
  movements: Array<{
    id: string;
    date: string;
    docNumber: string;
    typeAndSubject: string;
    protocol: string;
    purchases: number;
    issued: number;
    isSpecialRI: boolean;
  }>;
  ignoredRowsCount: number;
  totalPurchases: number;
  totalIssued: number;
}

export interface ParsedSospesiData {
  items: Array<{
    id: string;
    date: string;
    docNumber: string;
    supplier: string;
    protocol: string;
    amount: number;
    description: string;
    client?: string;
  }>;
  ignoredRowsCount: number;
  totalAmount: number;
}

export interface ParsedProspettoGeneraleData {
  cantieri: Array<{
    id: string;
    name: string;
    city: string;
    address: string;
    client: string;
    initialInventory: number;
    purchases: number;
    issued: number;
    finalInventory: number;
  }>;
  ignoredRowsCount: number;
  totalRI: number;
  totalAcquisti: number;
  totalEmesse: number;
  totalRF: number;
}

export interface ExcelParseResult {
  detectedType: ExcelImportType;
  sheetNames: string[];
  selectedSheet: string;
  singolaScheda?: ParsedSingolaSchedaData;
  sospesi?: ParsedSospesiData;
  prospettoGenerale?: ParsedProspettoGeneraleData;
  warnings: string[];
}

/**
 * Robust numeric parser for Excel strings, numbers, Italian currency formats (e.g. 1.250,50 €)
 */
export function parseExcelNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  const str = String(val).trim();
  if (!str) return 0;

  // Remove currency symbols and spaces
  let cleaned = str.replace(/[€$£\s]/g, '');

  // Handle parenthesized negative numbers e.g. (100.50)
  const isParenNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isParenNeg) {
    cleaned = cleaned.slice(1, -1);
  }

  // Handle Italian formatting: "1.250,50" -> 1250.50
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which is decimal
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // 1.250,50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,250.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  const result = isParenNeg ? -num : num;
  return Math.round(result * 100) / 100;
}

/**
 * Robust date parser supporting DD/MM/YYYY, YYYY-MM-DD, Excel date serials, Date objects
 */
export function parseExcelDate(val: any): string {
  const fallback = new Date().toISOString().slice(0, 10);
  if (val === null || val === undefined || val === '') return fallback;

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().slice(0, 10);
    }
    return fallback;
  }

  if (typeof val === 'number') {
    // Excel serial date code (number of days since 1899-12-30)
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = String(parsed.y).padStart(4, '0');
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    return fallback;
  }

  const str = String(val).trim();
  if (!str) return fallback;

  // Pattern DD/MM/YYYY or DD-MM-YYYY
  const itMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (itMatch) {
    let day = itMatch[1].padStart(2, '0');
    let month = itMatch[2].padStart(2, '0');
    let year = itMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Pattern YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return fallback;
}

/**
 * Check if a cell/text indicates a total row or non-data formula
 */
function isSummaryOrTotalRow(rowText: string): boolean {
  const upper = rowText.toUpperCase();
  const summaryKeywords = [
    'TOTALE',
    'TOTALI',
    'TOTALE SENZA RI',
    'TOTALE COMPRENSIVO',
    'QUADRATURA',
    'MASTRINO',
    'DELTA',
    'SOMMA',
    'SALDO TOTALE',
  ];
  return summaryKeywords.some((kw) => upper.includes(kw));
}

/**
 * Detect sheet type based on content analysis
 */
export function detectExcelSheetType(sheet: XLSX.WorkSheet, sheetName: string = ''): ExcelImportType {
  const upperSheetName = sheetName.toUpperCase();
  if (upperSheetName.includes('SOSPES') || upperSheetName.includes('DDT DA ATTR')) {
    return 'scheda_sospesi';
  }
  if (upperSheetName.includes('PROSPETTO') || upperSheetName.includes('GENERALE') || upperSheetName.includes('RIASSUNTO')) {
    return 'prospetto_generale';
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length === 0) return 'singola_scheda';

  // Search first 15 rows for column headers or identifying labels
  let scoreSingola = 0;
  let scoreSospesi = 0;
  let scoreProspetto = 0;

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const rowStr = (rawRows[r] || []).map((c) => String(c).toUpperCase()).join(' | ');

    if (rowStr.includes('CANTIERE:') || rowStr.includes('DATA DOC.') || rowStr.includes('N° DOC.')) {
      scoreSingola += 3;
    }
    if (rowStr.includes('TIPO DOC. / FORNITORE / CLIENTE') || rowStr.includes('TIPO DOC')) {
      scoreSingola += 4;
    }
    if (rowStr.includes('ACQUISTI') && rowStr.includes('EMESSE')) {
      scoreSingola += 2;
    }

    if (rowStr.includes('N. FATTURA') || rowStr.includes('NS. PROT.') || rowStr.includes('FORNITORE') && rowStr.includes('IMPORTO')) {
      scoreSospesi += 4;
    }
    if (rowStr.includes('SCHEDA SOSPESI') || rowStr.includes('SOSPESI')) {
      scoreSospesi += 3;
    }

    if (rowStr.includes('NOME CLIENTE') || (rowStr.includes('CITTA') && rowStr.includes('R.I.') && rowStr.includes('R.F.'))) {
      scoreProspetto += 5;
    }
    if (rowStr.includes('INDIRIZZO') && rowStr.includes('R.I.') && rowStr.includes('ACQUISTI')) {
      scoreProspetto += 4;
    }
  }

  if (scoreProspetto > scoreSingola && scoreProspetto > scoreSospesi) {
    return 'prospetto_generale';
  }
  if (scoreSospesi > scoreSingola && scoreSospesi > scoreProspetto) {
    return 'scheda_sospesi';
  }
  return 'singola_scheda';
}

/**
 * 1. Parser for Singola Scheda Cantiere
 */
export function parseSingolaSchedaExcel(
  sheet: XLSX.WorkSheet,
  fileName: string = ''
): ParsedSingolaSchedaData {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  let cantiereName = '';
  let dittaName = '';
  let city = '';
  let address = '';
  let committente = '';
  let year = new Date().getFullYear();
  let initialInventory = 0;

  // Helper to get non-empty cell value to the right in the same row
  const extractCellRightValue = (row: any[], startCol: number): string => {
    for (let offset = 1; startCol + offset < row.length; offset++) {
      const raw = row[startCol + offset];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const strVal = String(raw).trim();
        const upperVal = strVal.toUpperCase();
        if (
          upperVal.startsWith('DITTA') ||
          upperVal.startsWith('ANNO') ||
          upperVal.startsWith('DATA') ||
          upperVal.startsWith('DEL') ||
          upperVal.startsWith('CITTA') ||
          upperVal.startsWith('CANTIERE')
        ) {
          return '';
        }
        return strVal;
      }
    }
    return '';
  };

  // Header extraction from top rows (0 to 9)
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cellText = String(row[c] || '').trim();
      const upper = cellText.toUpperCase();

      // INDIRIZZO: dalla cella a destra di "CANTIERE:" (se è vuoto lo lasci vuoto)
      if (upper === 'CANTIERE:' || upper === 'CANTIERE') {
        address = extractCellRightValue(row, c);
      } else if (upper.startsWith('CANTIERE:') && cellText.includes(':')) {
        address = cellText.substring(cellText.indexOf(':') + 1).trim();
      }

      // CITTA': dalla cella a destra di "CITTA'" (se è vuoto lo lasci vuoto)
      if (upper === "CITTA':" || upper === 'CITTA:' || upper === "CITTA'" || upper === 'CITTA') {
        city = extractCellRightValue(row, c);
      } else if ((upper.startsWith("CITTA':") || upper.startsWith('CITTA:')) && cellText.includes(':')) {
        city = cellText.substring(cellText.indexOf(':') + 1).trim();
      }

      // NOME CANTIERE E COMMITTENTE: dalla cella a destra di "DEL:" (se è vuoto lo lasci vuoto)
      if (upper === 'DEL:' || upper === 'DEL') {
        const val = extractCellRightValue(row, c);
        cantiereName = val;
        committente = val;
      } else if (upper.startsWith('DEL:') && cellText.includes(':')) {
        const val = cellText.substring(cellText.indexOf(':') + 1).trim();
        cantiereName = val;
        committente = val;
      }

      // DITTA: dalla cella a destra di "DITTA:"
      if (upper === 'DITTA:' || upper === 'DITTA') {
        dittaName = extractCellRightValue(row, c);
      } else if (upper.startsWith('DITTA:') && cellText.includes(':')) {
        dittaName = cellText.substring(cellText.indexOf(':') + 1).trim();
      }

      // ANNO: dalla cella a destra di "ANNO:"
      if (upper === 'ANNO:' || upper === 'ANNO') {
        const rawAnno = extractCellRightValue(row, c);
        const nextVal = parseInt(rawAnno, 10);
        if (!isNaN(nextVal) && nextVal > 2000 && nextVal < 2100) year = nextVal;
      } else if (upper.startsWith('ANNO:') && cellText.includes(':')) {
        const nextVal = parseInt(cellText.substring(cellText.indexOf(':') + 1).trim(), 10);
        if (!isNaN(nextVal) && nextVal > 2000 && nextVal < 2100) year = nextVal;
      }
    }
  }

  // If cells are empty, leave them empty as requested (no artificial fallbacks)

  // Standard columns in Singola Scheda Cantiere XLS:
  // Colonna A (0): DATA DOC.
  // Colonna B (1): N° DOC. (il N° DOC va preso rigorosamente dalla Colonna B)
  // Colonna C (2): TIPO DOC. / FORNITORE / CLIENTE
  // Colonna D (3): N./PROT
  // Colonna E (4): ACQUISTI
  // Colonna F (5): EMESSE
  let headerRowIndex = -1;
  let colDate = 0;
  const colDocNum = 1; // Colonna B (indice 1) del foglio XLS
  let colTypeSubject = 2;
  let colProt = 3;
  let colAcquisti = 4;
  let colEmesse = 5;

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r] || [];
    const upperRow = row.map((cell) => String(cell || '').toUpperCase().trim());
    
    // Check if this row looks like the movement columns header
    const hasData = upperRow.some((c) => c.includes('DATA'));
    const hasDoc = upperRow.some((c) => c.includes('DOC') || c.includes('N°'));
    const hasAcquisti = upperRow.some((c) => c.includes('ACQUISTI') || c.includes('COSTI'));
    const hasEmesse = upperRow.some((c) => c.includes('EMESSE') || c.includes('RICAVI'));

    if ((hasData && hasDoc) || (hasAcquisti && hasEmesse)) {
      headerRowIndex = r;
      // Map other column indexes dynamically if they vary, keeping colDocNum fixed to 1 (Colonna B)
      upperRow.forEach((c, idx) => {
        if (idx === 1) return; // Colonna B is strictly N° DOC
        if (c.includes('DATA')) {
          colDate = idx;
        } else if (c.includes('PROT')) {
          colProt = idx;
        } else if (
          c.includes('TIPO') ||
          c.includes('FORNITORE') ||
          c.includes('CLIENTE') ||
          c.includes('DESCRIZIONE') ||
          c.includes('OGGETTO')
        ) {
          colTypeSubject = idx;
        } else if (c.includes('ACQUISTI') || c.includes('COSTI') || c.includes('USCITE')) {
          colAcquisti = idx;
        } else if (c.includes('EMESSE') || c.includes('RICAVI') || c.includes('ENTRATE')) {
          colEmesse = idx;
        }
      });
      break;
    }
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 5;
  const movements: ParsedSingolaSchedaData['movements'] = [];
  let ignoredRowsCount = 0;
  let totalPurchases = 0;
  let totalIssued = 0;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const fullRowText = row.map((c) => String(c || '').trim()).join(' ');

    if (!fullRowText || fullRowText.replace(/[0.,\s]/g, '').length === 0) {
      continue; // empty row
    }

    if (isSummaryOrTotalRow(fullRowText)) {
      ignoredRowsCount++;
      continue;
    }

    // N° DOC preso direttamente dalla Colonna B (indice 1) del foglio XLS
    const rawDocVal = row[1];
    let docNumber = '';
    if (rawDocVal !== undefined && rawDocVal !== null) {
      if (typeof rawDocVal === 'number') {
        docNumber = String(rawDocVal);
      } else {
        docNumber = String(rawDocVal).trim();
      }
    }

    const colSubjectVal = String(row[colTypeSubject] || '').trim();
    const isRI = colSubjectVal.toUpperCase().includes('RIMANENZE INIZIALI') ||
                 colSubjectVal.toUpperCase().includes('R.I.') ||
                 fullRowText.toUpperCase().includes('RIMANENZE INIZIALI');

    const rawPurchases = parseExcelNumber(row[colAcquisti]);
    const rawIssued = parseExcelNumber(row[colEmesse]);

    if (isRI) {
      initialInventory = rawPurchases || initialInventory;
      // Record special RI movement
      movements.push({
        id: `imp-ri-${r}-${Date.now()}`,
        date: parseExcelDate(row[colDate]),
        docNumber: docNumber || 'R.I.',
        typeAndSubject: 'RIMANENZE INIZIALI (R.I.)',
        protocol: String(row[colProt] || '').trim(),
        purchases: rawPurchases,
        issued: rawIssued,
        isSpecialRI: true,
      });
      continue;
    }

    const date = parseExcelDate(row[colDate]);
    const typeAndSubject = colSubjectVal;
    const protocol = String(row[colProt] || '').trim();

    // If completely without values and descriptions, ignore
    if (!docNumber && !colSubjectVal && rawPurchases === 0 && rawIssued === 0) {
      ignoredRowsCount++;
      continue;
    }

    movements.push({
      id: `imp-mov-${r}-${Date.now()}`,
      date,
      docNumber,
      typeAndSubject,
      protocol,
      purchases: rawPurchases,
      issued: rawIssued,
      isSpecialRI: false,
    });

    totalPurchases += rawPurchases;
    totalIssued += rawIssued;
  }

  return {
    header: {
      cantiereName,
      dittaName,
      city,
      address,
      committente,
      year,
      initialInventory,
    },
    movements,
    ignoredRowsCount,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
    totalIssued: Math.round(totalIssued * 100) / 100,
  };
}

/**
 * 2. Parser for Scheda Sospesi
 * Columns: DATA, N. FATTURA, FORNITORE, NS. PROT., IMPORTO, DESCRIZIONE
 */
export function parseSospesiExcel(
  sheet: XLSX.WorkSheet
): ParsedSospesiData {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerRowIndex = -1;
  let colDate = 0;
  let colDocNum = 1;
  let colSupplier = 2;
  let colProt = 3;
  let colAmount = 4;
  let colDesc = 5;
  let colClient = -1;

  for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
    const row = rawRows[r] || [];
    const upperRow = row.map((cell) => String(cell || '').toUpperCase().trim());

    const hasFattura = upperRow.some((c) => c.includes('FATTURA') || c.includes('DOC'));
    const hasFornitore = upperRow.some((c) => c.includes('FORNITORE'));
    const hasImporto = upperRow.some((c) => c.includes('IMPORTO') || c.includes('TOTALE'));

    if (hasFattura || hasFornitore || hasImporto) {
      headerRowIndex = r;
      upperRow.forEach((c, idx) => {
        if (c.includes('DATA')) colDate = idx;
        else if (c.includes('FATTURA') || c.includes('N°') || c.includes('N.')) colDocNum = idx;
        else if (c.includes('FORNITORE')) colSupplier = idx;
        else if (c.includes('PROT')) colProt = idx;
        else if (c.includes('IMPORTO') || c.includes('TOTALE') || c.includes('VALORE')) colAmount = idx;
        else if (c.includes('DESCRIZIONE') || c.includes('OGGETTO') || c.includes('NOTE')) colDesc = idx;
        else if (c.includes('CLIENTE') || c.includes('DEST')) colClient = idx;
      });
      break;
    }
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;
  const items: ParsedSospesiData['items'] = [];
  let ignoredRowsCount = 0;
  let totalAmount = 0;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const fullRowText = row.map((c) => String(c || '').trim()).join(' ');

    if (!fullRowText || fullRowText.replace(/[0.,\s]/g, '').length === 0) {
      continue;
    }

    if (isSummaryOrTotalRow(fullRowText)) {
      ignoredRowsCount++;
      continue;
    }

    const supplier = String(row[colSupplier] || '').trim().toUpperCase();
    const docNumber = String(row[colDocNum] || '').trim();
    const amount = parseExcelNumber(row[colAmount]);
    const description = String(row[colDesc] || '').trim();
    const protocol = colProt !== -1 ? String(row[colProt] || '').trim() : '';
    const client = colClient !== -1 ? String(row[colClient] || '').trim() : undefined;
    const date = parseExcelDate(row[colDate]);

    // Validation: must have supplier or docNumber or valid amount
    if (!supplier && !docNumber && amount === 0) {
      ignoredRowsCount++;
      continue;
    }

    items.push({
      id: `imp-sosp-${r}-${Date.now()}`,
      date,
      docNumber: docNumber || 'S.N.',
      supplier: supplier || 'FORNITORE DIVERSI',
      protocol,
      amount,
      description: description || 'Materiale da attribuire al cantiere (da Excel)',
      client,
    });

    totalAmount += amount;
  }

  return {
    items,
    ignoredRowsCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * 3. Parser for Prospetto Generale Cantieri
 * Columns: NOME CLIENTE, CITTA', INDIRIZZO, R.I., ACQUISTI, EMESSE, R.F.
 */
export function parseProspettoGeneraleExcel(
  sheet: XLSX.WorkSheet
): ParsedProspettoGeneraleData {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerRowIndex = -1;
  let colName = 0;
  let colCity = 1;
  let colAddress = 2;
  let colRI = 3;
  let colAcquisti = 4;
  let colEmesse = 5;
  let colRF = 6;

  for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
    const row = rawRows[r] || [];
    const upperRow = row.map((cell) => String(cell || '').toUpperCase().trim());

    const hasCliente = upperRow.some((c) => c.includes('CLIENTE') || c.includes('CANTIERE') || c.includes('NOME'));
    const hasCitta = upperRow.some((c) => c.includes('CITTA'));
    const hasRI = upperRow.some((c) => c.includes('R.I.') || c.includes('RI') || c.includes('INIZIAL'));

    if (hasCliente || (hasCitta && hasRI)) {
      headerRowIndex = r;
      upperRow.forEach((c, idx) => {
        if (c.includes('CLIENTE') || c.includes('COMMITTENTE') || c.includes('NOME')) colName = idx;
        else if (c.includes('CITTA')) colCity = idx;
        else if (c.includes('INDIRIZZO') || c.includes('VIA')) colAddress = idx;
        else if (c.includes('R.I.') || (c.includes('RI') && !c.includes('RICAVI')) || c.includes('INIZIAL')) colRI = idx;
        else if (c.includes('ACQUISTI') || c.includes('COSTI')) colAcquisti = idx;
        else if (c.includes('EMESSE') || c.includes('RICAVI') || c.includes('VENDITE')) colEmesse = idx;
        else if (c.includes('R.F.') || c.includes('RF') || c.includes('FINAL')) colRF = idx;
      });
      break;
    }
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 2;
  const cantieri: ParsedProspettoGeneraleData['cantieri'] = [];
  let ignoredRowsCount = 0;
  let totalRI = 0;
  let totalAcquisti = 0;
  let totalEmesse = 0;
  let totalRF = 0;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const fullRowText = row.map((c) => String(c || '').trim()).join(' ');

    if (!fullRowText || fullRowText.replace(/[0.,\s]/g, '').length === 0) {
      continue;
    }

    if (isSummaryOrTotalRow(fullRowText)) {
      ignoredRowsCount++;
      continue;
    }

    // Ignore SOSPESI row in the general prospectus (it is managed in Scheda Sospesi)
    if (fullRowText.toUpperCase().includes('SOSPESI') || fullRowText.toUpperCase().includes('SOSPESO')) {
      ignoredRowsCount++;
      continue;
    }

    const name = String(row[colName] || '').trim();
    const city = String(row[colCity] || '').trim();
    const address = colAddress !== -1 ? String(row[colAddress] || '').trim() : '';
    const initialInventory = parseExcelNumber(row[colRI]);
    const purchases = parseExcelNumber(row[colAcquisti]);
    const issued = parseExcelNumber(row[colEmesse]);
    const finalInventory = parseExcelNumber(row[colRF]);

    // Validation: skip if name is empty and all numbers are 0
    if (!name && initialInventory === 0 && purchases === 0 && issued === 0 && finalInventory === 0) {
      ignoredRowsCount++;
      continue;
    }

    cantieri.push({
      id: `imp-cantiere-${r}-${Date.now()}`,
      name: name || `Cantiere ${city || address || r}`,
      city: city || 'Milano',
      address,
      client: name || 'Cliente generico',
      initialInventory,
      purchases,
      issued,
      finalInventory,
    });

    totalRI += initialInventory;
    totalAcquisti += purchases;
    totalEmesse += issued;
    totalRF += finalInventory;
  }

  return {
    cantieri,
    ignoredRowsCount,
    totalRI: Math.round(totalRI * 100) / 100,
    totalAcquisti: Math.round(totalAcquisti * 100) / 100,
    totalEmesse: Math.round(totalEmesse * 100) / 100,
    totalRF: Math.round(totalRF * 100) / 100,
  };
}

/**
 * Universal Excel File Parser:
 * Reads .xls and .xlsx array buffer, detects type, parses according to mode.
 */
export function parseUploadedExcel(
  fileData: ArrayBuffer,
  fileName: string = '',
  forcedType?: ExcelImportType,
  sheetName?: string
): ExcelParseResult {
  const workbook = XLSX.read(fileData, {
    type: 'array',
    cellDates: true,
  });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('Il file Excel non contiene fogli di lavoro validi.');
  }

  // Choose sheet: if user specified sheetName use it, else pick the first non-empty sheet
  let chosenSheetName = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const sheet = workbook.Sheets[chosenSheetName];
  if (!sheet) {
    throw new Error(`Impossibile leggere il foglio "${chosenSheetName}" nel file Excel.`);
  }

  const detectedType = forcedType || detectExcelSheetType(sheet, chosenSheetName);
  const warnings: string[] = [];

  let singolaScheda: ParsedSingolaSchedaData | undefined;
  let sospesi: ParsedSospesiData | undefined;
  let prospettoGenerale: ParsedProspettoGeneraleData | undefined;

  switch (detectedType) {
    case 'singola_scheda':
      singolaScheda = parseSingolaSchedaExcel(sheet, fileName);
      if (singolaScheda.movements.length === 0) {
        warnings.push('Nessun movimento contabile identificato con le colonne DATA, DOC, ACQUISTI, EMESSE.');
      }
      break;

    case 'scheda_sospesi':
      sospesi = parseSospesiExcel(sheet);
      if (sospesi.items.length === 0) {
        warnings.push('Nessuna riga di sospeso identificata con le colonne FORNITORE, IMPORTO, N. FATTURA.');
      }
      break;

    case 'prospetto_generale':
      prospettoGenerale = parseProspettoGeneraleExcel(sheet);
      if (prospettoGenerale.cantieri.length === 0) {
        warnings.push('Nessun cantiere individuato nella tabella del Prospetto Generale.');
      }
      break;
  }

  return {
    detectedType,
    sheetNames,
    selectedSheet: chosenSheetName,
    singolaScheda,
    sospesi,
    prospettoGenerale,
    warnings,
  };
}
