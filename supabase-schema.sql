-- ==============================================================================
-- SCHEMA SUPABASE: GESTIONE CANTIERI & CONTABILITÀ CLIENTI
-- Esegui questo script nell'Editor SQL di Supabase (SQL Editor -> New Query)
-- ==============================================================================

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

-- INDICI PER PERFORMANCE OTTIMALI NELLE QUERY RELAZIONALI
CREATE INDEX IF NOT EXISTS idx_cantieri_artigiano_id ON public.cantieri(artigiano_id);
CREATE INDEX IF NOT EXISTS idx_movements_cantiere_id ON public.movements(cantiere_id);
CREATE INDEX IF NOT EXISTS idx_sospesi_artigiano_id ON public.sospesi(artigiano_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.movements(date);

-- ABILITAZIONE DELLE REALTIME SUBSCRIPTIONS PER OGNI TABELLA
-- (Permette all'app di aggiornarsi istantaneamente quando i dati cambiano da un altro dispositivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.artigiani;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cantieri;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sospesi;

-- ROW LEVEL SECURITY (RLS)
-- Abilita RLS sulle tabelle
ALTER TABLE public.artigiani ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cantieri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sospesi ENABLE ROW LEVEL SECURITY;

-- Policy di accesso completo tramite anon key (chiave pubblica dell'app)
CREATE POLICY "Permetti accesso completo anon artigiani" ON public.artigiani
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permetti accesso completo anon cantieri" ON public.cantieri
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permetti accesso completo anon movements" ON public.movements
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permetti accesso completo anon sospesi" ON public.sospesi
    FOR ALL USING (true) WITH CHECK (true);
