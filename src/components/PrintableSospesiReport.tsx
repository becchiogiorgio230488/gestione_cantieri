import React from 'react';
import { ArrowLeft, Printer, Download, Clock } from 'lucide-react';
import { SospesoItem } from '../types';
import { formatCurrency, formatDateItalian } from '../utils/calculations';
import { exportSospesiExcel } from '../utils/excelExport';

interface PrintableSospesiReportProps {
  sospesi: SospesoItem[];
  onBack: () => void;
}

export const PrintableSospesiReport: React.FC<PrintableSospesiReportProps> = ({
  sospesi,
  onBack,
}) => {
  const totSospesi = sospesi.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

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
            onClick={() => exportSospesiExcel(sospesi)}
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
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 p-8 shadow-sm">
        {/* Banner */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Z CANTIERI • REPORT DDT E MATERIALI IN SOSPESO
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Modulo di attribuzione e verifica per il committente / capo-cantiere
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            Data emissione: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>

        {/* Notice box */}
        <div className="p-3.5 mb-6 border border-slate-300 bg-slate-50 rounded text-xs text-slate-700 space-y-1">
          <p className="font-bold text-slate-900">Gentile Committente / Responsabile Lavori:</p>
          <p>
            Di seguito si riepilogano i materiali e i Documenti di Trasporto (DDT) acquistati dai fornitori specializzati,
            per i quali si richiede conferma della destinazione d'uso (cantiere/alloggio di pertinenza) ai fini della corretta imputazione contabile.
          </p>
        </div>

        {/* Table */}
        <table className="w-full text-left border-collapse text-xs mb-6 border border-slate-300">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-300 uppercase text-[10px] font-bold text-slate-800">
              <th className="p-2 border-r border-slate-300 w-20">DATA</th>
              <th className="p-2 border-r border-slate-300 w-20">N° DOC.</th>
              <th className="p-2 border-r border-slate-300 w-32">TIPO DOC. / FORNITORE</th>
              <th className="p-2 border-r border-slate-300 w-24">CLIENTE</th>
              <th className="p-2 border-r border-slate-300 w-20">N./PROT</th>
              <th className="p-2 border-r border-slate-300 text-right w-20">IMPORTO (€)</th>
              <th className="p-2 border-r border-slate-300">NOTE PER IL CLIENTE</th>
              <th className="p-2 w-44 text-center bg-slate-100">DESTINAZIONE CANTIERE (A CURA COMMITTENTE)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {sospesi.map((s) => (
              <tr key={s.id}>
                <td className="p-2 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                  {formatDateItalian(s.date)}
                </td>
                <td className="p-2 border-r border-slate-200 font-semibold font-mono">{s.docNumber}</td>
                <td className="p-2 border-r border-slate-200">
                  <div className="font-bold">{s.supplier}</div>
                  {s.ddtNumber && (
                    <div className="text-[10px] text-slate-600 font-mono">DDT: {s.ddtNumber}</div>
                  )}
                  <div className="text-[10px] text-slate-500 line-clamp-1">{s.description}</div>
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-700">{s.client || '-'}</td>
                <td className="p-2 border-r border-slate-200 font-mono text-slate-700">{s.protocol || '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono font-bold whitespace-nowrap">
                  {formatCurrency(s.amount)}
                </td>
                <td className="p-2 border-r border-slate-200">
                  {s.customerNote ? (
                    <span className="text-[11px] text-slate-800">{s.customerNote}</span>
                  ) : (
                    <span className="text-slate-400 italic text-[10px]">-</span>
                  )}
                </td>
                <td className="p-2 border-slate-200 text-center bg-slate-50/50">
                  <div className="border-b border-dotted border-slate-400 h-6 mt-1" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border border-slate-400 bg-slate-50 p-4 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-900 uppercase">
            TOTALE MATERIALI SOSPESI DA CONFERMARE ({sospesi.length} voci):
          </span>
          <span className="text-base font-black font-mono text-slate-900">
            {formatCurrency(totSospesi)}
          </span>
        </div>

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
