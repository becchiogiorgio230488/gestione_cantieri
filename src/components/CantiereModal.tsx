import React, { useState } from 'react';
import { X, Building, Check, MapPin } from 'lucide-react';
import { Cantiere, CantiereCategory, CantiereStatus } from '../types';
import { getTodayISODate } from '../utils/calculations';

interface CantiereModalProps {
  cantiereToEdit?: Cantiere | null;
  onClose: () => void;
  onSave: (cantiereData: Partial<Cantiere>) => void;
}

export const CantiereModal: React.FC<CantiereModalProps> = ({
  cantiereToEdit,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(cantiereToEdit);

  const [name, setName] = useState(cantiereToEdit?.name || '');
  const [city, setCity] = useState(cantiereToEdit?.city || '');
  const [address, setAddress] = useState(cantiereToEdit?.address || '');
  const date = cantiereToEdit?.date || getTodayISODate();
  const [year, setYear] = useState<number>(cantiereToEdit?.year || 2026);
  const [initialInventory, setInitialInventory] = useState<string>(
    cantiereToEdit ? cantiereToEdit.initialInventory.toString() : '0'
  );
  const [finalInventory, setFinalInventory] = useState<string>(
    cantiereToEdit ? cantiereToEdit.finalInventory.toString() : '0'
  );
  const [category, setCategory] = useState<CantiereCategory>(
    cantiereToEdit?.category || 'idraulico'
  );
  const [status, setStatus] = useState<CantiereStatus>(
    cantiereToEdit?.status || 'attivo'
  );
  const [notes, setNotes] = useState(cantiereToEdit?.notes || '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upperName = name.trim().toUpperCase();
    const upperCity = city.trim().toUpperCase();
    const upperAddress = address.trim() ? address.trim().toUpperCase() : undefined;

    if (!upperName || !upperCity) {
      setFormError('Inserisci Nome Cantiere e Città.');
      return;
    }
    setFormError(null);

    const ri = parseFloat(initialInventory.replace(',', '.')) || 0;
    const rf = parseFloat(finalInventory.replace(',', '.')) || 0;

    onSave({
      name: upperName,
      // Nome cantiere e ditta/cliente committente coincidono sempre: tieni solo nome cantiere
      client: upperName,
      city: upperCity,
      address: upperAddress,
      date,
      year: Number(year) || 2026,
      initialInventory: Math.round(ri * 100) / 100,
      finalInventory: Math.round(rf * 100) / 100,
      category,
      status,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden animate-fadeIn my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Modifica Scheda Cantiere Z-2026' : 'Nuova Scheda Cantiere Modulo 2026'}
              </h2>
              <p className="text-xs text-slate-400">
                Imposta i campi di testata: Nome Cantiere (coincide con committente), Città, Indirizzo, R.I. ed R.F.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
              {formError}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                NOME CANTIERE (COGNOME NOME IN MAIUSCOLO) *
              </label>
              <input
                type="text"
                required
                placeholder="es. ROSSI MARIO (senza scritta cantiere e senza paese tra parentesi)"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Inserire in maiuscolo il Cognome nome riportato in fattura (coincide sempre con il committente)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  CITTÀ / UBICAZIONE (IN MAIUSCOLO) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. MONZA, MILANO, TORINO"
                  value={city}
                  onChange={(e) => setCity(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  INDIRIZZO (VIA E CIVICO IN MAIUSCOLO)
                </label>
                <input
                  type="text"
                  placeholder="es. VIA GARIBALDI 42"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Riportare esclusivamente la via e il numero civico in maiuscolo, NON altre informazioni (es. dati catastali)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              <div>
                <label className="block text-slate-400 font-semibold mb-1">ANNO</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-amber-400">
                  R.I. (INIZIALI) €
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={initialInventory}
                  onChange={(e) => setInitialInventory(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-emerald-400">
                  R.F. (FINALI) €
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={finalInventory}
                  onChange={(e) => setFinalInventory(e.target.value)}
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">STATO CANTIERE</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CantiereStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="attivo">Attivo / In corso</option>
                <option value="completato">Completato / Chiuso</option>
                <option value="preventivo">Preventivo</option>
                <option value="sospeso">Sospeso</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">NOTE E DETTAGLI</label>
              <textarea
                rows={2}
                placeholder="es. Descrizione accordi con il committente, capitolato o piano di lavoro..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{isEditing ? 'Salva Modifiche' : 'Crea Scheda Cantiere'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
