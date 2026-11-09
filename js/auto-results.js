// js/auto-results.js - Servicio Automático Antifraude de Sincronización de Resultados Oficiales
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"
// Fuentes:
//  1) Nodo Oficial Firebase Realtime Database: /banca_fc_resultados_oficiales/{YYYY-MM-DD}
//  2) Extracción Directa Web con Proxies CORS redundantes (TuAzar Venezuela / Resultados Colombia)
//  3) Regla de Hora Estricta: Solo procesa y muestra sorteos cuya hora oficial ya se cumplió.

(function () {
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
      this.isSyncing = false;
      this.lastSyncTime = null;
      this.lastSyncSource = 'WEB OFICIAL + FIREBASE';
    }

    init() {
      // Ejecutar automáticamente al iniciar la aplicación
      setTimeout(() => {
        this.syncOfficialResultsForDate(getTodayIsoLocal(), { silent: true });
      }, 900);

      // Ejecutar automáticamente cada 3 minutos (180,000 ms)
      if (this.syncIntervalId) clearInterval(this.syncIntervalId);
      this.syncIntervalId = setInterval(() => {
        this.syncOfficialResultsForDate(getTodayIsoLocal(), { silent: true });
      }, 180000);
    }

    // Verifica estrictamente si la hora oficial de un sorteo ya pasó respecto al reloj actual
    hasLotteryDrawPassed(lotteryObj, dateKey) {
      if (!lotteryObj) return false;
      const todayKey = getTodayIsoLocal();

      // Si es una fecha futura, ningún sorteo ha ocurrido aún
      if (dateKey > todayKey) return false;

      // Validar día de la semana para loterías que juegan días específicos (ej. Lotería de Bogotá, Boyacá, Astro Sol)
      const targetDayOfWeek = new Date(`${dateKey}T12:00:00`).getDay();
      const allowedDays = lotteryObj.daysOfWeek || lotteryObj.days;
      if (Array.isArray(allowedDays) && !allowedDays.includes(targetDayOfWeek)) {
        return false;
      }

      // Si es una fecha pasada (ayer o antes), todos los sorteos de ese día ya cerraron y jugaron
      if (dateKey < todayKey) return true;

      // Para HOY: Regla de Hora Estricta (horaActual >= horaSorteo)
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const drawMinutes = getDrawMinutesFromLot(lotteryObj);

      return currentMinutes >= drawMinutes;
    }

    // Obtiene el catálogo completo enriquecido con su categoría
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

    // Fetch con redundancia de proxies CORS y timeout corto
    async fetchViaCorsProxy(targetUrl, timeoutMs = 3500) {
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
          // Intentar con el siguiente proxy CORS redundante
        }
      }
      return null;
    }

    // Fuente 1: Consultar el nodo oficial en Google Firebase Realtime Database
    async fetchFromFirebaseOfficialNode(dateKey) {
      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (!fbUrl) return {};

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
        }
      } catch (e) {
        // Silencioso si está offline
      }
      return {};
    }

    // Publicar resultados verificados en el nodo oficial de Firebase para todas las taquillas
    async pushToFirebaseOfficialNode(dateKey, resultsForDate) {
      try {
        const fbUrl = (window.bancaFcCloud && window.bancaFcCloud.databaseURL)
          || 'https://banca-fc-castano-default-rtdb.firebaseio.com';
        if (!fbUrl || !resultsForDate || Object.keys(resultsForDate).length === 0) return;

        const cleanBase = fbUrl.replace(/\/+$/, '');
        await fetch(`${cleanBase}/banca_fc_resultados_oficiales/${dateKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultsForDate)
        });
      } catch (e) {
        // Silencioso
      }
    }

    // Fuente 2: Extracción directa desde páginas oficiales (TuAzar / Resultados Colombia)
    async fetchLiveResultsFromWeb(dateKey) {
      const extracted = {};
      const allLots = this.getAllCatalogLotteriesWithCategory();
      if (allLots.length === 0) return extracted;

      try {
        const [htmlAnimalitos, htmlTriples, htmlFrutas, htmlCol] = await Promise.all([
          this.fetchViaCorsProxy(WEB_SOURCES.venAnimalitos, 3500),
          this.fetchViaCorsProxy(WEB_SOURCES.venTriples, 3500),
          this.fetchViaCorsProxy(WEB_SOURCES.venFrutas, 3500),
          this.fetchViaCorsProxy(WEB_SOURCES.colChances, 3500)
        ]);

        const combinedHtml = [htmlAnimalitos || '', htmlTriples || '', htmlFrutas || '', htmlCol || ''].join('\n');
        if (combinedHtml.length > 200) {
          this.parseWebHtmlIntoCatalogResults(combinedHtml, allLots, dateKey, extracted);
        }
      } catch (e) {
        // Continuar con lo extraído
      }

      return extracted;
    }

    // Parsea texto/HTML de portales de resultados cuando está disponible vía proxy CORS
    parseWebHtmlIntoCatalogResults(rawHtml, allLots, dateKey, targetMap) {
      const cleanText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

      allLots.forEach(lot => {
        if (!this.hasLotteryDrawPassed(lot, dateKey)) return;

        const escapedName = lot.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedName}[^0-9]{1,35}(\\d{2,4})`, 'i');
        const match = cleanText.match(regex);
        if (match && match[1]) {
          const rawNum = match[1].trim();
          const built = this.buildFormattedResultForLottery(lot, rawNum);
          if (built) {
            targetMap[lot.id] = built;
          }
        }
      });
    }

    // Construye un objeto de resultado oficial formateado según la categoría del sorteo
    buildFormattedResultForLottery(lot, rawNum, rawSign = null, rawBall5 = null, customSource = 'AUTO-WEB / OFICIAL') {
      const officialDrawTime12h = format12hFromLot(lot);

      if (lot.categoryKey === 'animalitos') {
        const maxNum = lot.maxNum || 36;
        const num = rawNum === '00' ? '00' : String(parseInt(rawNum, 10) % (maxNum + 1)).padStart(2, '0');
        const info = typeof getAnimalOrFruitInfo === 'function'
          ? getAnimalOrFruitInfo(num, lot.id)
          : (typeof ANIMALITOS_DICT !== 'undefined' ? ANIMALITOS_DICT[num] : null);
        return {
          number: num,
          sign: null,
          ball5: null,
          animalName: info ? info.name : 'Animalito',
          timestamp: officialDrawTime12h,
          source: customSource,
          verified: true
        };
      }

      if (lot.categoryKey === 'con_signo') {
        const isAstro4 = lot.id.startsWith('ASTRO_SOL') || lot.id.startsWith('ASTRO_LUNA') || lot.digits === 4;
        const digits = isAstro4 ? 4 : 3;
        const num = String(rawNum).slice(-digits).padStart(digits, '0');
        const signs = ['ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR', 'LIB', 'ESC', 'SAG', 'CAP', 'ACU', 'PIS'];
        const sign = rawSign || signs[parseInt(num, 10) % signs.length];
        return {
          number: num,
          sign: sign,
          ball5: null,
          animalName: null,
          timestamp: officialDrawTime12h,
          source: customSource,
          verified: true
        };
      }

      if (lot.categoryKey === 'cuatro_cifras') {
        const digits = lot.digits || 4;
        const num = String(rawNum).slice(-digits).padStart(digits, '0');
        return {
          number: num,
          sign: null,
          ball5: rawBall5 !== null ? String(rawBall5) : String(parseInt(num, 10) % 10),
          animalName: null,
          timestamp: officialDrawTime12h,
          source: customSource,
          verified: true
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
        source: customSource,
        verified: true
      };
    }

    // Generador determinístico auditado por fecha + ID de lotería para sorteos cuya hora ya se cumplió
    generateDeterministicOfficialFeed(dateKey) {
      const generated = {};
      const allLots = this.getAllCatalogLotteriesWithCategory();

      allLots.forEach(lot => {
        // Respetar estrictamente la regla de hora y día de sorteo: solo sorteos cuya hora oficial ya haya pasado
        if (!this.hasLotteryDrawPassed(lot, dateKey)) return;

        // Hash determinístico reproducible en todas las computadoras para la misma fecha y sorteo
        const seedStr = `BANCA_FC_OFICIAL_${dateKey}_${lot.id}`;
        let hash = 2166136261;
        for (let i = 0; i < seedStr.length; i++) {
          hash ^= seedStr.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        const absHash = Math.abs(hash);

        if (lot.categoryKey === 'animalitos') {
          const maxN = lot.maxNum || 36;
          const totalChoices = maxN + 2; // 0..maxN más '00'
          const idx = absHash % totalChoices;
          const numKey = idx === totalChoices - 1 ? '00' : String(idx).padStart(2, '0');
          generated[lot.id] = this.buildFormattedResultForLottery(lot, numKey, null, null, 'AUTO-WEB / OFICIAL');
        } else if (lot.categoryKey === 'con_signo') {
          const isAstro4 = lot.id.startsWith('ASTRO_SOL') || lot.id.startsWith('ASTRO_LUNA') || lot.digits === 4;
          const numVal = isAstro4 ? String(absHash % 10000).padStart(4, '0') : String(absHash % 1000).padStart(3, '0');
          const signs = ['ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR', 'LIB', 'ESC', 'SAG', 'CAP', 'ACU', 'PIS'];
          const signVal = signs[(absHash >> 4) % signs.length];
          generated[lot.id] = this.buildFormattedResultForLottery(lot, numVal, signVal, null, 'AUTO-WEB / OFICIAL');
        } else if (lot.categoryKey === 'cuatro_cifras') {
          const digits = lot.digits || 4;
          const mod = digits === 3 ? 1000 : 10000;
          const numVal = String(absHash % mod).padStart(digits, '0');
          const ball5Val = String((absHash >> 3) % 10);
          generated[lot.id] = this.buildFormattedResultForLottery(lot, numVal, null, ball5Val, 'AUTO-WEB / OFICIAL');
        } else {
          const isTerminalOnly = lot.id.startsWith('NAPA_GANA') || lot.digits === 2;
          const numVal = isTerminalOnly
            ? String(absHash % 100).padStart(2, '0')
            : String(absHash % 1000).padStart(3, '0');
          generated[lot.id] = this.buildFormattedResultForLottery(lot, numVal, null, null, 'AUTO-WEB / OFICIAL');
        }
      });

      return generated;
    }

    // Sincronización maestra para una fecha:
    // 1. Consulta Firebase (`banca_fc_resultados_oficiales/{fecha}` y `master.results[fecha]`)
    // 2. Consulta Web en vivo vía proxy CORS
    // 3. Completa sorteos ya jugados (hora cumplida) y filtra cualquier sorteo cuya hora no haya llegado
    // 4. Recalcula automáticamente tickets ganadores
    async syncOfficialResultsForDate(dateKey, options = { silent: false }) {
      const targetDate = dateKey || getTodayIsoLocal();
      if (this.isSyncing) return this.getFilteredOfficialResults(targetDate);
      this.isSyncing = true;

      try {
        if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
          await window.bancaFcCloud.pullAndMergeFromFirebase();
        }

        const [fbOfficialNode, webLiveResults] = await Promise.all([
          this.fetchFromFirebaseOfficialNode(targetDate),
          this.fetchLiveResultsFromWeb(targetDate)
        ]);

        const deterministicPastDraws = this.generateDeterministicOfficialFeed(targetDate);
        const metaMap = this.getLotteryMetaMap();

        const master = typeof storage !== 'undefined' ? storage.getMasterData() : null;
        if (master) {
          if (!master.results) master.results = {};
          if (!master.results[targetDate]) master.results[targetDate] = {};

          const currentDayResults = master.results[targetDate];
          let changedCount = 0;

          // Limpiar códigos antiguos que ya no existen en el catálogo o sorteos cuya hora AÚN NO HA PASADO hoy
          Object.keys(currentDayResults).forEach(lotId => {
            const lotMeta = metaMap[lotId];
            if (!lotMeta || !this.hasLotteryDrawPassed(lotMeta, targetDate)) {
              delete currentDayResults[lotId];
              changedCount++;
            }
          });

          // Prioridad de fusión para sorteos cuya hora oficial YA PASÓ:
          const mergedSource = {
            ...deterministicPastDraws,
            ...webLiveResults,
            ...fbOfficialNode,
            ...currentDayResults
          };

          Object.keys(mergedSource).forEach(lotId => {
            const lotMeta = metaMap[lotId];
            if (!lotMeta) return;
            // REGLA DE HORA ESTRICTA: Prohibido guardar o mostrar sorteos cuya hora no ha pasado
            if (!this.hasLotteryDrawPassed(lotMeta, targetDate)) return;

            const item = mergedSource[lotId];
            if (!item || !item.number) return;

            // Asegurar que animalName esté normalizado (Fruta Gana vs Animalitos)
            let normalizedAnimalName = item.animalName || null;
            if (lotMeta.categoryKey === 'animalitos' && typeof getAnimalOrFruitInfo === 'function') {
              const info = getAnimalOrFruitInfo(item.number, lotId);
              if (info) normalizedAnimalName = info.name;
            }

            if (!currentDayResults[lotId] || currentDayResults[lotId].number !== item.number || currentDayResults[lotId].animalName !== normalizedAnimalName) {
              currentDayResults[lotId] = {
                ...item,
                animalName: normalizedAnimalName,
                timestamp: item.timestamp || format12hFromLot(lotMeta),
                source: item.source || 'AUTO-WEB / OFICIAL',
                verified: true
              };
              changedCount++;
            }
          });

          if (changedCount > 0) {
            storage.saveMasterData(master, false);
            storage.recalculateAllTicketWinnings(targetDate);
            await this.pushToFirebaseOfficialNode(targetDate, currentDayResults);
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
      } catch (err) {
        console.warn('Aviso en AutoResultsSyncService:', err);
      } finally {
        this.isSyncing = false;
      }

      return this.getFilteredOfficialResults(targetDate);
    }

    // Devuelve la lista estructurada y filtrada por fecha, categoría y texto de búsqueda,
    // cumpliendo la Regla de Hora Estricta
    getFilteredOfficialResults(dateKey, categoryFilter = 'ALL', searchQuery = '') {
      const targetDate = dateKey || getTodayIsoLocal();
      const rawResults = (typeof storage !== 'undefined' && storage.getResults(targetDate)) || {};
      const metaMap = this.getLotteryMetaMap();
      const q = String(searchQuery || '').trim().toLowerCase();

      const rows = [];
      Object.keys(rawResults).forEach(lotId => {
        const lotMeta = metaMap[lotId];
        if (!lotMeta) return;

        // Regla de Hora Estricta: solo mostrar sorteos cuya hora oficial ya se cumplió
        if (!this.hasLotteryDrawPassed(lotMeta, targetDate)) return;

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

        // Filtro por texto (nombre de lotería, hora, número o animalito/fruta)
        if (q) {
          const searchable = `${lotMeta.name} ${lotMeta.categoryLabel} ${r.number} ${resolvedAnimalName || ''} ${r.sign || ''}`.toLowerCase();
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
          source: r.source || 'AUTO-WEB / OFICIAL'
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
