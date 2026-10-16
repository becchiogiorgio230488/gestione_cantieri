import React, { useState } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Save,
  HelpCircle,
  FileSpreadsheet,
  Building,
  RotateCcw,
} from 'lucide-react';
import { Cantiere, QuadraturaContabile, SospesoItem } from '../types';
import { computeQuadratura, formatCurrency, getTodayISODate } from '../utils/calculations';

interface QuadraturaModalProps {
  cantieri: Cantiere[];
  sospesi: SospesoItem[];
  currentQuadratura: QuadraturaContabile;
  onClose: () => void;
  onSaveQuadratura: (updated: QuadraturaContabile) => void;
}

export const QuadraturaModal: React.FC<QuadraturaModalProps> = ({
  cantieri,
  sospesi,
  currentQuadratura,
  onClose,
  onSaveQuadratura,
}) => {
  const [mastrinoAcquisti, setMastrinoAcquisti] = useState<string>(
    currentQuadratura.mastrinoAcquisti.toString()
  );
  const [mastrinoVendite, setMastrinoVendite] = useState<string>(
    currentQuadratura.mastrinoVendite.toString()
  );
  const [notes, setNotes] = useState<string>(currentQuadratura.notes || '');

  // Compute live comparison
  const parsedAcquisti = parseFloat(mastrinoAcquisti.replace(',', '.')) || 0;
  const parsedVendite = parseFloat(mastrinoVendite.replace(',', '.')) || 0;

  const tempQuadratura: QuadraturaContabile = {
    mastrinoAcquisti: parsedAcquisti,
    mastrinoVendite: parsedVendite,
    notes,
    dataVerifica: getTodayISODate(),
  };

  const qResult = computeQuadratura(cantieri, tempQuadratura);
  const totSospesi = sospesi.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  // Consider also sospesi in the cost equation
  const totaleCostiCantieriPlusSospesi = qResult.totaleAcquistiCantieri + totSospesi;
  const sbilancioAcquistiNetto = Math.round((parsedAcquisti - totaleCostiCantieriPlusSospesi) * 100) / 100;

  const handleAutoAlign = () => {
    // Set ledger to match current cantieri + sospesi
    setMastrinoAcquisti((qResult.totaleAcquistiCantieri + totSospesi).toFixed(2));
    setMastrinoVendite(qResult.totaleEmesseCantieri.toFixed(2));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveQuadratura({
      mastrinoAcquisti: Math.round(parsedAcquisti * 100) / 100,
      mastrinoVendite: Math.round(parsedVendite * 100) / 100,
      notes: notes.trim() || undefined,
      dataVerifica: getTodayISODate(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden animate-fadeIn my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Quadratura Contabile Cantieri vs Mastri Generali</span>
                {Math.abs(sbilancioAcquistiNetto) < 0.05 && qResult.isVenditeQuadrate ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    QUADRATA
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    SBILANCIO
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Allinea la contabilità generale d'azienda (mastrini costi e ricavi) con i totali delle schede cantiere
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-5 text-xs sm:text-sm">
          {/* Explanation note */}
          <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
            <HelpCircle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Come funziona la quadratura contabile?</p>
              <p className="text-slate-400">
                Inserisci i saldi derivanti dal bilancino di verifica o dai mastrini contabili forniti dal commercialista.
                Il sistema verifica se tutti i costi registrati a bilancio aziendale trovano riscontro nei cantieri operativi o nella scheda sospesi.
              </p>
            </div>
          </div>

          {/* Form Inputs for General Ledger Mastri */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Mastrino Contabilità Generale: ACQUISTI (€)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={mastrinoAcquisti}
                onChange={(e) => setMastrinoAcquisti(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-base font-bold text-rose-300 focus:outline-none focus:border-purple-400"
              />
              <span className="text-[11px] text-slate-500 block">
                Conto 60.01 Forniture materiali e servizi di cantiere
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Mastrino Contabilità Generale: VENDITE (€)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={mastrinoVendite}
                onChange={(e) => setMastrinoVendite(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-base font-bold text-blue-300 focus:outline-none focus:border-purple-400"
              />
              <span className="text-[11px] text-slate-500 block">
                Conto 70.01 Fatturato per prestazioni e opere impiantistiche
              </span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 font-bold text-xs uppercase text-slate-300">
              Prospetto di Confronto e Calcolo Sbilanci
            </div>

            <div className="p-4 space-y-3 text-xs">
              {/* Acquisti reconciliation */}
              <div className="space-y-1.5 pb-3 border-b border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Totale Acquisti imputati nei Cantieri:</span>
                  <span className="font-mono text-white font-semibold">
                    {formatCurrency(qResult.totaleAcquistiCantieri)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Materiali nella Scheda Sospesi (da attribuire):</span>
                  <span className="font-mono text-amber-300 font-semibold">
                    + {formatCurrency(totSospesi)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>Totale Costi Cantieri + Sospesi:</span>
                  <span className="font-mono text-rose-300 font-bold">
                    {formatCurrency(totaleCostiCantieriPlusSospesi)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-slate-300">Sbilancio Acquisti (Mastrino vs Cantieri):</span>
                  <span
                    className={`font-mono text-sm ${
                      Math.abs(sbilancioAcquistiNetto) < 0.05
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {sbilancioAcquistiNetto === 0
                      ? '€ 0,00 (PERFETTO)'
                      : formatCurrency(sbilancioAcquistiNetto)}
                  </span>
                </div>
              </div>

              {/* Vendite reconciliation */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Totale Fatturato Emesso nei Cantieri:</span>
                  <span className="font-mono text-white font-semibold">
                    {formatCurrency(qResult.totaleEmesseCantieri)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-slate-300">Sbilancio Vendite (Mastrino vs Cantieri):</span>
                  <span
                    className={`font-mono text-sm ${
                      qResult.isVenditeQuadrate ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {qResult.deltaVendite === 0
                      ? '€ 0,00 (PERFETTO)'
                      : formatCurrency(qResult.deltaVendite)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes field */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1 text-xs">
              NOTE SULLA QUADRATURA CONTABILE
            </label>
            <textarea
              rows={2}
              placeholder="es. Allineamento effettuato al 31/03/2026. Lo sbilancio di € 280 corrisponde a materiale edile in attesa di DDT definitivo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-400 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleAutoAlign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              title="Imposta i mastrini pari alla somma attuale dei cantieri e sospesi"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Auto-allinea ai Cantieri</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Chiudi
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>Salva Quadratura</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
