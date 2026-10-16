import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  Database,
  ExternalLink,
  Code2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { Artigiano } from '../types';
import {
  migrateAllLocalDataToSupabase,
  fetchAllArtigianiFromSupabase,
} from '../services/supabaseService';

interface SupabaseSyncModalProps {
  artigiani: Artigiano[];
  isOpen: boolean;
  onClose: () => void;
  onDataReloaded: (data: Artigiano[]) => void;
  onShowNotification: (msg: string) => void;
}

const SUPABASE_SQL_SCHEMA = `-- SCHEMA SUPABASE: GESTIONE CANTIERI & CONTABILITÀ CLIENTI
-- Esegui questo script in Supabase: Dashboard -> SQL Editor -> New query -> Run

-- 1. TABELLA ARTIGIANI / CLIENTI DELLO STUDIO
CREATE TABLE IF NOT EXISTS public.artigiani (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business_name TEXT,
    partita_iva TEXT,
    codice_fiscale TEXT,
    city TEXT DEFAULT 'Milano',
    address TEXT,
    category TEXT DEFAULT 'misto',
    phone TEXT,
    email TEXT,
    year INTEGER DEFAULT 2026,
    notes TEXT,
    quadratura JSONB DEFAULT '{}'::jsonb,
    magazzino JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. TABELLA CANTIERI
CREATE TABLE IF NOT EXISTS public.cantieri (
    id TEXT PRIMARY KEY,
    artigiano_id TEXT NOT NULL REFERENCES public.artigiani(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    date TEXT,
    year INTEGER DEFAULT 2026,
    client TEXT,
    initial_inventory NUMERIC(12,2) DEFAULT 0,
    final_inventory NUMERIC(12,2) DEFAULT 0,
    category TEXT DEFAULT 'misto',
    status TEXT DEFAULT 'attivo',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. TABELLA MOVIMENTI CONTABILI CANTIERE (Acquisti, Emesse, DDT)
CREATE TABLE IF NOT EXISTS public.movements (
    id TEXT PRIMARY KEY,
    cantiere_id TEXT NOT NULL REFERENCES public.cantieri(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    doc_number TEXT NOT NULL,
    type_and_subject TEXT NOT NULL,
    protocol TEXT,
    purchases NUMERIC(12,2) DEFAULT 0,
    issued NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    source TEXT DEFAULT 'manuale',
    xml_ref JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. TABELLA SCHEDA SOSPESI (Forniture e DDT in attesa di attribuzione)
CREATE TABLE IF NOT EXISTS public.sospesi (
    id TEXT PRIMARY KEY,
    artigiano_id TEXT NOT NULL REFERENCES public.artigiani(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    doc_number TEXT NOT NULL,
    supplier TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0,
    protocol TEXT,
    ddt_number TEXT,
    ddt_date TEXT,
    status TEXT DEFAULT 'in_attesa_cliente',
    customer_note TEXT,
    suggested_cantiere_id TEXT,
    source_file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- INDICI DI RICERCA E CHIAVI ESTERNE
CREATE INDEX IF NOT EXISTS idx_cantieri_artigiano_id ON public.cantieri(artigiano_id);
CREATE INDEX IF NOT EXISTS idx_movements_cantiere_id ON public.movements(cantiere_id);
CREATE INDEX IF NOT EXISTS idx_sospesi_artigiano_id ON public.sospesi(artigiano_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.movements(date);

-- ABILITAZIONE REALTIME (Aggiornamento istantaneo automatico)
ALTER PUBLICATION supabase_realtime ADD TABLE public.artigiani;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cantieri;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sospesi;

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.artigiani ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cantieri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sospesi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permetti accesso completo anon artigiani" ON public.artigiani FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso completo anon cantieri" ON public.cantieri FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso completo anon movements" ON public.movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso completo anon sospesi" ON public.sospesi FOR ALL USING (true) WITH CHECK (true);`;

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  artigiani,
  isOpen,
  onClose,
  onDataReloaded,
  onShowNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'sql'>('status');
  const [isCopied, setIsCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
    onShowNotification('Schema SQL copiato negli appunti!');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      if (res.success) {
        setTestResult({
          success: true,
          message: 'Connessione a Supabase riuscita! Le tabelle sono accessibili.',
        });
      } else {
        setTestResult({
          success: false,
          message: `Errore di connessione: ${res.error || 'Verifica lo schema SQL e le chiavi.'}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Impossibile contattare Supabase.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleMigrate = async () => {
    if (!isConfigured) return;
    setIsMigrating(true);
    try {
      const res = await migrateAllLocalDataToSupabase(artigiani);
      if (res.error) {
        onShowNotification(`Errore durante la migrazione: ${res.error}`);
      } else {
        onShowNotification(`Sincronizzazione completata: ${res.count} clienti migrati su Supabase!`);
      }
    } catch (err: any) {
      onShowNotification(`Errore: ${err?.message || 'Migrazione fallita'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleReload = async () => {
    if (!isConfigured) return;
    setIsReloading(true);
    try {
      const data = await fetchAllArtigianiFromSupabase();
      if (data.length > 0) {
        onDataReloaded(data);
        onShowNotification(`Dati ricaricati con successo da Supabase (${data.length} clienti trovati).`);
      } else {
        onShowNotification('Nessun dato trovato su Supabase. Puoi eseguire la migrazione per caricarli.');
      }
    } catch (err: any) {
      onShowNotification(`Errore nel caricamento: ${err?.message}`);
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full my-8 p-5 sm:p-6 shadow-2xl relative text-left"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 border-b border-slate-800 pb-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Cloud className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Integrazione Cloud Supabase
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  isConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {isConfigured ? 'Connesso • Realtime Attivo' : 'Modalità Locale'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Salvataggio automatico sul cloud PostgreSQL in tempo reale e sincronizzazione tra dispositivi senza backup manuali.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'status'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Stato e Sincronizzazione</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Schema Tabelle SQL (Supabase)</span>
          </button>
        </div>

        {/* TAB 1: STATUS & ACTIONS */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Status Card */}
            {isConfigured ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Client Supabase Configurato e Operativo</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Le variabili d'ambiente <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-emerald-300">VITE_SUPABASE_URL</code> e <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-emerald-300">VITE_SUPABASE_ANON_KEY</code> sono state rilevate con successo.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Realtime Subscriptions: Abilitate</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Autenticazione Anon Key: Attiva</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Configurazione Credenziali Supabase Necessaria</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  L'app sta attualmente salvando i dati nella memoria locale del browser (localStorage). Per collegare il tuo database Supabase, inserisci le credenziali nel file <strong className="text-white font-mono">.env</strong>:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 select-all space-y-1">
                  <div>VITE_SUPABASE_URL="https://[tuo-progetto].supabase.co"</div>
                  <div>VITE_SUPABASE_ANON_KEY="[tua-chiave-anon-pubblica]"</div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Puoi ottenere queste chiavi gratuitamente registrandoti su <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="h-3 w-3 inline" /></a> nella sezione <em>Project Settings → API</em>.
                </p>
              </div>
            )}

            {/* Test result banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!isConfigured || isTesting}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition-all border border-slate-700 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 text-emerald-400 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test Connessione</span>
              </button>

              <button
                type="button"
                onClick={handleMigrate}
                disabled={!isConfigured || isMigrating}
                className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className={`h-4 w-4 ${isMigrating ? 'animate-bounce' : ''}`} />
                <span>{isMigrating ? 'Migrazione in corso...' : 'Migra Dati su Supabase'}</span>
              </button>

              <button
                type="button"
                onClick={handleReload}
                disabled={!isConfigured || isReloading}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition-all border border-slate-700 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <Database className={`h-4 w-4 text-cyan-400 ${isReloading ? 'animate-spin' : ''}`} />
                <span>Ricarica da Cloud</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SQL SCHEMA */}
        {activeTab === 'sql' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">
                Esegui questo script nel <strong>SQL Editor</strong> di Supabase per creare le tabelle e abilitare la sincronizzazione in tempo reale:
              </p>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{isCopied ? 'Copiato!' : 'Copia SQL'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-80 overflow-y-auto leading-relaxed select-all">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 mt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
