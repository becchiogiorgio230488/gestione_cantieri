import { Cantiere, Movement, SospesoItem } from '../types';
import { formatDateItalian } from './calculations';

export interface InvoiceLocation {
  type: 'cantiere' | 'sospesi';
  cantiereId?: string;
  cantiereName: string;
  client?: string;
  docNumber: string;
  date: string;
  amount: number;
  description: string;
  movementId?: string;
}

/**
 * Normalizes an invoice number for comparison by removing common prefixes
 * like 'FT-', 'FATT.', 'N.', whitespace and leading zeros if numeric.
 */
export function cleanInvoiceNum(num?: string | null): string {
  if (!num) return '';
  let cleaned = num.trim().toLowerCase();
  // Strip common Italian invoice prefixes
  cleaned = cleaned.replace(/^(fattura|fatt\.|fatt|ft\-|ft\s+|doc\-|doc\s+|n\.\s*|n°\s*)/i, '');
  cleaned = cleaned.trim();
  // If it's a split DDT format like "123 / DDT 45", take the part before " / "
  if (cleaned.includes(' / ')) {
    cleaned = cleaned.split(' / ')[0].trim();
    cleaned = cleaned.replace(/^(fattura|fatt\.|fatt|ft\-|ft\s+|doc\-|doc\s+|n\.\s*|n°\s*)/i, '').trim();
  }
  return cleaned;
}

/**
 * Normalizes a company / supplier name for comparison
 */
export function normalizeEntityName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|societa|ditta)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

/**
 * Checks if two supplier strings refer to the same entity
 */
export function isSameSupplier(suppA?: string | null, suppB?: string | null): boolean {
  const normA = normalizeEntityName(suppA);
  const normB = normalizeEntityName(suppB);
  if (!normA || !normB) return true; // If one is unknown, don't rule out match if invoice number matches
  return normA.includes(normB) || normB.includes(normA) || normA === normB;
}

/**
 * Extracts the invoice number from a Movement object
 */
export function extractInvoiceNumberFromMovement(mov: Movement): string {
  if (mov.xmlRef?.invoiceNum) {
    return cleanInvoiceNum(mov.xmlRef.invoiceNum);
  }
  // Try extracting from docNumber
  const fromDoc = cleanInvoiceNum(mov.docNumber);
  if (fromDoc) return fromDoc;

  // Try extracting from protocol if it starts with FORN-XML-
  if (mov.protocol && mov.protocol.startsWith('FORN-XML-')) {
    return cleanInvoiceNum(mov.protocol.replace('FORN-XML-', ''));
  }

  // Try extracting from notes
  if (mov.notes) {
    const match = mov.notes.match(/fattura\s+([a-z0-9\-\_\/]+)/i);
    if (match && match[1]) {
      return cleanInvoiceNum(match[1]);
    }
  }

  return '';
}

/**
 * Extracts supplier name from Movement
 */
export function extractSupplierFromMovement(mov: Movement): string {
  if (mov.xmlRef?.supplier) {
    return mov.xmlRef.supplier;
  }
  if (!mov.typeAndSubject) return '';
  // Usually formatted as "SUPPLIER NAME (DDT 1, DDT 2)" or "SUPPLIER - Description"
  let clean = mov.typeAndSubject;
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  } else if (clean.includes(' - ')) {
    clean = clean.split(' - ')[0].trim();
  }
  return clean.toUpperCase();
}

/**
 * Checks if a purchase invoice already exists in any Cantiere or Sospesi
 */
export function findExistingPurchaseInvoiceLocations(
  invoiceNum: string,
  supplierName: string,
  cantieri: Cantiere[],
  sospesi: SospesoItem[] = [],
  fileName?: string
): InvoiceLocation[] {
  const targetInv = cleanInvoiceNum(invoiceNum);
  if (!targetInv) return [];

  const locations: InvoiceLocation[] = [];

  // 1. Search in cantieri movements
  for (const c of cantieri) {
    for (const mov of c.movements || []) {
      // Must be a purchase / cost movement or XML source
      if (mov.purchases <= 0 && mov.source !== 'xml') continue;

      const movInv = extractInvoiceNumberFromMovement(mov);
      const movSupp = extractSupplierFromMovement(mov);

      const invMatch = movInv && (movInv === targetInv || movInv.endsWith('/' + targetInv) || targetInv.endsWith('/' + movInv));
      const fileMatch = fileName && mov.notes && mov.notes.includes(fileName);

      if ((invMatch && isSameSupplier(supplierName, movSupp)) || fileMatch) {
        locations.push({
          type: 'cantiere',
          cantiereId: c.id,
          cantiereName: c.name,
          client: c.client,
          docNumber: mov.docNumber,
          date: mov.date,
          amount: mov.purchases,
          description: mov.typeAndSubject,
          movementId: mov.id,
        });
      }
    }
  }

  // 2. Search in Scheda Sospesi
  for (const s of sospesi || []) {
    const sInv = cleanInvoiceNum(s.docNumber);
    const invMatch = sInv && (sInv === targetInv || sInv.endsWith('/' + targetInv) || targetInv.endsWith('/' + sInv));
    const fileMatch = fileName && s.sourceFileName && s.sourceFileName === fileName;

    if ((invMatch && isSameSupplier(supplierName, s.supplier)) || fileMatch) {
      locations.push({
        type: 'sospesi',
        cantiereName: 'Scheda Sospesi',
        docNumber: s.docNumber,
        date: s.date,
        amount: s.amount,
        description: `${s.supplier} - ${s.description}`,
      });
    }
  }

  return locations;
}

/**
 * Checks if an issued invoice already exists in any Cantiere
 */
export function findExistingIssuedInvoiceLocations(
  docNumber: string,
  cantieri: Cantiere[]
): InvoiceLocation[] {
  const targetDoc = cleanInvoiceNum(docNumber);
  if (!targetDoc) return [];

  const locations: InvoiceLocation[] = [];

  for (const c of cantieri) {
    for (const mov of c.movements || []) {
      if (mov.issued === 0 && mov.source !== 'fattura_emessa') continue;

      const movDoc = cleanInvoiceNum(mov.docNumber);
      const movProt = cleanInvoiceNum(mov.protocol);

      if (movDoc === targetDoc || movProt === targetDoc) {
        locations.push({
          type: 'cantiere',
          cantiereId: c.id,
          cantiereName: c.name,
          client: c.client,
          docNumber: mov.docNumber,
          date: mov.date,
          amount: mov.issued,
          description: mov.typeAndSubject,
          movementId: mov.id,
        });
      }
    }
  }

  return locations;
}

/**
 * When deleting a movement from a cantiere:
 * Checks if the SAME invoice has other rows in OTHER cantieri or in Scheda Sospesi.
 */
export function findLinkedInvoiceMovementsAcrossCantieri(
  targetMov: Movement,
  currentCantiereId: string,
  allCantieri: Cantiere[],
  sospesi: SospesoItem[] = []
): {
  isLinkedToMultiple: boolean;
  invoiceNum: string;
  supplierOrClient: string;
  otherCantieriMatches: Array<{
    cantiereId: string;
    cantiereName: string;
    client: string;
    movement: Movement;
  }>;
  sospesiMatches: SospesoItem[];
} {
  const invoiceNum = extractInvoiceNumberFromMovement(targetMov);
  const supplierOrClient = extractSupplierFromMovement(targetMov);
  const isIssued = targetMov.issued !== 0 || targetMov.source === 'fattura_emessa' || targetMov.typeAndSubject.includes('EMESS');

  if (!invoiceNum) {
    return {
      isLinkedToMultiple: false,
      invoiceNum: '',
      supplierOrClient,
      otherCantieriMatches: [],
      sospesiMatches: [],
    };
  }

  const otherCantieriMatches: Array<{
    cantiereId: string;
    cantiereName: string;
    client: string;
    movement: Movement;
  }> = [];

  // Check all OTHER cantieri
  for (const c of allCantieri) {
    if (c.id === currentCantiereId) continue;

    for (const mov of c.movements || []) {
      if (isIssued) {
        if (mov.issued === 0 && mov.source !== 'fattura_emessa') continue;
        const movDoc = cleanInvoiceNum(mov.docNumber);
        if (movDoc === invoiceNum) {
          otherCantieriMatches.push({
            cantiereId: c.id,
            cantiereName: c.name,
            client: c.client,
            movement: mov,
          });
        }
      } else {
        if (mov.purchases <= 0 && mov.source !== 'xml') continue;
        const movInv = extractInvoiceNumberFromMovement(mov);
        const movSupp = extractSupplierFromMovement(mov);

        if (movInv === invoiceNum && isSameSupplier(supplierOrClient, movSupp)) {
          otherCantieriMatches.push({
            cantiereId: c.id,
            cantiereName: c.name,
            client: c.client,
            movement: mov,
          });
        }
      }
    }
  }

  // Check Scheda Sospesi (for purchase invoices)
  const sospesiMatches: SospesoItem[] = [];
  if (!isIssued && sospesi && sospesi.length > 0) {
    for (const s of sospesi) {
      const sInv = cleanInvoiceNum(s.docNumber);
      if (sInv === invoiceNum && isSameSupplier(supplierOrClient, s.supplier)) {
        sospesiMatches.push(s);
      }
    }
  }

  const isLinkedToMultiple = otherCantieriMatches.length > 0 || sospesiMatches.length > 0;

  return {
    isLinkedToMultiple,
    invoiceNum,
    supplierOrClient,
    otherCantieriMatches,
    sospesiMatches,
  };
}

/**
 * Formats a DDT label strictly as:
 * "DDT N. <numero> DEL <data in DD/MM/YYYY>" or "DDT N. <numero>" if no date.
 */
export function formatSingleDdtTag(ddtNum?: string, ddtDate?: string): string {
  if (!ddtNum || !ddtNum.trim()) return '';
  let cleanNum = ddtNum.trim();
  // Strip any existing DDT prefixes like "DDT ", "DDT N. ", "DDT-", "DDT:"
  cleanNum = cleanNum.replace(/^DDT\s*(N\.?|NUM\.?|NUMERO)?\s*[-:]?\s*/i, '').trim();

  let dateFormatted = '';
  // Check if date is already in the string (e.g. "101 DEL 12/02/2026" or "101 del 2026-02-12")
  const delMatch = cleanNum.match(/^(.*?)\s+DEL\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}\-\d{1,2}\-\d{1,2})$/i);
  if (delMatch) {
    cleanNum = delMatch[1].trim();
    dateFormatted = formatDateItalian(delMatch[2]);
  } else if (ddtDate) {
    dateFormatted = formatDateItalian(ddtDate);
  }

  // Also remove percentage tags like "(50%)" or other parenthetical notes from the DDT number
  cleanNum = cleanNum.replace(/\s*\([^)]*\)/g, '').trim();

  // If cleanNum starts with ":" or "-", strip it
  cleanNum = cleanNum.replace(/^[-:]\s*/, '').trim();

  if (dateFormatted && dateFormatted !== '-') {
    return `DDT N. ${cleanNum} DEL ${dateFormatted}`;
  }
  return `DDT N. ${cleanNum}`;
}

/**
 * Extracts and standardizes DDT entries from a typeAndSubject string.
 * Example input: "SONEPAR ITALIA (DDT N. 101 DEL 12/02/2026, DDT N. 102 DEL 15/02/2026)"
 * Returns: ["DDT N. 101 DEL 12/02/2026", "DDT N. 102 DEL 15/02/2026"]
 */
export function extractDdtEntriesFromTypeAndSubject(typeAndSubject?: string, defaultDate?: string): string[] {
  if (!typeAndSubject) return [];
  const entries: string[] = [];

  const parenMatch = typeAndSubject.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1];
    // Split by comma
    const rawItems = inside.split(',').map((x) => x.trim()).filter(Boolean);
    for (const raw of rawItems) {
      const formatted = formatSingleDdtTag(raw, defaultDate);
      if (formatted) {
        entries.push(formatted);
      }
    }
  } else {
    // Check if there is "DDT ..." in the text without parens
    const ddtMatch = typeAndSubject.match(/DDT\s*[^,;:)]+/gi);
    if (ddtMatch) {
      for (const d of ddtMatch) {
        const formatted = formatSingleDdtTag(d, defaultDate);
        if (formatted) {
          entries.push(formatted);
        }
      }
    }
  }

  return Array.from(new Set(entries));
}

/**
 * Builds the strict Tipo Doc. / Fornitore string:
 * "<FORNITORE IN MAIUSCOLO> (DDT N. <X> DEL <DATA>, DDT N. <Y> DEL <DATA>)"
 * and NIENT'ALTRO.
 */
export function buildFormattedTypeAndSubject(supplier: string, ddtEntries: string[]): string {
  const cleanSupplier = (supplier || 'FORNITORE NON SPECIFICATO').toUpperCase().trim();
  const validDdtEntries = Array.from(new Set(ddtEntries.filter(Boolean)));
  if (validDdtEntries.length > 0) {
    return `${cleanSupplier} (${validDdtEntries.join(', ')})`;
  }
  return cleanSupplier;
}

/**
 * Merges existing typeAndSubject with new DDT entries, keeping strictly:
 * "<FORNITORE> (DDT N. <X> DEL <DATA>, ...)"
 * and NIENT'ALTRO.
 */
export function mergeTypeAndSubject(
  existingTypeAndSubject: string,
  newDdtEntries: string[],
  fallbackSupplier?: string,
  movementDate?: string
): string {
  let supplier = extractSupplierFromMovement({ typeAndSubject: existingTypeAndSubject } as Movement);
  if (!supplier || supplier === 'FORNITORE NON SPECIFICATO') {
    supplier = (fallbackSupplier || 'FORNITORE NON SPECIFICATO').toUpperCase().trim();
  }

  const existingEntries = extractDdtEntriesFromTypeAndSubject(existingTypeAndSubject, movementDate);
  const combinedSet = new Set<string>();

  for (const e of existingEntries) {
    if (e) combinedSet.add(e);
  }
  for (const n of newDdtEntries) {
    if (n) combinedSet.add(n);
  }

  return buildFormattedTypeAndSubject(supplier, Array.from(combinedSet));
}

