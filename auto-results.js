// js/auto-results.js - Motor Maestro-Esclavo de Resultados Oficiales y Liquidación Centralizada
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"
// Arquitectura Fuente Única de Verdad (Master-Slave):
//  - MODO MAESTRO (Exclusivo Panel Administrativo `admin.html`):
//      1) Extracción Automática Centralizada desde páginas oficiales verificadas
//         (loteriadehoy.com / lotoven.com / loteriasdehoy.co) con `origen: "AUTO-WEB"`.
//      2) Carga y Corrección Manual de Respaldo con `origen: "MANUAL-ADMIN"` y `bloqueadoPorAdmin: true`.
//      3) Prohibido usar números simulados (Mock/Seed): si un sorteo aún no está publicado, NO se agrega.
//      4) Publica en `/banca_fc_resultados_oficiales/{YYYY-MM-DD}` y `/banca_fc_master` para todas las taquillas.
//  - MODO ESCLAVO / PASIVO (Taquillas POS `index.html` y App Móvil):
//      1) CERO scraping externo y CERO generación aleatoria/semilla.
//      2) Escucha únicamente en tiempo real (`EventSource` Firebase + `storage` localStorage) los resultados
//         y liquidaciones publicados por el Programa Administrativo Central.

(function () {
  const ADMIN_AUTOSYNC_STORAGE_KEY = 'banca_fc_admin_autosync_3m';

  const MONTH_MAP = {
    enero: 1, january: 1, ene: 1, jan: 1,
    febrero: 2, february: 2, feb: 2,
    marzo: 3, march: 3, mar: 3,
    abril: 4, april: 4, abr: 4, apr: 4,
    mayo: 5, may: 5,
    junio: 6, june: 6, jun: 6,
    julio: 7, july: 7, jul: 7,
    agosto: 8, august: 8, ago: 8, aug: 8,
    septiembre: 9, setiembre: 9, september: 9, sep: 9, sept: 9,
    octubre: 10, october: 10, oct: 10,
    noviembre: 11, november: 11, nov: 11,
    diciembre: 12, december: 12, dic: 12, dec: 12
  };

  const ZODIAC_ALIASES = {
    ari: 'ARI', aries: 'ARI',
    tau: 'TAU', tauro: 'TAU',
    gem: 'GEM', geminis: 'GEM',
    can: 'CAN', cancer: 'CAN',
    leo: 'LEO',
    vir: 'VIR', virgo: 'VIR',
    lib: 'LIB', libra: 'LIB',
    esc: 'ESC', escorpio: 'ESC', escorpion: 'ESC',
    sag: 'SAG', sagitario: 'SAG',
    cap: 'CAP', capricornio: 'CAP',
    acu: 'ACU', acuario: 'ACU',
    pis: 'PIS', piscis: 'PIS'
  };

  function stripAccents(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseTime12ToCode(timeStr) {
    const m = String(timeStr || '').trim().match(/(\d{1,2}):(\d{2})\s*([AP])\.?\s*M\.?/i);
    if (!m) return null;
    let hr = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'P' && hr < 12) hr += 12;
    if (ap === 'A' && hr === 12) hr = 0;
    return `${String(hr).padStart(2, '0')}${String(min).padStart(2, '0')}`;
  }

  function parseSpanishDateToIso(str) {
    const clean = stripAccents(str);
    if (!clean) return null;
    // Soporta "18 de noviembre de 2026" y "18 noviembre 2026"
    const m = clean.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})\b/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = MONTH_MAP[m[2]];
    const year = parseInt(m[3], 10);
    if (!month || day < 1 || day > 31 || year < 2020) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function normalizeZodiacSign(raw) {
    const clean = stripAccents(raw).replace(/[^a-z]/g, '');
    if (!clean) return null;
    return ZODIAC_ALIASES[clean] || (clean.length >= 3 ? ZODIAC_ALIASES[clean.slice(0, 3)] || null : null);
  }

  function getTodayIsoLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getDrawMinutesFromLot(lot) {
    if (typeof lot.drawHour24 === 'number') {
      return lot.drawHour24 * 60 + (lot.drawMinute || 0);
    }
    if (lot.closeTime) {
      const [hStr, mStr] = String(lot.closeTime).split(':');
      return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    }
    return 12 * 60;
  }

  function format12hFromLot(lot) {
    if (lot.time12) return lot.time12;
    if (lot.time) return lot.time;
    const totalMinutes = getDrawMinutesFromLot(lot);
    const h24 = Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
  }

  function resolveAnimalPrefixFromTitle(titleText) {
    const t = stripAccents(titleText);
    if (!t) return null;
    if (t.includes('centena')) return null;
    if (t.includes('lotto activo 2') || t.includes('monje millonario')) return 'MONJE_MILLONARIO';
    if (t.includes('lotto activo int') || t.includes('lotto internacional') || t.includes('lotto activo rd') || t.includes('rdominicana')) return 'LOTTO_ACTIVO_RD';
    if (t.includes('lotto activo')) return 'LOTTO_ACTIVO';
    if (t.includes('la granjita')) return 'LA_GRANJITA';
    if (t.includes('guacharito')) return 'GUACHARITO_MILL';
    if (t.includes('guacharo activo')) return 'GUACHARO_ACTIVO';
    if (t.includes('selva plus')) return 'SELVA_PLUS';
    if (t.includes('mega animal')) return 'MEGA_ANIMAL_40';
    if (t.includes('chance con animalitos b')) return 'CHANCE_ANIMALITOS_B';
    if (t.includes('chance con animalitos')) return 'CHANCE_ANIMALITOS';
    if (t.includes('granja millonaria') || t.includes('granja millionaria')) return 'GRANJA_MILLONARIA';
    if (t.includes('ricachona')) return 'LA_RICACHONA_ANM';
    if (t.includes('loto chaima')) return 'LOTO_CHAIMA';
    if (t.includes('condor gana')) return 'CONDOR_GANA';
    if (t.includes('gatazo')) return 'GATAZO';
    if (t.includes('granjazo')) return 'GRANJAZO';
    if (t.includes('fruta gana')) return 'FRUTA_GANA';
    if (t.includes('ruleta royal')) return 'RULETA_ROYAL';
    if (t.includes('lotto gato')) return 'LOTTO_GATO';
    if (t.includes('tropi gana')) return 'TROPI_GANA';
    return null;
  }

  function resolveVenLottoConfigFromTitle(titleText) {
    const t = stripAccents(titleText);
    if (!t || t.includes('centena') || t.includes('la ruca') || t.includes('terminal')) return null;
    if (t.includes('trio activo')) return { single: 'TRIO_ACTIVO' };
    if (t.includes('triple dorado')) return { single: 'TRIPLE_DORADO' };
    if (t.includes('triple facil')) return { single: 'TRIPLE_FACIL' };
    if (t.includes('ricachona')) return { single: 'LA_RICACHONA' };
    if (t.includes('triple popular')) return { single: 'TRIPLE_POPULAR' };
    if (t.includes('triple fortuna')) return { single: 'TRIPLE_FORTUNA' };
    if (t.includes('napa gana')) return { single: 'NAPA_GANA' };
    if (t.includes('triple chance')) return { a: 'CHANCE_A', b: 'CHANCE_B', z: 'CHANCE_ASTRAL' };
    if (t.includes('triple zulia')) return { a: 'ZULIA_A', b: 'ZULIA_B', z: 'ZODIACO_ZULIA' };
    if (t.includes('triple tachira')) return { a: 'TACHIRA_A', b: 'TACHIRA_B', z: 'TACHIRA_ZODIACAL' };
    if (t.includes('triple caracas')) return { a: 'CARACAS_A', b: 'CARACAS_B', z: 'TRIPLETAZO' };
    if (t.includes('triple caliente')) return { a: 'CALIENTE_A', b: 'CALIENTE_B', z: 'SIGNO_CALIENTE' };
    if (t.includes('triple zamorano')) return { a: 'TRIPLE_ZAMORANO', z: 'ASTRO_ZAMORANO' };
    if (t.includes('triple lago')) return { a: 'TRIPLE_LAGO_A', b: 'TRIPLE_LAGO_B', z: 'LAGO_ZODIACAL' };
    if (t.includes('triple gato')) return { a: 'TRIPLE_GATO_A', b: 'TRIPLE_GATO_B', z: 'TRIPLE_GATO_ZOD' };
    if (t.includes('arrejuntao')) return { a: 'ARREJUNTAO_A', b: 'ARREJUNTAO_B', z: 'ARREJUNTAO_SIGNO' };
    return null;
  }

  function resolveColombiaLotteryIdFromTitle(titleText, dateKey) {
    const t = stripAccents(titleText);
    if (!t) return null;
    const isSunday = new Date(`${dateKey}T12:00:00`).getDay() === 0;

    if (t.includes('extra')) return null;
    if (t.includes('cundinamarca')) return 'CUNDINAMARCA';
    if (t.includes('tolima')) return 'TOLIMA';
    if (t.includes('cruz roja')) return 'CRUZ_ROJA';
    if (t.includes('huila')) return 'HUILA';
    if (t.includes('manizales')) return 'MANIZALES';
    if (t.includes('meta')) return 'META';
    if (t.includes('valle')) return 'VALLE';
    if (t.includes('bogota')) return 'BOGOTA';
    if (t.includes('quindio')) return 'QUINDIO';
    if (t.includes('medellin')) return 'MEDELLIN';
    if (t.includes('santander')) return 'SANTANDER';
    if (t.includes('risaralda')) return 'RISARALDA';
    if (t.includes('boyaca')) return 'BOYACA';
    if (t.includes('cauca')) return 'CAUCA';

    if (t.includes('astro sol')) return 'ASTRO_SOL_1430';
    if (t.includes('astro luna')) return 'ASTRO_LUNA_2230';

    if (t.includes('dorado manana')) return 'DORADO_MANANA';
    if (t.includes('dorado tarde')) return 'DORADO_TARDE';
    if (t.includes('dorado noche')) return 'DORADO_NOCHE';

    if (t.includes('sinuano dia')) return isSunday ? 'SINUANO_DIA_DOM' : 'SINUANO_DIA_LV';
    if (t.includes('sinuano noche')) return isSunday ? 'SINUANO_NOCHE_DOM' : 'SINUANO_NOCHE_LV';

    if (t.includes('antioquenita dia') || t.includes('antioquenita 1')) return 'ANTIOQUENITA_DIA';
    if (t.includes('antioquenita tarde') || t.includes('antioquenita 2')) return 'ANTIOQUENITA_TARDE';

    if (t.includes('cafeterito tarde')) return 'CAFETERITO_TARDE';
    if (t.includes('cafeterito noche')) return 'CAFETERITO_NOCHE';

    if (t.includes('paisita 3')) return 'PAISITA_3';
    if (t.includes('paisita dia') || t.includes('paisita 1')) return 'PAISITA_DIA';
    if (t.includes('paisita noche') || t.includes('paisita 2')) return 'PAISITA_NOCHE';

    if (t.includes('chontico dia')) return 'CHONTICO_DIA';
    if (t.includes('chontico noche') && !t.includes('jueves')) return 'CHONTICO_NOCHE';

    if (t === 'saman' || t.includes('saman')) return 'SAMAN_DIA';
    if (t.includes('fantastica dia')) return 'FANTASTICA_DIA';
    if (t.includes('fantastica noche')) return 'FANTASTICA_NOCHE';

    if (t.includes('cash three dia') || t.includes('cash 3 dia') || t.includes('pick 3 dia')) return 'CASH_THREE_DIA';
    if (t.includes('cash three noche') || t.includes('cash 3 noche') || t.includes('pick 3 noche')) return 'CASH_THREE_NOCHE';
    if (t.includes('play four dia') || t.includes('play 4 dia') || t.includes('pick 4 dia')) return 'PLAY_FOUR_DIA';
    if (t.includes('play four noche') || t.includes('play 4 noche') || t.includes('pick 4 noche')) return 'PLAY_FOUR_NOCHE';

    if (t.includes('pijao')) return 'PIJAO_ORO';
    if (t.includes('caribena dia')) return 'CARIBENA_DIA';
    if (t.includes('caribena noche')) return 'CARIBENA_NOCHE';
    if (t.includes('culona dia')) return 'CULONA_DIA';
    if (t.includes('culona noche')) return 'CULONA_NOCHE';
    if (t.includes('motilon tarde')) return 'MOTILON_TARDE';
    if (t.includes('motilon noche')) return 'MOTILON_NOCHE';

    return null;
  }

  class AutoResultsSyncService {
    constructor() {
      this.syncIntervalId = null;
      this.passiveEventSource = null;
      this.isSyncing = false;
      this.lastSyncTime = null;
      this.lastSyncSource = 'CENTRAL ADMIN';
      this.lastWebExtractedCount = 0;
      this.lastSyncWarning = null;
      this.lastSourceStatus = {};
    }

    // Determina si estamos ejecutando dentro del Panel Administrativo Maestro (`admin.html`)
    isMasterAdminContext() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return false;
      if (window.BANCA_FC_ROLE === 'ADMIN') return true;
      return Boolean(document.getElementById('form-admin-load-result') || document.getElementById('tab-resultados'));
    }

    isAdminAutoSyncEnabled() {
      try {
        const val = localStorage.getItem(ADMIN_AUTOSYNC_STORAGE_KEY);
        if (val === null) return true; // Por defecto activo en el Administrador
        return val === 'true';
      } catch (e) {
        return true;
      }
    }

    setAdminAutoSyncEnabled(enabled) {
      try {
        localStorage.setItem(ADMIN_AUTOSYNC_STORAGE_KEY, enabled ? 'true' : 'false');
      } catch (e) {}
      this.configureAdminAutoSyncTimer();
    }

    init() {
      if (this.isMasterAdminContext()) {
        // MODO MAESTRO (Administrador): Configurar ciclo de extracción web cada 3 minutos si el interruptor está activo
        this.configureAdminAutoSyncTimer();
        setTimeout(() => {
          if (this.isAdminAutoSyncEnabled()) {
            this.syncFromOfficialWeb(getTodayIsoLocal(), { silent: true });
          } else {
            this.pullPassiveResultsFromCentral(getTodayIsoLocal());
          }
        }, 900);
      } else {
        // MODO ESCLAVO / PASIVO (Taquilla POS): Cero scraping externo; solo escuchar Base de Datos Central
        this.initPassivePosListeners();
        setTimeout(() => {
          this.pullPassiveResultsFromCentral(getTodayIsoLocal());
        }, 600);
      }
    }

    configureAdminAutoSyncTimer() {
      if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = null;
      }
      if (this.isMasterAdminContext() && this.isAdminAutoSyncEnabled()) {
        this.syncIntervalId = setInterval(() => {
          const dateInput = document.getElementById('res-admin-date');
          const targetDate = (dateInput && dateInput.value) ? dateInput.value : getTodayIsoLocal();
          this.syncFromOfficialWeb(targetDate, { silent: true });
        }, 180000); // Cada 3 minutos (180,000 ms)
      }
    }

    // Configura la escucha pasiva en tiempo real para las Taquillas POS (Firebase SSE + localStorage)
    initPassivePosListeners() {
      window.addEventListener('storage', (e) => {
        if (!e.key || e.key === 'banca_fc_data' || e.key === 'banca_fc_results') {
          this.lastSyncTime = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
          window.dispatchEvent(new CustomEvent('banca_fc_official_results_synced', {
            detail: { dateKey: getTodayIsoLocal(), timestamp: this.lastSyncTime }
          }));
        }
      });

      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (fbUrl && typeof window.EventSource !== 'undefined') {
          const cleanBase = fbUrl.replace(/\/+$/, '');
          const todayKey = getTodayIsoLocal();
          if (this.passiveEventSource) {
            this.passiveEventSource.close();
          }
          this.passiveEventSource = new EventSource(`${cleanBase}/banca_fc_resultados_oficiales/${todayKey}.json`);
          this.passiveEventSource.addEventListener('put', (ev) => {
            try {
              const payload = JSON.parse(ev.data);
              if (payload && payload.data !== undefined) {
                this.applyOfficialNodeToLocalStorage(todayKey, payload.data || {});
              }
            } catch (err) {}
          });
        }
      } catch (e) {}

      if (this.syncIntervalId) clearInterval(this.syncIntervalId);
      this.syncIntervalId = setInterval(() => {
        const posDateEl = document.getElementById('input-resultados-fecha');
        const targetDate = (posDateEl && posDateEl.value) ? posDateEl.value : getTodayIsoLocal();
        this.pullPassiveResultsFromCentral(targetDate);
      }, 30000);
    }

    applyOfficialNodeToLocalStorage(dateKey, centralResultsMap) {
      if (typeof storage === 'undefined') return;
      const master = storage.getMasterData();
      if (!master) return;
      if (!master.results) master.results = {};

      const currentStr = JSON.stringify(master.results[dateKey] || {});
      const incomingStr = JSON.stringify(centralResultsMap || {});

      if (currentStr !== incomingStr) {
        master.results[dateKey] = centralResultsMap || {};
        localStorage.setItem('banca_fc_data', JSON.stringify(master));
        storage.syncLegacyKeysFromMaster(master);
        storage.recalculateAllTicketWinnings(dateKey);
      }

      this.lastSyncTime = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      window.dispatchEvent(new CustomEvent('banca_fc_official_results_synced', {
        detail: { dateKey, timestamp: this.lastSyncTime }
      }));
    }

    hasLotteryDrawPassed(lotteryObj, dateKey) {
      if (!lotteryObj) return false;
      const todayKey = getTodayIsoLocal();
      if (dateKey > todayKey) return false;

      const targetDayOfWeek = new Date(`${dateKey}T12:00:00`).getDay();
      const allowedDays = lotteryObj.daysOfWeek || lotteryObj.days;
      if (Array.isArray(allowedDays) && !allowedDays.includes(targetDayOfWeek)) {
        return false;
      }

      if (dateKey < todayKey) return true;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const drawMinutes = getDrawMinutesFromLot(lotteryObj);

      return currentMinutes >= drawMinutes;
    }

    getAllCatalogLotteriesWithCategory() {
      const catSource = typeof LOTTERY_CATALOGS !== 'undefined'
        ? LOTTERY_CATALOGS
        : (typeof globalThis !== 'undefined' ? globalThis.LOTTERY_CATALOGS : null);
      if (!catSource) return [];
      return [
        ...(catSource.sin_signo || []).map(l => ({ ...l, categoryKey: 'sin_signo', categoryLabel: 'SIN SIGNO' })),
        ...(catSource.con_signo || []).map(l => ({ ...l, categoryKey: 'con_signo', categoryLabel: 'CON SIGNO' })),
        ...(catSource.cuatro_cifras || []).map(l => ({ ...l, categoryKey: 'cuatro_cifras', categoryLabel: '4 CIFRAS' })),
        ...(catSource.animalitos || []).map(l => ({ ...l, categoryKey: 'animalitos', categoryLabel: 'ANIMALITOS' }))
      ];
    }

    getLotteryMetaMap() {
      const all = this.getAllCatalogLotteriesWithCategory();
      const map = {};
      all.forEach(l => {
        map[l.id] = l;
      });
      return map;
    }

    isLocalServerProxyAvailable() {
      if (typeof window === 'undefined' || !window.location) return false;
      const proto = window.location.protocol || '';
      const host = (window.location.hostname || '').toLowerCase();
      if (proto !== 'http:' && proto !== 'https:') return false;
      if (host.includes('github.io') || host.includes('netlify.app') || host.includes('vercel.app') || host.includes('web.app')) {
        return false;
      }
      return true;
    }

    // Descarga fuente oficial usando primero /api/proxy (en servidor local) y luego r.jina.ai (funciona en GitHub Pages y navegador)
    async fetchOfficialSource(targetUrl, timeoutMs = 10000) {
      if (!this.isMasterAdminContext()) return null;

      const attempts = [];
      if (this.isLocalServerProxyAvailable()) {
        attempts.push({
          format: 'html',
          via: 'local-proxy',
          fetchUrl: `/api/proxy?url=${encodeURIComponent(targetUrl)}`,
          headers: { Accept: 'text/html,text/plain,*/*' }
        });
      }
      attempts.push({
        format: 'markdown',
        via: 'r.jina.ai',
        fetchUrl: `https://r.jina.ai/${targetUrl}`,
        headers: { Accept: 'text/plain,text/markdown,*/*' }
      });

      let lastErr = 'Sin respuesta';
      for (const att of attempts) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const resp = await fetch(att.fetchUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
            headers: att.headers
          });
          clearTimeout(timer);
          if (resp.ok) {
            const text = await resp.text();
            if (text && text.length > 250 && !/Warning:\s*Target URL returned error\s*(4\d\d|5\d\d)/i.test(text)) {
              return { format: att.format, text, via: att.via };
            }
            lastErr = `Contenido vacío o error origen (${att.via})`;
          } else {
            lastErr = `HTTP ${resp.status} (${att.via})`;
          }
        } catch (err) {
          lastErr = `${err.name === 'AbortError' ? 'Timeout' : err.message} (${att.via})`;
        }
      }

      this.lastSourceStatus[targetUrl] = lastErr;
      return null;
    }

    async fetchFromFirebaseOfficialNode(dateKey) {
      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (!fbUrl) return null;

        const cleanBase = fbUrl.replace(/\/+$/, '');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(`${cleanBase}/banca_fc_resultados_oficiales/${dateKey}.json`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            return data;
          }
          return {};
        }
      } catch (e) {}
      return null;
    }

    async pushToFirebaseOfficialNode(dateKey, resultsForDate) {
      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (!fbUrl) return false;

        const cleanBase = fbUrl.replace(/\/+$/, '');
        const payload = resultsForDate && Object.keys(resultsForDate).length > 0 ? resultsForDate : null;
        await fetch(`${cleanBase}/banca_fc_resultados_oficiales/${dateKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    // Extracción Directa desde Páginas Oficiales Verificadas — EXCLUSIVO ADMINISTRADOR
    // Prohibido usar números simulados (Mock/Seed): Si un sorteo aún no está publicado en la web oficial, no se agrega.
    async fetchLiveResultsFromWeb(dateKey) {
      const extracted = {};
      if (!this.isMasterAdminContext()) return extracted;

      const metaMap = this.getLotteryMetaMap();
      if (Object.keys(metaMap).length === 0) return extracted;

      const todayIso = getTodayIsoLocal();
      const isToday = !dateKey || dateKey === todayIso;
      const venAnmUrl = isToday
        ? 'https://loteriadehoy.com/animalitos/resultados/'
        : `https://loteriadehoy.com/animalitos/resultados/${dateKey}/`;
      const venLotUrl = isToday
        ? 'https://loteriadehoy.com/loterias/resultados/'
        : `https://loteriadehoy.com/loterias/resultados/${dateKey}/`;
      const colUrl = 'https://loteriasdehoy.co/';

      this.lastSyncWarning = null;
      this.lastSourceStatus = {};

      let [anmRes, lotRes, colRes] = await Promise.all([
        this.fetchOfficialSource(venAnmUrl, 10000),
        this.fetchOfficialSource(venLotUrl, 10000),
        this.fetchOfficialSource(colUrl, 10000)
      ]);

      // Respaldo para animalitos hoy si loteriadehoy falló
      if (!anmRes && isToday) {
        anmRes = await this.fetchOfficialSource('https://lotoven.com/animalitos/', 10000);
      }

      let okSources = 0;
      if (anmRes) {
        okSources++;
        const cnt = this.parseLoteriaDeHoyAnimalitos(anmRes.text, anmRes.format, dateKey, metaMap, extracted);
        this.lastSourceStatus.animalitos = `OK vía ${anmRes.via} (${cnt} sorteos)`;
      }
      if (lotRes) {
        okSources++;
        const cnt = this.parseLoteriaDeHoyLoterias(lotRes.text, lotRes.format, dateKey, metaMap, extracted);
        this.lastSourceStatus.loterias = `OK vía ${lotRes.via} (${cnt} sorteos)`;
      }
      if (colRes) {
        okSources++;
        const cnt = this.parseLoteriasDeHoyColombia(colRes.text, colRes.format, dateKey, metaMap, extracted);
        this.lastSourceStatus.colombia = `OK vía ${colRes.via} (${cnt} sorteos)`;
      }

      if (okSources === 0) {
        this.lastSyncWarning = 'No se pudo conectar con las páginas oficiales externas (verifique su internet o abra la app mediante server.js / navegador).';
      } else if (Object.keys(extracted).length === 0) {
        this.lastSyncWarning = `No hay resultados oficiales publicados en las fuentes externas para la fecha ${dateKey}.`;
      }

      return extracted;
    }

    // 1. PARSER ANIMALITOS VENEZUELA (loteriadehoy.com / lotoven.com — HTML o Markdown)
    parseLoteriaDeHoyAnimalitos(content, format, dateKey, metaMap, targetMap) {
      if (!content) return 0;
      let added = 0;

      // Verificar fecha explícita en el contenido para evitar mezclar días
      const headerSlice = format === 'html'
        ? (content.split(/<body[^>]*>/i)[1] || content).slice(0, 20000).replace(/<[^>]+>/g, ' ')
        : content.slice(0, 2000);
      const pageDateMatch = headerSlice.match(/(?:el\s+dia|day|,\s*)[^\n]{0,30}?(\d{1,2}\s+(?:de\s+)?[a-záéíóú]+\s+(?:de\s+)?\d{4})/i);
      if (pageDateMatch) {
        const pageIso = parseSpanishDateToIso(pageDateMatch[1]);
        if (pageIso && pageIso !== dateKey) {
          return 0;
        }
      }

      if (format === 'markdown') {
        const chunks = content.split(/(?=^###\s+)/m);
        for (const chunk of chunks) {
          const titleM = chunk.match(/^###\s+([^\n]+)/);
          if (!titleM) continue;
          const prefix = resolveAnimalPrefixFromTitle(titleM[1]);
          if (!prefix) continue;

          // Verificar si la sección tiene fecha explícita distinta (caso lotoven)
          const secDateM = chunk.slice(0, 350).match(/\b(\d{1,2}\s+(?:de\s+)?[a-z]+\s+(?:de\s+)?\d{4})\b/i);
          if (secDateM) {
            const secIso = parseSpanishDateToIso(secDateM[1]);
            if (secIso && secIso !== dateKey) continue;
          }

          // Formato loteriadehoy Markdown: #### 11 Gato \n\n ##### 08:00 AM
          const reLdh = /####\s*(00|\d{1,2})\b[^\n]*[\r\n]+[\s\S]{0,60}?#####\s*(\d{1,2}:\d{2}\s*[AP]M)/gi;
          let m;
          let matchedInChunk = 0;
          while ((m = reLdh.exec(chunk)) !== null) {
            const rawNum = m[1].trim();
            const timeCode = parseTime12ToCode(m[2]);
            if (!timeCode) continue;
            const lotId = `${prefix}_${timeCode}`;
            const lot = metaMap[lotId];
            if (!lot) continue;
            const built = this.buildFormattedResultForLottery(lot, rawNum, null, null, 'AUTO-WEB');
            if (built) {
              targetMap[lotId] = built;
              added++;
              matchedInChunk++;
            }
          }

          // Formato alternativo (lotoven Markdown): "11 Gato 08:00 AM"
          if (matchedInChunk === 0) {
            const reAlt = /(?:^|\n)\s*(00|\d{1,2})\s+[A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,25}\s+(\d{1,2}:\d{2}\s*[AP]M)\b/gi;
            while ((m = reAlt.exec(chunk)) !== null) {
              const rawNum = m[1].trim();
              const timeCode = parseTime12ToCode(m[2]);
              if (!timeCode) continue;
              const lotId = `${prefix}_${timeCode}`;
              const lot = metaMap[lotId];
              if (!lot) continue;
              const built = this.buildFormattedResultForLottery(lot, rawNum, null, null, 'AUTO-WEB');
              if (built) {
                targetMap[lotId] = built;
                added++;
              }
            }
          }
        }
        return added;
      }

      // Modo HTML directo (/api/proxy)
      const body = content.split(/<body[^>]*>/i)[1] || content;
      const chunks = body.split(/(?=<h3[^>]*>)/i);
      for (const chunk of chunks) {
        const titleM = chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        if (!titleM) continue;
        const cleanTitle = titleM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const prefix = resolveAnimalPrefixFromTitle(cleanTitle);
        if (!prefix) continue;

        const reCard = /<h4[^>]*>\s*(00|\d{1,2})\b[\s\S]*?<\/h4>\s*<h5[^>]*>\s*(\d{1,2}:\d{2}\s*[AP]M)\s*<\/h5>/gi;
        let m;
        let matchedInChunk = 0;
        while ((m = reCard.exec(chunk)) !== null) {
          const rawNum = m[1].trim();
          const timeCode = parseTime12ToCode(m[2]);
          if (!timeCode) continue;
          const lotId = `${prefix}_${timeCode}`;
          const lot = metaMap[lotId];
          if (!lot) continue;
          const built = this.buildFormattedResultForLottery(lot, rawNum, null, null, 'AUTO-WEB');
          if (built) {
            targetMap[lotId] = built;
            added++;
            matchedInChunk++;
          }
        }

        // Respaldo HTML Lotoven
        if (matchedInChunk === 0) {
          const strippedChunk = chunk.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const reAltHtml = /\b(00|\d{1,2})\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,20}(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,15})?\s+(\d{1,2}:\d{2}\s*[AP]M)\b/gi;
          while ((m = reAltHtml.exec(strippedChunk)) !== null) {
            const rawNum = m[1].trim();
            const timeCode = parseTime12ToCode(m[2]);
            if (!timeCode) continue;
            const lotId = `${prefix}_${timeCode}`;
            const lot = metaMap[lotId];
            if (!lot) continue;
            const built = this.buildFormattedResultForLottery(lot, rawNum, null, null, 'AUTO-WEB');
            if (built) {
              targetMap[lotId] = built;
              added++;
            }
          }
        }
      }
      return added;
    }

    // 2. PARSER TRIPLES Y ZODIACALES VENEZUELA (loteriadehoy.com — HTML o Markdown)
    parseLoteriaDeHoyLoterias(content, format, dateKey, metaMap, targetMap) {
      if (!content) return 0;
      let added = 0;

      const headerSlice = format === 'html'
        ? (content.split(/<body[^>]*>/i)[1] || content).slice(0, 20000).replace(/<[^>]+>/g, ' ')
        : content.slice(0, 3500);
      const pageDateMatch = headerSlice.match(/el\s+dia\s+(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i);
      if (pageDateMatch) {
        const pageIso = parseSpanishDateToIso(pageDateMatch[1]);
        if (pageIso && pageIso !== dateKey) {
          return 0;
        }
      }

      const saveRow = (cfg, timeCode, cells) => {
        if (!cfg || !timeCode || cells.length === 0) return;

        if (cfg.single) {
          const rawNum = cells.find(c => /^\d{2,3}$/.test(c));
          const lotId = `${cfg.single}_${timeCode}`;
          if (rawNum && metaMap[lotId]) {
            const built = this.buildFormattedResultForLottery(metaMap[lotId], rawNum, null, null, 'AUTO-WEB');
            if (built) { targetMap[lotId] = built; added++; }
          }
          return;
        }

        const nums = cells.filter(c => /^\d{3}$/.test(c));
        const signCell = cells.map(c => normalizeZodiacSign(c)).find(Boolean) || null;

        if (cfg.a && nums[0]) {
          const idA = `${cfg.a}_${timeCode}`;
          if (metaMap[idA]) {
            const bA = this.buildFormattedResultForLottery(metaMap[idA], nums[0], null, null, 'AUTO-WEB');
            if (bA) { targetMap[idA] = bA; added++; }
          }
        }
        if (cfg.b && nums[1]) {
          const idB = `${cfg.b}_${timeCode}`;
          if (metaMap[idB]) {
            const bB = this.buildFormattedResultForLottery(metaMap[idB], nums[1], null, null, 'AUTO-WEB');
            if (bB) { targetMap[idB] = bB; added++; }
          }
        }
        if (cfg.z && signCell) {
          // Si tiene A y B + Zodiacal (3 nums), el 3ro es zodiacal; si solo tiene A + Zodiacal (Zamorano = 2 nums), el 2do es zodiacal
          const zNum = cfg.b ? nums[2] : (nums[1] || nums[0]);
          const idZ = `${cfg.z}_${timeCode}`;
          if (zNum && metaMap[idZ]) {
            const bZ = this.buildFormattedResultForLottery(metaMap[idZ], zNum, signCell, null, 'AUTO-WEB');
            if (bZ) { targetMap[idZ] = bZ; added++; }
          }
        }
      };

      if (format === 'markdown') {
        const lines = content.split(/\r?\n/);
        let currentCfg = null;
        for (const line of lines) {
          const hdrM = line.match(/^\|\s*(?:!\[[^\]]*\]\([^)]*\)\s*)?([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .\-]+?)\s*\|\s*$/);
          if (hdrM && !/^\d{1,2}:\d{2}/.test(hdrM[1]) && !/^---/.test(hdrM[1])) {
            currentCfg = resolveVenLottoConfigFromTitle(hdrM[1]);
            continue;
          }
          if (!currentCfg) continue;
          if (!line.trim().startsWith('|')) {
            if (line.trim().startsWith('*   [')) currentCfg = null;
            continue;
          }
          const cols = line.split('|').slice(1, -1).map(c => c.trim());
          if (cols.length >= 2 && /^\d{1,2}:\d{2}\s*[AP]M$/i.test(cols[0])) {
            const timeCode = parseTime12ToCode(cols[0]);
            saveRow(currentCfg, timeCode, cols.slice(1).filter(Boolean));
          }
        }
        return added;
      }

      // Modo HTML directo
      const body = content.split(/<body[^>]*>/i)[1] || content;
      const thChunks = body.split(/(?=<th[^>]*colspan)/i);
      for (const chunk of thChunks) {
        const thM = chunk.match(/<th[^>]*colspan[^>]*>([\s\S]*?)<\/th>/i);
        if (!thM) continue;
        const cleanTitle = thM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const cfg = resolveVenLottoConfigFromTitle(cleanTitle);
        if (!cfg) continue;

        const tbodyM = chunk.match(/<tbody>([\s\S]*?)<\/tbody>/i);
        const rowsSrc = tbodyM ? tbodyM[1] : chunk.slice(0, 6000);
        const trMatches = rowsSrc.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const tr of trMatches) {
          const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
            m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          );
          if (tds.length >= 2 && /^\d{1,2}:\d{2}\s*[AP]M$/i.test(tds[0])) {
            const timeCode = parseTime12ToCode(tds[0]);
            saveRow(cfg, timeCode, tds.slice(1).filter(Boolean));
          }
        }
      }
      return added;
    }

    // 3. PARSER COLOMBIA 4 CIFRAS, LA 5TA Y SUPER ASTRO (loteriasdehoy.co — HTML o Markdown)
    parseLoteriasDeHoyColombia(content, format, dateKey, metaMap, targetMap) {
      if (!content) return 0;
      let added = 0;

      const saveColombiaCard = (title, cardDateStr, resultText, explicitBall5 = null) => {
        const lotId = resolveColombiaLotteryIdFromTitle(title, dateKey);
        if (!lotId || !metaMap[lotId]) return;
        const cardIso = parseSpanishDateToIso(cardDateStr);
        if (!cardIso || cardIso !== dateKey) return;

        const lot = metaMap[lotId];
        // Limpiar "serie XXX" para loterías tradicionales para no confundir con La 5ta
        const withoutSerie = String(resultText || '').split(/serie/i)[0].trim();

        if (lot.categoryKey === 'con_signo') {
          const parts = withoutSerie.split(/[-–]/);
          const digitsOnly = (parts[0] || withoutSerie).replace(/\D/g, '');
          const signRaw = parts[1] || (withoutSerie.match(/[a-záéíóúñ]{3,}/gi) || []).pop() || '';
          const signCode = normalizeZodiacSign(signRaw);
          if (digitsOnly.length >= 4 && signCode) {
            const built = this.buildFormattedResultForLottery(lot, digitsOnly.slice(0, 4), signCode, null, 'AUTO-WEB');
            if (built) { targetMap[lotId] = built; added++; }
          }
          return;
        }

        const digitsOnly = withoutSerie.replace(/\D/g, '');
        if (!digitsOnly || digitsOnly.length < 3) return;

        let mainNum = digitsOnly;
        let ball5 = explicitBall5 || null;

        if (lot.id.startsWith('CASH_THREE')) {
          mainNum = digitsOnly.slice(0, 3);
        } else if (lot.has5ta && digitsOnly.length >= 5) {
          mainNum = digitsOnly.slice(0, 4);
          if (!ball5) ball5 = digitsOnly.slice(4, 5);
        } else {
          mainNum = digitsOnly.slice(0, 4);
        }

        const built = this.buildFormattedResultForLottery(lot, mainNum, null, ball5, 'AUTO-WEB');
        if (built) {
          targetMap[lotId] = built;
          added++;
        }
      };

      if (format === 'markdown') {
        const chunks = content.split(/(?=^###\s+\[)/m);
        for (const chunk of chunks) {
          const h3M = chunk.match(/^###\s+\[([^\]]+)\]/);
          if (!h3M) continue;
          const title = h3M[1].trim();
          const lines = chunk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length < 3) continue;
          // lines[1] = "18 Noviembre 2026", lines[2] = "0 5 6 0 5" or "0 7 4 8 - Acuario" or "1 6 5 1 serie 0 1 1"
          saveColombiaCard(title, lines[1], lines[2], null);
        }
        return added;
      }

      // Modo HTML directo (loteriasdehoy.co)
      const rawSections = content.split(/(?=<div\s+class=["'](?:chances_hoy|loterias_resultados)["']\s*>)/i);

      for (const sec of rawSections) {
        if (!/^<div\s+class=["'](?:chances_hoy|loterias_resultados)["']/i.test(sec)) continue;
        const h3M = sec.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        const dateM = sec.match(/<div\s+class=["']fecha_resultado["'][^>]*>([\s\S]*?)<\/div>/i);
        if (!h3M || !dateM) continue;
        const title = h3M[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const cardDate = dateM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        const resBoxM = sec.match(/<div\s+class=["']resultado_chances_hoy["'][^>]*>([\s\S]*?)<\/div>/i)
          || sec.match(/<div\s+class=["']fecha_resultado["'][^>]*>[\s\S]*?<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
        if (!resBoxM) continue;

        const ball5M = resBoxM[1].match(/class=['"]redondoc premio5['"]>(\d)</i);
        const explicit5 = ball5M ? ball5M[1] : null;
        const cleanRes = resBoxM[1]
          .replace(/<span[^>]*premio5[^>]*>[\s\S]*?<\/span>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        saveColombiaCard(title, cardDate, cleanRes, explicit5);
      }

      return added;
    }

    // Construye un objeto de resultado oficial formateado según la categoría del sorteo
    buildFormattedResultForLottery(lot, rawNum, rawSign = null, rawBall5 = null, origenTag = 'AUTO-WEB') {
      const officialDrawTime12h = format12hFromLot(lot);
      const isManual = origenTag === 'MANUAL-ADMIN';

      if (lot.categoryKey === 'animalitos') {
        const resolved = typeof validateAndResolveAnimalForLottery === 'function'
          ? validateAndResolveAnimalForLottery(rawNum, lot.id || lot.name)
          : null;
        if (resolved) {
          if (!resolved.valid) return null;
          return {
            number: resolved.code,
            sign: null,
            ball5: null,
            animalName: resolved.name,
            timestamp: officialDrawTime12h,
            origen: origenTag,
            source: origenTag,
            bloqueadoPorAdmin: isManual,
            verified: true,
            updatedAt: new Date().toISOString()
          };
        }
        const cleanRaw = String(rawNum || '').trim();
        let num = cleanRaw;
        if (cleanRaw !== '0' && cleanRaw !== '00') {
          const parsed = parseInt(cleanRaw, 10);
          if (!isNaN(parsed)) {
            num = parsed < 10 ? `0${parsed}` : String(parsed);
          }
        }
        const info = typeof getAnimalOrFruitInfo === 'function'
          ? getAnimalOrFruitInfo(num, lot.id)
          : (typeof ANIMALITOS_DICT !== 'undefined' ? ANIMALITOS_DICT[num] : null);
        return {
          number: num,
          sign: null,
          ball5: null,
          animalName: info ? info.name : 'Animalito',
          timestamp: officialDrawTime12h,
          origen: origenTag,
          source: origenTag,
          bloqueadoPorAdmin: isManual,
          verified: true,
          updatedAt: new Date().toISOString()
        };
      }

      if (lot.categoryKey === 'con_signo') {
        const isAstro4 = lot.id.startsWith('ASTRO_SOL') || lot.id.startsWith('ASTRO_LUNA') || lot.digits === 4;
        const digits = isAstro4 ? 4 : 3;
        const num = String(rawNum).slice(-digits).padStart(digits, '0');
        const signs = ['ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR', 'LIB', 'ESC', 'SAG', 'CAP', 'ACU', 'PIS'];
        const sign = rawSign || signs[0];
        return {
          number: num,
          sign: sign,
          ball5: null,
          animalName: null,
          timestamp: officialDrawTime12h,
          origen: origenTag,
          source: origenTag,
          bloqueadoPorAdmin: isManual,
          verified: true,
          updatedAt: new Date().toISOString()
        };
      }

      if (lot.categoryKey === 'cuatro_cifras') {
        const digits = lot.id.startsWith('CASH_THREE') ? 3 : (lot.digits || 4);
        const num = String(rawNum).slice(-digits).padStart(digits, '0');
        return {
          number: num,
          sign: null,
          ball5: rawBall5 ? String(rawBall5).trim() : null,
          animalName: null,
          timestamp: officialDrawTime12h,
          origen: origenTag,
          source: origenTag,
          bloqueadoPorAdmin: isManual,
          verified: true,
          updatedAt: new Date().toISOString()
        };
      }

      // SIN SIGNO (Triple o Terminal)
      const isTerminalOnly = lot.id.startsWith('NAPA_GANA') || lot.digits === 2;
      const digits = isTerminalOnly ? 2 : 3;
      const num = String(rawNum).slice(-digits).padStart(digits, '0');
      return {
        number: num,
        sign: null,
        ball5: null,
        animalName: null,
        timestamp: officialDrawTime12h,
        origen: origenTag,
        source: origenTag,
        bloqueadoPorAdmin: isManual,
        verified: true,
        updatedAt: new Date().toISOString()
      };
    }

    // MODO MAESTRO (EXCLUSIVO ADMINISTRADOR):
    // Extrae resultados publicados en la web oficial y sincroniza con el nodo central
    // respetando todos los resultados con `bloqueadoPorAdmin: true` (`MANUAL-ADMIN`).
    async syncFromOfficialWeb(dateKey, options = { silent: false }) {
      const targetDate = dateKey || getTodayIsoLocal();
      if (!this.isMasterAdminContext()) {
        return await this.pullPassiveResultsFromCentral(targetDate);
      }
      if (this.isSyncing) return { results: this.getFilteredOfficialResults(targetDate), extractedCount: 0, winnersCount: 0 };
      this.isSyncing = true;

      let newWebCount = 0;
      let liquidationStats = { winnersCount: 0, totalPrizeMoney: 0 };

      try {
        if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
          await window.bancaFcCloud.pullAndMergeFromFirebase();
        }

        const [fbOfficialNode, webLiveResults] = await Promise.all([
          this.fetchFromFirebaseOfficialNode(targetDate),
          this.fetchLiveResultsFromWeb(targetDate)
        ]);

        const metaMap = this.getLotteryMetaMap();
        const master = typeof storage !== 'undefined' ? storage.getMasterData() : null;

        if (master) {
          if (!master.results) master.results = {};
          if (!master.results[targetDate]) master.results[targetDate] = {};

          const currentDayResults = master.results[targetDate];

          // 1. Integrar primero resultados existentes en el nodo oficial de Firebase
          if (fbOfficialNode && typeof fbOfficialNode === 'object') {
            Object.keys(fbOfficialNode).forEach(lotId => {
              const remoteItem = fbOfficialNode[lotId];
              const localItem = currentDayResults[lotId];
              if (!remoteItem || !remoteItem.number || !metaMap[lotId]) return;

              if (localItem && localItem.bloqueadoPorAdmin && (!remoteItem.bloqueadoPorAdmin || (localItem.updatedAt || '') > (remoteItem.updatedAt || ''))) {
                return;
              }
              if (!localItem || localItem.number !== remoteItem.number || localItem.sign !== remoteItem.sign || localItem.ball5 !== remoteItem.ball5) {
                currentDayResults[lotId] = {
                  ...remoteItem,
                  origen: remoteItem.origen || remoteItem.source || 'AUTO-WEB',
                  source: remoteItem.origen || remoteItem.source || 'AUTO-WEB',
                  bloqueadoPorAdmin: Boolean(remoteItem.bloqueadoPorAdmin || remoteItem.origen === 'MANUAL-ADMIN'),
                  verified: true
                };
              }
            });
          }

          // 2. Integrar resultados extraídos en vivo de las páginas oficiales (`origen: "AUTO-WEB"`)
          //    SIN pisar jamás un resultado manual del Administrador (`bloqueadoPorAdmin: true`)
          Object.keys(webLiveResults).forEach(lotId => {
            const lotMeta = metaMap[lotId];
            if (!lotMeta) return;
            const existing = currentDayResults[lotId];
            if (existing && (existing.bloqueadoPorAdmin || existing.origen === 'MANUAL-ADMIN')) {
              return;
            }

            const webItem = webLiveResults[lotId];
            if (!webItem || !webItem.number) return;

            if (!existing || existing.number !== webItem.number || existing.sign !== webItem.sign || existing.ball5 !== webItem.ball5) {
              currentDayResults[lotId] = {
                ...webItem,
                origen: 'AUTO-WEB',
                source: 'AUTO-WEB',
                bloqueadoPorAdmin: false,
                verified: true
              };
              newWebCount++;
            }
          });

          master.resultsUpdatedAt = new Date().toISOString();
          storage.saveMasterData(master, false);
          liquidationStats = storage.recalculateAllTicketWinnings(targetDate);
          await this.pushToFirebaseOfficialNode(targetDate, currentDayResults);
        }

        this.lastWebExtractedCount = newWebCount;
        this.lastSyncTime = new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        window.dispatchEvent(new CustomEvent('banca_fc_official_results_synced', {
          detail: {
            dateKey: targetDate,
            timestamp: this.lastSyncTime,
            newWebCount,
            warning: this.lastSyncWarning
          }
        }));
      } catch (err) {
        console.warn('Aviso en sincronización web del Administrador:', err);
      } finally {
        this.isSyncing = false;
      }

      return {
        results: this.getFilteredOfficialResults(targetDate),
        extractedCount: newWebCount,
        winnersCount: liquidationStats.winnersCount || 0
      };
    }

    // MODO ESCLAVO / PASIVO (TAQUILLAS POS):
    async pullPassiveResultsFromCentral(dateKey) {
      const targetDate = dateKey || getTodayIsoLocal();
      if (this.isSyncing) return this.getFilteredOfficialResults(targetDate);
      this.isSyncing = true;

      try {
        if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
          await window.bancaFcCloud.pullAndMergeFromFirebase();
        }

        const fbOfficialNode = await this.fetchFromFirebaseOfficialNode(targetDate);
        if (fbOfficialNode !== null && typeof storage !== 'undefined') {
          const master = storage.getMasterData();
          if (master) {
            if (!master.results) master.results = {};
            if (Object.keys(fbOfficialNode).length > 0) {
              master.results[targetDate] = fbOfficialNode;
              localStorage.setItem('banca_fc_data', JSON.stringify(master));
              storage.syncLegacyKeysFromMaster(master);
              storage.recalculateAllTicketWinnings(targetDate);
            }
          }
        }

        this.lastSyncTime = new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        window.dispatchEvent(new CustomEvent('banca_fc_official_results_synced', {
          detail: { dateKey: targetDate, timestamp: this.lastSyncTime }
        }));
      } catch (e) {
      } finally {
        this.isSyncing = false;
      }

      return this.getFilteredOfficialResults(targetDate);
    }

    async syncOfficialResultsForDate(dateKey, options = { silent: false }) {
      const targetDate = dateKey || getTodayIsoLocal();
      if (this.isMasterAdminContext()) {
        const res = await this.syncFromOfficialWeb(targetDate, options);
        return res.results;
      }
      return await this.pullPassiveResultsFromCentral(targetDate);
    }

    getFilteredOfficialResults(dateKey, categoryFilter = 'ALL', searchQuery = '') {
      const targetDate = dateKey || getTodayIsoLocal();
      const rawResults = (typeof storage !== 'undefined' && storage.getResults(targetDate)) || {};
      const metaMap = this.getLotteryMetaMap();
      const q = String(searchQuery || '').trim().toLowerCase();

      const rows = [];
      Object.keys(rawResults).forEach(lotId => {
        const lotMeta = metaMap[lotId];
        if (!lotMeta) return;

        if (categoryFilter && categoryFilter !== 'ALL' && lotMeta.categoryKey !== categoryFilter) {
          return;
        }

        const r = rawResults[lotId];
        if (!r || !r.number) return;

        let resolvedAnimalName = r.animalName || null;
        if (lotMeta.categoryKey === 'animalitos' && !resolvedAnimalName && typeof getAnimalOrFruitInfo === 'function') {
          const info = getAnimalOrFruitInfo(r.number, lotId);
          if (info) resolvedAnimalName = info.name;
        }

        const origen = r.origen || r.source || 'MANUAL-ADMIN';
        const bloqueadoPorAdmin = Boolean(r.bloqueadoPorAdmin || origen === 'MANUAL-ADMIN');

        if (q) {
          const searchable = `${lotMeta.name} ${lotMeta.categoryLabel} ${r.number} ${resolvedAnimalName || ''} ${r.sign || ''} ${origen}`.toLowerCase();
          if (!searchable.includes(q)) return;
        }

        const sortMinutes = getDrawMinutesFromLot(lotMeta);
        const drawTime12h = format12hFromLot(lotMeta);

        rows.push({
          lotteryId: lotId,
          lotteryName: lotMeta.name,
          categoryKey: lotMeta.categoryKey,
          categoryLabel: lotMeta.categoryLabel,
          drawTime12h,
          sortMinutes,
          number: r.number,
          sign: r.sign || null,
          animalName: resolvedAnimalName,
          ball5: r.ball5 || null,
          timestamp: r.timestamp || drawTime12h,
          origen,
          source: origen,
          bloqueadoPorAdmin
        });
      });

      rows.sort((a, b) => b.sortMinutes - a.sortMinutes || a.lotteryName.localeCompare(b.lotteryName));
      return rows;
    }
  }

  const autoResultsService = new AutoResultsSyncService();
  if (typeof window !== 'undefined') {
    window.bancaFcAutoResults = autoResultsService;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      autoResultsService.init();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AutoResultsSyncService,
      autoResultsService,
      stripAccents,
      parseTime12ToCode,
      parseSpanishDateToIso,
      normalizeZodiacSign,
      resolveAnimalPrefixFromTitle,
      resolveVenLottoConfigFromTitle,
      resolveColombiaLotteryIdFromTitle
    };
  }
})();
