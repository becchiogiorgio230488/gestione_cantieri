import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { Cantiere, Artigiano } from '../types';
import {
  calculateCantiereTotals,
  calculateArtigianoTotals,
  computeCantiereRF,
  formatAccountingCurrency,
  formatDateItalian,
} from './calculations';

/**
 * Computes standardized filename for a cantiere file:
 * "città del cantiere - la via del cantiere", or fallback to cantiere.name if missing.
 */
export function getCantiereFileName(cantiere: Cantiere, ext: 'xlsx' | 'pdf'): string {
  const city = (cantiere.city || '').trim();
  const address = (cantiere.address || '').trim();

  let baseName = '';
  if (city && address) {
    baseName = `${city} - ${address}`;
  } else if (city) {
    baseName = city;
  } else if (address) {
    baseName = address;
  } else {
    baseName = (cantiere.name || 'Cantiere').trim();
  }

  // Remove characters forbidden in filenames: / \ : * ? " < > |
  const sanitized = baseName.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim() || 'Cantiere';
  return `${sanitized}.${ext}`;
}

/**
 * Builds a jsPDF document for a single cantiere matching the exact Excel XLS visual structure:
 * - 4-row header grid with centered text, labels with gray background and thin borders
 * - 6-column movements table (DATA DOC., N° DOC., TIPO DOC. / FORNITORE / CLIENTE, N./PROT, ACQUISTI, EMESSE)
 * - Row 1 of table: RIMANENZE INIZIALI (R.I.)
 * - Movements rows with at least 37 rows total
 * - Totals rows:
 *   - "Totale senza RI" with columns A-D merged, text aligned left with indent, E & F with totals and light gray background
 *   - "Totale comprensivo di RI" with columns A-D merged, text aligned left with indent, E & F with totals and gray background
 * - All borders matching the thin black border of the XLS file.
 */
export function buildCantierePdfDoc(cantiere: Cantiere, dittaName?: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totals = calculateCantiereTotals(cantiere);
  const ri = Number(cantiere.initialInventory) || 0;
  const acqSenzaRI = totals.totaleAcquisti;
  const emeTot = totals.totaleEmesse;
  const acqConRI = acqSenzaRI + ri;
  const dataStampa = new Date().toLocaleDateString('it-IT');
  const annoCantiere = cantiere.year || 2026;
  const nomeCantiere = (cantiere.name || '').toUpperCase() + (cantiere.isMagazzino ? ' [MAGAZZINO]' : '');
  const cittaCantiere = (cantiere.city || '').toUpperCase();
  const indirizzoCantiere = (cantiere.address || '').toUpperCase();
  const fullLoc = indirizzoCantiere ? `${cittaCantiere} - ${indirizzoCantiere}` : cittaCantiere;
  const clienteNome = (cantiere.client || cantiere.name || '').toUpperCase();
  const finalDitta = (dittaName || 'IMPRESA').toUpperCase();
  const percSign = totals.marginePercentuale >= 0 ? '+' : '';
  const percFormatted = `${percSign}${totals.marginePercentuale}%`;

  // -------------------------------------------------------------
  // 1. HEADER GRID TABLE (Exact replica of Rows 1 to 4 of Excel sheet)
  // -------------------------------------------------------------
  autoTable(doc, {
    startY: 10,
    margin: { left: 10, right: 10 },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.8,
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold', fillColor: [242, 242, 242] },
      1: { halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold', fillColor: [242, 242, 242] },
      3: { cellWidth: 42, halign: 'center', fontStyle: 'bold' },
    },
    body: [
      // Row 1: CANTIERE: [Nome Cantiere] | DITTA: [Nome Ditta]
      [
        { content: 'CANTIERE:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: nomeCantiere, colSpan: 1, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'DITTA:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: finalDitta, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      // Row 2: CITTA': [Città - Indirizzo] | ANNO: [Anno]
      [
        { content: "CITTA':", styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: fullLoc, styles: { halign: 'center' } },
        { content: 'ANNO:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: String(annoCantiere), styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      // Row 3: DEL: [Nome Committente] | DATA: [Data Stampa]
      [
        { content: 'DEL:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: clienteNome, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'DATA:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        { content: dataStampa, styles: { halign: 'center' } },
      ],
      // Row 4: % UTILE: [+XX.X%] | UTILE EFF.: [€ XXX.XX]
      [
        { content: '% UTILE:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        {
          content: percFormatted,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            fontSize: 9.5,
            textColor: totals.isPositive ? [4, 120, 87] : [190, 18, 60],
            fillColor: totals.isPositive ? [232, 245, 233] : [255, 235, 238],
          },
        },
        { content: 'UTILE EFF.:', styles: { fillColor: [242, 242, 242], fontStyle: 'bold', halign: 'center' } },
        {
          content: formatAccountingCurrency(totals.margineEffettivo),
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: totals.isPositive ? [4, 120, 87] : [190, 18, 60],
            fillColor: totals.isPositive ? [232, 245, 233] : [255, 235, 238],
          },
        },
      ],
    ],
  });

  const headerFinalY = (doc as any).lastAutoTable.finalY + 2.5;

  // -------------------------------------------------------------
  // 2. MOVEMENTS TABLE WITH EXACT 37 ROWS MINIMUM & COHERENT TOTALS
  // -------------------------------------------------------------
  const tableRows: any[] = [];

  // Row 1 of Table: RIMANENZE INIZIALI (R.I.)
  tableRows.push([
    '',
    '',
    'RIMANENZE INIZIALI (R.I.)',
    '',
    ri > 0 ? formatAccountingCurrency(ri) : '',
    '',
  ]);

  const movements = Array.isArray(cantiere?.movements) ? cantiere.movements : [];
  for (const mov of movements) {
    const acqVal = Number(mov.purchases) || 0;
    const emeVal = Number(mov.issued) || 0;
    tableRows.push([
      formatDateItalian(mov.date),
      mov.docNumber || '',
      mov.typeAndSubject || '',
      mov.protocol || '',
      acqVal !== 0 ? formatAccountingCurrency(acqVal) : '',
      emeVal !== 0 ? formatAccountingCurrency(emeVal) : '',
    ]);
  }

  // Minimum 37 rows to match the Excel sheet layout
  const emptyNeeded = Math.max(0, 37 - movements.length);
  for (let i = 0; i < emptyNeeded; i++) {
    tableRows.push(['', '', '', '', '', '']);
  }

  // Row: Totale senza RI (Col A to D merged, aligned left with indent, E & F with formulas/totals)
  tableRows.push([
    {
      content: 'Totale senza RI',
      colSpan: 4,
      styles: { halign: 'left', fontStyle: 'bold', fillColor: [255, 255, 255] },
    },
    {
      content: formatAccountingCurrency(acqSenzaRI),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: formatAccountingCurrency(emeTot),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
  ]);

  // Row: Totale comprensivo di RI (Col A to D merged, aligned left with indent, E & F with formulas/totals)
  tableRows.push([
    {
      content: 'Totale comprensivo di RI',
      colSpan: 4,
      styles: { halign: 'left', fontStyle: 'bold', fillColor: [255, 255, 255] },
    },
    {
      content: formatAccountingCurrency(acqConRI),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230] },
    },
    {
      content: formatAccountingCurrency(emeTot),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230] },
    },
  ]);

  autoTable(doc, {
    startY: headerFinalY,
    margin: { left: 10, right: 10 },
    head: [
      ['DATA DOC.', 'N° DOC.', 'TIPO DOC. / FORNITORE / CLIENTE', 'N./PROT', 'ACQUISTI', 'EMESSE'],
    ],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [234, 234, 234], // #EAEAEA matching Excel table header
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.1,
      lineWidth: 0.1,
      lineColor: [0, 0, 0], // Thin black border matching thinBlackBorder
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 26 },
    },
    didParseCell: (data) => {
      // Bold RIMANENZE INIZIALI row (first row of body)
      if (data.row.index === 0 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  return doc;
}

/**
 * Builds a jsPDF document for the Prospetto Generale matching the exact Excel XLS visual structure:
 * - Landscape A4 format
 * - Header banner: DITTA: [Nome Ditta] and Subtitle with Fiscal Year, Print Date, and Updated Date
 * - Main 8-column Table: NOME CLIENTE, CITTA', INDIRIZZO, R.I., ACQUISTI, EMESSE, R.F., % UTILE
 * - Cantieri sorted by CITTA'
 * - SOSPESI row inserted before totals
 * - TOTALI row with bold border, light gray fills and general totals
 * - Sezione Quadratura / Sospesi below with side-by-side tables for Acquisti and Vendite
 */
export function buildProspettoPdfDoc(artigiano: Artigiano, dataAggiornamento?: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const dittaName = (artigiano.name || 'IMPRESA').toUpperCase();
  const anno = artigiano.year || 2026;
  const dataStampa = new Date().toLocaleDateString('it-IT');
  const dataAggiornataText = (dataAggiornamento || dataStampa).trim();

  // 1. Header Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(`DITTA: ${dittaName}`, 10, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(
    `PROSPETTO GENERALE CANTIERI • ANNO ${anno} • DATA DI STAMPA: ${dataStampa} - CANTIERI AGGIORNATI AL: ${dataAggiornataText}`,
    10,
    18
  );

  // 2. Sort cantieri by CITTA' con cantieri Magazzino subito prima dei SOSPESI
  const rawCantieri = artigiano.cantieri || [];
  const normalCantieri = rawCantieri.filter((c) => !c.isMagazzino);
  const magazzinoCantieri = rawCantieri.filter((c) => Boolean(c.isMagazzino));

  const sortByCity = (list: typeof rawCantieri) =>
    [...list].sort((a, b) => {
      const cityA = (a.city || '').trim().toUpperCase();
      const cityB = (b.city || '').trim().toUpperCase();
      if (cityA !== cityB) {
        return cityA.localeCompare(cityB, 'it', { sensitivity: 'base' });
      }
      const addrA = (a.address || a.name || '').trim().toUpperCase();
      const addrB = (b.address || b.name || '').trim().toUpperCase();
      return addrA.localeCompare(addrB, 'it', { sensitivity: 'base' });
    });

  const sortedCantieri = [...sortByCity(normalCantieri), ...sortByCity(magazzinoCantieri)];

  let sumRI = 0;
  let sumAcquisti = 0;
  let sumEmesse = 0;
  let sumRF = 0;

  const tableBody: any[] = [];

  for (const c of sortedCantieri) {
    const t = calculateCantiereTotals(c);
    const ri = Number(c.initialInventory) || 0;
    const acq = t.totaleAcquisti;
    const eme = t.totaleEmesse;
    const rf = computeCantiereRF(ri, acq, eme);
    const clientOrName = c.isMagazzino
      ? `${(c.client || c.name || '').toUpperCase()} [MAGAZZINO]`
      : (c.client || c.name || '').toUpperCase();

    sumRI += ri;
    sumAcquisti += acq;
    sumEmesse += eme;
    sumRF += rf;

    tableBody.push([
      clientOrName,
      (c.city || '').toUpperCase(),
      (c.address || '').toUpperCase(),
      formatAccountingCurrency(ri),
      formatAccountingCurrency(acq),
      formatAccountingCurrency(eme),
      formatAccountingCurrency(rf),
      {
        content: `${t.marginePercentuale}%`,
        styles: {
          fontStyle: 'bold',
          textColor: t.isPositive ? [4, 120, 87] : [190, 18, 60],
        },
      },
    ]);
  }

  // Row: SOSPESI
  const totSospesi = (artigiano.sospesi || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const finalAcq = sumAcquisti + totSospesi;

  tableBody.push([
    { content: 'SOSPESI', styles: { fontStyle: 'bold', textColor: [180, 83, 9] } },
    '-',
    { content: 'FORNITURE IN ATTESA DI ATTRIBUZIONE (C/430000)', styles: { fontStyle: 'italic' } },
    '-',
    { content: formatAccountingCurrency(totSospesi), styles: { fontStyle: 'bold', textColor: [180, 83, 9] } },
    '-',
    '-',
    '-',
  ]);

  // Row: TOTALI
  const artTotals = calculateArtigianoTotals(artigiano);
  tableBody.push([
    {
      content: 'TOTALI',
      colSpan: 3,
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: formatAccountingCurrency(sumRI),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: formatAccountingCurrency(finalAcq),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: formatAccountingCurrency(sumEmesse),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: formatAccountingCurrency(sumRF),
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] },
    },
    {
      content: `${artTotals.marginePercentuale}%`,
      styles: {
        halign: 'center',
        fontStyle: 'bold',
        fillColor: [242, 242, 242],
        textColor: artTotals.marginePercentuale >= 0 ? [4, 120, 87] : [190, 18, 60],
      },
    },
  ]);

  // Render Main Table
  autoTable(doc, {
    startY: 22,
    margin: { left: 10, right: 10 },
    head: [
      ['NOME CLIENTE', "CITTA'", 'INDIRIZZO', 'R.I.', 'ACQUISTI', 'EMESSE', 'R.F.', '% UTILE'],
    ],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [234, 234, 234], // #EAEAEA
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: [0, 0, 0], // Thin black border
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 55, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 35 },
      2: { halign: 'left' },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'center', cellWidth: 20 },
    },
  });

  const mainTableFinalY = (doc as any).lastAutoTable.finalY + 4;

  // 3. Sezione Quadratura / Sospesi
  const mastriAcq = artigiano.quadratura?.mastriniAcquistiDetails || [
    { code: 'C/430000', description: 'ACQUISTI MERCI', amount: 0 },
    { code: 'C/441120', description: 'LAVORAZIONI DI TERZI', amount: 0 },
    { code: 'C/450200', description: 'LOCAZIONI PASSIVE ALTRI BENI', amount: 0 },
  ];
  const mastriVen = artigiano.quadratura?.mastriniVenditeDetails || [
    { code: 'C/310000', description: 'VENDITA MERCI', amount: 0 },
    { code: 'C/310740', description: 'RICAVI PER SERVIZI', amount: 0 },
    { code: 'C/310750', description: 'ALTRI RICAVI', amount: 0 },
  ];

  const totMastriAcq = mastriAcq.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totMastriVen = mastriVen.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

  const sbilancioAcq = Math.round((totMastriAcq - finalAcq) * 100) / 100;
  const sbilancioVen = Math.round((totMastriVen - sumEmesse) * 100) / 100;

  // Banner SEZIONE QUADRATURA / SOSPESI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('SEZIONE QUADRATURA / SOSPESI', 10, mainTableFinalY + 3);

  const halfWidth = 135; // 277mm / 2 approx

  // Table Left: Acquisti
  const acqRows: any[] = mastriAcq.map((m) => [
    `${m.code} ${m.description}`,
    formatAccountingCurrency(m.amount),
  ]);
  acqRows.push([
    { content: 'Totale Contabilità Generale Mastri Costi', styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } },
    { content: formatAccountingCurrency(totMastriAcq), styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } },
  ]);
  acqRows.push([
    { content: 'Totale Costi Schede Cantieri (+ Sospesi)', styles: { fontStyle: 'bold' } },
    { content: formatAccountingCurrency(finalAcq), styles: { fontStyle: 'bold' } },
  ]);
  acqRows.push([
    {
      content: 'SBILANCIO COSTI (Quadratura)',
      styles: {
        fontStyle: 'bold',
        fillColor: Math.abs(sbilancioAcq) < 0.05 ? [232, 245, 233] : [255, 235, 238],
        textColor: Math.abs(sbilancioAcq) < 0.05 ? [4, 120, 87] : [190, 18, 60],
      },
    },
    {
      content: formatAccountingCurrency(sbilancioAcq),
      styles: {
        fontStyle: 'bold',
        fillColor: Math.abs(sbilancioAcq) < 0.05 ? [232, 245, 233] : [255, 235, 238],
        textColor: Math.abs(sbilancioAcq) < 0.05 ? [4, 120, 87] : [190, 18, 60],
      },
    },
  ]);

  autoTable(doc, {
    startY: mainTableFinalY + 5,
    margin: { left: 10, right: 10 + halfWidth + 5 },
    tableWidth: halfWidth,
    head: [['QUADRATURA ACQUISTI / COSTI', 'IMPORTO']],
    body: acqRows,
    theme: 'plain',
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.2,
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 32 },
    },
  });

  // Table Right: Vendite
  const venRows: any[] = mastriVen.map((m) => [
    `${m.code} ${m.description}`,
    formatAccountingCurrency(m.amount),
  ]);
  venRows.push([
    { content: 'Totale Contabilità Generale Mastri Ricavi', styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } },
    { content: formatAccountingCurrency(totMastriVen), styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } },
  ]);
  venRows.push([
    { content: 'Totale Fatture Emesse Schede Cantieri', styles: { fontStyle: 'bold' } },
    { content: formatAccountingCurrency(sumEmesse), styles: { fontStyle: 'bold' } },
  ]);
  venRows.push([
    {
      content: 'SBILANCIO RICAVI (Quadratura)',
      styles: {
        fontStyle: 'bold',
        fillColor: Math.abs(sbilancioVen) < 0.05 ? [232, 245, 233] : [255, 235, 238],
        textColor: Math.abs(sbilancioVen) < 0.05 ? [4, 120, 87] : [190, 18, 60],
      },
    },
    {
      content: formatAccountingCurrency(sbilancioVen),
      styles: {
        fontStyle: 'bold',
        fillColor: Math.abs(sbilancioVen) < 0.05 ? [232, 245, 233] : [255, 235, 238],
        textColor: Math.abs(sbilancioVen) < 0.05 ? [4, 120, 87] : [190, 18, 60],
      },
    },
  ]);

  autoTable(doc, {
    startY: mainTableFinalY + 5,
    margin: { left: 10 + halfWidth + 5, right: 10 },
    tableWidth: halfWidth,
    head: [['QUADRATURA VENDITE / RICAVI', 'IMPORTO']],
    body: venRows,
    theme: 'plain',
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.2,
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 32 },
    },
  });

  return doc;
}

/**
 * Downloads a single cantiere as PDF
 */
export function exportSingleCantierePdf(cantiere: Cantiere, dittaName?: string): void {
  const doc = buildCantierePdfDoc(cantiere, dittaName);
  const fileName = getCantiereFileName(cantiere, 'pdf');
  doc.save(fileName);
}

/**
 * Downloads the Prospetto Generale as PDF
 */
export function exportProspettoGeneralePdf(artigiano: Artigiano, dataAggiornamento?: string): void {
  const doc = buildProspettoPdfDoc(artigiano, dataAggiornamento);
  const cleanDitta = (artigiano.name || 'Impresa').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  const anno = artigiano.year || 2026;
  doc.save(`Prospetto_Generale_Cantieri_${cleanDitta}_${anno}.pdf`);
}

/**
 * Batch exports all cantieri as individual PDF files in a ZIP archive
 */
export async function exportAllCantieriPdfZip(
  cantieri: Cantiere[],
  dittaName?: string,
  year?: number
): Promise<void> {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const c of cantieri) {
    const doc = buildCantierePdfDoc(c, dittaName);
    const pdfBlob = doc.output('blob');
    let baseFileName = getCantiereFileName(c, 'pdf');

    // Handle collision if two cantieri have same city and address
    if (usedNames.has(baseFileName)) {
      const count = usedNames.get(baseFileName)! + 1;
      usedNames.set(baseFileName, count);
      baseFileName = baseFileName.replace(/\.pdf$/i, `_${count}.pdf`);
    } else {
      usedNames.set(baseFileName, 1);
    }

    zip.file(baseFileName, pdfBlob);
  }

  const cleanDitta = (dittaName || 'Impresa').replace(/[^a-zA-Z0-9]/g, '_');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Archivio_Singoli_Cantieri_PDF_${cleanDitta}_${year || 2026}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
