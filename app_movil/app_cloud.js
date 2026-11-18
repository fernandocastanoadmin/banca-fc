// app_movil/app_cloud.js - Motor Independiente de Sincronización Firebase + Reglas de Negocio
// App Móvil & Tablet "Banca FC - Fernando Castaño (Seguro Te Paga)"

const APP_DEFAULT_FIREBASE = {
  apiKey: '',
  authDomain: 'banca-fc-castano.firebaseapp.com',
  databaseURL: 'https://banca-fc-castano-default-rtdb.firebaseio.com',
  projectId: 'banca-fc-castano'
};

const APP_CLOUD_CFG_KEY = 'banca_fc_firebase_config';
const APP_MASTER_CACHE_KEY = 'banca_fc_app_master_cache';
const APP_SESSION_KEY = 'banca_fc_app_session';
const APP_LAST_TICKET_KEY = 'banca_fc_app_last_ticket';

const APP_DEFAULT_MULTIPLIERS = {
  triple: 500,
  terminal: 60,
  aproximacion: 5,
  animalito: 30,
  cuatroCifrasDirecto: 4500,
  cuatroCifrasCombinado: 208,
  la5ta: 25000,
  astro4: 40000,
  astro3: 1000
};

function appDefaultAgencies() {
  return [
    {
      code: '1000',
      name: 'AG PRINCIPAL FERNANDO CASTAÑO',
      manager: 'Fernando Castaño',
      currency: 'COP',
      allowedCurrencies: ['COP', 'USD', 'VES'],
      commissionPct: 15,
      maxBetLimit: 100000,
      password: '1000',
      status: 'ACTIVA'
    },
    {
      code: '7336',
      name: 'AG BARRIO SUCRE',
      manager: 'Carlos Andrés Méndez',
      currency: 'COP',
      commissionPct: 15,
      maxBetLimit: 50000,
      password: '7336',
      status: 'ACTIVA'
    },
    {
      code: '7337',
      name: 'AG CENTRO QUINTA AVENIDA',
      manager: 'María Eugenia Chacón',
      currency: 'VES',
      commissionPct: 15,
      maxBetLimit: 800,
      password: '7337',
      status: 'ACTIVA'
    }
  ];
}

class AppCloudSync {
  constructor() {
    this.status = 'CONNECTING';
    this.lastError = null;
    this.lastRemoteTimestamp = null;
    this.lastSyncClock = null;
    this.isPushing = false;
    this.eventSource = null;
    this.pollTimer = null;
    this.listeners = new Set();

    this.masterData = this.loadMasterCache();
    this.session = this.loadSession();
    this.init();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitChange() {
    this.listeners.forEach(fn => {
      try { fn(this); } catch (_) {}
    });
  }

  getTodayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDateTime12h(now = new Date()) {
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'pm' : 'am';
    hr = hr % 12 || 12;
    return `${dd}/${mm}/${yyyy} ${hr}:${min}:${sec} ${ampm}`;
  }

  formatTimeOnly12h(now = new Date()) {
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    return `${hr}:${min}:${sec} ${ampm}`;
  }

  loadMasterCache() {
    try {
      const raw = localStorage.getItem(APP_MASTER_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
    return {
      bancaName: 'BANCA FC FERNANDO CASTAÑO',
      config: {
        agencyCode: '1000',
        agencyName: 'FERNANDO CASTAÑO',
        currency: 'COP',
        agencyCommissionPct: 15,
        nextTicketNumber: 10926,
        multipliers: { ...APP_DEFAULT_MULTIPLIERS }
      },
      agencies: appDefaultAgencies(),
      tickets: [],
      results: {},
      messages: []
    };
  }

  persistMasterCache() {
    try {
      localStorage.setItem(APP_MASTER_CACHE_KEY, JSON.stringify(this.masterData));
    } catch (_) {}
  }

  loadSession() {
    try {
      const raw = localStorage.getItem(APP_SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { agencyCode: null, currency: 'COP' };
  }

  saveSession(partial) {
    this.session = { ...this.session, ...partial };
    try {
      localStorage.setItem(APP_SESSION_KEY, JSON.stringify(this.session));
    } catch (_) {}
    this.emitChange();
  }

  isValidFirebaseUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();
    return clean.startsWith('https://') && (clean.includes('.firebaseio.com') || clean.includes('.firebasedatabase.app'));
  }

  getFirebaseConfig() {
    try {
      const raw = localStorage.getItem(APP_CLOUD_CFG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && this.isValidFirebaseUrl(parsed.databaseURL)) {
          parsed.databaseURL = parsed.databaseURL.trim().replace(/\/+$/, '').replace(/\/banca_fc_master\.json$/i, '');
          return parsed;
        }
      }
    } catch (_) {}
    return { ...APP_DEFAULT_FIREBASE };
  }

  get databaseURL() {
    return this.getFirebaseConfig().databaseURL;
  }

  getEndpoint(path = '/banca_fc_master.json') {
    const cfg = this.getFirebaseConfig();
    if (!cfg || !cfg.databaseURL) return null;
    return `${cfg.databaseURL.replace(/\/+$/, '')}${path}`;
  }

  async saveFirebaseUrl(input) {
    const raw = String(input || '').trim();
    const match =
      raw.match(/databaseURL\s*:\s*["']([^"']+)["']/i) ||
      raw.match(/(https:\/\/[a-z0-9-]+\.(?:firebaseio\.com|[\w.-]+\.firebasedatabase\.app))/i);
    const url = (match ? match[1] : raw).replace(/\/+$/, '').replace(/\/banca_fc_master\.json$/i, '');

    if (!this.isValidFirebaseUrl(url)) {
      return {
        ok: false,
        error: 'URL inválida. Debe iniciar con https:// y terminar en .firebaseio.com o .firebasedatabase.app'
      };
    }

    localStorage.setItem(APP_CLOUD_CFG_KEY, JSON.stringify({ ...APP_DEFAULT_FIREBASE, databaseURL: url }));
    const ok = await this.connect();
    return { ok, databaseURL: url, error: this.lastError };
  }

  init() {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const fbParam = params.get('fb') || params.get('firebase');
      if (this.isValidFirebaseUrl(fbParam)) {
        const cleanUrl = fbParam.trim().replace(/\/+$/, '');
        localStorage.setItem(APP_CLOUD_CFG_KEY, JSON.stringify({ ...APP_DEFAULT_FIREBASE, databaseURL: cleanUrl }));
      }
    }
    this.connect();
  }

  async connect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    const endpoint = this.getEndpoint();
    if (!endpoint) {
      this.status = 'UNCONFIGURED';
      this.emitChange();
      return false;
    }

    if (this.status !== 'CONNECTED') {
      this.status = 'CONNECTING';
      this.emitChange();
    }

    this.pollTimer = setInterval(() => {
      this.pullAndMerge(false);
    }, 2500);

    if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
      try {
        this.eventSource = new EventSource(endpoint);
        this.eventSource.addEventListener('put', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.data) {
              this.status = 'CONNECTED';
              this.lastSyncClock = this.formatTimeOnly12h();
              this.handleIncomingCloudData(payload.data, false);
            }
          } catch (_) {}
        });
        this.eventSource.onopen = () => {
          this.status = 'CONNECTED';
          this.emitChange();
        };
      } catch (_) {}
    }

    return await this.pullAndMerge(true);
  }

  async pullAndMerge(isInitial = false) {
    const endpoint = this.getEndpoint();
    if (!endpoint) return false;
    if (this.isPushing) return true;

    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.lastError = `Permiso denegado en Firebase (HTTP ${res.status}).`;
          this.status = 'ERROR';
          this.emitChange();
        }
        return false;
      }

      const cloudData = await res.json();
      this.status = 'CONNECTED';
      this.lastError = null;
      this.lastSyncClock = this.formatTimeOnly12h();

      if (!cloudData || (!cloudData.agencies && !cloudData.tickets)) {
        await this.pushMasterData(this.masterData, true);
        return true;
      }

      this.handleIncomingCloudData(cloudData, isInitial);
      return true;
    } catch (err) {
      this.lastError = err.message || 'Error de conexión con Firebase';
      if (this.status !== 'CONNECTED' && isInitial) {
        this.status = 'ERROR';
      }
      this.emitChange();
      return false;
    }
  }

  handleIncomingCloudData(cloudData, forceRefresh = false) {
    if (!cloudData) return;
    if (!forceRefresh && cloudData.updatedAt && cloudData.updatedAt === this.lastRemoteTimestamp) {
      this.emitChange();
      return;
    }

    const merged = this.mergeLocalAndCloud(this.masterData, cloudData);
    this.lastRemoteTimestamp = cloudData.updatedAt;
    this.masterData = merged;
    this.persistMasterCache();
    this.syncSessionCurrency();
    this.emitChange();
  }

  mergeLocalAndCloud(localDb, cloudDb) {
    if (cloudDb.lastResetTimestamp && (!localDb.lastResetTimestamp || cloudDb.lastResetTimestamp > localDb.lastResetTimestamp)) {
      const resetTs = cloudDb.lastResetTimestamp;
      const keyOf = (t) => `${t.serialSeguridad || t.ticketId}_${t.agencyCode || t.usuario || '1000'}`;
      const cloudKeys = new Set((cloudDb.tickets || []).map(keyOf));
      const freshLocal = (localDb.tickets || []).filter(t => !cloudKeys.has(keyOf(t)) && t.createdAt && t.createdAt > resetTs);
      return {
        ...localDb,
        ...cloudDb,
        tickets: [...freshLocal, ...(cloudDb.tickets || [])].sort((a, b) => Number(b.ticketId || 0) - Number(a.ticketId || 0)),
        agencies: cloudDb.agencies || localDb.agencies || [],
        collectors: cloudDb.collectors || localDb.collectors || [],
        results: cloudDb.results || {}
      };
    }

    const merged = { ...localDb, ...cloudDb };
    const cloudNewer = !localDb.updatedAt || (cloudDb.updatedAt && cloudDb.updatedAt >= localDb.updatedAt);

    if (cloudNewer && Array.isArray(cloudDb.agencies)) {
      merged.agencies = cloudDb.agencies;
    } else {
      const agMap = new Map();
      (localDb.agencies || []).forEach(a => agMap.set(String(a.code), a));
      (cloudDb.agencies || []).forEach(a => agMap.set(String(a.code), a));
      merged.agencies = Array.from(agMap.values());
    }

    if (cloudNewer && Array.isArray(cloudDb.collectors)) {
      merged.collectors = cloudDb.collectors;
    } else {
      merged.collectors = Array.from(new Set([...(localDb.collectors || []), ...(cloudDb.collectors || [])]));
    }

    const ticketMap = new Map();
    const getKey = (t) => `${t.serialSeguridad || t.ticketId}_${t.agencyCode || t.usuario || '1000'}`;
    (cloudDb.tickets || []).forEach(t => ticketMap.set(getKey(t), t));
    (localDb.tickets || []).forEach(t => {
      const key = getKey(t);
      const inCloud = ticketMap.get(key);
      if (!inCloud) {
        ticketMap.set(key, t);
      } else if (inCloud.updatedAt && t.updatedAt && inCloud.updatedAt !== t.updatedAt) {
        ticketMap.set(key, inCloud.updatedAt > t.updatedAt ? { ...t, ...inCloud } : { ...inCloud, ...t });
      } else {
        const rank = { ACTIVO: 1, GANADOR: 2, PAGADO: 3, ANULADO: 4 };
        const cRank = rank[inCloud.estado] || 1;
        const lRank = rank[t.estado] || 1;
        ticketMap.set(key, cRank >= lRank ? { ...t, ...inCloud } : { ...inCloud, ...t });
      }
    });

    merged.tickets = Array.from(ticketMap.values()).sort((a, b) => Number(b.ticketId || 0) - Number(a.ticketId || 0));

    const cloudResultsNewer =
      (cloudDb.resultsUpdatedAt && (!localDb.resultsUpdatedAt || cloudDb.resultsUpdatedAt >= localDb.resultsUpdatedAt)) ||
      (!localDb.resultsUpdatedAt && cloudNewer);

    if (cloudResultsNewer && cloudDb.results !== undefined) {
      merged.results = cloudDb.results || {};
      merged.resultsUpdatedAt = cloudDb.resultsUpdatedAt || cloudDb.updatedAt;
    } else if (localDb.resultsUpdatedAt && (!cloudDb.resultsUpdatedAt || localDb.resultsUpdatedAt > cloudDb.resultsUpdatedAt)) {
      merged.results = localDb.results || {};
      merged.resultsUpdatedAt = localDb.resultsUpdatedAt;
    } else {
      const mergedResults = { ...(localDb.results || {}) };
      for (const [dateKey, resObj] of Object.entries(cloudDb.results || {})) {
        mergedResults[dateKey] = { ...(mergedResults[dateKey] || {}), ...resObj };
      }
      merged.results = mergedResults;
    }

    const maxNext = Math.max(
      Number(localDb.config?.nextTicketNumber || 1),
      Number(cloudDb.config?.nextTicketNumber || 1)
    );
    merged.config = { ...(localDb.config || {}), ...(cloudDb.config || {}), nextTicketNumber: maxNext };
    return merged;
  }

  async pushMasterData(localData, forceOverwriteCloud = false) {
    const endpoint = this.getEndpoint();
    if (!endpoint) return false;

    this.isPushing = true;
    try {
      let dataToSave = { ...localData };
      if (forceOverwriteCloud) {
        dataToSave.lastResetTimestamp = new Date().toISOString();
      } else {
        try {
          const getRes = await fetch(endpoint, { cache: 'no-store' });
          if (getRes.ok) {
            const currentCloud = await getRes.json();
            if (currentCloud && Array.isArray(currentCloud.tickets)) {
              dataToSave = this.mergeLocalAndCloud(localData, currentCloud);
              dataToSave.agencies = localData.agencies;
              dataToSave.collectors = localData.collectors;
              dataToSave.results = localData.results;
              dataToSave.config = localData.config;
            }
          }
        } catch (_) {}
      }

      dataToSave.updatedAt = new Date().toISOString();
      this.lastRemoteTimestamp = dataToSave.updatedAt;

      const putRes = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (putRes.ok) {
        this.status = 'CONNECTED';
        this.lastError = null;
        this.lastSyncClock = this.formatTimeOnly12h();
        this.masterData = dataToSave;
        this.persistMasterCache();
        this.emitChange();
        return true;
      }
    } catch (err) {
      this.lastError = err.message || 'Error al subir a Firebase';
    } finally {
      this.isPushing = false;
    }
    return false;
  }

  getAgencies() {
    return Array.isArray(this.masterData.agencies) && this.masterData.agencies.length > 0
      ? this.masterData.agencies
      : appDefaultAgencies();
  }

  getAgencyByCode(code) {
    const clean = String(code || '').trim();
    return this.getAgencies().find(a => String(a.code) === clean) || null;
  }

  getAllowedCurrenciesForAgency(code) {
    const ag = this.getAgencyByCode(code);
    if (ag && Array.isArray(ag.allowedCurrencies) && ag.allowedCurrencies.length > 0) {
      const list = ag.allowedCurrencies.filter(c => ['COP', 'USD', 'VES'].includes(c));
      if (list.length > 0) return list;
    }
    if (ag && ['COP', 'USD', 'VES'].includes(ag.currency)) return [ag.currency];
    return ['COP'];
  }

  syncSessionCurrency() {
    if (!this.session.agencyCode) return;
    const allowed = this.getAllowedCurrenciesForAgency(this.session.agencyCode);
    if (!allowed.includes(this.session.currency)) {
      this.session.currency = allowed[0];
      localStorage.setItem(APP_SESSION_KEY, JSON.stringify(this.session));
    }
  }

  async authenticateAgency(codeInput, passInput) {
    await this.pullAndMerge(false);
    const code = String(codeInput || '').trim();
    const pass = String(passInput || '').trim();
    const ag = this.getAgencyByCode(code);

    if (!ag) {
      return { success: false, reason: `La Agencia "${code}" no existe en la nube.` };
    }
    if (ag.status === 'SUSPENDIDA') {
      return {
        success: false,
        reason: `La Agencia ${ag.code} (${ag.name}) está SUSPENDIDA por Administración Central.`
      };
    }
    if (ag.password && pass !== String(ag.password).trim()) {
      return { success: false, reason: 'Contraseña POS incorrecta para esta taquilla.' };
    }

    const allowed = this.getAllowedCurrenciesForAgency(ag.code);
    const currency = allowed.includes(this.session.currency) && this.session.agencyCode === ag.code
      ? this.session.currency
      : allowed[0];

    this.saveSession({ agencyCode: ag.code, currency });
    return { success: true, agency: ag };
  }

  logout() {
    this.saveSession({ agencyCode: null });
  }

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

  getTickets(onlyAgencyCode = null) {
    const list = Array.isArray(this.masterData.tickets) ? this.masterData.tickets : [];
    if (!onlyAgencyCode) return list;
    return list.filter(t => this.extractAgencyCodeFromTicket(t) === String(onlyAgencyCode));
  }

  getTicketByIdOrSerial(query) {
    const clean = String(query || '').trim().replace('#', '');
    if (!clean) return null;
    const padded = clean.padStart(8, '0');
    const upper = clean.toUpperCase();
    return this.getTickets().find(t =>
      t.ticketId === padded ||
      t.ticketId === clean ||
      String(t.ticketId || '').endsWith(clean) ||
      String(t.serialSeguridad || '').toUpperCase() === upper
    ) || null;
  }

  getLastPrintedTicket() {
    try {
      const raw = localStorage.getItem(APP_LAST_TICKET_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const list = this.getTickets(this.session.agencyCode);
    return list[0] || null;
  }

  getEffectiveMultipliersForAgency(agencyCode) {
    const globalMult = { ...APP_DEFAULT_MULTIPLIERS, ...(this.masterData.config?.multipliers || {}) };
    const ag = this.getAgencyByCode(agencyCode);
    if (ag && ag.multipliers && typeof ag.multipliers === 'object') {
      return { ...globalMult, ...ag.multipliers };
    }
    return globalMult;
  }

  getEffectiveCommissionForAgency(agencyCode) {
    const ag = this.getAgencyByCode(agencyCode);
    if (ag && ag.commissionPct !== undefined && ag.commissionPct !== null) {
      return Number(ag.commissionPct);
    }
    return Number(this.masterData.config?.agencyCommissionPct ?? 15);
  }

  generateSecuritySerial() {
    const p = () => Math.floor(1000 + Math.random() * 9000);
    return `${p()}-${p()}-${p()}`;
  }

  extractTicketDateIso(ticket) {
    if (ticket && ticket.dateIso) return ticket.dateIso;
    const raw = String((ticket && ticket.fechaHora) || '').trim();
    const slash = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return this.getTodayIso();
  }

  checkPlayWinning(play, officialResult, multipliers) {
    if (!officialResult || !officialResult.number) return null;
    const playNum = String(play.number).trim();
    const winNum = String(officialResult.number).trim();

    if (play.type === 'animalito') {
      const isDzP = playNum === '00';
      const isDzW = winNum === '00';
      const matched = (isDzP || isDzW) ? (isDzP && isDzW) : (parseInt(playNum, 10) === parseInt(winNum, 10));
      if (matched) {
        const mult = Number(multipliers.animalito || 30);
        return { won: true, type: 'ANIMALITO GANADOR', multiplier: mult, prize: play.amount * mult };
      }
      return null;
    }

    if (play.type === 'zodiac' || play.type === 'astro') {
      const playSign = (play.sign || '').toUpperCase();
      const winSign = (officialResult.sign || '').toUpperCase();
      const signMatches = !winSign || playSign === 'TODOS' || playSign === winSign;

      if (playNum.length === 4 && winNum.length >= 4 && playNum === winNum.slice(-4) && signMatches) {
        const mult = Number(multipliers.astro4 || 40000);
        return { won: true, type: 'ASTRO 4 CIFRAS + SIGNO', multiplier: mult, prize: play.amount * mult };
      }
      if (playNum.slice(-3) === winNum.slice(-3) && signMatches) {
        const mult = play.type === 'astro' ? Number(multipliers.astro3 || 1000) : Number(multipliers.triple || 500);
        return { won: true, type: 'TRIPLE ZODIACAL + SIGNO', multiplier: mult, prize: play.amount * mult };
      }
      return null;
    }

    if (play.type === 'cuatro_cifras') {
      if (play.is5ta && officialResult.ball5) {
        if (playNum === winNum + officialResult.ball5 || playNum === winNum) {
          const mult = Number(multipliers.la5ta || 25000);
          return { won: true, type: 'CHANCE LA 5TA BALOTA', multiplier: mult, prize: play.amount * mult };
        }
      }
      if (playNum.length === 4 && winNum.length >= 4 && playNum === winNum.slice(-4)) {
        const mult = Number(multipliers.cuatroCifrasDirecto || 4500);
        return { won: true, type: 'CHANCE 4 CIFRAS DIRECTO', multiplier: mult, prize: play.amount * mult };
      }
      if (play.isCombinado && playNum.length === 4 && winNum.length >= 4) {
        const s1 = playNum.split('').sort().join('');
        const s2 = winNum.slice(-4).split('').sort().join('');
        if (s1 === s2) {
          const mult = Number(multipliers.cuatroCifrasCombinado || 208);
          return { won: true, type: 'CHANCE 4 CIFRAS COMBINADO', multiplier: mult, prize: play.amount * mult };
        }
      }
      return null;
    }

    if (playNum.length >= 3 && winNum.length >= 3 && playNum.slice(-3) === winNum.slice(-3)) {
      const mult = Number(multipliers.triple || 500);
      return { won: true, type: 'TRIPLE DIRECTO', multiplier: mult, prize: play.amount * mult };
    }

    if (playNum.length === 2 && winNum.length >= 2) {
      const pTerm = playNum.slice(-2);
      const wTerm = winNum.slice(-2);
      if (pTerm === wTerm) {
        const mult = Number(multipliers.terminal || 60);
        return { won: true, type: 'TERMINAL DERECHO', multiplier: mult, prize: play.amount * mult };
      }
      const pv = parseInt(pTerm, 10);
      const wv = parseInt(wTerm, 10);
      if (!isNaN(pv) && !isNaN(wv) && (pv === (wv + 1) % 100 || pv === (wv - 1 + 100) % 100)) {
        const mult = Number(multipliers.aproximacion || 5);
        return { won: true, type: 'APROXIMACIÓN TERMINAL', multiplier: mult, prize: play.amount * mult };
      }
    }

    return null;
  }

  evaluateTicket(ticket, targetDate = null) {
    if (ticket.estado === 'ANULADO') {
      return { status: 'ANULADO', totalPrize: 0, winningPlays: [] };
    }
    const agCode = this.extractAgencyCodeFromTicket(ticket);
    const mults = this.getEffectiveMultipliersForAgency(agCode);
    const dateKey = targetDate || this.extractTicketDateIso(ticket);
    const dayResults = (this.masterData.results && this.masterData.results[dateKey]) || {};

    let totalPrize = 0;
    const winningPlays = [];
    (ticket.items || []).forEach(play => {
      const offRes = dayResults[play.lotteryId];
      if (offRes) {
        const win = this.checkPlayWinning(play, offRes, mults);
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
      status: (ticket.estado === 'PAGADO' && isWinner) ? 'PAGADO' : (isWinner ? 'GANADOR' : 'ACTIVO'),
      totalPrize,
      winningPlays
    };
  }

  async emitTicket(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: 'No hay jugadas en el pre-ticket.' };
    }
    const agencyCode = this.session.agencyCode || '1000';
    const agency = this.getAgencyByCode(agencyCode);
    if (agency && agency.status === 'SUSPENDIDA') {
      return { ok: false, error: `Agencia ${agencyCode} SUSPENDIDA por Administración Central.` };
    }

    const currency = this.session.currency || agency?.currency || 'COP';
    const maxLimit = Number(agency?.maxBetLimit || 0);
    if (maxLimit > 0) {
      const activeTickets = this.getTickets(agencyCode).filter(t => t.estado !== 'ANULADO');
      for (const play of items) {
        let accum = 0;
        activeTickets.forEach(t => {
          (t.items || []).forEach(it => {
            if (it.lotteryId === play.lotteryId && String(it.number) === String(play.number)) {
              accum += Number(it.amount) || 0;
            }
          });
        });
        if (accum + Number(play.amount) > maxLimit) {
          const disp = Math.max(0, maxLimit - accum);
          return {
            ok: false,
            error: `TOPE EXCEDIDO en ${play.lotteryName} (${play.number}). Tope: ${this.formatCurrency(maxLimit, currency)} | Disponible: ${this.formatCurrency(disp, currency)}`
          };
        }
      }
    }

    const nextNum = Number(this.masterData.config?.nextTicketNumber || 10926);
    const ticketId = String(nextNum).padStart(8, '0');
    const serial = this.generateSecuritySerial();
    const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);

    const ticket = {
      ticketId,
      serialSeguridad: serial,
      fechaHora: this.formatDateTime12h(new Date()),
      agencyCode: String(agencyCode),
      agencia: `${agencyCode} - ${agency?.name || 'FERNANDO CASTAÑO'}`,
      usuario: String(agencyCode),
      moneda: currency,
      items: items.map(it => ({ ...it })),
      total,
      estado: 'ACTIVO',
      premioCalculado: 0,
      origenApp: 'APP-MOVIL-TOUCH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const evalRes = this.evaluateTicket(ticket);
    if (evalRes.totalPrize > 0) {
      ticket.estado = 'GANADOR';
      ticket.premioCalculado = evalRes.totalPrize;
      ticket.winningPlays = evalRes.winningPlays;
    }

    if (!this.masterData.config) this.masterData.config = {};
    this.masterData.config.nextTicketNumber = nextNum + 1;
    if (!Array.isArray(this.masterData.tickets)) this.masterData.tickets = [];
    this.masterData.tickets.unshift(ticket);

    localStorage.setItem(APP_LAST_TICKET_KEY, JSON.stringify(ticket));
    this.persistMasterCache();
    this.emitChange();
    await this.pushMasterData(this.masterData);
    return { ok: true, ticket };
  }

  async cancelTicket(ticketId) {
    const cleanId = String(ticketId).trim().replace('#', '').padStart(8, '0');
    const idx = (this.masterData.tickets || []).findIndex(t => t.ticketId === cleanId || t.ticketId === ticketId);
    if (idx === -1) return false;
    this.masterData.tickets[idx].estado = 'ANULADO';
    this.masterData.tickets[idx].fechaAnulacion = this.formatDateTime12h(new Date());
    this.masterData.tickets[idx].updatedAt = new Date().toISOString();
    this.persistMasterCache();
    this.emitChange();
    await this.pushMasterData(this.masterData);
    return true;
  }

  async payTicket(ticketId, prize) {
    const cleanId = String(ticketId).trim().replace('#', '').padStart(8, '0');
    const idx = (this.masterData.tickets || []).findIndex(t => t.ticketId === cleanId || t.ticketId === ticketId);
    if (idx === -1) return false;
    this.masterData.tickets[idx].estado = 'PAGADO';
    this.masterData.tickets[idx].premioPagado = Number(prize);
    this.masterData.tickets[idx].fechaPago = this.formatDateTime12h(new Date());
    this.masterData.tickets[idx].updatedAt = new Date().toISOString();
    this.persistMasterCache();
    this.emitChange();
    await this.pushMasterData(this.masterData);
    return true;
  }

  calculateCurrencyBoxMetrics(tickets, currencyCode) {
    const target = String(currencyCode || 'COP').toUpperCase();
    const list = (tickets || []).filter(t => String(t.moneda || 'COP').toUpperCase() === target);
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

    list.forEach(t => {
      const total = Number(t.total) || 0;
      const agCode = this.extractAgencyCodeFromTicket(t);
      const commPct = this.getEffectiveCommissionForAgency(agCode);
      gross += total;
      if (t.estado === 'ANULADO') {
        voidCount++;
        voided += total;
      } else {
        activeCount++;
        net += total;
        commission += (total * commPct) / 100;
        const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
        if (t.estado === 'PAGADO') {
          paidCount++;
          paidPrizes += prizeVal;
        } else if (t.estado === 'GANADOR' || prizeVal > 0) {
          winnerPendingCount++;
          pendingPrizes += prizeVal;
        }
        (t.items || []).forEach(p => {
          const amt = Number(p.amount) || 0;
          if (p.type === 'animalito') {
            categoryBreakdown.animalitos.amount += amt;
            categoryBreakdown.animalitos.count++;
          } else if (p.type === 'zodiac' || p.type === 'astro') {
            categoryBreakdown.con_signo.amount += amt;
            categoryBreakdown.con_signo.count++;
          } else if (p.type === 'cuatro_cifras') {
            categoryBreakdown.cuatro_cifras.amount += amt;
            categoryBreakdown.cuatro_cifras.count++;
          } else {
            categoryBreakdown.sin_signo.amount += amt;
            categoryBreakdown.sin_signo.count++;
          }
        });
      }
    });

    const totalPrizes = paidPrizes + pendingPrizes;
    const bancaUtility = net - commission - totalPrizes;
    const effPct = net > 0
      ? Number(((commission / net) * 100).toFixed(1))
      : this.getEffectiveCommissionForAgency(this.session.agencyCode || '1000');

    return {
      currency: target,
      activeCount,
      voidCount,
      paidCount,
      winnerPendingCount,
      gross,
      voided,
      net,
      commissionPct: effPct,
      commission,
      paidPrizes,
      pendingPrizes,
      totalPrizes,
      bancaUtility,
      categoryBreakdown
    };
  }

  formatCurrency(amount, currencyCode) {
    const cur = (currencyCode || this.session.currency || 'COP').toUpperCase();
    const val = Number(amount) || 0;
    if (cur === 'COP') {
      return `$ ${Math.round(val).toLocaleString('es-CO')}`;
    } else if (cur === 'VES') {
      return `Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `USD $${val.toFixed(2)}`;
  }

  generatePlainTextReceipt(ticket) {
    const cur = ticket.moneda || this.session.currency || 'COP';
    const grouped = {};
    (ticket.items || []).forEach(it => {
      const k = it.lotteryName || it.lotteryId;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(it);
    });
    let text = `🎟️ *BANCA FC - FERNANDO CASTAÑO*\n`;
    text += `📍 *AGENCIA:* ${ticket.agencia}\n`;
    text += `🕒 *FECHA:* ${ticket.fechaHora}\n`;
    text += `🔢 *TICKET:* #${ticket.ticketId}\n`;
    text += `🔐 *SERIAL:* ${ticket.serialSeguridad}\n`;
    text += `--------------------------------\n`;
    for (const [lotName, plays] of Object.entries(grouped)) {
      text += `*▶ ${lotName.toUpperCase()}*\n`;
      plays.forEach(p => {
        let nro = p.number;
        if (p.sign) nro += `-${p.sign}`;
        if (p.animalName) nro += ` (${p.animalName})`;
        if (p.is5ta) nro += ` [5ta]`;
        if (p.isCombinado) nro += ` [Comb]`;
        text += `  • ${nro} -> ${this.formatCurrency(p.amount, cur)}\n`;
      });
    }
    text += `--------------------------------\n`;
    text += `💰 *TOTAL: ${this.formatCurrency(ticket.total, cur)}*\n`;
    text += `ℹ️ *Caduca a los 3 días. Conserve su comprobante.*`;
    return text;
  }
}

window.appCloud = new AppCloudSync();
