export type CantiereCategory = 'elettrico' | 'idraulico' | 'edile' | 'misto' | 'altro';
export type CantiereStatus = 'attivo' | 'completato' | 'preventivo' | 'sospeso';

export interface AttachmentPdf {
  id?: string;
  fileName: string;
  fileSize: number;
  dataUrl?: string; // Data URL Base64 "data:application/pdf;base64,..."
  fileUrl?: string; // URL online public o signed da Supabase Storage
  storagePath?: string; // Percorso del file nel bucket Supabase Storage (es. fatture-pdf/...)
  uploadedAt: string;
}

export interface Movement {
  id: string;
  date: string; // DATA DOC. (YYYY-MM-DD or DD/MM/YYYY)
  docNumber: string; // N° DOC. (es. Fatt. 12/E, DDT 45, etc.)
  typeAndSubject: string; // TIPO DOC. / FORNITORE / CLIENTE
  protocol: string; // N./PROT (numero di protocollo o registro interno)
  purchases: number; // ACQUISTI (costi)
  issued: number; // EMESSE (fatturato / ricavi)
  notes?: string;
  source?: 'manuale' | 'xml' | 'fattura_emessa';
  attachmentPdf?: AttachmentPdf;
  xmlRef?: {
    supplier?: string;
    invoiceNum?: string;
    ddtNum?: string;
    lineId?: number;
  };
}

export interface Cantiere {
  id: string;
  name: string; // NOME CANTIERE
  city: string; // CITTÀ
  address?: string; // INDIRIZZO (es. Via Roma 15)
  date: string; // DATA INIZIO / REGISTRAZIONE
  year: number; // ANNO (default 2026)
  client: string; // DITTA / CLIENTE
  initialInventory: number; // RIMANENZE INIZIALI (RI)
  finalInventory: number; // RIMANENZE FINALI (RF)
  category: CantiereCategory;
  status: CantiereStatus;
  isMagazzino?: boolean; // Contrassegna se il cantiere è un Magazzino
  notes?: string;
  movements: Movement[];
  createdAt: string;
  updatedAt: string;
}

export interface SospesoItem {
  id: string;
  date: string;
  docNumber: string; // N° DOC. (numero fattura)
  supplier: string; // FORNITORE (sempre in maiuscolo)
  description: string;
  amount: number;
  client?: string; // CLIENTE
  protocol?: string; // N./PROT (protocollo di registrazione contabile)
  ddtNumber?: string;
  ddtDate?: string;
  status: 'in_attesa_cliente' | 'attribuito' | 'scartato';
  customerNote?: string; // Note / domanda per il cliente
  internalNote?: string; // NOTA INTERNA (solo a video, NON stampata né esportata in Excel)
  suggestedCantiereId?: string;
  sourceFileName?: string;
  attachmentPdf?: AttachmentPdf;
  createdAt: string;
}

export interface MastrinoItem {
  id: string;
  code?: string; // es. 04.01.001
  description: string; // es. "Merci c/acquisti", "Materiali consumo", "Lavorazioni terzi"
  amount: number;
}

export interface QuadraturaContabile {
  mastrinoAcquisti: number; // Totale Contabilità Generale Mastri Costi (somma mastrini o manuale)
  mastrinoVendite: number; // Totale Contabilità Generale Mastri Ricavi (somma mastrini o manuale)
  mastriniAcquistiDetails?: MastrinoItem[]; // Elenco mastrini multipli lato acquisti
  mastriniVenditeDetails?: MastrinoItem[]; // Elenco mastrini multipli lato vendite/emesse
  notes?: string;
  dataVerifica?: string;
}

export interface ParsedFatturaEmessaXML {
  fileName: string;
  committente: {
    denominazione: string;
    nome?: string;
    cognome?: string;
    partitaIva?: string;
    codiceFiscale?: string;
    indirizzo: string;
    cap?: string;
    comune: string;
    provincia?: string;
  };
  indirizzoTestata: string;
  indirizzoCorpo?: string;
  indirizzoCantiereProposto: string;
  regolaIndirizzoApplicata: 'corpo_diverso' | 'sede_testata';
  spiegazioneRegola: string;
  datiDocumento: {
    tipoDocumento: string;
    numero: string;
    data: string;
    importoTotale: number;
    imponibileTotale: number;
    isNotaCredito?: boolean;
    causale?: string;
    riepilogoIVA?: Array<{
      aliquotaIVA: number;
      imponibile: number;
      imposta: number;
      natura?: string;
    }>;
  };
  protocolloSuggerito: string;
  righe: Array<{
    numeroLinea: number;
    descrizione: string;
    prezzoTotale: number;
    aliquotaIVA?: number;
  }>;
  nomeCantiereSuggerito: string;
  cittaCantiereSuggerita: string;
  rawXml?: string;
}

export type NavigationLevel =
  | 'home_artigiani' // Livello 1: Elenco dei Miei Clienti / Artigiani
  | 'prospetto_cantieri' // Livello 2: Prospetto Generale Cantieri dell'Artigiano
  | 'scheda_cantiere' // Livello 3: Scheda Dettaglio Singolo Cantiere (Z-2026)
  | 'scheda_sospesi'; // Scheda Sospesi (DDT da Attribuire) dell'Artigiano

export interface MagazzinoData {
  initialInventory: number;
  purchases: number;
  issued: number;
  notes?: string;
}

export interface Artigiano {
  id: string; // es. 'art-sirna'
  name: string; // es. 'Sirna Massimo'
  businessName?: string; // es. 'Sirna Massimo Impianti Elettrici & Domotica'
  partitaIva?: string;
  codiceFiscale?: string;
  city?: string;
  address?: string;
  category: CantiereCategory;
  phone?: string;
  email?: string;
  year: number; // default 2026 / 2025
  notes?: string;
  quadratura: QuadraturaContabile;
  cantieri: Cantiere[];
  sospesi: SospesoItem[];
  magazzino?: MagazzinoData;
  createdAt: string;
  updatedAt: string;
}


export interface InvoiceLine {
  numeroLinea: number;
  descrizione: string;
  quantita?: number;
  unitaMisura?: string;
  prezzoUnitario?: number;
  prezzoTotale: number; // Segno algebrico reale conservato al centesimo
  aliquotaIVA?: number;
  codiceArticolo?: string;
  ddtNumero?: string;
  ddtData?: string;
  isDescriptive?: boolean; // Riga puramente descrittiva o importo zero
  isReturnOrDiscount?: boolean; // Reso / storno o sconto a valore negativo
  isOrphanExpense?: boolean; // Oneri accessori slegati da DDT (es. spese incasso, Ri.Ba., bolli, CONAI)
  suggestedDestination?: string; // Destinazione/cantiere estratto dalla descrizione della riga
}

export interface InvoiceDDT {
  numeroDDT: string;
  dataDDT?: string;
  riferimentoLinee: number[];
  totaleDDT?: number; // Somma algebrica delle linee collegate (comprensiva di eventuali resi negativi)
  lineCount?: number;
  destinazioneMerce?: string; // Destinazione o cantiere dedotto dal blocco DDT o dalle righe descrittive
  hasNegativeLines?: boolean; // Indica se contiene righe di reso / storno
  importoResi?: number; // Totale degli storni/resi negativi presenti nel DDT
}

export interface InvoiceQuadraturaInfo {
  imponibileRiepilogo: number; // Somma imponibili da DatiRiepilogo
  impostaRiepilogo: number; // Somma imposte da DatiRiepilogo
  totaleRighe: number; // Somma algebrica di tutte le righe (merce + resi + oneri)
  totaleDocumento: number; // ImportoTotaleDocumento da DatiGeneraliDocumento
  differenzaQuadratura: number; // Scostamento tra totale righe e imponibile riepilogo
  isQuadraturaPerfetta: boolean; // true se differenza < 0.01 €
  arrotondamento?: number; // Eventuale arrotondamento presente nel file XML
}

export interface ParsedInvoiceXML {
  fileName: string;
  cedentePrestatore: {
    denominazione: string;
    partitaIva: string;
    codiceFiscale?: string;
    indirizzo?: string;
    cap?: string;
    comune?: string;
    provincia?: string;
  };
  datiDocumento: {
    tipoDocumento: string; // es. TD01, TD04
    isNotaDiCredito?: boolean; // TD04 o documento di accredito/storno
    divisa: string;
    data: string;
    numero: string;
    importoTotale: number;
    totaleImponibile: number;
    totaleImposta?: number;
    arrotondamento?: number;
    riepilogoIVA?: Array<{
      aliquotaIVA: number;
      imponibile: number;
      imposta: number;
      natura?: string;
    }>;
    causale?: string[];
  };
  ddtList: InvoiceDDT[];
  righe: InvoiceLine[];
  // Motore di normalizzazione intelligente:
  orphanExpenses: InvoiceLine[]; // Oneri accessori finali/orfani slegati da DDT (es. spese incasso, CONAI, spese amministrative)
  totaleOneriAccessori: number; // Somma totale degli oneri accessori orfani
  quadratura: InvoiceQuadraturaInfo; // Dati completi di quadratura contabile
  pdfAttachment?: AttachmentPdf;
  rawXml?: string;
}

export interface ItemAllocation {
  id: string; // riga_{numeroLinea} or ddt_{numeroDDT} or 'whole_invoice'
  type: 'line' | 'ddt' | 'whole';
  label: string;
  amount: number;
  description: string;
  ddtNumber?: string;
  ddtDate?: string;
  allocations: Array<{
    cantiereId: string;
    amount: number;
    percentage: number;
  }>;
  aiSuggestion?: {
    suggestedCantiereId: string;
    confidence: number;
    reasoning: string;
  };
}

export type BackupType = 'FULL_BACKUP' | 'SINGLE_CLIENT_BACKUP';

export interface FullBackupPayload {
  version: string;
  type: 'FULL_BACKUP';
  description: string;
  exportedAt: string;
  totalClients: number;
  totalCantieri: number;
  totalSospesi?: number;
  artigiani: Artigiano[];
}

export interface SingleClientBackupPayload {
  version: string;
  type: 'SINGLE_CLIENT_BACKUP';
  description: string;
  exportedAt: string;
  clientId: string;
  clientName: string;
  clientBusinessName?: string;
  totalCantieri: number;
  totalSospesi: number;
  artigiano: Artigiano;
  // Compatibilità per importatori che si aspettano l'array
  artigiani?: Artigiano[];
}

export type BackupPayload = FullBackupPayload | SingleClientBackupPayload;

export interface ParsedBackupInfo {
  isValid: boolean;
  error?: string;
  type: BackupType | 'LEGACY';
  version?: string;
  exportedAt?: string;
  totalClients: number;
  clients: Artigiano[];
  singleClientInfo?: {
    id: string;
    name: string;
    businessName?: string;
    cantieriCount: number;
    sospesiCount: number;
  };
}
