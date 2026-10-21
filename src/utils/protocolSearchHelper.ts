import { Cantiere, Movement, SospesoItem, AttachmentPdf } from '../types';

export interface ProtocolSearchResultItem {
  id: string;
  sourceType: 'cantiere' | 'sospeso';
  cantiereId?: string;
  cantiereName: string;
  cantiereCity?: string;
  cantiereAddress?: string;
  date: string;
  docNumber: string;
  typeAndSubject: string;
  protocol: string;
  purchases: number;
  issued: number;
  notes?: string;
  attachmentPdf?: AttachmentPdf;
  movementId?: string;
  sospesoId?: string;
  source?: 'manuale' | 'xml' | 'fattura_emessa';
}

export interface ProtocolGroupResult {
  protocol: string;
  items: ProtocolSearchResultItem[];
  totalPurchases: number;
  totalCantieriPurchases: number;
  totalSospesiPurchases: number;
  totalIssued: number;
  cantieriNames: string[];
  docNumbers: string[];
  suppliers: string[];
  hasPdf: boolean;
}

/**
 * Normalizes a protocol string for flexible matching
 * (removes common prefixes like "PROT.", "PROT-", "N.", "#", and leading/trailing whitespace).
 */
export function normalizeProtocol(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(prot\.?|protocollo|n\.?|n°|#)\s*/i, '')
    .trim();
}

/**
 * Checks if a movement or item protocol matches the search query.
 * Supports exact match, prefix match, and substring match.
 */
export function matchesProtocol(itemProtocol: string, query: string): boolean {
  if (!itemProtocol || !query) return false;

  const rawItem = itemProtocol.trim().toLowerCase();
  const rawQ = query.trim().toLowerCase();

  // Direct case-insensitive match or inclusion
  if (rawItem === rawQ || rawItem.includes(rawQ)) return true;

  const normItem = normalizeProtocol(itemProtocol);
  const normQ = normalizeProtocol(query);

  if (!normItem || !normQ) return false;

  // Normalized exact or substring match
  if (normItem === normQ || normItem.includes(normQ)) return true;

  // Handle numbers with or without leading zeros (e.g., "0014" vs "14")
  const numItem = parseInt(normItem, 10);
  const numQ = parseInt(normQ, 10);
  if (!isNaN(numItem) && !isNaN(numQ) && numItem === numQ) {
    return true;
  }

  return false;
}

/**
 * Searches for all movements in cantieri and sospesi items matching a protocol query.
 */
export function searchByProtocol(
  query: string,
  cantieri: Cantiere[],
  sospesi: SospesoItem[] = []
): ProtocolSearchResultItem[] {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const results: ProtocolSearchResultItem[] = [];

  // 1. Search across all cantieri movements
  cantieri.forEach((cantiere) => {
    (cantiere.movements || []).forEach((mov) => {
      if (mov.protocol && matchesProtocol(mov.protocol, cleanQ)) {
        results.push({
          id: `mov-${cantiere.id}-${mov.id}`,
          sourceType: 'cantiere',
          cantiereId: cantiere.id,
          cantiereName: cantiere.name,
          cantiereCity: cantiere.city,
          cantiereAddress: cantiere.address,
          date: mov.date,
          docNumber: mov.docNumber || '-',
          typeAndSubject: mov.typeAndSubject || '-',
          protocol: mov.protocol,
          purchases: mov.purchases || 0,
          issued: mov.issued || 0,
          notes: mov.notes,
          attachmentPdf: mov.attachmentPdf,
          movementId: mov.id,
          source: mov.source,
        });
      }
    });
  });

  // 2. Search across sospesi items
  sospesi.forEach((sosp) => {
    if (sosp.protocol && matchesProtocol(sosp.protocol, cleanQ)) {
      results.push({
        id: `sosp-${sosp.id}`,
        sourceType: 'sospeso',
        cantiereName: 'SCHEDA SOSPESI (DDT da attribuire)',
        date: sosp.date,
        docNumber: sosp.docNumber || '-',
        typeAndSubject: `${sosp.supplier} ${sosp.description || ''}`.trim(),
        protocol: sosp.protocol,
        purchases: sosp.amount || 0,
        issued: 0,
        notes: [sosp.customerNote, sosp.internalNote].filter(Boolean).join(' | '),
        attachmentPdf: sosp.attachmentPdf,
        sospesoId: sosp.id,
      });
    }
  });

  // Sort results by date descending, then cantiere name
  results.sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return a.cantiereName.localeCompare(b.cantiereName);
  });

  return results;
}

/**
 * Groups search results by protocol number with sub-totals and summary stats.
 */
export function groupResultsByProtocol(items: ProtocolSearchResultItem[]): ProtocolGroupResult[] {
  const map = new Map<string, ProtocolSearchResultItem[]>();

  items.forEach((item) => {
    const key = item.protocol.trim();
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  });

  const groups: ProtocolGroupResult[] = [];

  map.forEach((groupItems, protocol) => {
    let totalPurchases = 0;
    let totalCantieriPurchases = 0;
    let totalSospesiPurchases = 0;
    let totalIssued = 0;
    let hasPdf = false;

    const cantieriSet = new Set<string>();
    const docNumbersSet = new Set<string>();
    const suppliersSet = new Set<string>();

    groupItems.forEach((item) => {
      totalPurchases += item.purchases;
      if (item.sourceType === 'cantiere') {
        totalCantieriPurchases += item.purchases;
        cantieriSet.add(item.cantiereName);
      } else {
        totalSospesiPurchases += item.purchases;
        cantieriSet.add('Scheda Sospesi');
      }
      totalIssued += item.issued;
      if (item.attachmentPdf) hasPdf = true;
      if (item.docNumber && item.docNumber !== '-') docNumbersSet.add(item.docNumber);
      if (item.typeAndSubject && item.typeAndSubject !== '-') suppliersSet.add(item.typeAndSubject);
    });

    groups.push({
      protocol,
      items: groupItems,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalCantieriPurchases: Math.round(totalCantieriPurchases * 100) / 100,
      totalSospesiPurchases: Math.round(totalSospesiPurchases * 100) / 100,
      totalIssued: Math.round(totalIssued * 100) / 100,
      cantieriNames: Array.from(cantieriSet),
      docNumbers: Array.from(docNumbersSet),
      suppliers: Array.from(suppliersSet),
      hasPdf,
    });
  });

  // Sort groups by total purchases descending
  groups.sort((a, b) => b.totalPurchases - a.totalPurchases);

  return groups;
}

/**
 * Retrieves all distinct protocols available across all cantieri and sospesi,
 * with usage frequency, total amounts, and associated document numbers.
 */
export function getAllDistinctProtocols(
  cantieri: Cantiere[],
  sospesi: SospesoItem[] = []
): Array<{
  protocol: string;
  count: number;
  totalPurchases: number;
  sampleDocNumber: string;
  hasPdf: boolean;
}> {
  const protocolMap = new Map<
    string,
    { count: number; totalPurchases: number; sampleDocNumber: string; hasPdf: boolean }
  >();

  cantieri.forEach((c) => {
    (c.movements || []).forEach((m) => {
      const p = (m.protocol || '').trim();
      if (!p || p === '-') return;

      const current = protocolMap.get(p) || {
        count: 0,
        totalPurchases: 0,
        sampleDocNumber: m.docNumber || '',
        hasPdf: false,
      };
      current.count += 1;
      current.totalPurchases += m.purchases || 0;
      if (m.attachmentPdf) current.hasPdf = true;
      if (!current.sampleDocNumber && m.docNumber) current.sampleDocNumber = m.docNumber;
      protocolMap.set(p, current);
    });
  });

  sospesi.forEach((s) => {
    const p = (s.protocol || '').trim();
    if (!p || p === '-') return;

    const current = protocolMap.get(p) || {
      count: 0,
      totalPurchases: 0,
      sampleDocNumber: s.docNumber || '',
      hasPdf: false,
    };
    current.count += 1;
    current.totalPurchases += s.amount || 0;
    if (s.attachmentPdf) current.hasPdf = true;
    if (!current.sampleDocNumber && s.docNumber) current.sampleDocNumber = s.docNumber;
    protocolMap.set(p, current);
  });

  const list = Array.from(protocolMap.entries()).map(([protocol, stats]) => ({
    protocol,
    count: stats.count,
    totalPurchases: Math.round(stats.totalPurchases * 100) / 100,
    sampleDocNumber: stats.sampleDocNumber,
    hasPdf: stats.hasPdf,
  }));

  // Sort alphanumerically or by count
  list.sort((a, b) => {
    // Try numeric comparison first
    const numA = parseInt(normalizeProtocol(a.protocol), 10);
    const numB = parseInt(normalizeProtocol(b.protocol), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numB - numA; // higher number first (most recent)
    }
    return b.count - a.count;
  });

  return list;
}
