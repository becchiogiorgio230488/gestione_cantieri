import React from 'react';
import { ArrowLeft, Printer, Download, Building } from 'lucide-react';
import { Artigiano } from '../types';
import {
  calculateCantiereTotals,
  computeCantiereRF,
  formatAccountingCurrency,
} from '../utils/calculations';
import { exportProspettoGeneraleExcel } from '../utils/excelExport';

interface PrintableProspettoReportProps {
  artigiano: Artigiano;
  onBack: () => void;
}

export const PrintableProspettoReport: React.FC<PrintableProspettoReportProps> = ({
  artigiano,
  onBack,
}) => {
  let sumRI = 0;
  let sumAcquisti = 0;
  let sumEmesse = 0;
  let sumRF = 0;

  const rows = (artigiano.cantieri || []).map((c) => {
    const t = calculateCantiereTotals(c);
    const ri = Number(c.initialInventory) || 0;
    const acq = t.totaleAcquisti;
    const eme = t.totaleEmesse;
    const rf = computeCantiereRF(ri, acq, eme);

    sumRI += ri;
    sumAcquisti += acq;
    sumEmesse += eme;
    sumRF += rf;

    return {
      c,
      name: (c.name || 'CANTIERE').toUpperCase(),
      city: (c.city || '').toUpperCase(),
      address: (c.address || '').toUpperCase(),
      ri,
      acquisti: acq,
      emesse: eme,
      rf,
    };
  });

  const totSospesi = (artigiano.sospesi || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const finalRI = sumRI;
  const finalAcq = sumAcquisti + totSospesi;
  const finalEme = sumEmesse;
  const finalRF = sumRF;

  // Quadratura mastrini
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
  const ricaviTabella = finalEme + finalRF - finalRI;
  const sbilancioVen = Math.round((totMastriVen - ricaviTabella) * 100) / 100;

  return (
    <div className="bg-white text-black min-h-screen p-6 sm:p-10 font-sans">
      {/* Controls (hidden on print) */}
      <div className="no-print max-w-5xl mx-auto mb-8 p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-lg">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Torna al Prospetto Interattivo</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportProspettoGeneraleExcel(artigiano)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Salva Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black cursor-pointer shadow"
          >
            <Printer className="h-4 w-4" />
            <span>Stampa PDF / A4</span>
          </button>
        </div>
      </div>

      {/* Official Sheet Layout mirroring esempio.png */}
      <div className="max-w-5xl mx-auto bg-white border-2 border-black p-6 shadow-sm">
        {/* Banner */}
        <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black tracking-tight text-black uppercase">
              PROSPETTO CANTIERI • {artigiano.name.toUpperCase()}
            </h1>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            <div>Data: {new Date().toLocaleDateString('it-IT')}</div>
          </div>
        </div>

        {/* Table exactly as in esempio.png */}
        <table className="w-full text-left border-collapse text-xs mb-4 border border-black">
          <thead>
            <tr className="bg-white border-b-2 border-black font-bold uppercase text-[11px]">
              <th className="p-2 border border-black w-[28%]">NOME CANTIERE</th>
              <th className="p-2 border border-black w-[14%]">CITTA'</th>
              <th className="p-2 border border-black w-[24%]">INDIRIZZO</th>
              <th className="p-2 border border-black text-right w-[9%]">R.I.</th>
              <th className="p-2 border border-black text-right w-[9%]">ACQUISTI</th>
              <th className="p-2 border border-black text-right w-[9%]">EMESSE</th>
              <th className="p-2 border border-black text-right w-[9%]">R.F.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id}>
                <td className="p-2 border border-black font-bold text-black">{r.name}</td>
                <td className="p-2 border border-black">{r.city}</td>
                <td className="p-2 border border-black">{r.address}</td>
                <td className="p-2 border border-black text-right font-mono">{formatAccountingCurrency(r.ri)}</td>
                <td className="p-2 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(r.acquisti)}</td>
                <td className="p-2 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(r.emesse)}</td>
                <td className="p-2 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(r.rf)}</td>
              </tr>
            ))}

            {/* Separator row */}
            <tr className="h-2">
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
            </tr>

            {/* Section SOSPESI */}
            <tr>
              <td className="p-1.5 border border-black"></td>
              <td className="p-1.5 border border-black font-bold underline uppercase" rowSpan={3}>SOSPESI</td>
              <td className="p-1.5 border border-black font-bold text-right uppercase">C/430000 ACQUISTI MERCI</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(totSospesi)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-black"></td>
              <td className="p-1.5 border border-black font-bold text-right uppercase">C/441120 LAVORAZIONI DI TERZI</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
            </tr>
            <tr>
              <td className="p-1.5 border border-black"></td>
              <td className="p-1.5 border border-black font-bold text-right uppercase">C/450200 LOCAZIONI PASSIVE ALTRI BENI</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono font-semibold">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
              <td className="p-1.5 border border-black text-right font-mono">{formatAccountingCurrency(0)}</td>
            </tr>

            {/* Row TOTALI */}
            <tr className="border-t-2 border-black font-black text-xs">
              <td className="p-2 border border-black"></td>
              <td className="p-2 border border-black"></td>
              <td className="p-2 border border-black text-right uppercase tracking-wider">TOTALI</td>
              <td className="p-2 border border-black text-right font-mono">{formatAccountingCurrency(finalRI)}</td>
              <td className="p-2 border border-black text-right font-mono">{formatAccountingCurrency(finalAcq)}</td>
              <td className="p-2 border border-black text-right font-mono">{formatAccountingCurrency(finalEme)}</td>
              <td className="p-2 border border-black text-right font-mono">{formatAccountingCurrency(finalRF)}</td>
            </tr>
          </tbody>
        </table>

        {/* Section QUADRATURA */}
        <div className="pt-2">
          <div className="flex justify-between items-start gap-6">
            <div className="w-[50%] space-y-3">
              <div className="font-black text-sm uppercase">QUADRATURA</div>

              {/* Acquisti */}
              <div className="border border-black">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {mastriAcq.map((m) => (
                      <tr key={m.code} className="border-b border-black">
                        <td className="p-1.5 font-bold uppercase">{m.code} {m.description}</td>
                        <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(m.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-black border-t border-black bg-slate-50">
                      <td className="p-1.5 text-right uppercase">TOTALE ACQUISTI</td>
                      <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(totMastriAcq)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Vendite */}
              <div className="border border-black">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {mastriVen.map((m) => (
                      <tr key={m.code} className="border-b border-black">
                        <td className="p-1.5 font-bold uppercase">{m.code} {m.description}</td>
                        <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(m.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-black border-t border-black bg-slate-50">
                      <td className="p-1.5 text-right uppercase">TOTALE VENDITE</td>
                      <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(totMastriVen)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sbilancio Box in Bottom Right */}
            <div className="w-[45%] flex flex-col justify-end items-end pt-8">
              <div className="border-2 border-black w-80">
                <div className="grid grid-cols-2 border-b-2 border-black text-center font-black text-xs uppercase py-1.5">
                  <div className="border-r border-black px-2">SBILANCIO ACQUISTI</div>
                  <div className="px-2">SBILANCIO RICAVI</div>
                </div>
                <div className="grid grid-cols-2 font-mono font-bold text-center py-2 text-sm">
                  <div className="border-r border-black px-2">{formatAccountingCurrency(sbilancioAcq)}</div>
                  <div className="px-2">{formatAccountingCurrency(sbilancioVen)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-8 mt-6 border-t border-black flex justify-between items-end text-xs text-slate-700">
          <div>
            <span>Firma Studio Contabile:</span>
            <div className="mt-6 border-b border-black w-48" />
          </div>
          <div>
            <span>Firma Cliente / Impresa:</span>
            <div className="mt-6 border-b border-black w-48" />
          </div>
        </div>
      </div>
    </div>
  );
};
