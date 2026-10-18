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
  dataAggiornamento?: string;
  onBack: () => void;
}

export const PrintableProspettoReport: React.FC<PrintableProspettoReportProps> = ({
  artigiano,
  dataAggiornamento,
  onBack,
}) => {
  const [currentDataAggiornamento, setCurrentDataAggiornamento] = React.useState(
    dataAggiornamento || new Date().toLocaleDateString('it-IT')
  );

  let sumRI = 0;
  let sumAcquisti = 0;
  let sumEmesse = 0;
  let sumRF = 0;

  // L'elenco dei cantieri nella tabella deve essere in ordine di CITTA'
  const rawCantieri = artigiano.cantieri || [];
  const sortedCantieri = [...rawCantieri].sort((a, b) => {
    const cityA = (a.city || '').trim().toUpperCase();
    const cityB = (b.city || '').trim().toUpperCase();
    if (cityA !== cityB) {
      return cityA.localeCompare(cityB, 'it', { sensitivity: 'base' });
    }
    const addrA = (a.address || a.name || '').trim().toUpperCase();
    const addrB = (b.address || b.name || '').trim().toUpperCase();
    return addrA.localeCompare(addrB, 'it', { sensitivity: 'base' });
  });

  const rows = sortedCantieri.map((c) => {
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
  const sbilancioVen = Math.round((totMastriVen - finalEme) * 100) / 100;

  const dataStampa = new Date().toLocaleDateString('it-IT');

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
            onClick={() => exportProspettoGeneraleExcel(artigiano, undefined, undefined, currentDataAggiornamento)}
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

      {/* Official Sheet Layout */}
      <div className="max-w-5xl mx-auto bg-white border-2 border-slate-900 p-6 shadow-sm">
        {/* Banner with DITTA header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-5 flex justify-between items-start">
          <div>
            <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              DITTA: <span className="text-base font-extrabold text-slate-950">{artigiano.name.toUpperCase()}</span>
            </div>
            <div className="text-xs text-slate-800 uppercase mt-1">
              PROSPETTO GENERALE CANTIERI • ANNO {artigiano.year || 2026} • DATA DI STAMPA: {dataStampa} - CANTIERI AGGIORNATI AL{' '}
              <strong className="font-extrabold text-black text-sm">{currentDataAggiornamento}</strong>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono no-print">
            <label className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Data Aggiornamento:</label>
            <input
              type="text"
              value={currentDataAggiornamento}
              onChange={(e) => setCurrentDataAggiornamento(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded px-1.5 py-0.5 text-right w-28 bg-slate-50"
              placeholder="GG/MM/AAAA"
            />
          </div>
        </div>

        {/* Tabella Principale Cantieri con riga SOSPESI */}
        <table className="w-full text-left border-collapse text-xs mb-6 border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase text-[11px] text-slate-900">
              <th className="p-2 border border-slate-400 w-[26%]">NOME CLIENTE</th>
              <th className="p-2 border border-slate-400 w-[14%]">CITTA'</th>
              <th className="p-2 border border-slate-400 w-[24%]">INDIRIZZO</th>
              <th className="p-2 border border-slate-400 text-right w-[9%]">R.I.</th>
              <th className="p-2 border border-slate-400 text-right w-[9%]">ACQUISTI</th>
              <th className="p-2 border border-slate-400 text-right w-[9%]">EMESSE</th>
              <th className="p-2 border border-slate-400 text-right w-[9%]">R.F.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id} className="hover:bg-slate-50/50">
                <td className="p-2 border border-slate-300 font-bold text-slate-950">
                  {r.c.client ? (
                    <div>
                      <span>{r.c.client.toUpperCase()}</span>
                      <span className="block text-[10px] font-normal text-slate-500">{r.name}</span>
                    </div>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="p-2 border border-slate-300 text-slate-800">{r.city}</td>
                <td className="p-2 border border-slate-300 text-slate-800">{r.address}</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-slate-900">{formatAccountingCurrency(r.ri)}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-semibold text-slate-900">{formatAccountingCurrency(r.acquisti)}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-semibold text-slate-900">{formatAccountingCurrency(r.emesse)}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-semibold text-slate-900">{formatAccountingCurrency(r.rf)}</td>
              </tr>
            ))}

            {/* RIGA DEI SOSPESI INSERITA NELLA TABELLA PRINCIPALE */}
            <tr className="bg-amber-50/60 border-t border-b border-amber-300 font-semibold text-amber-950">
              <td className="p-2 border border-slate-300 font-bold text-amber-900">
                SOSPESI
              </td>
              <td className="p-2 border border-slate-300 text-slate-400 text-center">-</td>
              <td className="p-2 border border-slate-300 italic text-slate-700">
                FORNITURE IN ATTESA DI ATTRIBUZIONE (C/430000)
              </td>
              <td className="p-2 border border-slate-300 text-right font-mono text-slate-400">-</td>
              <td className="p-2 border border-slate-300 text-right font-mono font-bold text-amber-900">
                {formatAccountingCurrency(totSospesi)}
              </td>
              <td className="p-2 border border-slate-300 text-right font-mono text-slate-400">-</td>
              <td className="p-2 border border-slate-300 text-right font-mono text-slate-400">-</td>
            </tr>

            {/* RIGA TOTALI: Riga in grassetto con bordo marcato riportante TOTALI e la somma di cantieri + sospesi */}
            <tr className="border-t-2 border-b-2 border-slate-900 bg-slate-100 font-black text-xs text-slate-950">
              <td className="p-2 border border-slate-400 text-right uppercase tracking-wider" colSpan={3}>
                TOTALI
              </td>
              <td className="p-2 border border-slate-400 text-right font-mono">{formatAccountingCurrency(sumRI)}</td>
              <td className="p-2 border border-slate-400 text-right font-mono">{formatAccountingCurrency(finalAcq)}</td>
              <td className="p-2 border border-slate-400 text-right font-mono">{formatAccountingCurrency(sumEmesse)}</td>
              <td className="p-2 border border-slate-400 text-right font-mono">{formatAccountingCurrency(sumRF)}</td>
            </tr>
          </tbody>
        </table>

        {/* SEZIONE SOSPESI / QUADRATURA */}
        <div className="pt-2">
          <div className="bg-slate-100 border border-slate-400 px-3 py-1.5 font-black text-xs uppercase text-slate-900 mb-3 tracking-wide">
            SEZIONE QUADRATURA / SOSPESI
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="w-full md:w-[55%] space-y-4">
              {/* Acquisti Mastri */}
              <div className="border border-slate-400">
                <div className="bg-slate-50 px-2.5 py-1 font-bold text-[11px] uppercase border-b border-slate-400 text-slate-800">
                  Suddivisione Acquisti per Mastro / Categoria
                </div>
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {mastriAcq.map((m) => (
                      <tr key={m.code} className="border-b border-slate-300">
                        <td className="p-1.5 font-medium text-slate-800 uppercase">{m.code} {m.description}</td>
                        <td className="p-1.5 text-right font-mono text-slate-900">{formatAccountingCurrency(m.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-black border-t border-slate-400 bg-slate-100 text-slate-950">
                      <td className="p-1.5 text-right uppercase">TOTALE ACQUISTI</td>
                      <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(totMastriAcq)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Vendite Mastri */}
              <div className="border border-slate-400">
                <div className="bg-slate-50 px-2.5 py-1 font-bold text-[11px] uppercase border-b border-slate-400 text-slate-800">
                  Suddivisione Ricavi / Vendite
                </div>
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {mastriVen.map((m) => (
                      <tr key={m.code} className="border-b border-slate-300">
                        <td className="p-1.5 font-medium text-slate-800 uppercase">{m.code} {m.description}</td>
                        <td className="p-1.5 text-right font-mono text-slate-900">{formatAccountingCurrency(m.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-black border-t border-slate-400 bg-slate-100 text-slate-950">
                      <td className="p-1.5 text-right uppercase">TOTALE VENDITE</td>
                      <td className="p-1.5 text-right font-mono">{formatAccountingCurrency(totMastriVen)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sbilancio Box */}
            <div className="w-full md:w-[42%] flex flex-col justify-start items-end pt-1">
              <div className="border-2 border-slate-900 w-full bg-slate-50">
                <div className="grid grid-cols-2 border-b-2 border-slate-900 text-center font-black text-xs uppercase py-2 bg-slate-200 text-slate-900">
                  <div className="border-r border-slate-900 px-2">SBILANCIO ACQUISTI</div>
                  <div className="px-2">SBILANCIO RICAVI</div>
                </div>
                <div className="grid grid-cols-2 font-mono font-black text-center py-3 text-sm">
                  <div className={`border-r border-slate-900 px-2 ${sbilancioAcq !== 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {formatAccountingCurrency(sbilancioAcq)}
                  </div>
                  <div className={`px-2 ${sbilancioVen !== 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {formatAccountingCurrency(sbilancioVen)}
                  </div>
                </div>
                <div className="border-t border-slate-300 p-2 text-[10px] text-slate-600 bg-white leading-tight">
                  <div>• Sbilancio Acquisti = Totale Acquisti Quadratura - Totale Acquisti (Cantieri + Sospesi)</div>
                  <div>• Sbilancio Ricavi = Totale Vendite Quadratura - Totale Vendite Cantieri</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-8 mt-6 border-t border-slate-400 flex justify-between items-end text-xs text-slate-700">
          <div>
            <span className="font-medium">Firma Studio Contabile:</span>
            <div className="mt-6 border-b border-slate-900 w-48" />
          </div>
          <div>
            <span className="font-medium">Firma Cliente / Impresa:</span>
            <div className="mt-6 border-b border-slate-900 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
};
