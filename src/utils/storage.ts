import { Artigiano, Cantiere, SospesoItem, QuadraturaContabile } from '../types';

const STORAGE_KEY_ARTIGIANI = 'z_cantieri_2026_artigiani_v3';

export const INITIAL_ARTIGIANI: Artigiano[] = [
  {
    id: 'art-sirna',
    name: 'Sirna Massimo',
    businessName: 'Sirna Massimo - Impianti Elettrici, Domotica e Sicurezza',
    partitaIva: '08849120155',
    codiceFiscale: 'SRNMSM78H12F205W',
    city: 'Milano',
    address: 'Via Andrea Doria 17',
    category: 'elettrico',
    phone: '+39 02 4892100',
    email: 'info@sirnaimpianti.it',
    year: 2026,
    notes: 'Artigiano elettricista specializzato in impianti civili, industriali, automazione domotica KNX e quadri elettrici BTicino.',
    quadratura: {
      mastrinoAcquisti: 3005.5, // 2470 cantieri + 535.50 sospesi
      mastrinoVendite: 11500.0, // 4500 + 3800 + 3200
      mastriniAcquistiDetails: [
        { id: 'm-acq-s1', code: '04.01.001', description: 'Merci c/acquisti & Materiali elettrici', amount: 2150.0 },
        { id: 'm-acq-s2', code: '04.01.005', description: 'Materiali di consumo e canaline', amount: 455.5 },
        { id: 'm-acq-s3', code: '04.02.010', description: 'Lavorazioni terzi e cablaggi quadri', amount: 400.0 },
      ],
      mastriniVenditeDetails: [
        { id: 'm-ven-s1', code: '01.01.001', description: 'Ricavi prestazioni impianti e domotica', amount: 8500.0 },
        { id: 'm-ven-s2', code: '01.01.005', description: 'Vendita corpi illuminanti e quadri BTicino', amount: 3000.0 },
      ],
      notes: 'Quadratura mastrini 2026 allineata con prima nota e cantiere Villa De Luca / Uffici Tech.',
      dataVerifica: '2026-02-18',
    },
    sospesi: [
      {
        id: 'sosp-s-01',
        date: '2026-02-10',
        docNumber: 'FT-SONE-2026/892',
        supplier: 'SONEPAR ITALIA SPA',
        description: 'Moduli relè KNX, alimentatore bus 640mA e attuatori Living Now (DDT 441/26)',
        amount: 340.0,
        protocol: 'SOSP-SIRNA-01',
        ddtNumber: 'DDT-441/26',
        ddtDate: '2026-02-08',
        status: 'in_attesa_cliente',
        customerNote: 'Da verificare con committente se installati su Villa De Luca o Uffici Tech.',
        createdAt: '2026-02-10T10:00:00.000Z',
      },
      {
        id: 'sosp-s-02',
        date: '2026-02-14',
        docNumber: 'FT-WUR-2026/902',
        supplier: 'WÜRTH S.R.L.',
        description: 'Canaline battiscopa, fascette cablaggio e tasselli a battere per quadri elettrici',
        amount: 195.5,
        protocol: 'SOSP-SIRNA-02',
        ddtNumber: 'DDT-902/26',
        ddtDate: '2026-02-12',
        status: 'in_attesa_cliente',
        customerNote: 'Materiale consumo officina/cantiere in attesa di imputazione.',
        createdAt: '2026-02-14T11:30:00.000Z',
      },
    ],
    createdAt: '2026-01-02T08:00:00.000Z',
    updatedAt: '2026-02-18T10:00:00.000Z',
    cantieri: [
      {
        id: 'cantiere-deluca-2026',
        name: 'Impianto Elettrico & Domotica Villa De Luca',
        city: 'Milano',
        address: 'Via Monte Napoleone 18',
        date: '2026-01-20',
        year: 2026,
        client: 'Ing. Marco De Luca',
        initialInventory: 650.0,
        finalInventory: 240.0,
        category: 'elettrico',
        status: 'attivo',
        notes: 'Impianto elettrico domotico KNX Living Now BTicino, gestione luci e carichi, cablaggio rete dati e allarme antintrusione.',
        createdAt: '2026-01-20T09:00:00.000Z',
        updatedAt: '2026-02-12T16:20:00.000Z',
        movements: [
          {
            id: 'mov-d-01',
            date: '2026-01-22',
            docNumber: 'Fatt. 02/2026',
            typeAndSubject: 'Fattura Emessa Acconto 30% - Ing. De Luca',
            protocol: 'PROT-26-003',
            purchases: 0,
            issued: 4500.0,
            notes: 'Primo acconto contrattuale',
            source: 'fattura_emessa',
          },
          {
            id: 'mov-d-02',
            date: '2026-01-25',
            docNumber: 'FT-SONE-0991',
            typeAndSubject: 'SONEPAR ITALIA SPA - Corrugati, scatole e cavi FG16',
            protocol: 'FORN-019',
            purchases: 1120.0,
            issued: 0,
            notes: 'Infilaggio cavi dorsali piano terra e primo piano',
            source: 'xml',
          },
          {
            id: 'mov-d-03',
            date: '2026-02-02',
            docNumber: 'FT-SONE-1240',
            typeAndSubject: 'SONEPAR ITALIA SPA - Moduli KNX e Gateway BTicino',
            protocol: 'FORN-033',
            purchases: 1350.0,
            issued: 0,
            notes: 'Apparecchiature domotica Living Now',
            source: 'xml',
          },
        ],
      },
      {
        id: 'cantiere-uffici-tech',
        name: 'Adeguamento Impianti e Dati Uffici Tech Hub',
        city: 'Milano',
        address: 'Viale Monza 45',
        date: '2026-01-15',
        year: 2026,
        client: 'NextTech Solutions S.r.l.',
        initialInventory: 200.0,
        finalInventory: 150.0,
        category: 'elettrico',
        status: 'attivo',
        notes: 'Cablaggio armadio rack Cat.6A, torrette a scomparsa e alimentazione gruppi di continuità UPS.',
        createdAt: '2026-01-15T09:00:00.000Z',
        updatedAt: '2026-02-14T11:00:00.000Z',
        movements: [
          {
            id: 'mov-ut-01',
            date: '2026-01-18',
            docNumber: 'Fatt. 01/2026',
            typeAndSubject: 'Fattura Emessa SAL 1 a NextTech Solutions',
            protocol: 'PROT-26-001',
            purchases: 0,
            issued: 3800.0,
            notes: 'Stato avanzamento dorsali dati e quadri secondari',
            source: 'fattura_emessa',
          },
        ],
      },
      {
        id: 'cantiere-palme-monza',
        name: 'Impianto Fotovoltaico e Wallbox Residenza Le Palme',
        city: 'Monza',
        address: 'Via Brianza 12',
        date: '2026-02-01',
        year: 2026,
        client: 'Condominio Le Palme (Amm. Dott. Vitali)',
        initialInventory: 0.0,
        finalInventory: 0.0,
        category: 'elettrico',
        status: 'completato',
        notes: 'Installazione colonnina ricarica 22kW e allaccio inverter fotovoltaico comune.',
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-16T17:30:00.000Z',
        movements: [
          {
            id: 'mov-palme-01',
            date: '2026-02-05',
            docNumber: 'Fatt. 03/2026',
            typeAndSubject: 'Fattura Emessa Saldo Lavori a Condominio Le Palme',
            protocol: 'PROT-26-008',
            purchases: 0,
            issued: 3200.0,
            notes: 'Saldo lavori e collaudo conformità',
            source: 'fattura_emessa',
          },
        ],
      },
    ],
  },
  {
    id: 'art-rossi',
    name: 'Rossi Impianti',
    businessName: 'Rossi Termoidraulica & Climatizzazione di Rossi Luca',
    partitaIva: '04419280012',
    codiceFiscale: 'RSSLCA81B15L219J',
    city: 'Torino',
    address: 'Corso Vittorio Emanuele II 92',
    category: 'idraulico',
    phone: '+39 011 654321',
    email: 'amministrazione@rossitermoidraulica.it',
    year: 2026,
    notes: 'Impianti idraulici, condizionamento, pompe di calore e rifacimento totale bagni.',
    quadratura: {
      mastrinoAcquisti: 2850.5,
      mastrinoVendite: 8800.0,
      mastriniAcquistiDetails: [
        { id: 'm-acq-r1', code: '04.01.002', description: 'Caldaie, raccordi rame e tubazioni', amount: 1950.0 },
        { id: 'm-acq-r2', code: '04.01.006', description: 'Minuteria idraulica e guarnizioni', amount: 450.5 },
        { id: 'm-acq-r3', code: '04.02.015', description: 'Collaudi canne fumarie e certificazioni', amount: 450.0 },
      ],
      mastriniVenditeDetails: [
        { id: 'm-ven-r1', code: '01.01.002', description: 'Rifacimento impianti termoidraulici', amount: 5600.0 },
        { id: 'm-ven-r2', code: '01.01.008', description: 'Installazione climatizzatori e pompe calore', amount: 3200.0 },
      ],
      notes: 'Quadratura contabile Rossi Impianti 2026.',
      dataVerifica: '2026-02-16',
    },
    sospesi: [
      {
        id: 'sosp-r-01',
        date: '2026-02-16',
        docNumber: 'FT-CAM-2026/9110',
        supplier: 'CAMBIELLI S.P.A.',
        description: 'Valvole termostatiche digitali e defangatore magnetico sotto-caldaia',
        amount: 325.0,
        protocol: 'SOSP-ROSSI-01',
        ddtNumber: 'DDT-108/26',
        ddtDate: '2026-02-15',
        status: 'in_attesa_cliente',
        customerNote: 'In attesa conferma dal committente per imputazione a Residenza Bianchi.',
        createdAt: '2026-02-16T11:30:00.000Z',
      },
    ],
    createdAt: '2026-01-05T08:30:00.000Z',
    updatedAt: '2026-02-16T12:00:00.000Z',
    cantieri: [
      {
        id: 'cantiere-bianchi-2026',
        name: 'Ristrutturazione Bagno & Impianti - Residenza Bianchi',
        city: 'Torino',
        address: 'Via Garibaldi 42, int. 3',
        date: '2026-01-12',
        year: 2026,
        client: 'Famiglia Bianchi Roberto',
        initialInventory: 350.0,
        finalInventory: 180.0,
        category: 'idraulico',
        status: 'attivo',
        notes: 'Rifacimento totale bagno padronale: sanitari sospesi, piatto doccia filo pavimento, tubazioni multistrato e nuova caldaia a condensazione.',
        createdAt: '2026-01-12T08:30:00.000Z',
        updatedAt: '2026-02-14T10:00:00.000Z',
        movements: [
          {
            id: 'mov-b-01',
            date: '2026-01-15',
            docNumber: 'Fatt. 01/2026',
            typeAndSubject: 'Fattura Emessa Acconto 40% a Fam. Bianchi',
            protocol: 'PROT-26-001',
            purchases: 0,
            issued: 2800.0,
            notes: 'Primo acconto all\'avvio cantiere',
            source: 'fattura_emessa',
          },
          {
            id: 'mov-b-02',
            date: '2026-01-20',
            docNumber: 'FT-CAM-8120',
            typeAndSubject: 'CAMBIELLI SPA - Cassetta incasso Geberit e tubi multistrato',
            protocol: 'FORN-014',
            purchases: 485.5,
            issued: 0,
            notes: 'DDT 881/2026 fornitura idraulica grezza',
            source: 'xml',
          },
          {
            id: 'mov-b-03',
            date: '2026-01-28',
            docNumber: 'FT-CAM-8344',
            typeAndSubject: 'CAMBIELLI SPA - Sanitari sospesi e rubinetteria Grohe',
            protocol: 'FORN-028',
            purchases: 790.0,
            issued: 0,
            notes: 'DDT 910/2026 finiture bagno',
            source: 'xml',
          },
          {
            id: 'mov-b-04',
            date: '2026-02-05',
            docNumber: 'Fatt. 04/2026',
            typeAndSubject: 'Fattura Emessa SAL 2 e saldo a Fam. Bianchi',
            protocol: 'PROT-26-009',
            purchases: 0,
            issued: 3400.0,
            notes: 'Saldo finale dopo collaudo impianti',
            source: 'fattura_emessa',
          },
        ],
      },
      {
        id: 'cantiere-moretti-2026',
        name: 'Sostituzione Caldaia e Pompa Calore Moretti',
        city: 'Vercelli',
        address: 'Piazza Cavour 8',
        date: '2026-02-01',
        year: 2026,
        client: 'Dott.ssa Elena Moretti',
        initialInventory: 0.0,
        finalInventory: 0.0,
        category: 'idraulico',
        status: 'completato',
        notes: 'Sostituzione vecchio generatore con caldaia ad alto rendimento, lavaggio impianto fanghi e detrazione fiscale.',
        createdAt: '2026-02-01T14:00:00.000Z',
        updatedAt: '2026-02-10T18:00:00.000Z',
        movements: [
          {
            id: 'mov-m-01',
            date: '2026-02-03',
            docNumber: 'FT-CAM-8501',
            typeAndSubject: 'CAMBIELLI SPA - Caldaia condensazione Baxi 24kW e raccordi',
            protocol: 'FORN-039',
            purchases: 1250.0,
            issued: 0,
            notes: 'Fornitura generatore termico e kit fumi',
            source: 'xml',
          },
          {
            id: 'mov-m-02',
            date: '2026-02-10',
            docNumber: 'Fatt. 05/2026',
            typeAndSubject: 'Fattura Emessa a Saldo - Moretti Elena',
            protocol: 'PROT-26-011',
            purchases: 0,
            issued: 2600.0,
            notes: 'Chiusura pratica Enea e conformità DM 37/08',
            source: 'fattura_emessa',
          },
        ],
      },
    ],
  },
  {
    id: 'art-verdi',
    name: 'Verdi Edilizia',
    businessName: 'Verdi Costruzioni & Restauri Edili S.r.l.',
    partitaIva: '03192830034',
    codiceFiscale: '03192830034',
    city: 'Novara',
    address: 'Via XX Settembre 48',
    category: 'edile',
    phone: '+39 0321 445566',
    email: 'contabilita@verdiedilizia.it',
    year: 2026,
    notes: 'Impresa edile: ponteggi, ristrutturazioni facciate, coibentazioni a cappotto e demolizioni.',
    quadratura: {
      mastrinoAcquisti: 4010.0,
      mastrinoVendite: 8900.0,
      notes: 'Quadratura mastrini Verdi Edilizia 2026.',
      dataVerifica: '2026-02-15',
    },
    sospesi: [
      {
        id: 'sosp-v-01',
        date: '2026-02-11',
        docNumber: 'FT-EDIL-2026/49',
        supplier: 'EDILNOVA FORNITURE',
        description: 'Sacchi rasante termico e rotoli rete fibra di vetro (DDT 90/26)',
        amount: 240.0,
        protocol: 'SOSP-VERDI-01',
        ddtNumber: 'DDT-90/26',
        ddtDate: '2026-02-09',
        status: 'in_attesa_cliente',
        customerNote: 'Da attribuire al cantiere Condominio Aurora o Villa Rossi.',
        createdAt: '2026-02-11T09:00:00.000Z',
      },
    ],
    createdAt: '2026-01-04T10:00:00.000Z',
    updatedAt: '2026-02-15T09:15:00.000Z',
    cantieri: [
      {
        id: 'cantiere-aurora-2026',
        name: 'Ristrutturazione Edile Condominio Aurora',
        city: 'Novara',
        address: 'Corso Risorgimento 112',
        date: '2026-01-08',
        year: 2026,
        client: 'Condominio Aurora (Amm. Geom. Pozzi)',
        initialInventory: 1200.0,
        finalInventory: 450.0,
        category: 'edile',
        status: 'attivo',
        notes: 'Risanamento balconi, intonaci facciata, coibentazione terrazzi e ripristino frontalini.',
        createdAt: '2026-01-08T11:00:00.000Z',
        updatedAt: '2026-02-15T09:15:00.000Z',
        movements: [
          {
            id: 'mov-a-01',
            date: '2026-01-10',
            docNumber: 'Fatt. 03/2026',
            typeAndSubject: 'Fattura Emessa SAL 1 a Condominio Aurora',
            protocol: 'PROT-26-004',
            purchases: 0,
            issued: 8900.0,
            notes: 'Stato avanzamento lavori n. 1 approvato',
            source: 'fattura_emessa',
          },
          {
            id: 'mov-a-02',
            date: '2026-01-15',
            docNumber: 'FT-EDIL-401',
            typeAndSubject: 'EDILNOVA FORNITURE - Malta Mapei, ponteggi e guaine',
            protocol: 'FORN-008',
            purchases: 3450.0,
            issued: 0,
            notes: 'Materiali per demolizioni e ripristini strutturali',
            source: 'manuale',
          },
          {
            id: 'mov-a-03',
            date: '2026-02-01',
            docNumber: 'FT-WUR-883',
            typeAndSubject: 'WÜRTH SRL - Tasselli chimici, dischi e ferramenta cantiere',
            protocol: 'FORN-041',
            purchases: 320.0,
            issued: 0,
            notes: 'Ancoraggi ringhiere e frontalini',
            source: 'xml',
          },
        ],
      },
    ],
  },
];

// Artigiani Storage
function normalizeArtigianiData(list: Artigiano[]): Artigiano[] {
  return list.map((art) => ({
    ...art,
    cantieri: (art.cantieri || []).map((c) => {
      const upperName = (c.name || '').toUpperCase().trim();
      const upperCity = (c.city || '').toUpperCase().trim();
      const upperAddress = c.address ? c.address.toUpperCase().trim() : '';
      return {
        ...c,
        name: upperName,
        client: upperName, // Nome cantiere e committente coincidono sempre
        city: upperCity,
        address: upperAddress,
      };
    }),
  }));
}

export function loadArtigiani(): Artigiano[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ARTIGIANI);
    if (!raw) {
      const normalized = normalizeArtigianiData(INITIAL_ARTIGIANI);
      saveArtigiani(normalized);
      return normalized;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeArtigianiData(parsed);
    }
    const normalized = normalizeArtigianiData(INITIAL_ARTIGIANI);
    saveArtigiani(normalized);
    return normalized;
  } catch (err) {
    console.error('Error loading artigiani:', err);
    return normalizeArtigianiData(INITIAL_ARTIGIANI);
  }
}

export function saveArtigiani(artigiani: Artigiano[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ARTIGIANI, JSON.stringify(artigiani));
  } catch (err) {
    console.error('Error saving artigiani:', err);
  }
}

export function resetAllDataToDefaults(): Artigiano[] {
  saveArtigiani(INITIAL_ARTIGIANI);
  return INITIAL_ARTIGIANI;
}

export function exportBackupJSON(artigiani: Artigiano[]): void {
  const payload = {
    version: '2026.3-multi-client',
    description: 'Backup Z-Cantieri Modulo Artigiani - Multi Cliente Studio Contabile',
    exportedAt: new Date().toISOString(),
    artigiani,
  };
  const dataStr =
    'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute(
    'download',
    `backup_z_cantieri_studio_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
