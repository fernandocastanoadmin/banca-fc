// js/firebase-sync.js - Motor de Sincronización en Tiempo Real con Google Firebase
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"
// Conectado por defecto a: https://banca-fc-castano-default-rtdb.firebaseio.com

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "banca-fc-castano.firebaseapp.com",
  databaseURL: "https://banca-fc-castano-default-rtdb.firebaseio.com",
  projectId: "banca-fc-castano"
};

const FIREBASE_STORAGE_KEY = 'banca_fc_firebase_config';

class BancaFcFirebaseSync {
  constructor(storageMgr) {
    this.storage = storageMgr || (typeof storage !== 'undefined' ? storage : null);
    this.isConnected = false;
    this.isPushing = false;
    this.lastRemoteTimestamp = null;
    this.lastError = null;
    this.eventSource = null;
    this.pollTimer = null;
    this.init();
  }

  get databaseURL() {
    const cfg = this.getFirebaseConfig();
    return (cfg && cfg.databaseURL) ? cfg.databaseURL : DEFAULT_FIREBASE_CONFIG.databaseURL;
  }

  isConfigured() {
    const cfg = this.getFirebaseConfig();
    return Boolean(cfg && cfg.databaseURL);
  }

  init() {
    // 1. Verificar si vienen parámetros de Firebase por URL (?fb=https://tu-proyecto.firebaseio.com)
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const fbUrlParam = params.get('fb') || params.get('firebase');
      if (fbUrlParam && (fbUrlParam.includes('firebaseio.com') || fbUrlParam.includes('firebasedatabase.app'))) {
        const cleanUrl = fbUrlParam.trim().replace(/\/+$/, '');
        localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify({
          ...DEFAULT_FIREBASE_CONFIG,
          databaseURL: cleanUrl
        }));
      }
    }

    const cfg = this.getFirebaseConfig();
    if (cfg && cfg.databaseURL) {
      // Conectar automáticamente al cargar la página
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.connect(cfg));
      } else {
        this.connect(cfg);
      }
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
      return { ...DEFAULT_FIREBASE_CONFIG };
    }
    return null;
  }

  parseFirebaseUrlInput(configInput) {
    let cleanConfig = { ...DEFAULT_FIREBASE_CONFIG };

    if (typeof configInput === 'string') {
      const raw = configInput.trim();
      const dbUrlMatch =
        raw.match(/databaseURL\s*:\s*["']([^"']+)["']/i) ||
        raw.match(/(https:\/\/[a-z0-9-]+\.(?:firebaseio\.com|[\w.-]+\.firebasedatabase\.app))/i);
      const apiKeyMatch = raw.match(/apiKey\s*:\s*["']([^"']+)["']/i);
      const projectIdMatch = raw.match(/projectId\s*:\s*["']([^"']+)["']/i);

      if (dbUrlMatch) {
        cleanConfig.databaseURL = dbUrlMatch[1].replace(/\/+$/, '');
      } else if (raw.startsWith('http')) {
        cleanConfig.databaseURL = raw.replace(/\/+$/, '').replace(/\/banca_fc_master\.json$/i, '');
      } else {
        cleanConfig.databaseURL = '';
      }
      if (apiKeyMatch) cleanConfig.apiKey = apiKeyMatch[1];
      if (projectIdMatch) cleanConfig.projectId = projectIdMatch[1];
    } else if (configInput && typeof configInput === 'object') {
      cleanConfig = { ...cleanConfig, ...configInput };
      if (cleanConfig.databaseURL) {
        cleanConfig.databaseURL = cleanConfig.databaseURL.trim().replace(/\/+$/, '');
      }
    }

    return cleanConfig;
  }

  // Método principal invocado por el botón "Guardar y Conectar con Firebase Ahora"
  async saveConfig(configInput) {
    const cleanConfig = this.parseFirebaseUrlInput(configInput);
    if (!cleanConfig.databaseURL) {
      return {
        ok: false,
        error: 'La URL ingresada no es válida. Debe comenzar con https:// y terminar en .firebaseio.com o .firebasedatabase.app'
      };
    }

    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(cleanConfig));
    const connected = await this.connect(cleanConfig);
    if (connected) {
      return { ok: true, databaseURL: cleanConfig.databaseURL };
    }
    return {
      ok: false,
      error: this.lastError || 'No se pudo leer ni escribir en Firebase. Verifique que Realtime Database tenga las Reglas en Modo de Prueba (.read: true, .write: true).'
    };
  }

  saveFirebaseConfig(configInput) {
    this.saveConfig(configInput);
    return this.getFirebaseConfig();
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
    this.updateCloudStatusBadges('UNCONFIGURED');
  }

  getDatabaseEndpoint(path = '/banca_fc_master.json') {
    const cfg = this.getFirebaseConfig();
    if (!cfg || !cfg.databaseURL) return null;
    const base = cfg.databaseURL.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  // Conecta en tiempo real con Firebase Realtime Database (Server-Sent Events + Fetch)
  async connect(cfg) {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    const activeCfg = cfg || this.getFirebaseConfig();
    if (!activeCfg || !activeCfg.databaseURL) {
      this.updateCloudStatusBadges('UNCONFIGURED');
      return false;
    }

    this.updateCloudStatusBadges('CONNECTING');

    // 1. Hacer lectura/escritura inicial desde Firebase
    const ok = await this.pullAndMergeFromFirebase(true);
    if (ok) {
      this.isConnected = true;
      this.updateCloudStatusBadges('CONNECTED');
    } else {
      this.updateCloudStatusBadges('ERROR');
      return false;
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
          // El polling cada 2.5s mantiene la sincronización activa si SSE se reinicia
        };
      } catch (e) {}
    }

    // 3. Respaldo de sincronización continua cada 2.5 segundos
    this.pollTimer = setInterval(() => {
      this.pullAndMergeFromFirebase(false);
    }, 2500);

    return true;
  }

  async pullAndMergeFromCloud() {
    return await this.pullAndMergeFromFirebase(true);
  }

  // Descarga el estado de Firebase y lo fusiona inteligentemente con la laptop local
  async pullAndMergeFromFirebase(isInitialConnect = false) {
    const endpoint = this.getDatabaseEndpoint('/banca_fc_master.json');
    if (!endpoint || this.isPushing) return false;

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) errDetail = errJson.error;
        } catch (e) {}
        this.lastError = `Firebase respondió: ${errDetail}. En Firebase Console → Realtime Database → Reglas, asegúrese de tener ".read": true y ".write": true.`;
        this.updateCloudStatusBadges('ERROR');
        return false;
      }

      const cloudData = await response.json();
      this.isConnected = true;
      this.lastError = null;
      this.updateCloudStatusBadges('CONNECTED');

      // Si la base de datos en Firebase está en null (recién creada), subir los datos actuales de esta laptop
      if (!cloudData || (!cloudData.agencies && !cloudData.tickets)) {
        if (this.storage) {
          await this.pushMasterData(this.storage.getMasterData(), true);
        }
        return true;
      }

      this.handleIncomingCloudData(cloudData, isInitialConnect);
      return true;
    } catch (err) {
      this.lastError = err.message || 'Error de red al conectar con Firebase.';
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

    const mergedResults = { ...(localDb.results || {}) };
    for (const [dateKey, resObj] of Object.entries(cloudDb.results || {})) {
      mergedResults[dateKey] = { ...(mergedResults[dateKey] || {}), ...resObj };
    }
    merged.results = mergedResults;

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
        try {
          const getRes = await fetch(endpoint, { cache: 'no-store' });
          if (getRes.ok) {
            const currentCloud = await getRes.json();
            if (currentCloud && Array.isArray(currentCloud.tickets)) {
              dataToSave = this.mergeLocalAndCloud(localMasterData, currentCloud);
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

  getShareablePosUrl() {
    const cfg = this.getFirebaseConfig();
    let baseUrl = window.location.href.split('?')[0];
    baseUrl = baseUrl.replace(/\/admin(\.html)?$/i, '/index.html');
    if (cfg && cfg.databaseURL) {
      return `${baseUrl}?fb=${encodeURIComponent(cfg.databaseURL)}`;
    }
    return baseUrl;
  }

  getShareablePosLink() {
    return this.getShareablePosUrl();
  }

  updateCloudStatusBadges(status) {
    const adminBadge = document.getElementById('header-firebase-status-badge');
    const posBadge = document.getElementById('pos-firebase-status-badge');
    const modalBadge = document.getElementById('fb-modal-status-badge');

    let text = '☁️ Configurar Firebase';
    let adminClass = 'badge-pill badge-ganador cursor-pointer';

    if (status === 'CONNECTED') {
      text = '🟢 Firebase Conectado En Vivo';
      adminClass = 'badge-pill badge-activa cursor-pointer';
    } else if (status === 'CONNECTING') {
      text = '⏳ Conectando Firebase...';
      adminClass = 'badge-pill badge-ganador cursor-pointer';
    } else if (status === 'ERROR') {
      text = '🔴 Error Firebase (Ver Reglas)';
      adminClass = 'badge-pill badge-suspendida cursor-pointer';
    }

    if (adminBadge) {
      adminBadge.textContent = text;
      adminBadge.className = adminClass;
    }
    if (posBadge) {
      posBadge.textContent = status === 'CONNECTED' ? '🟢 NUBE FIREBASE ACTIVA' : (status === 'CONNECTING' ? '⏳ CONECTANDO NUBE...' : '☁️ CONFIGURAR NUBE');
      posBadge.style.color = status === 'CONNECTED' ? '#15803d' : '#b45309';
    }
    if (modalBadge) {
      if (status === 'CONNECTED') {
        modalBadge.className = 'badge-pill badge-activa';
        modalBadge.textContent = '🟢 FIREBASE CONECTADO EN VIVO';
      } else if (status === 'ERROR') {
        modalBadge.className = 'badge-pill badge-suspendida';
        modalBadge.textContent = '🔴 ERROR DE CONEXIÓN';
      } else if (status === 'CONNECTING') {
        modalBadge.className = 'badge-pill badge-ganador';
        modalBadge.textContent = '⏳ CONECTANDO...';
      } else {
        modalBadge.className = 'badge-pill badge-suspendida';
        modalBadge.textContent = 'Sin configurar';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.bancaFcCloud = new BancaFcFirebaseSync(typeof storage !== 'undefined' ? storage : null);
}
