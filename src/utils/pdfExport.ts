import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { Cantiere } from '../types';
import { calculateCantiereTotals, formatAccountingCurrency, formatDateItalian } from './calculations';

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
 * Builds a jsPDF document for a single cantiere matching the official visual guidelines
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
  const anno = cantiere.year || 2026;
  const finalDitta = (dittaName || 'IMPRESA').toUpperCase();

  // Header Box
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.rect(14, 12, 182, 28);

  // Row 1 inside Header Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('CANTIERE:', 18, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const cantiereTitle = (cantiere.name || '').toUpperCase();
  doc.text(cantiereTitle.length > 35 ? cantiereTitle.slice(0, 35) + '...' : cantiereTitle, 42, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DITTA:', 125, 19);
  doc.setFont('helvetica', 'bold');
  doc.text(finalDitta.length > 25 ? finalDitta.slice(0, 25) + '...' : finalDitta, 142, 19);

  // Row 2 inside Header Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("CITTA':", 18, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text((cantiere.city || '-').toUpperCase(), 42, 27);

  doc.setFont('helvetica', 'bold');
  doc.text('ANNO:', 125, 27);
  doc.setFont('helvetica', 'bold');
  doc.text(String(anno), 142, 27);

  // Row 3 inside Header Box: DEL [Nome Committente CENTRATO] | DATA [Data Stampa]
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('DEL:', 18, 35);

  const committente = (cantiere.client || cantiere.name || '').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const truncatedCommittente = committente.length > 34 ? committente.slice(0, 34) + '...' : committente;
  doc.text(truncatedCommittente, 72, 35, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('DATA:', 125, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(dataStampa, 142, 35);

  // Movements Table Rows
  const tableRows: any[] = [];

  // 1. Prima riga dedicata a RIMANENZE INIZIALI (R.I.)
  tableRows.push([
    '-',
    '-',
    'RIMANENZE INIZIALI (R.I.)',
    '-',
    formatAccountingCurrency(ri),
    '-',
  ]);

  // 2. Movimenti del cantiere
  const sortedMovements = [...(cantiere.movements || [])].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  for (const mov of sortedMovements) {
    const acqVal = Number(mov.purchases) || 0;
    const emeVal = Number(mov.issued) || 0;
    tableRows.push([
      formatDateItalian(mov.date),
      mov.docNumber || '-',
      (mov.typeAndSubject || '').toUpperCase(),
      mov.protocol || '-',
      acqVal > 0 ? formatAccountingCurrency(acqVal) : '-',
      emeVal > 0 ? formatAccountingCurrency(emeVal) : '-',
    ]);
  }

  // 3. Righe vuote per riempire l'intera pagina A4 se ci sono pochi movimenti
  const minRows = 16;
  const emptyRowsNeeded = Math.max(0, minRows - sortedMovements.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    tableRows.push(['', '', '', '', '', '']);
  }

  // AutoTable
  autoTable(doc, {
    startY: 44,
    head: [
      ['DATA DOC.', 'N° DOC.', 'TIPO DOC. / FORNITORE / CLIENTE', 'N./PROT', 'ACQUISTI', 'EMESSE'],
    ],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      lineWidth: 0.2,
      lineColor: [100, 116, 139],
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.8,
      lineWidth: 0.1,
      lineColor: [203, 213, 225],
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Style first row (RIMANENZE INIZIALI)
      if (data.row.index === 0 && data.section === 'body') {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [120, 53, 15];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Final Totals Table / Box below the main table
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 3 : 190;

  autoTable(doc, {
    startY: finalY,
    body: [
      [
        'TOTALE SENZA R.I. (Acquisti & Emesse dell\'anno)',
        formatAccountingCurrency(acqSenzaRI),
        formatAccountingCurrency(emeTot),
      ],
      [
        'TOTALE COMPRENSIVO DI R.I. (Totale inclusa R.I.)',
        formatAccountingCurrency(acqConRI),
        formatAccountingCurrency(emeTot),
      ],
    ],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.3,
      lineColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 23, 42] },
      1: { halign: 'right', cellWidth: 26, fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      2: { halign: 'right', cellWidth: 26, fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    },
  });

  const totalsFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 3 : finalY + 16;

  // Margine Cantiere Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, totalsFinalY, 182, 7.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('MARGINE / UTILE EFFETTIVO DI CANTIERE:', 18, totalsFinalY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${formatAccountingCurrency(totals.margineEffettivo)}   (Margine: ${totals.marginePercentuale}%)`, 190, totalsFinalY + 5, { align: 'right' });

  // Signatures
  const signY = totalsFinalY + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Timbro e Firma Responsabile Cantiere:', 18, signY);
  doc.line(18, signY + 8, 75, signY + 8);

  doc.text('Firma Amministrazione / Contabilità:', 130, signY);
  doc.line(130, signY + 8, 188, signY + 8);

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
