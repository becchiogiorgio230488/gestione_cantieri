import React from 'react';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import { Cantiere } from '../types';
import { calculateCantiereTotals, formatCurrency, formatDateItalian } from '../utils/calculations';
import { exportSingleCantiereExcel } from '../utils/excelExport';

interface PrintableViewProps {
  cantiere: Cantiere;
  onBack: () => void;
}

export const PrintableView: React.FC<PrintableViewProps> = ({ cantiere, onBack }) => {
  const totals = calculateCantiereTotals(cantiere);

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
            onClick={() => exportSingleCantiereExcel(cantiere)}
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
            <span>Stampa / Salva in PDF</span>
          </button>
        </div>
      </div>

      {/* Official Z-Cantieri 2026 Paper Layout */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 p-8 shadow-sm">
        {/* Banner */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Z CANTIERI MODULO 2026 • SCHEDA CANTIERE
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Riepilogo contabile movimenti fornitori, fatture emesse e margine di cantiere
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            Data stampa: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>

        {/* Header Block (7 Fields) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 p-4 border border-slate-300 bg-slate-50 text-xs sm:text-sm">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block">CANTIERE:</span>
            <span className="font-bold text-slate-900 text-base uppercase">{cantiere.name.toUpperCase()}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block">CITTÀ &amp; INDIRIZZO:</span>
            <span className="font-semibold text-slate-800 uppercase">
              {cantiere.city.toUpperCase()} {cantiere.address ? `- ${cantiere.address.toUpperCase()}` : ''}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block">ANNO FISCALE:</span>
            <span className="font-bold text-slate-900">{cantiere.year}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                R.I. (INIZIALI):
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(cantiere.initialInventory)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                R.F. (FINALI):
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(cantiere.finalInventory)}
              </span>
            </div>
          </div>
        </div>

        {/* Movements Table */}
        <table className="w-full text-left border-collapse text-xs mb-6 border border-slate-300">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-300 uppercase text-[10px] font-bold text-slate-800">
              <th className="p-2 border-r border-slate-300 w-24">DATA DOC.</th>
              <th className="p-2 border-r border-slate-300 w-28">N° DOC.</th>
              <th className="p-2 border-r border-slate-300">TIPO DOC. / FORNITORE / CLIENTE</th>
              <th className="p-2 border-r border-slate-300 w-24">N./PROT</th>
              <th className="p-2 border-r border-slate-300 text-right w-28">ACQUISTI (€)</th>
              <th className="p-2 text-right w-28">EMESSE (€)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {cantiere.movements.map((m) => (
              <tr key={m.id}>
                <td className="p-2 border-r border-slate-200 font-mono text-[11px]">
                  {formatDateItalian(m.date)}
                </td>
                <td className="p-2 border-r border-slate-200 font-medium">{m.docNumber}</td>
                <td className="p-2 border-r border-slate-200 font-medium">
                  {m.typeAndSubject}
                  {m.notes && <span className="block text-[10px] text-slate-500">{m.notes}</span>}
                </td>
                <td className="p-2 border-r border-slate-200 font-mono text-[11px]">{m.protocol || '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono">
                  {m.purchases > 0 ? formatCurrency(m.purchases) : '-'}
                </td>
                <td className="p-2 text-right font-mono font-bold">
                  {m.issued > 0 ? formatCurrency(m.issued) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Official Totals Section */}
        <div className="border border-slate-400 bg-slate-50 p-4 space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-300 font-medium">
            <span className="font-bold text-slate-800 uppercase">TOTALE SENZA R.I.:</span>
            <div className="flex gap-6 font-mono">
              <span>Acquisti: {formatCurrency(totals.totaleAcquisti)}</span>
              <span>Emesse: {formatCurrency(totals.totaleEmesse)}</span>
              <span className="font-bold">Margine: {formatCurrency(totals.margineSenzaRI)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-300 font-medium">
            <span className="font-bold text-slate-800 uppercase">TOTALE COMPRENSIVO DI R.I. &amp; R.F.:</span>
            <div className="flex gap-6 font-mono">
              <span>Costi con R.I.: {formatCurrency(totals.totaleAcquistiConRI)}</span>
              <span>Rimanenze Finali: + {formatCurrency(totals.finalInventory)}</span>
              <span className="font-bold">Utile Netto Effettivo: {formatCurrency(totals.margineEffettivo)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 text-sm font-bold">
            <span className="uppercase text-slate-900">MARGINE / UTILE DI CANTIERE:</span>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-base font-extrabold">{formatCurrency(totals.margineEffettivo)}</span>
              <span className="text-xs bg-slate-200 px-2 py-0.5 rounded font-bold">
                Margine %: {totals.marginePercentuale}%
              </span>
            </div>
          </div>
        </div>

        {/* Signature Line */}
        <div className="mt-12 pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div>
            <span>Timbro e Firma Responsabile Cantiere:</span>
            <div className="mt-8 border-b border-slate-400 w-48" />
          </div>
          <div>
            <span>Firma Amministrazione / Contabilità:</span>
            <div className="mt-8 border-b border-slate-400 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
};
