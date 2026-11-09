// js/auto-results.js - Motor Maestro-Esclavo de Resultados Oficiales y Liquidación Centralizada
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"
// Arquitectura Fuente Única de Verdad (Master-Slave):
//  - MODO MAESTRO (Exclusivo Panel Administrativo `admin.html`):
//      1) Extracción Automática Centralizada desde páginas oficiales (TuAzar / Colombia) con `origen: "AUTO-WEB"`.
//      2) Carga y Corrección Manual de Respaldo con `origen: "MANUAL-ADMIN"` y `bloqueadoPorAdmin: true`.
//      3) Prohibido usar números simulados (Mock/Seed): si un sorteo aún no está publicado, NO se agrega.
//      4) Publica en `/banca_fc_resultados_oficiales/{YYYY-MM-DD}` y `/banca_fc_master` para todas las taquillas.
//  - MODO ESCLAVO / PASIVO (Taquillas POS `index.html`):
//      1) CERO scraping externo y CERO generación aleatoria/semilla.
//      2) Escucha únicamente en tiempo real (`EventSource` Firebase + `storage` localStorage) los resultados
//         y liquidaciones publicados por el Programa Administrativo Central.

(function () {
  const ADMIN_AUTOSYNC_STORAGE_KEY = 'banca_fc_admin_autosync_3m';

  const CORS_PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  const WEB_SOURCES = {
    venTriples: 'https://tuazar.com/loteria/resultados/',
    venAnimalitos: 'https://tuazar.com/loteria/animalitos/resultados/',
    venFrutas: 'https://tuazar.com/loteria/frutas/resultados/',
    colChances: 'https://resultadodelaloteria.com/colombia/'
  };

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

  class AutoResultsSyncService {
    constructor() {
      this.syncIntervalId = null;
      this.passiveEventSource = null;
      this.isSyncing = false;
      this.lastSyncTime = null;
      this.lastSyncSource = 'CENTRAL ADMIN';
      this.lastWebExtractedCount = 0;
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
      // 1. Escuchar cambios en localStorage compartido entre pestañas/ventanas
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

      // 2. Escuchar nodo oficial de resultados en Firebase Realtime Database (`onValue` vía SSE)
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

      // 3. Respaldo de lectura pasiva periódica desde Firebase cada 30 segundos en la taquilla
      if (this.syncIntervalId) clearInterval(this.syncIntervalId);
      this.syncIntervalId = setInterval(() => {
        const posDateEl = document.getElementById('input-resultados-fecha');
        const targetDate = (posDateEl && posDateEl.value) ? posDateEl.value : getTodayIsoLocal();
        this.pullPassiveResultsFromCentral(targetDate);
      }, 30000);
    }

    // Aplica en la taquilla los resultados autorizados provenientes del nodo central del Administrador
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

    // Verifica si la hora oficial de un sorteo ya se cumplió (para el extractor web automático del Admin)
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
      if (typeof LOTTERY_CATALOGS === 'undefined') return [];
      return [
        ...(LOTTERY_CATALOGS.sin_signo || []).map(l => ({ ...l, categoryKey: 'sin_signo', categoryLabel: 'SIN SIGNO' })),
        ...(LOTTERY_CATALOGS.con_signo || []).map(l => ({ ...l, categoryKey: 'con_signo', categoryLabel: 'CON SIGNO' })),
        ...(LOTTERY_CATALOGS.cuatro_cifras || []).map(l => ({ ...l, categoryKey: 'cuatro_cifras', categoryLabel: '4 CIFRAS' })),
        ...(LOTTERY_CATALOGS.animalitos || []).map(l => ({ ...l, categoryKey: 'animalitos', categoryLabel: 'ANIMALITOS' }))
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

    // Fetch vía Proxy CORS redundante — EXCLUSIVO PARA EL PANEL ADMINISTRATIVO
    async fetchViaCorsProxy(targetUrl, timeoutMs = 4500) {
      if (!this.isMasterAdminContext()) return null;
      for (const buildProxyUrl of CORS_PROXIES) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const resp = await fetch(buildProxyUrl(targetUrl), {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Accept': 'text/html,application/json,*/*' }
          });
          clearTimeout(timer);
          if (resp.ok) {
            const text = await resp.text();
            if (text && text.length > 100) {
              return text;
            }
          }
        } catch (err) {
          // Intentar siguiente proxy
        }
      }
      return null;
    }

    // Consultar el nodo central en Firebase Realtime Database (`/banca_fc_resultados_oficiales/{YYYY-MM-DD}`)
    async fetchFromFirebaseOfficialNode(dateKey) {
      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (!fbUrl) return null;

        const cleanBase = fbUrl.replace(/\/+$/, '');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
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

    // Publicar el mapa completo de resultados autorizados de una fecha en el nodo central de Firebase
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

    // Extracción Directa desde Páginas Oficiales (TuAzar / Colombia) — EXCLUSIVO ADMINISTRADOR
    // Prohibido usar números simulados (Mock/Seed): Si un sorteo aún no está publicado en la web oficial, no se agrega.
    async fetchLiveResultsFromWeb(dateKey) {
      const extracted = {};
      if (!this.isMasterAdminContext()) return extracted;

      const allLots = this.getAllCatalogLotteriesWithCategory();
      if (allLots.length === 0) return extracted;

      try {
        const [htmlAnimalitos, htmlTriples, htmlFrutas, htmlCol] = await Promise.all([
          this.fetchViaCorsProxy(WEB_SOURCES.venAnimalitos, 4500),
          this.fetchViaCorsProxy(WEB_SOURCES.venTriples, 4500),
          this.fetchViaCorsProxy(WEB_SOURCES.venFrutas, 4500),
          this.fetchViaCorsProxy(WEB_SOURCES.colChances, 4500)
        ]);

        const combinedHtml = [htmlAnimalitos || '', htmlTriples || '', htmlFrutas || '', htmlCol || ''].join('\n');
        if (combinedHtml.length > 200) {
          this.parseWebHtmlIntoCatalogResults(combinedHtml, allLots, dateKey, extracted);
        }
      } catch (e) {}

      return extracted;
    }

    parseWebHtmlIntoCatalogResults(rawHtml, allLots, dateKey, targetMap) {
      const cleanText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

      allLots.forEach(lot => {
        if (!this.hasLotteryDrawPassed(lot, dateKey)) return;

        const escapedName = lot.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedName}[^0-9]{1,35}(\\d{1,4})`, 'i');
        const match = cleanText.match(regex);
        if (match && match[1]) {
          const rawNum = match[1].trim();
          const built = this.buildFormattedResultForLottery(lot, rawNum, null, null, 'AUTO-WEB');
          if (built) {
            targetMap[lot.id] = built;
          }
        }
      });
    }

    // Construye un objeto de resultado oficial formateado según la categoría del sorteo
    buildFormattedResultForLottery(lot, rawNum, rawSign = null, rawBall5 = null, origenTag = 'AUTO-WEB') {
      const officialDrawTime12h = format12hFromLot(lot);
      const isManual = origenTag === 'MANUAL-ADMIN';

      if (lot.categoryKey === 'animalitos') {
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
        const digits = lot.digits || 4;
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
    // Extrae resultados publicados en la web oficial (TuAzar / Colombia) y sincroniza con el nodo central
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
          let changedCount = 0;

          // 1. Integrar primero resultados existentes en el nodo oficial de Firebase
          if (fbOfficialNode && typeof fbOfficialNode === 'object') {
            Object.keys(fbOfficialNode).forEach(lotId => {
              const remoteItem = fbOfficialNode[lotId];
              const localItem = currentDayResults[lotId];
              if (!remoteItem || !remoteItem.number || !metaMap[lotId]) return;

              // Si el local fue bloqueado manualmente por el Admin más recientemente, mantener el local
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
                changedCount++;
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
              return; // Blindado por el Administrador
            }

            const webItem = webLiveResults[lotId];
            if (!webItem || !webItem.number) return;

            if (!existing || existing.number !== webItem.number || existing.sign !== webItem.sign) {
              currentDayResults[lotId] = {
                ...webItem,
                origen: 'AUTO-WEB',
                source: 'AUTO-WEB',
                bloqueadoPorAdmin: false,
                verified: true
              };
              newWebCount++;
              changedCount++;
            }
          });

          // Siempre recalcular liquidación de tickets y publicar al nodo central si hubo cambios o si se pidió sincronizar
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
          detail: { dateKey: targetDate, timestamp: this.lastSyncTime, newWebCount }
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
    // Consulta únicamente lo que el Programa Administrativo haya publicado en Firebase / localStorage
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
            // Si el nodo oficial de Firebase tiene datos o si master.results tiene datos sincronizados del Admin
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
        // Silencioso en modo offline
      } finally {
        this.isSyncing = false;
      }

      return this.getFilteredOfficialResults(targetDate);
    }

    // Punto de entrada compatible: en Admin sincroniza, en Taquilla POS solo lee pasivamente del Admin
    async syncOfficialResultsForDate(dateKey, options = { silent: false }) {
      const targetDate = dateKey || getTodayIsoLocal();
      if (this.isMasterAdminContext()) {
        const res = await this.syncFromOfficialWeb(targetDate, options);
        return res.results;
      }
      return await this.pullPassiveResultsFromCentral(targetDate);
    }

    // Devuelve exactamente y únicamente los resultados que estén cargados y autorizados en el Programa Administrativo
    getFilteredOfficialResults(dateKey, categoryFilter = 'ALL', searchQuery = '') {
      const targetDate = dateKey || getTodayIsoLocal();
      const rawResults = (typeof storage !== 'undefined' && storage.getResults(targetDate)) || {};
      const metaMap = this.getLotteryMetaMap();
      const q = String(searchQuery || '').trim().toLowerCase();

      const rows = [];
      Object.keys(rawResults).forEach(lotId => {
        const lotMeta = metaMap[lotId];
        if (!lotMeta) return;

        // Filtro por Categoría (ALL, sin_signo, con_signo, cuatro_cifras, animalitos)
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

        // Filtro por texto (nombre de lotería, hora, número, animalito/fruta u origen)
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

      // Ordenar cronológicamente (del más reciente al más antiguo)
      rows.sort((a, b) => b.sortMinutes - a.sortMinutes || a.lotteryName.localeCompare(b.lotteryName));
      return rows;
    }
  }

  const autoResultsService = new AutoResultsSyncService();
  window.bancaFcAutoResults = autoResultsService;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      autoResultsService.init();
    });
  }
})();
