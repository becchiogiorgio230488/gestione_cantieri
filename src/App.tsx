import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ArtigianiHomeView } from './components/ArtigianiHomeView';
import { ProspettoGeneraleView } from './components/ProspettoGeneraleView';
import { SchedaCantiereView } from './components/SchedaCantiereView';
import { SospesiView } from './components/SospesiView';
import { ArtigianoModal } from './components/ArtigianoModal';
import { CantiereModal } from './components/CantiereModal';
import { XmlImportModal } from './components/XmlImportModal';
import { FatturaEmessaModal } from './components/FatturaEmessaModal';
import { PrintableView } from './components/PrintableView';
import { PrintableProspettoReport } from './components/PrintableProspettoReport';
import { PrintableSospesiReport } from './components/PrintableSospesiReport';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import {
  Artigiano,
  Cantiere,
  Movement,
  SospesoItem,
  QuadraturaContabile,
  NavigationLevel,
  MagazzinoData,
} from './types';
import {
  loadArtigiani,
  saveArtigiani,
  resetAllDataToDefaults,
} from './utils/storage';
import {
  extractInvoiceNumberFromMovement,
  extractSupplierFromMovement,
  cleanInvoiceNum,
  isSameSupplier,
} from './utils/invoiceDuplicateHelper';
import { isSupabaseConfigured } from './lib/supabase';
import {
  fetchAllArtigianiFromSupabase,
  upsertArtigianoToSupabase,
  deleteArtigianoFromSupabase,
  deleteCantiereFromSupabase,
  deleteMovementFromSupabase,
  deleteSospesoFromSupabase,
  upsertMovementToSupabase,
  upsertSospesoToSupabase,
  subscribeToRealtimeChanges,
  migrateAllLocalDataToSupabase,
} from './services/supabaseService';

export default function App() {
  const [artigiani, setArtigiani] = useState<Artigiano[]>([]);
  const [selectedArtigianoId, setSelectedArtigianoId] = useState<string | null>(null);
  const [selectedCantiereId, setSelectedCantiereId] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(isSupabaseConfigured());

  // 3-Level Navigation state
  const [navLevel, setNavLevel] = useState<NavigationLevel>('home_artigiani');

  // Print view modes
  const [isPrintCantiereView, setIsPrintCantiereView] = useState(false);
  const [isPrintProspettoView, setIsPrintProspettoView] = useState(false);
  const [isPrintSospesiView, setIsPrintSospesiView] = useState(false);

  // Modals
  const [isArtigianoModalOpen, setIsArtigianoModalOpen] = useState(false);
  const [artigianoToEdit, setArtigianoToEdit] = useState<Artigiano | null>(null);

  const [isCantiereModalOpen, setIsCantiereModalOpen] = useState(false);
  const [cantiereToEdit, setCantiereToEdit] = useState<Cantiere | null>(null);

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isFatturaEmessaModalOpen, setIsFatturaEmessaModalOpen] = useState(false);

  // Notification Toast
  const [notification, setNotification] = useState<string | null>(null);
  const lastLocalSaveRef = useRef<number>(0);

  useEffect(() => {
    // 1. Initial load from local storage cache for instant rendering
    const loaded = loadArtigiani();
    setArtigiani(loaded);
    if (loaded.length > 0) {
      setSelectedArtigianoId(loaded[0].id);
      if (loaded[0].cantieri.length > 0) {
        setSelectedCantiereId(loaded[0].cantieri[0].id);
      }
    }

    // 2. If Supabase is configured, fetch remote data and initialize realtime subscriptions
    if (isSupabaseConfigured()) {
      setIsSupabaseConnected(true);
      fetchAllArtigianiFromSupabase()
        .then(async (remote) => {
          if (remote && remote.length > 0) {
            setArtigiani(remote);
            saveArtigiani(remote);
            if (remote.length > 0) {
              setSelectedArtigianoId((prev) => (prev && remote.some((r) => r.id === prev) ? prev : remote[0].id));
            }
          } else if (loaded && loaded.length > 0) {
            // First time connection: remote is empty, migrate current local data to Supabase
            console.log('Supabase cloud is empty, seeding initial local data...');
            await migrateAllLocalDataToSupabase(loaded);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch initial data from Supabase, using local cache:', err);
        });

      // Subscribe to realtime database changes across tabs / devices
      let debounceTimer: any = null;
      const unsubscribe = subscribeToRealtimeChanges(() => {
        // Skip remote refetch triggered by local mutations within 3.5 seconds
        if (Date.now() - lastLocalSaveRef.current < 3500) {
          return;
        }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchAllArtigianiFromSupabase()
            .then((fresh) => {
              if (fresh && fresh.length > 0) {
                setArtigiani(fresh);
                saveArtigiani(fresh);
              }
            })
            .catch((err) => console.error('Realtime sync error:', err));
        }, 800);
      });

      return () => {
        unsubscribe();
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const currentArtigiano =
    artigiani.find((a) => a.id === selectedArtigianoId) || artigiani[0];

  const currentCantiere =
    currentArtigiano?.cantieri?.find((c) => c.id === selectedCantiereId) ||
    currentArtigiano?.cantieri?.[0];

  // Helper to persist artisan updates
  const updateArtigianiList = (nextList: Artigiano[]) => {
    lastLocalSaveRef.current = Date.now();
    setArtigiani(nextList);
    saveArtigiani(nextList);
  };

  const updateCurrentArtigiano = (updater: (prev: Artigiano) => Artigiano) => {
    lastLocalSaveRef.current = Date.now();
    setArtigiani((prevArtigiani) => {
      const activeId = selectedArtigianoId || prevArtigiani[0]?.id;
      const target = prevArtigiani.find((a) => a.id === activeId) || prevArtigiani[0];
      if (!target) return prevArtigiani;
      const updated = updater(target);
      const nextList = prevArtigiani.map((a) =>
        a.id === target.id ? updated : a
      );
      saveArtigiani(nextList);

      // Realtime auto-save to Supabase
      if (isSupabaseConfigured()) {
        upsertArtigianoToSupabase(updated).catch((err) =>
          console.error('Supabase auto-save error for artigiano:', err)
        );
      }
      return nextList;
    });
  };

  // Level 1 -> Level 2: Select artisan
  const handleSelectArtigiano = (artigianoId: string) => {
    setSelectedArtigianoId(artigianoId);
    const target = artigiani.find((a) => a.id === artigianoId);
    if (target && target.cantieri.length > 0) {
      setSelectedCantiereId(target.cantieri[0].id);
    } else {
      setSelectedCantiereId(null);
    }
    setNavLevel('prospetto_cantieri');
  };

  // Level 2 -> Level 3: Select single cantiere
  const handleSelectCantiere = (cantiereId: string) => {
    setSelectedCantiereId(cantiereId);
    setNavLevel('scheda_cantiere');
  };

  // Save artisan from modal
  const handleSaveArtigianoModal = (data: Partial<Artigiano>) => {
    if (artigianoToEdit) {
      // Edit
      let updatedArtigiano: Artigiano | null = null;
      const nextList = artigiani.map((a) => {
        if (a.id === artigianoToEdit.id) {
          updatedArtigiano = {
            ...a,
            ...data,
            updatedAt: new Date().toISOString(),
          } as Artigiano;
          return updatedArtigiano;
        }
        return a;
      });
      updateArtigianiList(nextList);

      // Auto-save to Supabase immediately so modifications persist
      if (updatedArtigiano && isSupabaseConfigured()) {
        upsertArtigianoToSupabase(updatedArtigiano).catch((err) =>
          console.error('Supabase auto-save error for updated artigiano:', err)
        );
      }
      showNotification(`Anagrafica artigiano "${data.name}" aggiornata.`);
    } else {
      // Create new
      const newArt: Artigiano = {
        id: `art-${Date.now()}`,
        name: data.name || 'Nuovo Artigiano',
        businessName: data.businessName || '',
        partitaIva: data.partitaIva || '',
        codiceFiscale: data.codiceFiscale || '',
        city: data.city || 'Milano',
        address: data.address || '',
        category: data.category || 'elettrico',
        phone: data.phone || '',
        email: data.email || '',
        year: data.year || 2026,
        notes: data.notes || '',
        quadratura: {
          mastrinoAcquisti: 0,
          mastrinoVendite: 0,
        },
        cantieri: [],
        sospesi: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextList = [newArt, ...artigiani];
      updateArtigianiList(nextList);
      if (isSupabaseConfigured()) {
        upsertArtigianoToSupabase(newArt).catch((err) =>
          console.error('Supabase auto-save error for new artigiano:', err)
        );
      }
      setSelectedArtigianoId(newArt.id);
      setSelectedCantiereId(null);
      setNavLevel('prospetto_cantieri');
      showNotification(`Nuovo cliente artigiano "${newArt.name}" creato con successo!`);
    }

    setIsArtigianoModalOpen(false);
    setArtigianoToEdit(null);
  };

  // Delete artisan
  const handleDeleteArtigiano = (artigianoId: string) => {
    const nextList = artigiani.filter((a) => a.id !== artigianoId);
    updateArtigianiList(nextList);
    if (isSupabaseConfigured()) {
      deleteArtigianoFromSupabase(artigianoId);
    }

    if (
      selectedArtigianoId === artigianoId ||
      currentArtigiano?.id === artigianoId ||
      navLevel !== 'home_artigiani'
    ) {
      if (nextList.length > 0) {
        setSelectedArtigianoId(nextList[0].id);
        setSelectedCantiereId(nextList[0].cantieri[0]?.id || null);
      } else {
        setSelectedArtigianoId(null);
        setSelectedCantiereId(null);
      }
      setNavLevel('home_artigiani');
    }
    showNotification('Cliente artigiano rimosso con successo dallo studio.');
  };

  // Save / Update Cantiere
  const handleUpdateCantiere = (updated: Cantiere) => {
    const upperName = (updated.name || 'CANTIERE').trim().toUpperCase();
    const normalized: Cantiere = {
      ...updated,
      name: upperName,
      // Nome cantiere e committente coincidono sempre: tieni solo nome cantiere
      client: upperName,
      city: (updated.city || '').trim().toUpperCase(),
      address: updated.address?.trim() ? updated.address.trim().toUpperCase() : undefined,
      updatedAt: new Date().toISOString(),
    };
    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: art.cantieri.map((c) => (c.id === normalized.id ? normalized : c)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteCantiere = (cantiereId: string) => {
    updateCurrentArtigiano((art) => {
      const nextCantieri = art.cantieri.filter((c) => c.id !== cantiereId);
      return {
        ...art,
        cantieri: nextCantieri,
        updatedAt: new Date().toISOString(),
      };
    });
    if (isSupabaseConfigured()) {
      deleteCantiereFromSupabase(cantiereId);
    }

    const remaining = currentArtigiano?.cantieri?.filter((c) => c.id !== cantiereId) || [];
    if (selectedCantiereId === cantiereId) {
      setSelectedCantiereId(remaining[0]?.id || null);
    }
    if (navLevel === 'scheda_cantiere' || remaining.length === 0) {
      setNavLevel('prospetto_cantieri');
    }
    showNotification('Scheda cantiere eliminata con successo.');
  };

  // Delete a single movement / DDT from a cantiere
  const handleDeleteMovement = (cantiereId: string, movementId: string) => {
    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: art.cantieri.map((c) =>
        c.id === cantiereId
          ? {
              ...c,
              movements: c.movements.filter((m) => m.id !== movementId),
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
      updatedAt: new Date().toISOString(),
    }));

    if (isSupabaseConfigured()) {
      deleteMovementFromSupabase(movementId).catch((err) =>
        console.error('Error deleting movement from Supabase:', err)
      );
    }
    showNotification('Riga / DDT eliminato con successo dal cantiere.');
  };

  const handleDeleteMovementFromAllCantieri = (
    cantiereId: string,
    movement: Movement,
    linkedCantiereIds: string[],
    linkedSospesiIds: string[]
  ) => {
    if (!currentArtigiano) return;

    const invNum = extractInvoiceNumberFromMovement(movement);
    const supp = extractSupplierFromMovement(movement);
    const isIssued = movement.issued !== 0 || movement.source === 'fattura_emessa' || movement.typeAndSubject.includes('EMESS');

    const movementIdsToDelete: string[] = [movement.id];

    // Find linked movements in other cantieri to delete
    for (const c of currentArtigiano.cantieri || []) {
      if (linkedCantiereIds.includes(c.id)) {
        for (const m of c.movements || []) {
          if (m.id === movement.id) continue;
          if (isIssued) {
            if (cleanInvoiceNum(m.docNumber) === invNum) {
              movementIdsToDelete.push(m.id);
            }
          } else {
            const mInv = extractInvoiceNumberFromMovement(m);
            const mSupp = extractSupplierFromMovement(m);
            if (mInv === invNum && isSameSupplier(supp, mSupp)) {
              movementIdsToDelete.push(m.id);
            }
          }
        }
      }
    }

    updateCurrentArtigiano((art) => {
      const nextCantieri = art.cantieri.map((c) => {
        // Remove from current cantiere
        if (c.id === cantiereId) {
          return {
            ...c,
            movements: c.movements.filter((m) => m.id !== movement.id),
            updatedAt: new Date().toISOString(),
          };
        }
        // Remove from linked cantieri if matching invoice
        if (linkedCantiereIds.includes(c.id)) {
          return {
            ...c,
            movements: c.movements.filter((m) => !movementIdsToDelete.includes(m.id)),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      const nextSospesi = (art.sospesi || []).filter((s) => !linkedSospesiIds.includes(s.id));

      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: nextSospesi,
        updatedAt: new Date().toISOString(),
      };
    });

    if (isSupabaseConfigured()) {
      for (const mId of movementIdsToDelete) {
        deleteMovementFromSupabase(mId).catch(console.error);
      }
      for (const sId of linkedSospesiIds) {
        deleteSospesoFromSupabase(sId).catch(console.error);
      }
    }

    const totalCantieriAffected = linkedCantiereIds.length + 1;
    showNotification(
      `Fattura eliminata da tutti i cantieri coinvolti (${totalCantieriAffected}) e dalla Scheda Sospesi.`
    );
  };

  const handleSaveCantiereModal = (cantiereData: Partial<Cantiere>) => {
    if (!currentArtigiano) return;

    const upperName = (cantiereData.name || cantiereToEdit?.name || 'NUOVO CANTIERE').trim().toUpperCase();
    const upperCity = (cantiereData.city || cantiereToEdit?.city || currentArtigiano.city || 'MILANO').trim().toUpperCase();
    const upperAddress = cantiereData.address?.trim()
      ? cantiereData.address.trim().toUpperCase()
      : (cantiereToEdit?.address ? cantiereToEdit.address.trim().toUpperCase() : '');

    if (cantiereToEdit) {
      const updated: Cantiere = {
        ...cantiereToEdit,
        ...cantiereData,
        name: upperName,
        client: upperName,
        city: upperCity,
        address: upperAddress || undefined,
        updatedAt: new Date().toISOString(),
      } as Cantiere;
      handleUpdateCantiere(updated);
      showNotification(`Cantiere "${updated.name}" aggiornato.`);
    } else {
      const newC: Cantiere = {
        id: `cantiere-${Date.now()}`,
        name: upperName,
        city: upperCity,
        address: upperAddress || '',
        date: cantiereData.date || new Date().toISOString().slice(0, 10),
        year: cantiereData.year || currentArtigiano.year || 2026,
        client: upperName, // Coincide sempre con il nome cantiere
        initialInventory: cantiereData.initialInventory || 0,
        finalInventory: cantiereData.finalInventory || 0,
        category: cantiereData.category || currentArtigiano.category || 'elettrico',
        status: cantiereData.status || 'attivo',
        notes: cantiereData.notes || '',
        movements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updateCurrentArtigiano((art) => ({
        ...art,
        cantieri: [newC, ...art.cantieri],
        updatedAt: new Date().toISOString(),
      }));

      setSelectedCantiereId(newC.id);
      setNavLevel('scheda_cantiere');
      showNotification(`Nuova scheda cantiere "${newC.name}" creata per ${currentArtigiano.name}!`);
    }

    setIsCantiereModalOpen(false);
    setCantiereToEdit(null);
  };

  // XML Import allocations (Handles both cantiere movements and/or sospesi in one atomic operation)
  const handleCommitXmlAllocations = (
    movementsByCantiere: { cantiereId: string; movement: Movement }[],
    sospesiItems: Omit<SospesoItem, 'id' | 'createdAt'>[] = []
  ) => {
    if (!currentArtigiano) return;
    if (movementsByCantiere.length === 0 && sospesiItems.length === 0) {
      setIsXmlModalOpen(false);
      return;
    }

    let totalAssigned = 0;
    const newSospesi: SospesoItem[] = sospesiItems.map((it, idx) => ({
      ...it,
      id: `sosp-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
    }));

    updateCurrentArtigiano((art) => {
      const nextCantieri = [...art.cantieri];
      movementsByCantiere.forEach(({ cantiereId, movement }) => {
        const idx = nextCantieri.findIndex((c) => c.id === cantiereId);
        if (idx !== -1) {
          nextCantieri[idx] = {
            ...nextCantieri[idx],
            movements: [...nextCantieri[idx].movements, movement],
            updatedAt: new Date().toISOString(),
          };
          totalAssigned += movement.purchases;
        }
      });
      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: [...newSospesi, ...(art.sospesi || [])],
        updatedAt: new Date().toISOString(),
      };
    });

    setIsXmlModalOpen(false);

    if (movementsByCantiere.length > 0 && newSospesi.length > 0) {
      showNotification(
        `Fattura XML registrata: ${movementsByCantiere.length} movimenti nei cantieri (€ ${totalAssigned.toFixed(2)}) e ${newSospesi.length} voci/DDT inviati alla "Scheda Sospesi"!`
      );
    } else if (newSospesi.length > 0) {
      showNotification(
        `${newSospesi.length} voci/DDT inviati con successo alla "Scheda Sospesi" di ${currentArtigiano.name}.`
      );
      setNavLevel('scheda_sospesi');
    } else {
      showNotification(
        `Fattura XML registrata: ${movementsByCantiere.length} movimenti imputati ai cantieri di ${currentArtigiano.name} (Tot: € ${totalAssigned.toFixed(2)}).`
      );
      const uniqueIds = Array.from(new Set(movementsByCantiere.map((m) => m.cantiereId)));
      if (uniqueIds.length === 1) {
        setSelectedCantiereId(uniqueIds[0]);
        setNavLevel('scheda_cantiere');
      }
    }
  };

  // XML Import Sospesi fallback
  const handleCommitSospesiFromXml = (
    items: Omit<SospesoItem, 'id' | 'createdAt'>[]
  ) => {
    if (!currentArtigiano || items.length === 0) return;

    const newSospesi: SospesoItem[] = items.map((it, idx) => ({
      ...it,
      id: `sosp-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
    }));

    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: [...newSospesi, ...(art.sospesi || [])],
      updatedAt: new Date().toISOString(),
    }));

    showNotification(
      `${newSospesi.length} voci/DDT non assegnate archiviate nella "Scheda Sospesi" di ${currentArtigiano.name}.`
    );
  };

  // Move an existing movement from a cantiere back to Scheda Sospesi
  const handleMoveMovementToSospesi = (cantiereId: string, movement: Movement) => {
    if (!currentArtigiano) return;

    const newSospeso: SospesoItem = {
      id: `sosp-${Date.now()}`,
      date: movement.date,
      docNumber: movement.docNumber,
      supplier: extractSupplierFromMovement(movement) || currentArtigiano.name,
      description: movement.typeAndSubject,
      amount: movement.purchases || movement.issued || 0,
      protocol: movement.protocol || undefined,
      status: 'in_attesa_cliente',
      customerNote: 'Spostato da cantiere in attesa di chiarimento col committente',
      createdAt: new Date().toISOString(),
    };

    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: art.cantieri.map((c) =>
        c.id === cantiereId
          ? {
              ...c,
              movements: c.movements.filter((m) => m.id !== movement.id),
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
      sospesi: [newSospeso, ...(art.sospesi || [])],
      updatedAt: new Date().toISOString(),
    }));

    if (isSupabaseConfigured()) {
      deleteMovementFromSupabase(movement.id).catch((err) =>
        console.error('Error removing movement from Supabase:', err)
      );
      upsertSospesoToSupabase(currentArtigiano.id, newSospeso).catch((err) =>
        console.error('Error upserting new sospeso to Supabase:', err)
      );
    }

    showNotification(
      `DDT / Voce "${movement.docNumber}" spostata con successo nella "Scheda Sospesi"!`
    );
  };

  // Move an existing movement from one cantiere to another
  const handleMoveMovementToOtherCantiere = (
    sourceCantiereId: string,
    targetCantiereId: string,
    movement: Movement
  ) => {
    if (!currentArtigiano) return;
    const targetC = currentArtigiano.cantieri?.find((c) => c.id === targetCantiereId);
    if (!targetC) return;

    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: art.cantieri.map((c) => {
        if (c.id === sourceCantiereId) {
          return {
            ...c,
            movements: c.movements.filter((m) => m.id !== movement.id),
            updatedAt: new Date().toISOString(),
          };
        }
        if (c.id === targetCantiereId) {
          return {
            ...c,
            movements: [...c.movements, movement],
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      }),
      updatedAt: new Date().toISOString(),
    }));

    if (isSupabaseConfigured()) {
      deleteMovementFromSupabase(movement.id).catch(console.error);
      upsertMovementToSupabase(targetCantiereId, movement).catch(console.error);
    }

    showNotification(
      `DDT / Voce "${movement.docNumber}" spostata con successo nel cantiere "${targetC.name}"!`
    );
  };

  // Sospesi operations: 1-click move to cantiere
  const handleAssignSospesoToCantiere = (
    sospesoId: string,
    targetCantiereId: string
  ) => {
    if (!currentArtigiano) return;

    const sosp = currentArtigiano.sospesi?.find((s) => s.id === sospesoId);
    if (!sosp) return;

    const targetC = currentArtigiano.cantieri?.find((c) => c.id === targetCantiereId);
    if (!targetC) {
      showNotification('Cantiere di destinazione non trovato.');
      return;
    }

    const newMovement: Movement = {
      id: `mov-sosp-${Date.now()}`,
      date: sosp.date,
      docNumber: sosp.docNumber,
      typeAndSubject: `${sosp.supplier} - ${sosp.description}${
        sosp.customerNote ? ` (Nota: ${sosp.customerNote})` : ''
      }`,
      protocol: sosp.protocol || `DA-SOSP-${sosp.docNumber.slice(0, 8)}`,
      purchases: Number(sosp.amount) || 0,
      issued: 0,
      source: 'xml',
      notes: `Assegnato da Scheda Sospesi dopo conferma committente`,
    };

    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: art.cantieri.map((c) =>
        c.id === targetCantiereId
          ? {
              ...c,
              movements: [...c.movements, newMovement],
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
      sospesi: (art.sospesi || []).filter((s) => s.id !== sospesoId),
      updatedAt: new Date().toISOString(),
    }));

    // Immediately remove from Supabase sospesi table so it doesn't reappear
    if (isSupabaseConfigured()) {
      deleteSospesoFromSupabase(sospesoId).catch((err) =>
        console.error('Error removing assigned sospeso from Supabase:', err)
      );
      upsertMovementToSupabase(targetCantiereId, newMovement).catch((err) =>
        console.error('Error adding moved movement to Supabase:', err)
      );
    }

    showNotification(
      `Voce "${sosp.docNumber}" (€ ${sosp.amount.toFixed(2)}) spostata con successo nella scheda "${targetC.name}"!`
    );
  };

  const handleUpdateSospeso = (updated: SospesoItem) => {
    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: (art.sospesi || []).map((s) => (s.id === updated.id ? updated : s)),
      updatedAt: new Date().toISOString(),
    }));
    showNotification('Nota committente aggiornata.');
  };

  const handleDeleteSospeso = (id: string) => {
    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: (art.sospesi || []).filter((s) => s.id !== id),
      updatedAt: new Date().toISOString(),
    }));
    if (isSupabaseConfigured()) {
      deleteSospesoFromSupabase(id);
    }
    showNotification('Voce rimossa dalla Scheda Sospesi.');
  };

  const handleDeleteMultipleSospesi = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: (art.sospesi || []).filter((s) => !idSet.has(s.id)),
      updatedAt: new Date().toISOString(),
    }));
    if (isSupabaseConfigured()) {
      ids.forEach((id) => deleteSospesoFromSupabase(id));
    }
    showNotification(`${ids.length} voci rimosse con successo dalla Scheda Sospesi.`);
  };

  const handleClearAllSospesi = () => {
    if (!currentArtigiano) return;
    const idsToDelete = (currentArtigiano.sospesi || []).map((s) => s.id);
    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: [],
      updatedAt: new Date().toISOString(),
    }));
    if (isSupabaseConfigured()) {
      idsToDelete.forEach((id) => deleteSospesoFromSupabase(id).catch(console.error));
    }
    showNotification('Tutte le voci della Scheda Sospesi sono state cancellate.');
  };

  const handleAddManualSospeso = (item: Omit<SospesoItem, 'id' | 'createdAt'>) => {
    const newItem: SospesoItem = {
      ...item,
      id: `sosp-man-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateCurrentArtigiano((art) => ({
      ...art,
      sospesi: [newItem, ...(art.sospesi || [])],
      updatedAt: new Date().toISOString(),
    }));
    showNotification('Nuova voce aggiunta alla Scheda Sospesi.');
  };

  // Quadratura update
  const handleUpdateQuadratura = (updatedQ: QuadraturaContabile) => {
    updateCurrentArtigiano((art) => ({
      ...art,
      quadratura: updatedQ,
      updatedAt: new Date().toISOString(),
    }));
    showNotification('Quadratura mastrini della contabilità generale salvata.');
  };

  // Magazzino update
  const handleUpdateMagazzino = (mag: MagazzinoData) => {
    updateCurrentArtigiano((art) => ({
      ...art,
      magazzino: mag,
      updatedAt: new Date().toISOString(),
    }));
    showNotification('Dati scheda magazzino salvati con successo.');
  };

  // Issued invoice registration
  const handleCreateIssuedInvoice = (data: {
    createNewCantiere: boolean;
    cantiereId?: string;
    newCantiereData?: {
      name: string;
      city: string;
      address?: string;
      date: string;
      year: number;
      client: string;
      initialInventory: number;
      category: any;
      notes?: string;
    };
    movement: Movement;
  }) => {
    if (!currentArtigiano) return;

    if (data.createNewCantiere && data.newCantiereData) {
      const newC: Cantiere = {
        id: `cantiere-${Date.now()}`,
        name: data.newCantiereData.name,
        city: data.newCantiereData.city,
        address: data.newCantiereData.address || '',
        date: data.newCantiereData.date,
        year: data.newCantiereData.year,
        client: data.newCantiereData.client,
        initialInventory: data.newCantiereData.initialInventory,
        finalInventory: 0,
        category: data.newCantiereData.category,
        status: 'attivo',
        notes: data.newCantiereData.notes,
        movements: [data.movement],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updateCurrentArtigiano((art) => ({
        ...art,
        cantieri: [newC, ...art.cantieri],
        updatedAt: new Date().toISOString(),
      }));

      setSelectedCantiereId(newC.id);
      setNavLevel('scheda_cantiere');
      showNotification(`Creata nuova Scheda Cantiere "${newC.name}" con la fattura emessa registrata!`);
    } else if (data.cantiereId) {
      updateCurrentArtigiano((art) => ({
        ...art,
        cantieri: art.cantieri.map((c) =>
          c.id === data.cantiereId
            ? {
                ...c,
                movements: [...c.movements, data.movement],
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        updatedAt: new Date().toISOString(),
      }));

      setSelectedCantiereId(data.cantiereId);
      setNavLevel('scheda_cantiere');
      showNotification('Fattura emessa inserita nella colonna EMESSE del cantiere.');
    }

    setIsFatturaEmessaModalOpen(false);
  };

  // Print Views
  if (isPrintCantiereView && currentCantiere) {
    return (
      <PrintableView
        cantiere={currentCantiere}
        onBack={() => setIsPrintCantiereView(false)}
      />
    );
  }

  if (isPrintProspettoView && currentArtigiano) {
    return (
      <PrintableProspettoReport
        artigiano={currentArtigiano}
        onBack={() => setIsPrintProspettoView(false)}
      />
    );
  }

  if (isPrintSospesiView && currentArtigiano) {
    return (
      <PrintableSospesiReport
        sospesi={currentArtigiano.sospesi || []}
        onBack={() => setIsPrintSospesiView(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold animate-fadeIn border border-emerald-400/40">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-200 hover:text-white cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header with 3-Level Breadcrumb */}
      <Header
        artigiani={artigiani}
        selectedArtigianoId={selectedArtigianoId}
        selectedCantiereId={selectedCantiereId}
        navLevel={navLevel}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSupabaseSync={() => setIsSupabaseModalOpen(true)}
        onNavigateHome={() => setNavLevel('home_artigiani')}
        onNavigateToProspetto={(artId) => {
          if (artId) setSelectedArtigianoId(artId);
          setNavLevel('prospetto_cantieri');
        }}
        onNavigateToScheda={(cId) => {
          if (cId) setSelectedCantiereId(cId);
          setNavLevel('scheda_cantiere');
        }}
        onNavigateToSospesi={() => setNavLevel('scheda_sospesi')}
        onSelectArtigiano={(artId) => setSelectedArtigianoId(artId)}
        onOpenNewArtigiano={() => {
          setArtigianoToEdit(null);
          setIsArtigianoModalOpen(true);
        }}
        onOpenNewCantiere={() => {
          setCantiereToEdit(null);
          setIsCantiereModalOpen(true);
        }}
        onOpenFatturaEmessa={() => setIsFatturaEmessaModalOpen(true)}
        onOpenXmlImport={() => setIsXmlModalOpen(true)}
        onResetData={() => {
          const reloaded = resetAllDataToDefaults();
          setArtigiani(reloaded);
          setSelectedArtigianoId(reloaded[0]?.id || null);
          setSelectedCantiereId(reloaded[0]?.cantieri[0]?.id || null);
          setNavLevel('home_artigiani');
          showNotification('Dati di esempio dei 3 artigiani ripristinati correttamente.');
        }}
      />

      {/* Main View Area by Navigation Level */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* LIVELLO 1: HOME PAGE ELENCO DEI MIEI CLIENTI / ARTIGIANI */}
        {navLevel === 'home_artigiani' && (
          <ArtigianiHomeView
            artigiani={artigiani}
            onSelectArtigiano={handleSelectArtigiano}
            onOpenNewArtigiano={() => {
              setArtigianoToEdit(null);
              setIsArtigianoModalOpen(true);
            }}
            onEditArtigiano={(art) => {
              setArtigianoToEdit(art);
              setIsArtigianoModalOpen(true);
            }}
            onDeleteArtigiano={handleDeleteArtigiano}
            onOpenXmlImportForArtigiano={(artId) => {
              setSelectedArtigianoId(artId);
              setIsXmlModalOpen(true);
            }}
          />
        )}

        {/* LIVELLO 2: PROSPETTO GENERALE CANTIERI DEL CLIENTE (es. Sirna Massimo) */}
        {navLevel === 'prospetto_cantieri' && currentArtigiano && (
          <ProspettoGeneraleView
            artigiano={currentArtigiano}
            onBackToHome={() => setNavLevel('home_artigiani')}
            onSelectCantiere={handleSelectCantiere}
            onOpenNewCantiere={() => {
              setCantiereToEdit(null);
              setIsCantiereModalOpen(true);
            }}
            onEditCantiere={(c) => {
              setCantiereToEdit(c);
              setIsCantiereModalOpen(true);
            }}
            onUpdateCantiere={handleUpdateCantiere}
            onDeleteCantiere={handleDeleteCantiere}
            onOpenXmlImport={() => setIsXmlModalOpen(true)}
            onOpenFatturaEmessa={() => setIsFatturaEmessaModalOpen(true)}
            onNavigateToSospesi={() => setNavLevel('scheda_sospesi')}
            onUpdateQuadratura={handleUpdateQuadratura}
            onPrintProspetto={() => setIsPrintProspettoView(true)}
            onEditArtigiano={(art) => {
              setArtigianoToEdit(art);
              setIsArtigianoModalOpen(true);
            }}
            onDeleteArtigiano={handleDeleteArtigiano}
          />
        )}

        {/* LIVELLO 3: SCHEDA DETTAGLIO CANTIERE (Z-2026) */}
        {navLevel === 'scheda_cantiere' && currentCantiere && currentArtigiano && (
          <SchedaCantiereView
            cantiere={currentCantiere}
            allCantieri={currentArtigiano.cantieri || []}
            sospesi={currentArtigiano.sospesi || []}
            artigianoName={currentArtigiano.name}
            onBack={() => setNavLevel('prospetto_cantieri')}
            onSelectCantiere={(id) => setSelectedCantiereId(id)}
            onUpdateCantiere={handleUpdateCantiere}
            onDeleteMovement={handleDeleteMovement}
            onDeleteMovementFromAllCantieri={handleDeleteMovementFromAllCantieri}
            onMoveToSospesi={(mov) => handleMoveMovementToSospesi(currentCantiere.id, mov)}
            onMoveToOtherCantiere={(sourceId, targetId, mov) => handleMoveMovementToOtherCantiere(sourceId, targetId, mov)}
            onDeleteCantiere={handleDeleteCantiere}
            onOpenXmlImport={() => setIsXmlModalOpen(true)}
            onOpenFatturaEmessa={() => setIsFatturaEmessaModalOpen(true)}
            onPrint={() => setIsPrintCantiereView(true)}
          />
        )}

        {/* SCHEDA SOSPESI (DDT DA ATTRIBUIRE DELL'ARTIGIANO) */}
        {navLevel === 'scheda_sospesi' && currentArtigiano && (
          <SospesiView
            sospesi={currentArtigiano.sospesi || []}
            cantieri={currentArtigiano.cantieri || []}
            artigianoName={currentArtigiano.name}
            onBack={() => setNavLevel('prospetto_cantieri')}
            onAssignToCantiere={handleAssignSospesoToCantiere}
            onUpdateSospeso={handleUpdateSospeso}
            onDeleteSospeso={handleDeleteSospeso}
            onDeleteMultipleSospesi={handleDeleteMultipleSospesi}
            onClearAllSospesi={handleClearAllSospesi}
            onAddManualSospeso={handleAddManualSospeso}
            onPrintReport={() => setIsPrintSospesiView(true)}
          />
        )}
      </main>

      {/* Modal 1: Anagrafica Artigiano / Cliente */}
      {isArtigianoModalOpen && (
        <ArtigianoModal
          artigianoToEdit={artigianoToEdit}
          onClose={() => {
            setIsArtigianoModalOpen(false);
            setArtigianoToEdit(null);
          }}
          onSave={handleSaveArtigianoModal}
        />
      )}

      {/* Modal 2: Import Fattura Elettronica XML */}
      {isXmlModalOpen && currentArtigiano && (
        <XmlImportModal
          cantieri={currentArtigiano.cantieri || []}
          sospesi={currentArtigiano.sospesi || []}
          preselectedCantiereId={selectedCantiereId}
          onClose={() => setIsXmlModalOpen(false)}
          onCommitAllocations={handleCommitXmlAllocations}
          onCommitSospesi={handleCommitSospesiFromXml}
          onOpenNewCantiere={() => {
            setIsXmlModalOpen(false);
            setCantiereToEdit(null);
            setIsCantiereModalOpen(true);
          }}
        />
      )}

      {/* Modal 3: Fattura Emessa (Ricavi) */}
      {isFatturaEmessaModalOpen && currentArtigiano && (
        <FatturaEmessaModal
          cantieri={currentArtigiano.cantieri || []}
          preselectedCantiereId={selectedCantiereId}
          onClose={() => setIsFatturaEmessaModalOpen(false)}
          onCreateIssuedInvoice={handleCreateIssuedInvoice}
        />
      )}

      {/* Modal 4: Nuovo / Modifica Testata Cantiere */}
      {isCantiereModalOpen && (
        <CantiereModal
          cantiereToEdit={cantiereToEdit}
          onClose={() => {
            setIsCantiereModalOpen(false);
            setCantiereToEdit(null);
          }}
          onSave={handleSaveCantiereModal}
        />
      )}

      {/* Modal 5: Supabase Cloud Sync & SQL Schema */}
      <SupabaseSyncModal
        artigiani={artigiani}
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onDataReloaded={(fresh) => {
          setArtigiani(fresh);
          saveArtigiani(fresh);
          if (fresh.length > 0) {
            setSelectedArtigianoId(fresh[0].id);
            if (fresh[0].cantieri.length > 0) {
              setSelectedCantiereId(fresh[0].cantieri[0].id);
            }
          }
        }}
        onShowNotification={showNotification}
      />
    </div>
  );
}
