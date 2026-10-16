import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Artigiano, Cantiere, SospesoItem, QuadraturaContabile } from '../types';
import { calculateCantiereTotals, computeCantiereRF, formatDateItalian } from './calculations';

/**
 * Common border definitions for ExcelJS
 */
const thinBlackBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const mediumBlackBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
  right: { style: 'medium', color: { argb: 'FF000000' } },
};

const currencyFormat = '#,##0.00 "€";-#,##0.00 "€";"- €"';

/**
 * Downloads workbook as an .xlsx file in the browser
 */
async function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Creates the exact single cantiere sheet mirroring ESEMPIO 2.png:
 * - Header block:
 *   - CANTIERE: [Indirizzo del cantiere] | DITTA (top right)
 *   - CITTA': [Città]                    | [Nome Impresa / Artigiano] (box right)
 *   - DEL: [Nome del cliente committente (es. FASANO PIERCARLO)]
 *   - ANNO: [2026] in grande al centro
 * - Table headers: DATA DOC., N° DOC., TIPO DOC./ FORNITORE / CLIENTE, N./PROT, ACQUISTI, EMESSE
 * - Row: RIMANENZE INIZIALI
 * - Movement rows with thin borders and currency format
 * - Totals rows at the bottom:
 *   - Totale senza RI with SUM formula
 *   - Totale comprensivo di RI with formula (senza RI + RI)
 *   - Col F with gray fill and net total
 */
export function buildCantiereDetailSheet(
  workbook: ExcelJS.Workbook,
  cantiere: Cantiere,
  dittaName?: string,
  sheetName?: string
): ExcelJS.Worksheet {
  const safeSheetName = (sheetName || cantiere.name || 'Cantiere')
    .replace(/[:\\/?*[\]]/g, '')
    .slice(0, 25);

  const ws = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }]
  });

  // 6 Columns as depicted in ESEMPIO 2.png
  ws.columns = [
    { key: 'colA', width: 14 }, // DATA DOC.
    { key: 'colB', width: 14 }, // N° DOC.
    { key: 'colC', width: 44 }, // TIPO DOC./ FORNITORE / CLIENTE
    { key: 'colD', width: 14 }, // N./PROT
    { key: 'colE', width: 16 }, // ACQUISTI
    { key: 'colF', width: 16 }, // EMESSE
  ];

  // -------------------------------------------------------------
  // HEADER BLOCK (Rows 1 to 4)
  // -------------------------------------------------------------
  const indirizzoCantiere = (cantiere.address || '').toUpperCase();
  const cittaCantiere = (cantiere.city || '').toUpperCase();
  const clienteNome = (cantiere.client || cantiere.name || '').toUpperCase();
  const finalDitta = (dittaName || 'SIRNA MASSIMO').toUpperCase();

  // Row 1: CANTIERE: [Indirizzo] | DITTA
  const row1 = ws.addRow(['CANTIERE:', indirizzoCantiere, '', '', 'DITTA', '']);
  row1.height = 22;
  ws.mergeCells('B1:D1');
  ws.mergeCells('E1:F1');

  // Row 2: CITTA' [Città] | [Nome Ditta]
  const row2 = ws.addRow(['CITTA\'', cittaCantiere, '', '', finalDitta, '']);
  row2.height = 22;
  ws.mergeCells('B2:D2');

  // Row 3: DEL: [Nome Cliente (es. FASANO PIERCARLO)]
  const row3 = ws.addRow(['DEL:', clienteNome, '', '', '', '']);
  row3.height = 22;
  ws.mergeCells('B3:D3');

  // Row 4: ANNO [2026]
  const row4 = ws.addRow(['ANNO', cantiere.year || 2026, '', '', '', '']);
  row4.height = 24;
  ws.mergeCells('B4:D4');

  // Merge the DITTA box in E2:F4
  ws.mergeCells('E2:F4');

  // Style Header rows 1-4:
  for (let r = 1; r <= 4; r++) {
    const cellA = ws.getCell(`A${r}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true };
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.border = thinBlackBorder;

    const cellB = ws.getCell(`B${r}`);
    cellB.font = r === 4
      ? { name: 'Calibri', size: 16, bold: true }
      : { name: 'Calibri', size: 10, bold: true };
    cellB.alignment = r === 4
      ? { vertical: 'middle', horizontal: 'center' }
      : { vertical: 'middle', horizontal: 'left' };
    cellB.border = thinBlackBorder;

    ws.getCell(`C${r}`).border = thinBlackBorder;
    ws.getCell(`D${r}`).border = thinBlackBorder;
  }

  // DITTA label (E1:F1)
  const cellE1 = ws.getCell('E1');
  cellE1.font = { name: 'Calibri', size: 11, bold: true };
  cellE1.alignment = { vertical: 'middle', horizontal: 'center' };
  cellE1.border = mediumBlackBorder;
  ws.getCell('F1').border = mediumBlackBorder;

  // DITTA name box (E2:F4)
  const cellDitta = ws.getCell('E2');
  cellDitta.font = { name: 'Calibri', size: 13, bold: true };
  cellDitta.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let r = 2; r <= 4; r++) {
    ws.getCell(`E${r}`).border = mediumBlackBorder;
    ws.getCell(`F${r}`).border = mediumBlackBorder;
  }

  // -------------------------------------------------------------
  // TABLE HEADERS (Row 5)
  // -------------------------------------------------------------
  const tableHeaderRow = ws.addRow([
    'DATA DOC.',
    'N° DOC.',
    'TIPO DOC./ FORNITORE / CLIENTE',
    'N./PROT',
    'ACQUISTI',
    'EMESSE'
  ]);
  tableHeaderRow.height = 24;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = mediumBlackBorder;
  });

  // -------------------------------------------------------------
  // ROW 6: RIMANENZE INIZIALI
  // -------------------------------------------------------------
  const ri = Number(cantiere.initialInventory) || 0;
  const riRow = ws.addRow([
    '',
    '',
    'RIMANENZE INIZIALI',
    '',
    ri > 0 ? ri : 0,
    ''
  ]);
  riRow.height = 20;
  riRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 3) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNum === 5) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });
  const riRowNum = riRow.number;

  // -------------------------------------------------------------
  // MOVEMENTS ROWS
  // -------------------------------------------------------------
  const startMovRow = 7;
  const movements = cantiere.movements || [];

  for (const mov of movements) {
    const row = ws.addRow([
      formatDateItalian(mov.date),
      mov.docNumber || '',
      mov.typeAndSubject || '',
      mov.protocol || '',
      Number(mov.purchases) || 0,
      Number(mov.issued) || 0,
    ]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if (colNum <= 2 || colNum === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  }

  // Ensure minimum empty rows for realistic worksheet grid like in ESEMPIO 2.png
  const minRows = Math.max(movements.length, 12);
  for (let i = movements.length; i < minRows; i++) {
    const emptyRow = ws.addRow(['', '', '', '', 0, 0]);
    emptyRow.height = 20;
    emptyRow.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if (colNum >= 5) {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  }

  const lastMovRowNum = ws.rowCount;

  // -------------------------------------------------------------
  // TOTALS ROWS (Matching ESEMPIO 2.png)
  // -------------------------------------------------------------
  const doubleTopBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'double', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Row: Totale senza RI
  const totSenzaRIRow = ws.addRow([
    '',
    '',
    '',
    'Totale senza RI',
    { formula: `SUM(E${startMovRow}:E${lastMovRowNum})` },
    0
  ]);
  totSenzaRIRow.height = 24;

  totSenzaRIRow.eachCell((cell, colNum) => {
    cell.border = doubleTopBorder;
    if (colNum === 4) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum === 5) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.numFmt = currencyFormat;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });
  const totSenzaRIRowNum = totSenzaRIRow.number;

  // Row: Totale comprensivo di RI
  const totCompRIRow = ws.addRow([
    '',
    '',
    '',
    'Totale comprensivo di RI',
    { formula: `E${totSenzaRIRowNum}+E${riRowNum}` },
    { formula: `SUM(F${startMovRow}:F${lastMovRowNum})` }
  ]);
  totCompRIRow.height = 24;

  totCompRIRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 4) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum === 5) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.numFmt = currencyFormat;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
    }
  });
  const totCompRIRowNum = totCompRIRow.number;

  // Merge the right-hand column F across both totals rows (as shown in ESEMPIO 2.png)
  ws.mergeCells(`F${totSenzaRIRowNum}:F${totCompRIRowNum}`);
  const netCell = ws.getCell(`F${totSenzaRIRowNum}`);
  netCell.value = { formula: `SUM(F${startMovRow}:F${lastMovRowNum})` };
  netCell.font = { name: 'Calibri', size: 11, bold: true };
  netCell.numFmt = currencyFormat;
  netCell.alignment = { vertical: 'middle', horizontal: 'right' };
  netCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };
  netCell.border = mediumBlackBorder;
  ws.getCell(`F${totCompRIRowNum}`).border = mediumBlackBorder;

  // Medium border for final total cell in E
  ws.getCell(`E${totCompRIRowNum}`).border = mediumBlackBorder;

  return ws;
}

/**
 * Creates the exact worksheet mirroring the user's template (esempio.png)
 */
export function createProspettoSheet(
  workbook: ExcelJS.Workbook,
  artigiano: Artigiano,
  sheetName: string = 'Prospetto Cantieri'
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Column definitions matching esempio.png
  ws.columns = [
    { key: 'colA', width: 34 }, // NOME CLIENTE
    { key: 'colB', width: 22 }, // CITTA'
    { key: 'colC', width: 36 }, // INDIRIZZO / DESCRIZIONE CONTI
    { key: 'colD', width: 16 }, // R.I.
    { key: 'colE', width: 16 }, // ACQUISTI
    { key: 'colF', width: 16 }, // EMESSE
    { key: 'colG', width: 16 }, // R.F.
  ];

  // 1. Header row
  const headerRow = ws.addRow([
    'NOME CANTIERE',
    'CITTA\'',
    'INDIRIZZO',
    'R.I.',
    'ACQUISTI',
    'EMESSE',
    'R.F.'
  ]);
  headerRow.height = 24;
  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.border = thinBlackBorder;
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum <= 3 ? 'left' : 'right'
    };
  });

  const cantieri = artigiano.cantieri || [];
  const startDataRow = 2;

  // 2. Data rows for cantieri
  for (const c of cantieri) {
    const t = calculateCantiereTotals(c);
    const ri = Number(c.initialInventory) || 0;
    const acq = t.totaleAcquisti;
    const eme = t.totaleEmesse;
    const rf = computeCantiereRF(ri, acq, eme);

    const row = ws.addRow([
      (c.name || '').toUpperCase(),
      (c.city || '').toUpperCase(),
      (c.address || '').toUpperCase(),
      ri,
      acq,
      eme,
      rf
    ]);
    row.height = 20;

    row.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      cell.font = { name: 'Calibri', size: 10, bold: colNum === 1 };
      if (colNum <= 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  }

  // Ensure grid lines / empty rows like in esempio.png
  const minRows = Math.max(cantieri.length, 2);
  for (let i = cantieri.length; i < minRows; i++) {
    const emptyRow = ws.addRow(['', '', '', '', '', '', '']);
    emptyRow.height = 20;
    emptyRow.eachCell((cell) => {
      cell.border = thinBlackBorder;
    });
  }

  // 4. Section SOSPESI
  const totSospesi = (artigiano.sospesi || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  // Sospesi Row 1
  const sospRow1 = ws.addRow([
    '',
    'SOSPESI',
    'C/430000 ACQUISTI MERCI',
    0,
    totSospesi,
    0,
    0
  ]);
  sospRow1.height = 20;
  sospRow1.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 2) {
      cell.font = { name: 'Calibri', size: 10, bold: true, underline: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    } else if (colNum === 3) {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 4) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  // Sospesi Row 2
  const sospRow2 = ws.addRow([
    '',
    '',
    'C/441120 LAVORAZIONI DI TERZI',
    0,
    0,
    0,
    0
  ]);
  sospRow2.height = 20;
  sospRow2.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 3) {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 4) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  // Sospesi Row 3
  const sospRow3 = ws.addRow([
    '',
    '',
    'C/450200 LOCAZIONI PASSIVE ALTRI BENI',
    0,
    0,
    0,
    0
  ]);
  sospRow3.height = 20;
  sospRow3.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 3) {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 4) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  const lastSospesiRowNum = sospRow3.number;

  // 5. Row TOTALI
  const totaliRow = ws.addRow([
    '',
    '',
    'TOTALI',
    { formula: `SUM(D${startDataRow}:D${lastSospesiRowNum})` },
    { formula: `SUM(E${startDataRow}:E${lastSospesiRowNum})` },
    { formula: `SUM(F${startDataRow}:F${lastSospesiRowNum})` },
    { formula: `SUM(G${startDataRow}:G${lastSospesiRowNum})` },
  ]);
  totaliRow.height = 22;
  const totaliRowNum = totaliRow.number;

  totaliRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    if (colNum === 3) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 4) {
      cell.numFmt = currencyFormat;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
    }
  });

  // Separator row
  const sepRow = ws.addRow(['', '', '', '', '', '', '']);
  sepRow.height = 12;

  // 6. Section QUADRATURA
  const quadHeaderRow = ws.addRow(['QUADRATURA', '', '', '', '', '', '']);
  quadHeaderRow.height = 22;
  ws.mergeCells(`A${quadHeaderRow.number}:B${quadHeaderRow.number}`);
  const quadCell = ws.getCell(`A${quadHeaderRow.number}`);
  quadCell.font = { name: 'Calibri', size: 10, bold: true };
  quadCell.alignment = { vertical: 'middle', horizontal: 'center' };
  quadCell.border = thinBlackBorder;
  ws.getCell(`B${quadHeaderRow.number}`).border = thinBlackBorder;

  // Mastrini Acquisti
  const mastriAcq = artigiano.quadratura?.mastriniAcquistiDetails && artigiano.quadratura.mastriniAcquistiDetails.length > 0
    ? artigiano.quadratura.mastriniAcquistiDetails
    : [
        { code: 'C/430000', description: 'ACQUISTI MERCI', amount: 0 },
        { code: 'C/441120', description: 'LAVORAZIONI DI TERZI', amount: 0 },
        { code: 'C/450200', description: 'LOCAZIONI PASSIVE ALTRI BENI', amount: 0 },
      ];

  const firstAcqRowNum = quadHeaderRow.number + 1;
  for (const m of mastriAcq) {
    const row = ws.addRow([`${m.code || ''} ${m.description || ''}`.trim(), '', m.amount || 0, '', '', '', '']);
    row.height = 20;
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cellA = ws.getCell(`A${row.number}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true };
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.border = thinBlackBorder;
    ws.getCell(`B${row.number}`).border = thinBlackBorder;

    const cellC = ws.getCell(`C${row.number}`);
    cellC.numFmt = currencyFormat;
    cellC.font = { name: 'Calibri', size: 10 };
    cellC.alignment = { vertical: 'middle', horizontal: 'right' };
    cellC.border = thinBlackBorder;
  }
  const lastAcqRowNum = firstAcqRowNum + mastriAcq.length - 1;

  // Row TOTALE ACQUISTI
  const totAcqRow = ws.addRow(['TOTALE ACQUISTI', '', { formula: `SUM(C${firstAcqRowNum}:C${lastAcqRowNum})` }, '', '', '', '']);
  totAcqRow.height = 22;
  ws.mergeCells(`A${totAcqRow.number}:B${totAcqRow.number}`);
  const cellTotAcq = ws.getCell(`A${totAcqRow.number}`);
  cellTotAcq.font = { name: 'Calibri', size: 10, bold: true };
  cellTotAcq.alignment = { vertical: 'middle', horizontal: 'center' };
  cellTotAcq.border = thinBlackBorder;
  ws.getCell(`B${totAcqRow.number}`).border = thinBlackBorder;

  const cellTotAcqVal = ws.getCell(`C${totAcqRow.number}`);
  cellTotAcqVal.numFmt = currencyFormat;
  cellTotAcqVal.font = { name: 'Calibri', size: 10, bold: true };
  cellTotAcqVal.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotAcqVal.border = thinBlackBorder;
  const totAcqCellRef = `C${totAcqRow.number}`;

  // Blank row
  const blankRow = ws.addRow(['', '', '', '', '', '', '']);
  blankRow.height = 14;

  // Mastrini Vendite
  const mastriVen = artigiano.quadratura?.mastriniVenditeDetails && artigiano.quadratura.mastriniVenditeDetails.length > 0
    ? artigiano.quadratura.mastriniVenditeDetails
    : [
        { code: 'C/310000', description: 'VENDITA MERCI', amount: 0 },
        { code: 'C/310740', description: 'RICAVI PER SERVIZI', amount: 0 },
        { code: 'C/310750', description: 'ALTRI RICAVI', amount: 0 },
      ];

  const firstVenRowNum = blankRow.number + 1;
  for (const m of mastriVen) {
    const row = ws.addRow([`${m.code || ''} ${m.description || ''}`.trim(), '', m.amount || 0, '', '', '', '']);
    row.height = 20;
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cellA = ws.getCell(`A${row.number}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true };
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.border = thinBlackBorder;
    ws.getCell(`B${row.number}`).border = thinBlackBorder;

    const cellC = ws.getCell(`C${row.number}`);
    cellC.numFmt = currencyFormat;
    cellC.font = { name: 'Calibri', size: 10 };
    cellC.alignment = { vertical: 'middle', horizontal: 'right' };
    cellC.border = thinBlackBorder;
  }
  const lastVenRowNum = firstVenRowNum + mastriVen.length - 1;

  // Row TOTALE VENDITE with SBILANCIO ACQUISTI and SBILANCIO RICAVI headers on columns F & G
  const totVenRow = ws.addRow([
    'TOTALE VENDITE',
    '',
    { formula: `SUM(C${firstVenRowNum}:C${lastVenRowNum})` },
    '',
    '',
    'SBILANCIO ACQUISTI',
    'SBILANCIO RICAVI'
  ]);
  totVenRow.height = 22;
  ws.mergeCells(`A${totVenRow.number}:B${totVenRow.number}`);

  const cellTotVen = ws.getCell(`A${totVenRow.number}`);
  cellTotVen.font = { name: 'Calibri', size: 10, bold: true };
  cellTotVen.alignment = { vertical: 'middle', horizontal: 'center' };
  cellTotVen.border = thinBlackBorder;
  ws.getCell(`B${totVenRow.number}`).border = thinBlackBorder;

  const cellTotVenVal = ws.getCell(`C${totVenRow.number}`);
  cellTotVenVal.numFmt = currencyFormat;
  cellTotVenVal.font = { name: 'Calibri', size: 10, bold: true };
  cellTotVenVal.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotVenVal.border = thinBlackBorder;
  const totVenCellRef = `C${totVenRow.number}`;

  // Style Sbilancio headers on F & G (medium border, centered, bold)
  const cellSbilAcqHeader = ws.getCell(`F${totVenRow.number}`);
  cellSbilAcqHeader.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilAcqHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilAcqHeader.border = mediumBlackBorder;

  const cellSbilVenHeader = ws.getCell(`G${totVenRow.number}`);
  cellSbilVenHeader.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilVenHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilVenHeader.border = mediumBlackBorder;

  // Row for Sbilancio Values on columns F & G
  const sbilValuesRow = ws.addRow([
    '',
    '',
    '',
    '',
    '',
    { formula: `${totAcqCellRef}-E${totaliRowNum}` },
    { formula: `${totVenCellRef}-F${totaliRowNum}` }
  ]);
  sbilValuesRow.height = 24;

  const cellSbilAcqVal = ws.getCell(`F${sbilValuesRow.number}`);
  cellSbilAcqVal.numFmt = currencyFormat;
  cellSbilAcqVal.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilAcqVal.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilAcqVal.border = mediumBlackBorder;

  const cellSbilVenVal = ws.getCell(`G${sbilValuesRow.number}`);
  cellSbilVenVal.numFmt = currencyFormat;
  cellSbilVenVal.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilVenVal.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilVenVal.border = mediumBlackBorder;

  return ws;
}

/**
 * Export single cantiere to Excel
 * Produces the exact sheet requested in ESEMPIO 2.png
 */
export async function exportSingleCantiereExcel(
  cantiere: Cantiere,
  dittaName?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  // Create single cantiere sheet exactly as in ESEMPIO 2.png
  buildCantiereDetailSheet(workbook, cantiere, dittaName, cantiere.name || 'Scheda Cantiere');

  const safeClient = (cantiere.client || cantiere.name || 'CANTIERE')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 30);
  const fileName = `Z_CANTIERE_${safeClient}_${cantiere.year || 2026}.xlsx`;
  await saveWorkbook(workbook, fileName);
}

/**
 * Export Prospetto Generale for an artisan or cantieri list
 * Generates the Prospetto sheet from esempio.png plus all individual cantiere sheets from ESEMPIO 2.png
 */
export async function exportProspettoGeneraleExcel(
  target: Artigiano | Cantiere[],
  quadratura?: QuadraturaContabile,
  sospesi?: SospesoItem[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  let artigiano: Artigiano;
  if (Array.isArray(target)) {
    artigiano = {
      id: 'art-export',
      name: 'Riepilogo Generale',
      year: 2026,
      category: 'misto',
      cantieri: target,
      quadratura: quadratura || { mastrinoAcquisti: 0, mastrinoVendite: 0 },
      sospesi: sospesi || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    artigiano = target;
  }

  // Foglio 1: Z-PROSPETTO CANTIERI esattamente come in esempio.png
  createProspettoSheet(workbook, artigiano, 'Z-PROSPETTO CANTIERI');

  // Fogli di dettaglio per ciascun cantiere esattamente come in ESEMPIO 2.png
  const usedNames = new Set<string>(['Z-PROSPETTO CANTIERI']);
  (artigiano.cantieri || []).forEach((c, idx) => {
    let name = (c.name || `Cantiere ${idx + 1}`).replace(/[:\\/?*[\]]/g, '').slice(0, 25);
    if (usedNames.has(name)) {
      name = `${name.slice(0, 20)}_${idx + 1}`;
    }
    usedNames.add(name);
    buildCantiereDetailSheet(workbook, c, artigiano.name, name);
  });

  const fileName = `Z-PROSPETTO_GENERALE_CANTIERI_${artigiano.name.replace(/[^a-zA-Z0-9]/g, '_')}_${artigiano.year || 2026}.xlsx`;
  await saveWorkbook(workbook, fileName);
}

/**
 * Export Sospesi sheet to Excel
 */
export async function exportSospesiExcel(sospesi: SospesoItem[], artigianoName?: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Scheda Sospesi', {
    views: [{ showGridLines: true }]
  });

  ws.columns = [
    { key: 'colA', width: 14 },
    { key: 'colB', width: 22 },
    { key: 'colC', width: 34 },
    { key: 'colD', width: 44 },
    { key: 'colE', width: 18 },
    { key: 'colF', width: 34 },
  ];

  const header = ws.addRow(['DATA', 'N° DOC / DDT', 'FORNITORE', 'DESCRIZIONE MERCI / MATERIALI', 'IMPORTO (€)', 'NOTE / CANTIERE']);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.border = thinBlackBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  });

  sospesi.forEach((s) => {
    const row = ws.addRow([
      formatDateItalian(s.date),
      s.docNumber,
      s.supplier,
      s.description,
      Number(s.amount) || 0,
      s.customerNote || '',
    ]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if (colNum === 5) {
        cell.numFmt = currencyFormat;
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  const totSospesi = sospesi.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const totRow = ws.addRow(['', '', '', 'TOTALE MATERIALI SOSPESI:', totSospesi, '']);
  totRow.height = 22;
  totRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    if (colNum === 5) {
      cell.numFmt = currencyFormat;
      cell.alignment = { horizontal: 'right' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }
  });

  const fileName = `Z_SCHEDA_SOSPESI_${artigianoName ? `${artigianoName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(workbook, fileName);
}

/**
 * Export all artisans workbook
 */
export async function exportAllArtigianiExcel(artigiani: Artigiano[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  for (const art of artigiani) {
    const safeSheetName = art.name.replace(/[:\\/?*[\]]/g, '').slice(0, 25);
    createProspettoSheet(workbook, art, safeSheetName);
  }

  const fileName = `Z_CANTIERI_STUDIO_TUTTI_I_CLIENTI_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(workbook, fileName);
}

/**
 * Backward compatibility helpers using SheetJS if needed
 */
export function buildCantiereWorksheet(cantiere: Cantiere, artigianoName?: string): XLSX.WorkSheet {
  const totals = calculateCantiereTotals(cantiere);
  const rows: (string | number)[][] = [
    ['Z CANTIERI MODULO 2026 - SCHERA CANTIERE', '', '', '', '', ''],
    [artigianoName ? `DITTA: ${artigianoName}` : '', '', '', '', '', ''],
    ['CANTIERE:', (cantiere.address || '').toUpperCase(), '', '', 'DITTA', ''],
    ['CITTA\':', cantiere.city.toUpperCase(), '', '', artigianoName || '', ''],
    ['DEL:', (cantiere.client || cantiere.name).toUpperCase(), '', '', '', ''],
    ['ANNO:', cantiere.year, '', '', '', ''],
    ['DATA DOC.', 'N° DOC.', 'TIPO DOC./ FORNITORE / CLIENTE', 'N./PROT', 'ACQUISTI', 'EMESSE'],
  ];
  for (const mov of cantiere.movements || []) {
    rows.push([
      formatDateItalian(mov.date),
      mov.docNumber || '',
      mov.typeAndSubject || '',
      mov.protocol || '',
      Number(mov.purchases) || 0,
      Number(mov.issued) || 0,
    ]);
  }
  rows.push(['', '', '', 'Totale senza RI', totals.totaleAcquisti, 0]);
  rows.push(['', '', '', 'Totale comprensivo di RI', totals.totaleAcquistiConRI, totals.totaleEmesse]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return ws;
}

export function buildProspettoGeneraleWorksheet(artigiano: Artigiano): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['NOME CLIENTE', 'CITTA\'', 'INDIRIZZO', 'R.I.', 'ACQUISTI', 'EMESSE', 'R.F.'],
  ];
  for (const c of artigiano.cantieri || []) {
    const t = calculateCantiereTotals(c);
    const ri = Number(c.initialInventory) || 0;
    const acq = t.totaleAcquisti;
    const eme = t.totaleEmesse;
    const rf = computeCantiereRF(ri, acq, eme);
    rows.push([
      (c.name || '').toUpperCase(),
      (c.city || '').toUpperCase(),
      (c.address || '').toUpperCase(),
      ri > 0 ? ri : ' - €',
      acq > 0 ? acq : ' - €',
      eme > 0 ? eme : ' - €',
      rf > 0 ? rf : ' - €',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return ws;
}

export function buildSospesiWorksheet(sospesi: SospesoItem[], artigianoName?: string): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['DATA', 'N° DOC / DDT', 'FORNITORE', 'DESCRIZIONE MERCI / MATERIALI', 'IMPORTO (€)', 'NOTE / CANTIERE'],
  ];
  sospesi.forEach((s) => {
    rows.push([
      formatDateItalian(s.date),
      s.docNumber,
      s.supplier,
      s.description,
      Number(s.amount) || 0,
      s.customerNote || '',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return ws;
}
