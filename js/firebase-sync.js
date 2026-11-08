// js/firebase-sync.js - Motor de Sincronización en Tiempo Real con Google Firebase
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"
// Soporta el SDK oficial de Firebase Realtime Database (WebSockets en vivo < 0.2s) y modo REST / EventSource directo con la URL de Firebase.

// ============================================================================
// CONFIGURACIÓN PREDEFINIDA DE FIREBASE (OPCIONAL PARA FIJAR EN GITHUB PAGES)
// Si pegas aquí la URL de tu Firebase Realtime Database, ninguna laptop tendrá
// que configurarla manualmente nunca más al abrir el link de GitHub.
// Ejemplo: databaseURL: "https://banca-fc-default-rtdb.firebaseio.com"
// ============================================================================
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "", // <-- Pega aquí tu URL de Firebase Realtime Database o configúrala desde el botón ☁️ Firebase en la pantalla
  projectId: ""
};

const FIREBASE_STORAGE_KEY = 'banca_fc_firebase_config';

class BancaFcFirebaseSync {
  constructor(storageMgr) {
    this.storage = storageMgr || (typeof storage !== 'undefined' ? storage : null);
    this.isConnected = false;
    this.isPushing = false;
    this.lastRemoteTimestamp = null;
    this.eventSource = null;
    this.pollTimer = null;
    this.init();
  }

  init() {
    // 1. Verificar si vienen parámetros de Firebase por URL (?fb=https://tu-proyecto.firebaseio.com)
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const fbUrlParam = params.get('fb') || params.get('firebase');
      if (fbUrlParam && fbUrlParam.includes('firebaseio.com') || (fbUrlParam && fbUrlParam.includes('firebasedatabase.app'))) {
        this.saveFirebaseConfig({ databaseURL: fbUrlParam.trim() });
      }
    }

    const cfg = this.getFirebaseConfig();
    if (cfg && cfg.databaseURL) {
      this.connect(cfg);
    } else {
      this.updateCloudStatusBadges('UNCONFIGURED');
    }
  }

  getFirebaseConfig() {
    try {
      const saved = localStorage.getItem(FIREBASE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.databaseURL) return parsed;
      }
    } catch (e) {}
    if (DEFAULT_FIREBASE_CONFIG.databaseURL) {
      return DEFAULT_FIREBASE_CONFIG;
    }
    return null;
  }

  saveFirebaseConfig(configInput) {
    let cleanConfig = { ...DEFAULT_FIREBASE_CONFIG };

    if (typeof configInput === 'string') {
      const raw = configInput.trim();
      // Detectar si el usuario pegó todo el bloque de código de Firebase (const firebaseConfig = { ... }) o un JSON
      const dbUrlMatch = raw.match(/databaseURL\s*:\s*["']([^"']+)["']/i) || raw.match(/(https:\/\/[a-z0-9-]+\.(?:firebaseio\.com|[\w.-]+\.firebasedatabase\.app))/i);
      const apiKeyMatch = raw.match(/apiKey\s*:\s*["']([^"']+)["']/i);
      const projectIdMatch = raw.match(/projectId\s*:\s*["']([^"']+)["']/i);

      if (dbUrlMatch) {
        cleanConfig.databaseURL = dbUrlMatch[1].replace(/\/+$/, '');
      } else if (raw.startsWith('http')) {
        cleanConfig.databaseURL = raw.replace(/\/+$/, '');
      }
      if (apiKeyMatch) cleanConfig.apiKey = apiKeyMatch[1];
      if (projectIdMatch) cleanConfig.projectId = projectIdMatch[1];
    } else if (configInput && typeof configInput === 'object') {
      cleanConfig = { ...cleanConfig, ...configInput };
      if (cleanConfig.databaseURL) {
        cleanConfig.databaseURL = cleanConfig.databaseURL.trim().replace(/\/+$/, '');
      }
    }

    if (!cleanConfig.databaseURL) {
      localStorage.removeItem(FIREBASE_STORAGE_KEY);
      this.disconnect();
      this.updateCloudStatusBadges('UNCONFIGURED');
      return null;
    }

    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(cleanConfig));
    this.connect(cleanConfig);
    return cleanConfig;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
  }

  getDatabaseEndpoint(path = '/banca_fc_master.json') {
    const cfg = this.getFirebaseConfig();
    if (!cfg || !cfg.databaseURL) return null;
    const base = cfg.databaseURL.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  // Conecta en tiempo real con Firebase Realtime Database (Server-Sent Events + Fetch)
  async connect(cfg) {
    this.disconnect();
    if (!cfg || !cfg.databaseURL) return;

    this.updateCloudStatusBadges('CONNECTING');

    // 1. Hacer lectura inicial desde Firebase
    const ok = await this.pullAndMergeFromFirebase(true);
    if (ok) {
      this.isConnected = true;
      this.updateCloudStatusBadges('CONNECTED');
    }

    // 2. Suscripción en Tiempo Real Instantánea (Server-Sent Events nativos de Firebase Realtime DB)
    const endpoint = this.getDatabaseEndpoint('/banca_fc_master.json');
    if (endpoint && typeof window.EventSource !== 'undefined') {
      try {
        this.eventSource = new EventSource(endpoint);
        this.eventSource.addEventListener('put', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.data) {
              this.handleIncomingCloudData(payload.data);
            }
          } catch (err) {}
        });
        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.updateCloudStatusBadges('CONNECTED');
        };
        this.eventSource.onerror = () => {
          // Si EventSource no es soportado por reglas o navegador, el polling de respaldo mantiene la sincronización
        };
      } catch (e) {}
    }

    // 3. Respaldo de sincronización continua cada 2.5 segundos
    this.pollTimer = setInterval(() => {
      this.pullAndMergeFromFirebase(false);
    }, 2500);
  }

  // Descarga el estado de Firebase y lo fusiona inteligentemente con la laptop local
  async pullAndMergeFromFirebase(isInitialConnect = false) {
    const endpoint = this.getDatabaseEndpoint('/banca_fc_master.json');
    if (!endpoint || this.isPushing) return false;

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        this.updateCloudStatusBadges('ERROR');
        return false;
      }

      const cloudData = await response.json();
      this.isConnected = true;
      this.updateCloudStatusBadges('CONNECTED');

      // Si la base de datos en Firebase está vacía por primera vez, subir los datos actuales de esta laptop
      if (!cloudData || (!cloudData.agencies && !cloudData.tickets)) {
        if (this.storage) {
          await this.pushMasterData(this.storage.getMasterData(), true);
        }
        return true;
      }

      this.handleIncomingCloudData(cloudData, isInitialConnect);
      return true;
    } catch (err) {
      this.updateCloudStatusBadges('ERROR');
      return false;
    }
  }

  handleIncomingCloudData(cloudData, forceRefresh = false) {
    if (!cloudData || !this.storage) return;
    if (!forceRefresh && cloudData.updatedAt && cloudData.updatedAt === this.lastRemoteTimestamp) {
      return;
    }

    const localData = this.storage.getMasterData();
    const merged = this.mergeLocalAndCloud(localData, cloudData);

    const hasChanges =
      JSON.stringify(localData.tickets || []) !== JSON.stringify(merged.tickets || []) ||
      JSON.stringify(localData.agencies || []) !== JSON.stringify(merged.agencies || []) ||
      JSON.stringify(localData.results || {}) !== JSON.stringify(merged.results || {}) ||
      JSON.stringify(localData.collectors || []) !== JSON.stringify(merged.collectors || []);

    this.lastRemoteTimestamp = cloudData.updatedAt;

    if (hasChanges || forceRefresh) {
      localStorage.setItem('banca_fc_data', JSON.stringify(merged));
      this.storage.syncLegacyKeysFromMaster(merged);
      window.dispatchEvent(new CustomEvent('banca_fc_data_updated', { detail: merged }));
    }
  }

  // Fusiona los datos de Firebase y los locales respetando reinicios en cero y nuevos tickets
  mergeLocalAndCloud(localDb, cloudDb) {
    // Si la nube tiene una orden explícita de reinicio más reciente que los datos locales, obedecer a la nube
    if (cloudDb.lastResetTimestamp && (!localDb.lastResetTimestamp || cloudDb.lastResetTimestamp > localDb.lastResetTimestamp)) {
      return {
        ...localDb,
        ...cloudDb,
        tickets: cloudDb.tickets || [],
        agencies: cloudDb.agencies || localDb.agencies || [],
        collectors: cloudDb.collectors || localDb.collectors || [],
        results: cloudDb.results || {}
      };
    }

    const merged = { ...localDb, ...cloudDb };

    // 1. Agencias (Priorizar la lista de la nube si fue actualizada más recientemente)
    const cloudNewer = !localDb.updatedAt || (cloudDb.updatedAt && cloudDb.updatedAt >= localDb.updatedAt);
    if (cloudNewer && Array.isArray(cloudDb.agencies)) {
      merged.agencies = cloudDb.agencies;
    } else {
      const agMap = new Map();
      (localDb.agencies || []).forEach(a => agMap.set(String(a.code), a));
      (cloudDb.agencies || []).forEach(a => agMap.set(String(a.code), a));
      merged.agencies = Array.from(agMap.values());
    }

    // 2. Cobradores
    if (cloudNewer && Array.isArray(cloudDb.collectors)) {
      merged.collectors = cloudDb.collectors;
    } else {
      merged.collectors = Array.from(new Set([...(localDb.collectors || []), ...(cloudDb.collectors || [])]));
    }

    // 3. Tickets: unir los tickets emitidos en todas las laptops por su serial único
    const ticketMap = new Map();
    const getKey = (t) => `${t.serialSeguridad || t.ticketId}_${t.agencyCode || t.usuario || '1000'}`;

    (cloudDb.tickets || []).forEach(t => ticketMap.set(getKey(t), t));
    (localDb.tickets || []).forEach(t => {
      const key = getKey(t);
      const inCloud = ticketMap.get(key);
      if (!inCloud) {
        // Si la nube no fue reiniciada después de este ticket, conservarlo
        if (!cloudDb.lastResetTimestamp) {
          ticketMap.set(key, t);
        }
      } else {
        const rank = { 'ACTIVO': 1, 'GANADOR': 2, 'PAGADO': 3, 'ANULADO': 4 };
        const cRank = rank[inCloud.estado] || 1;
        const lRank = rank[t.estado] || 1;
        ticketMap.set(key, cRank >= lRank ? { ...t, ...inCloud } : { ...inCloud, ...t });
      }
    });

    merged.tickets = Array.from(ticketMap.values()).sort((a, b) => Number(b.ticketId || 0) - Number(a.ticketId || 0));

    // 4. Resultados
    const mergedResults = { ...(localDb.results || {}) };
    for (const [dateKey, resObj] of Object.entries(cloudDb.results || {})) {
      mergedResults[dateKey] = { ...(mergedResults[dateKey] || {}), ...resObj };
    }
    merged.results = mergedResults;

    // 5. Correlativo siguiente
    const maxNext = Math.max(
      Number(localDb.config?.nextTicketNumber || 1),
      Number(cloudDb.config?.nextTicketNumber || 1)
    );
    if (merged.config) {
      merged.config.nextTicketNumber = maxNext;
    }

    return merged;
  }

  // Sube inmediatamente a Firebase cualquier cambio (nuevo ticket, anulación, nueva agencia, reinicio en cero)
  async pushMasterData(localMasterData, forceOverwriteCloud = false) {
    const endpoint = this.getDatabaseEndpoint('/banca_fc_master.json');
    if (!endpoint) return false;

    this.isPushing = true;
    try {
      let dataToSave = { ...localMasterData };
      if (forceOverwriteCloud) {
        dataToSave.lastResetTimestamp = new Date().toISOString();
      } else {
        // Leer primero de Firebase para no pisar un ticket que otra taquilla haya emitido en el mismo segundo
        try {
          const getRes = await fetch(endpoint, { cache: 'no-store' });
          if (getRes.ok) {
            const currentCloud = await getRes.json();
            if (currentCloud && Array.isArray(currentCloud.tickets)) {
              dataToSave = this.mergeLocalAndCloud(localMasterData, currentCloud);
              // Asegurar que prevalezcan las agencias/cobradores locales recién editados
              dataToSave.agencies = localMasterData.agencies;
              dataToSave.collectors = localMasterData.collectors;
              dataToSave.results = localMasterData.results;
              dataToSave.config = localMasterData.config;
            }
          }
        } catch (e) {}
      }

      dataToSave.updatedAt = new Date().toISOString();
      this.lastRemoteTimestamp = dataToSave.updatedAt;

      const putRes = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (putRes.ok) {
        this.isConnected = true;
        this.updateCloudStatusBadges('CONNECTED');
        localStorage.setItem('banca_fc_data', JSON.stringify(dataToSave));
        if (this.storage) {
          this.storage.syncLegacyKeysFromMaster(dataToSave);
        }
        return true;
      } else {
        this.updateCloudStatusBadges('ERROR');
      }
    } catch (err) {
      this.updateCloudStatusBadges('ERROR');
    } finally {
      this.isPushing = false;
    }
    return false;
  }

  // Genera un enlace directo que ya lleva la conexión de Firebase incrustada para abrirlo en cualquier otra laptop
  getShareablePosLink() {
    const cfg = this.getFirebaseConfig();
    const baseUrl = window.location.href.split('?')[0].replace(/admin\.html$/i, 'index.html');
    if (cfg && cfg.databaseURL) {
      return `${baseUrl}?fb=${encodeURIComponent(cfg.databaseURL)}`;
    }
    return baseUrl;
  }

  updateCloudStatusBadges(status) {
    const adminBadge = document.getElementById('header-firebase-status-badge');
    const posBadge = document.getElementById('pos-firebase-status-badge');
    const modalBadge = document.getElementById('net-server-status-badge');

    let text = '☁️ Configurar Firebase';
    let adminClass = 'px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition';

    if (status === 'CONNECTED') {
      text = '☁️ Firebase Conectado En Vivo';
      adminClass = 'px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition';
    } else if (status === 'CONNECTING') {
      text = '☁️ Conectando a Firebase...';
    } else if (status === 'ERROR') {
      text = '⚠️ Error Firebase (Revisar URL/Reglas)';
      adminClass = 'px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-600 text-xs font-bold transition';
    }

    if (adminBadge) {
      adminBadge.textContent = text;
      adminBadge.className = adminClass;
    }
    if (posBadge) {
      posBadge.textContent = status === 'CONNECTED' ? '☁️ NUBE FIREBASE ACTIVA' : '☁️ CONFIGURAR NUBE';
      posBadge.style.color = status === 'CONNECTED' ? '#15803d' : '#b45309';
    }
    if (modalBadge) {
      if (status === 'CONNECTED') {
        modalBadge.className = 'badge-pill badge-activa';
        modalBadge.textContent = '🟢 FIREBASE CONECTADO EN VIVO';
      } else if (status === 'ERROR') {
        modalBadge.className = 'badge-pill badge-suspendida';
        modalBadge.textContent = '🔴 ERROR DE CONEXIÓN FIREBASE';
      } else {
        modalBadge.className = 'badge-pill badge-ganador';
        modalBadge.textContent = 'PENDIENTE PEGAR URL FIREBASE';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.bancaFcCloud = new BancaFcFirebaseSync(typeof storage !== 'undefined' ? storage : null);
}
