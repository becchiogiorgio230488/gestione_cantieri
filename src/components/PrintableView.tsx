import React from 'react';
import { Printer, ArrowLeft, Download, FileText } from 'lucide-react';
import { Cantiere } from '../types';
import { calculateCantiereTotals, formatCurrency, formatDateItalian } from '../utils/calculations';
import { exportSingleCantiereExcel } from '../utils/excelExport';
import { exportSingleCantierePdf } from '../utils/pdfExport';

interface PrintableViewProps {
  cantiere: Cantiere;
  dittaName?: string;
  onBack: () => void;
}

export const PrintableView: React.FC<PrintableViewProps> = ({ cantiere, dittaName, onBack }) => {
  const totals = calculateCantiereTotals(cantiere);
  const ri = Number(cantiere.initialInventory) || 0;
  const finalDitta = (dittaName || 'IMPRESA').toUpperCase();
  const committenteNome = (cantiere.client || cantiere.name || '').toUpperCase();
  const nomeCantiere = (cantiere.name || '').toUpperCase();
  const cittaCantiere = (cantiere.city || '').toUpperCase();
  const indirizzoCantiere = (cantiere.address || '').toUpperCase();
  const fullLoc = indirizzoCantiere ? `${cittaCantiere} - ${indirizzoCantiere}` : cittaCantiere;
  const anno = cantiere.year || 2026;
  const dataStampa = new Date().toLocaleDateString('it-IT');
  const percSign = totals.marginePercentuale >= 0 ? '+' : '';
  const percFormatted = `${percSign}${totals.marginePercentuale}%`;

  const movements = Array.isArray(cantiere.movements) ? cantiere.movements : [];
  const minRows = 37;
  const emptyRowsCount = Math.max(0, minRows - movements.length);

  return (
    <div className="bg-slate-950 min-h-screen p-4 sm:p-8 font-sans print:bg-white print:p-0 print:min-h-0 text-slate-100 print:text-black">
      {/* Print Controls (Hidden on print) */}
      <div className="no-print max-w-4xl mx-auto mb-6 p-4 bg-slate-900 border border-slate-800 text-white rounded-xl flex items-center justify-between shadow-lg">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Torna all'Applicazione</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportSingleCantiereExcel(cantiere, dittaName)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            title="Scarica file Excel (.xlsx)"
          >
            <Download className="h-4 w-4" />
            <span>Salva Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportSingleCantierePdf(cantiere, dittaName)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            title="Scarica file PDF (.pdf) direttamente generato come l'XLS"
          >
            <FileText className="h-4 w-4" />
            <span>Scarica PDF Diretto</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black cursor-pointer shadow transition-all"
            title="Stampa su carta o salva come PDF dal browser"
          >
            <Printer className="h-4 w-4" />
            <span>Stampa / PDF Browser</span>
          </button>
        </div>
      </div>

      {/* Official Sheet Paper Layout (Matching Excel XLS layout) */}
      <div className="max-w-4xl mx-auto bg-white text-black border border-black p-6 sm:p-7 print:p-0 print:border-none shadow-sm print:shadow-none print:w-full print:max-w-none">
        {/* Intestazione Cantiere (4 Righe identiche a Excel XLS) */}
        <table className="w-full border-collapse text-xs mb-3 border border-black">
          <tbody>
            {/* Riga 1: CANTIERE | NOME | DITTA | DITTA NOME */}
            <tr className="border-b border-black">
              <td className="w-24 bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                CANTIERE:
              </td>
              <td className="p-1.5 font-bold text-center border-r border-black uppercase text-sm" colSpan={3}>
                {nomeCantiere}
              </td>
              <td className="w-20 bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                DITTA:
              </td>
              <td className="w-44 p-1.5 font-bold text-center uppercase text-xs">
                {finalDitta}
              </td>
            </tr>

            {/* Riga 2: CITTA' | LOCALITA' | ANNO | ANNO NUM */}
            <tr className="border-b border-black">
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                CITTA':
              </td>
              <td className="p-1.5 font-bold text-center border-r border-black uppercase text-xs" colSpan={3}>
                {fullLoc}
              </td>
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                ANNO:
              </td>
              <td className="p-1.5 font-bold text-center font-mono text-xs">
                {anno}
              </td>
            </tr>

            {/* Riga 3: DEL | COMMITTENTE | DATA | DATA STAMPA */}
            <tr className="border-b border-black">
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                DEL:
              </td>
              <td className="p-1.5 font-bold text-center border-r border-black uppercase text-xs" colSpan={3}>
                {committenteNome}
              </td>
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                DATA:
              </td>
              <td className="p-1.5 font-bold text-center font-mono text-xs">
                {dataStampa}
              </td>
            </tr>

            {/* Riga 4: % UTILE | MARGINE % | UTILE EFF. | IMPORTO € */}
            <tr>
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                % UTILE:
              </td>
              <td
                className={`p-1.5 font-black text-center border-r border-black text-sm ${
                  totals.isPositive ? 'bg-[#E8F5E9] text-[#047857]' : 'bg-[#FFEBEE] text-[#BE123C]'
                }`}
                colSpan={3}
              >
                {percFormatted}
              </td>
              <td className="bg-[#F2F2F2] p-1.5 font-bold text-center border-r border-black uppercase text-[10px]">
                UTILE EFF.:
              </td>
              <td
                className={`p-1.5 font-black text-center font-mono text-xs ${
                  totals.isPositive ? 'bg-[#E8F5E9] text-[#047857]' : 'bg-[#FFEBEE] text-[#BE123C]'
                }`}
              >
                {formatCurrency(totals.margineEffettivo)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tabella Movimenti Cantiere
            Colonne: DATA DOC. | N° DOC. | TIPO DOC. / FORNITORE / CLIENTE | N./PROT | ACQUISTI | EMESSE */}
        <table className="w-full text-left border-collapse text-xs mb-3 border border-black">
          <thead>
            <tr className="bg-[#EAEAEA] border-b border-black uppercase text-[10px] font-bold text-black">
              <th className="p-1.5 border border-black text-center w-24">DATA DOC.</th>
              <th className="p-1.5 border border-black text-center w-24">N° DOC.</th>
              <th className="p-1.5 border border-black">TIPO DOC. / FORNITORE / CLIENTE</th>
              <th className="p-1.5 border border-black text-center w-20">N./PROT</th>
              <th className="p-1.5 border border-black text-right w-28">ACQUISTI</th>
              <th className="p-1.5 border border-black text-right w-28">EMESSE</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {/* Prima riga della tabella: RIMANENZE INIZIALI (R.I.) */}
            <tr className="border-b border-black font-bold">
              <td className="p-1.5 border border-black text-center">-</td>
              <td className="p-1.5 border border-black text-center">-</td>
              <td className="p-1.5 border border-black text-black font-bold">RIMANENZE INIZIALI (R.I.)</td>
              <td className="p-1.5 border border-black text-center">-</td>
              <td className="p-1.5 border border-black text-right font-mono text-black font-bold">
                {ri !== 0 ? formatCurrency(ri) : '-'}
              </td>
              <td className="p-1.5 border border-black text-right font-mono text-black">-</td>
            </tr>

            {/* Movimenti del Cantiere */}
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-black">
                <td className="p-1.5 border border-black text-center font-mono text-[11px] whitespace-nowrap">
                  {formatDateItalian(m.date)}
                </td>
                <td className="p-1.5 border border-black text-center font-semibold font-mono">{m.docNumber || '-'}</td>
                <td className="p-1.5 border border-black font-medium text-black">
                  {m.typeAndSubject}
                  {m.notes && <span className="block text-[10px] text-slate-600">{m.notes}</span>}
                </td>
                <td className="p-1.5 border border-black text-center font-mono text-[11px]">{m.protocol || '-'}</td>
                <td className="p-1.5 border border-black text-right font-mono">
                  {m.purchases !== 0 ? formatCurrency(m.purchases) : '-'}
                </td>
                <td className={`p-1.5 border border-black text-right font-mono font-bold ${m.issued < 0 ? 'text-purple-700' : 'text-black'}`}>
                  {m.issued !== 0 ? formatCurrency(m.issued) : '-'}
                </td>
              </tr>
            ))}

            {/* Righe vuote per avere almeno 37 righe fisse come nel foglio Excel */}
            {emptyRowsCount > 0 &&
              Array.from({ length: emptyRowsCount }).map((_, idx) => (
                <tr key={`empty-row-${idx}`} className="h-5 border-b border-black">
                  <td className="p-1 border border-black text-center text-transparent select-none">&nbsp;</td>
                  <td className="p-1 border border-black text-center text-transparent select-none">&nbsp;</td>
                  <td className="p-1 border border-black text-transparent select-none">&nbsp;</td>
                  <td className="p-1 border border-black text-center text-transparent select-none">&nbsp;</td>
                  <td className="p-1 border border-black text-right text-transparent select-none">&nbsp;</td>
                  <td className="p-1 border border-black text-right text-transparent select-none">&nbsp;</td>
                </tr>
              ))}

            {/* Righe Totali finali (Celle A-D unite, allineate a sinistra con indent e bordi sottili come Excel) */}
            <tr className="border-b border-black font-bold text-xs text-black">
              <td className="p-1.5 border border-black text-left font-bold pl-3" colSpan={4}>
                Totale senza RI
              </td>
              <td className="p-1.5 border border-black text-right font-mono font-bold bg-[#F2F2F2]">
                {formatCurrency(totals.totaleAcquisti)}
              </td>
              <td className="p-1.5 border border-black text-right font-mono font-bold bg-[#F2F2F2]">
                {formatCurrency(totals.totaleEmesse)}
              </td>
            </tr>

            <tr className="border-b border-black font-black text-xs text-black">
              <td className="p-1.5 border border-black text-left font-bold pl-3" colSpan={4}>
                Totale comprensivo di RI
              </td>
              <td className="p-1.5 border border-black text-right font-mono font-black bg-[#E6E6E6]">
                {formatCurrency(totals.totaleAcquistiConRI)}
              </td>
              <td className="p-1.5 border border-black text-right font-mono font-black bg-[#E6E6E6]">
                {formatCurrency(totals.totaleEmesse)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
