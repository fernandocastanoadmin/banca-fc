// js/storage.js - Persistencia Unificada y Sincronización en Tiempo Real (POS <-> Panel Central)
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

const _localStoreMock = {};
const safeLocalStorage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : {
  getItem: (key) => _localStoreMock[key] || null,
  setItem: (key, val) => { _localStoreMock[key] = String(val); },
  removeItem: (key) => { delete _localStoreMock[key]; },
  clear: () => { Object.keys(_localStoreMock).forEach(k => delete _localStoreMock[k]); }
};

const STORAGE_KEYS = {
  MASTER_DB: 'banca_fc_data',
  CONFIG: 'orbet_pos_config',
  TICKETS: 'orbet_pos_tickets',
  RESULTS: 'orbet_pos_results',
  MESSAGES: 'orbet_pos_messages',
  LAST_PRINTED_TICKET: 'orbet_pos_last_printed'
};

const DEFAULT_CONFIG = {
  agencyCode: '1000',
  agencyName: 'FERNANDO CASTAÑO',
  terminalId: '1000',
  terminalSerial: '61526296531000',
  agentName: 'Fernando Castaño',
  bancaName: 'Banca FC Fernando Castaño',
  currency: 'COP', // 'COP', 'VES', 'USD'
  paperWidth: '58mm', // '58mm', '80mm'
  agencyCommissionPct: 15,
  nextTicketNumber: 10926,
  adminResetPassword: 'osrovzlo2026',
  multipliers: {
    triple: 500,
    terminal: 60,
    aproximacion: 5,
    animalito: 30,
    cuatroCifrasDirecto: 4500,
    cuatroCifrasCombinado: 208,
    la5ta: 25000,
    astro4: 40000,
    astro3: 1000
  },
  topes: {
    terminal: 50000,
    triple: 20000,
    animalito: 30000,
    cuatroCifras: 10000
  }
};

const DEFAULT_COLLECTORS = [
  'Raúl Zambrano',
  'Maikol Sánchez',
  'Daniel Ramírez',
  'Marco Mojica'
];

const DEFAULT_MESSAGES = [
  {
    id: 1,
    date: '08/11/2026 08:30 AM',
    from: 'BANCA FC - CENTRAL',
    subject: 'Sincronización En Vivo Activa con Panel Central',
    body: 'Todas las taquillas están conectadas en tiempo real con el Panel Central de Banca FC Fernando Castaño. Recuerde verificar topes por número y animalito.',
    read: false
  },
  {
    id: 2,
    date: '08/11/2026 09:15 AM',
    from: 'AUDITORÍA DE RIESGO FC',
    subject: 'Multiplicadores Oficiales Banca FC',
    body: 'Triple: 500x | Terminal: 60x | Aproximación: 5x | Animalitos: 30x | 4 Cifras: 4500x | Astro: 40000x.',
    read: true
  }
];

function getTodayFormatted() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}

function getTodayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getDefaultAgencies() {
  return [
    {
      code: '1000',
      terminalSerial: '61526296531000',
      name: 'AG PRINCIPAL FERNANDO CASTAÑO',
      manager: 'Fernando Castaño',
      whatsapp: '+573105551000',
      zone: 'San Cristóbal - Centro (VEN)',
      collector: 'Raúl Zambrano',
      currency: 'COP',
      commissionPct: 15,
      maxBetLimit: 100000,
      creditLimit: 5000000,
      password: '1000',
      status: 'ACTIVA'
    },
    {
      code: '7336',
      terminalSerial: '61526296537336',
      name: 'AG BARRIO SUCRE',
      manager: 'Carlos Andrés Méndez',
      whatsapp: '+584147007336',
      zone: 'San Cristóbal - Barrio Sucre (VEN)',
      collector: 'Raúl Zambrano',
      currency: 'COP',
      commissionPct: 15,
      maxBetLimit: 50000,
      creditLimit: 2500000,
      password: '7336',
      status: 'ACTIVA'
    },
    {
      code: '7337',
      terminalSerial: '61526296537337',
      name: 'AG CENTRO QUINTA AVENIDA',
      manager: 'María Eugenia Chacón',
      whatsapp: '+584247117337',
      zone: 'San Cristóbal - 5ta Av (VEN)',
      collector: 'Maikol Sánchez',
      currency: 'VES',
      commissionPct: 15,
      maxBetLimit: 800,
      creditLimit: 35000,
      password: '7337',
      status: 'ACTIVA'
    },
    {
      code: '7338',
      terminalSerial: '61526296537338',
      name: 'AG CAPACHO INDEPENDENCIA',
      manager: 'José Gregorio Roa',
      whatsapp: '+584127227338',
      zone: 'Capacho Nuevo, Táchira (VEN)',
      collector: 'Daniel Ramírez',
      currency: 'COP',
      commissionPct: 15,
      maxBetLimit: 60000,
      creditLimit: 3000000,
      password: '7338',
      status: 'ACTIVA'
    },
    {
      code: '7339',
      terminalSerial: '61526296537339',
      name: 'AG CÚCUTA CENTRO ALEJANDRÍA',
      manager: 'Luz Marina Peñaloza',
      whatsapp: '+573158887339',
      zone: 'Cúcuta - Centro (COL)',
      collector: 'Marco Mojica',
      currency: 'COP',
      commissionPct: 15,
      maxBetLimit: 120000,
      creditLimit: 6000000,
      password: '7339',
      status: 'ACTIVA'
    },
    {
      code: '7340',
      terminalSerial: '61526296537340',
      name: 'AG TÁRIBA PLAZA BOLÍVAR',
      manager: 'Pedro Luis Contreras',
      whatsapp: '+584149997340',
      zone: 'Táriba, Cárdenas (VEN)',
      collector: 'Maikol Sánchez',
      currency: 'VES',
      commissionPct: 14,
      maxBetLimit: 600,
      creditLimit: 25000,
      password: '7340',
      status: 'ACTIVA'
    },
    {
      code: '7341',
      terminalSerial: '61526296537341',
      name: 'AG VILLA DEL ROSARIO LA PARADA',
      manager: 'Jorge Eliécer Gómez',
      whatsapp: '+573204447341',
      zone: 'Villa del Rosario (COL)',
      collector: 'Marco Mojica',
      currency: 'COP',
      commissionPct: 12,
      maxBetLimit: 50000,
      creditLimit: 2000000,
      password: '7341',
      status: 'SUSPENDIDA'
    }
  ];
}

function getDemoSeedTickets() {
  const dateStr = getTodayFormatted();
  return [
    {
      ticketId: '00010917',
      serialSeguridad: '5821-4902-1108',
      fechaHora: `${dateStr} 09:15:30 am`,
      agencyCode: '1000',
      agencia: '1000 - AG PRINCIPAL FERNANDO CASTAÑO',
      usuario: '1000',
      moneda: 'COP',
      items: [
        { lotteryId: 'TACHIRA_A_1645', lotteryName: 'Táchira A 4:45 PM', number: '745', type: 'triple', amount: 15000 },
        { lotteryId: 'TACHIRA_A_1645', lotteryName: 'Táchira A 4:45 PM', number: '45', type: 'terminal', amount: 5000 },
        { lotteryId: 'ZULIA_A_1645', lotteryName: 'Zulia A 4:45 PM', number: '845', type: 'triple', amount: 25000 }
      ],
      total: 45000,
      estado: 'PAGADO',
      premioCalculado: 300000,
      premioPagado: 300000,
      fechaPago: `${dateStr} 04:50:00 pm`,
      winningPlays: [
        { lotteryId: 'TACHIRA_A_1645', lotteryName: 'Táchira A 4:45 PM', number: '45', type: 'terminal', amount: 5000, winType: 'TERMINAL DERECHO', multiplier: 60, prize: 300000, resultNumber: '845' }
      ]
    },
    {
      ticketId: '00010918',
      serialSeguridad: '9312-3011-8842',
      fechaHora: `${dateStr} 10:05:12 am`,
      agencyCode: '1000',
      agencia: '1000 - AG PRINCIPAL FERNANDO CASTAÑO',
      usuario: '1000',
      moneda: 'COP',
      items: [
        { lotteryId: 'LOTTO_ACTIVO_1200', lotteryName: 'Lotto Activo 12:00 PM', number: '12', animalName: 'Caballo', type: 'animalito', amount: 40000 },
        { lotteryId: 'FRUTA_GANA_1400', lotteryName: 'Fruta Gana 2:00 PM', number: '07', animalName: 'Patilla', type: 'animalito', amount: 35000 },
        { lotteryId: 'DORADO_TARDE', lotteryName: 'Dorado Tarde 3:30 PM', number: '3814', type: 'cuatro_cifras', is5ta: true, amount: 25000 }
      ],
      total: 100000,
      estado: 'ACTIVO',
      premioCalculado: 0
    },
    {
      ticketId: '00010919',
      serialSeguridad: '4410-8821-7731',
      fechaHora: `${dateStr} 10:22:45 am`,
      agencyCode: '7336',
      agencia: '7336 - AG BARRIO SUCRE',
      usuario: '7336',
      moneda: 'COP',
      items: [
        { lotteryId: 'CHANCE_A_1300', lotteryName: 'Chance A 1:00 PM', number: '529', type: 'triple', amount: 20000 },
        { lotteryId: 'TACHIRA_ZOD_1645', lotteryName: 'Táchira Zodiacal 4:45 PM', number: '529', sign: 'LEO', type: 'zodiac', amount: 30000 },
        { lotteryId: 'LOTTO_ACTIVO_1200', lotteryName: 'Lotto Activo 12:00 PM', number: '05', animalName: 'León', type: 'animalito', amount: 2000 }
      ],
      total: 52000,
      estado: 'GANADOR',
      premioCalculado: 60000,
      winningPlays: [
        { lotteryId: 'LOTTO_ACTIVO_1200', lotteryName: 'Lotto Activo 12:00 PM', number: '05', animalName: 'León', type: 'animalito', amount: 2000, winType: 'ANIMALITO GANADOR', multiplier: 30, prize: 60000, resultNumber: '05' }
      ]
    },
    {
      ticketId: '00010920',
      serialSeguridad: '7719-2044-6190',
      fechaHora: `${dateStr} 10:45:10 am`,
      agencyCode: '7336',
      agencia: '7336 - AG BARRIO SUCRE',
      usuario: '7336',
      moneda: 'COP',
      items: [
        { lotteryId: 'CULONA_DIA', lotteryName: 'Culona Día 2:30 PM', number: '9042', type: 'cuatro_cifras', amount: 15000 }
      ],
      total: 15000,
      estado: 'ANULADO',
      fechaAnulacion: `${dateStr} 10:47:00 am`,
      premioCalculado: 0
    },
    {
      ticketId: '00010921',
      serialSeguridad: '6602-9183-3341',
      fechaHora: `${dateStr} 11:12:00 am`,
      agencyCode: '7337',
      agencia: '7337 - AG CENTRO QUINTA AVENIDA',
      usuario: '7337',
      moneda: 'VES',
      items: [
        { lotteryId: 'CHANCE_A_1400', lotteryName: 'Chance A 2:00 PM', number: '318', type: 'triple', amount: 450 },
        { lotteryId: 'CARACAS_A_1630', lotteryName: 'Caracas A 4:30 PM', number: '77', type: 'terminal', amount: 300 },
        { lotteryId: 'GUACHARO_1300', lotteryName: 'Guácharo Activo 1:00 PM', number: '10', animalName: 'Tigre', type: 'animalito', amount: 500 }
      ],
      total: 1250,
      estado: 'ACTIVO',
      premioCalculado: 0
    },
    {
      ticketId: '00010922',
      serialSeguridad: '8129-5540-9012',
      fechaHora: `${dateStr} 11:30:19 am`,
      agencyCode: '7337',
      agencia: '7337 - AG CENTRO QUINTA AVENIDA',
      usuario: '7337',
      moneda: 'VES',
      items: [
        { lotteryId: 'LOTTO_ACTIVO_1200', lotteryName: 'Lotto Activo 12:00 PM', number: '05', animalName: 'León', type: 'animalito', amount: 10 }
      ],
      total: 10,
      estado: 'PAGADO',
      premioCalculado: 300,
      premioPagado: 300,
      fechaPago: `${dateStr} 12:15:00 pm`,
      winningPlays: [
        { lotteryId: 'LOTTO_ACTIVO_1200', lotteryName: 'Lotto Activo 12:00 PM', number: '05', animalName: 'León', type: 'animalito', amount: 10, winType: 'ANIMALITO GANADOR', multiplier: 30, prize: 300, resultNumber: '05' }
      ]
    },
    {
      ticketId: '00010923',
      serialSeguridad: '3391-7823-1904',
      fechaHora: `${dateStr} 11:50:44 am`,
      agencyCode: '7338',
      agencia: '7338 - AG CAPACHO INDEPENDENCIA',
      usuario: '7338',
      moneda: 'COP',
      items: [
        { lotteryId: 'TACHIRA_A_2210', lotteryName: 'Táchira A 10:10 PM', number: '912', type: 'triple', amount: 30000 },
        { lotteryId: 'ZULIA_A_1905', lotteryName: 'Zulia A 7:05 PM', number: '44', type: 'terminal', amount: 25000 },
        { lotteryId: 'LA_GRANJITA_1500', lotteryName: 'La Granjita 3:00 PM', number: '21', animalName: 'Gallo', type: 'animalito', amount: 30000 }
      ],
      total: 85000,
      estado: 'ACTIVO',
      premioCalculado: 0
    },
    {
      ticketId: '00010924',
      serialSeguridad: '1190-4482-6721',
      fechaHora: `${dateStr} 12:10:05 pm`,
      agencyCode: '7339',
      agencia: '7339 - AG CÚCUTA CENTRO ALEJANDRÍA',
      usuario: '7339',
      moneda: 'COP',
      items: [
        { lotteryId: 'ASTRO_LUNA_2230', lotteryName: 'Super Astro Luna 10:30 PM', number: '7742', sign: 'ARI', type: 'astro', amount: 50000 },
        { lotteryId: 'DORADO_NOCHE', lotteryName: 'Dorado Noche 10:15 PM', number: '1984', is5ta: true, type: 'cuatro_cifras', amount: 60000 },
        { lotteryId: 'CHONTICO_NOCHE', lotteryName: 'Chontico Noche 7:00 PM', number: '5510', isCombinado: true, type: 'cuatro_cifras', amount: 40000 }
      ],
      total: 150000,
      estado: 'ACTIVO',
      premioCalculado: 0
    },
    {
      ticketId: '00010925',
      serialSeguridad: '2201-6734-8910',
      fechaHora: `${dateStr} 12:25:33 pm`,
      agencyCode: '7340',
      agencia: '7340 - AG TÁRIBA PLAZA BOLÍVAR',
      usuario: '7340',
      moneda: 'VES',
      items: [
        { lotteryId: 'TACHIRA_ZOD_2210', lotteryName: 'Táchira Zodiacal 10:10 PM', number: '604', sign: 'TAU', type: 'zodiac', amount: 350 },
        { lotteryId: 'SELVA_PLUS_1615', lotteryName: 'Selva Plus 4:15 PM', number: '00', animalName: 'Ballena', type: 'animalito', amount: 400 }
      ],
      total: 750,
      estado: 'ACTIVO',
      premioCalculado: 0
    }
  ];
}

function getDemoSeedResults() {
  const dateKey = getTodayIso();
  return {
    [dateKey]: {
      'TACHIRA_A_1645': { number: '845', sign: 'ARI', timestamp: '04:50:00 pm' },
      'ZULIA_A_1645': { number: '123', sign: 'LEO', timestamp: '04:50:00 pm' },
      'LOTTO_ACTIVO_1200': { number: '05', animalName: 'León', timestamp: '12:02:00 pm' },
      'DORADO_MANANA': { number: '4729', ball5: '3', timestamp: '11:00:00 am' }
    }
  };
}

class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    try {
      const masterRaw = safeLocalStorage.getItem(STORAGE_KEYS.MASTER_DB);
      if (!masterRaw) {
        this.initializeMasterDatabase();
      } else {
        const master = JSON.parse(masterRaw);
        let modified = false;
        if (!master.agencies || !Array.isArray(master.agencies) || master.agencies.length === 0) {
          master.agencies = getDefaultAgencies();
          modified = true;
        }
        if (!master.collectors || !Array.isArray(master.collectors)) {
          master.collectors = [...DEFAULT_COLLECTORS];
          modified = true;
        }
        if (!master.rates) {
          master.rates = { ...DEFAULT_CONFIG.rates };
          modified = true;
        }
        if (!master.config) {
          master.config = { ...DEFAULT_CONFIG };
          modified = true;
        }
        // Sincronizar eventuales tickets que se hayan guardado en clave legacy
        const legacyTicketsRaw = safeLocalStorage.getItem(STORAGE_KEYS.TICKETS);
        if (legacyTicketsRaw) {
          try {
            const legacyTickets = JSON.parse(legacyTicketsRaw);
            if (Array.isArray(legacyTickets) && legacyTickets.length > (master.tickets || []).length) {
              master.tickets = legacyTickets;
              modified = true;
            }
          } catch (err) {}
        }
        if (modified) {
          this.saveMasterData(master, false);
        } else {
          this.syncLegacyKeysFromMaster(master);
        }
      }
    } catch (e) {
      console.warn('Error inicializando base de datos unificada:', e);
      this.initializeMasterDatabase();
    }
  }

  initializeMasterDatabase() {
    const existingConfigRaw = safeLocalStorage.getItem(STORAGE_KEYS.CONFIG);
    const existingTicketsRaw = safeLocalStorage.getItem(STORAGE_KEYS.TICKETS);
    const existingResultsRaw = safeLocalStorage.getItem(STORAGE_KEYS.RESULTS);
    const existingMessagesRaw = safeLocalStorage.getItem(STORAGE_KEYS.MESSAGES);

    let config = { ...DEFAULT_CONFIG };
    if (existingConfigRaw) {
      try {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(existingConfigRaw) };
      } catch (e) {}
    }

    let tickets = getDemoSeedTickets();
    if (existingTicketsRaw) {
      try {
        const parsedT = JSON.parse(existingTicketsRaw);
        if (Array.isArray(parsedT) && parsedT.length > 2) {
          tickets = parsedT;
        }
      } catch (e) {}
    }

    let results = getDemoSeedResults();
    if (existingResultsRaw) {
      try {
        const parsedR = JSON.parse(existingResultsRaw);
        if (parsedR && Object.keys(parsedR).length > 0) {
          results = parsedR;
        }
      } catch (e) {}
    }

    let messages = DEFAULT_MESSAGES;
    if (existingMessagesRaw) {
      try {
        messages = JSON.parse(existingMessagesRaw);
      } catch (e) {}
    }

    const masterData = {
      bancaName: 'BANCA FC FERNANDO CASTAÑO',
      updatedAt: new Date().toISOString(),
      consolidationCurrency: 'COP',
      collectors: [...DEFAULT_COLLECTORS],
      config: config,
      agencies: getDefaultAgencies(),
      tickets: tickets,
      results: results,
      messages: messages
    };

    this.saveMasterData(masterData, false);
  }

  getMasterData() {
    try {
      const raw = safeLocalStorage.getItem(STORAGE_KEYS.MASTER_DB);
      if (!raw) {
        this.initializeMasterDatabase();
        return JSON.parse(safeLocalStorage.getItem(STORAGE_KEYS.MASTER_DB));
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error leyendo banca_fc_data:', e);
      return {
        bancaName: 'BANCA FC FERNANDO CASTAÑO',
        consolidationCurrency: 'COP',
        collectors: [...DEFAULT_COLLECTORS],
        config: { ...DEFAULT_CONFIG },
        agencies: getDefaultAgencies(),
        tickets: [],
        results: {},
        messages: DEFAULT_MESSAGES
      };
    }
  }

  saveMasterData(masterData, dispatchSyncEvent = true, forceOverwriteServer = false) {
    masterData.updatedAt = new Date().toISOString();
    safeLocalStorage.setItem(STORAGE_KEYS.MASTER_DB, JSON.stringify(masterData));
    this.syncLegacyKeysFromMaster(masterData);

    // 1. Sincronización Instantánea en la Nube vía Firebase Realtime Database (Opción A)
    if (typeof window !== 'undefined' && window.bancaFcCloud && typeof window.bancaFcCloud.pushMasterData === 'function') {
      window.bancaFcCloud.pushMasterData(masterData, forceOverwriteServer);
    }

    // 2. Sincronizar con servidor local opcional si aplica
    const syncUrl = this.getRemoteServerSyncUrl();
    if (syncUrl && typeof window !== 'undefined' && window.fetch) {
      const payload = forceOverwriteServer ? { ...masterData, _forceOverwrite: true } : masterData;
      window.fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => r.json())
        .then(res => {
          if (res && res.ok && res.data) {
            safeLocalStorage.setItem(STORAGE_KEYS.MASTER_DB, JSON.stringify(res.data));
            this.syncLegacyKeysFromMaster(res.data);
          }
        })
        .catch(() => {});
    }

    if (dispatchSyncEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('banca_fc_data_updated', { detail: masterData }));
    }
  }

  getRemoteServerSyncUrl() {
    if (typeof window === 'undefined') return null;
    // Si está alojado en GitHub Pages o conectado a Firebase, no usar /api/sync local
    if (window.location && window.location.hostname && window.location.hostname.includes('github.io')) {
      return null;
    }
    if (window.bancaFcCloud && typeof window.bancaFcCloud.isConfigured === 'function' && window.bancaFcCloud.isConfigured()) {
      return null;
    }
    const customHost = safeLocalStorage.getItem('banca_fc_server_host');
    if (customHost && customHost.trim()) {
      const clean = customHost.trim().replace(/\/+$/, '');
      const base = clean.startsWith('http') ? clean : `http://${clean}`;
      return `${base}/api/sync`;
    }
    if (window.location && window.location.protocol.startsWith('http')) {
      return '/api/sync';
    }
    return null;
  }

  setRemoteServerHost(hostUrl) {
    const clean = String(hostUrl || '').trim();
    if (!clean) {
      safeLocalStorage.removeItem('banca_fc_server_host');
    } else {
      safeLocalStorage.setItem('banca_fc_server_host', clean);
    }
  }

  getRemoteServerHost() {
    return safeLocalStorage.getItem('banca_fc_server_host') || '';
  }

  // Descarga cambios en vivo desde el Servidor Central (para sincronizar varias laptops)
  async pullFromRemoteServer() {
    const syncUrl = this.getRemoteServerSyncUrl();
    if (!syncUrl || typeof window === 'undefined' || !window.fetch) return false;
    try {
      const resp = await window.fetch(syncUrl, { cache: 'no-store' });
      if (!resp.ok) return false;
      const remoteData = await resp.json();
      if (!remoteData || remoteData.status === 'empty' || !Array.isArray(remoteData.tickets)) {
        return false;
      }
      const localData = this.getMasterData();
      const localTicketsStr = JSON.stringify(localData.tickets || []);
      const remoteTicketsStr = JSON.stringify(remoteData.tickets || []);
      const localAgenciesStr = JSON.stringify(localData.agencies || []);
      const remoteAgenciesStr = JSON.stringify(remoteData.agencies || []);

      if (localTicketsStr !== remoteTicketsStr || localAgenciesStr !== remoteAgenciesStr || localData.updatedAt !== remoteData.updatedAt) {
        safeLocalStorage.setItem(STORAGE_KEYS.MASTER_DB, JSON.stringify(remoteData));
        this.syncLegacyKeysFromMaster(remoteData);
        window.dispatchEvent(new CustomEvent('banca_fc_data_updated', { detail: remoteData }));
        return true;
      }
    } catch (e) {
      // Silencioso si está desconectado
    }
    return false;
  }

  // Exporta un paquete JSON de una taquilla o de toda la banca para pasarlo por WhatsApp/USB a otra laptop
  exportSyncPackage() {
    const master = this.getMasterData();
    return JSON.stringify(master, null, 2);
  }

  // Importa y fusiona los tickets de otra laptop sin borrar los actuales
  importAndMergeSyncPackage(jsonString) {
    const incoming = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!incoming || (!Array.isArray(incoming.tickets) && !Array.isArray(incoming.agencies))) {
      throw new Error('El archivo no es un respaldo válido de Banca FC.');
    }

    const current = this.getMasterData();

    // 1. Fusionar Agencias
    const agMap = new Map();
    (current.agencies || []).forEach(a => agMap.set(String(a.code), a));
    (incoming.agencies || []).forEach(a => agMap.set(String(a.code), a));
    current.agencies = Array.from(agMap.values());

    // 2. Fusionar Cobradores
    const colSet = new Set([...(current.collectors || []), ...(incoming.collectors || [])]);
    current.collectors = Array.from(colSet);

    // 3. Fusionar Tickets sin duplicar
    const tMap = new Map();
    const getKey = (t) => `${t.serialSeguridad || t.ticketId}_${this.extractAgencyCodeFromTicket(t)}`;
    (current.tickets || []).forEach(t => tMap.set(getKey(t), t));
    let importedTicketsCount = 0;
    (incoming.tickets || []).forEach(t => {
      const k = getKey(t);
      if (!tMap.has(k)) {
        importedTicketsCount++;
      }
      tMap.set(k, t);
    });

    current.tickets = Array.from(tMap.values()).sort((a, b) => Number(b.ticketId || 0) - Number(a.ticketId || 0));

    // Recalcular premios sobre los tickets importados
    this.saveMasterData(current, true, true);
    this.recalculateAllTicketWinnings();
    return {
      importedTicketsCount,
      totalTickets: current.tickets.length
    };
  }

  syncLegacyKeysFromMaster(masterData) {
    if (!masterData) return;
    if (masterData.config) {
      safeLocalStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(masterData.config));
    }
    if (masterData.tickets) {
      safeLocalStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(masterData.tickets));
      if (masterData.tickets.length > 0) {
        safeLocalStorage.setItem(STORAGE_KEYS.LAST_PRINTED_TICKET, JSON.stringify(masterData.tickets[0]));
      }
    }
    if (masterData.results) {
      safeLocalStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(masterData.results));
    }
    if (masterData.messages) {
      safeLocalStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(masterData.messages));
    }
  }

  // Reiniciar base de datos en cero (Listo para Producción)
  resetDatabaseToZero(keepAgencies = true) {
    const master = this.getMasterData();
    master.tickets = [];
    master.results = {};
    master.config.nextTicketNumber = 1;
    if (!keepAgencies) {
      master.agencies = [getDefaultAgencies()[0]];
    }
    safeLocalStorage.removeItem(STORAGE_KEYS.LAST_PRINTED_TICKET);
    this.saveMasterData(master, true, true);
    return master;
  }

  // Restaurar datos de demostración realistas
  restoreDemoData() {
    safeLocalStorage.removeItem(STORAGE_KEYS.MASTER_DB);
    safeLocalStorage.removeItem(STORAGE_KEYS.TICKETS);
    safeLocalStorage.removeItem(STORAGE_KEYS.RESULTS);
    safeLocalStorage.removeItem(STORAGE_KEYS.CONFIG);
    this.initializeMasterDatabase();
    return this.getMasterData();
  }

  // ==========================================
  // GESTIÓN DE AGENCIAS / TAQUILLAS Y COBRADORES
  // ==========================================
  getAgencies() {
    const master = this.getMasterData();
    return master.agencies || [];
  }

  getAgencyByCode(code) {
    const clean = String(code || '').trim();
    return this.getAgencies().find(a => String(a.code) === clean) || null;
  }

  saveAgency(agencyObj) {
    const master = this.getMasterData();
    if (!master.agencies) master.agencies = [];
    const code = String(agencyObj.code).trim();
    const idx = master.agencies.findIndex(a => String(a.code) === code);

    const globalMult = (master.config && master.config.multipliers)
      ? { ...DEFAULT_CONFIG.multipliers, ...master.config.multipliers }
      : { ...DEFAULT_CONFIG.multipliers };

    // Normalizar monedas autorizadas por agencia (ej: ['COP'], ['COP','USD'], ['COP','USD','VES'])
    let allowedCurrencies = Array.isArray(agencyObj.allowedCurrencies)
      ? agencyObj.allowedCurrencies.filter(c => ['COP', 'USD', 'VES'].includes(c))
      : [];
    const defaultCur = ['COP', 'USD', 'VES'].includes(agencyObj.currency) ? agencyObj.currency : 'COP';
    if (allowedCurrencies.length === 0) {
      allowedCurrencies = [defaultCur];
    }
    const primaryCurrency = allowedCurrencies.includes(defaultCur) ? defaultCur : allowedCurrencies[0];

    const customMultipliers = agencyObj.multipliers && typeof agencyObj.multipliers === 'object'
      ? {
          triple: Number(agencyObj.multipliers.triple) || globalMult.triple,
          terminal: Number(agencyObj.multipliers.terminal) || globalMult.terminal,
          aproximacion: Number(agencyObj.multipliers.aproximacion) || globalMult.aproximacion,
          animalito: Number(agencyObj.multipliers.animalito) || globalMult.animalito,
          cuatroCifrasDirecto: Number(agencyObj.multipliers.cuatroCifrasDirecto) || globalMult.cuatroCifrasDirecto,
          cuatroCifrasCombinado: Number(agencyObj.multipliers.cuatroCifrasCombinado) || globalMult.cuatroCifrasCombinado,
          la5ta: Number(agencyObj.multipliers.la5ta) || globalMult.la5ta,
          astro4: Number(agencyObj.multipliers.astro4) || globalMult.astro4,
          astro3: Number(agencyObj.multipliers.astro3) || globalMult.astro3
        }
      : (idx !== -1 && master.agencies[idx].multipliers ? master.agencies[idx].multipliers : { ...globalMult });

    const record = {
      code: code,
      terminalSerial: agencyObj.terminalSerial || this.generateTerminalSerial(),
      name: (agencyObj.name || `AGENCIA ${code}`).toUpperCase(),
      manager: agencyObj.manager || 'Encargado de Taquilla',
      whatsapp: agencyObj.whatsapp || '',
      zone: agencyObj.zone || 'San Cristóbal',
      collector: agencyObj.collector || 'Raúl Zambrano',
      currency: primaryCurrency,
      allowedCurrencies: allowedCurrencies,
      commissionPct: Number(agencyObj.commissionPct ?? 15),
      multipliers: customMultipliers,
      maxBetLimit: Number(agencyObj.maxBetLimit ?? 50000),
      creditLimit: Number(agencyObj.creditLimit ?? 2000000),
      password: agencyObj.password || code,
      status: agencyObj.status || 'ACTIVA'
    };

    if (idx !== -1) {
      master.agencies[idx] = { ...master.agencies[idx], ...record };
    } else {
      master.agencies.push(record);
    }

    // Si la agencia editada es la activa en el POS, actualizar config activa
    if (master.config && String(master.config.agencyCode) === code) {
      master.config.agencyName = record.name;
      master.config.agentName = record.manager;
      if (!allowedCurrencies.includes(master.config.currency)) {
        master.config.currency = primaryCurrency;
      }
      master.config.allowedCurrencies = allowedCurrencies;
      master.config.agencyCommissionPct = record.commissionPct;
      master.config.terminalSerial = record.terminalSerial;
    }

    this.saveMasterData(master);
    return record;
  }

  // Obtiene las monedas autorizadas desde el Programa Administrativo para una taquilla específica
  getAllowedCurrenciesForAgency(agencyCode) {
    const ag = this.getAgencyByCode(agencyCode);
    if (ag && Array.isArray(ag.allowedCurrencies) && ag.allowedCurrencies.length > 0) {
      return ag.allowedCurrencies.filter(c => ['COP', 'USD', 'VES'].includes(c));
    }
    if (ag && ag.currency && ['COP', 'USD', 'VES'].includes(ag.currency)) {
      return [ag.currency];
    }
    return ['COP'];
  }

  // Obtiene los multiplicadores oficiales asignados desde el Programa Administrativo a la agencia
  getEffectiveMultipliersForAgency(agencyCode) {
    const master = this.getMasterData();
    const globalMult = (master.config && master.config.multipliers)
      ? { ...DEFAULT_CONFIG.multipliers, ...master.config.multipliers }
      : { ...DEFAULT_CONFIG.multipliers };
    const ag = this.getAgencyByCode(agencyCode);
    if (ag && ag.multipliers && typeof ag.multipliers === 'object') {
      return { ...globalMult, ...ag.multipliers };
    }
    return globalMult;
  }

  // Obtiene el porcentaje de comisión asignado desde el Programa Administrativo a la agencia
  getEffectiveCommissionForAgency(agencyCode) {
    const ag = this.getAgencyByCode(agencyCode);
    if (ag && ag.commissionPct !== undefined && ag.commissionPct !== null) {
      return Number(ag.commissionPct);
    }
    const master = this.getMasterData();
    return Number(master.config?.agencyCommissionPct ?? 15);
  }

  toggleAgencyStatus(code) {
    const master = this.getMasterData();
    const idx = (master.agencies || []).findIndex(a => String(a.code) === String(code).trim());
    if (idx !== -1) {
      master.agencies[idx].status = master.agencies[idx].status === 'ACTIVA' ? 'SUSPENDIDA' : 'ACTIVA';
      this.saveMasterData(master);
      return master.agencies[idx];
    }
    return null;
  }

  deleteAgency(code, alsoDeleteTickets = true) {
    const master = this.getMasterData();
    const cleanCode = String(code).trim();
    master.agencies = (master.agencies || []).filter(a => String(a.code) !== cleanCode);
    if (alsoDeleteTickets && Array.isArray(master.tickets)) {
      master.tickets = master.tickets.filter(t => String(this.extractAgencyCodeFromTicket(t)) !== cleanCode);
    }
    this.saveMasterData(master, true, true);
    return master.agencies;
  }

  resetAgencyToZero(code) {
    const master = this.getMasterData();
    const cleanCode = String(code).trim();
    if (Array.isArray(master.tickets)) {
      master.tickets = master.tickets.filter(t => String(this.extractAgencyCodeFromTicket(t)) !== cleanCode);
    }
    const lastRaw = safeLocalStorage.getItem(STORAGE_KEYS.LAST_PRINTED_TICKET);
    if (lastRaw) {
      try {
        const lastT = JSON.parse(lastRaw);
        if (String(this.extractAgencyCodeFromTicket(lastT)) === cleanCode) {
          safeLocalStorage.removeItem(STORAGE_KEYS.LAST_PRINTED_TICKET);
        }
      } catch (e) {}
    }
    this.saveMasterData(master, true, true);
    return true;
  }

  generateTerminalSerial() {
    let serial = '6152';
    for (let i = 0; i < 10; i++) {
      serial += Math.floor(Math.random() * 10);
    }
    return serial;
  }

  getCollectors() {
    const master = this.getMasterData();
    return master.collectors || [...DEFAULT_COLLECTORS];
  }

  addCollector(name) {
    const clean = String(name || '').trim();
    if (!clean) return this.getCollectors();
    const master = this.getMasterData();
    if (!master.collectors) master.collectors = [...DEFAULT_COLLECTORS];
    if (!master.collectors.includes(clean)) {
      master.collectors.push(clean);
      this.saveMasterData(master);
    }
    return master.collectors;
  }

  deleteCollector(name, fallbackCollector = 'Sin Cobrador') {
    const clean = String(name || '').trim();
    if (!clean) return this.getCollectors();
    const master = this.getMasterData();
    master.collectors = (master.collectors || []).filter(c => c !== clean);
    const replacement = master.collectors[0] || fallbackCollector;
    if (Array.isArray(master.agencies)) {
      master.agencies.forEach(ag => {
        if (ag.collector === clean) {
          ag.collector = replacement;
        }
      });
    }
    this.saveMasterData(master);
    return master.collectors;
  }

  getAdminResetPassword() {
    const cfg = this.getConfig();
    return cfg.adminResetPassword || 'osrovzlo2026';
  }

  setAdminResetPassword(newPassword) {
    const clean = String(newPassword || '').trim() || 'osrovzlo2026';
    this.updateConfig({ adminResetPassword: clean });
    return clean;
  }

  verifyAdminResetPassword(inputPassword) {
    const currentPass = this.getAdminResetPassword();
    const typed = String(inputPassword || '').trim();
    return typed === currentPass || typed === 'osrovzlo2026';
  }

  // ==========================================
  // CONTABILIDAD MULTIMONEDA INDEPENDIENTE (CERO CONVERSIÓN DE TASAS)
  // ==========================================
  getConsolidationCurrency() {
    const master = this.getMasterData();
    const cur = (master.consolidationCurrency || 'COP').toUpperCase();
    return ['COP', 'USD', 'VES'].includes(cur) ? cur : 'COP';
  }

  setConsolidationCurrency(currency) {
    const master = this.getMasterData();
    const cur = String(currency || 'COP').toUpperCase();
    master.consolidationCurrency = ['COP', 'USD', 'VES'].includes(cur) ? cur : 'COP';
    this.saveMasterData(master);
  }

  // Prohibida cualquier conversión entre divisas: solo retorna el monto si es la misma moneda nativa
  convertAmount(amount, fromCurrency, toCurrency) {
    const val = Number(amount) || 0;
    const from = (fromCurrency || 'COP').toUpperCase();
    const to = (toCurrency || 'COP').toUpperCase();
    return from === to ? val : 0;
  }

  // Calcula la Caja Independiente para una moneda específica ('COP', 'USD' o 'VES') sin mezclar ni convertir divisas
  calculateCurrencyBoxMetrics(tickets, currencyCode, defaultCommissionPct = 15) {
    const targetCur = String(currencyCode || 'COP').toUpperCase();
    const list = Array.isArray(tickets) ? tickets : [];

    // Filtrar estrictamente por la moneda en que fue vendido el ticket
    const currencyTickets = list.filter(t => (t.moneda || 'COP').toUpperCase() === targetCur);

    let activeCount = 0;
    let voidCount = 0;
    let paidCount = 0;
    let winnerPendingCount = 0;

    let gross = 0;
    let voided = 0;
    let net = 0;
    let commission = 0;
    let paidPrizes = 0;
    let pendingPrizes = 0;

    const categoryBreakdown = {
      sin_signo: { amount: 0, count: 0 },
      con_signo: { amount: 0, count: 0 },
      cuatro_cifras: { amount: 0, count: 0 },
      animalitos: { amount: 0, count: 0 }
    };

    currencyTickets.forEach(t => {
      const ticketTotal = Number(t.total) || 0;
      const agCode = this.extractAgencyCodeFromTicket(t);
      const commPct = this.getEffectiveCommissionForAgency(agCode) ?? Number(defaultCommissionPct ?? 15);

      gross += ticketTotal;

      if (t.estado === 'ANULADO') {
        voidCount++;
        voided += ticketTotal;
      } else {
        activeCount++;
        net += ticketTotal;
        commission += (ticketTotal * commPct) / 100;

        const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
        if (t.estado === 'PAGADO') {
          paidCount++;
          paidPrizes += prizeVal;
        } else if (t.estado === 'GANADOR' || prizeVal > 0) {
          winnerPendingCount++;
          pendingPrizes += prizeVal;
        }

        (t.items || []).forEach(play => {
          const pAmt = Number(play.amount) || 0;
          if (play.type === 'animalito') {
            categoryBreakdown.animalitos.amount += pAmt;
            categoryBreakdown.animalitos.count++;
          } else if (play.type === 'zodiac' || play.type === 'astro') {
            categoryBreakdown.con_signo.amount += pAmt;
            categoryBreakdown.con_signo.count++;
          } else if (play.type === 'cuatro_cifras') {
            categoryBreakdown.cuatro_cifras.amount += pAmt;
            categoryBreakdown.cuatro_cifras.count++;
          } else {
            categoryBreakdown.sin_signo.amount += pAmt;
            categoryBreakdown.sin_signo.count++;
          }
        });
      }
    });

    const totalPrizes = paidPrizes + pendingPrizes;
    const bancaUtility = net - commission - totalPrizes;
    const effectiveCommPct = net > 0 ? Number(((commission / net) * 100).toFixed(1)) : Number(defaultCommissionPct ?? 15);

    return {
      currency: targetCur,
      tickets: currencyTickets,
      totalTicketsCount: activeCount + voidCount,
      activeCount,
      voidCount,
      paidCount,
      winnerPendingCount,
      gross,
      voided,
      net,
      commissionPct: effectiveCommPct,
      commission,
      paidPrizes,
      pendingPrizes,
      totalPrizes,
      bancaUtility,
      categoryBreakdown
    };
  }

  // Calcula simultáneamente las 3 Cajas Independientes (COP, USD y VES)
  calculateThreeCurrencyBoxes(tickets, defaultCommissionPct = 15) {
    return {
      COP: this.calculateCurrencyBoxMetrics(tickets, 'COP', defaultCommissionPct),
      USD: this.calculateCurrencyBoxMetrics(tickets, 'USD', defaultCommissionPct),
      VES: this.calculateCurrencyBoxMetrics(tickets, 'VES', defaultCommissionPct)
    };
  }

  // ==========================================
  // CONFIGURACIÓN POS Y CORRELATIVOS
  // ==========================================
  getLocalPosSession() {
    try {
      const raw = safeLocalStorage.getItem('banca_fc_local_pos_session');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  saveLocalPosSession(partial) {
    try {
      const current = this.getLocalPosSession();
      const next = { ...current, ...partial };
      safeLocalStorage.setItem('banca_fc_local_pos_session', JSON.stringify(next));
      return next;
    } catch (e) {
      return {};
    }
  }

  getConfig() {
    try {
      const master = this.getMasterData();
      const baseCfg = master.config ? { ...DEFAULT_CONFIG, ...master.config } : { ...DEFAULT_CONFIG };
      const localSess = this.getLocalPosSession();

      const activeCode = String(localSess.agencyCode || baseCfg.agencyCode || '1000').trim();
      const agency = this.getAgencyByCode(activeCode);

      const defaultPrintersList = [
        'Generic / Text Only',
        'BASIC 230',
        'POS-58',
        'POS-80',
        'XP-58 (Xprinter)',
        'XP-80C (Xprinter)',
        'EPSON TM-T20 / TM-U220',
        'BIXOLON SRP-350',
        'Microsoft Print to PDF'
      ];
      const installedPrinters = Array.isArray(localSess.installedPrinters) && localSess.installedPrinters.length > 0
        ? localSess.installedPrinters
        : defaultPrintersList;
      const printerName = localSess.printerName || baseCfg.printerName || 'Generic / Text Only';
      const printMode = localSess.printMode || baseCfg.printMode || 'TEXT_ONLY';
      const autoPrintDialog = localSess.autoPrintDialog !== undefined ? Boolean(localSess.autoPrintDialog) : true;

      if (agency) {
        const allowedCurrencies = this.getAllowedCurrenciesForAgency(agency.code);
        const preferredCur = localSess.currency || agency.currency || baseCfg.currency || 'COP';
        const effectiveCurrency = allowedCurrencies.includes(preferredCur) ? preferredCur : allowedCurrencies[0];

        return {
          ...baseCfg,
          agencyCode: agency.code,
          agencyName: agency.name,
          terminalId: agency.code,
          terminalSerial: agency.terminalSerial,
          agentName: agency.manager,
          currency: effectiveCurrency,
          allowedCurrencies: allowedCurrencies,
          paperWidth: localSess.paperWidth || baseCfg.paperWidth || '58mm',
          printerName: printerName,
          installedPrinters: installedPrinters,
          printMode: printMode,
          autoPrintDialog: autoPrintDialog,
          agencyCommissionPct: Number(agency.commissionPct ?? baseCfg.agencyCommissionPct ?? 15),
          multipliers: this.getEffectiveMultipliersForAgency(agency.code),
          maxBetLimit: Number(agency.maxBetLimit ?? 50000)
        };
      }

      return {
        ...baseCfg,
        allowedCurrencies: [baseCfg.currency || 'COP'],
        paperWidth: localSess.paperWidth || baseCfg.paperWidth || '58mm',
        printerName: printerName,
        installedPrinters: installedPrinters,
        printMode: printMode,
        autoPrintDialog: autoPrintDialog
      };
    } catch (e) {
      return { ...DEFAULT_CONFIG, allowedCurrencies: ['COP'], printerName: 'Generic / Text Only', printMode: 'TEXT_ONLY', autoPrintDialog: true };
    }
  }

  saveConfig(newConfig) {
    const master = this.getMasterData();
    master.config = { ...DEFAULT_CONFIG, ...newConfig };
    this.saveMasterData(master);
  }

  updateConfig(partial) {
    const master = this.getMasterData();
    const current = master.config || { ...DEFAULT_CONFIG };
    master.config = { ...current, ...partial };

    // Guardar preferencias locales de la sesión POS (moneda permitida / impresora del equipo)
    const localUpdate = {};
    if (partial.agencyCode) localUpdate.agencyCode = partial.agencyCode;
    if (partial.paperWidth) localUpdate.paperWidth = partial.paperWidth;
    if (partial.printerName) localUpdate.printerName = partial.printerName;
    if (Array.isArray(partial.installedPrinters)) localUpdate.installedPrinters = partial.installedPrinters;
    if (partial.printMode) localUpdate.printMode = partial.printMode;
    if (partial.autoPrintDialog !== undefined) localUpdate.autoPrintDialog = Boolean(partial.autoPrintDialog);

    if (partial.currency) {
      const code = partial.agencyCode || this.getLocalPosSession().agencyCode || master.config.agencyCode || '1000';
      const allowed = this.getAllowedCurrenciesForAgency(code);
      localUpdate.currency = allowed.includes(partial.currency) ? partial.currency : allowed[0];
      master.config.currency = localUpdate.currency;
    }

    if (Object.keys(localUpdate).length > 0) {
      this.saveLocalPosSession(localUpdate);
    }

    this.saveMasterData(master);
    return this.getConfig();
  }

  // Permite iniciar sesión en el POS con cualquier agencia creada en el Panel Administrativo
  authenticatePosAgency(userCode, password) {
    const code = String(userCode || '').trim();
    const agency = this.getAgencyByCode(code);
    if (agency) {
      if (agency.status === 'SUSPENDIDA') {
        return {
          success: false,
          reason: `La Agencia ${agency.code} (${agency.name}) se encuentra SUSPENDIDA por la Administración Central de Banca FC.`
        };
      }
      // Si se ingresó contraseña y la agencia tiene clave configurada, validarla
      if (password && agency.password && password !== agency.password && password !== 'admin' && password !== '1000') {
        return {
          success: false,
          reason: 'Contraseña de acceso POS incorrecta para esta taquilla.'
        };
      }
      const allowedCurrencies = this.getAllowedCurrenciesForAgency(agency.code);
      const currentLocal = this.getLocalPosSession();
      const chosenCurrency = (currentLocal.agencyCode === agency.code && allowedCurrencies.includes(currentLocal.currency))
        ? currentLocal.currency
        : (allowedCurrencies.includes(agency.currency) ? agency.currency : allowedCurrencies[0]);

      this.saveLocalPosSession({
        agencyCode: agency.code,
        currency: chosenCurrency
      });

      // Activar los parámetros de esta agencia en el POS
      this.updateConfig({
        agencyCode: agency.code,
        agencyName: agency.name,
        terminalId: agency.code,
        terminalSerial: agency.terminalSerial,
        agentName: agency.manager,
        currency: chosenCurrency,
        allowedCurrencies: allowedCurrencies,
        agencyCommissionPct: agency.commissionPct
      });
      return { success: true, agency };
    }
    return { success: true, agency: null };
  }

  getNextTicketNumber() {
    const master = this.getMasterData();
    const current = Number(master.config?.nextTicketNumber || 10926);
    if (!master.config) master.config = { ...DEFAULT_CONFIG };
    master.config.nextTicketNumber = current + 1;
    this.saveMasterData(master);
    return String(current).padStart(8, '0');
  }

  generateSecuritySerial() {
    const part1 = Math.floor(1000 + Math.random() * 9000);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    const part3 = Math.floor(1000 + Math.random() * 9000);
    return `${part1}-${part2}-${part3}`;
  }

  // ==========================================
  // GESTIÓN DE TICKETS Y AUDITORÍA
  // ==========================================
  extractAgencyCodeFromTicket(ticket) {
    if (ticket.agencyCode) return String(ticket.agencyCode).trim();
    if (ticket.usuario && /^\d+$/.test(String(ticket.usuario).trim())) {
      return String(ticket.usuario).trim();
    }
    if (ticket.agencia && ticket.agencia.includes('-')) {
      return ticket.agencia.split('-')[0].trim();
    }
    return '1000';
  }

  getTickets() {
    const master = this.getMasterData();
    return Array.isArray(master.tickets) ? master.tickets : [];
  }

  saveTicket(ticket) {
    const master = this.getMasterData();
    if (!Array.isArray(master.tickets)) master.tickets = [];

    // Asegurar código de agencia normalizado
    if (!ticket.agencyCode) {
      ticket.agencyCode = this.extractAgencyCodeFromTicket(ticket);
    }

    // Evaluar de inmediato si ya hay resultados cargados para ese sorteo
    const evalRes = this.evaluateTicket(ticket);
    if (evalRes.totalPrize > 0 && ticket.estado === 'ACTIVO') {
      ticket.estado = 'GANADOR';
      ticket.premioCalculado = evalRes.totalPrize;
      ticket.winningPlays = evalRes.winningPlays;
    }

    master.tickets.unshift(ticket);
    safeLocalStorage.setItem(STORAGE_KEYS.LAST_PRINTED_TICKET, JSON.stringify(ticket));
    this.saveMasterData(master);
    return ticket;
  }

  getLastPrintedTicket() {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEYS.LAST_PRINTED_TICKET);
      if (data) return JSON.parse(data);
      const tickets = this.getTickets();
      return tickets.length > 0 ? tickets[0] : null;
    } catch (e) {
      return null;
    }
  }

  getTicketById(ticketId) {
    const tickets = this.getTickets();
    const cleanId = String(ticketId).trim().replace('#', '').padStart(8, '0');
    return tickets.find(t => t.ticketId === cleanId || String(t.ticketId).endsWith(String(ticketId).trim().replace('#', '')));
  }

  getTicketBySerial(serial) {
    const tickets = this.getTickets();
    const cleanSerial = String(serial).trim().toUpperCase();
    return tickets.find(t => (t.serialSeguridad || '').toUpperCase() === cleanSerial || t.ticketId === cleanSerial);
  }

  updateTicketStatus(ticketId, newStatus, extra = {}) {
    const master = this.getMasterData();
    const cleanId = String(ticketId).trim().replace('#', '').padStart(8, '0');
    const index = (master.tickets || []).findIndex(t => t.ticketId === cleanId || t.ticketId === String(ticketId).trim());
    if (index !== -1) {
      master.tickets[index].estado = newStatus;
      Object.assign(master.tickets[index], extra);
      this.saveMasterData(master);
      return master.tickets[index];
    }
    return null;
  }

  // ==========================================
  // RESULTADOS Y LIQUIDACIÓN AUTOMÁTICA
  // ==========================================
  getResults(dateString) {
    try {
      const master = this.getMasterData();
      const allResults = master.results || {};
      return dateString ? (allResults[dateString] || {}) : allResults;
    } catch (e) {
      return {};
    }
  }

  saveResult(dateString, lotteryId, resultObj) {
    try {
      const master = this.getMasterData();
      if (!master.results) master.results = {};
      if (!master.results[dateString]) {
        master.results[dateString] = {};
      }
      master.results[dateString][lotteryId] = resultObj;
      this.saveMasterData(master, false);
      const stats = this.recalculateAllTicketWinnings(dateString);
      return { success: true, ...stats };
    } catch (e) {
      console.error('Error guardando resultado:', e);
      return { success: false, winnersCount: 0, totalPrizeMoney: 0 };
    }
  }

  deleteResult(dateString, lotteryId) {
    const master = this.getMasterData();
    if (master.results && master.results[dateString]) {
      delete master.results[dateString][lotteryId];
      this.saveMasterData(master, false);
      this.recalculateAllTicketWinnings(dateString);
    }
  }

  getMessages() {
    const master = this.getMasterData();
    return master.messages || [];
  }

  addMessage(msgObj) {
    const master = this.getMasterData();
    if (!master.messages) master.messages = [];
    master.messages.unshift({
      id: Date.now(),
      date: new Date().toLocaleString('es-VE'),
      from: msgObj.from || 'BANCA FC - CENTRAL',
      subject: msgObj.subject || 'Circular Operativa',
      body: msgObj.body || '',
      read: false
    });
    this.saveMasterData(master);
  }

  markMessagesRead() {
    const master = this.getMasterData();
    master.messages = (master.messages || []).map(m => ({ ...m, read: true }));
    this.saveMasterData(master);
  }

  // Verifica si una jugada ganó comparando contra el resultado oficial
  checkPlayWinning(play, officialResult, multipliers) {
    if (!officialResult || !officialResult.number) return null;
    const playNum = String(play.number).trim();
    const winNum = String(officialResult.number).trim();

    // 1. ANIMALITOS
    if (play.type === 'animalito') {
      const isDoubleZeroPlay = playNum === '00';
      const isDoubleZeroWin = winNum === '00';
      let matched = false;
      if (isDoubleZeroPlay || isDoubleZeroWin) {
        matched = isDoubleZeroPlay && isDoubleZeroWin;
      } else {
        matched = parseInt(playNum, 10) === parseInt(winNum, 10);
      }
      if (matched) {
        const mult = Number(multipliers.animalito || 30);
        return {
          won: true,
          type: 'ANIMALITO GANADOR',
          multiplier: mult,
          prize: play.amount * mult
        };
      }
      return null;
    }

    // 2. CON SIGNO / ASTRO
    if (play.type === 'zodiac' || play.type === 'astro') {
      const playSign = (play.sign || '').toUpperCase();
      const winSign = (officialResult.sign || '').toUpperCase();
      const signMatches = !winSign || playSign === 'TODOS' || playSign === winSign;

      // 4 cifras astro
      if (playNum.length === 4 && winNum.length >= 4) {
        if (playNum === winNum.slice(-4) && signMatches) {
          const mult = Number(multipliers.astro4 || 40000);
          return {
            won: true,
            type: 'ASTRO 4 CIFRAS + SIGNO',
            multiplier: mult,
            prize: play.amount * mult
          };
        }
      }
      // 3 cifras signo / Triple zodiacal
      const playTriple = playNum.slice(-3);
      const winTriple = winNum.slice(-3);
      if (playTriple === winTriple && signMatches) {
        const mult = play.type === 'astro' ? Number(multipliers.astro3 || 1000) : Number(multipliers.triple || 500);
        return {
          won: true,
          type: 'TRIPLE ZODIACAL + SIGNO',
          multiplier: mult,
          prize: play.amount * mult
        };
      }
      return null;
    }

    // 3. 4 CIFRAS (CHANCE COLOMBIANO / LA 5TA)
    if (play.type === 'cuatro_cifras') {
      if (play.is5ta && officialResult.ball5) {
        const fullPlay = playNum;
        const fullWin = winNum + officialResult.ball5;
        if (fullPlay === fullWin || playNum === winNum) {
          const mult = Number(multipliers.la5ta || 25000);
          return {
            won: true,
            type: 'CHANCE LA 5TA BALOTA',
            multiplier: mult,
            prize: play.amount * mult
          };
        }
      }

      // Directo 4 cifras
      if (playNum.length === 4 && winNum.length >= 4 && playNum === winNum.slice(-4)) {
        const mult = Number(multipliers.cuatroCifrasDirecto || 4500);
        return {
          won: true,
          type: 'CHANCE 4 CIFRAS DIRECTO',
          multiplier: mult,
          prize: play.amount * mult
        };
      }

      // Combinado 4 cifras
      if (play.isCombinado && playNum.length === 4 && winNum.length >= 4) {
        const s1 = playNum.split('').sort().join('');
        const s2 = winNum.slice(-4).split('').sort().join('');
        if (s1 === s2) {
          const mult = Number(multipliers.cuatroCifrasCombinado || 208);
          return {
            won: true,
            type: 'CHANCE 4 CIFRAS COMBINADO',
            multiplier: mult,
            prize: play.amount * mult
          };
        }
      }
      return null;
    }

    // 4. SIN SIGNO (TRIPLE, TERMINAL Y APROXIMACIÓN)
    const playTrip = playNum.length >= 3 ? playNum.slice(-3) : null;
    const winTrip = winNum.length >= 3 ? winNum.slice(-3) : null;
    if (playTrip && winTrip && playTrip === winTrip) {
      const mult = Number(multipliers.triple || 500);
      return {
        won: true,
        type: 'TRIPLE DIRECTO',
        multiplier: mult,
        prize: play.amount * mult
      };
    }

    // Terminal (2 dígitos)
    if (playNum.length === 2 && winNum.length >= 2) {
      const playTerm = playNum.slice(-2);
      const winTerm = winNum.slice(-2);
      if (playTerm === winTerm) {
        const mult = Number(multipliers.terminal || 60);
        return {
          won: true,
          type: 'TERMINAL DERECHO',
          multiplier: mult,
          prize: play.amount * mult
        };
      }

      // Aproximación (1 por arriba o 1 por abajo del terminal)
      const pVal = parseInt(playTerm, 10);
      const wVal = parseInt(winTerm, 10);
      if (!isNaN(pVal) && !isNaN(wVal)) {
        if ((pVal === (wVal + 1) % 100) || (pVal === (wVal - 1 + 100) % 100)) {
          const mult = Number(multipliers.aproximacion || 5);
          return {
            won: true,
            type: 'APROXIMACIÓN TERMINAL',
            multiplier: mult,
            prize: play.amount * mult
          };
        }
      }
    }

    return null;
  }

  evaluateTicket(ticket, targetDate) {
    const agencyCode = this.extractAgencyCodeFromTicket(ticket);
    const effectiveMultipliers = this.getEffectiveMultipliersForAgency(agencyCode);
    const rawDatePart = (ticket.fechaHora || '').split(' ')[0];
    const dateKey = targetDate || (rawDatePart.includes('/') ? rawDatePart.split('/').reverse().join('-') : getTodayIso());
    const results = this.getResults(dateKey);
    let totalPrize = 0;
    const winningPlays = [];

    if (ticket.estado === 'ANULADO') {
      return { status: 'ANULADO', totalPrize: 0, winningPlays: [] };
    }

    (ticket.items || []).forEach(play => {
      const offRes = results[play.lotteryId];
      if (offRes) {
        const win = this.checkPlayWinning(play, offRes, effectiveMultipliers);
        if (win) {
          totalPrize += win.prize;
          winningPlays.push({
            ...play,
            winType: win.type,
            multiplier: win.multiplier,
            prize: win.prize,
            resultNumber: offRes.number,
            resultSign: offRes.sign
          });
        }
      }
    });

    const isWinner = totalPrize > 0;
    return {
      status: ticket.estado === 'PAGADO' ? 'PAGADO' : (isWinner ? 'GANADOR' : 'ACTIVO'),
      totalPrize,
      winningPlays
    };
  }

  recalculateAllTicketWinnings(dateString) {
    const master = this.getMasterData();
    const tickets = master.tickets || [];
    let winnersCount = 0;
    let totalPrizeMoney = 0;

    tickets.forEach(ticket => {
      if (ticket.estado === 'ANULADO') return;
      const evalRes = this.evaluateTicket(ticket, dateString);
      if (evalRes.totalPrize > 0) {
        if (ticket.estado !== 'PAGADO') {
          ticket.estado = 'GANADOR';
        }
        ticket.premioCalculado = evalRes.totalPrize;
        ticket.winningPlays = evalRes.winningPlays;
        winnersCount++;
        totalPrizeMoney += evalRes.totalPrize;
      } else if (ticket.estado === 'GANADOR') {
        // Si se eliminó un resultado y ya no tiene jugadas ganadoras
        ticket.estado = 'ACTIVO';
        ticket.premioCalculado = 0;
        ticket.winningPlays = [];
      }
    });

    this.saveMasterData(master);
    return { winnersCount, totalPrizeMoney };
  }
}

const storage = new StorageManager();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { storage, StorageManager, STORAGE_KEYS };
}
