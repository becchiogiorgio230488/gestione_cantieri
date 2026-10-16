export type CantiereCategory = 'elettrico' | 'idraulico' | 'edile' | 'misto' | 'altro';
export type CantiereStatus = 'attivo' | 'completato' | 'preventivo' | 'sospeso';

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
  notes?: string;
  movements: Movement[];
  createdAt: string;
  updatedAt: string;
}

export interface SospesoItem {
  id: string;
  date: string;
  docNumber: string;
  supplier: string;
  description: string;
  amount: number;
  protocol?: string;
  ddtNumber?: string;
  ddtDate?: string;
  status: 'in_attesa_cliente' | 'attribuito' | 'scartato';
  customerNote?: string; // Note / domanda per il cliente
  suggestedCantiereId?: string;
  sourceFileName?: string;
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
    causale?: string;
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
  prezzoTotale: number;
  aliquotaIVA?: number;
  codiceArticolo?: string;
  ddtNumero?: string;
  ddtData?: string;
}

export interface InvoiceDDT {
  numeroDDT: string;
  dataDDT?: string;
  riferimentoLinee: number[];
  totaleDDT?: number;
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
    tipoDocumento: string; // es. TD01
    divisa: string;
    data: string;
    numero: string;
    importoTotale: number;
    causale?: string[];
  };
  ddtList: InvoiceDDT[];
  righe: InvoiceLine[];
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
