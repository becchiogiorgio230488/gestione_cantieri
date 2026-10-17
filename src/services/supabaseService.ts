import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Artigiano, Cantiere, Movement, SospesoItem } from '../types';

/**
 * Maps Supabase DB rows to frontend Artigiano[] structure
 */
export async function fetchAllArtigianiFromSupabase(): Promise<Artigiano[]> {
  if (!supabase || !isSupabaseConfigured()) {
    return [];
  }

  // 1. Fetch Artigiani
  const { data: artigianiRows, error: artError } = await supabase
    .from('artigiani')
    .select('*')
    .order('name', { ascending: true });

  if (artError) {
    console.error('Error fetching artigiani from Supabase:', artError);
    throw artError;
  }

  if (!artigianiRows || artigianiRows.length === 0) {
    return [];
  }

  // 2. Fetch Cantieri
  const { data: cantieriRows, error: cantError } = await supabase
    .from('cantieri')
    .select('*')
    .order('name', { ascending: true });

  if (cantError) {
    console.error('Error fetching cantieri from Supabase:', cantError);
  }

  // 3. Fetch Movements
  const { data: movementsRows, error: movError } = await supabase
    .from('movements')
    .select('*')
    .order('date', { ascending: false });

  if (movError) {
    console.error('Error fetching movements from Supabase:', movError);
  }

  // 4. Fetch Sospesi
  const { data: sospesiRows, error: sospError } = await supabase
    .from('sospesi')
    .select('*')
    .order('date', { ascending: false });

  if (sospError) {
    console.error('Error fetching sospesi from Supabase:', sospError);
  }

  // Group movements by cantiere_id
  const movementsByCantiere = new Map<string, Movement[]>();
  (movementsRows || []).forEach((row: any) => {
    const list = movementsByCantiere.get(row.cantiere_id) || [];
    list.push({
      id: row.id,
      date: row.date,
      docNumber: row.doc_number,
      typeAndSubject: row.type_and_subject,
      protocol: row.protocol || '',
      purchases: Number(row.purchases) || 0,
      issued: Number(row.issued) || 0,
      notes: row.notes || undefined,
      source: row.source || 'manuale',
      xmlRef: row.xml_ref || undefined,
    });
    movementsByCantiere.set(row.cantiere_id, list);
  });

  // Group cantieri by artigiano_id
  const cantieriByArtigiano = new Map<string, Cantiere[]>();
  (cantieriRows || []).forEach((row: any) => {
    const list = cantieriByArtigiano.get(row.artigiano_id) || [];
    list.push({
      id: row.id,
      name: row.name,
      city: row.city,
      address: row.address || '',
      date: row.date || '',
      year: row.year || 2026,
      client: row.client || '',
      initialInventory: Number(row.initial_inventory) || 0,
      finalInventory: Number(row.final_inventory) || 0,
      category: row.category || 'misto',
      status: row.status || 'attivo',
      notes: row.notes || undefined,
      movements: movementsByCantiere.get(row.id) || [],
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    });
    cantieriByArtigiano.set(row.artigiano_id, list);
  });

  // Group sospesi by artigiano_id
  const sospesiByArtigiano = new Map<string, SospesoItem[]>();
  (sospesiRows || []).forEach((row: any) => {
    const list = sospesiByArtigiano.get(row.artigiano_id) || [];
    list.push({
      id: row.id,
      date: row.date,
      docNumber: row.doc_number,
      supplier: row.supplier,
      description: row.description,
      amount: Number(row.amount) || 0,
      protocol: row.protocol || undefined,
      ddtNumber: row.ddt_number || undefined,
      ddtDate: row.ddt_date || undefined,
      status: row.status || 'in_attesa_cliente',
      customerNote: row.customer_note || undefined,
      suggestedCantiereId: row.suggested_cantiere_id || undefined,
      sourceFileName: row.source_file_name || undefined,
      createdAt: row.created_at || new Date().toISOString(),
    });
    sospesiByArtigiano.set(row.artigiano_id, list);
  });

  // Assemble Artigiano[]
  return (artigianiRows || []).map((row: any): Artigiano => ({
    id: row.id,
    name: row.name,
    businessName: row.business_name || undefined,
    partitaIva: row.partita_iva || undefined,
    codiceFiscale: row.codice_fiscale || undefined,
    city: row.city || 'Milano',
    address: row.address || undefined,
    category: row.category || 'misto',
    phone: row.phone || undefined,
    email: row.email || undefined,
    year: row.year || 2026,
    notes: row.notes || undefined,
    quadratura: row.quadratura || { mastrinoAcquisti: 0, mastrinoVendite: 0 },
    magazzino: row.magazzino || undefined,
    cantieri: cantieriByArtigiano.get(row.id) || [],
    sospesi: sospesiByArtigiano.get(row.id) || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  }));
}

/**
 * Upserts an entire Artigiano and its child cantieri, movements, and sospesi to Supabase
 */
export async function upsertArtigianoToSupabase(artigiano: Artigiano): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  // 1. Upsert Artigiano row
  const { error: artError } = await supabase.from('artigiani').upsert({
    id: artigiano.id,
    name: artigiano.name,
    business_name: artigiano.businessName || null,
    partita_iva: artigiano.partitaIva || null,
    codice_fiscale: artigiano.codiceFiscale || null,
    city: artigiano.city || 'Milano',
    address: artigiano.address || null,
    category: artigiano.category || 'misto',
    phone: artigiano.phone || null,
    email: artigiano.email || null,
    year: artigiano.year || 2026,
    notes: artigiano.notes || null,
    quadratura: artigiano.quadratura || {},
    magazzino: artigiano.magazzino || null,
    updated_at: new Date().toISOString(),
  });

  if (artError) {
    console.error('Error upserting artigiano in Supabase:', artError);
    throw artError;
  }

  // 2. Cantieri: clean up removed cantieri, then upsert current cantieri
  const keepCantiereIds = (artigiano.cantieri || []).map((c) => c.id);
  if (keepCantiereIds.length > 0) {
    const { data: existingCantieri } = await supabase
      .from('cantieri')
      .select('id')
      .eq('artigiano_id', artigiano.id);
    const toDeleteCantieri = (existingCantieri || [])
      .map((c: any) => c.id)
      .filter((id: string) => !keepCantiereIds.includes(id));
    if (toDeleteCantieri.length > 0) {
      await supabase.from('cantieri').delete().in('id', toDeleteCantieri);
    }
  } else {
    await supabase.from('cantieri').delete().eq('artigiano_id', artigiano.id);
  }

  for (const cantiere of artigiano.cantieri || []) {
    await upsertCantiereToSupabase(artigiano.id, cantiere);
  }

  // 3. Sospesi: clean up removed sospesi, then upsert current sospesi
  const keepSospesiIds = (artigiano.sospesi || []).map((s) => s.id);
  if (keepSospesiIds.length > 0) {
    const { data: existingSospesi } = await supabase
      .from('sospesi')
      .select('id')
      .eq('artigiano_id', artigiano.id);
    const toDeleteSospesi = (existingSospesi || [])
      .map((s: any) => s.id)
      .filter((id: string) => !keepSospesiIds.includes(id));
    if (toDeleteSospesi.length > 0) {
      await supabase.from('sospesi').delete().in('id', toDeleteSospesi);
    }

    for (const item of artigiano.sospesi || []) {
      await upsertSospesoToSupabase(artigiano.id, item);
    }
  } else {
    await supabase.from('sospesi').delete().eq('artigiano_id', artigiano.id);
  }
}

/**
 * Upserts a single Cantiere and its movements to Supabase
 */
export async function upsertCantiereToSupabase(artigianoId: string, cantiere: Cantiere): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error: cantiereError } = await supabase.from('cantieri').upsert({
    id: cantiere.id,
    artigiano_id: artigianoId,
    name: cantiere.name,
    city: cantiere.city,
    address: cantiere.address || null,
    date: cantiere.date || null,
    year: cantiere.year || 2026,
    client: cantiere.client,
    initial_inventory: cantiere.initialInventory || 0,
    final_inventory: cantiere.finalInventory || 0,
    category: cantiere.category || 'misto',
    status: cantiere.status || 'attivo',
    notes: cantiere.notes || null,
    updated_at: new Date().toISOString(),
  });

  if (cantiereError) {
    console.error('Error upserting cantiere:', cantiereError);
    throw cantiereError;
  }

  // Clean up any movements in DB for this cantiere that are no longer present
  const currentMovIds = (cantiere.movements || []).map((m) => m.id);
  if (currentMovIds.length > 0) {
    const { data: existingMovs } = await supabase
      .from('movements')
      .select('id')
      .eq('cantiere_id', cantiere.id);
    const toDeleteMovs = (existingMovs || [])
      .map((m: any) => m.id)
      .filter((id: string) => !currentMovIds.includes(id));
    if (toDeleteMovs.length > 0) {
      const { error: delError } = await supabase
        .from('movements')
        .delete()
        .in('id', toDeleteMovs);
      if (delError) {
        console.error('Error cleaning up deleted movements in Supabase:', delError);
      }
    }

    const movRows = cantiere.movements.map((m) => ({
      id: m.id,
      cantiere_id: cantiere.id,
      date: m.date,
      doc_number: m.docNumber,
      type_and_subject: m.typeAndSubject,
      protocol: m.protocol || null,
      purchases: m.purchases || 0,
      issued: m.issued || 0,
      notes: m.notes || null,
      source: m.source || 'manuale',
      xml_ref: m.xmlRef || null,
    }));

    const { error: movError } = await supabase.from('movements').upsert(movRows);
    if (movError) {
      console.error('Error upserting movements in Supabase:', movError);
    }
  } else {
    // If no movements remain in this cantiere, delete all movements for this cantiere in Supabase
    const { error: delAllError } = await supabase
      .from('movements')
      .delete()
      .eq('cantiere_id', cantiere.id);
    if (delAllError) {
      console.error('Error clearing movements in Supabase:', delAllError);
    }
  }
}

/**
 * Upserts a single movement to Supabase
 */
export async function upsertMovementToSupabase(cantiereId: string, movement: Movement): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('movements').upsert({
    id: movement.id,
    cantiere_id: cantiereId,
    date: movement.date,
    doc_number: movement.docNumber,
    type_and_subject: movement.typeAndSubject,
    protocol: movement.protocol || null,
    purchases: movement.purchases || 0,
    issued: movement.issued || 0,
    notes: movement.notes || null,
    source: movement.source || 'manuale',
    xml_ref: movement.xmlRef || null,
  });

  if (error) {
    console.error('Error upserting movement:', error);
  }
}

/**
 * Deletes a movement from Supabase
 */
export async function deleteMovementFromSupabase(movementId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('movements').delete().eq('id', movementId);
  if (error) {
    console.error('Error deleting movement from Supabase:', error);
  }
}

/**
 * Deletes multiple movements from Supabase
 */
export async function deleteMultipleMovementsFromSupabase(movementIds: string[]): Promise<void> {
  if (!supabase || !isSupabaseConfigured() || movementIds.length === 0) return;

  const { error } = await supabase.from('movements').delete().in('id', movementIds);
  if (error) {
    console.error('Error deleting movements from Supabase:', error);
  }
}

/**
 * Deletes a Cantiere from Supabase
 */
export async function deleteCantiereFromSupabase(cantiereId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('cantieri').delete().eq('id', cantiereId);
  if (error) {
    console.error('Error deleting cantiere from Supabase:', error);
  }
}

/**
 * Upserts a single SospesoItem to Supabase
 */
export async function upsertSospesoToSupabase(artigianoId: string, item: SospesoItem): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('sospesi').upsert({
    id: item.id,
    artigiano_id: artigianoId,
    date: item.date,
    doc_number: item.docNumber,
    supplier: item.supplier,
    description: item.description,
    amount: item.amount || 0,
    protocol: item.protocol || null,
    ddt_number: item.ddtNumber || null,
    ddt_date: item.ddtDate || null,
    status: item.status || 'in_attesa_cliente',
    customer_note: item.customerNote || null,
    suggested_cantiere_id: item.suggestedCantiereId || null,
    source_file_name: item.sourceFileName || null,
    created_at: item.createdAt || new Date().toISOString(),
  });

  if (error) {
    console.error('Error upserting sospeso in Supabase:', error);
  }
}

/**
 * Deletes a SospesoItem from Supabase
 */
export async function deleteSospesoFromSupabase(sospesoId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('sospesi').delete().eq('id', sospesoId);
  if (error) {
    console.error('Error deleting sospeso from Supabase:', error);
  }
}

/**
 * Deletes an Artigiano and all related records (cascade in Postgres)
 */
export async function deleteArtigianoFromSupabase(artigianoId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  const { error } = await supabase.from('artigiani').delete().eq('id', artigianoId);
  if (error) {
    console.error('Error deleting artigiano from Supabase:', error);
  }
}

/**
 * Bulk migration helper: syncs all current artigiani and their nested data to Supabase
 */
export async function migrateAllLocalDataToSupabase(artigiani: Artigiano[]): Promise<{ count: number; error?: string }> {
  if (!supabase || !isSupabaseConfigured()) {
    return { count: 0, error: 'Supabase non è configurato. Inserisci le credenziali in .env.' };
  }

  try {
    for (const artigiano of artigiani) {
      await upsertArtigianoToSupabase(artigiano);
    }
    return { count: artigiani.length };
  } catch (err: any) {
    console.error('Error during Supabase migration:', err);
    return { count: 0, error: err?.message || 'Errore durante la migrazione su Supabase' };
  }
}

/**
 * Subscribes to Supabase Realtime changes on all relevant tables.
 * When any table changes, triggers the onRemoteChange callback.
 * Returns an unsubscribe function.
 */
export function subscribeToRealtimeChanges(onRemoteChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured()) {
    return () => {};
  }

  const channel = supabase
    .channel('gestione-cantieri-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'artigiani' }, () => {
      onRemoteChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cantieri' }, () => {
      onRemoteChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => {
      onRemoteChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sospesi' }, () => {
      onRemoteChange();
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
