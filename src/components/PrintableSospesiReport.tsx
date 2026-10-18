import React from 'react';
import { ArrowLeft, Printer, Download, Clock } from 'lucide-react';
import { SospesoItem } from '../types';
import { formatCurrency, formatDateItalian } from '../utils/calculations';
import { exportSospesiExcel } from '../utils/excelExport';

interface PrintableSospesiReportProps {
  sospesi: SospesoItem[];
  dittaName?: string;
  onBack: () => void;
}

export const PrintableSospesiReport: React.FC<PrintableSospesiReportProps> = ({
  sospesi,
  dittaName,
  onBack,
}) => {
  const totSospesi = sospesi.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const finalDitta = (dittaName || 'IMPRESA').toUpperCase();

  return (
    <div className="bg-white text-black min-h-screen p-6 sm:p-10 font-sans">
      {/* Print Controls (Hidden on print) */}
      <div className="no-print max-w-4xl mx-auto mb-8 p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-lg">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Torna all'Applicazione</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSospesiExcel(sospesi, dittaName)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Salva Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black cursor-pointer shadow"
          >
            <Printer className="h-4 w-4" />
            <span>Stampa Report per Cliente (PDF)</span>
          </button>
        </div>
      </div>

      {/* Official Paper Layout */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-400 p-8 shadow-sm">
        {/* Header ditta: Riporta in alto il nome della ditta e il titolo SCHEDA SOSPESI / FORNITURE IN ATTESA */}
        <div className="border-b-2 border-slate-900 pb-3 mb-5 flex justify-between items-start">
          <div>
            <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              DITTA: <span className="text-base font-extrabold text-slate-950">{finalDitta}</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase mt-0.5">
              SCHEDA SOSPESI / FORNITURE IN ATTESA
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Riepilogo documenti di trasporto e fatture fornitore da imputare ai rispettivi cantieri
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            Data emissione: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>

        {/* Tabella Sospesi
            Colonne: DATA | N. FATTURA | FORNITORE | NS. PROT. | IMPORTO | DESCRIZIONE
            Allineamento centrato per Data, N. Fattura e Prot.; allineamento a destra per Importo. */}
        <table className="w-full text-left border-collapse text-xs mb-6 border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900 uppercase text-[10px] font-bold text-slate-900">
              <th className="p-2 border border-slate-400 text-center w-24">DATA</th>
              <th className="p-2 border border-slate-400 text-center w-24">N. FATTURA</th>
              <th className="p-2 border border-slate-400 w-44">FORNITORE</th>
              <th className="p-2 border border-slate-400 text-center w-20">NS. PROT.</th>
              <th className="p-2 border border-slate-400 text-right w-28">IMPORTO</th>
              <th className="p-2 border border-slate-400">DESCRIZIONE</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {sospesi.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500 italic border border-slate-300">
                  Nessuna fornitura attualmente in sospeso.
                </td>
              </tr>
            ) : (
              sospesi.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="p-2 border border-slate-300 text-center font-mono text-[11px] whitespace-nowrap">
                    {formatDateItalian(s.date)}
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-semibold font-mono">
                    {s.docNumber || '-'}
                  </td>
                  <td className="p-2 border border-slate-300 font-medium text-slate-900">
                    <div>{s.supplier}</div>
                    {s.ddtNumber && (
                      <div className="text-[10px] text-slate-500 font-mono">DDT: {s.ddtNumber}</div>
                    )}
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono text-[11px]">
                    {s.protocol || '-'}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold whitespace-nowrap text-slate-950">
                    {formatCurrency(s.amount)}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-700">
                    <div>{s.description || '-'}</div>
                    {s.customerNote && (
                      <div className="text-[10px] text-amber-800 font-medium mt-0.5">Nota: {s.customerNote}</div>
                    )}
                  </td>
                </tr>
              ))
            )}

            {/* Riga Totale: In fondo alla tabella, riga in grassetto con TOTALE: e la somma della colonna IMPORTO */}
            <tr className="border-t-4 border-double border-slate-900 bg-slate-100 font-black text-xs text-slate-950">
              <td className="p-2 border border-slate-400 text-right font-black uppercase tracking-wider" colSpan={4}>
                TOTALE:
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono font-black text-sm text-slate-950">
                {formatCurrency(totSospesi)}
              </td>
              <td className="p-2 border border-slate-400 text-slate-500 text-[10px]">
                {sospesi.length} voci sospese
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-12 pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div>
            <span>Timbro / Firma Amministrazione:</span>
            <div className="mt-8 border-b border-slate-400 w-48" />
          </div>
          <div>
            <span>Firma per approvazione Committente / Capo-cantiere:</span>
            <div className="mt-8 border-b border-slate-400 w-56" />
          </div>
        </div>
      </div>
    </div>
  );
};
