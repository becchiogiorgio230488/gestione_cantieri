import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Artigiano, Cantiere, SospesoItem, QuadraturaContabile } from '../types';
import { calculateCantiereTotals, computeCantiereRF, formatDateItalian } from './calculations';
import { getCantiereFileName } from './pdfExport';

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

  // 6 Columns: DATA DOC., N° DOC., TIPO DOC. / FORNITORE / CLIENTE, N./PROT, ACQUISTI, EMESSE
  ws.columns = [
    { key: 'colA', width: 15 }, // DATA DOC.
    { key: 'colB', width: 15 }, // N° DOC.
    { key: 'colC', width: 44 }, // TIPO DOC. / FORNITORE / CLIENTE
    { key: 'colD', width: 14 }, // N./PROT
    { key: 'colE', width: 18 }, // ACQUISTI
    { key: 'colF', width: 18 }, // EMESSE
  ];

  // -------------------------------------------------------------
  // HEADER BLOCKS (Rows 1 to 4)
  // CANTIERE: [Nome Cantiere]
  // DITTA: [Nome Ditta]
  // CITTA': [Città]
  // DEL: [Data] | ANNO: [Anno]
  // -------------------------------------------------------------
  const nomeCantiere = (cantiere.name || '').toUpperCase();
  const cittaCantiere = (cantiere.city || '').toUpperCase();
  const indirizzoCantiere = (cantiere.address || '').toUpperCase();
  const clienteNome = (cantiere.client || cantiere.name || '').toUpperCase();
  const finalDitta = (dittaName || 'IMPRESA').toUpperCase();
  const dataStampa = new Date().toLocaleDateString('it-IT');
  const annoCantiere = cantiere.year || 2026;

  // Row 1: CANTIERE: [Nome] | DITTA: [Nome Ditta]
  const row1 = ws.addRow(['CANTIERE:', nomeCantiere, '', '', 'DITTA:', finalDitta]);
  row1.height = 24;
  ws.mergeCells('B1:D1');

  // Row 2: CITTA': [Città - Indirizzo] | ANNO: [Anno]
  const fullLoc = indirizzoCantiere ? `${cittaCantiere} - ${indirizzoCantiere}` : cittaCantiere;
  const row2 = ws.addRow(['CITTA\':', fullLoc, '', '', 'ANNO:', annoCantiere]);
  row2.height = 24;
  ws.mergeCells('B2:D2');

  // Row 3: DEL: [Data] | COMMITTENTE: [Cliente]
  const row3 = ws.addRow(['DEL:', dataStampa, '', '', 'COMMITTENTE:', clienteNome]);
  row3.height = 24;
  ws.mergeCells('B3:D3');

  // Style Header rows 1-3
  for (let r = 1; r <= 3; r++) {
    // Left label (col A)
    const cellA = ws.getCell(`A${r}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.border = thinBlackBorder;
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    // Left value (col B:D)
    const cellB = ws.getCell(`B${r}`);
    cellB.font = { name: 'Calibri', size: 10, bold: true };
    cellB.alignment = { vertical: 'middle', horizontal: 'left' };
    cellB.border = thinBlackBorder;
    ws.getCell(`C${r}`).border = thinBlackBorder;
    ws.getCell(`D${r}`).border = thinBlackBorder;

    // Right label (col E)
    const cellE = ws.getCell(`E${r}`);
    cellE.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cellE.alignment = { vertical: 'middle', horizontal: 'center' };
    cellE.border = thinBlackBorder;
    cellE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    // Right value (col F)
    const cellF = ws.getCell(`F${r}`);
    cellF.font = { name: 'Calibri', size: 11, bold: true };
    cellF.alignment = { vertical: 'middle', horizontal: 'center' };
    cellF.border = thinBlackBorder;
  }

  // Row 4: Blank separator
  const blankRow4 = ws.addRow(['', '', '', '', '', '']);
  blankRow4.height = 10;

  // -------------------------------------------------------------
  // TABLE HEADERS (Row 5)
  // DATA DOC. | N° DOC. | TIPO DOC. / FORNITORE / CLIENTE | N./PROT | ACQUISTI | EMESSE
  // -------------------------------------------------------------
  const tableHeaderRow = ws.addRow([
    'DATA DOC.',
    'N° DOC.',
    'TIPO DOC. / FORNITORE / CLIENTE',
    'N./PROT',
    'ACQUISTI',
    'EMESSE'
  ]);
  tableHeaderRow.height = 24;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = mediumBlackBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
  });

  // -------------------------------------------------------------
  // ROW 6: RIMANENZE INIZIALI (R.I.)
  // -------------------------------------------------------------
  const ri = Number(cantiere.initialInventory) || 0;
  const riRow = ws.addRow([
    '',
    '',
    'RIMANENZE INIZIALI (R.I.)',
    '',
    ri > 0 ? ri : 0,
    ''
  ]);
  riRow.height = 21;
  riRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 3) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    } else if (colNum === 5) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10, bold: true };
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
      if (colNum === 1 || colNum === 2 || colNum === 4) {
        // Centered dates, document numbers, protocol
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 3) {
        // Left-aligned type / supplier / description
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        // Right-aligned currency
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  }

  // Ensure minimum empty rows for a realistic grid
  const minRows = Math.max(movements.length, 6);
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
  // RIGHE TOTALI FINALI:
  // Riga 1: Totale senza RI (somma acquisti e vendite emesse dell'anno)
  // Riga 2: Totale comprensivo di RI (somma totale inclusa rimanenza iniziale)
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
    { formula: `SUM(F${startMovRow}:F${lastMovRowNum})` }
  ]);
  totSenzaRIRow.height = 24;

  totSenzaRIRow.eachCell((cell, colNum) => {
    cell.border = doubleTopBorder;
    if (colNum === 4) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 5) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.numFmt = currencyFormat;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
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
    { formula: `F${totSenzaRIRowNum}` }
  ]);
  totCompRIRow.height = 24;

  totCompRIRow.eachCell((cell, colNum) => {
    cell.border = mediumBlackBorder;
    if (colNum === 4) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum >= 5) {
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.numFmt = currencyFormat;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
    }
  });

  return ws;
}

/**
 * Creates the exact Prospetto Generale worksheet:
 * - Header ditta: DITTA: [Nome Ditta]
 * - Main table: NOME CLIENTE | CITTA' | INDIRIZZO | R.I. | ACQUISTI | EMESSE | R.F.
 * - Totals row: TOTALI with sum of R.I., ACQUISTI, EMESSE, R.F.
 * - Section Sospesi / Quadratura with Mastri Acquisti, Totale Acquisti, Mastri Vendite, Totale Vendite, Sbilancio
 */
export function createProspettoSheet(
  workbook: ExcelJS.Workbook,
  artigiano: Artigiano,
  sheetName: string = 'Prospetto Cantieri',
  dataAggiornamento?: string
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Column definitions matching guidelines:
  // NOME CLIENTE | CITTA' | INDIRIZZO | R.I. | ACQUISTI | EMESSE | R.F.
  ws.columns = [
    { key: 'colA', width: 34 }, // NOME CLIENTE
    { key: 'colB', width: 22 }, // CITTA'
    { key: 'colC', width: 36 }, // INDIRIZZO
    { key: 'colD', width: 16 }, // R.I.
    { key: 'colE', width: 16 }, // ACQUISTI
    { key: 'colF', width: 16 }, // EMESSE
    { key: 'colG', width: 16 }, // R.F.
  ];

  // -------------------------------------------------------------
  // HEADER DITTA (Row 1-2)
  // -------------------------------------------------------------
  const dittaName = (artigiano.name || 'IMPRESA').toUpperCase();
  const rowDitta = ws.addRow([`DITTA: ${dittaName}`, '', '', '', '', '', '']);
  rowDitta.height = 26;
  ws.mergeCells(`A1:G1`);
  const cellDittaHeader = ws.getCell('A1');
  cellDittaHeader.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } };
  cellDittaHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  // Sottotitolo: "PROSPETTO GENERALE CANTIERI • ANNO [Anno] • DATA DI STAMPA: [data] - CANTIERI AGGIORNATI AL "
  // con la data di aggiornamento cantieri in GRASSETTO
  const dataStampa = new Date().toLocaleDateString('it-IT');
  const anno = artigiano.year || 2026;
  const dataAggiornataText = (dataAggiornamento || dataStampa).trim();

  const rowSub = ws.addRow(['', '', '', '', '', '', '']);
  rowSub.height = 20;
  ws.mergeCells(`A2:G2`);
  const cellSub = ws.getCell('A2');
  cellSub.value = {
    richText: [
      {
        text: `PROSPETTO GENERALE CANTIERI • ANNO ${anno} • DATA DI STAMPA: ${dataStampa} - CANTIERI AGGIORNATI AL `,
        font: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } },
      },
      {
        text: dataAggiornataText,
        font: { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF000000' } },
      },
    ],
  };
  cellSub.alignment = { vertical: 'middle', horizontal: 'left' };

  // Blank row 3
  const sepRow3 = ws.addRow(['', '', '', '', '', '', '']);
  sepRow3.height = 8;

  // -------------------------------------------------------------
  // TABELLA PRINCIPALE CANTIERI (Row 4)
  // Colonne: NOME CLIENTE | CITTA' | INDIRIZZO | R.I. | ACQUISTI | EMESSE | R.F.
  // -------------------------------------------------------------
  const headerRow = ws.addRow([
    'NOME CLIENTE',
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
    cell.border = mediumBlackBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum <= 3 ? 'left' : 'right'
    };
  });

  // L'elenco dei cantieri nella tabella deve essere in ordine di CITTA'
  const rawCantieri = artigiano.cantieri || [];
  const cantieri = [...rawCantieri].sort((a, b) => {
    const cityA = (a.city || '').trim().toUpperCase();
    const cityB = (b.city || '').trim().toUpperCase();
    if (cityA !== cityB) {
      return cityA.localeCompare(cityB, 'it', { sensitivity: 'base' });
    }
    const addrA = (a.address || a.name || '').trim().toUpperCase();
    const addrB = (b.address || b.name || '').trim().toUpperCase();
    return addrA.localeCompare(addrB, 'it', { sensitivity: 'base' });
  });

  const startDataRow = 5;

  // Data rows for cantieri
  for (const c of cantieri) {
    const t = calculateCantiereTotals(c);
    const ri = Number(c.initialInventory) || 0;
    const acq = t.totaleAcquisti;
    const eme = t.totaleEmesse;
    const rf = computeCantiereRF(ri, acq, eme);
    const clientOrName = (c.client || c.name || '').toUpperCase();

    const row = ws.addRow([
      clientOrName,
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

  // Ensure minimum rows
  const minRows = Math.max(cantieri.length, 2);
  for (let i = cantieri.length; i < minRows; i++) {
    const emptyRow = ws.addRow(['', '', '', 0, 0, 0, 0]);
    emptyRow.height = 20;
    emptyRow.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      if (colNum >= 4) {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  }

  // -------------------------------------------------------------
  // RIGA DEI SOSPESI
  // Inserita nella tabella principale prima dei TOTALI:
  // acquisti = somma di tutti i sospesi, altre colonne a zero
  // -------------------------------------------------------------
  const totSospesi = (artigiano.sospesi || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const sospesiRow = ws.addRow([
    'SOSPESI',
    '',
    'FORNITURE IN ATTESA DI ATTRIBUZIONE (C/430000)',
    0,
    totSospesi,
    0,
    0
  ]);
  sospesiRow.height = 21;

  sospesiRow.eachCell((cell, colNum) => {
    cell.border = thinBlackBorder;
    if (colNum === 1) {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB45309' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    } else if (colNum <= 3) {
      cell.font = { name: 'Calibri', size: 10, italic: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    } else {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 10, bold: colNum === 5 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  const lastTableDataRowNum = sospesiRow.number;

  // -------------------------------------------------------------
  // RIGA TOTALI CANTIERI + SOSPESI
  // Riga in grassetto con bordo marcato riportante TOTALI e la somma
  // delle colonne R.I., ACQUISTI (cantieri + sospesi), EMESSE e R.F.
  // -------------------------------------------------------------
  const totaliRow = ws.addRow([
    '',
    '',
    'TOTALI',
    { formula: `SUM(D${startDataRow}:D${lastTableDataRowNum})` },
    { formula: `SUM(E${startDataRow}:E${lastTableDataRowNum})` },
    { formula: `SUM(F${startDataRow}:F${lastTableDataRowNum})` },
    { formula: `SUM(G${startDataRow}:G${lastTableDataRowNum})` },
  ]);
  totaliRow.height = 24;
  const totaliRowNum = totaliRow.number;

  totaliRow.eachCell((cell, colNum) => {
    cell.border = mediumBlackBorder;
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
  sepRow.height = 16;

  // -------------------------------------------------------------
  // SEZIONE SOSPESI / QUADRATURA
  // Sotto la tabella dei cantieri, includere la sezione QUADRATURA / SOSPESI.
  // Tabella sintetica con suddivisione per mastro o categoria con TOTALE ACQUISTI.
  // Sezione Vendite con TOTALE VENDITE e calcolo SBILANCIO ACQUISTI e SBILANCIO RICAVI.
  // -------------------------------------------------------------
  const quadHeaderRow = ws.addRow(['SEZIONE QUADRATURA / SOSPESI', '', '', '', '', '', '']);
  quadHeaderRow.height = 24;
  ws.mergeCells(`A${quadHeaderRow.number}:C${quadHeaderRow.number}`);
  const quadCell = ws.getCell(`A${quadHeaderRow.number}`);
  quadCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  quadCell.alignment = { vertical: 'middle', horizontal: 'left' };
  quadCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
  quadCell.border = mediumBlackBorder;
  ws.getCell(`B${quadHeaderRow.number}`).border = mediumBlackBorder;
  ws.getCell(`C${quadHeaderRow.number}`).border = mediumBlackBorder;

  // Mastri Acquisti
  const mastriAcq = artigiano.quadratura?.mastriniAcquistiDetails && artigiano.quadratura.mastriniAcquistiDetails.length > 0
    ? artigiano.quadratura.mastriniAcquistiDetails
    : [
        { code: 'C/430000', description: 'ACQUISTI MERCI', amount: totSospesi },
        { code: 'C/441120', description: 'LAVORAZIONI DI TERZI', amount: 0 },
        { code: 'C/450200', description: 'LOCAZIONI PASSIVE ALTRI BENI', amount: 0 },
      ];

  const firstAcqRowNum = quadHeaderRow.number + 1;
  for (const m of mastriAcq) {
    const label = `${m.code || ''} ${m.description || ''}`.trim();
    const row = ws.addRow([label, '', m.amount || 0, '', '', '', '']);
    row.height = 20;
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cellA = ws.getCell(`A${row.number}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true };
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };
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
  cellTotAcq.alignment = { vertical: 'middle', horizontal: 'left' };
  cellTotAcq.border = mediumBlackBorder;
  cellTotAcq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  ws.getCell(`B${totAcqRow.number}`).border = mediumBlackBorder;

  const cellTotAcqVal = ws.getCell(`C${totAcqRow.number}`);
  cellTotAcqVal.numFmt = currencyFormat;
  cellTotAcqVal.font = { name: 'Calibri', size: 10, bold: true };
  cellTotAcqVal.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotAcqVal.border = mediumBlackBorder;
  cellTotAcqVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  const totAcqCellRef = `C${totAcqRow.number}`;

  // Blank row
  const blankRowQuad = ws.addRow(['', '', '', '', '', '', '']);
  blankRowQuad.height = 10;

  // Mastri Vendite
  const mastriVen = artigiano.quadratura?.mastriniVenditeDetails && artigiano.quadratura.mastriniVenditeDetails.length > 0
    ? artigiano.quadratura.mastriniVenditeDetails
    : [
        { code: 'C/310000', description: 'VENDITA MERCI', amount: 0 },
        { code: 'C/310740', description: 'RICAVI PER SERVIZI', amount: 0 },
        { code: 'C/310750', description: 'ALTRI RICAVI', amount: 0 },
      ];

  const firstVenRowNum = blankRowQuad.number + 1;
  for (const m of mastriVen) {
    const label = `${m.code || ''} ${m.description || ''}`.trim();
    const row = ws.addRow([label, '', m.amount || 0, '', '', '', '']);
    row.height = 20;
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cellA = ws.getCell(`A${row.number}`);
    cellA.font = { name: 'Calibri', size: 10, bold: true };
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };
    cellA.border = thinBlackBorder;
    ws.getCell(`B${row.number}`).border = thinBlackBorder;

    const cellC = ws.getCell(`C${row.number}`);
    cellC.numFmt = currencyFormat;
    cellC.font = { name: 'Calibri', size: 10 };
    cellC.alignment = { vertical: 'middle', horizontal: 'right' };
    cellC.border = thinBlackBorder;
  }
  const lastVenRowNum = firstVenRowNum + mastriVen.length - 1;

  // Row TOTALE VENDITE with SBILANCIO ACQUISTI and SBILANCIO RICAVI headers on F & G
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
  cellTotVen.alignment = { vertical: 'middle', horizontal: 'left' };
  cellTotVen.border = mediumBlackBorder;
  cellTotVen.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  ws.getCell(`B${totVenRow.number}`).border = mediumBlackBorder;

  const cellTotVenVal = ws.getCell(`C${totVenRow.number}`);
  cellTotVenVal.numFmt = currencyFormat;
  cellTotVenVal.font = { name: 'Calibri', size: 10, bold: true };
  cellTotVenVal.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotVenVal.border = mediumBlackBorder;
  cellTotVenVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  const totVenCellRef = `C${totVenRow.number}`;

  // Style Sbilancio headers on F & G
  const cellSbilAcqHeader = ws.getCell(`F${totVenRow.number}`);
  cellSbilAcqHeader.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilAcqHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilAcqHeader.border = mediumBlackBorder;
  cellSbilAcqHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };

  const cellSbilVenHeader = ws.getCell(`G${totVenRow.number}`);
  cellSbilVenHeader.font = { name: 'Calibri', size: 10, bold: true };
  cellSbilVenHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilVenHeader.border = mediumBlackBorder;
  cellSbilVenHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };

  // Row for Sbilancio Values on columns F & G:
  // Sbilancio Acquisti: TOTALE ACQUISTI (SEZIONE QUADRATURA) - TOTALE ACQUISTI (CANTIERI + SOSPESI) [col E di TOTALI]
  // Sbilancio Vendite: TOTALE VENDITE (SEZIONE QUADRATURA) - TOTALE VENDITE DEI CANTIERI [col F di TOTALI]
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
  cellSbilAcqVal.font = { name: 'Calibri', size: 11, bold: true };
  cellSbilAcqVal.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilAcqVal.border = mediumBlackBorder;
  cellSbilAcqVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  const cellSbilVenVal = ws.getCell(`G${sbilValuesRow.number}`);
  cellSbilVenVal.numFmt = currencyFormat;
  cellSbilVenVal.font = { name: 'Calibri', size: 11, bold: true };
  cellSbilVenVal.alignment = { vertical: 'middle', horizontal: 'center' };
  cellSbilVenVal.border = mediumBlackBorder;
  cellSbilVenVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  return ws;
}

/**
 * Export single cantiere to Excel with standard file naming:
 * "città del cantiere - la via del cantiere.xlsx" or fallback to cantiere.name
 */
export async function exportSingleCantiereExcel(
  cantiere: Cantiere,
  dittaName?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  buildCantiereDetailSheet(workbook, cantiere, dittaName, cantiere.name || 'Scheda Cantiere');

  const fileName = getCantiereFileName(cantiere, 'xlsx');
  await saveWorkbook(workbook, fileName);
}

/**
 * Export Prospetto Generale for an artisan or cantieri list.
 * EXPORTA SOLO IL PROSPETTO GENERALE (senza creare nello stesso file un foglio per ogni cantiere).
 */
export async function exportProspettoGeneraleExcel(
  target: Artigiano | Cantiere[],
  quadratura?: QuadraturaContabile,
  sospesi?: SospesoItem[],
  dataAggiornamento?: string
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

  // Foglio UNICO: Z-PROSPETTO CANTIERI (nessun foglio per singoli cantieri)
  createProspettoSheet(workbook, artigiano, 'Z-PROSPETTO CANTIERI', dataAggiornamento);

  const cleanDitta = (artigiano.name || 'Impresa').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `PROSPETTO_GENERALE_CANTIERI_${cleanDitta}_${artigiano.year || 2026}.xlsx`;
  await saveWorkbook(workbook, fileName);
}

/**
 * Esporta tutti i singoli cantieri in file Excel (.xlsx) separati,
 * rinominati "città del cantiere - la via del cantiere.xlsx" (o nome cantiere se assenti).
 * Raggruppati in un comodo archivio ZIP per il download istantaneo.
 */
export async function exportAllCantieriExcelZip(
  cantieri: Cantiere[],
  dittaName?: string,
  year?: number
): Promise<void> {
  const zip = new JSZip();
  const finalDitta = dittaName || 'Impresa';
  const usedNames = new Map<string, number>();

  for (const c of cantieri) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Studio Contabile';
    workbook.created = new Date();

    buildCantiereDetailSheet(workbook, c, finalDitta, c.name || 'Cantiere');
    const buffer = await workbook.xlsx.writeBuffer();

    let baseFileName = getCantiereFileName(c, 'xlsx');
    if (usedNames.has(baseFileName)) {
      const count = usedNames.get(baseFileName)! + 1;
      usedNames.set(baseFileName, count);
      baseFileName = baseFileName.replace(/\.xlsx$/i, `_${count}.xlsx`);
    } else {
      usedNames.set(baseFileName, 1);
    }

    zip.file(baseFileName, buffer);
  }

  const cleanDitta = finalDitta.replace(/[^a-zA-Z0-9]/g, '_');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Archivio_Singoli_Cantieri_XLS_${cleanDitta}_${year || 2026}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Scarica ciascun singolo cantiere come file .xlsx individuale
 */
export async function exportAllCantieriExcelSeparate(
  cantieri: Cantiere[],
  dittaName?: string
): Promise<void> {
  const finalDitta = dittaName || 'Impresa';
  for (let i = 0; i < cantieri.length; i++) {
    const c = cantieri[i];
    await exportSingleCantiereExcel(c, finalDitta);
    // Piccolo ritardo di 150ms per consentire al browser di gestire i file
    if (i < cantieri.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

/**
 * Export Sospesi sheet to Excel matching exact guidelines:
 * - Header ditta: DITTA: [Nome Ditta] and SCHEDA SOSPESI / FORNITURE IN ATTESA
 * - Columns: DATA | N. FATTURA | FORNITORE | NS. PROT. | IMPORTO | DESCRIZIONE
 * - Alignments: centered for Data, N. Fattura, Prot; right for Importo; left for Fornitore/Descrizione
 * - Totals row: TOTALE: with sum of column IMPORTO, bold, double border
 */
export async function exportSospesiExcel(sospesi: SospesoItem[], artigianoName?: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Studio Contabile';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Scheda Sospesi', {
    views: [{ showGridLines: true }]
  });

  // 6 Columns: DATA | N. FATTURA | FORNITORE | NS. PROT. | IMPORTO | DESCRIZIONE
  ws.columns = [
    { key: 'colA', width: 14 }, // DATA
    { key: 'colB', width: 16 }, // N. FATTURA
    { key: 'colC', width: 34 }, // FORNITORE
    { key: 'colD', width: 16 }, // NS. PROT.
    { key: 'colE', width: 18 }, // IMPORTO
    { key: 'colF', width: 42 }, // DESCRIZIONE
  ];

  // -------------------------------------------------------------
  // HEADER DITTA (Rows 1 to 3)
  // -------------------------------------------------------------
  const ditta = (artigianoName || 'IMPRESA').toUpperCase();
  const row1 = ws.addRow([`DITTA: ${ditta}`, '', '', '', '', '']);
  row1.height = 24;
  ws.mergeCells('A1:F1');
  const cellA1 = ws.getCell('A1');
  cellA1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
  cellA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const row2 = ws.addRow(['SCHEDA SOSPESI / FORNITURE IN ATTESA', '', '', '', '', '']);
  row2.height = 20;
  ws.mergeCells('A2:F2');
  const cellA2 = ws.getCell('A2');
  cellA2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF333333' } };
  cellA2.alignment = { vertical: 'middle', horizontal: 'left' };

  const row3 = ws.addRow([`Data emissione: ${new Date().toLocaleDateString('it-IT')}`, '', '', '', '', '']);
  row3.height = 16;
  ws.mergeCells('A3:F3');
  const cellA3 = ws.getCell('A3');
  cellA3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF666666' } };
  cellA3.alignment = { vertical: 'middle', horizontal: 'left' };

  const rowSep = ws.addRow(['', '', '', '', '', '']);
  rowSep.height = 8;

  // -------------------------------------------------------------
  // TABLE HEADERS (Row 5)
  // DATA | N. FATTURA | FORNITORE | NS. PROT. | IMPORTO | DESCRIZIONE
  // -------------------------------------------------------------
  const header = ws.addRow([
    'DATA',
    'N. FATTURA',
    'FORNITORE',
    'NS. PROT.',
    'IMPORTO',
    'DESCRIZIONE',
  ]);
  header.height = 24;
  header.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.border = mediumBlackBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
    if (colNum === 1 || colNum === 2 || colNum === 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNum === 5) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  const startDataRow = 6;
  sospesi.forEach((s) => {
    const supplierFull = s.ddtNumber ? `${s.supplier} (DDT: ${s.ddtNumber})` : s.supplier;
    const desc = s.description || s.customerNote || '';
    const row = ws.addRow([
      formatDateItalian(s.date),
      s.docNumber || '',
      supplierFull || '',
      s.protocol || '',
      Number(s.amount) || 0,
      desc,
    ]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = thinBlackBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if (colNum === 1 || colNum === 2 || colNum === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 5) {
        cell.numFmt = currencyFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  const lastDataRow = ws.rowCount;

  // -------------------------------------------------------------
  // RIGA TOTALE
  // In fondo alla tabella, riga in grassetto con TOTALE: e la somma della colonna IMPORTO
  // -------------------------------------------------------------
  const doubleTopBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'double', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const totRow = ws.addRow([
    '',
    '',
    '',
    'TOTALE:',
    { formula: `SUM(E${startDataRow}:E${lastDataRow})` },
    ''
  ]);
  totRow.height = 24;

  totRow.eachCell((cell, colNum) => {
    cell.border = doubleTopBorder;
    if (colNum === 4) {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    } else if (colNum === 5) {
      cell.numFmt = currencyFormat;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
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
