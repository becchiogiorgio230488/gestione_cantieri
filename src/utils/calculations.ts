import { Artigiano, Cantiere, Movement, QuadraturaContabile } from '../types';

export interface CantiereTotals {
  totaleAcquisti: number;
  totaleEmesse: number;
  initialInventory: number;
  finalInventory: number;
  margineSenzaRI: number;
  totaleAcquistiConRI: number;
  margineConRI: number;
  margineEffettivo: number; // comprensivo di RI e RF: (Emesse + RF) - (Acquisti + RI)
  marginePercentuale: number;
  isPositive: boolean;
  conteggioMovimenti: number;
}

export interface ArtigianoTotals {
  totaleCantieri: number;
  cantieriAttivi: number;
  totaleAcquisti: number;
  totaleEmesse: number;
  totaleRI: number;
  totaleRF: number;
  totaleUtile: number;
  marginePercentuale: number;
  totaleSospesiCount: number;
  totaleSospesiImporto: number;
  quadraturaResult: QuadraturaResult;
  isQuadraturaBilanciata: boolean;
}

export function calculateArtigianoTotals(artigiano: Artigiano): ArtigianoTotals {
  let totaleAcquisti = 0;
  let totaleEmesse = 0;
  let totaleRI = 0;
  let totaleRF = 0;
  let totaleUtile = 0;
  let cantieriAttivi = 0;

  for (const c of artigiano.cantieri || []) {
    const t = calculateCantiereTotals(c);
    totaleAcquisti += t.totaleAcquisti;
    totaleEmesse += t.totaleEmesse;
    totaleRI += t.initialInventory;
    totaleRF += t.finalInventory;
    totaleUtile += t.margineEffettivo;
    if (c.status === 'attivo') cantieriAttivi++;
  }

  totaleAcquisti = Math.round(totaleAcquisti * 100) / 100;
  totaleEmesse = Math.round(totaleEmesse * 100) / 100;
  totaleRI = Math.round(totaleRI * 100) / 100;
  totaleRF = Math.round(totaleRF * 100) / 100;
  totaleUtile = Math.round(totaleUtile * 100) / 100;

  const ricaviDenom = totaleEmesse + (totaleRF > 0 ? totaleRF : 0);
  const marginePercentuale =
    ricaviDenom > 0 ? Math.round((totaleUtile / ricaviDenom) * 1000) / 10 : 0;

  const totaleSospesiCount = artigiano.sospesi ? artigiano.sospesi.length : 0;
  const totaleSospesiImporto = artigiano.sospesi
    ? artigiano.sospesi.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    : 0;

  const quadraturaResult = computeQuadratura(
    artigiano.cantieri || [],
    artigiano.quadratura || { mastrinoAcquisti: 0, mastrinoVendite: 0 }
  );

  const isQuadraturaBilanciata =
    Math.abs(quadraturaResult.deltaAcquisti - totaleSospesiImporto) < 0.05 &&
    quadraturaResult.isVenditeQuadrate;

  return {
    totaleCantieri: (artigiano.cantieri || []).length,
    cantieriAttivi,
    totaleAcquisti,
    totaleEmesse,
    totaleRI,
    totaleRF,
    totaleUtile,
    marginePercentuale,
    totaleSospesiCount,
    totaleSospesiImporto: Math.round(totaleSospesiImporto * 100) / 100,
    quadraturaResult,
    isQuadraturaBilanciata,
  };
}

export function calculateCantiereTotals(cantiere: Cantiere): CantiereTotals {
  let totaleAcquisti = 0;
  let totaleEmesse = 0;

  for (const mov of cantiere.movements || []) {
    totaleAcquisti += Number(mov.purchases) || 0;
    totaleEmesse += Number(mov.issued) || 0;
  }

  totaleAcquisti = Math.round(totaleAcquisti * 100) / 100;
  totaleEmesse = Math.round(totaleEmesse * 100) / 100;

  const initialInventory = Number(cantiere.initialInventory) || 0;
  const finalInventory = Number(cantiere.finalInventory) || 0;

  const margineSenzaRI = Math.round((totaleEmesse - totaleAcquisti) * 100) / 100;
  const totaleAcquistiConRI = Math.round((totaleAcquisti + initialInventory) * 100) / 100;
  const margineConRI = Math.round((totaleEmesse - totaleAcquistiConRI) * 100) / 100;
  // Margine effettivo = (Emesse + R.F.) - (Acquisti + R.I.)
  const margineEffettivo = Math.round((totaleEmesse + finalInventory - totaleAcquistiConRI) * 100) / 100;

  let marginePercentuale = 0;
  const denominatoreRicavi = totaleEmesse + (finalInventory > 0 ? finalInventory : 0);
  if (denominatoreRicavi > 0) {
    marginePercentuale = Math.round((margineEffettivo / denominatoreRicavi) * 1000) / 10;
  }

  return {
    totaleAcquisti,
    totaleEmesse,
    initialInventory,
    finalInventory,
    margineSenzaRI,
    totaleAcquistiConRI,
    margineConRI,
    margineEffettivo,
    marginePercentuale,
    isPositive: margineEffettivo >= 0,
    conteggioMovimenti: cantiere.movements ? cantiere.movements.length : 0,
  };
}

/**
 * Calcolo R.F. (Rimanenze Finali cantiere):
 * RI + ACQUISTI - EMESSE, valorizzato solo se le emesse sono minori della somma delle rimanenze iniziali e degli acquisti.
 */
export function computeCantiereRF(initialInventory: number, purchases: number, issued: number): number {
  const sumCost = (Number(initialInventory) || 0) + (Number(purchases) || 0);
  const emesse = Number(issued) || 0;
  if (emesse < sumCost) {
    return Math.round((sumCost - emesse) * 100) / 100;
  }
  return 0;
}

/**
 * Formattazione valuta stile contabile del foglio:
 * Quando è 0 o nullo visualizza " - €", altrimenti l'importo formattato.
 */
export function formatAccountingCurrency(amount: number | null | undefined): string {
  const val = Number(amount) || 0;
  if (Math.abs(val) < 0.005) {
    return ' - €';
  }
  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)} €`;
}

export interface QuadraturaResult {
  totaleAcquistiCantieri: number;
  totaleEmesseCantieri: number;
  totaleRICantieri: number;
  totaleRFCantieri: number;
  totaleUtileCantieri: number;
  mastrinoAcquisti: number;
  mastrinoVendite: number;
  deltaAcquisti: number; // Mastrino Acquisti - Totale Acquisti Cantieri
  deltaVendite: number; // Mastrino Vendite - Totale Emesse Cantieri
  isAcquistiQuadrati: boolean;
  isVenditeQuadrate: boolean;
  isComplessivoQuadrato: boolean;
}

export function computeQuadratura(
  cantieri: Cantiere[],
  quadratura: QuadraturaContabile
): QuadraturaResult {
  let totaleAcquisti = 0;
  let totaleEmesse = 0;
  let totaleRI = 0;
  let totaleRF = 0;
  let totaleUtile = 0;

  for (const c of cantieri) {
    const t = calculateCantiereTotals(c);
    totaleAcquisti += t.totaleAcquisti;
    totaleEmesse += t.totaleEmesse;
    totaleRI += t.initialInventory;
    totaleRF += t.finalInventory;
    totaleUtile += t.margineEffettivo;
  }

  totaleAcquisti = Math.round(totaleAcquisti * 100) / 100;
  totaleEmesse = Math.round(totaleEmesse * 100) / 100;
  totaleRI = Math.round(totaleRI * 100) / 100;
  totaleRF = Math.round(totaleRF * 100) / 100;
  totaleUtile = Math.round(totaleUtile * 100) / 100;

  let mastrinoAcquisti = Number(quadratura.mastrinoAcquisti) || 0;
  if (quadratura.mastriniAcquistiDetails && quadratura.mastriniAcquistiDetails.length > 0) {
    mastrinoAcquisti = quadratura.mastriniAcquistiDetails.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
  }
  mastrinoAcquisti = Math.round(mastrinoAcquisti * 100) / 100;

  let mastrinoVendite = Number(quadratura.mastrinoVendite) || 0;
  if (quadratura.mastriniVenditeDetails && quadratura.mastriniVenditeDetails.length > 0) {
    mastrinoVendite = quadratura.mastriniVenditeDetails.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
  }
  mastrinoVendite = Math.round(mastrinoVendite * 100) / 100;

  // Delta: se positivo, ci sono spese in contabilità generale non ancora imputate ai cantieri (es. nei Sospesi o costi generali)
  const deltaAcquisti = Math.round((mastrinoAcquisti - totaleAcquisti) * 100) / 100;
  const deltaVendite = Math.round((mastrinoVendite - totaleEmesse) * 100) / 100;

  const isAcquistiQuadrati = Math.abs(deltaAcquisti) < 0.05;
  const isVenditeQuadrate = Math.abs(deltaVendite) < 0.05;
  const isComplessivoQuadrato = isAcquistiQuadrati && isVenditeQuadrate;

  return {
    totaleAcquistiCantieri: totaleAcquisti,
    totaleEmesseCantieri: totaleEmesse,
    totaleRICantieri: totaleRI,
    totaleRFCantieri: totaleRF,
    totaleUtileCantieri: totaleUtile,
    mastrinoAcquisti,
    mastrinoVendite,
    deltaAcquisti,
    deltaVendite,
    isAcquistiQuadrati,
    isVenditeQuadrate,
    isComplessivoQuadrato,
  };
}

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '€ 0,00';
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateItalian(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD to DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('it-IT');
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
