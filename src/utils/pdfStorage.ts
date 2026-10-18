import { AttachmentPdf } from '../types';

const DB_NAME = 'zcantieri_pdf_storage';
const STORE_NAME = 'pdf_files';
const DB_VERSION = 1;

function openPdfDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponibile nel browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore apertura IndexedDB PDF'));
  });
}

/**
 * Salva l'allegato PDF in IndexedDB per non appesantire il LocalStorage
 */
export async function savePdfToIndexedDB(attachment: AttachmentPdf): Promise<void> {
  if (!attachment.id || !attachment.dataUrl) return;

  try {
    const db = await openPdfDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        dataUrl: attachment.dataUrl,
        uploadedAt: attachment.uploadedAt,
      });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Impossibile salvare PDF in IndexedDB, fallback in memoria:', err);
  }
}

/**
 * Recupera l'allegato PDF da IndexedDB tramite ID
 */
export async function getPdfFromIndexedDB(id: string): Promise<AttachmentPdf | null> {
  if (!id) return null;

  try {
    const db = await openPdfDB();
    return await new Promise<AttachmentPdf | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Errore lettura PDF da IndexedDB:', err);
    return null;
  }
}

/**
 * Cancella un PDF da IndexedDB
 */
export async function deletePdfFromIndexedDB(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openPdfDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Errore eliminazione PDF da IndexedDB:', err);
  }
}

/**
 * Converte un file PDF caricato da input in AttachmentPdf con dataUrl base64
 */
export function fileToAttachmentPdf(file: File): Promise<AttachmentPdf> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const id = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const attachment: AttachmentPdf = {
        id,
        fileName: file.name,
        fileSize: file.size,
        dataUrl: result,
        uploadedAt: new Date().toISOString(),
      };
      // Salva asincronamente in IndexedDB
      savePdfToIndexedDB(attachment).catch(console.error);
      resolve(attachment);
    };
    reader.onerror = () => reject(reader.error || new Error('Errore lettura file PDF'));
    reader.readAsDataURL(file);
  });
}

/**
 * Apre il PDF in una nuova scheda o triggera il download
 */
export function openOrDownloadPdf(attachment: AttachmentPdf) {
  if (!attachment.dataUrl) {
    alert('Contenuto PDF non disponibile');
    return;
  }

  try {
    // Prova ad aprire blob url
    const byteCharacters = atob(attachment.dataUrl.split(',')[1] || '');
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    const win = window.open(blobUrl, '_blank');
    if (!win) {
      // Fallback a download se popup bloccato
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = attachment.fileName || 'fattura.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (e) {
    // Fallback diretto con a link
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.fileName || 'fattura.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
