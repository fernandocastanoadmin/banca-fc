// js/server-clock.js - Motor de Hora Oficial del Servidor (Anti-Manipulación de Reloj)
// Sistema "Banca El Castaño (Seguro Te Paga)"
// Obtiene la hora real UTC desde Google Firebase ({".sv": "timestamp"}) o Servidor LAN (/api/server-time),
// avanza mediante reloj monotónico (performance.now) inmune a retrocesos de Windows/Android,
// convierte siempre a zona horaria fija oficial America/Caracas (UTC-04:00),
// y bloquea ventas si el reloj del dispositivo está adulterado (> 2 min de desfase) o sin verificar.

(function (global) {
  'use strict';

  const OFFICIAL_TIMEZONE = 'America/Caracas';
  const MAX_DEVICE_DRIFT_MS = 120000;   // 2 minutos máx. de diferencia entre reloj del PC/Móvil y Servidor
  const TICKET_AUDIT_DRIFT_MS = 180000; // 3 minutos máx. de tolerancia en auditoría de fechaHora vs serverCreatedAt
  const AUTO_RESYNC_MS = 30000;         // Re-sincronizar cada 30 segundos en segundo plano
  const DEFAULT_FIREBASE_DB_URL = 'https://banca-fc-castano-default-rtdb.firebaseio.com';
  const DEVICE_CLOCK_ID_KEY = 'banca_fc_device_clock_id';
  const FIREBASE_CFG_KEY = 'banca_fc_firebase_config';

  const caracasPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICIAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function nowMonotonicMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  class BancaFcServerClock {
    constructor() {
      this.isVerified = false;
      this.lastServerUtcMs = null;
      this.lastSyncPerfMs = null;
      this.lastSyncDeviceUtcMs = null;
      this.lastSyncSource = null;
      this.lastSyncError = null;
      this.tamperedDetected = false;
      this.lastDriftMs = 0;
      this.syncInFlight = null;
      this.lastAlertSentAt = 0;
      this.clientId = this.getOrCreateDeviceId();
    }

    getOrCreateDeviceId() {
      try {
        if (typeof localStorage !== 'undefined') {
          let id = localStorage.getItem(DEVICE_CLOCK_ID_KEY);
          if (id && /^[a-z0-9_-]{6,40}$/i.test(id)) return id;
          id = `dev_${Math.random().toString(36).slice(2, 10)}`;
          localStorage.setItem(DEVICE_CLOCK_ID_KEY, id);
          return id;
        }
      } catch (_) {}
      return `dev_${Math.random().toString(36).slice(2, 10)}`;
    }

    getActiveDatabaseUrl() {
      if (global.bancaFcCloud && global.bancaFcCloud.databaseURL) {
        return String(global.bancaFcCloud.databaseURL).replace(/\/+$/, '');
      }
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(FIREBASE_CFG_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.databaseURL) {
              return String(parsed.databaseURL).trim().replace(/\/+$/, '');
            }
          }
        }
      } catch (_) {}
      return DEFAULT_FIREBASE_DB_URL;
    }

    getVerifiedUtcMs() {
      if (!this.isVerified || this.lastServerUtcMs === null || this.lastSyncPerfMs === null) {
        return null;
      }
      const elapsed = Math.max(0, nowMonotonicMs() - this.lastSyncPerfMs);
      return Math.round(this.lastServerUtcMs + elapsed);
    }

    // Evalúa diferencia entre reloj local del sistema (Date.now()) y reloj oficial del servidor
    evaluateDeviceDrift() {
      const serverUtcMs = this.getVerifiedUtcMs();
      if (serverUtcMs === null) {
        this.lastDriftMs = 0;
        this.tamperedDetected = false;
        return { verified: false, driftMs: 0, tampered: false };
      }
      const driftMs = Date.now() - serverUtcMs;
      this.lastDriftMs = driftMs;
      this.tamperedDetected = Math.abs(driftMs) > MAX_DEVICE_DRIFT_MS;
      return { verified: true, driftMs, tampered: this.tamperedDetected, serverUtcMs };
    }

    isDeviceClockTampered() {
      return this.evaluateDeviceDrift().tampered;
    }

    // Convierte epoch UTC (ms) en componentes exactos de America/Caracas (UTC-04:00)
    getOfficialParts(utcMs) {
      const targetMs = typeof utcMs === 'number' && !isNaN(utcMs) ? utcMs : Date.now();
      const rawParts = caracasPartsFormatter.formatToParts(new Date(targetMs));
      const map = {};
      for (const p of rawParts) {
        if (p.type !== 'literal') map[p.type] = p.value;
      }
      const year = parseInt(map.year, 10);
      const month = parseInt(map.month, 10);
      const day = parseInt(map.day, 10);
      const hour24 = parseInt(map.hour, 10) % 24;
      const minute = parseInt(map.minute, 10);
      const second = parseInt(map.second, 10);
      const dayOfWeek = WEEKDAY_MAP[map.weekday] !== undefined ? WEEKDAY_MAP[map.weekday] : 0;

      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const isoDate = `${year}-${mm}-${dd}`;
      const dateDDMMYYYY = `${dd}/${mm}/${year}`;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      const h12 = hour24 % 12 || 12;
      const minStr = String(minute).padStart(2, '0');
      const secStr = String(second).padStart(2, '0');

      return {
        utcMs: targetMs,
        year,
        month,
        day,
        hour24,
        minute,
        second,
        dayOfWeek,
        isoDate,
        dateDDMMYYYY,
        formatted12h: `${dateDDMMYYYY} ${h12}:${minStr}:${secStr} ${ampm}`,
        time12h: `${h12}:${minStr}:${secStr} ${ampm}`,
        formatted24h: `${String(hour24).padStart(2, '0')}:${minStr}:${secStr}`
      };
    }

    formatDateTime12h(utcMs) {
      return this.getOfficialParts(utcMs).formatted12h;
    }

    getOfficialNow() {
      const verifiedUtcMs = this.getVerifiedUtcMs();
      if (verifiedUtcMs === null) {
        return {
          ...this.getOfficialParts(Date.now()),
          verified: false,
          tampered: false
        };
      }
      const drift = this.evaluateDeviceDrift();
      return {
        ...this.getOfficialParts(verifiedUtcMs),
        verified: true,
        tampered: drift.tampered,
        driftMs: drift.driftMs
      };
    }

    // Parsea fechaHora "DD/MM/YYYY h:mm:ss AM/PM" interpretándola en UTC-04:00 (America/Caracas)
    parseDateTime12hToUtcMs(fechaHoraStr) {
      const s = String(fechaHoraStr || '').trim();
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if (!m) return null;
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const yyyy = parseInt(m[3], 10);
      let hr = parseInt(m[4], 10);
      const min = parseInt(m[5], 10);
      const sec = parseInt(m[6] || '0', 10);
      const ampm = (m[7] || '').toUpperCase();
      if (ampm === 'PM' && hr < 12) hr += 12;
      if (ampm === 'AM' && hr === 12) hr = 0;
      // Venezuela (America/Caracas) es UTC-04:00 fijo sin horario de verano
      return Date.UTC(yyyy, mm - 1, dd, hr + 4, min, sec, 0);
    }

    // Calcula el epoch UTC exacto del cierre oficial de un sorteo (ej: -5 min antes de drawHour24:drawMinute UTC-4)
    getDrawCutoffUtcMs(dateIso, drawHour24, drawMinute = 0, cutoffMinutes = 5) {
      const m = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      const drawUtcMs = Date.UTC(y, mo - 1, d, Number(drawHour24) + 4, Number(drawMinute || 0), 0, 0);
      return drawUtcMs - (Number(cutoffMinutes) * 60000);
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
      if (typeof fetch !== 'function') {
        throw new Error('fetch no disponible');
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        return await fetch(url, {
          ...options,
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async syncServerTime({ force = false, databaseURL = null } = {}) {
      const elapsedSinceSync = this.lastSyncPerfMs !== null ? (nowMonotonicMs() - this.lastSyncPerfMs) : Infinity;
      if (!force && this.isVerified && elapsedSinceSync < 15000) {
        return { ok: true, serverMs: this.getVerifiedUtcMs(), source: this.lastSyncSource, cached: true };
      }

      if (this.syncInFlight) {
        return this.syncInFlight;
      }

      this.syncInFlight = (async () => {
        const dbUrl = (databaseURL || this.getActiveDatabaseUrl() || '').replace(/\/+$/, '');
        let serverMs = null;
        let source = null;
        let lastErr = null;

        // 1. Fuente Primaria: Google Firebase ServerValue.TIMESTAMP ({"sv": "timestamp"})
        if (dbUrl && dbUrl.startsWith('https://')) {
          try {
            const pingUrl = `${dbUrl}/banca_fc_server_clock/${encodeURIComponent(this.clientId)}.json`;
            const tReqStart = nowMonotonicMs();
            const res = await this.fetchWithTimeout(pingUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serverMs: { '.sv': 'timestamp' } })
            }, 5500);

            if (res.ok) {
              const payload = await res.json();
              const rttHalf = Math.min(2000, Math.max(0, (nowMonotonicMs() - tReqStart) / 2));
              if (payload && typeof payload.serverMs === 'number' && isFinite(payload.serverMs)) {
                serverMs = Math.round(payload.serverMs + rttHalf);
                source = 'FIREBASE_SERVER';
              }
            } else {
              lastErr = `Firebase HTTP ${res.status}`;
            }
          } catch (e) {
            lastErr = e && e.message ? e.message : 'Error consultando Firebase';
          }
        }

        // 2. Respaldo LAN: Servidor Node local (/api/server-time) cuando existe
        if (serverMs === null && typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io')) {
          try {
            const tReqStart = nowMonotonicMs();
            const lanRes = await this.fetchWithTimeout('/api/server-time', { method: 'GET' }, 3000);
            if (lanRes.ok) {
              const lanJson = await lanRes.json();
              const rttHalf = Math.min(1000, Math.max(0, (nowMonotonicMs() - tReqStart) / 2));
              if (lanJson && typeof lanJson.serverMs === 'number' && isFinite(lanJson.serverMs)) {
                serverMs = Math.round(lanJson.serverMs + rttHalf);
                source = 'LAN_SERVER';
              }
            }
          } catch (e) {
            lastErr = lastErr || (e && e.message) || 'Error consultando servidor LAN';
          }
        }

        if (serverMs !== null) {
          this.lastServerUtcMs = serverMs;
          this.lastSyncPerfMs = nowMonotonicMs();
          this.lastSyncDeviceUtcMs = Date.now();
          this.lastSyncSource = source;
          this.lastSyncError = null;
          this.isVerified = true;
          const drift = this.evaluateDeviceDrift();

          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('banca_fc_server_clock_updated', {
              detail: {
                verified: true,
                serverMs,
                source,
                tampered: drift.tampered,
                driftMs: drift.driftMs
              }
            }));
          }

          return { ok: true, serverMs, source, tampered: drift.tampered, driftMs: drift.driftMs };
        }

        this.lastSyncError = lastErr || 'Sin conexión para verificar hora oficial';
        return { ok: false, error: this.lastSyncError };
      })();

      try {
        return await this.syncInFlight;
      } finally {
        this.syncInFlight = null;
      }
    }

    // Sella un ticket recién emitido en el nodo inmutable /banca_fc_ticket_stamps de Firebase
    async stampTicketInFirebase(ticket, databaseURL = null) {
      const dbUrl = (databaseURL || this.getActiveDatabaseUrl() || '').replace(/\/+$/, '');
      if (!ticket || !ticket.ticketId) {
        return { ok: false, error: 'Ticket inválido para sellado.' };
      }
      const cleanSerial = String(ticket.serialSeguridad || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
      const stampKey = `${String(ticket.ticketId).trim()}_${cleanSerial}`;

      if (dbUrl && dbUrl.startsWith('https://')) {
        try {
          const url = `${dbUrl}/banca_fc_ticket_stamps/${encodeURIComponent(stampKey)}.json`;
          const res = await this.fetchWithTimeout(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketId: String(ticket.ticketId),
              stampKey,
              agencyCode: String(ticket.agencyCode || ''),
              clientFechaHora: String(ticket.fechaHora || ''),
              clientDeviceEpochMs: Date.now(),
              serverCreatedAt: { '.sv': 'timestamp' }
            })
          }, 6000);
          if (res.ok) {
            const payload = await res.json();
            if (payload && typeof payload.serverCreatedAt === 'number' && isFinite(payload.serverCreatedAt)) {
              this.lastServerUtcMs = payload.serverCreatedAt;
              this.lastSyncPerfMs = nowMonotonicMs();
              this.isVerified = true;
              return {
                ok: true,
                stampKey,
                serverCreatedAt: payload.serverCreatedAt,
                source: 'FIREBASE_STAMP'
              };
            }
          }
          return { ok: false, error: `Error Firebase Stamp HTTP ${res.status}` };
        } catch (e) {
          return { ok: false, error: e && e.message ? e.message : 'Error de red sellando ticket en Firebase' };
        }
      }

      // Fallback solo LAN
      if (this.lastSyncSource === 'LAN_SERVER' && this.isVerified) {
        const lanUtc = this.getVerifiedUtcMs();
        if (lanUtc !== null) {
          return { ok: true, stampKey, serverCreatedAt: lanUtc, source: 'LAN_STAMP' };
        }
      }

      return { ok: false, error: 'Sin servidor oficial para sellar ticket' };
    }

    async reportTamperAlert(agencyCode, details = {}) {
      const now = Date.now();
      if (now - this.lastAlertSentAt < 60000) return;
      const dbUrl = (this.getActiveDatabaseUrl() || '').replace(/\/+$/, '');
      if (!dbUrl || !dbUrl.startsWith('https://')) return;
      this.lastAlertSentAt = now;
      try {
        const code = String(agencyCode || 'DESCONOCIDA').replace(/[^a-zA-Z0-9_-]/g, '_');
        await this.fetchWithTimeout(`${dbUrl}/banca_fc_security_alerts/${encodeURIComponent(code)}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agencyCode: String(agencyCode || ''),
            deviceTimeIso: new Date().toISOString(),
            serverTimeIso: details.serverMs ? new Date(details.serverMs).toISOString() : null,
            driftMinutes: Math.round((Math.abs(details.driftMs || 0)) / 60000),
            detectedAtServerMs: { '.sv': 'timestamp' }
          })
        }, 4000);
      } catch (_) {}
    }

    // Auditoría estricta de validez temporal de una jugada en un ticket (para liquidación Admin/Principal/POS)
    verifyTicketPlayTiming(ticket, play, lot, config = {}) {
      if (!ticket) return { valid: false, blocked: true, reason: 'Ticket inválido' };

      const serverTs = Number(ticket.serverCreatedAt);
      const hasServerTs = Number.isFinite(serverTs) && serverTs > 1700000000000;

      if (ticket.clockAuditBlocked === true) {
        return {
          valid: false,
          blocked: true,
          reason: ticket.clockAuditReason || 'Ticket bloqueado por manipulación de reloj'
        };
      }

      if (hasServerTs) {
        const serverParts = this.getOfficialParts(serverTs);

        // 1. Verificar fecha/hora reportada vs hora real sellada en servidor
        const reportedMs = this.parseDateTime12hToUtcMs(ticket.fechaHora);
        if (reportedMs !== null) {
          if (this.getOfficialParts(reportedMs).isoDate !== serverParts.isoDate) {
            return {
              valid: false,
              blocked: true,
              reason: `Fecha reportada (${this.getOfficialParts(reportedMs).dateDDMMYYYY}) distinta a la fecha real del servidor (${serverParts.dateDDMMYYYY})`
            };
          }
          if (Math.abs(reportedMs - serverTs) > TICKET_AUDIT_DRIFT_MS) {
            return {
              valid: false,
              blocked: true,
              reason: `Hora reportada (${ticket.fechaHora}) difiere de la hora real del servidor (${serverParts.formatted12h})`
            };
          }
        }

        // 2. Verificar que el ticket se haya emitido estrictamente ANTES del cierre oficial (-5 min) del sorteo
        if (lot && typeof lot.drawHour24 === 'number') {
          const cutoffMs = this.getDrawCutoffUtcMs(serverParts.isoDate, lot.drawHour24, lot.drawMinute || 0, 5);
          if (cutoffMs !== null && serverTs > cutoffMs) {
            const cutoffParts = this.getOfficialParts(cutoffMs);
            return {
              valid: false,
              blocked: true,
              reason: `Jugada enviada a las ${serverParts.time12h} (después del cierre ${cutoffParts.time12h} de ${lot.name || play.lotteryName})`
            };
          }
        }

        return { valid: true, blocked: false, verifiedByServer: true, serverParts };
      }

      // Tickets SIN serverCreatedAt:
      // Preservar tickets históricos ya existentes (<= securityBaselineTicketNumber),
      // pero bloquear tickets posteriores creados por clientes sin sello o cacheados.
      const baseline = Number(config && config.securityBaselineTicketNumber);
      const tktNum = parseInt(String(ticket.ticketId || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(baseline) && baseline > 0 && Number.isFinite(tktNum) && tktNum > baseline) {
        return {
          valid: false,
          blocked: true,
          reason: 'Ticket nuevo emitido sin sello de hora del servidor (POS sin actualizar o sin verificación)'
        };
      }

      return { valid: true, blocked: false, verifiedByServer: false, legacy: true };
    }

    startPeriodicSync(getAgencyCodeFn = null) {
      if (this._periodicTimer) return;
      this.syncServerTime({ force: true }).catch(() => {});
      this._periodicTimer = setInterval(async () => {
        const res = await this.syncServerTime({ force: true });
        if (res && res.ok && res.tampered && typeof getAgencyCodeFn === 'function') {
          const code = getAgencyCodeFn();
          if (code) this.reportTamperAlert(code, res).catch(() => {});
        }
      }, AUTO_RESYNC_MS);
    }
  }

  const serverClock = new BancaFcServerClock();
  global.BancaFcServerClock = BancaFcServerClock;
  global.bancaFcServerClock = serverClock;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BancaFcServerClock, bancaFcServerClock: serverClock };
  }
})(typeof window !== 'undefined' ? window : globalThis);
