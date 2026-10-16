import { ParsedInvoiceXML, InvoiceLine, InvoiceDDT, ParsedFatturaEmessaXML } from '../types';

/**
 * Safely parses string or XML node text, ignoring namespaces
 */
function getTagText(parent: Element, tagName: string): string {
  // Try direct tag name
  let el = parent.getElementsByTagName(tagName)[0];
  if (el && el.textContent) {
    return el.textContent.trim();
  }
  // Try searching through all children ignoring prefix
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const item = allElements[i];
    const local = item.localName || item.nodeName.split(':').pop();
    if (local?.toLowerCase() === tagName.toLowerCase() && item.textContent) {
      return item.textContent.trim();
    }
  }
  return '';
}

function getElements(parent: Element | Document, tagName: string): Element[] {
  const direct = parent.getElementsByTagName(tagName);
  if (direct && direct.length > 0) {
    return Array.from(direct);
  }
  const results: Element[] = [];
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const item = allElements[i];
    const local = item.localName || item.nodeName.split(':').pop();
    if (local?.toLowerCase() === tagName.toLowerCase()) {
      results.push(item);
    }
  }
  return results;
}

/**
 * Parses Italian Fattura Elettronica (FPR12, FPA12 B2B/PA) XML string
 */
export function parseFatturaElettronicaXML(xmlString: string, fileName = 'fattura.xml'): ParsedInvoiceXML {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('Formato XML non valido o file corrotto: ' + (parseError.textContent || 'errore sconosciuto'));
  }

  // 1. Cedente / Prestatore (Fornitore)
  const cedenteEl = getElements(xmlDoc, 'CedentePrestatore')[0];
  let denominazione = '';
  let partitaIva = '';
  let codiceFiscale = '';
  let indirizzo = '';
  let cap = '';
  let comune = '';
  let provincia = '';

  if (cedenteEl) {
    const anagraficaEl = getElements(cedenteEl, 'Anagrafica')[0];
    if (anagraficaEl) {
      denominazione = getTagText(anagraficaEl, 'Denominazione');
      if (!denominazione) {
        const nome = getTagText(anagraficaEl, 'Nome');
        const cognome = getTagText(anagraficaEl, 'Cognome');
        denominazione = `${nome} ${cognome}`.trim();
      }
    }
    const idFiscaleIVA = getElements(cedenteEl, 'IdFiscaleIVA')[0];
    if (idFiscaleIVA) {
      const paese = getTagText(idFiscaleIVA, 'IdPaese');
      const codice = getTagText(idFiscaleIVA, 'IdCodice');
      partitaIva = `${paese}${codice}`.trim();
    }
    codiceFiscale = getTagText(cedenteEl, 'CodiceFiscale');

    const sedeEl = getElements(cedenteEl, 'Sede')[0];
    if (sedeEl) {
      indirizzo = getTagText(sedeEl, 'Indirizzo');
      cap = getTagText(sedeEl, 'CAP');
      comune = getTagText(sedeEl, 'Comune');
      provincia = getTagText(sedeEl, 'Provincia');
    }
  }

  // 2. Dati Generali Documento
  const datiGeneraliDocEl = getElements(xmlDoc, 'DatiGeneraliDocumento')[0];
  let tipoDocumento = 'TD01';
  let divisa = 'EUR';
  let data = '';
  let numero = '';
  let importoTotale = 0;
  const causale: string[] = [];

  if (datiGeneraliDocEl) {
    tipoDocumento = getTagText(datiGeneraliDocEl, 'TipoDocumento') || 'TD01';
    divisa = getTagText(datiGeneraliDocEl, 'Divisa') || 'EUR';
    data = getTagText(datiGeneraliDocEl, 'Data');
    numero = getTagText(datiGeneraliDocEl, 'Numero');
    const totStr = getTagText(datiGeneraliDocEl, 'ImportoTotaleDocumento');
    if (totStr) {
      importoTotale = parseFloat(totStr.replace(',', '.'));
    }

    const causaleElements = getElements(datiGeneraliDocEl, 'Causale');
    for (const cEl of causaleElements) {
      if (cEl.textContent) {
        causale.push(cEl.textContent.trim());
      }
    }
  }

  // 3. Dati DDT (Documenti di Trasporto associati alla fattura)
  const ddtElements = getElements(xmlDoc, 'DatiDDT');
  const ddtList: InvoiceDDT[] = [];
  const lineToDdtMap = new Map<number, { numeroDDT: string; dataDDT?: string }>();

  for (const ddtEl of ddtElements) {
    const numeroDDT = getTagText(ddtEl, 'NumeroDDT');
    const dataDDT = getTagText(ddtEl, 'DataDDT');
    const rifLineeEl = getElements(ddtEl, 'RiferimentoNumeroLinea');
    const riferimentoLinee: number[] = [];

    for (const rEl of rifLineeEl) {
      const lineNum = parseInt(rEl.textContent?.trim() || '0', 10);
      if (lineNum > 0) {
        riferimentoLinee.push(lineNum);
        lineToDdtMap.set(lineNum, { numeroDDT, dataDDT });
      }
    }

    if (numeroDDT) {
      ddtList.push({
        numeroDDT,
        dataDDT,
        riferimentoLinee,
        totaleDDT: 0,
      });
    }
  }

  // 4. Righe DettaglioLinee (corpo della fattura)
  const dettaglioLineeElements = getElements(xmlDoc, 'DettaglioLinee');
  const righe: InvoiceLine[] = [];
  let calculatedLinesSum = 0;

  for (const lineEl of dettaglioLineeElements) {
    const numLineaStr = getTagText(lineEl, 'NumeroLinea');
    const numeroLinea = parseInt(numLineaStr, 10) || righe.length + 1;
    const descrizione = getTagText(lineEl, 'Descrizione');
    const quantitaStr = getTagText(lineEl, 'Quantita');
    const unitaMisura = getTagText(lineEl, 'UnitaMisura');
    const prezzoUnitarioStr = getTagText(lineEl, 'PrezzoUnitario');
    const prezzoTotaleStr = getTagText(lineEl, 'PrezzoTotale');
    const aliquotaIVAStr = getTagText(lineEl, 'AliquotaIVA');

    const quantita = quantitaStr ? parseFloat(quantitaStr.replace(',', '.')) : undefined;
    const prezzoUnitario = prezzoUnitarioStr ? parseFloat(prezzoUnitarioStr.replace(',', '.')) : undefined;
    const prezzoTotale = prezzoTotaleStr ? parseFloat(prezzoTotaleStr.replace(',', '.')) : 0;
    const aliquotaIVA = aliquotaIVAStr ? parseFloat(aliquotaIVAStr.replace(',', '.')) : undefined;

    // Check for CodiceArticolo
    let codiceArticolo = '';
    const codArtEl = getElements(lineEl, 'CodiceArticolo')[0];
    if (codArtEl) {
      codiceArticolo = getTagText(codArtEl, 'CodiceValore');
    }

    const ddtInfo = lineToDdtMap.get(numeroLinea);

    righe.push({
      numeroLinea,
      descrizione: descrizione || `Articolo riga ${numeroLinea}`,
      quantita,
      unitaMisura,
      prezzoUnitario,
      prezzoTotale: isNaN(prezzoTotale) ? 0 : Math.round(prezzoTotale * 100) / 100,
      aliquotaIVA,
      codiceArticolo,
      ddtNumero: ddtInfo?.numeroDDT,
      ddtData: ddtInfo?.dataDDT,
    });

    if (!isNaN(prezzoTotale)) {
      calculatedLinesSum += prezzoTotale;
    }
  }

  // Calculate DDT subtotals
  for (const ddt of ddtList) {
    let ddtSum = 0;
    for (const lineNum of ddt.riferimentoLinee) {
      const match = righe.find((r) => r.numeroLinea === lineNum);
      if (match) {
        ddtSum += match.prezzoTotale;
      }
    }
    ddt.totaleDDT = Math.round(ddtSum * 100) / 100;
  }

  // If importoTotale was 0 or missing, use calculated lines sum
  if (importoTotale === 0 && calculatedLinesSum > 0) {
    importoTotale = Math.round(calculatedLinesSum * 100) / 100;
  }

  return {
    fileName,
    cedentePrestatore: {
      denominazione: denominazione || 'Fornitore non specificato',
      partitaIva: partitaIva || 'N/D',
      codiceFiscale,
      indirizzo,
      cap,
      comune,
      provincia,
    },
    datiDocumento: {
      tipoDocumento,
      divisa,
      data,
      numero: numero || 'N/D',
      importoTotale: Math.round(importoTotale * 100) / 100,
      causale,
    },
    ddtList,
    righe,
    rawXml: xmlString,
  };
}

/**
 * Cleans an address string to keep ONLY the street and house number (via e numero civico),
 * strictly removing cadastral info (foglio, particella, subalterno, mappale, etc.),
 * postal codes, and city / notes.
 */
export function cleanStreetAndCivicoOnly(addr: string): string {
  if (!addr) return '';
  let cleaned = addr.trim();

  // Strip introductory prefixes
  cleaned = cleaned.replace(/^(?:cantiere(?:\s+sito)?\s+in|cantiere\s+presso|lavori\s+presso|immobile\s+(?:sito\s+)?in|consegna\s+(?:presso|a)|destinazione\s*:?|c\/o\s+[^,]+,?\s*)\s*:?\s*/i, '');

  // Strip cadastral details and everything following
  const cadastralRegex = /(?:[,\s\-\/;]+)?\s*(?:dati\s+catastali|catasto(?:\s+urbano)?|n\.?c\.?e\.?u\.?|n\.?c\.?t\.?|fg\.?|foglio|part\.?|particella|sub\.?|subalterno|mapp\.?|mappale|sez\.?|sezione)\b.*$/i;
  cleaned = cleaned.replace(cadastralRegex, '');

  // Strip postal code (5 digits) and anything following
  cleaned = cleaned.replace(/(?:[,\s\-\/;]+)?\s*\b\d{5}\b.*$/, '');

  // Strip province in parentheses e.g. "(MB)", "(MI)"
  cleaned = cleaned.replace(/\s*\([A-Za-z]{2}\)\s*$/i, '');

  // If there is a city separated by comma after a street + house number
  const streetWithCivicoAndTownMatch = cleaned.match(/^((?:via|viale|corso|piazza|piazzale|largo|strada|vicolo|contrada|borgo|vico|traversa)\s+[^,]+?\s+\d+[\/\w\s\-]*(?:[a-zA-Z]|\b))\s*,\s*[A-Za-z\s'\.\-]+$/i);
  if (streetWithCivicoAndTownMatch && streetWithCivicoAndTownMatch[1]) {
    cleaned = streetWithCivicoAndTownMatch[1].trim();
  }

  // Strip trailing punctuation
  cleaned = cleaned.replace(/[,\s\-\/;:\.]+$/, '').trim();

  return (cleaned || addr.trim()).toUpperCase();
}

/**
 * Extracts the cantiere name in UPPERCASE from Cognome and Nome (or Denominazione),
 * strictly without the word "Cantiere" and without the town in parentheses.
 */
export function extractCantiereNameFromClient(
  cognome?: string,
  nome?: string,
  denominazione?: string
): string {
  let raw = '';
  if (cognome && nome) {
    raw = `${cognome} ${nome}`;
  } else if (cognome) {
    raw = cognome;
  } else if (nome) {
    raw = nome;
  } else if (denominazione) {
    raw = denominazione;
  } else {
    raw = 'COMMITTENTE';
  }

  // Remove "Cantiere", "Cantiere di", "Cantiere -", "Cantiere :"
  raw = raw.replace(/^cantiere\s*(?:di\s*|sito\s*in\s*|-|:)?\s*/i, '');
  // Remove any town or notes in parentheses e.g. "(Monza)", "(Milano)", "(MB)"
  raw = raw.replace(/\s*\([^)]*\)/g, '');

  return raw.trim().toUpperCase() || 'COMMITTENTE';
}

/**
 * Normalizes an address string for comparison (lowercase, trimmed, standard spaces)
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[,\.\-\/\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses an Issued Invoice XML (Fattura Emessa dall'Artigiano)
 * Evaluates Header vs Body for Cantiere Address rule:
 * - If body (IndirizzoResa / Righe / AltriDatiGestionali) contains a distinct address, that becomes the cantiere address.
 * - Otherwise, the header address (CessionarioCommittente sede) is used.
 * - Cantiere address strictly contains only via e numero civico (cadastral info stripped).
 * - Cantiere name is strictly uppercase Cognome Nome (no "cantiere", no town in parentheses).
 * - Internal protocol defaults to invoice number.
 */
export function parseFatturaEmessaXML(xmlString: string, fileName = 'fattura_emessa.xml'): ParsedFatturaEmessaXML {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('Formato XML non valido o file corrotto: ' + (parseError.textContent || 'errore sconosciuto'));
  }

  // 1. Cessionario / Committente (Il Cliente dell'artigiano)
  const cessionarioEl = getElements(xmlDoc, 'CessionarioCommittente')[0];
  let denominazione = '';
  let nome = '';
  let cognome = '';
  let partitaIva = '';
  let codiceFiscale = '';
  let indirizzoTestataVia = '';
  let capTestata = '';
  let comuneTestata = '';
  let provinciaTestata = '';

  if (cessionarioEl) {
    const anagraficaEl = getElements(cessionarioEl, 'Anagrafica')[0];
    if (anagraficaEl) {
      denominazione = getTagText(anagraficaEl, 'Denominazione');
      nome = getTagText(anagraficaEl, 'Nome');
      cognome = getTagText(anagraficaEl, 'Cognome');
      if (!denominazione) {
        if (cognome && nome) {
          denominazione = `${cognome} ${nome}`.trim();
        } else {
          denominazione = `${nome} ${cognome}`.trim();
        }
      }
    }
    const idFiscaleIVA = getElements(cessionarioEl, 'IdFiscaleIVA')[0];
    if (idFiscaleIVA) {
      const paese = getTagText(idFiscaleIVA, 'IdPaese');
      const codice = getTagText(idFiscaleIVA, 'IdCodice');
      partitaIva = `${paese}${codice}`.trim();
    }
    codiceFiscale = getTagText(cessionarioEl, 'CodiceFiscale');

    const sedeEl = getElements(cessionarioEl, 'Sede')[0];
    if (sedeEl) {
      indirizzoTestataVia = getTagText(sedeEl, 'Indirizzo');
      capTestata = getTagText(sedeEl, 'CAP');
      comuneTestata = getTagText(sedeEl, 'Comune');
      provinciaTestata = getTagText(sedeEl, 'Provincia');
    }
  }

  // Construct full header address for preview
  const headerAddressParts = [indirizzoTestataVia, capTestata, comuneTestata, provinciaTestata ? `(${provinciaTestata})` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  const indirizzoTestata = headerAddressParts || 'Indirizzo sede non specificato in testata';

  // Clean street and civico only for testata
  const indirizzoTestataViaPulito = cleanStreetAndCivicoOnly(indirizzoTestataVia) || cleanStreetAndCivicoOnly(indirizzoTestata);

  // 2. Dati Generali Documento
  const datiGeneraliDocEl = getElements(xmlDoc, 'DatiGeneraliDocumento')[0];
  let tipoDocumento = 'TD01';
  let data = new Date().toISOString().slice(0, 10);
  let numero = '';
  let importoTotale = 0;
  let causaleText = '';

  if (datiGeneraliDocEl) {
    tipoDocumento = getTagText(datiGeneraliDocEl, 'TipoDocumento') || 'TD01';
    data = getTagText(datiGeneraliDocEl, 'Data') || data;
    numero = getTagText(datiGeneraliDocEl, 'Numero');
    const totStr = getTagText(datiGeneraliDocEl, 'ImportoTotaleDocumento');
    if (totStr) {
      importoTotale = parseFloat(totStr.replace(',', '.'));
    }
    const causaleEls = getElements(datiGeneraliDocEl, 'Causale');
    if (causaleEls.length > 0) {
      causaleText = causaleEls.map((c) => c.textContent?.trim() || '').filter(Boolean).join(' - ');
    }
  }

  // 3. Inspect Body for Cantiere / Destination / Resa Address
  let indirizzoCorpo = '';
  let cittaCorpo = '';

  // 3a. Check DatiTrasporto -> IndirizzoResa
  const indirizzoResaEl = getElements(xmlDoc, 'IndirizzoResa')[0];
  if (indirizzoResaEl) {
    const viaResa = getTagText(indirizzoResaEl, 'Indirizzo');
    const comuneResa = getTagText(indirizzoResaEl, 'Comune');
    if (viaResa || comuneResa) {
      indirizzoCorpo = viaResa || '';
      cittaCorpo = comuneResa;
    }
  }

  // 3b. Check DettaglioLinee (and AltriDatiGestionali)
  const dettaglioLineeElements = getElements(xmlDoc, 'DettaglioLinee');
  const righe: Array<{
    numeroLinea: number;
    descrizione: string;
    prezzoTotale: number;
    aliquotaIVA?: number;
  }> = [];
  let calculatedImponibileSum = 0;

  for (const lineEl of dettaglioLineeElements) {
    const numLineaStr = getTagText(lineEl, 'NumeroLinea');
    const numeroLinea = parseInt(numLineaStr, 10) || righe.length + 1;
    const descrizione = getTagText(lineEl, 'Descrizione');
    const prezzoTotaleStr = getTagText(lineEl, 'PrezzoTotale');
    const aliquotaIVAStr = getTagText(lineEl, 'AliquotaIVA');

    const prezzoTotale = prezzoTotaleStr ? parseFloat(prezzoTotaleStr.replace(',', '.')) : 0;
    const aliquotaIVA = aliquotaIVAStr ? parseFloat(aliquotaIVAStr.replace(',', '.')) : undefined;

    righe.push({
      numeroLinea,
      descrizione: descrizione || `Prestazione / Lavori riga ${numeroLinea}`,
      prezzoTotale: isNaN(prezzoTotale) ? 0 : Math.round(prezzoTotale * 100) / 100,
      aliquotaIVA,
    });

    if (!isNaN(prezzoTotale)) {
      calculatedImponibileSum += prezzoTotale;
    }

    // Check AltriDatiGestionali for explicit cantiere info
    const altriDatiEls = getElements(lineEl, 'AltriDatiGestionali');
    for (const adEl of altriDatiEls) {
      const tipoDato = getTagText(adEl, 'TipoDato')?.toUpperCase() || '';
      const rifTesto = getTagText(adEl, 'RiferimentoTesto') || '';
      if (['CANTIERE', 'DESTINAZIONE', 'INDIRIZZO', 'LUOGO'].includes(tipoDato) && rifTesto) {
        if (!indirizzoCorpo) {
          indirizzoCorpo = rifTesto;
        }
      }
    }

    // Check line text description regex if no address found yet
    if (!indirizzoCorpo && descrizione) {
      const cantiereRegexMatch =
        descrizione.match(/(?:cantiere|lavori presso|destinazione|consegna a|immobile in|via\s+[:\s]?)\s*[:\-]?\s*([A-Za-z0-9\s'\.,\-]+(?:Monza|Milano|Torino|Roma|Como|Bergamo|Brescia|Varese|Pavia|Lodi|Crema|Novara|[0-9]{5})?[^\(\);]*)/i);
      if (cantiereRegexMatch && cantiereRegexMatch[1]) {
        const candidate = cantiereRegexMatch[1].trim();
        if (candidate.length > 5 && /\d/.test(candidate)) {
          indirizzoCorpo = candidate;
        }
      }
    }
  }

  if (importoTotale === 0 && calculatedImponibileSum > 0) {
    importoTotale = Math.round(calculatedImponibileSum * 1.22 * 100) / 100;
  }

  // Clean street and civico only for corpo
  const indirizzoCorpoPulito = indirizzoCorpo ? cleanStreetAndCivicoOnly(indirizzoCorpo) : '';

  // 4. RULE EXECUTION: Testata vs Body Address Comparison (comparing normalized street & civico)
  let regolaIndirizzoApplicata: 'corpo_diverso' | 'sede_testata' = 'sede_testata';
  let indirizzoCantiereProposto = indirizzoTestataViaPulito;
  let spiegazioneRegola = '';

  const normTestata = normalizeAddress(indirizzoTestataViaPulito);
  const normCorpo = indirizzoCorpoPulito ? normalizeAddress(indirizzoCorpoPulito) : '';

  if (indirizzoCorpoPulito && normCorpo && normCorpo !== normTestata && !normTestata.includes(normCorpo)) {
    // Body specifies an address DIFFERENT from header!
    regolaIndirizzoApplicata = 'corpo_diverso';
    indirizzoCantiereProposto = indirizzoCorpoPulito;
    spiegazioneRegola =
      'Indirizzo cantiere impostato dal corpo della fattura (solo via e numero civico), differente dalla sede legale del committente.';
  } else {
    // Same or absent in body -> Take header address
    regolaIndirizzoApplicata = 'sede_testata';
    indirizzoCantiereProposto = indirizzoTestataViaPulito;
    spiegazioneRegola =
      indirizzoCorpoPulito && normCorpo === normTestata
        ? "L'indirizzo indicato nel corpo coincide con la sede legale in testata: impostata via e civico della sede."
        : 'Nessun indirizzo alternativo nel corpo: impostata via e civico della sede legale in testata.';
  }

  // Suggested cantiere name in UPPERCASE Cognome Nome (no "cantiere", no town in parentheses)
  const nomeCantiereSuggerito = extractCantiereNameFromClient(cognome, nome, denominazione);
  const committenteName = (denominazione || nomeCantiereSuggerito).toUpperCase();
  const cittaCantiereSuggerita = (cittaCorpo || comuneTestata || 'MILANO').toUpperCase();

  // Studio internal protocol is ALWAYS the invoice number (e.g. "2/00")
  const invoiceNum = numero || '2/00';
  const protocolloSuggerito = invoiceNum;

  return {
    fileName,
    committente: {
      denominazione: committenteName,
      nome: nome?.toUpperCase(),
      cognome: cognome?.toUpperCase(),
      partitaIva,
      codiceFiscale,
      indirizzo: (indirizzoTestataViaPulito || indirizzoTestataVia || indirizzoTestata).toUpperCase(),
      cap: capTestata,
      comune: comuneTestata?.toUpperCase(),
      provincia: provinciaTestata?.toUpperCase(),
    },
    indirizzoTestata: indirizzoTestata.toUpperCase(),
    indirizzoCorpo: indirizzoCorpoPulito || indirizzoCorpo ? (indirizzoCorpoPulito || indirizzoCorpo).toUpperCase() : undefined,
    indirizzoCantiereProposto: indirizzoCantiereProposto.toUpperCase(),
    regolaIndirizzoApplicata,
    spiegazioneRegola,
    datiDocumento: {
      tipoDocumento,
      numero: invoiceNum,
      data,
      importoTotale: Math.round(importoTotale * 100) / 100,
      imponibileTotale: Math.round(calculatedImponibileSum * 100) / 100,
      causale: causaleText || undefined,
    },
    protocolloSuggerito,
    righe,
    nomeCantiereSuggerito,
    cittaCantiereSuggerita,
    rawXml: xmlString,
  };
}
