import React from 'react';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import { Cantiere } from '../types';
import { calculateCantiereTotals, formatCurrency, formatDateItalian } from '../utils/calculations';
import { exportSingleCantiereExcel } from '../utils/excelExport';

interface PrintableViewProps {
  cantiere: Cantiere;
  dittaName?: string;
  onBack: () => void;
}

export const PrintableView: React.FC<PrintableViewProps> = ({ cantiere, dittaName, onBack }) => {
  const totals = calculateCantiereTotals(cantiere);
  const ri = Number(cantiere.initialInventory) || 0;
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
            onClick={() => exportSingleCantiereExcel(cantiere, dittaName)}
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

      {/* Official Sheet Paper Layout */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-400 p-8 shadow-sm">
        {/* Banner */}
        <div className="border-b-2 border-slate-900 pb-3 mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              SCHEDA CANTIERE • RIEPILOGO CONTABILE
            </h1>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            Data emissione: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>

        {/* Intestazione Cantiere (Header info):
            Blocchi ben evidenziati:
            CANTIERE: [Nome Cantiere]
            DITTA: [Nome Ditta]
            CITTA': [Città]
            DEL: [Data] | ANNO: [Anno] */}
        <div className="border-2 border-slate-900 bg-slate-50 mb-6 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-300">
            <div className="p-3 border-b sm:border-b-0 sm:border-r border-slate-300 flex items-center justify-between">
              <span className="font-bold text-slate-600 uppercase text-[11px] w-24">CANTIERE:</span>
              <span className="font-black text-slate-950 text-base uppercase text-right flex-1 truncate">
                {cantiere.name.toUpperCase()}
              </span>
            </div>
            <div className="p-3 flex items-center justify-between bg-white sm:bg-transparent">
              <span className="font-bold text-slate-600 uppercase text-[11px] w-20">DITTA:</span>
              <span className="font-black text-slate-950 text-base uppercase text-right flex-1 truncate">
                {finalDitta}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="p-3 border-b sm:border-b-0 sm:border-r border-slate-300 flex items-center justify-between">
              <span className="font-bold text-slate-600 uppercase text-[11px] w-24">CITTA':</span>
              <span className="font-bold text-slate-800 uppercase text-right flex-1 truncate">
                {cantiere.city.toUpperCase()}{cantiere.address ? ` - ${cantiere.address.toUpperCase()}` : ''}
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 uppercase text-[11px]">DEL:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {new Date().toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-300">
                <span className="font-bold text-slate-600 uppercase text-[11px]">ANNO:</span>
                <span className="font-black text-slate-950 text-base font-mono">
                  {cantiere.year || 2026}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabella Movimenti Cantiere
            Colonne: DATA DOC. | N° DOC. | TIPO DOC. / FORNITORE / CLIENTE | N./PROT | ACQUISTI | EMESSE */}
        <table className="w-full text-left border-collapse text-xs mb-6 border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900 uppercase text-[10px] font-bold text-slate-900">
              <th className="p-2 border border-slate-400 text-center w-24">DATA DOC.</th>
              <th className="p-2 border border-slate-400 text-center w-24">N° DOC.</th>
              <th className="p-2 border border-slate-400">TIPO DOC. / FORNITORE / CLIENTE</th>
              <th className="p-2 border border-slate-400 text-center w-20">N./PROT</th>
              <th className="p-2 border border-slate-400 text-right w-28">ACQUISTI</th>
              <th className="p-2 border border-slate-400 text-right w-28">EMESSE</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {/* Prima riga della tabella: Riga dedicata alle RIMANENZE INIZIALI (R.I.) */}
            <tr className="bg-slate-50/70 border-b border-slate-300 font-bold">
              <td className="p-2 border border-slate-300 text-center text-slate-400">-</td>
              <td className="p-2 border border-slate-300 text-center text-slate-400">-</td>
              <td className="p-2 border border-slate-300 text-slate-950">RIMANENZE INIZIALI (R.I.)</td>
              <td className="p-2 border border-slate-300 text-center text-slate-400">-</td>
              <td className="p-2 border border-slate-300 text-right font-mono text-slate-950 font-bold">
                {ri !== 0 ? formatCurrency(ri) : '-'}
              </td>
              <td className="p-2 border border-slate-300 text-right font-mono text-slate-400">-</td>
            </tr>

            {/* Movimenti del Cantiere */}
            {cantiere.movements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/50">
                <td className="p-2 border border-slate-300 text-center font-mono text-[11px] whitespace-nowrap">
                  {formatDateItalian(m.date)}
                </td>
                <td className="p-2 border border-slate-300 text-center font-semibold font-mono">{m.docNumber || '-'}</td>
                <td className="p-2 border border-slate-300 font-medium text-slate-900">
                  {m.typeAndSubject}
                  {m.notes && <span className="block text-[10px] text-slate-500">{m.notes}</span>}
                </td>
                <td className="p-2 border border-slate-300 text-center font-mono text-[11px]">{m.protocol || '-'}</td>
                <td className="p-2 border border-slate-300 text-right font-mono">
                  {m.purchases !== 0 ? formatCurrency(m.purchases) : '-'}
                </td>
                <td className={`p-2 border border-slate-300 text-right font-mono font-bold ${m.issued < 0 ? 'text-purple-700' : 'text-slate-950'}`}>
                  {m.issued !== 0 ? formatCurrency(m.issued) : '-'}
                </td>
              </tr>
            ))}

            {/* Righe Totali finali:
                Riga 1: Totale senza RI (somma acquisti e vendite emesse dell'anno).
                Riga 2: Totale comprensivo di RI (somma totale inclusa rimanenza iniziale). */}
            <tr className="border-t-4 border-double border-slate-900 bg-slate-100 font-bold text-xs text-slate-950">
              <td className="p-2 border border-slate-400" colSpan={3}></td>
              <td className="p-2 border border-slate-400 text-right font-bold uppercase whitespace-nowrap">
                Totale senza RI
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono font-bold">
                {formatCurrency(totals.totaleAcquisti)}
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono font-bold">
                {formatCurrency(totals.totaleEmesse)}
              </td>
            </tr>

            <tr className="border-b-2 border-slate-900 bg-slate-200/90 font-black text-xs text-slate-950">
              <td className="p-2 border border-slate-400" colSpan={3}></td>
              <td className="p-2 border border-slate-400 text-right font-bold uppercase whitespace-nowrap">
                Totale comprensivo di RI
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono font-black">
                {formatCurrency(totals.totaleAcquistiConRI)}
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono font-black">
                {formatCurrency(totals.totaleEmesse)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Margine Cantiere Summary */}
        <div className="border border-slate-400 bg-slate-50 p-3.5 mb-8 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-900 uppercase">
            MARGINE / UTILE EFFETTIVO DI CANTIERE:
          </span>
          <div className="flex items-center gap-4 font-mono">
            <span className={`text-base font-extrabold ${totals.isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(totals.margineEffettivo)}
            </span>
            <span className="text-xs bg-slate-200 border border-slate-300 px-2 py-0.5 rounded font-bold text-slate-900">
              Margine: {totals.marginePercentuale}%
            </span>
          </div>
        </div>

        {/* Signature Line */}
        <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
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
