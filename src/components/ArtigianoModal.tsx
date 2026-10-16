import React, { useState, useEffect } from 'react';
import { X, Building, Check, Save, Phone, Mail, MapPin } from 'lucide-react';
import { Artigiano, CantiereCategory } from '../types';

interface ArtigianoModalProps {
  artigianoToEdit?: Artigiano | null;
  onClose: () => void;
  onSave: (data: Partial<Artigiano>) => void;
}

export const ArtigianoModal: React.FC<ArtigianoModalProps> = ({
  artigianoToEdit,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [partitaIva, setPartitaIva] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [city, setCity] = useState('Milano');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<CantiereCategory>('elettrico');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [year, setYear] = useState<number>(2026);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (artigianoToEdit) {
      setName(artigianoToEdit.name);
      setBusinessName(artigianoToEdit.businessName || '');
      setPartitaIva(artigianoToEdit.partitaIva || '');
      setCodiceFiscale(artigianoToEdit.codiceFiscale || '');
      setCity(artigianoToEdit.city || 'Milano');
      setAddress(artigianoToEdit.address || '');
      setCategory(artigianoToEdit.category);
      setPhone(artigianoToEdit.phone || '');
      setEmail(artigianoToEdit.email || '');
      setYear(artigianoToEdit.year || 2026);
      setNotes(artigianoToEdit.notes || '');
    } else {
      setName('');
      setBusinessName('');
      setPartitaIva('');
      setCodiceFiscale('');
      setCity('Milano');
      setAddress('');
      setCategory('elettrico');
      setPhone('');
      setEmail('');
      setYear(2026);
      setNotes('');
    }
    setFormError(null);
  }, [artigianoToEdit]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Inserisci il Nome o Cognome dell\'Artigiano per salvare.');
      return;
    }
    setFormError(null);

    onSave({
      name: name.trim(),
      businessName: businessName.trim() || undefined,
      partitaIva: partitaIva.trim() || undefined,
      codiceFiscale: codiceFiscale.trim() || undefined,
      city: city.trim(),
      address: address.trim() || undefined,
      category,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      year: Number(year) || 2026,
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
                {artigianoToEdit ? 'Modifica Anagrafica Artigiano' : 'Nuovo Cliente / Artigiano'}
              </h2>
              <p className="text-xs text-slate-400">
                {artigianoToEdit
                  ? 'Aggiorna i dati identificativi e contabili'
                  : 'Aggiungi un artigiano o impresa per gestirne cantieri e prospetto'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nome / Riferimento Artigiano *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Sirna Massimo"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Settore / Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CantiereCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="elettrico">Elettrico &amp; Domotica</option>
                <option value="idraulico">Idraulico &amp; Termoidraulica</option>
                <option value="edile">Edile &amp; Muratore</option>
                <option value="misto">Impiantistica Mista</option>
                <option value="altro">Altro Settore</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Ragione Sociale Completa (Ditta Individuale / S.r.l.)
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="es. Sirna Massimo - Impianti Elettrici e Domotica"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Partita IVA
              </label>
              <input
                type="text"
                value={partitaIva}
                onChange={(e) => setPartitaIva(e.target.value)}
                placeholder="es. 08849120155"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Codice Fiscale
              </label>
              <input
                type="text"
                value={codiceFiscale}
                onChange={(e) => setCodiceFiscale(e.target.value)}
                placeholder="es. SRNMSM78H12F205W"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                Indirizzo Sede / Officina
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="es. Via Andrea Doria 17"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Città
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="es. Milano"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Telefono / Cellulare
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="es. +39 335 1234567"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="es. info@sirnaimpianti.it"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Note Contabili / Descrizione Attività
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note interne sullo studio contabile, regime fiscale, convenzioni fornitori..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{artigianoToEdit ? 'Salva Modifiche' : 'Crea Artigiano'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
