import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ArtigianiHomeView } from './components/ArtigianiHomeView';
import { ProspettoGeneraleView } from './components/ProspettoGeneraleView';
import { SchedaCantiereView } from './components/SchedaCantiereView';
import { SospesiView } from './components/SospesiView';
import { ArtigianoModal } from './components/ArtigianoModal';
import { CantiereModal } from './components/CantiereModal';
import { XmlImportModal } from './components/XmlImportModal';
import { ExcelImportModal } from './components/ExcelImportModal';
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
  AttachmentPdf,
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
  formatSingleDdtTag,
  extractDdtEntriesFromTypeAndSubject,
  extractDdtEntriesFromMovement,
  buildFormattedTypeAndSubject,
  mergeTypeAndSubject,
} from './utils/invoiceDuplicateHelper';
import { isSupabaseConfigured } from './lib/supabase';
import {
  fetchAllArtigianiFromSupabase,
  upsertArtigianoToSupabase,
  upsertCantiereToSupabase,
  bulkUpsertMovementsToSupabase,
  bulkUpsertSospesiToSupabase,
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
  const [dataAggiornamentoProspetto, setDataAggiornamentoProspetto] = useState<string>('');

  // Modals
  const [isArtigianoModalOpen, setIsArtigianoModalOpen] = useState(false);
  const [artigianoToEdit, setArtigianoToEdit] = useState<Artigiano | null>(null);

  const [isCantiereModalOpen, setIsCantiereModalOpen] = useState(false);
  const [cantiereToEdit, setCantiereToEdit] = useState<Cantiere | null>(null);

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
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
        // Skip remote refetch triggered by local mutations within 12 seconds
        if (Date.now() - lastLocalSaveRef.current < 12000) {
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

  // Add, modify, or remove PDF from a DDT/movement, automatically synchronizing across ALL cantieri and sospesi sharing the same invoice
  const handleUpdateMovementPdf = (
    cantiereId: string,
    movement: Movement,
    newAttachmentPdf: AttachmentPdf | null
  ) => {
    if (!currentArtigiano) return;

    const invNum = extractInvoiceNumberFromMovement(movement);
    const supp = extractSupplierFromMovement(movement);
    const isIssued =
      movement.issued !== 0 ||
      movement.source === 'fattura_emessa' ||
      movement.typeAndSubject.includes('EMESS');

    let updatedMovementsCount = 0;
    const involvedCantieriNames = new Set<string>();

    updateCurrentArtigiano((art) => {
      const nextCantieri = art.cantieri.map((c) => {
        let cantiereHasChanges = false;
        const nextMovs = c.movements.map((m) => {
          const isTarget = m.id === movement.id;
          let isSameInvoice = false;

          if (invNum) {
            if (isIssued) {
              isSameInvoice = cleanInvoiceNum(m.docNumber) === invNum;
            } else {
              const mInv = extractInvoiceNumberFromMovement(m);
              const mSupp = extractSupplierFromMovement(m);
              isSameInvoice = mInv === invNum && isSameSupplier(supp, mSupp);
            }
          }

          if (isTarget || isSameInvoice) {
            cantiereHasChanges = true;
            updatedMovementsCount++;
            involvedCantieriNames.add(c.name);
            return {
              ...m,
              attachmentPdf: newAttachmentPdf || undefined,
            };
          }
          return m;
        });

        if (cantiereHasChanges) {
          return {
            ...c,
            movements: nextMovs,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      // Also update any matching Sospesi items if it's a purchase invoice
      let nextSospesi = art.sospesi;
      if (!isIssued && invNum && art.sospesi && art.sospesi.length > 0) {
        nextSospesi = art.sospesi.map((s) => {
          const sInv = cleanInvoiceNum(s.docNumber);
          if (sInv === invNum && isSameSupplier(supp, s.supplier)) {
            return {
              ...s,
              attachmentPdf: newAttachmentPdf || undefined,
            };
          }
          return s;
        });
      }

      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: nextSospesi,
        updatedAt: new Date().toISOString(),
      };
    });

    const cantieriCount = involvedCantieriNames.size;
    if (newAttachmentPdf) {
      if (cantieriCount > 1) {
        showNotification(
          `PDF "${newAttachmentPdf.fileName}" allegato automaticamente a tutti i ${updatedMovementsCount} DDT della fattura "${movement.docNumber}" presenti in ${cantieriCount} cantieri diversi!`
        );
      } else {
        showNotification(
          `PDF "${newAttachmentPdf.fileName}" allegato con successo al DDT "${movement.docNumber}".`
        );
      }
    } else {
      if (cantieriCount > 1) {
        showNotification(
          `Allegato PDF rimosso da tutti i ${updatedMovementsCount} DDT della fattura "${movement.docNumber}" (${cantieriCount} cantieri).`
        );
      } else {
        showNotification(`Allegato PDF rimosso dal DDT "${movement.docNumber}".`);
      }
    }
  };

  const handleUpdateSospesoPdf = (
    sospeso: SospesoItem,
    newAttachmentPdf: AttachmentPdf | null
  ) => {
    if (!currentArtigiano) return;

    const invNum = cleanInvoiceNum(sospeso.docNumber);
    const supp = (sospeso.supplier || '').toUpperCase().trim();
    let updatedMovementsCount = 0;
    const involvedCantieriNames = new Set<string>();

    updateCurrentArtigiano((art) => {
      // Update matching items in cantieri
      const nextCantieri = art.cantieri.map((c) => {
        let cantiereHasChanges = false;
        const nextMovs = c.movements.map((m) => {
          if (invNum) {
            const mInv = extractInvoiceNumberFromMovement(m);
            const mSupp = extractSupplierFromMovement(m);
            if (mInv === invNum && isSameSupplier(supp, mSupp)) {
              cantiereHasChanges = true;
              updatedMovementsCount++;
              involvedCantieriNames.add(c.name);
              return {
                ...m,
                attachmentPdf: newAttachmentPdf || undefined,
              };
            }
          }
          return m;
        });

        if (cantiereHasChanges) {
          return {
            ...c,
            movements: nextMovs,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      // Update matching items in sospesi
      const nextSospesi = (art.sospesi || []).map((s) => {
        if (s.id === sospeso.id || (invNum && cleanInvoiceNum(s.docNumber) === invNum && isSameSupplier(supp, s.supplier))) {
          return {
            ...s,
            attachmentPdf: newAttachmentPdf || undefined,
          };
        }
        return s;
      });

      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: nextSospesi,
        updatedAt: new Date().toISOString(),
      };
    });

    const cantieriCount = involvedCantieriNames.size;
    if (newAttachmentPdf) {
      if (cantieriCount > 0) {
        showNotification(
          `PDF "${newAttachmentPdf.fileName}" allegato alla voce sospesa e sincronizzato su ${updatedMovementsCount} DDT della fattura in ${cantieriCount} cantieri!`
        );
      } else {
        showNotification(
          `PDF "${newAttachmentPdf.fileName}" allegato con successo alla voce dei Sospesi.`
        );
      }
    } else {
      showNotification(`Allegato PDF rimosso dalla voce dei Sospesi e dai DDT collegati.`);
    }
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

  // Directly create a new cantiere on-the-fly (e.g. from XML import dropdown)
  const handleCreateNewCantiereDirectly = (cantiereData: Partial<Cantiere>): Cantiere => {
    const activeArt = currentArtigiano;
    const upperName = (cantiereData.name || 'NUOVO CANTIERE').trim().toUpperCase();
    const upperCity = (cantiereData.city || activeArt?.city || 'MILANO').trim().toUpperCase();
    const upperAddress = cantiereData.address?.trim() ? cantiereData.address.trim().toUpperCase() : '';

    const newC: Cantiere = {
      id: `cantiere-${Date.now()}`,
      name: upperName,
      city: upperCity,
      address: upperAddress || '',
      date: cantiereData.date || new Date().toISOString().slice(0, 10),
      year: cantiereData.year || activeArt?.year || 2026,
      client: cantiereData.client ? cantiereData.client.trim().toUpperCase() : upperName,
      initialInventory: cantiereData.initialInventory || 0,
      finalInventory: cantiereData.finalInventory || 0,
      category: cantiereData.category || activeArt?.category || 'elettrico',
      status: cantiereData.status || 'attivo',
      notes: cantiereData.notes || '',
      movements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateCurrentArtigiano((art) => ({
      ...art,
      cantieri: [...art.cantieri, newC],
      updatedAt: new Date().toISOString(),
    }));

    showNotification(`Nuovo cantiere "${newC.name} (${newC.city})" creato con successo!`);
    return newC;
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

  // -------------------------------------------------------------
  // EXCEL IMPORT HANDLERS (Singola Scheda, Sospesi, Prospetto Generale)
  // -------------------------------------------------------------
  const handleCommitSingolaSchedaExcel = async ({
    targetArtigianoId,
    cantiereData,
    movements,
    isNewCantiere,
  }: {
    targetArtigianoId: string;
    cantiereData: {
      id?: string;
      name: string;
      city: string;
      address: string;
      client: string;
      year: number;
      initialInventory: number;
    };
    movements: Movement[];
    isNewCantiere: boolean;
  }) => {
    const targetArt = artigiani.find((a) => a.id === targetArtigianoId);
    if (!targetArt) return;

    let targetCantiere: Cantiere;
    let nextCantieri: Cantiere[];

    if (isNewCantiere || !cantiereData.id) {
      const cleanName = (cantiereData.name || '').trim().toUpperCase();
      const cleanCity = (cantiereData.city || '').trim().toUpperCase();
      const cleanAddress = (cantiereData.address || '').trim().toUpperCase();
      const cleanClient = (cantiereData.client || '').trim().toUpperCase();

      targetCantiere = {
        id: `cantiere-${Date.now()}`,
        name: cleanName || cleanAddress || 'CANTIERE',
        city: cleanCity,
        address: cleanAddress || undefined,
        client: cleanClient || cleanName,
        date: new Date().toISOString().slice(0, 10),
        year: cantiereData.year || targetArt.year || 2026,
        initialInventory: cantiereData.initialInventory || 0,
        finalInventory: 0,
        category: targetArt.category || 'misto',
        status: 'attivo',
        movements: movements,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      nextCantieri = [...targetArt.cantieri, targetCantiere];
    } else {
      const existing = targetArt.cantieri.find((c) => c.id === cantiereData.id) || targetArt.cantieri[0];
      const existingMovs = existing.movements || [];
      targetCantiere = {
        ...existing,
        initialInventory:
          cantiereData.initialInventory > 0
            ? cantiereData.initialInventory
            : existing.initialInventory,
        movements: [...existingMovs, ...movements],
        updatedAt: new Date().toISOString(),
      };
      nextCantieri = targetArt.cantieri.map((c) =>
        c.id === targetCantiere.id ? targetCantiere : c
      );
    }

    const updatedArt: Artigiano = {
      ...targetArt,
      cantieri: nextCantieri,
      updatedAt: new Date().toISOString(),
    };

    const nextList = artigiani.map((a) => (a.id === updatedArt.id ? updatedArt : a));
    updateArtigianiList(nextList);

    if (isSupabaseConfigured()) {
      try {
        await upsertCantiereToSupabase(targetArtigianoId, targetCantiere);
        await bulkUpsertMovementsToSupabase(targetCantiere.id, targetCantiere.movements);
      } catch (err) {
        console.error('Supabase error saving single cantiere import:', err);
      }
    }

    setSelectedArtigianoId(targetArtigianoId);
    setSelectedCantiereId(targetCantiere.id);
    setNavLevel('scheda_cantiere');
    showNotification(
      `Importati con successo ${movements.length} movimenti per il cantiere "${targetCantiere.name}"!`
    );
  };

  const handleCommitSospesiExcel = async ({
    targetArtigianoId,
    items,
  }: {
    targetArtigianoId: string;
    items: SospesoItem[];
  }) => {
    const targetArt = artigiani.find((a) => a.id === targetArtigianoId);
    if (!targetArt || items.length === 0) return;

    const nextSospesi = [...items, ...(targetArt.sospesi || [])];
    const updatedArt: Artigiano = {
      ...targetArt,
      sospesi: nextSospesi,
      updatedAt: new Date().toISOString(),
    };

    const nextList = artigiani.map((a) => (a.id === updatedArt.id ? updatedArt : a));
    updateArtigianiList(nextList);

    if (isSupabaseConfigured()) {
      try {
        await bulkUpsertSospesiToSupabase(targetArtigianoId, items);
      } catch (err) {
        console.error('Supabase error saving imported sospesi:', err);
      }
    }

    setSelectedArtigianoId(targetArtigianoId);
    setNavLevel('scheda_sospesi');
    showNotification(
      `Importate con successo ${items.length} voci nella Scheda Sospesi di ${targetArt.name}!`
    );
  };

  const handleCommitProspettoGeneraleExcel = async ({
    targetArtigianoId,
    cantieri,
  }: {
    targetArtigianoId: string;
    cantieri: Array<{
      name: string;
      city: string;
      address: string;
      client: string;
      initialInventory: number;
      finalInventory: number;
    }>;
  }) => {
    const targetArt = artigiani.find((a) => a.id === targetArtigianoId);
    if (!targetArt || cantieri.length === 0) return;

    const currentCantieri = [...targetArt.cantieri];
    const updatedOrCreatedList: Cantiere[] = [];

    for (const item of cantieri) {
      const cleanName = item.name.trim().toUpperCase();
      const existingIdx = currentCantieri.findIndex(
        (c) => c.name.trim().toUpperCase() === cleanName
      );

      if (existingIdx !== -1) {
        const existing = currentCantieri[existingIdx];
        const updated: Cantiere = {
          ...existing,
          city: item.city ? item.city.trim().toUpperCase() : existing.city,
          address: item.address ? item.address.trim().toUpperCase() : existing.address,
          client: item.client ? item.client.trim().toUpperCase() : existing.client,
          initialInventory: item.initialInventory,
          finalInventory: item.finalInventory,
          updatedAt: new Date().toISOString(),
        };
        currentCantieri[existingIdx] = updated;
        updatedOrCreatedList.push(updated);
      } else {
        const newC: Cantiere = {
          id: `cantiere-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: cleanName,
          city: item.city ? item.city.trim().toUpperCase() : 'MILANO',
          address: item.address ? item.address.trim().toUpperCase() : undefined,
          client: item.client ? item.client.trim().toUpperCase() : cleanName,
          date: new Date().toISOString().slice(0, 10),
          year: targetArt.year || 2026,
          initialInventory: item.initialInventory || 0,
          finalInventory: item.finalInventory || 0,
          category: targetArt.category || 'misto',
          status: 'attivo',
          movements: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        currentCantieri.push(newC);
        updatedOrCreatedList.push(newC);
      }
    }

    const updatedArt: Artigiano = {
      ...targetArt,
      cantieri: currentCantieri,
      updatedAt: new Date().toISOString(),
    };

    const nextList = artigiani.map((a) => (a.id === updatedArt.id ? updatedArt : a));
    updateArtigianiList(nextList);

    if (isSupabaseConfigured()) {
      try {
        for (const c of updatedOrCreatedList) {
          await upsertCantiereToSupabase(targetArtigianoId, c);
        }
      } catch (err) {
        console.error('Supabase error saving prospetto generale cantieri:', err);
      }
    }

    setSelectedArtigianoId(targetArtigianoId);
    setNavLevel('prospetto_cantieri');
    showNotification(
      `Importate/Aggiornate con successo ${cantieri.length} schede cantieri dal Prospetto Generale!`
    );
  };

  // Move an existing movement from a cantiere back to Scheda Sospesi
  const handleMoveMovementToSospesi = (cantiereId: string, movement: Movement) => {
    if (!currentArtigiano) return;

    const sourceC = currentArtigiano.cantieri?.find((c) => c.id === cantiereId);
    const newSospeso: SospesoItem = {
      id: `sosp-${Date.now()}`,
      date: movement.date,
      docNumber: movement.docNumber,
      supplier: (extractSupplierFromMovement(movement) || currentArtigiano.name).toUpperCase(),
      description: movement.typeAndSubject,
      amount: movement.purchases || movement.issued || 0,
      protocol: movement.protocol || undefined,
      client: sourceC?.client || undefined,
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

  // Move an existing movement from one cantiere to another with INVOICE ACCORPAMENTO
  const handleMoveMovementToOtherCantiere = (
    sourceCantiereId: string,
    targetCantiereId: string,
    movement: Movement
  ) => {
    if (!currentArtigiano) return;
    let notificationMsg = '';

    updateCurrentArtigiano((art) => {
      const sourceC = art.cantieri?.find((c) => c.id === sourceCantiereId);
      const targetC = art.cantieri?.find((c) => c.id === targetCantiereId);
      if (!sourceC || !targetC) return art;

      const normDoc = extractInvoiceNumberFromMovement(movement) || cleanInvoiceNum(movement.docNumber);
      const movAmount = Math.round((movement.purchases || movement.issued || 0) * 100) / 100;
      const supplier = extractSupplierFromMovement(movement) || art.name;

      // Extract existing DDT tags from moving movement
      const incomingDdtTags = extractDdtEntriesFromMovement(movement);

      // Check if this invoice is ALREADY present in target cantiere
      const existingMovIndex = targetC.movements.findIndex(
        (m) =>
          ((m.purchases || 0) !== 0 || m.source === 'xml') &&
          (
            (extractInvoiceNumberFromMovement(m) && extractInvoiceNumberFromMovement(m) === normDoc) ||
            cleanInvoiceNum(m.docNumber) === normDoc ||
            (m.xmlRef?.invoiceNum && cleanInvoiceNum(m.xmlRef.invoiceNum) === normDoc)
          ) &&
          isSameSupplier(extractSupplierFromMovement(m), supplier)
      );

      let nextTargetMovements: Movement[];

      if (existingMovIndex !== -1) {
        // ACCORPARE into the single existing movement row in destination cantiere!
        const existing = targetC.movements[existingMovIndex];
        const newPurchases = Math.round(((existing.purchases || 0) + movAmount) * 100) / 100;

        // Strictly format Tipo Doc. / Fornitore as: "FORNITORE (DDT N. ... DEL ...)" and NIENT'ALTRO
        const updatedTypeAndSubject = mergeTypeAndSubject(
          existing.typeAndSubject,
          incomingDdtTags,
          supplier,
          movement.date
        );

        const noteAddition = `Accorpato da cantiere "${sourceC.name}" (€ ${movAmount.toFixed(2)})`;
        const updatedNotes = existing.notes ? `${existing.notes} | ${noteAddition}` : noteAddition;

        const mergedMovement: Movement = {
          ...existing,
          date: movement.date && movement.date > existing.date ? movement.date : existing.date,
          purchases: newPurchases,
          typeAndSubject: updatedTypeAndSubject,
          notes: updatedNotes,
          protocol: existing.protocol || movement.protocol || '',
        };

        nextTargetMovements = targetC.movements.map((m, idx) =>
          idx === existingMovIndex ? mergedMovement : m
        );

        notificationMsg = `Fattura "${movement.docNumber}" accorpata alla riga già presente nel cantiere "${targetC.name}" (Nuovo totale fattura: € ${newPurchases.toFixed(2)})!`;
      } else {
        // Format the new movement's typeAndSubject strictly as FORNITORE (DDT N. ... DEL ...) and NIENT'ALTRO
        const formattedTypeAndSubject = incomingDdtTags.length > 0
          ? buildFormattedTypeAndSubject(supplier, incomingDdtTags)
          : (movement.typeAndSubject || supplier);

        const newMovement: Movement = {
          ...movement,
          typeAndSubject: formattedTypeAndSubject,
        };

        nextTargetMovements = [...targetC.movements, newMovement];
        notificationMsg = `Fattura / DDT "${movement.docNumber}" (€ ${movAmount.toFixed(2)}) spostata con successo nel cantiere "${targetC.name}"!`;
      }

      return {
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
              movements: nextTargetMovements,
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        }),
        updatedAt: new Date().toISOString(),
      };
    });

    if (isSupabaseConfigured()) {
      deleteMovementFromSupabase(movement.id).catch(console.error);
    }

    if (notificationMsg) {
      showNotification(notificationMsg);
    }
  };

  // Sospesi operations: 1-click move to cantiere with INVOICE ACCORPAMENTO and STRICT DDT FORMATTING
  const handleAssignSospesoToCantiere = (
    sospesoId: string,
    targetCantiereId: string
  ) => {
    let notificationMsg = '';

    updateCurrentArtigiano((art) => {
      const sosp = (art.sospesi || []).find((s) => s.id === sospesoId);
      if (!sosp) return art;

      const targetCIndex = art.cantieri.findIndex((c) => c.id === targetCantiereId);
      if (targetCIndex === -1) {
        notificationMsg = 'Cantiere di destinazione non trovato.';
        return art;
      }

      const targetC = art.cantieri[targetCIndex];
      const normDoc = cleanInvoiceNum(sosp.docNumber);
      const addAmount = Math.round((Number(sosp.amount) || 0) * 100) / 100;
      const supplier = (sosp.supplier || art.name).toUpperCase().trim();

      // Format the incoming DDT strictly as "DDT N. <numero> DEL <data in DD/MM/YYYY>"
      const ddtTag = formatSingleDdtTag(sosp.ddtNumber || sosp.description, sosp.ddtDate || sosp.date);

      // Check if this invoice is ALREADY present in target cantiere
      const existingMovIndex = targetC.movements.findIndex(
        (m) =>
          ((m.purchases || 0) !== 0 || m.source === 'xml') &&
          (
            cleanInvoiceNum(m.docNumber) === normDoc ||
            (m.xmlRef?.invoiceNum && cleanInvoiceNum(m.xmlRef.invoiceNum) === normDoc)
          )
      );

      let nextMovements: Movement[];

      if (existingMovIndex !== -1) {
        // ACCORPARE into existing movement of the same invoice!
        const existing = targetC.movements[existingMovIndex];
        const newPurchases = Math.round(((existing.purchases || 0) + addAmount) * 100) / 100;

        // Strictly format Tipo Doc. / Fornitore as: "FORNITORE (DDT N. ... DEL ..., ...)" and NIENT'ALTRO
        const updatedTypeAndSubject = mergeTypeAndSubject(
          existing.typeAndSubject,
          ddtTag ? [ddtTag] : [],
          supplier,
          sosp.date
        );

        const noteAddition = `Accorpato ${ddtTag || 'DDT'} (€ ${addAmount.toFixed(2)})${sosp.customerNote ? ` [Nota: ${sosp.customerNote}]` : ''}`;
        const updatedNotes = existing.notes ? `${existing.notes} | ${noteAddition}` : noteAddition;

        const mergedMovement: Movement = {
          ...existing,
          date: sosp.date && sosp.date > existing.date ? sosp.date : existing.date,
          purchases: newPurchases,
          typeAndSubject: updatedTypeAndSubject,
          notes: updatedNotes,
          protocol: existing.protocol || sosp.protocol || '',
          attachmentPdf: existing.attachmentPdf || sosp.attachmentPdf,
        };

        nextMovements = targetC.movements.map((m, idx) =>
          idx === existingMovIndex ? mergedMovement : m
        );

        notificationMsg = `DDT "${ddtTag || sosp.docNumber}" (€ ${addAmount.toFixed(2)}) accorpato alla fattura "${existing.docNumber}" nel cantiere "${targetC.name}" (Nuovo totale: € ${newPurchases.toFixed(2)})!`;
      } else {
        // Strictly format Tipo Doc. / Fornitore as: "FORNITORE (DDT N. ... DEL ...)" and NIENT'ALTRO
        const formattedTypeAndSubject = buildFormattedTypeAndSubject(
          supplier,
          ddtTag ? [ddtTag] : []
        );

        const newMovement: Movement = {
          id: `mov-sosp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          date: sosp.date,
          docNumber: sosp.docNumber, // Only invoice number as requested
          typeAndSubject: formattedTypeAndSubject,
          protocol: sosp.protocol || '',
          purchases: addAmount,
          issued: 0,
          source: 'xml',
          attachmentPdf: sosp.attachmentPdf,
          notes: sosp.customerNote ? `Nota: ${sosp.customerNote}` : 'Spostato da Scheda Sospesi',
          xmlRef: {
            supplier: supplier,
            invoiceNum: sosp.docNumber,
          },
        };

        nextMovements = [...targetC.movements, newMovement];
        notificationMsg = `DDT "${ddtTag || sosp.docNumber}" (€ ${addAmount.toFixed(2)}) spostato con successo nel cantiere "${targetC.name}"!`;
      }

      const nextCantieri = art.cantieri.map((c, idx) =>
        idx === targetCIndex
          ? {
              ...c,
              movements: nextMovements,
              updatedAt: new Date().toISOString(),
            }
          : c
      );

      // Remove ONLY this specific sospeso item
      const nextSospesi = (art.sospesi || []).filter((s) => s.id !== sospesoId);

      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: nextSospesi,
        updatedAt: new Date().toISOString(),
      };
    });

    if (isSupabaseConfigured()) {
      deleteSospesoFromSupabase(sospesoId).catch((err) =>
        console.error('Error removing assigned sospeso from Supabase:', err)
      );
    }

    if (notificationMsg) {
      showNotification(notificationMsg);
    }
  };

  // Bulk move multiple sospesi to cantiere with invoice accorpamento and strict formatting
  const handleAssignMultipleSospesiToCantiere = (
    sospesiIds: string[],
    targetCantiereId: string
  ) => {
    if (sospesiIds.length === 0) return;
    const targetSet = new Set(sospesiIds);
    let movedCount = 0;
    let accorpateCount = 0;
    let totalMovedAmount = 0;
    let targetCantiereName = '';

    updateCurrentArtigiano((art) => {
      const targetCIndex = art.cantieri.findIndex((c) => c.id === targetCantiereId);
      if (targetCIndex === -1) return art;

      const targetC = art.cantieri[targetCIndex];
      targetCantiereName = targetC.name;
      let workingMovements = [...targetC.movements];

      const toMoveList = (art.sospesi || []).filter((s) => targetSet.has(s.id));

      for (const sosp of toMoveList) {
        movedCount++;
        const addAmount = Math.round((Number(sosp.amount) || 0) * 100) / 100;
        totalMovedAmount += addAmount;
        const normDoc = cleanInvoiceNum(sosp.docNumber);
        const supplier = (sosp.supplier || art.name).toUpperCase().trim();
        const ddtTag = formatSingleDdtTag(sosp.ddtNumber || sosp.description, sosp.ddtDate || sosp.date);

        const existingMovIndex = workingMovements.findIndex(
          (m) =>
            ((m.purchases || 0) !== 0 || m.source === 'xml') &&
            (
              cleanInvoiceNum(m.docNumber) === normDoc ||
              (m.xmlRef?.invoiceNum && cleanInvoiceNum(m.xmlRef.invoiceNum) === normDoc)
            )
        );

        if (existingMovIndex !== -1) {
          // Accorpa into existing movement of this invoice
          accorpateCount++;
          const existing = workingMovements[existingMovIndex];
          const newPurchases = Math.round(((existing.purchases || 0) + addAmount) * 100) / 100;

          // Strictly format Tipo Doc. / Fornitore as: "FORNITORE (DDT N. ... DEL ..., ...)" and NIENT'ALTRO
          const updatedTypeAndSubject = mergeTypeAndSubject(
            existing.typeAndSubject,
            ddtTag ? [ddtTag] : [],
            supplier,
            sosp.date
          );

          const noteAdd = `Accorpato ${ddtTag || 'DDT'} (€ ${addAmount.toFixed(2)})${sosp.customerNote ? ` [Nota: ${sosp.customerNote}]` : ''}`;
          const updatedNotes = existing.notes ? `${existing.notes} | ${noteAdd}` : noteAdd;

          workingMovements[existingMovIndex] = {
            ...existing,
            date: sosp.date && sosp.date > existing.date ? sosp.date : existing.date,
            purchases: newPurchases,
            typeAndSubject: updatedTypeAndSubject,
            notes: updatedNotes,
            protocol: existing.protocol || sosp.protocol || '',
            attachmentPdf: existing.attachmentPdf || sosp.attachmentPdf,
          };
        } else {
          // Strictly format Tipo Doc. / Fornitore as: "FORNITORE (DDT N. ... DEL ...)" and NIENT'ALTRO
          const formattedTypeAndSubject = buildFormattedTypeAndSubject(
            supplier,
            ddtTag ? [ddtTag] : []
          );

          workingMovements.push({
            id: `mov-sosp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: sosp.date,
            docNumber: sosp.docNumber,
            typeAndSubject: formattedTypeAndSubject,
            protocol: sosp.protocol || '',
            purchases: addAmount,
            issued: 0,
            source: 'xml',
            attachmentPdf: sosp.attachmentPdf,
            notes: sosp.customerNote ? `Nota: ${sosp.customerNote}` : 'Spostato da Scheda Sospesi',
            xmlRef: {
              supplier: supplier,
              invoiceNum: sosp.docNumber,
            },
          });
        }
      }

      const nextCantieri = art.cantieri.map((c, idx) =>
        idx === targetCIndex
          ? {
              ...c,
              movements: workingMovements,
              updatedAt: new Date().toISOString(),
            }
          : c
      );

      const nextSospesi = (art.sospesi || []).filter((s) => !targetSet.has(s.id));

      return {
        ...art,
        cantieri: nextCantieri,
        sospesi: nextSospesi,
        updatedAt: new Date().toISOString(),
      };
    });

    if (isSupabaseConfigured()) {
      for (const id of sospesiIds) {
        deleteSospesoFromSupabase(id).catch(console.error);
      }
    }

    showNotification(
      `${movedCount} voci (€ ${totalMovedAmount.toFixed(2)}) spostate nel cantiere "${targetCantiereName}"${accorpateCount > 0 ? ` (${accorpateCount} accorpate a fatture già presenti)` : ''}!`
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
        dittaName={currentArtigiano?.name}
        onBack={() => setIsPrintCantiereView(false)}
      />
    );
  }

  if (isPrintProspettoView && currentArtigiano) {
    return (
      <PrintableProspettoReport
        artigiano={currentArtigiano}
        dataAggiornamento={dataAggiornamentoProspetto}
        onBack={() => setIsPrintProspettoView(false)}
      />
    );
  }

  if (isPrintSospesiView && currentArtigiano) {
    return (
      <PrintableSospesiReport
        sospesi={currentArtigiano.sospesi || []}
        dittaName={currentArtigiano.name}
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
        onOpenExcelImport={() => setIsExcelModalOpen(true)}
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
            onOpenExcelImport={() => setIsExcelModalOpen(true)}
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
            onOpenExcelImport={() => setIsExcelModalOpen(true)}
            onOpenFatturaEmessa={() => setIsFatturaEmessaModalOpen(true)}
            onNavigateToSospesi={() => setNavLevel('scheda_sospesi')}
            onUpdateQuadratura={handleUpdateQuadratura}
            onPrintProspetto={(date) => {
              setDataAggiornamentoProspetto(date || '');
              setIsPrintProspettoView(true);
            }}
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
            onUpdateMovementPdf={handleUpdateMovementPdf}
            onDeleteMovement={handleDeleteMovement}
            onDeleteMovementFromAllCantieri={handleDeleteMovementFromAllCantieri}
            onMoveToSospesi={(mov) => handleMoveMovementToSospesi(currentCantiere.id, mov)}
            onMoveToOtherCantiere={(sourceId, targetId, mov) => handleMoveMovementToOtherCantiere(sourceId, targetId, mov)}
            onDeleteCantiere={handleDeleteCantiere}
            onOpenXmlImport={() => setIsXmlModalOpen(true)}
            onOpenExcelImport={() => setIsExcelModalOpen(true)}
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
            onAssignMultipleToCantiere={handleAssignMultipleSospesiToCantiere}
            onUpdateSospeso={handleUpdateSospeso}
            onUpdateSospesoPdf={handleUpdateSospesoPdf}
            onDeleteSospeso={handleDeleteSospeso}
            onDeleteMultipleSospesi={handleDeleteMultipleSospesi}
            onClearAllSospesi={handleClearAllSospesi}
            onAddManualSospeso={handleAddManualSospeso}
            onOpenExcelImport={() => setIsExcelModalOpen(true)}
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
          onCreateNewCantiereDirectly={handleCreateNewCantiereDirectly}
          onOpenNewCantiere={() => {
            setIsXmlModalOpen(false);
            setCantiereToEdit(null);
            setIsCantiereModalOpen(true);
          }}
        />
      )}

      {/* Modal 2B: Import Vecchi Cantieri e Dati Storici da Excel (.xls / .xlsx) */}
      {isExcelModalOpen && (
        <ExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          artigiani={artigiani}
          currentArtigianoId={selectedArtigianoId}
          currentCantiereId={selectedCantiereId}
          onCommitSingolaScheda={handleCommitSingolaSchedaExcel}
          onCommitSospesi={handleCommitSospesiExcel}
          onCommitProspettoGenerale={handleCommitProspettoGeneraleExcel}
          isSupabaseConnected={isSupabaseConnected}
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
