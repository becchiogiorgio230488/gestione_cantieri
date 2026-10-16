export interface SampleInvoice {
  name: string;
  category: string;
  description: string;
  supplier: string;
  total: number;
  xml: string;
}

export const SAMPLE_INVOICES: SampleInvoice[] = [
  {
    name: 'Fattura Sonepar Elettrico & Domotica (DDT 44 + DDT 51)',
    category: 'Elettrico',
    supplier: 'SONEPAR ITALIA S.P.A.',
    description: 'Materiale elettrico civile, cavi FG16, magnetotermici Bticino e faretti LED suddivisi su 2 DDT.',
    total: 1488.40,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>02633230287</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>SONE202601</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>02633230287</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>02633230287</CodiceFiscale>
        <Anagrafica>
          <Denominazione>SONEPAR ITALIA S.P.A.</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Venezia 22</Indirizzo>
        <CAP>35129</CAP>
        <Comune>Padova</Comune>
        <Provincia>PD</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA75C12L219X</CodiceFiscale>
        <Anagrafica>
          <Denominazione>IMPIANTI &amp; COSTRUZIONI ARTIGIANI</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Francia 45</Indirizzo>
        <CAP>10138</CAP>
        <Comune>Torino</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-02-10</Data>
        <Numero>FT-2026-04981</Numero>
        <ImportoTotaleDocumento>1488.40</ImportoTotaleDocumento>
        <Causale>Fornitura materiale elettrico cantiere rifacimento impianti</Causale>
      </DatiGeneraliDocumento>
      <DatiDDT>
        <NumeroDDT>DDT-2026/044</NumeroDDT>
        <DataDDT>2026-02-05</DataDDT>
        <RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>3</RiferimentoNumeroLinea>
      </DatiDDT>
      <DatiDDT>
        <NumeroDDT>DDT-2026/051</NumeroDDT>
        <DataDDT>2026-02-08</DataDDT>
        <RiferimentoNumeroLinea>4</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>5</RiferimentoNumeroLinea>
      </DatiDDT>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>CAV-FG16-3G25</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Cavo unipolare FG16OR16 3G2.5 matassa 100m antifiamma per quadro principale villa</Descrizione>
        <Quantita>2.00</Quantita>
        <UnitaMisura>MT</UnitaMisura>
        <PrezzoUnitario>165.00</PrezzoUnitario>
        <PrezzoTotale>330.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>BTC-BTI-F810N</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Interruttore Magnetotermico Differenziale BTicino salvavita 16A 30mA AC Din 2P</Descrizione>
        <Quantita>6.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>42.50</PrezzoUnitario>
        <PrezzoTotale>255.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>3</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>BTC-DOM-GATE</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Modulo gateway domotica KNX Living Now connesso con alimentatore bus</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>320.00</PrezzoUnitario>
        <PrezzoTotale>320.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>4</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>LED-SPOT-IP65</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Faretto LED incasso orientabile IP65 3000K dimmerabile impermeabile per bagno padronale</Descrizione>
        <Quantita>8.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>24.50</PrezzoUnitario>
        <PrezzoTotale>196.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>5</NumeroLinea>
        <CodiceArticolo>
          <CodiceTipo>FORN</CodiceTipo>
          <CodiceValore>TERMO-SMART-WIFI</CodiceValore>
        </CodiceArticolo>
        <Descrizione>Cronotermostato digitale ambiente Wi-Fi a sfioro da parete per gestione riscaldamento a pavimento</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>119.00</PrezzoUnitario>
        <PrezzoTotale>119.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Cambielli Termoidraulica (Caldaia, Tubi e Sanitari)',
    category: 'Idraulico',
    supplier: 'CAMBIELLI S.P.A.',
    description: 'Caldaia a condensazione 24kW, raccordi multistrato, cassetta Geberit e rubinetteria bagno.',
    total: 2185.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>00827290159</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>CAMB202688</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>00827290159</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>00827290159</CodiceFiscale>
        <Anagrafica>
          <Denominazione>CAMBIELLI S.P.A. - FILIALE TORINO NORD</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Botticelli 151</Indirizzo>
        <CAP>10154</CAP>
        <Comune>Torino</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA75C12L219X</CodiceFiscale>
        <Anagrafica>
          <Denominazione>IMPIANTI ARTIGIANI TERMOIDRAULICA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Francia 45</Indirizzo>
        <CAP>10138</CAP>
        <Comune>Torino</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-02-14</Data>
        <Numero>CAM-2026/8921</Numero>
        <ImportoTotaleDocumento>2185.00</ImportoTotaleDocumento>
        <Causale>Fornitura termosanitari e impianto idrico rifacimento bagno</Causale>
      </DatiGeneraliDocumento>
      <DatiDDT>
        <NumeroDDT>DDT-CAM-881</NumeroDDT>
        <DataDDT>2026-02-12</DataDDT>
        <RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>
      </DatiDDT>
      <DatiDDT>
        <NumeroDDT>DDT-CAM-889</NumeroDDT>
        <DataDDT>2026-02-13</DataDDT>
        <RiferimentoNumeroLinea>3</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>4</RiferimentoNumeroLinea>
      </DatiDDT>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Caldaia murale a condensazione Baxi Luna Duo-tec E 24kW metano completa di kit scarico fumi coassiale</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>1150.00</PrezzoUnitario>
        <PrezzoTotale>1150.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Tubo multistrato isolato per riscaldamento d.20x2 rotolo 50 metri e raccordi a pressare</Descrizione>
        <Quantita>2.00</Quantita>
        <UnitaMisura>RT</UnitaMisura>
        <PrezzoUnitario>145.00</PrezzoUnitario>
        <PrezzoTotale>290.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>3</NumeroLinea>
        <Descrizione>Cassetta di risciacquo da incasso Geberit Combifix Sigma8 con placca cromata satinata per rifacimento bagno</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>245.00</PrezzoUnitario>
        <PrezzoTotale>245.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>4</NumeroLinea>
        <Descrizione>Miscelatore monocomando lavabo e bidet Grohe Eurosmart cromo lucido con piletta click-clack</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>SET</UnitaMisura>
        <PrezzoUnitario>210.00</PrezzoUnitario>
        <PrezzoTotale>210.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Würth Fissaggi & Prodotti da Cantiere (Ripartibile)',
    category: 'Edile / Ferramenta',
    supplier: 'WÜRTH S.R.L.',
    description: 'Tasselli, schiuma poliuretanica, silicone e dischi da taglio diamantati (ideale per ripartizione % tra cantieri).',
    total: 480.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>00609710212</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>WURTH202603</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>00609710212</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>00609710212</CodiceFiscale>
        <Anagrafica>
          <Denominazione>WÜRTH S.R.L.</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Stazione 51</Indirizzo>
        <CAP>39044</CAP>
        <Comune>Egna</Comune>
        <Provincia>BZ</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA75C12L219X</CodiceFiscale>
        <Anagrafica>
          <Denominazione>IMPIANTI ARTIGIANI SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Francia 45</Indirizzo>
        <CAP>10138</CAP>
        <Comune>Torino</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-02-18</Data>
        <Numero>WUR-2026-1188</Numero>
        <ImportoTotaleDocumento>480.00</ImportoTotaleDocumento>
        <Causale>Fornitura materiale di consumo e ferramenta cantieri</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Confezione tasselli nylon con vite svasata diametro 8x40 (scatola 100 pz)</Descrizione>
        <Quantita>5.00</Quantita>
        <UnitaMisura>SC</UnitaMisura>
        <PrezzoUnitario>18.00</PrezzoUnitario>
        <PrezzoTotale>90.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Schiuma poliuretanica professionale per montaggio porte e controtelai 750ml</Descrizione>
        <Quantita>12.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>9.50</PrezzoUnitario>
        <PrezzoTotale>114.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>3</NumeroLinea>
        <Descrizione>Silicone neutro antimuffa acetico trasparente e bianco per sigillatura sanitari edili</Descrizione>
        <Quantita>15.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>6.40</PrezzoUnitario>
        <PrezzoTotale>96.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>4</NumeroLinea>
        <Descrizione>Dischi diamantati per smerigliatrice d.115 per taglio calcestruzzo e gres porcellanato</Descrizione>
        <Quantita>4.00</Quantita>
        <UnitaMisura>PZ</UnitaMisura>
        <PrezzoUnitario>45.00</PrezzoUnitario>
        <PrezzoTotale>180.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Acquisto con Spese Incasso & Attrezzatura (Test "DA NON CONSIDERARE")',
    category: 'Elettrico / Spese Generali',
    supplier: 'ELETTOFORNITURE MILANO S.R.L.',
    description: 'Contiene sia materiale per cantiere (cavi, interruttori) sia spese bancarie incasso e attrezzatura aziendale da escludere.',
    total: 1256.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>09876543210</IdCodice></IdTrasmittente>
      <ProgressivoInvio>ELFOR2026</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09876543210</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>09876543210</CodiceFiscale>
        <Anagrafica><Denominazione>ELETTROFORNITURE MILANO S.R.L.</Denominazione></Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Mecenate 76</Indirizzo>
        <CAP>20138</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>SRNMSM80A01F205W</CodiceFiscale>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-02-25</Data>
        <Numero>FT-2026/890</Numero>
        <ImportoTotaleDocumento>1256.00</ImportoTotaleDocumento>
        <Causale>Fornitura materiale per cantieri e spese accessorie</Causale>
      </DatiGeneraliDocumento>
      <DatiDDT>
        <NumeroDDT>DDT-2026/088</NumeroDDT>
        <DataDDT>2026-02-22</DataDDT>
        <RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>
        <RiferimentoNumeroLinea>2</RiferimentoNumeroLinea>
      </DatiDDT>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Quadro modulare da incasso 36 moduli IP40 con portella trasparente</Descrizione>
        <Quantita>2.00</Quantita>
        <PrezzoUnitario>180.00</PrezzoUnitario>
        <PrezzoTotale>360.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Interruttori differenziali puri 25A 30mA Tipo A Gewiss</Descrizione>
        <Quantita>6.00</Quantita>
        <PrezzoUnitario>45.00</PrezzoUnitario>
        <PrezzoTotale>270.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>3</NumeroLinea>
        <Descrizione>Spese bancarie di incasso e gestione ricevuta bancaria (Ri.Ba.)</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>6.00</PrezzoUnitario>
        <PrezzoTotale>6.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>4</NumeroLinea>
        <Descrizione>Trapano avvitatore a percussione professionale Makita per officina aziendale</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>320.00</PrezzoUnitario>
        <PrezzoTotale>320.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>5</NumeroLinea>
        <Descrizione>Valigetta minuteria e scatole di derivazione assortite</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>70.00</PrezzoUnitario>
        <PrezzoTotale>70.00</PrezzoTotale>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  }
];

export interface SampleIssuedInvoice {
  name: string;
  scenario: string;
  client: string;
  headerAddress: string;
  bodyAddress?: string;
  ruleExpected: 'corpo_diverso' | 'sede_testata';
  amount: number;
  xml: string;
}

export const SAMPLE_ISSUED_INVOICES: SampleIssuedInvoice[] = [
  {
    name: 'Fattura Emessa con Cantiere diverso da Sede (Regola: Corpo != Testata)',
    scenario: 'Sede committente a Milano centro, ma i lavori e la resa sono in cantiere a Monza.',
    client: 'IMMOBILIARE LOMBARDIA S.R.L.',
    headerAddress: 'Corso Buenos Aires 77, 20124 Milano (MI)',
    bodyAddress: 'Via Monte Napoleone 18, 20900 Monza (MB)',
    ruleExpected: 'corpo_diverso',
    amount: 8500.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>EMES202601</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>ABC1234</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>04455660155</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>04455660155</CodiceFiscale>
        <Anagrafica><Denominazione>IMMOBILIARE LOMBARDIA S.R.L.</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Buenos Aires 77</Indirizzo>
        <CAP>20124</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-01</Data>
        <Numero>FT-EM/2026-04</Numero>
        <ImportoTotaleDocumento>10370.00</ImportoTotaleDocumento>
        <Causale>SAL 1 realizzazione impianto elettrico e cablaggio domotico</Causale>
      </DatiGeneraliDocumento>
      <DatiTrasporto>
        <IndirizzoResa>
          <Indirizzo>Via Monte Napoleone 18</Indirizzo>
          <CAP>20900</CAP>
          <Comune>Monza</Comune>
          <Provincia>MB</Provincia>
        </IndirizzoResa>
      </DatiTrasporto>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Realizzazione e posa impianto elettrico presso cantiere di Via Monte Napoleone 18, Monza</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>8500.00</PrezzoUnitario>
        <PrezzoTotale>8500.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
        <AltriDatiGestionali>
          <TipoDato>CANTIERE</TipoDato>
          <RiferimentoTesto>Via Monte Napoleone 18, Monza (MB)</RiferimentoTesto>
        </AltriDatiGestionali>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>8500.00</ImponibileImporto>
        <Imposta>1870.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Emessa con 2 Aliquote IVA (10% e 22% - Totale Imponibili)',
    scenario: 'Fattura con IVA 10% (manutenzione) e 22% (materiali): importa solo la somma dei due imponibili (€ 5.000,00).',
    client: 'RESIDENZA LE VILLE S.R.L.',
    headerAddress: 'Corso Sempione 45, 20145 Milano (MI)',
    bodyAddress: 'Via Roma 40, 20900 Monza (MB)',
    ruleExpected: 'corpo_diverso',
    amount: 5000.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>EMES202604</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>ABC1234</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>08899110156</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>08899110156</CodiceFiscale>
        <Anagrafica><Denominazione>RESIDENZA LE VILLE S.R.L.</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Sempione 45</Indirizzo>
        <CAP>20145</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-15</Data>
        <Numero>FT-EM/2026-08</Numero>
        <ImportoTotaleDocumento>5680.00</ImportoTotaleDocumento>
        <Causale>Lavori impianto elettrico con IVA 10% ed elettrodomestici/domotica IVA 22%</Causale>
      </DatiGeneraliDocumento>
      <DatiTrasporto>
        <IndirizzoResa>
          <Indirizzo>Via Roma 40</Indirizzo>
          <CAP>20900</CAP>
          <Comune>Monza</Comune>
          <Provincia>MB</Provincia>
        </IndirizzoResa>
      </DatiTrasporto>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Manodopera e impianti elettrici (Aliquota agevolata 10%)</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>3500.00</PrezzoUnitario>
        <PrezzoTotale>3500.00</PrezzoTotale>
        <AliquotaIVA>10.00</AliquotaIVA>
        <AltriDatiGestionali>
          <TipoDato>CANTIERE</TipoDato>
          <RiferimentoTesto>Via Roma 40, Monza (MB)</RiferimentoTesto>
        </AltriDatiGestionali>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Corpi illuminanti speciali e attuatori domotici (Aliquota ordinaria 22%)</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>1500.00</PrezzoUnitario>
        <PrezzoTotale>1500.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>10.00</AliquotaIVA>
        <ImponibileImporto>3500.00</ImponibileImporto>
        <Imposta>350.00</Imposta>
      </DatiRiepilogo>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1500.00</ImponibileImporto>
        <Imposta>330.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Emessa con Sede coincidente (Regola: Sede = Testata)',
    scenario: 'Nessun indirizzo cantiere alternativo specificato nel corpo: viene assunta la sede legale in testata.',
    client: 'CONDOMINIO AURORA',
    headerAddress: 'Via Palestro 14, 20121 Milano (MI)',
    ruleExpected: 'sede_testata',
    amount: 3200.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>EMES202602</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>97812340152</CodiceFiscale>
        <Anagrafica><Denominazione>CONDOMINIO AURORA</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Palestro 14</Indirizzo>
        <CAP>20121</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-05</Data>
        <Numero>FT-EM/2026-05</Numero>
        <ImportoTotaleDocumento>3200.00</ImportoTotaleDocumento>
        <Causale>Rifacimento e messa a norma illuminazione vano scale ed emergenza</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Lavori di adeguamento corpi illuminanti a LED e relè temporizzati</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>3200.00</PrezzoUnitario>
        <PrezzoTotale>3200.00</PrezzoTotale>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Fattura Emessa 2/00 - Committente ROSSI MARIO (Esclusione Dati Catastali)',
    scenario: 'Fattura n° 2/00 a ROSSI MARIO con dati catastali (Fg. 14 Part. 301 Sub. 5) rimossi automaticamente dall\'indirizzo.',
    client: 'ROSSI MARIO',
    headerAddress: 'Via Dante 12, 20900 Monza (MB)',
    bodyAddress: 'Via Dante 12, Fg. 14 Part. 301 Sub. 5',
    ruleExpected: 'sede_testata',
    amount: 4500.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>EMES202603</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA80A01F205X</CodiceFiscale>
        <Anagrafica>
          <Nome>Mario</Nome>
          <Cognome>Rossi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Dante 12</Indirizzo>
        <CAP>20900</CAP>
        <Comune>Monza</Comune>
        <Provincia>MB</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-10</Data>
        <Numero>2/00</Numero>
        <ImportoTotaleDocumento>4500.00</ImportoTotaleDocumento>
        <Causale>Rifacimento impianto elettrico residenziale</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Lavori eseguiti presso immobile in Via Dante 12, Dati Catastali: Fg. 14 Part. 301 Sub. 5</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>4500.00</PrezzoUnitario>
        <PrezzoTotale>4500.00</PrezzoTotale>
        <AltriDatiGestionali>
          <TipoDato>CANTIERE</TipoDato>
          <RiferimentoTesto>Via Dante 12, Fg. 14 Part. 301 Sub. 5</RiferimentoTesto>
        </AltriDatiGestionali>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  },
  {
    name: 'Nota di Credito TD04 (Storno Parziale - Importo Negativo)',
    scenario: 'Nota di credito emessa TD04 con imponibile di storno a valore negativo per riduzione prezzo o reso su cantiere.',
    client: 'ROSSI MARIO',
    headerAddress: 'Via Dante 12, 20900 Monza (MB)',
    bodyAddress: 'Via Dante 12, 20900 Monza (MB)',
    ruleExpected: 'sede_testata',
    amount: -1500.00,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>NC202601</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>SIRNA MASSIMO IMPIANTI ELETTRICI</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Padova 120</Indirizzo>
        <CAP>20127</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA80A01F205X</CodiceFiscale>
        <Anagrafica>
          <Nome>Mario</Nome>
          <Cognome>Rossi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Dante 12</Indirizzo>
        <CAP>20900</CAP>
        <Comune>Monza</Comune>
        <Provincia>MB</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD04</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-15</Data>
        <Numero>NC-1/26</Numero>
        <ImportoTotaleDocumento>1830.00</ImportoTotaleDocumento>
        <Causale>Nota di credito per storno parziale lavorazioni impianto elettrico</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Storno parziale accordato per opere non eseguite cantiere Via Dante 12</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>1500.00</PrezzoUnitario>
        <PrezzoTotale>1500.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1500.00</ImponibileImporto>
        <Imposta>330.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
  }
];
