import React, { useState, useRef } from 'react';
import {
  X,
  FileText,
  Upload,
  Eye,
  Trash2,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Building,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Movement, SospesoItem, Cantiere, AttachmentPdf } from '../types';
import { fileToAttachmentPdf, openOrDownloadPdf } from '../utils/pdfStorage';
import {
  findLinkedInvoiceMovementsAcrossCantieri,
  cleanInvoiceNum,
  extractInvoiceNumberFromMovement,
  extractSupplierFromMovement,
} from '../utils/invoiceDuplicateHelper';
import { formatDateItalian, formatCurrency } from '../utils/calculations';

interface PdfAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement?: Movement | null;
  sospeso?: SospesoItem | null;
  currentCantiereId?: string;
  currentCantiereName?: string;
  allCantieri?: Cantiere[];
  sospesi?: SospesoItem[];
  onSavePdf: (newPdf: AttachmentPdf | null) => void;
}

export const PdfAttachmentModal: React.FC<PdfAttachmentModalProps> = ({
  isOpen,
  onClose,
  movement,
  sospeso,
  currentCantiereId = '',
  currentCantiereName = '',
  allCantieri = [],
  sospesi = [],
  onSavePdf,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || (!movement && !sospeso)) return null;

  const currentPdf: AttachmentPdf | undefined = movement?.attachmentPdf || sospeso?.attachmentPdf;

  // Extract document info
  const docNumber = movement ? movement.docNumber : sospeso?.docNumber || '';
  const docDate = movement ? movement.date : sospeso?.date || '';
  const docTypeAndSubject = movement ? movement.typeAndSubject : `${sospeso?.supplier || ''} - ${sospeso?.description || ''}`;
  const amount = movement ? (movement.purchases !== 0 ? movement.purchases : movement.issued) : sospeso?.amount || 0;

  // Find other cantieri and sospesi linked to this same invoice
  let linkedInfo: ReturnType<typeof findLinkedInvoiceMovementsAcrossCantieri> = {
    isLinkedToMultiple: false,
    invoiceNum: '',
    supplierOrClient: '',
    otherCantieriMatches: [],
    sospesiMatches: [],
  };

  if (movement) {
    linkedInfo = findLinkedInvoiceMovementsAcrossCantieri(
      movement,
      currentCantiereId,
      allCantieri,
      sospesi
    );
  } else if (sospeso) {
    const sInv = cleanInvoiceNum(sospeso.docNumber);
    const mockMov: Movement = {
      id: sospeso.id,
      date: sospeso.date,
      docNumber: sospeso.docNumber,
      typeAndSubject: sospeso.supplier,
      protocol: sospeso.protocol || '',
      purchases: sospeso.amount,
      issued: 0,
      notes: sospeso.description,
      source: 'xml',
      xmlRef: {
        supplier: sospeso.supplier,
        invoiceNum: sospeso.docNumber,
      },
    };
    linkedInfo = findLinkedInvoiceMovementsAcrossCantieri(
      mockMov,
      '',
      allCantieri,
      (sospesi || []).filter((s) => s.id !== sospeso.id)
    );
  }

  const invoiceNum = linkedInfo.invoiceNum || cleanInvoiceNum(docNumber);
  const otherCantieriCount = linkedInfo.otherCantieriMatches.length;
  const otherSospesiCount = linkedInfo.sospesiMatches.length;
  const isMultiple = otherCantieriCount > 0 || otherSospesiCount > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Seleziona esclusivamente un file in formato PDF valido (.pdf).');
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleApplyUpload = async () => {
    if (!selectedFile) return;
    try {
      setIsProcessing(true);
      const pdfAttachment = await fileToAttachmentPdf(selectedFile);
      onSavePdf(pdfAttachment);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      console.error('Errore conversione PDF:', err);
      setErrorMessage('Errore nel salvataggio del file PDF: ' + (err.message || 'file non leggibile'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePdf = () => {
    if (confirm(`Sei sicuro di voler rimuovere il PDF da questo DDT ${isMultiple ? `e da tutti i DDT collegati alla fattura ${invoiceNum}?` : '?'}`)) {
      onSavePdf(null);
      setSelectedFile(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-fadeIn">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Gestione Allegato PDF Fattura / DDT</span>
              </h3>
              <p className="text-xs text-slate-400">
                Aggiungi, visualizza, sostituisci o rimuovi la copia PDF del documento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Document Summary Card */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <span>N° Doc:</span>
                <span className="font-mono text-white text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {docNumber}
                </span>
                {docDate && (
                  <span className="text-slate-400 font-normal ml-1">
                    del {formatDateItalian(docDate)}
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-rose-300 text-sm">
                {formatCurrency(amount)}
              </span>
            </div>

            <div className="text-xs text-slate-300 font-semibold truncate" title={docTypeAndSubject}>
              {docTypeAndSubject}
            </div>

            {currentCantiereName && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Building className="h-3 w-3 text-slate-500" />
                <span>Cantiere: <strong className="text-slate-200">{currentCantiereName}</strong></span>
              </div>
            )}
          </div>

          {/* Cross-Cantiere Multi-DDT Synchronization Alert */}
          {isMultiple && (
            <div className="p-3.5 bg-indigo-950/40 border-2 border-indigo-500/50 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>Sincronizzazione Automatica Multi-Cantiere:</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Questo DDT fa parte della fattura <strong className="text-white font-mono">{invoiceNum || docNumber}</strong>, presente su più cantieri o schede.
                Allegando, sostituendo o rimuovendo il PDF, <strong className="text-indigo-200 underline">la modifica verrà applicata automaticamente a tutti i DDT e movimenti di questa fattura</strong>:
              </p>

              <div className="space-y-1 pt-1 max-h-32 overflow-y-auto pr-1">
                {currentCantiereName && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-slate-700/60 text-[11px]">
                    <span className="text-emerald-400 font-semibold truncate">
                      ✓ {currentCantiereName} (DDT corrente)
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">{formatCurrency(amount)}</span>
                  </div>
                )}
                {linkedInfo.otherCantieriMatches.map((match, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-indigo-500/30 text-[11px]">
                    <span className="text-indigo-200 truncate" title={match.cantiereName}>
                      • {match.cantiereName} ({match.movement.typeAndSubject.slice(0, 30)}...)
                    </span>
                    <span className="text-rose-300 font-mono text-[10px]">
                      {formatCurrency(match.movement.purchases)}
                    </span>
                  </div>
                ))}
                {linkedInfo.sospesiMatches.map((s, idx) => (
                  <div key={`sosp-${idx}`} className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-amber-500/30 text-[11px]">
                    <span className="text-amber-300 truncate">
                      • Scheda Sospesi ({s.ddtNumber || s.docNumber})
                    </span>
                    <span className="text-amber-300 font-mono text-[10px]">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Attached PDF Card */}
          {currentPdf && !selectedFile && (
            <div className="p-4 bg-red-950/20 border border-red-500/40 rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block">
                      PDF Attualmente Allegato
                    </span>
                    <h4 className="text-sm font-bold text-white truncate max-w-xs" title={currentPdf.fileName}>
                      {currentPdf.fileName}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {Math.round(currentPdf.fileSize / 1024)} KB
                      {currentPdf.uploadedAt && ` • ${formatDateItalian(currentPdf.uploadedAt)}`}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold uppercase">
                  Attivo
                </span>
              </div>

              {/* Action Buttons for Existing PDF */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openOrDownloadPdf(currentPdf)}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  title="Visualizza o scarica il PDF allegato"
                >
                  <Eye className="h-4 w-4" />
                  <span>Visualizza / Apri PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Sostituisci il PDF con un altro file"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
                  <span>Sostituisci</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemovePdf}
                  className="py-2 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Rimuovi questo PDF da questo DDT e da tutti i DDT collegati"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Rimuovi</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload New / Replacement PDF Section */}
          {(!currentPdf || selectedFile) && (
            <div className="space-y-3">
              <input
                type="file"
                accept=".pdf,application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                id="pdf-modal-input"
              />

              {!selectedFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-red-500/70 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors group"
                >
                  <Paperclip className="h-8 w-8 text-red-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white block">
                    Trascina qui il file PDF della fattura / DDT oppure clicca per sceglierlo
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Formato PDF (.pdf) • Il file verrà memorizzato e collegato a tutti i DDT della fattura
                  </span>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-red-500/50 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-5 w-5 text-red-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-amber-400 block">
                          Nuovo File Selezionato:
                        </span>
                        <span className="font-bold text-white truncate block">
                          {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {Math.round(selectedFile.size / 1024)} KB
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-slate-400 hover:text-white rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleApplyUpload}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {isProcessing
                          ? 'Salvataggio in corso...'
                          : isMultiple
                          ? `Conferma e Allega a Tutti i DDT (${otherCantieriCount + 1} cantieri)`
                          : 'Conferma e Allega PDF al DDT'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>
            {isMultiple
              ? `Collegamento attivo: la modifica interessa ${otherCantieriCount + 1} cantieri`
              : 'Gestione allegato documento'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
