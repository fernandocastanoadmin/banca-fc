// js/banca.js - Controlador del Programa Administrativo General de la Banca (Macro Multi-Receptor)
// Supervisa múltiples Receptores (incluido FC El Castaño), sus Agencias, Taquillas POS, Ventas, Premios y Tickets.

class BancaGeneralMacroController {
  constructor(storageMgr, printerMgr) {
    this.storage = storageMgr || storage;
    this.printer = printerMgr || printer;
    this.activeTab = 'tab-receptores';
    this.selectedReceptorCode = 'ALL';
    this.currentAuditedReceptorCode = null;
    this.currentAuditedReceptorCurrency = null;
    this.currentAuditedAgencyCode = null;
    this.currentAuditedAgencyCurrency = null;
    this.currentPreviewTicket = null;
    this.pendingResetAction = null;
    this.init();
  }

  init() {
    window.BANCA_FC_ROLE = 'ADMIN';
    this.setupBancaLoginGate();
    this.loadHeaderControls();
    this.bindHeaderEvents();
    this.bindTabNavigation();
    this.bindReceptorModuleEvents();
    this.bindAgencyModuleEvents();
    this.bindAuditReceptorModalEvents();
    this.bindAuditAgencyModalEvents();
    this.bindTicketsAndRiskEvents();
    this.bindResultsModuleEvents();
    this.bindCollectorsAndParamsEvents();
    this.bindRealtimeSync();

    this.populateReceptorDropdowns();
    this.populateCollectorDropdowns();
    this.populateResultsLotterySelect();
    this.loadGlobalMultipliersForm();
    this.refreshAllViews();
  }

  // =========================================================================
  // 1. ACCESO DE SEGURIDAD Y UTILIDADES BASE
  // =========================================================================
  setupBancaLoginGate() {
    const loginModal = document.getElementById('modal-banca-login');
    const loginForm = document.getElementById('form-banca-login');
    const passInput = document.getElementById('input-banca-login-pass');
    const errEl = document.getElementById('banca-login-error');
    const lockBtn = document.getElementById('btn-lock-banca');

    if (!loginModal) return;

    const isUnlocked =
      sessionStorage.getItem('banca_fc_macro_unlocked') === 'true' ||
      sessionStorage.getItem('banca_fc_admin_unlocked') === 'true';

    if (isUnlocked) {
      loginModal.classList.add('hidden');
    } else {
      loginModal.classList.remove('hidden');
      setTimeout(() => passInput?.focus(), 100);
    }

    loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const typed = (passInput?.value || '').trim();
      if (this.storage.verifyAdminResetPassword(typed)) {
        sessionStorage.setItem('banca_fc_macro_unlocked', 'true');
        sessionStorage.setItem('banca_fc_admin_unlocked', 'true');
        loginModal.classList.add('hidden');
        errEl?.classList.add('hidden');
        if (passInput) passInput.value = '';
        this.showToast('Bienvenido al Programa Administrativo General de la Banca.', '🏛️');
      } else {
        errEl?.classList.remove('hidden');
        passInput?.select();
      }
    });

    lockBtn?.addEventListener('click', () => {
      sessionStorage.removeItem('banca_fc_macro_unlocked');
      loginModal.classList.remove('hidden');
      if (passInput) {
        passInput.value = '';
        setTimeout(() => passInput.focus(), 80);
      }
    });
  }

  showToast(message, icon = '✅') {
    const toast = document.getElementById('admin-toast');
    const msgEl = document.getElementById('admin-toast-msg');
    const iconEl = document.getElementById('admin-toast-icon');
    if (!toast || !msgEl) return;
    msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3800);
  }

  formatMoney(amount, currencyCode) {
    const cur = (currencyCode || this.storage.getConsolidationCurrency() || 'COP').toUpperCase();
    const val = Number(amount) || 0;
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);

    if (cur === 'COP') {
      return `${sign}$ ${Math.round(absVal).toLocaleString('es-CO')}`;
    } else if (cur === 'VES') {
      return `${sign}Bs. ${absVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${sign}USD $${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  parseTicketDate(fechaHoraStr) {
    if (!fechaHoraStr) return new Date();
    const datePart = String(fechaHoraStr).split(' ')[0];
    if (datePart.includes('/')) {
      const [dd, mm, yyyy] = datePart.split('/').map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    }
    return new Date(datePart);
  }

  isTicketInDateFilter(ticket) {
    const filterType = document.getElementById('global-date-filter')?.value || 'TODAY';
    if (filterType === 'ALL') return true;

    const tDate = this.parseTicketDate(ticket.fechaHora);
    const tDayStart = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate()).getTime();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 86400000;

    if (filterType === 'TODAY') return tDayStart === todayStart;
    if (filterType === 'YESTERDAY') return tDayStart === (todayStart - oneDayMs);
    if (filterType === 'WEEK') return tDayStart >= (todayStart - 7 * oneDayMs) && tDayStart <= todayStart;
    if (filterType === 'MONTH') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();

    if (filterType === 'CUSTOM') {
      const fromVal = document.getElementById('filter-date-from')?.value;
      const toVal = document.getElementById('filter-date-to')?.value;
      if (fromVal) {
        const [fy, fm, fd] = fromVal.split('-').map(Number);
        if (tDayStart < new Date(fy, fm - 1, fd).getTime()) return false;
      }
      if (toVal) {
        const [ty, tm, td] = toVal.split('-').map(Number);
        if (tDayStart > new Date(ty, tm - 1, td).getTime()) return false;
      }
    }
    return true;
  }

  getFilteredTicketsByDate() {
    return this.storage.getTickets().filter(t => this.isTicketInDateFilter(t));
  }

  calculateAgencyFinancials(agency, periodTickets) {
    const agencyTickets = periodTickets.filter(t => String(this.storage.extractAgencyCodeFromTicket(t)) === String(agency.code));
    const nativeCur = (agency.currency || 'COP').toUpperCase();
    const selectedCur = this.storage.getConsolidationCurrency();
    const commissionPct = Number(agency.commissionPct ?? 15);
    const boxes = this.storage.calculateThreeCurrencyBoxes(agencyTickets, commissionPct);

    return {
      agency,
      tickets: agencyTickets,
      boxes,
      nativeCurrency: nativeCur,
      selectedCurrency: selectedCur,
      commissionPct,
      native: boxes[nativeCur] || boxes.COP,
      global: boxes[selectedCur] || boxes.COP
    };
  }

  // =========================================================================
  // 2. CABECERA GLOBAL, PESTAÑAS Y SINCRONIZACIÓN
  // =========================================================================
  loadHeaderControls() {
    const curSelector = document.getElementById('global-currency-selector');
    if (curSelector) curSelector.value = this.storage.getConsolidationCurrency();

    const todayIso = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('filter-date-from');
    const toInput = document.getElementById('filter-date-to');
    if (fromInput && !fromInput.value) fromInput.value = todayIso;
    if (toInput && !toInput.value) toInput.value = todayIso;
  }

  bindHeaderEvents() {
    document.getElementById('global-receptor-selector')?.addEventListener('change', (e) => {
      this.selectedReceptorCode = e.target.value || 'ALL';
      const agRecFilter = document.getElementById('filter-agencias-receptor');
      const tkRecFilter = document.getElementById('macro-ticket-receptor-filter');
      const riskRecFilter = document.getElementById('risk-receptor-filter');
      if (agRecFilter) agRecFilter.value = this.selectedReceptorCode;
      if (tkRecFilter) tkRecFilter.value = this.selectedReceptorCode;
      if (riskRecFilter) riskRecFilter.value = this.selectedReceptorCode;
      this.refreshAllViews();
      const label = this.selectedReceptorCode === 'ALL'
        ? 'Consolidado Global de Todos los Receptores'
        : `Receptor ${this.selectedReceptorCode}`;
      this.showToast(`Vista Macro filtrada por: ${label}`, '🏛️');
    });

    document.getElementById('global-currency-selector')?.addEventListener('change', (e) => {
      this.storage.setConsolidationCurrency(e.target.value);
      this.refreshAllViews();
      this.showToast(`Caja activa cambiada a ${e.target.value} (Cero Conversión)`, '🏦');
    });

    const dateFilter = document.getElementById('global-date-filter');
    const customBox = document.getElementById('custom-date-range-box');
    dateFilter?.addEventListener('change', (e) => {
      if (customBox) customBox.classList.toggle('hidden', e.target.value !== 'CUSTOM');
      this.refreshAllViews();
    });
    document.getElementById('filter-date-from')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('filter-date-to')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('btn-header-new-receptor')?.addEventListener('click', () => this.openReceptorFormModal(null));
    document.getElementById('btn-open-new-receptor-2')?.addEventListener('click', () => this.openReceptorFormModal(null));
    document.getElementById('btn-header-new-agency')?.addEventListener('click', () => this.openAgencyFormModal(null));
    document.getElementById('btn-open-new-agency-2')?.addEventListener('click', () => {
      const preRec = document.getElementById('filter-agencias-receptor')?.value;
      this.openAgencyFormModal(null, preRec && preRec !== 'ALL' ? preRec : null);
    });

    document.getElementById('btn-header-load-results')?.addEventListener('click', () => {
      this.switchTab('tab-resultados');
      document.getElementById('res-admin-number')?.focus();
    });

    document.getElementById('btn-header-relacion-final')?.addEventListener('click', () => this.openBancaRelacionFinalModal());
    document.getElementById('btn-banca-rel-calcular')?.addEventListener('click', () => this.renderBancaRelacionFinal());
    document.getElementById('banca-rel-receptor')?.addEventListener('change', () => this.renderBancaRelacionFinal());
    document.getElementById('banca-rel-desde')?.addEventListener('change', () => this.renderBancaRelacionFinal());
    document.getElementById('banca-rel-hasta')?.addEventListener('change', () => this.renderBancaRelacionFinal());
    document.getElementById('btn-banca-rel-print')?.addEventListener('click', () => this.printBancaRelacionFinal());
    document.getElementById('btn-banca-rel-wa')?.addEventListener('click', () => this.copyBancaRelacionFinalWa());
    document.getElementById('btn-banca-rel-csv')?.addEventListener('click', () => this.exportBancaRelacionFinalCsv());

    document.getElementById('btn-header-export-csv')?.addEventListener('click', () => this.exportMacroReportCsv());

    document.getElementById('btn-header-open-receptor-admin')?.addEventListener('click', () => {
      const rec = this.selectedReceptorCode !== 'ALL' ? this.selectedReceptorCode : 'FC-CASTANO';
      window.open(`admin.html?receptor=${encodeURIComponent(rec)}`, '_blank');
    });

    document.getElementById('btn-simulate-live-sale')?.addEventListener('click', () => this.simulateIncomingPosTicket());
    document.getElementById('btn-open-network-modal')?.addEventListener('click', () => this.openNetworkSyncModal());
    document.getElementById('btn-header-firebase-config')?.addEventListener('click', () => this.openNetworkSyncModal());
    document.getElementById('header-firebase-status-badge')?.addEventListener('click', () => this.openNetworkSyncModal());

    // Firebase form
    document.getElementById('form-firebase-config')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawVal = (document.getElementById('input-firebase-db-url')?.value || '').trim();
      if (!rawVal || !window.bancaFcCloud) return;
      const btn = document.getElementById('btn-save-firebase-url');
      if (btn) btn.textContent = '⏳ Conectando...';
      const res = await window.bancaFcCloud.saveConfig(rawVal);
      if (btn) btn.textContent = '☁️ Guardar y Conectar';
      if (res.ok) {
        this.updateFirebaseModalView();
        this.refreshAllViews();
        this.showToast('✅ Conectado en tiempo real con Google Firebase.', '☁️');
      } else {
        alert('❌ Error al conectar con Firebase:\n' + (res.error || 'Verifique la URL.'));
      }
    });

    document.getElementById('btn-disconnect-firebase')?.addEventListener('click', () => {
      if (window.bancaFcCloud && confirm('¿Desconectar sincronización Firebase en este navegador?')) {
        window.bancaFcCloud.disconnect();
        this.updateFirebaseModalView();
        this.showToast('Sincronización Firebase desconectada.', '☁️');
      }
    });

    document.getElementById('btn-copy-share-pos-url')?.addEventListener('click', () => {
      const shareInput = document.getElementById('input-share-pos-url');
      if (!shareInput || !shareInput.value) return;
      shareInput.select();
      navigator.clipboard?.writeText(shareInput.value).catch(() => {});
      this.showToast('📋 Link de Taquilla POS copiado.', '📲');
    });

    document.getElementById('btn-force-pull-server')?.addEventListener('click', async () => {
      let updated = false;
      if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
        await window.bancaFcCloud.pullAndMergeFromCloud();
        await window.bancaFcCloud.pushMasterData(this.storage.getMasterData());
        updated = true;
      } else {
        updated = await this.storage.pullFromRemoteServer();
      }
      this.populateReceptorDropdowns();
      this.populateCollectorDropdowns();
      this.refreshAllViews();
      this.showToast(updated ? 'Sincronización completada.' : 'El Panel Macro ya está al día.', '☁️');
    });

    document.getElementById('btn-export-master-json')?.addEventListener('click', () => {
      const jsonStr = this.storage.exportSyncPackage();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_Banca_General_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast('Respaldo JSON descargado.', '💾');
    });

    document.getElementById('input-import-pos-json')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const stats = this.storage.importAndMergeSyncPackage(ev.target.result);
          this.populateReceptorDropdowns();
          this.populateCollectorDropdowns();
          this.refreshAllViews();
          document.getElementById('modal-network-sync')?.classList.add('hidden');
          this.showToast(`Importación exitosa: ${stats.importedTicketsCount} tickets nuevos (Total: ${stats.totalTickets}).`, '🎉');
        } catch (err) {
          alert('Error al importar JSON: ' + err.message);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-restore-demo')?.addEventListener('click', () => {
      if (confirm('¿Desea restaurar los datos de demostración?')) {
        this.storage.restoreDemoData();
        this.populateReceptorDropdowns();
        this.populateCollectorDropdowns();
        this.refreshAllViews();
        this.showToast('Datos demo restaurados.', '🔄');
      }
    });

    document.getElementById('btn-reset-zero')?.addEventListener('click', () => {
      this.openPasswordResetModal({
        mode: 'GLOBAL',
        title: '🔐 Reiniciar Banca General en Cero (Producción)',
        description: '⚠️ Se eliminarán TODOS los tickets y resultados de TODOS los receptores y taquillas, manteniendo la estructura de Receptores y Agencias lista para vender desde #00000001.'
      });
    });

    document.getElementById('btn-quick-manage-collectors')?.addEventListener('click', () => this.openManageCollectorsModal());
    document.getElementById('btn-form-manage-collectors')?.addEventListener('click', () => this.openManageCollectorsModal());

    document.getElementById('form-modal-add-collector')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('modal-input-collector-name');
      const name = (input?.value || '').trim();
      if (!name) return;
      this.storage.addCollector(name);
      input.value = '';
      this.populateCollectorDropdowns();
      this.renderModalCollectorsList();
      this.refreshAllViews();
      this.showToast(`Cobrador "${name}" agregado.`, '🛵');
    });

    document.getElementById('form-password-reset')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.executePasswordProtectedReset();
    });

    document.querySelectorAll('[data-close-admin-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.closeAdminModal)?.classList.add('hidden');
      });
    });
  }

  bindTabNavigation() {
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.admin-tab-view').forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== tabId);
    });
    this.refreshAllViews();
  }

  // =========================================================================
  // 3. POBLADO DE SELECTORES Y REFRESCO CENTRAL MACRO
  // =========================================================================
  populateReceptorDropdowns() {
    const receptores = this.storage.getReceptores();
    const ids = [
      { id: 'global-receptor-selector', allText: '🏛️ Todos los Receptores (Consolidado)', preserve: true },
      { id: 'filter-agencias-receptor', allText: 'Todos los Receptores', preserve: true },
      { id: 'macro-ticket-receptor-filter', allText: 'Todos los Receptores', preserve: true },
      { id: 'risk-receptor-filter', allText: 'Todos Receptores', preserve: true },
      { id: 'banca-rel-receptor', allText: '🏛️ Todos los Receptores', preserve: true },
      { id: 'ag-receptor', allText: null, preserve: true }
    ];

    ids.forEach(item => {
      const sel = document.getElementById(item.id);
      if (!sel) return;
      const prev = sel.value || (item.allText ? 'ALL' : 'FC-CASTANO');
      sel.innerHTML = item.allText ? `<option value="ALL">${item.allText}</option>` : '';
      receptores.forEach(r => {
        sel.innerHTML += `<option value="${this.escapeHtml(r.code)}">${this.escapeHtml(r.code)} - ${this.escapeHtml(r.name)}</option>`;
      });
      const hasPrev = Array.from(sel.options).some(o => o.value === prev);
      sel.value = hasPrev ? prev : (item.allText ? 'ALL' : (receptores[0]?.code || 'FC-CASTANO'));
    });
  }

  populateCollectorDropdowns() {
    const collectors = this.storage.getCollectors();
    const filterSelect = document.getElementById('filter-agency-collector');
    const formSelect = document.getElementById('ag-collector');

    if (filterSelect) {
      const currentVal = filterSelect.value || 'ALL';
      filterSelect.innerHTML = '<option value="ALL">Todos los Cobradores</option>';
      collectors.forEach(c => {
        filterSelect.innerHTML += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
      });
      filterSelect.value = collectors.includes(currentVal) ? currentVal : 'ALL';
    }

    if (formSelect) {
      const currentFormVal = formSelect.value;
      formSelect.innerHTML = '';
      collectors.forEach(c => {
        formSelect.innerHTML += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
      });
      if (currentFormVal && collectors.includes(currentFormVal)) {
        formSelect.value = currentFormVal;
      }
    }
  }

  openBancaRelacionFinalModal() {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const desdeEl = document.getElementById('banca-rel-desde');
    const hastaEl = document.getElementById('banca-rel-hasta');
    const recEl = document.getElementById('banca-rel-receptor');
    if (desdeEl && !desdeEl.value) desdeEl.value = todayIso;
    if (hastaEl && !hastaEl.value) hastaEl.value = todayIso;
    if (recEl && this.selectedReceptorCode) recEl.value = this.selectedReceptorCode;
    this.renderBancaRelacionFinal();
    document.getElementById('modal-banca-relacion-final')?.classList.remove('hidden');
  }

  renderBancaRelacionFinal() {
    const grid = document.getElementById('banca-rel-boxes-grid');
    if (!grid) return;

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const rawDesde = (document.getElementById('banca-rel-desde')?.value || todayIso).trim();
    const rawHasta = (document.getElementById('banca-rel-hasta')?.value || rawDesde || todayIso).trim();
    const startIso = rawDesde <= rawHasta ? rawDesde : rawHasta;
    const endIso = rawDesde <= rawHasta ? rawHasta : rawDesde;

    const fmtDate = (iso) => {
      const p = String(iso || '').split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };
    const rangeLabel = startIso === endIso
      ? fmtDate(startIso)
      : `Desde ${fmtDate(startIso)} hasta ${fmtDate(endIso)}`;

    const recFilter = document.getElementById('banca-rel-receptor')?.value || 'ALL';
    const recObj = recFilter === 'ALL' ? null : this.storage.getReceptorByCode(recFilter);
    const recLabel = recFilter === 'ALL'
      ? 'Todos los Receptores (Consolidado Principal)'
      : `${recFilter} (${recObj ? recObj.name : recFilter})`;

    const subtitleEl = document.getElementById('banca-rel-subtitle');
    if (subtitleEl) subtitleEl.textContent = `${recLabel} • 🔒 Cero Conversión entre monedas.`;
    const badgeEl = document.getElementById('banca-rel-range-badge');
    if (badgeEl) badgeEl.textContent = `Periodo: ${rangeLabel}`;

    const allAgencies = this.storage.getAgencies();
    const agencies = recFilter === 'ALL'
      ? allAgencies
      : allAgencies.filter(a => String(a.receptorCode || 'FC-CASTANO').toUpperCase() === recFilter.toUpperCase());
    const knownCodes = new Set(agencies.map(a => String(a.code)));

    const rangeTickets = this.storage.getTickets().filter(t => {
      const tIso = this.storage.extractTicketDateIso(t);
      if (tIso < startIso || tIso > endIso) return false;
      if (recFilter === 'ALL') return true;
      const tRec = this.storage.extractReceptorCodeFromAgencyOrTicket(t, allAgencies);
      return String(tRec).toUpperCase() === recFilter.toUpperCase();
    });

    const totals = {
      COP: { activeCount: 0, voidCount: 0, totalTicketsCount: 0, gross: 0, voided: 0, net: 0, commission: 0, totalPrizes: 0, bancaUtility: 0 },
      USD: { activeCount: 0, voidCount: 0, totalTicketsCount: 0, gross: 0, voided: 0, net: 0, commission: 0, totalPrizes: 0, bancaUtility: 0 },
      VES: { activeCount: 0, voidCount: 0, totalTicketsCount: 0, gross: 0, voided: 0, net: 0, commission: 0, totalPrizes: 0, bancaUtility: 0 }
    };

    const accumulateBoxes = (boxes) => {
      ['COP', 'USD', 'VES'].forEach(c => {
        const b = boxes[c];
        if (!b) return;
        totals[c].activeCount += b.activeCount;
        totals[c].voidCount += b.voidCount;
        totals[c].totalTicketsCount += b.totalTicketsCount;
        totals[c].gross += b.gross;
        totals[c].voided += b.voided;
        totals[c].net += b.net;
        totals[c].commission += b.commission;
        totals[c].totalPrizes += b.totalPrizes;
        totals[c].bancaUtility += b.bancaUtility;
      });
    };

    agencies.forEach(ag => {
      const m = this.calculateAgencyFinancials(ag, rangeTickets);
      accumulateBoxes(m.boxes);
    });

    const orphanTickets = rangeTickets.filter(t => !knownCodes.has(String(this.storage.extractAgencyCodeFromTicket(t))));
    if (orphanTickets.length > 0) {
      accumulateBoxes(this.storage.calculateThreeCurrencyBoxes(orphanTickets, 15));
    }

    const boxMeta = {
      COP: { title: '🇨🇴 CAJA PESOS (COP $)', headerBg: 'from-blue-900 to-blue-800 border-blue-500/40' },
      USD: { title: '🇺🇸 CAJA DÓLARES (USD $)', headerBg: 'from-emerald-900 to-emerald-800 border-emerald-500/40' },
      VES: { title: '🇻🇪 CAJA BOLÍVARES (VES Bs.)', headerBg: 'from-amber-900 to-orange-800 border-amber-500/40' }
    };

    grid.innerHTML = ['COP', 'USD', 'VES'].map(cur => {
      const b = totals[cur];
      const meta = boxMeta[cur];
      const utilClass = b.bancaUtility >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `
        <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div class="bg-gradient-to-r ${meta.headerBg} px-4 py-2.5 border-b font-black text-xs text-white flex items-center justify-between">
            <span>${meta.title}</span>
            <span class="text-[10px] bg-slate-950/60 px-2 py-0.5 rounded font-mono">${b.totalTicketsCount} tkt</span>
          </div>
          <div class="p-4 space-y-2 text-xs">
            <div class="flex justify-between border-b border-slate-800 pb-1.5">
              <span class="text-slate-400">Tickets (Act / Anul):</span>
              <strong class="font-mono text-slate-200">${b.activeCount} act / ${b.voidCount} anul</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Ventas Brutas:</span>
              <strong class="font-mono text-white">${this.formatMoney(b.gross, cur)}</strong>
            </div>
            <div class="flex justify-between text-rose-400">
              <span>Tickets Anulados (-):</span>
              <strong class="font-mono">-${this.formatMoney(b.voided, cur)}</strong>
            </div>
            <div class="flex justify-between text-sky-300 border-t border-slate-800 pt-1.5 font-bold">
              <span>Ventas Netas:</span>
              <strong class="font-mono">${this.formatMoney(b.net, cur)}</strong>
            </div>
            <div class="flex justify-between text-indigo-300">
              <span>Comisión Agencias (-):</span>
              <strong class="font-mono">-${this.formatMoney(b.commission, cur)}</strong>
            </div>
            <div class="flex justify-between text-amber-300">
              <span>Premios (-):</span>
              <strong class="font-mono">-${this.formatMoney(b.totalPrizes, cur)}</strong>
            </div>
            <div class="mt-2 pt-2.5 border-t border-slate-800 flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg">
              <span class="text-[11px] font-black uppercase text-slate-300">Saldo Banca:</span>
              <strong class="font-mono text-base font-black ${utilClass}">${this.formatMoney(b.bancaUtility, cur)}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.currentBancaRelacionData = {
      recFilter,
      recLabel,
      startIso,
      endIso,
      rangeLabel,
      totals
    };
  }

  copyBancaRelacionFinalWa() {
    const d = this.currentBancaRelacionData;
    if (!d) return;
    const sections = ['COP', 'USD', 'VES'].map(cur => {
      const b = d.totals[cur];
      return [
        `💼 *CAJA ${cur}* (${b.activeCount} act / ${b.voidCount} anul)`,
        `• Bruta: ${this.formatMoney(b.gross, cur)}`,
        `• Anulados: -${this.formatMoney(b.voided, cur)}`,
        `• Neta: ${this.formatMoney(b.net, cur)}`,
        `• Comisión: -${this.formatMoney(b.commission, cur)}`,
        `• Premios: -${this.formatMoney(b.totalPrizes, cur)}`,
        `• *SALDO BANCA:* ${this.formatMoney(b.bancaUtility, cur)}`
      ].join('\n');
    }).join('\n----------------------------------\n');

    const text = [
      `📊 *RELACIÓN FINAL PRINCIPAL - ${d.recLabel}*`,
      `📅 *Periodo:* ${d.rangeLabel}`,
      `----------------------------------`,
      sections
    ].join('\n');

    navigator.clipboard?.writeText(text).catch(() => {});
    this.showToast('Relación Final copiada para WhatsApp.', '📋');
  }

  printBancaRelacionFinal() {
    const d = this.currentBancaRelacionData;
    if (!d) return;
    const area = document.getElementById('admin-print-area');
    if (!area) return;
    const rowsHtml = ['COP', 'USD', 'VES'].map(cur => {
      const b = d.totals[cur];
      return `
        <div style="border:1px solid #333; padding:8px; margin-bottom:8px;">
          <strong>CAJA ${cur}</strong> (${b.activeCount} act / ${b.voidCount} anul)<br/>
          Ventas Brutas: ${this.formatMoney(b.gross, cur)}<br/>
          Anulados (-): -${this.formatMoney(b.voided, cur)}<br/>
          Ventas Netas: ${this.formatMoney(b.net, cur)}<br/>
          Comisión (-): -${this.formatMoney(b.commission, cur)}<br/>
          Premios (-): -${this.formatMoney(b.totalPrizes, cur)}<br/>
          <strong>SALDO BANCA ${cur}: ${this.formatMoney(b.bancaUtility, cur)}</strong>
        </div>
      `;
    }).join('');
    area.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 14px; color: #000;">
        <h2 style="margin:0 0 4px 0;">RELACIÓN FINAL PRINCIPAL — ${this.escapeHtml(d.recLabel)}</h2>
        <div style="margin-bottom:10px;"><strong>Periodo:</strong> ${this.escapeHtml(d.rangeLabel)}</div>
        ${rowsHtml}
      </div>
    `;
    window.print();
  }

  exportBancaRelacionFinalCsv() {
    const d = this.currentBancaRelacionData;
    if (!d) return;
    let csv = '\uFEFF';
    csv += `RELACION FINAL PRINCIPAL,${d.recLabel},Periodo: ${d.rangeLabel}\n`;
    csv += 'Moneda,Tickets Activos,Tickets Anulados,Ventas Brutas,Anulados,Ventas Netas,Comision Agencias,Premios,Saldo Banca\n';
    ['COP', 'USD', 'VES'].forEach(cur => {
      const b = d.totals[cur];
      csv += `${cur},${b.activeCount},${b.voidCount},${b.gross.toFixed(2)},${b.voided.toFixed(2)},${b.net.toFixed(2)},${b.commission.toFixed(2)},${b.totalPrizes.toFixed(2)},${b.bancaUtility.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relacion_Final_Principal_${d.recFilter}_${d.startIso}_a_${d.endIso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Relación Final Principal exportada a CSV.', '📥');
  }

  refreshAllViews() {
    const syncEl = document.getElementById('last-sync-timestamp');
    if (syncEl) syncEl.textContent = `Sincronizado: ${new Date().toLocaleTimeString('es-VE')}`;

    const relModal = document.getElementById('modal-banca-relacion-final');
    if (relModal && !relModal.classList.contains('hidden')) {
      this.renderBancaRelacionFinal();
    }

    const periodTickets = this.getFilteredTicketsByDate();
    const agencies = this.storage.getAgencies();

    // Garantizar que códigos de agencia en tickets aparezcan registrados
    const knownCodes = new Set(agencies.map(a => String(a.code)));
    periodTickets.forEach(t => {
      const tCode = this.storage.extractAgencyCodeFromTicket(t);
      if (!knownCodes.has(String(tCode))) {
        const autoAgency = this.storage.saveAgency({
          code: tCode,
          name: t.agencia ? t.agencia.replace(`${tCode} - `, '') : `AGENCIA ${tCode}`,
          receptorCode: t.receptorCode || 'FC-CASTANO',
          currency: t.moneda || 'COP',
          commissionPct: 15,
          status: 'ACTIVA'
        });
        agencies.push(autoAgency);
        knownCodes.add(String(tCode));
      }
    });

    const receptores = this.storage.getReceptores();
    this.populateReceptorDropdowns();

    const receptorMetricsList = receptores.map(rec => this.storage.calculateReceptorFinancials(rec, agencies, periodTickets));

    this.renderMacroBoxesAndKpis(receptorMetricsList, agencies);
    this.renderReceptoresModule(receptorMetricsList);
    this.renderAgenciesPorReceptorTable(agencies, periodTickets, receptores);
    this.renderMacroTicketsAndRisk(periodTickets, agencies, receptores);
    this.renderResultsAndWinnersView(agencies, receptores);
    this.renderCuadreAndCollectors(receptorMetricsList, agencies, periodTickets);

    if (this.currentAuditedReceptorCode) {
      const recModal = document.getElementById('modal-audit-receptor');
      if (recModal && !recModal.classList.contains('hidden')) {
        this.openAuditReceptorModal(this.currentAuditedReceptorCode, this.currentAuditedReceptorCurrency);
      }
    }
    if (this.currentAuditedAgencyCode) {
      const agModal = document.getElementById('modal-audit-agency');
      if (agModal && !agModal.classList.contains('hidden')) {
        this.openAuditAgencyModal(this.currentAuditedAgencyCode, this.currentAuditedAgencyCurrency);
      }
    }
  }

  // =========================================================================
  // 4. CAJAS INDEPENDIENTES MACRO & 7 KPIs GLOBALES
  // =========================================================================
  renderMacroBoxesAndKpis(receptorMetricsList, allAgencies) {
    const selectedCur = this.storage.getConsolidationCurrency();
    const headerRecFilter = this.selectedReceptorCode || 'ALL';

    const scopeList = headerRecFilter === 'ALL'
      ? receptorMetricsList
      : receptorMetricsList.filter(m => String(m.receptor.code).toUpperCase() === headerRecFilter);

    const globalBoxes = {
      COP: { gross: 0, voided: 0, net: 0, commission: 0, receptorCommission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, macroUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 },
      USD: { gross: 0, voided: 0, net: 0, commission: 0, receptorCommission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, macroUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 },
      VES: { gross: 0, voided: 0, net: 0, commission: 0, receptorCommission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, macroUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 }
    };

    let activeReceptores = 0;
    let totalAgenciasScope = 0;
    let activeAgenciasScope = 0;

    scopeList.forEach(m => {
      if (m.receptor.status === 'ACTIVO') activeReceptores++;
      totalAgenciasScope += m.agenciesCount;
      activeAgenciasScope += m.activeAgenciesCount;

      ['COP', 'USD', 'VES'].forEach(curKey => {
        const b = m.boxes[curKey];
        if (!b) return;
        globalBoxes[curKey].gross += b.gross;
        globalBoxes[curKey].voided += b.voided;
        globalBoxes[curKey].net += b.net;
        globalBoxes[curKey].commission += b.commission;
        globalBoxes[curKey].receptorCommission += b.receptorCommission;
        globalBoxes[curKey].paidPrizes += b.paidPrizes;
        globalBoxes[curKey].pendingPrizes += b.pendingPrizes;
        globalBoxes[curKey].totalPrizes += b.totalPrizes;
        globalBoxes[curKey].macroUtility += b.macroUtility;
        globalBoxes[curKey].activeCount += b.activeCount;
        globalBoxes[curKey].voidCount += b.voidCount;
        globalBoxes[curKey].totalTicketsCount += b.totalTicketsCount;
      });
    });

    const threeBoxesContainer = document.getElementById('macro-three-boxes-grid');
    if (threeBoxesContainer) {
      const boxStyles = {
        COP: { title: '🇨🇴 CAJA MACRO PESOS (COP $)', borderActive: 'border-amber-400 ring-2 ring-amber-400/30', headerBg: 'from-blue-900/90 to-slate-900' },
        USD: { title: '🇺🇸 CAJA MACRO DÓLARES (USD $)', borderActive: 'border-emerald-400 ring-2 ring-emerald-400/30', headerBg: 'from-emerald-900/90 to-slate-900' },
        VES: { title: '🇻🇪 CAJA MACRO BOLÍVARES (VES Bs.)', borderActive: 'border-sky-400 ring-2 ring-sky-400/30', headerBg: 'from-amber-900/90 to-slate-900' }
      };

      threeBoxesContainer.innerHTML = ['COP', 'USD', 'VES'].map(curKey => {
        const b = globalBoxes[curKey];
        const st = boxStyles[curKey];
        const isSelected = curKey === selectedCur;
        const utilPositive = b.macroUtility >= 0;

        return `
          <div class="admin-currency-box cursor-pointer rounded-xl bg-slate-900/95 border ${isSelected ? st.borderActive : 'border-slate-800 hover:border-slate-700'} overflow-hidden shadow-lg transition" data-currency="${curKey}">
            <div class="bg-gradient-to-r ${st.headerBg} px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
              <span class="text-xs font-black uppercase tracking-wide text-white">${st.title}</span>
              ${isSelected
                ? '<span class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">FILTRO ACTIVO</span>'
                : '<span class="text-[10px] text-slate-400 font-semibold">Clic para filtrar</span>'}
            </div>
            <div class="p-3 space-y-1 text-xs font-mono">
              <div class="flex justify-between text-slate-300 border-b border-slate-800/80 pb-1">
                <span class="font-sans text-slate-400">Tickets (Activos / Anulados):</span>
                <strong><span class="text-emerald-400">${b.activeCount} act</span> / <span class="text-rose-400">${b.voidCount} anul</span></strong>
              </div>
              <div class="flex justify-between">
                <span class="font-sans text-slate-400">Ventas Brutas:</span>
                <strong class="text-white">${this.formatMoney(b.gross, curKey)}</strong>
              </div>
              <div class="flex justify-between text-rose-400">
                <span class="font-sans">Anulados (-):</span>
                <strong>-${this.formatMoney(b.voided, curKey)}</strong>
              </div>
              <div class="flex justify-between text-sky-300 border-t border-slate-800/80 pt-1">
                <span class="font-sans font-bold">Ventas Netas:</span>
                <strong>${this.formatMoney(b.net, curKey)}</strong>
              </div>
              <div class="flex justify-between text-indigo-300">
                <span class="font-sans">Comisión Taquillas (-):</span>
                <strong>-${this.formatMoney(b.commission, curKey)}</strong>
              </div>
              <div class="flex justify-between text-purple-300">
                <span class="font-sans">Comisión Receptores (-):</span>
                <strong>-${this.formatMoney(b.receptorCommission, curKey)}</strong>
              </div>
              <div class="flex justify-between text-amber-400">
                <span class="font-sans">Premios Ganadores (-):</span>
                <strong>-${this.formatMoney(b.totalPrizes, curKey)}</strong>
              </div>
              <div class="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between bg-slate-950/90 px-2.5 py-1.5 rounded-lg">
                <span class="font-sans text-[11px] font-black uppercase ${utilPositive ? 'text-emerald-400' : 'text-rose-400'}">Utilidad Neta Banca General:</span>
                <strong class="text-sm font-black ${utilPositive ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(b.macroUtility, curKey)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('');

      threeBoxesContainer.querySelectorAll('.admin-currency-box').forEach(cardEl => {
        cardEl.addEventListener('click', () => {
          const clickedCur = cardEl.dataset.currency;
          if (clickedCur) {
            this.storage.setConsolidationCurrency(clickedCur);
            const curSelector = document.getElementById('global-currency-selector');
            if (curSelector) curSelector.value = clickedCur;
            this.refreshAllViews();
          }
        });
      });
    }

    const activeBox = globalBoxes[selectedCur] || globalBoxes.COP;
    const totalComms = activeBox.commission + activeBox.receptorCommission;
    const marginPct = activeBox.net > 0 ? ((activeBox.macroUtility / activeBox.net) * 100).toFixed(1) : '0.0';

    document.getElementById('kpi-receptores-count').textContent = `${activeReceptores} / ${scopeList.length}`;
    document.getElementById('kpi-sub-agencias-count').textContent = `${activeAgenciasScope} de ${totalAgenciasScope} taquillas activas`;

    document.getElementById('kpi-ventas-brutas').textContent = this.formatMoney(activeBox.gross, selectedCur);
    document.getElementById('kpi-sub-tickets-total').textContent = `${activeBox.totalTicketsCount} tickets en ${selectedCur}`;
    document.getElementById('kpi-badge-currency-1').textContent = `CAJA ${selectedCur}`;

    document.getElementById('kpi-tickets-anulados').textContent = this.formatMoney(activeBox.voided, selectedCur);
    document.getElementById('kpi-sub-anulados-count').textContent = `${activeBox.voidCount} anulados`;

    document.getElementById('kpi-ventas-netas').textContent = this.formatMoney(activeBox.net, selectedCur);
    document.getElementById('kpi-sub-activos-count').textContent = `${activeBox.activeCount} activos`;

    document.getElementById('kpi-comisiones-totales').textContent = this.formatMoney(totalComms, selectedCur);
    document.getElementById('kpi-sub-comision-desglose').textContent =
      `Taq: ${this.formatMoney(activeBox.commission, selectedCur)} • Rec: ${this.formatMoney(activeBox.receptorCommission, selectedCur)}`;

    document.getElementById('kpi-total-premios').textContent = this.formatMoney(activeBox.totalPrizes, selectedCur);
    document.getElementById('kpi-sub-premios-pagados').textContent = `Pag: ${this.formatMoney(activeBox.paidPrizes, selectedCur)}`;
    document.getElementById('kpi-sub-premios-pendientes').textContent = `Pend: ${this.formatMoney(activeBox.pendingPrizes, selectedCur)}`;

    const utilityEl = document.getElementById('kpi-utilidad-neta');
    const utilityCard = document.getElementById('kpi-card-utilidad');
    const utilityBadge = document.getElementById('kpi-utilidad-badge');
    const marginEl = document.getElementById('kpi-sub-margen-pct');

    if (utilityEl) utilityEl.textContent = this.formatMoney(activeBox.macroUtility, selectedCur);
    if (marginEl) marginEl.textContent = `Margen (${selectedCur}): ${marginPct}%`;

    if (utilityCard && utilityBadge) {
      if (activeBox.macroUtility >= 0) {
        utilityCard.classList.remove('kpi-profit-negative');
        utilityCard.classList.add('kpi-profit-positive');
        utilityBadge.className = 'badge-pill badge-activa';
        utilityBadge.textContent = `A FAVOR (${selectedCur})`;
      } else {
        utilityCard.classList.remove('kpi-profit-positive');
        utilityCard.classList.add('kpi-profit-negative');
        utilityBadge.className = 'badge-pill badge-suspendida';
        utilityBadge.textContent = `EN CONTRA (${selectedCur})`;
      }
    }
  }

  // =========================================================================
  // 5. MÓDULO 1: CONSOLIDADO DE RECEPTORES / BANCAS
  // =========================================================================
  bindReceptorModuleEvents() {
    document.getElementById('receptor-search-input')?.addEventListener('input', () => this.refreshAllViews());
    document.getElementById('filter-receptor-status')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('form-receptor-crud')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const allowedCurrencies = [];
      if (document.getElementById('rec-allow-cop')?.checked) allowedCurrencies.push('COP');
      if (document.getElementById('rec-allow-usd')?.checked) allowedCurrencies.push('USD');
      if (document.getElementById('rec-allow-ves')?.checked) allowedCurrencies.push('VES');
      if (allowedCurrencies.length === 0) allowedCurrencies.push('COP');

      const recData = {
        code: document.getElementById('rec-code').value.trim().toUpperCase(),
        name: document.getElementById('rec-name').value.trim(),
        manager: document.getElementById('rec-manager').value.trim(),
        whatsapp: document.getElementById('rec-whatsapp').value.trim(),
        zone: document.getElementById('rec-zone').value.trim(),
        receptorCommissionPct: Number(document.getElementById('rec-commission').value || 5),
        allowedCurrencies,
        currency: allowedCurrencies[0],
        status: document.getElementById('rec-status').value
      };

      try {
        const saved = this.storage.saveReceptor(recData);
        document.getElementById('modal-receptor-form')?.classList.add('hidden');
        this.populateReceptorDropdowns();
        this.refreshAllViews();
        this.showToast(`Receptor ${saved.code} (${saved.name}) guardado en Banca General.`, '🏛️');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  openReceptorFormModal(receptorCode = null) {
    const modal = document.getElementById('modal-receptor-form');
    const title = document.getElementById('modal-receptor-title');
    const codeInput = document.getElementById('rec-code');
    if (!modal) return;

    if (receptorCode) {
      const rec = this.storage.getReceptorByCode(receptorCode);
      if (!rec) return;
      title.textContent = `✏️ Editar Receptor: ${rec.code} - ${rec.name}`;
      codeInput.value = rec.code;
      codeInput.readOnly = rec.code === 'FC-CASTANO';
      document.getElementById('rec-name').value = rec.name || '';
      document.getElementById('rec-manager').value = rec.manager || '';
      document.getElementById('rec-whatsapp').value = rec.whatsapp || '';
      document.getElementById('rec-zone').value = rec.zone || '';
      document.getElementById('rec-commission').value = rec.receptorCommissionPct ?? 5;
      const allowed = rec.allowedCurrencies || ['COP', 'USD', 'VES'];
      document.getElementById('rec-allow-cop').checked = allowed.includes('COP');
      document.getElementById('rec-allow-usd').checked = allowed.includes('USD');
      document.getElementById('rec-allow-ves').checked = allowed.includes('VES');
      document.getElementById('rec-status').value = rec.status || 'ACTIVO';
    } else {
      const count = this.storage.getReceptores().length + 1;
      title.textContent = '➕ Registrar Nuevo Receptor / Banca';
      codeInput.value = `REC-${String(count).padStart(2, '0')}`;
      codeInput.readOnly = false;
      document.getElementById('rec-name').value = '';
      document.getElementById('rec-manager').value = '';
      document.getElementById('rec-whatsapp').value = '+58414';
      document.getElementById('rec-zone').value = 'San Cristóbal / Táchira';
      document.getElementById('rec-commission').value = 5;
      document.getElementById('rec-allow-cop').checked = true;
      document.getElementById('rec-allow-usd').checked = true;
      document.getElementById('rec-allow-ves').checked = true;
      document.getElementById('rec-status').value = 'ACTIVO';
    }

    modal.classList.remove('hidden');
  }

  renderReceptoresModule(receptorMetricsList) {
    const selectedCur = this.storage.getConsolidationCurrency();
    const badgeEl = document.getElementById('receptor-table-active-box-badge');
    if (badgeEl) badgeEl.textContent = `🔒 Filtro de Caja Activo: ${selectedCur} (Sin Conversión)`;

    const searchQ = (document.getElementById('receptor-search-input')?.value || '').trim().toLowerCase();
    const stFilter = document.getElementById('filter-receptor-status')?.value || 'ALL';
    const headerRecFilter = this.selectedReceptorCode || 'ALL';

    const filtered = receptorMetricsList.filter(m => {
      const rec = m.receptor;
      if (headerRecFilter !== 'ALL' && String(rec.code).toUpperCase() !== headerRecFilter) return false;
      if (stFilter !== 'ALL' && rec.status !== stFilter) return false;
      if (searchQ) {
        const hay = `${rec.code} ${rec.name} ${rec.manager} ${rec.zone}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    // Tarjetas rápidas por Receptor
    const cardsGrid = document.getElementById('receptores-cards-grid');
    if (cardsGrid) {
      if (filtered.length === 0) {
        cardsGrid.innerHTML = '';
      } else {
        cardsGrid.innerHTML = filtered.map(m => {
          const rec = m.receptor;
          const b = m.boxes[selectedCur] || m.boxes.COP;
          const isAct = rec.status === 'ACTIVO';
          const utilPos = b.macroUtility >= 0;
          const otherMovs = ['COP', 'USD', 'VES']
            .filter(c => m.boxes[c].totalTicketsCount > 0)
            .map(c => `<span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono ${m.boxes[c].macroUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${c}: ${this.formatMoney(m.boxes[c].net, c)} (${m.boxes[c].activeCount}t)</span>`)
            .join(' ');

          return `
            <div class="rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 p-3.5 shadow-lg flex flex-col justify-between gap-3 transition">
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[11px]">${this.escapeHtml(rec.code)}</span>
                      <h3 class="text-sm font-black text-white uppercase">${this.escapeHtml(rec.name)}</h3>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-1">👤 ${this.escapeHtml(rec.manager)} • 📍 ${this.escapeHtml(rec.zone)}</div>
                  </div>
                  <span class="badge-pill ${isAct ? 'badge-activa' : 'badge-suspendida'}">${rec.status}</span>
                </div>

                <div class="mt-3 grid grid-cols-4 gap-2 text-center bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                  <div>
                    <div class="text-[10px] text-slate-400">Taquillas</div>
                    <div class="font-mono font-bold text-sky-400 text-xs">${m.activeAgenciesCount}/${m.agenciesCount}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">Neto (${selectedCur})</div>
                    <div class="font-mono font-bold text-white text-xs">${this.formatMoney(b.net, selectedCur)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">Premios</div>
                    <div class="font-mono font-bold text-amber-400 text-xs">${this.formatMoney(b.totalPrizes, selectedCur)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">Utilidad</div>
                    <div class="font-mono font-black text-xs ${utilPos ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(b.macroUtility, selectedCur)}</div>
                  </div>
                </div>
                ${otherMovs ? `<div class="mt-2 flex flex-wrap gap-1">${otherMovs}</div>` : ''}
              </div>

              <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <button type="button" class="btn-rec-expediente flex-1 py-1.5 px-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]" data-code="${this.escapeHtml(rec.code)}">
                  🔍 Ver Agencias / Taquillas / Tickets
                </button>
                <button type="button" class="btn-rec-open-admin py-1.5 px-2.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-sky-300 border border-blue-500/40 font-bold text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Abrir Administrativo del Receptor">
                  🖥️ Panel
                </button>
              </div>
            </div>
          `;
        }).join('');

        cardsGrid.querySelectorAll('.btn-rec-expediente').forEach(btn => {
          btn.addEventListener('click', () => this.openAuditReceptorModal(btn.dataset.code));
        });
        cardsGrid.querySelectorAll('.btn-rec-open-admin').forEach(btn => {
          btn.addEventListener('click', () => window.open(`admin.html?receptor=${encodeURIComponent(btn.dataset.code)}`, '_blank'));
        });
      }
    }

    // Tabla maestra de Receptores
    const tbody = document.getElementById('receptores-master-tbody');
    const tfoot = document.getElementById('receptores-master-tfoot');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-slate-400">No hay receptores que coincidan con el filtro actual.</td></tr>`;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let rowsHtml = '';
    let sumAgActive = 0, sumAgTotal = 0, sumTkAct = 0, sumTkVoid = 0;
    let sumGross = 0, sumNet = 0, sumTaqCom = 0, sumRecCom = 0, sumPrizes = 0, sumUtility = 0;

    filtered.forEach(m => {
      const rec = m.receptor;
      const b = m.boxes[selectedCur] || m.boxes.COP;
      const isAct = rec.status === 'ACTIVO';
      const utilPos = b.macroUtility >= 0;

      sumAgActive += m.activeAgenciesCount;
      sumAgTotal += m.agenciesCount;
      sumTkAct += b.activeCount;
      sumTkVoid += b.voidCount;
      sumGross += b.gross;
      sumNet += b.net;
      sumTaqCom += b.commission;
      sumRecCom += b.receptorCommission;
      sumPrizes += b.totalPrizes;
      sumUtility += b.macroUtility;

      rowsHtml += `
        <tr>
          <td>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 font-mono font-black text-amber-300 text-xs">${this.escapeHtml(rec.code)}</span>
              <div class="font-black text-white">${this.escapeHtml(rec.name)}</div>
            </div>
          </td>
          <td>
            <div class="font-semibold text-slate-200 text-xs">${this.escapeHtml(rec.manager)}</div>
            <div class="text-[11px] text-slate-400">${this.escapeHtml(rec.zone)}</div>
          </td>
          <td>${isAct ? '<span class="badge-pill badge-activa">● ACTIVO</span>' : '<span class="badge-pill badge-suspendida">⛔ SUSPENDIDO</span>'}</td>
          <td class="text-center font-mono">
            <span class="text-sky-400 font-bold">${m.activeAgenciesCount}</span> / <span class="text-slate-300">${m.agenciesCount}</span>
          </td>
          <td class="text-xs font-mono text-amber-300">${(rec.allowedCurrencies || ['COP']).join(' / ')}</td>
          <td class="text-center font-mono">
            <span class="text-emerald-400 font-bold">${b.activeCount}</span> / <span class="text-rose-400 font-bold">${b.voidCount}</span>
          </td>
          <td class="text-right font-mono text-slate-200">${this.formatMoney(b.gross, selectedCur)}</td>
          <td class="text-right font-mono font-bold text-sky-300">${this.formatMoney(b.net, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(b.commission, selectedCur)}</td>
          <td class="text-right font-mono text-purple-300">
            ${this.formatMoney(b.receptorCommission, selectedCur)}
            <div class="text-[10px] text-slate-400">(${rec.receptorCommissionPct ?? 5}%)</div>
          </td>
          <td class="text-right font-mono font-bold ${b.totalPrizes > 0 ? 'text-amber-400' : 'text-slate-500'}">
            ${this.formatMoney(b.totalPrizes, selectedCur)}
            ${b.pendingPrizes > 0 ? `<div class="text-[10px] text-amber-300">Pend: ${this.formatMoney(b.pendingPrizes, selectedCur)}</div>` : ''}
          </td>
          <td class="text-right font-mono">
            <div class="font-black text-sm ${utilPos ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(b.macroUtility, selectedCur)}</div>
          </td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="btn-rec-drill px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Ver Agencias y Taquillas en Pestaña 2">
                🏢 Taquillas
              </button>
              <button type="button" class="btn-rec-audit px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Expediente Completo del Receptor">
                🔍 Auditar
              </button>
              <button type="button" class="btn-rec-edit px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Editar Receptor">
                ✏️
              </button>
              <button type="button" class="btn-rec-toggle px-2 py-1 rounded ${isAct ? 'bg-rose-950/70 text-rose-300 border border-rose-800' : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'} text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="${isAct ? 'Suspender' : 'Activar'}">
                ${isAct ? '🔒' : '🔓'}
              </button>
              <button type="button" class="btn-rec-wa px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold" data-code="${this.escapeHtml(rec.code)}" title="Corte WhatsApp Receptor">
                📲
              </button>
              <button type="button" class="btn-rec-reset px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Reiniciar ventas de este receptor en 0">
                🧹
              </button>
              ${rec.code !== 'FC-CASTANO' ? `
                <button type="button" class="btn-rec-del px-2 py-1 rounded bg-rose-900/70 hover:bg-rose-700 text-rose-200 border border-rose-700 text-[11px]" data-code="${this.escapeHtml(rec.code)}" title="Eliminar Receptor">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="3" class="py-3 px-3 text-right uppercase text-xs text-slate-300">
            TOTAL MACRO ${selectedCur} (${filtered.length} Receptores):
          </td>
          <td class="text-center font-mono text-xs text-sky-300">${sumAgActive} / ${sumAgTotal}</td>
          <td></td>
          <td class="text-center font-mono text-xs"><span class="text-emerald-400">${sumTkAct}</span> / <span class="text-rose-400">${sumTkVoid}</span></td>
          <td class="text-right font-mono text-white">${this.formatMoney(sumGross, selectedCur)}</td>
          <td class="text-right font-mono text-sky-300">${this.formatMoney(sumNet, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(sumTaqCom, selectedCur)}</td>
          <td class="text-right font-mono text-purple-300">${this.formatMoney(sumRecCom, selectedCur)}</td>
          <td class="text-right font-mono text-amber-400">${this.formatMoney(sumPrizes, selectedCur)}</td>
          <td class="text-right font-mono text-sm ${sumUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(sumUtility, selectedCur)}</td>
          <td></td>
        </tr>
      `;
    }

    tbody.querySelectorAll('.btn-rec-drill').forEach(btn => {
      btn.addEventListener('click', () => {
        const agRecFilter = document.getElementById('filter-agencias-receptor');
        if (agRecFilter) agRecFilter.value = btn.dataset.code;
        this.switchTab('tab-agencias-por-receptor');
      });
    });
    tbody.querySelectorAll('.btn-rec-audit').forEach(btn => {
      btn.addEventListener('click', () => this.openAuditReceptorModal(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-rec-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openReceptorFormModal(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-rec-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const updated = this.storage.toggleReceptorStatus(btn.dataset.code);
        if (updated) {
          this.refreshAllViews();
          this.showToast(`Receptor ${updated.code} ahora está ${updated.status}`, updated.status === 'ACTIVO' ? '🟢' : '⛔');
        }
      });
    });
    tbody.querySelectorAll('.btn-rec-wa').forEach(btn => {
      btn.addEventListener('click', () => this.sendReceptorWhatsAppSummary(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-rec-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.storage.getReceptorByCode(btn.dataset.code);
        if (!rec) return;
        this.openPasswordResetModal({
          mode: 'RECEPTOR',
          receptorCode: rec.code,
          title: `🔐 Reiniciar Receptor ${rec.code} en Cero`,
          description: `⚠️ Se eliminarán todos los tickets de las agencias y taquillas pertenecientes a <strong>${this.escapeHtml(rec.code)} - ${this.escapeHtml(rec.name)}</strong>.`
        });
      });
    });
    tbody.querySelectorAll('.btn-rec-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.storage.getReceptorByCode(btn.dataset.code);
        if (!rec) return;
        if (confirm(`¿Eliminar el receptor ${rec.code} (${rec.name})?\nSus agencias se reasignarán al receptor principal FC-CASTANO.`)) {
          try {
            this.storage.deleteReceptor(rec.code, false);
            this.populateReceptorDropdowns();
            this.refreshAllViews();
            this.showToast(`Receptor ${rec.code} eliminado.`, '🗑️');
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });
  }

  // =========================================================================
  // 6. EXPEDIENTE COMPLETO DE RECEPTOR (#modal-audit-receptor)
  // =========================================================================
  bindAuditReceptorModalEvents() {
    document.getElementById('btn-audit-rec-add-agency')?.addEventListener('click', () => {
      if (this.currentAuditedReceptorCode) {
        this.openAgencyFormModal(null, this.currentAuditedReceptorCode);
      }
    });
    document.getElementById('btn-audit-rec-open-admin')?.addEventListener('click', () => {
      if (this.currentAuditedReceptorCode) {
        window.open(`admin.html?receptor=${encodeURIComponent(this.currentAuditedReceptorCode)}`, '_blank');
      }
    });
    document.getElementById('btn-audit-rec-wa')?.addEventListener('click', () => {
      if (this.currentAuditedReceptorCode) {
        this.sendReceptorWhatsAppSummary(this.currentAuditedReceptorCode);
      }
    });
  }

  openAuditReceptorModal(receptorCode, forcedCurrency = null) {
    const rec = this.storage.getReceptorByCode(receptorCode);
    if (!rec) return;
    this.currentAuditedReceptorCode = rec.code;

    const cur = forcedCurrency || this.currentAuditedReceptorCurrency || this.storage.getConsolidationCurrency();
    this.currentAuditedReceptorCurrency = cur;

    const periodTickets = this.getFilteredTicketsByDate();
    const agencies = this.storage.getAgencies();
    const m = this.storage.calculateReceptorFinancials(rec, agencies, periodTickets);

    document.getElementById('audit-rec-code').textContent = rec.code;
    document.getElementById('audit-rec-name').textContent = `${rec.name} (Caja ${cur})`;
    const stBadge = document.getElementById('audit-rec-status-badge');
    if (stBadge) {
      stBadge.className = rec.status === 'ACTIVO' ? 'badge-pill badge-activa' : 'badge-pill badge-suspendida';
      stBadge.textContent = rec.status;
    }
    document.getElementById('audit-rec-meta').textContent =
      `Encargado: ${rec.manager} • Zona: ${rec.zone} • Comisión Receptor: ${rec.receptorCommissionPct ?? 5}% • Agencias/Taquillas: ${m.agenciesCount}`;

    const boxesGrid = document.getElementById('audit-rec-three-boxes-grid');
    if (boxesGrid) {
      const boxMeta = {
        COP: { title: '🇨🇴 CAJA PESOS (COP $)', border: 'border-amber-400' },
        USD: { title: '🇺🇸 CAJA DÓLARES (USD $)', border: 'border-emerald-400' },
        VES: { title: '🇻🇪 CAJA BOLÍVARES (VES Bs.)', border: 'border-sky-400' }
      };
      boxesGrid.innerHTML = ['COP', 'USD', 'VES'].map(curKey => {
        const b = m.boxes[curKey];
        const isSel = curKey === cur;
        return `
          <div class="audit-rec-currency-box cursor-pointer rounded-xl bg-slate-950 p-3 border ${isSel ? boxMeta[curKey].border + ' ring-2 ring-amber-400/20' : 'border-slate-800 hover:border-slate-700'} transition" data-currency="${curKey}">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span class="text-xs font-black text-white">${boxMeta[curKey].title}</span>
              ${isSel ? '<span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">ACTIVA</span>' : `<span class="text-[10px] text-slate-400">${b.totalTicketsCount} tickets</span>`}
            </div>
            <div class="space-y-1 text-[11px] font-mono">
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Tickets (Act/Anul):</span><strong class="text-white">${b.activeCount} / ${b.voidCount}</strong></div>
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Ventas Netas:</span><strong class="text-sky-300">${this.formatMoney(b.net, curKey)}</strong></div>
              <div class="flex justify-between text-indigo-300"><span class="font-sans">Com. Taquillas (-):</span><strong>-${this.formatMoney(b.commission, curKey)}</strong></div>
              <div class="flex justify-between text-purple-300"><span class="font-sans">Com. Receptor (-):</span><strong>-${this.formatMoney(b.receptorCommission, curKey)}</strong></div>
              <div class="flex justify-between text-amber-400"><span class="font-sans">Premios (-):</span><strong>-${this.formatMoney(b.totalPrizes, curKey)}</strong></div>
              <div class="flex justify-between pt-1 border-t border-slate-800 ${b.macroUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black">
                <span class="font-sans uppercase">Saldo Banca General:</span>
                <strong>${this.formatMoney(b.macroUtility, curKey)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('');

      boxesGrid.querySelectorAll('.audit-rec-currency-box').forEach(el => {
        el.addEventListener('click', () => this.openAuditReceptorModal(rec.code, el.dataset.currency));
      });
    }

    // Tabla de agencias de este receptor
    const agTbody = document.getElementById('audit-rec-agencies-tbody');
    document.getElementById('audit-rec-agencies-count').textContent = `${m.agencies.length} agencias/taquillas`;
    if (agTbody) {
      if (m.agencies.length === 0) {
        agTbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">Este receptor aún no tiene agencias asignadas.</td></tr>`;
      } else {
        agTbody.innerHTML = m.agencies.map(ag => {
          const agM = this.calculateAgencyFinancials(ag, periodTickets);
          const b = agM.boxes[cur] || agM.boxes.COP;
          return `
            <tr>
              <td>
                <div class="font-bold text-white text-xs"><span class="text-amber-400 font-mono">${this.escapeHtml(ag.code)}</span> - ${this.escapeHtml(ag.name)}</div>
                <div class="text-[10px] text-slate-400 font-mono">POS: ${this.escapeHtml(ag.terminalSerial || 'N/A')}</div>
              </td>
              <td class="text-xs text-slate-300">${this.escapeHtml(ag.zone)}<div class="text-[10px] text-sky-400">🛵 ${this.escapeHtml(ag.collector)}</div></td>
              <td>${ag.status === 'ACTIVA' ? '<span class="badge-pill badge-activa">ACTIVA</span>' : '<span class="badge-pill badge-suspendida">SUSP.</span>'}</td>
              <td class="text-center font-mono text-xs"><span class="text-emerald-400">${b.activeCount}</span> / <span class="text-rose-400">${b.voidCount}</span></td>
              <td class="text-right font-mono font-bold text-sky-300">${this.formatMoney(b.net, cur)}</td>
              <td class="text-right font-mono text-indigo-300">${this.formatMoney(b.commission, cur)}</td>
              <td class="text-right font-mono text-amber-400">${this.formatMoney(b.totalPrizes, cur)}</td>
              <td class="text-right font-mono font-black ${b.bancaUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(b.bancaUtility, cur)}</td>
              <td class="text-center">
                <button type="button" class="btn-audit-rec-ag px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold" data-code="${this.escapeHtml(ag.code)}">🔍 Ver Taquilla</button>
              </td>
            </tr>
          `;
        }).join('');

        agTbody.querySelectorAll('.btn-audit-rec-ag').forEach(btn => {
          btn.addEventListener('click', () => this.openAuditAgencyModal(btn.dataset.code, cur));
        });
      }
    }

    // Tabla de tickets del receptor en la caja seleccionada
    const tkTbody = document.getElementById('audit-rec-tickets-tbody');
    const boxTickets = (m.boxes[cur] && m.boxes[cur].tickets) ? m.boxes[cur].tickets : [];
    document.getElementById('audit-rec-tickets-count').textContent = `${boxTickets.length} tickets en Caja ${cur} (Total receptor: ${m.tickets.length})`;
    if (tkTbody) {
      if (boxTickets.length === 0) {
        tkTbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">Sin tickets emitidos en ${cur} para este periodo.</td></tr>`;
      } else {
        tkTbody.innerHTML = boxTickets.slice(0, 100).map(t => this.renderCompactTicketRowHtml(t, false)).join('');
        this.bindTicketRowActionButtons(tkTbody);
      }
    }

    document.getElementById('modal-audit-receptor')?.classList.remove('hidden');
  }

  sendReceptorWhatsAppSummary(receptorCode) {
    const rec = this.storage.getReceptorByCode(receptorCode);
    if (!rec) return;
    const m = this.storage.calculateReceptorFinancials(rec, this.storage.getAgencies(), this.getFilteredTicketsByDate());

    const sections = ['COP', 'USD', 'VES']
      .filter(c => m.boxes[c].totalTicketsCount > 0 || (rec.allowedCurrencies || []).includes(c))
      .map(c => {
        const b = m.boxes[c];
        return [
          `🏦 *CAJA ${c}*`,
          `🎟️ Tickets: ${b.activeCount} act / ${b.voidCount} anul`,
          `📈 Venta Neta: ${this.formatMoney(b.net, c)}`,
          `🏪 Com. Taquillas: -${this.formatMoney(b.commission, c)}`,
          `🏛️ Com. Receptor (${rec.receptorCommissionPct ?? 5}%): -${this.formatMoney(b.receptorCommission, c)}`,
          `🏆 Premios: -${this.formatMoney(b.totalPrizes, c)}`,
          `✅ *SALDO BANCA GENERAL (${c}):* ${this.formatMoney(b.macroUtility, c)}`
        ].join('\n');
      }).join('\n----------------------------------\n');

    const text = [
      `🏛️ *BANCA GENERAL MACRO - CORTE DE RECEPTOR*`,
      `📋 *Receptor:* ${rec.code} - ${rec.name}`,
      `👤 *Encargado:* ${rec.manager}`,
      `🏢 *Agencias / Taquillas:* ${m.activeAgenciesCount} activas de ${m.agenciesCount}`,
      `----------------------------------`,
      sections,
      `----------------------------------`,
      `🕒 *Generado:* ${new Date().toLocaleString('es-VE')}`
    ].join('\n');

    navigator.clipboard?.writeText(text).catch(() => {});
    const cleanPhone = (rec.whatsapp || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  // =========================================================================
  // 7. MÓDULO 2: AGENCIAS Y TAQUILLAS POR RECEPTOR
  // =========================================================================
  bindAgencyModuleEvents() {
    document.getElementById('filter-agencias-receptor')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('agency-search-input')?.addEventListener('input', () => this.refreshAllViews());
    document.getElementById('filter-agency-collector')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('filter-agency-status')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('btn-gen-serial')?.addEventListener('click', () => {
      const serialInput = document.getElementById('ag-serial');
      if (serialInput) serialInput.value = this.storage.generateTerminalSerial();
    });

    document.getElementById('ag-currency')?.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'COP') document.getElementById('ag-allow-cop').checked = true;
      if (v === 'USD') document.getElementById('ag-allow-usd').checked = true;
      if (v === 'VES') document.getElementById('ag-allow-ves').checked = true;
    });

    document.getElementById('form-agency-crud')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const allowedCurrencies = [];
      if (document.getElementById('ag-allow-cop')?.checked) allowedCurrencies.push('COP');
      if (document.getElementById('ag-allow-usd')?.checked) allowedCurrencies.push('USD');
      if (document.getElementById('ag-allow-ves')?.checked) allowedCurrencies.push('VES');

      let primaryCurrency = document.getElementById('ag-currency').value || 'COP';
      if (allowedCurrencies.length === 0) allowedCurrencies.push(primaryCurrency);
      else if (!allowedCurrencies.includes(primaryCurrency)) primaryCurrency = allowedCurrencies[0];

      const recCode = document.getElementById('ag-receptor').value || 'FC-CASTANO';
      const recObj = this.storage.getReceptorByCode(recCode);

      const agencyData = {
        receptorCode: recCode,
        receptorName: recObj ? recObj.name : recCode,
        code: document.getElementById('ag-code').value.trim(),
        terminalSerial: document.getElementById('ag-serial').value.trim(),
        name: document.getElementById('ag-name').value.trim(),
        zone: document.getElementById('ag-zone').value.trim(),
        manager: document.getElementById('ag-manager').value.trim(),
        whatsapp: document.getElementById('ag-whatsapp').value.trim(),
        collector: document.getElementById('ag-collector').value,
        currency: primaryCurrency,
        allowedCurrencies,
        commissionPct: Number(document.getElementById('ag-commission').value),
        multipliers: {
          triple: Number(document.getElementById('ag-mult-triple')?.value) || 500,
          terminal: Number(document.getElementById('ag-mult-terminal')?.value) || 60,
          aproximacion: Number(document.getElementById('ag-mult-aprox')?.value) || 5,
          animalito: Number(document.getElementById('ag-mult-animalito')?.value) || 30,
          cuatroCifrasDirecto: Number(document.getElementById('ag-mult-4cifras')?.value) || 4500,
          cuatroCifrasCombinado: Number(document.getElementById('ag-mult-4comb')?.value) || 208,
          la5ta: Number(document.getElementById('ag-mult-la5ta')?.value) || 25000,
          astro4: Number(document.getElementById('ag-mult-astro4')?.value) || 40000
        },
        maxBetLimit: Number(document.getElementById('ag-max-bet').value),
        creditLimit: Number(document.getElementById('ag-credit-limit').value),
        password: document.getElementById('ag-password').value.trim(),
        status: document.getElementById('ag-status').value
      };

      const saved = this.storage.saveAgency(agencyData);
      this.storage.recalculateAllTicketWinnings();
      document.getElementById('modal-agency-form')?.classList.add('hidden');
      this.refreshAllViews();
      this.showToast(`Taquilla ${saved.code} guardada en Receptor ${saved.receptorName}.`, '🏢');
    });
  }

  openAgencyFormModal(agencyCode = null, preselectedReceptorCode = null) {
    this.populateReceptorDropdowns();
    this.populateCollectorDropdowns();
    const modal = document.getElementById('modal-agency-form');
    const title = document.getElementById('modal-agency-title');
    if (!modal) return;

    const globalMult = this.storage.getConfig().multipliers || {};

    if (agencyCode) {
      const ag = this.storage.getAgencyByCode(agencyCode);
      if (!ag) return;
      const allowed = this.storage.getAllowedCurrenciesForAgency(ag.code);
      const agMult = this.storage.getEffectiveMultipliersForAgency(ag.code);

      title.textContent = `✏️ Editar Agencia ${ag.code} - ${ag.name}`;
      document.getElementById('ag-receptor').value = ag.receptorCode || 'FC-CASTANO';
      document.getElementById('ag-code').value = ag.code;
      document.getElementById('ag-serial').value = ag.terminalSerial || this.storage.generateTerminalSerial();
      document.getElementById('ag-name').value = ag.name;
      document.getElementById('ag-zone').value = ag.zone || '';
      document.getElementById('ag-manager').value = ag.manager || '';
      document.getElementById('ag-whatsapp').value = ag.whatsapp || '';
      document.getElementById('ag-collector').value = ag.collector || 'Raúl Zambrano';
      document.getElementById('ag-currency').value = ag.currency || allowed[0] || 'COP';
      document.getElementById('ag-commission').value = ag.commissionPct ?? 15;
      document.getElementById('ag-allow-cop').checked = allowed.includes('COP');
      document.getElementById('ag-allow-usd').checked = allowed.includes('USD');
      document.getElementById('ag-allow-ves').checked = allowed.includes('VES');

      document.getElementById('ag-mult-triple').value = agMult.triple || 500;
      document.getElementById('ag-mult-terminal').value = agMult.terminal || 60;
      document.getElementById('ag-mult-aprox').value = agMult.aproximacion || 5;
      document.getElementById('ag-mult-animalito').value = agMult.animalito || 30;
      document.getElementById('ag-mult-4cifras').value = agMult.cuatroCifrasDirecto || 4500;
      document.getElementById('ag-mult-4comb').value = agMult.cuatroCifrasCombinado || 208;
      document.getElementById('ag-mult-la5ta').value = agMult.la5ta || 25000;
      document.getElementById('ag-mult-astro4').value = agMult.astro4 || 40000;

      document.getElementById('ag-max-bet').value = ag.maxBetLimit ?? 50000;
      document.getElementById('ag-credit-limit').value = ag.creditLimit ?? 2500000;
      document.getElementById('ag-password').value = ag.password || ag.code;
      document.getElementById('ag-status').value = ag.status || 'ACTIVA';
    } else {
      const agencies = this.storage.getAgencies();
      const maxCode = agencies.reduce((max, a) => {
        const num = parseInt(a.code, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 7340);
      const nextCode = String(maxCode + 1);

      title.textContent = '➕ Crear Nueva Agencia / Taquilla POS';
      document.getElementById('ag-receptor').value = preselectedReceptorCode || (this.selectedReceptorCode !== 'ALL' ? this.selectedReceptorCode : 'FC-CASTANO');
      document.getElementById('ag-code').value = nextCode;
      document.getElementById('ag-serial').value = this.storage.generateTerminalSerial();
      document.getElementById('ag-name').value = '';
      document.getElementById('ag-zone').value = 'San Cristóbal (VEN)';
      document.getElementById('ag-manager').value = '';
      document.getElementById('ag-whatsapp').value = '+58414';
      document.getElementById('ag-currency').value = 'COP';
      document.getElementById('ag-commission').value = 15;
      document.getElementById('ag-allow-cop').checked = true;
      document.getElementById('ag-allow-usd').checked = false;
      document.getElementById('ag-allow-ves').checked = false;

      document.getElementById('ag-mult-triple').value = globalMult.triple || 500;
      document.getElementById('ag-mult-terminal').value = globalMult.terminal || 60;
      document.getElementById('ag-mult-aprox').value = globalMult.aproximacion || 5;
      document.getElementById('ag-mult-animalito').value = globalMult.animalito || 30;
      document.getElementById('ag-mult-4cifras').value = globalMult.cuatroCifrasDirecto || 4500;
      document.getElementById('ag-mult-4comb').value = globalMult.cuatroCifrasCombinado || 208;
      document.getElementById('ag-mult-la5ta').value = globalMult.la5ta || 25000;
      document.getElementById('ag-mult-astro4').value = globalMult.astro4 || 40000;

      document.getElementById('ag-max-bet').value = 50000;
      document.getElementById('ag-credit-limit').value = 2500000;
      document.getElementById('ag-password').value = nextCode;
      document.getElementById('ag-status').value = 'ACTIVA';
    }

    modal.classList.remove('hidden');
  }

  renderAgenciesPorReceptorTable(agencies, periodTickets, receptores) {
    const tbody = document.getElementById('agencies-macro-tbody');
    const tfoot = document.getElementById('agencies-macro-tfoot');
    if (!tbody) return;

    const selectedCur = this.storage.getConsolidationCurrency();
    const boxBadge = document.getElementById('agency-table-active-box-badge');
    if (boxBadge) boxBadge.textContent = `🔒 Caja: ${selectedCur}`;

    const recMap = new Map(receptores.map(r => [String(r.code).toUpperCase(), r]));
    const recFilter = document.getElementById('filter-agencias-receptor')?.value || 'ALL';
    const colFilter = document.getElementById('filter-agency-collector')?.value || 'ALL';
    const stFilter = document.getElementById('filter-agency-status')?.value || 'ALL';
    const q = (document.getElementById('agency-search-input')?.value || '').trim().toLowerCase();

    const filtered = agencies.filter(ag => {
      const agRec = String(ag.receptorCode || 'FC-CASTANO').toUpperCase();
      if (recFilter !== 'ALL' && agRec !== recFilter) return false;
      if (colFilter !== 'ALL' && ag.collector !== colFilter) return false;
      if (stFilter !== 'ALL' && ag.status !== stFilter) return false;
      if (q) {
        const recObj = recMap.get(agRec);
        const hay = `${ag.code} ${ag.name} ${ag.zone} ${ag.manager} ${ag.collector} ${ag.terminalSerial} ${agRec} ${recObj ? recObj.name : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400">No se encontraron agencias o taquillas con el filtro actual.</td></tr>`;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let rowsHtml = '';
    let sumAct = 0, sumVoid = 0, sumGross = 0, sumNet = 0, sumComm = 0, sumPrizes = 0, sumUtil = 0;

    filtered.forEach(ag => {
      const m = this.calculateAgencyFinancials(ag, periodTickets);
      const vals = m.boxes[selectedCur] || m.global;
      const agRec = String(ag.receptorCode || 'FC-CASTANO').toUpperCase();
      const recName = (recMap.get(agRec)?.name || ag.receptorName || agRec);
      const isActiva = ag.status === 'ACTIVA';
      const utilPos = vals.bancaUtility >= 0;

      sumAct += vals.activeCount;
      sumVoid += vals.voidCount;
      sumGross += vals.gross;
      sumNet += vals.net;
      sumComm += vals.commission;
      sumPrizes += vals.totalPrizes;
      sumUtil += vals.bancaUtility;

      rowsHtml += `
        <tr>
          <td>
            <span class="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">${this.escapeHtml(agRec)}</span>
            <div class="text-[11px] font-bold text-slate-200 mt-0.5">${this.escapeHtml(recName)}</div>
          </td>
          <td>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-black text-sky-400 text-xs">${this.escapeHtml(ag.code)}</span>
              <div>
                <div class="font-bold text-white leading-tight">${this.escapeHtml(ag.name)}</div>
                <div class="text-[11px] text-slate-400 font-mono">POS: ${this.escapeHtml(ag.terminalSerial || 'N/A')} • Resp: ${this.escapeHtml(ag.manager)}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="font-semibold text-slate-200">${this.escapeHtml(ag.zone)}</div>
            <div class="text-[11px] text-sky-400">🛵 ${this.escapeHtml(ag.collector)}</div>
          </td>
          <td>${isActiva ? '<span class="badge-pill badge-activa">● ACTIVA</span>' : '<span class="badge-pill badge-suspendida">⛔ SUSP.</span>'}</td>
          <td>
            <span class="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold text-xs">${this.storage.getAllowedCurrenciesForAgency(ag.code).join(' / ')}</span>
            <div class="text-[10px] text-slate-400 mt-0.5">Com: ${ag.commissionPct}%</div>
          </td>
          <td class="text-center font-mono">
            <span class="text-emerald-400 font-bold">${vals.activeCount}</span> / <span class="text-rose-400 font-bold">${vals.voidCount}</span>
          </td>
          <td class="text-right font-mono text-slate-200">${this.formatMoney(vals.gross, selectedCur)}</td>
          <td class="text-right font-mono font-bold text-sky-300">${this.formatMoney(vals.net, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(vals.commission, selectedCur)}</td>
          <td class="text-right font-mono font-bold ${vals.totalPrizes > 0 ? 'text-amber-400' : 'text-slate-500'}">
            ${this.formatMoney(vals.totalPrizes, selectedCur)}
            ${vals.pendingPrizes > 0 ? `<div class="text-[10px] text-amber-300">Pend: ${this.formatMoney(vals.pendingPrizes, selectedCur)}</div>` : ''}
          </td>
          <td class="text-right font-mono font-black ${utilPos ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(vals.bancaUtility, selectedCur)}</td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="btn-audit-ag px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]" data-code="${this.escapeHtml(ag.code)}" title="Auditar Ventas, Premios y Tickets">🔍 Auditar</button>
              <button type="button" class="btn-edit-ag px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]" data-code="${this.escapeHtml(ag.code)}" title="Editar / Reasignar Receptor">✏️</button>
              <button type="button" class="btn-toggle-ag px-2 py-1 rounded ${isActiva ? 'bg-rose-950/70 text-rose-300 border border-rose-800' : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'} text-[11px]" data-code="${this.escapeHtml(ag.code)}">${isActiva ? '🔒' : '🔓'}</button>
              <button type="button" class="btn-wa-ag px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold" data-code="${this.escapeHtml(ag.code)}">📲</button>
              <button type="button" class="btn-reset-ag px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px]" data-code="${this.escapeHtml(ag.code)}">🧹</button>
              <button type="button" class="btn-delete-ag px-2 py-1 rounded bg-rose-900/70 text-rose-200 border border-rose-700 text-[11px]" data-code="${this.escapeHtml(ag.code)}">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="5" class="py-3 px-3 text-right uppercase text-xs text-slate-300">
            TOTAL (${filtered.length} Taquillas - Caja ${selectedCur}):
          </td>
          <td class="text-center font-mono text-xs"><span class="text-emerald-400">${sumAct}</span> / <span class="text-rose-400">${sumVoid}</span></td>
          <td class="text-right font-mono text-white">${this.formatMoney(sumGross, selectedCur)}</td>
          <td class="text-right font-mono text-sky-300">${this.formatMoney(sumNet, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(sumComm, selectedCur)}</td>
          <td class="text-right font-mono text-amber-400">${this.formatMoney(sumPrizes, selectedCur)}</td>
          <td class="text-right font-mono text-sm ${sumUtil >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(sumUtil, selectedCur)}</td>
          <td></td>
        </tr>
      `;
    }

    tbody.querySelectorAll('.btn-audit-ag').forEach(btn => btn.addEventListener('click', () => this.openAuditAgencyModal(btn.dataset.code)));
    tbody.querySelectorAll('.btn-edit-ag').forEach(btn => btn.addEventListener('click', () => this.openAgencyFormModal(btn.dataset.code)));
    tbody.querySelectorAll('.btn-toggle-ag').forEach(btn => btn.addEventListener('click', () => {
      const updated = this.storage.toggleAgencyStatus(btn.dataset.code);
      if (updated) {
        this.refreshAllViews();
        this.showToast(`Taquilla ${updated.code} ahora está ${updated.status}`, updated.status === 'ACTIVA' ? '🟢' : '⛔');
      }
    }));
    tbody.querySelectorAll('.btn-wa-ag').forEach(btn => btn.addEventListener('click', () => this.sendAgencyWhatsAppSummary(btn.dataset.code)));
    tbody.querySelectorAll('.btn-reset-ag').forEach(btn => btn.addEventListener('click', () => this.promptResetAgencyToZero(btn.dataset.code)));
    tbody.querySelectorAll('.btn-delete-ag').forEach(btn => btn.addEventListener('click', () => this.handleDeleteAgency(btn.dataset.code)));
  }

  // =========================================================================
  // 8. EXPEDIENTE INDIVIDUAL DE TAQUILLA (#modal-audit-agency)
  // =========================================================================
  bindAuditAgencyModalEvents() {
    document.getElementById('btn-audit-copy-whatsapp')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) this.sendAgencyWhatsAppSummary(this.currentAuditedAgencyCode, true);
    });
    document.getElementById('btn-audit-reset-agency')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) this.promptResetAgencyToZero(this.currentAuditedAgencyCode);
    });
    document.getElementById('btn-audit-delete-agency')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) this.handleDeleteAgency(this.currentAuditedAgencyCode, true);
    });
    document.getElementById('btn-audit-open-pos-as')?.addEventListener('click', () => {
      if (!this.currentAuditedAgencyCode) return;
      const ag = this.storage.getAgencyByCode(this.currentAuditedAgencyCode);
      if (ag) {
        this.storage.authenticatePosAgency(ag.code, ag.password);
        this.showToast(`Taquilla POS activada: ${ag.code} - ${ag.name}`, '🎰');
        window.open('index.html', '_blank');
      }
    });
    document.getElementById('btn-inject-sale')?.addEventListener('click', () => this.injectManualTicketForAuditedAgency(false));
    document.getElementById('btn-inject-prize')?.addEventListener('click', () => this.injectManualTicketForAuditedAgency(true));
  }

  openAuditAgencyModal(agencyCode, forcedCurrency = null) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    this.currentAuditedAgencyCode = ag.code;

    const periodTickets = this.getFilteredTicketsByDate();
    const m = this.calculateAgencyFinancials(ag, periodTickets);
    const allowed = this.storage.getAllowedCurrenciesForAgency(ag.code);
    const cur = forcedCurrency || this.currentAuditedAgencyCurrency ||
      (m.boxes[this.storage.getConsolidationCurrency()]?.totalTicketsCount > 0 ? this.storage.getConsolidationCurrency() : (ag.currency || allowed[0] || 'COP'));
    this.currentAuditedAgencyCurrency = cur;
    const activeBox = m.boxes[cur] || m.boxes.COP;

    const recCode = ag.receptorCode || 'FC-CASTANO';
    const recObj = this.storage.getReceptorByCode(recCode);

    document.getElementById('audit-ag-code').textContent = ag.code;
    document.getElementById('audit-ag-name').textContent = `${ag.name} (Caja ${cur})`;
    const stBadge = document.getElementById('audit-ag-status-badge');
    if (stBadge) {
      stBadge.className = ag.status === 'ACTIVA' ? 'badge-pill badge-activa' : 'badge-pill badge-suspendida';
      stBadge.textContent = ag.status;
    }
    document.getElementById('audit-ag-meta').textContent =
      `Receptor: ${recCode} (${recObj ? recObj.name : ag.receptorName || recCode}) • Serial: ${ag.terminalSerial} • Monedas: ${allowed.join(' / ')} • Cobrador: ${ag.collector}`;

    const auditThreeBoxesEl = document.getElementById('audit-three-boxes-grid');
    if (auditThreeBoxesEl) {
      const boxMeta = {
        COP: { title: '🇨🇴 CAJA PESOS (COP $)', border: 'border-amber-400' },
        USD: { title: '🇺🇸 CAJA DÓLARES (USD $)', border: 'border-emerald-400' },
        VES: { title: '🇻🇪 CAJA BOLÍVARES (VES Bs.)', border: 'border-sky-400' }
      };
      auditThreeBoxesEl.innerHTML = ['COP', 'USD', 'VES'].map(curKey => {
        const b = m.boxes[curKey];
        const isSel = curKey === cur;
        return `
          <div class="audit-currency-box cursor-pointer rounded-xl bg-slate-950 p-3 border ${isSel ? boxMeta[curKey].border + ' ring-2 ring-amber-400/20' : 'border-slate-800 hover:border-slate-700'} transition" data-currency="${curKey}">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span class="text-xs font-black text-white">${boxMeta[curKey].title}</span>
              ${isSel ? '<span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">ACTIVA</span>' : `<span class="text-[10px] text-slate-400">${b.totalTicketsCount} tickets</span>`}
            </div>
            <div class="space-y-1 text-[11px] font-mono">
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Tickets (Act/Anul):</span><strong class="text-white">${b.activeCount} / ${b.voidCount}</strong></div>
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Ventas Brutas:</span><strong class="text-white">${this.formatMoney(b.gross, curKey)}</strong></div>
              <div class="flex justify-between text-sky-300"><span class="font-sans font-bold">Ventas Netas:</span><strong>${this.formatMoney(b.net, curKey)}</strong></div>
              <div class="flex justify-between text-indigo-300"><span class="font-sans">Comisión (${ag.commissionPct}%):</span><strong>-${this.formatMoney(b.commission, curKey)}</strong></div>
              <div class="flex justify-between text-amber-400"><span class="font-sans">Premios (-):</span><strong>-${this.formatMoney(b.totalPrizes, curKey)}</strong></div>
              <div class="flex justify-between pt-1 border-t border-slate-800 ${b.bancaUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black">
                <span class="font-sans uppercase">Saldo:</span>
                <strong>${this.formatMoney(b.bancaUtility, curKey)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('');
      auditThreeBoxesEl.querySelectorAll('.audit-currency-box').forEach(el => {
        el.addEventListener('click', () => this.openAuditAgencyModal(ag.code, el.dataset.currency));
      });
    }

    document.getElementById('audit-kpi-brutas').textContent = this.formatMoney(activeBox.gross, cur);
    document.getElementById('audit-kpi-anulados').textContent = this.formatMoney(activeBox.voided, cur);
    document.getElementById('audit-kpi-netas').textContent = this.formatMoney(activeBox.net, cur);
    document.getElementById('audit-kpi-comision').textContent = `${this.formatMoney(activeBox.commission, cur)} (${ag.commissionPct}%)`;
    document.getElementById('audit-kpi-pagados').textContent = this.formatMoney(activeBox.paidPrizes, cur);
    document.getElementById('audit-kpi-pendientes').textContent = this.formatMoney(activeBox.pendingPrizes, cur);

    const balanceBox = document.getElementById('audit-kpi-balance-box');
    const balanceLabel = document.getElementById('audit-kpi-balance-label');
    const balanceVal = document.getElementById('audit-kpi-balance');
    if (balanceVal) balanceVal.textContent = this.formatMoney(activeBox.bancaUtility, cur);
    if (balanceBox && balanceLabel) {
      if (activeBox.bancaUtility >= 0) {
        balanceBox.className = 'bg-emerald-950/70 p-3 rounded-xl border border-emerald-500/60';
        balanceLabel.className = 'text-[10px] uppercase font-black text-emerald-300';
        balanceLabel.textContent = `Saldo a Entregar (${cur})`;
      } else {
        balanceBox.className = 'bg-rose-950/70 p-3 rounded-xl border border-rose-500/60';
        balanceLabel.className = 'text-[10px] uppercase font-black text-rose-300';
        balanceLabel.textContent = `Saldo a Pagar (${cur})`;
      }
    }

    document.getElementById('audit-cat-sinsigno').textContent = this.formatMoney(activeBox.categoryBreakdown.sin_signo.amount, cur);
    document.getElementById('audit-cat-sinsigno-cnt').textContent = `${activeBox.categoryBreakdown.sin_signo.count} jugadas`;
    document.getElementById('audit-cat-consigno').textContent = this.formatMoney(activeBox.categoryBreakdown.con_signo.amount, cur);
    document.getElementById('audit-cat-consigno-cnt').textContent = `${activeBox.categoryBreakdown.con_signo.count} jugadas`;
    document.getElementById('audit-cat-4cifras').textContent = this.formatMoney(activeBox.categoryBreakdown.cuatro_cifras.amount, cur);
    document.getElementById('audit-cat-4cifras-cnt').textContent = `${activeBox.categoryBreakdown.cuatro_cifras.count} jugadas`;
    document.getElementById('audit-cat-animalitos').textContent = this.formatMoney(activeBox.categoryBreakdown.animalitos.amount, cur);
    document.getElementById('audit-cat-animalitos-cnt').textContent = `${activeBox.categoryBreakdown.animalitos.count} jugadas`;

    const boxTickets = activeBox.tickets || [];
    document.getElementById('audit-tickets-count').textContent = `${boxTickets.length} tickets en Caja ${cur} (Total taquilla: ${m.tickets.length})`;
    const tbody = document.getElementById('audit-agency-tickets-tbody');
    if (tbody) {
      if (boxTickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">Sin tickets emitidos en <strong>${cur}</strong> para el periodo seleccionado.</td></tr>`;
      } else {
        tbody.innerHTML = boxTickets.map(t => this.renderCompactTicketRowHtml(t, true)).join('');
        this.bindTicketRowActionButtons(tbody);
      }
    }

    document.getElementById('modal-audit-agency')?.classList.remove('hidden');
  }

  injectManualTicketForAuditedAgency(isWinningTicket = false) {
    if (!this.currentAuditedAgencyCode) return;
    const ag = this.storage.getAgencyByCode(this.currentAuditedAgencyCode);
    if (!ag) return;

    const catType = document.getElementById('inject-cat')?.value || 'triple';
    const numVal = (document.getElementById('inject-number')?.value || '777').trim();
    const amountVal = Number(document.getElementById('inject-amount')?.value || 10000);
    if (amountVal <= 0) return;

    const targetCur = this.currentAuditedAgencyCurrency || ag.currency || 'COP';
    const agMult = this.storage.getEffectiveMultipliersForAgency(ag.code);
    const ticketId = this.storage.getNextTicketNumber();
    const serial = this.storage.generateSecuritySerial();
    const now = new Date();
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${hr}:${min}:${sec} ${ampm}`;

    let lotteryId = 'CHANCE_A_1300', lotteryName = 'Chance A 1:00 PM', animalName = null, sign = null, multiplier = agMult.triple || 500;
    if (catType === 'terminal') {
      lotteryId = 'NAPA_GANA_1300'; lotteryName = 'Ñapa Gana 1:00 PM'; multiplier = agMult.terminal || 60;
    } else if (catType === 'animalito') {
      lotteryId = 'LOTTO_ACTIVO_1300'; lotteryName = 'Lotto Activo 1:00 PM';
      animalName = (typeof ANIMALITOS_DICT !== 'undefined' && ANIMALITOS_DICT[numVal]?.name) || 'León';
      multiplier = agMult.animalito || 30;
    } else if (catType === 'zodiac') {
      lotteryId = 'TACHIRA_ZODIACAL_1645'; lotteryName = 'Táchira Zodiacal 4:45 PM'; sign = 'LEO'; multiplier = agMult.triple || 500;
    } else if (catType === 'cuatro_cifras') {
      lotteryId = 'DORADO_NOCHE'; lotteryName = 'Dorado Noche 10:05 PM'; multiplier = agMult.cuatroCifrasDirecto || 4500;
    }

    const playItem = { uid: Date.now().toString(36), lotteryId, lotteryName, number: numVal, type: catType, sign, animalName, amount: amountVal };
    const prizeAmount = isWinningTicket ? (amountVal * multiplier) : 0;

    this.storage.saveTicket({
      ticketId,
      serialSeguridad: serial,
      fechaHora: dateStr,
      receptorCode: ag.receptorCode || 'FC-CASTANO',
      receptorName: ag.receptorName || 'FC EL CASTAÑO',
      agencyCode: ag.code,
      agencia: `${ag.code} - ${ag.name}`,
      usuario: ag.code,
      moneda: targetCur,
      items: [playItem],
      total: amountVal,
      estado: isWinningTicket ? 'GANADOR' : 'ACTIVO',
      premioCalculado: prizeAmount,
      winningPlays: isWinningTicket ? [{ ...playItem, winType: `PREMIO ${catType.toUpperCase()}`, multiplier, prize: prizeAmount, resultNumber: numVal }] : []
    });

    this.refreshAllViews();
    this.showToast(`Ticket #${ticketId} inyectado en ${ag.name} (${this.formatMoney(amountVal, targetCur)})`, isWinningTicket ? '🏆' : '⚡');
  }

  sendAgencyWhatsAppSummary(agencyCode, copyToClipboardOnly = false) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    const m = this.calculateAgencyFinancials(ag, this.getFilteredTicketsByDate());
    const allowed = this.storage.getAllowedCurrenciesForAgency(ag.code);
    const currenciesToReport = Array.from(new Set([...allowed, ...['COP', 'USD', 'VES'].filter(c => m.boxes[c].totalTicketsCount > 0)]));

    const boxSections = currenciesToReport.map(cur => {
      const b = m.boxes[cur];
      return [
        `🏦 *CAJA ${cur}*`,
        `🎟️ Tickets: ${b.activeCount} act / ${b.voidCount} anul`,
        `📈 Venta Neta: ${this.formatMoney(b.net, cur)}`,
        `🏪 Comisión (${ag.commissionPct}%): -${this.formatMoney(b.commission, cur)}`,
        `🏆 Premios: -${this.formatMoney(b.totalPrizes, cur)}`,
        `✅ *SALDO (${cur}):* ${this.formatMoney(b.bancaUtility, cur)}`
      ].join('\n');
    }).join('\n----------------------------------\n');

    const text = [
      `🏛️ *BANCA GENERAL MACRO*`,
      `📋 *Receptor:* ${ag.receptorCode || 'FC-CASTANO'} - ${ag.receptorName || 'FC EL CASTAÑO'}`,
      `🏪 *Taquilla:* ${ag.code} - ${ag.name}`,
      `🛵 *Cobrador:* ${ag.collector}`,
      `----------------------------------`,
      boxSections,
      `----------------------------------`,
      `🕒 *Generado:* ${new Date().toLocaleString('es-VE')}`
    ].join('\n');

    navigator.clipboard?.writeText(text).catch(() => {});
    if (copyToClipboardOnly) this.showToast(`Relación de ${ag.name} copiada al portapapeles.`, '📲');

    const cleanPhone = (ag.whatsapp || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  // =========================================================================
  // 9. MÓDULO 3: AUDITORÍA GLOBAL DE TICKETS, PREMIOS Y RIESGO MACRO
  // =========================================================================
  bindTicketsAndRiskEvents() {
    document.getElementById('macro-ticket-receptor-filter')?.addEventListener('change', () => {
      const agSel = document.getElementById('macro-ticket-agency-filter');
      if (agSel) agSel.value = 'ALL';
      this.refreshAllViews();
    });
    document.getElementById('macro-ticket-agency-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('macro-ticket-status-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('macro-ticket-currency-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('macro-ticket-search')?.addEventListener('input', () => this.refreshAllViews());
    document.getElementById('risk-receptor-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('risk-category-filter')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('btn-admin-print-ticket')?.addEventListener('click', () => window.print());
    document.getElementById('btn-admin-wa-ticket')?.addEventListener('click', () => {
      if (this.currentPreviewTicket) this.printer.shareViaWhatsApp(this.currentPreviewTicket);
    });
  }

  renderTicketStatusBadge(status, ticketObj = null) {
    if (ticketObj && ticketObj.clockAuditBlocked) {
      return `<span class="badge-pill badge-anulado" title="${this.escapeHtml(ticketObj.clockAuditReason || 'Reloj adulterado / Fuera de horario')}">🚨 RELOJ ADULTERADO</span>`;
    }
    const st = (status || 'ACTIVO').toUpperCase();
    if (st === 'GANADOR') return `<span class="badge-pill badge-ganador">🏆 GANADOR</span>`;
    if (st === 'PAGADO') return `<span class="badge-pill badge-pagado">💵 PAGADO</span>`;
    if (st === 'ANULADO') return `<span class="badge-pill badge-anulado">🚫 ANULADO</span>`;
    return `<span class="badge-pill badge-activa">ACTIVO</span>`;
  }

  renderCompactTicketRowHtml(t, hideSerial = false) {
    const tCur = (t.moneda || 'COP').toUpperCase();
    const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
    const playsSummary = (t.items || []).map(p => {
      let label = `${this.escapeHtml(p.lotteryName)}: <strong>${this.escapeHtml(p.number)}</strong>`;
      if (p.sign) label += `-${this.escapeHtml(p.sign)}`;
      if (p.animalName) label += ` (${this.escapeHtml(p.animalName)})`;
      if (p.is5ta) label += ` [5ta]`;
      return label;
    }).slice(0, 3).join(' • ') + ((t.items || []).length > 3 ? ` (+${t.items.length - 3})` : '');

    return `
      <tr>
        <td class="font-mono font-bold text-amber-400">
          #${this.escapeHtml(t.ticketId)}
          ${!hideSerial ? `<div class="text-[10px] text-slate-400">${this.escapeHtml(t.serialSeguridad)}</div>` : ''}
        </td>
        ${hideSerial ? `<td class="font-mono text-xs text-slate-300">${this.escapeHtml(t.serialSeguridad)}</td>` : ''}
        <td class="text-xs text-slate-400">${this.escapeHtml(t.fechaHora)}</td>
        ${!hideSerial ? `<td class="text-xs font-bold text-white">${this.escapeHtml(t.agencia)} <span class="text-[10px] text-amber-300">(${tCur})</span></td>` : ''}
        <td class="text-xs text-slate-200">${playsSummary}</td>
        <td class="text-right font-mono font-bold text-white">${this.formatMoney(t.total, tCur)}</td>
        <td class="text-right font-mono font-bold ${prizeVal > 0 ? 'text-amber-400' : 'text-slate-500'}">${this.formatMoney(prizeVal, tCur)}</td>
        <td class="text-center">${this.renderTicketStatusBadge(t.estado, t)}</td>
        <td class="text-center">
          <div class="inline-flex items-center gap-1">
            <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">🖨️</button>
            ${t.estado !== 'PAGADO' && t.estado !== 'ANULADO' ? `<button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">💵</button>` : ''}
            ${t.estado !== 'ANULADO' ? `<button type="button" class="btn-void-admin px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">🚫</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  renderMacroTicketsAndRisk(periodTickets, agencies, receptores) {
    const recMap = new Map(receptores.map(r => [String(r.code).toUpperCase(), r]));
    const recFilter = document.getElementById('macro-ticket-receptor-filter')?.value || 'ALL';
    const agFilterEl = document.getElementById('macro-ticket-agency-filter');
    const stFilter = document.getElementById('macro-ticket-status-filter')?.value || 'ALL';
    const curFilter = document.getElementById('macro-ticket-currency-filter')?.value || 'ALL';
    const q = (document.getElementById('macro-ticket-search')?.value || '').trim().toLowerCase();

    if (agFilterEl) {
      const currentAgVal = agFilterEl.value || 'ALL';
      const scopedAgencies = recFilter === 'ALL'
        ? agencies
        : agencies.filter(a => String(a.receptorCode || 'FC-CASTANO').toUpperCase() === recFilter);
      agFilterEl.innerHTML = '<option value="ALL">Todas las Taquillas</option>';
      scopedAgencies.forEach(a => {
        agFilterEl.innerHTML += `<option value="${this.escapeHtml(a.code)}">${this.escapeHtml(a.code)} - ${this.escapeHtml(a.name)}</option>`;
      });
      agFilterEl.value = scopedAgencies.some(a => String(a.code) === currentAgVal) ? currentAgVal : 'ALL';
    }

    const agFilter = agFilterEl?.value || 'ALL';
    const filtered = periodTickets.filter(t => {
      const tRec = this.storage.extractReceptorCodeFromAgencyOrTicket(t, agencies);
      const tAg = this.storage.extractAgencyCodeFromTicket(t);
      const tCur = (t.moneda || 'COP').toUpperCase();
      if (recFilter !== 'ALL' && tRec !== recFilter) return false;
      if (agFilter !== 'ALL' && String(tAg) !== String(agFilter)) return false;
      if (stFilter !== 'ALL' && t.estado !== stFilter) return false;
      if (curFilter !== 'ALL' && tCur !== curFilter) return false;
      if (q) {
        const recObj = recMap.get(tRec);
        const itemsTxt = (t.items || []).map(p => `${p.lotteryName} ${p.number} ${p.animalName || ''} ${p.sign || ''}`).join(' ');
        const hay = `${t.ticketId} ${t.serialSeguridad} ${t.agencia} ${tRec} ${recObj ? recObj.name : ''} ${itemsTxt}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const summaryBar = document.getElementById('macro-tickets-summary-bar');
    if (summaryBar) {
      const displayCur = curFilter !== 'ALL' ? curFilter : this.storage.getConsolidationCurrency();
      const curTickets = filtered.filter(t => (t.moneda || 'COP').toUpperCase() === displayCur && t.estado !== 'ANULADO');
      const sumSale = curTickets.reduce((s, t) => s + (Number(t.total) || 0), 0);
      const sumPrize = curTickets.reduce((s, t) => s + (Number(t.premioPagado || t.premioCalculado || 0)), 0);
      summaryBar.textContent = `${filtered.length} tickets • Venta (${displayCur}): ${this.formatMoney(sumSale, displayCur)} • Premios: ${this.formatMoney(sumPrize, displayCur)}`;
    }

    const tbody = document.getElementById('macro-tickets-tbody');
    if (tbody) {
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No hay tickets que coincidan con los filtros seleccionados.</td></tr>`;
      } else {
        tbody.innerHTML = filtered.slice(0, 150).map(t => {
          const tRec = this.storage.extractReceptorCodeFromAgencyOrTicket(t, agencies);
          const recName = recMap.get(tRec)?.name || tRec;
          const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
          const cur = (t.moneda || 'COP').toUpperCase();
          const playsDetailHtml = (t.items || []).map(p => {
            let numTag = `<strong class="text-amber-300 font-mono">${this.escapeHtml(p.number)}</strong>`;
            if (p.sign) numTag += ` <span class="text-sky-300 font-bold">${this.escapeHtml(p.sign)}</span>`;
            if (p.animalName) numTag += ` <span class="text-emerald-300">(${this.escapeHtml(p.animalName)})</span>`;
            if (p.is5ta) numTag += ` <span class="text-amber-400 font-bold">[5ta]</span>`;
            return `<div class="text-[11px] leading-snug"><span class="text-slate-200 font-semibold">${this.escapeHtml(p.lotteryName)}:</span> ${numTag} <span class="text-slate-400 font-mono">(${this.formatMoney(p.amount, cur)})</span></div>`;
          }).join('');

          return `
            <tr>
              <td>
                <div class="font-mono font-black text-amber-400">#${this.escapeHtml(t.ticketId)}</div>
                <div class="font-mono text-[10px] text-slate-400">${this.escapeHtml(t.serialSeguridad)}</div>
              </td>
              <td class="text-xs text-slate-300">
                <div>${this.escapeHtml(t.fechaHora)}</div>
                ${t.clockAuditBlocked
                  ? `<div class="text-[10px] text-rose-400 font-bold mt-0.5" title="${this.escapeHtml(t.clockAuditReason || '')}">🚨 Fuera de hora / Adulterado</div>`
                  : (t.serverCreatedAt
                    ? `<div class="text-[10px] text-emerald-400 font-semibold mt-0.5">🔒 Hora Servidor</div>`
                    : '')}
              </td>
              <td>
                <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px]">${this.escapeHtml(tRec)} • ${this.escapeHtml(recName)}</span>
                <div class="font-bold text-white text-xs mt-0.5">${this.escapeHtml(t.agencia)}</div>
                <div class="text-[10px] text-slate-400">Moneda: ${cur}</div>
              </td>
              <td class="text-left max-w-xs space-y-0.5 py-1.5">${playsDetailHtml}</td>
              <td class="text-right font-mono font-bold text-white">${this.formatMoney(t.total, cur)}</td>
              <td class="text-right font-mono font-bold ${prizeVal > 0 ? 'text-amber-400' : 'text-slate-500'}">${this.formatMoney(prizeVal, cur)}</td>
              <td class="text-center">${this.renderTicketStatusBadge(t.estado, t)}</td>
              <td class="text-center">
                <div class="inline-flex items-center gap-1">
                  <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">🖨️</button>
                  ${t.estado !== 'PAGADO' && t.estado !== 'ANULADO' ? `<button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">💵</button>` : ''}
                  ${t.estado !== 'ANULADO' ? `<button type="button" class="btn-void-admin px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">🚫</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
        this.bindTicketRowActionButtons(tbody);
      }
    }

    this.renderRiskSemaphoreTable(periodTickets, agencies);
  }

  bindTicketRowActionButtons(containerEl) {
    containerEl.querySelectorAll('.btn-view-thermal').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticket = this.storage.getTicketById(btn.dataset.id);
        if (ticket) this.openThermalTicketPreview(ticket);
      });
    });

    containerEl.querySelectorAll('.btn-mark-paid').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticket = this.storage.getTicketById(btn.dataset.id);
        if (!ticket) return;
        const evalAudit = this.storage.evaluateTicket(ticket);
        if (ticket.clockAuditBlocked || evalAudit.clockFraudDetected) {
          alert(`🚨 PAGO BLOQUEADO POR AUDITORÍA HORARIA:\n\n${evalAudit.clockAuditReason || ticket.clockAuditReason || 'Ticket emitido fuera de horario o con reloj manipulado.'}`);
          return;
        }
        let prizeToPay = Number(ticket.premioCalculado || 0);
        if (prizeToPay <= 0) {
          const inputPrize = prompt(`Monto de premio PAGADO para Ticket #${ticket.ticketId} (${ticket.moneda}):`, String(ticket.total * 30));
          if (inputPrize === null) return;
          prizeToPay = Number(inputPrize) || 0;
        }
        if (prizeToPay <= 0) return;

        this.storage.updateTicketStatus(ticket.ticketId, 'PAGADO', {
          premioCalculado: prizeToPay,
          premioPagado: prizeToPay,
          fechaPago: new Date().toLocaleString('es-VE')
        });
        this.refreshAllViews();
        this.showToast(`Ticket #${ticket.ticketId} marcado como PAGADO.`, '💵');
      });
    });

    containerEl.querySelectorAll('.btn-void-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticket = this.storage.getTicketById(btn.dataset.id);
        if (!ticket) return;
        if (confirm(`¿Anular administrativamente el Ticket #${ticket.ticketId} de ${ticket.agencia}?`)) {
          this.storage.updateTicketStatus(ticket.ticketId, 'ANULADO', {
            fechaAnulacion: new Date().toLocaleString('es-VE')
          });
          this.refreshAllViews();
          this.showToast(`Ticket #${ticket.ticketId} ANULADO.`, '🚫');
        }
      });
    });
  }

  openThermalTicketPreview(ticket) {
    this.currentPreviewTicket = ticket;
    const html = this.printer.generateReceiptHtml(ticket, { paperWidth: '58mm' });
    const box = document.getElementById('admin-thermal-ticket-box');
    const printArea = document.getElementById('admin-print-area');
    if (box) box.innerHTML = html;
    if (printArea) printArea.innerHTML = html;
    document.getElementById('modal-admin-ticket-preview')?.classList.remove('hidden');
  }

  renderRiskSemaphoreTable(periodTickets, agencies) {
    const tbody = document.getElementById('risk-semaphore-tbody');
    if (!tbody) return;

    const cfg = this.storage.getConfig();
    const selectedCur = this.storage.getConsolidationCurrency();
    const riskRecFilter = document.getElementById('risk-receptor-filter')?.value || 'ALL';
    const catFilter = document.getElementById('risk-category-filter')?.value || 'ALL';

    const activeTickets = periodTickets.filter(t => {
      if (t.estado === 'ANULADO') return false;
      if ((t.moneda || 'COP').toUpperCase() !== selectedCur) return false;
      if (riskRecFilter !== 'ALL' && this.storage.extractReceptorCodeFromAgencyOrTicket(t, agencies) !== riskRecFilter) return false;
      return true;
    });

    const exposureMap = {};
    activeTickets.forEach(t => {
      const tCur = (t.moneda || selectedCur).toUpperCase();
      (t.items || []).forEach(p => {
        if (catFilter !== 'ALL') {
          if (catFilter === 'zodiac' && p.type !== 'zodiac' && p.type !== 'astro') return;
          if (catFilter !== 'zodiac' && p.type !== catFilter) return;
        }
        const key = `${p.lotteryId}__${p.number}__${p.sign || ''}__${p.type}__${tCur}`;
        if (!exposureMap[key]) {
          let mult = cfg.multipliers.triple || 500;
          let maxTope = cfg.topes?.triple || 20000;
          if (p.type === 'terminal') {
            mult = cfg.multipliers.terminal || 60;
            maxTope = cfg.topes?.terminal || 50000;
          } else if (p.type === 'animalito') {
            mult = typeof this.storage.getAnimalitoMultiplier === 'function'
              ? this.storage.getAnimalitoMultiplier(p.lotteryId, p.number, null, cfg.multipliers.animalito || 30).multiplier
              : (cfg.multipliers.animalito || 30);
            maxTope = cfg.topes?.animalito || 30000;
          } else if (p.type === 'astro') {
            mult = cfg.multipliers.astro4 || 40000;
            maxTope = 15000;
          } else if (p.type === 'cuatro_cifras') {
            mult = p.is5ta ? (cfg.multipliers.la5ta || 25000) : (cfg.multipliers.cuatroCifrasDirecto || 4500);
            maxTope = 20000;
          }

          let displayNum = p.number;
          if (p.sign) displayNum += ` - ${p.sign}`;
          if (p.animalName) {
            const emoji = (typeof ANIMALITOS_DICT !== 'undefined' && ANIMALITOS_DICT[p.number]?.emoji) || '🐾';
            displayNum = `${emoji} ${p.number} - ${p.animalName}`;
          }
          if (p.is5ta) displayNum += ` [5ta]`;

          exposureMap[key] = {
            lotteryName: p.lotteryName,
            displayNum,
            type: p.type,
            currency: tCur,
            multiplier: mult,
            totalBetGlobal: 0,
            potentialPrizeGlobal: 0,
            topeGlobal: maxTope,
            betsCount: 0
          };
        }
        const betNative = Number(p.amount) || 0;
        exposureMap[key].totalBetGlobal += betNative;
        exposureMap[key].potentialPrizeGlobal += betNative * exposureMap[key].multiplier;
        exposureMap[key].betsCount++;
      });
    });

    const sorted = Object.values(exposureMap).sort((a, b) => b.totalBetGlobal - a.totalBetGlobal);
    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Sin exposición activa en Caja <strong>${selectedCur}</strong>.</td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.slice(0, 30).map(item => {
      const pct = item.topeGlobal > 0 ? Math.min(100, Math.round((item.totalBetGlobal / item.topeGlobal) * 100)) : 0;
      const rawPct = item.topeGlobal > 0 ? Math.round((item.totalBetGlobal / item.topeGlobal) * 100) : 0;
      let barColor = 'bg-emerald-500', textColor = 'text-emerald-400', riskLabel = 'Bajo';
      if (rawPct >= 85) { barColor = 'bg-rose-500'; textColor = 'text-rose-400'; riskLabel = 'CRÍTICO'; }
      else if (rawPct >= 50) { barColor = 'bg-amber-500'; textColor = 'text-amber-400'; riskLabel = 'Alerta'; }

      return `
        <tr>
          <td>
            <div class="font-bold text-white text-xs">${this.escapeHtml(item.lotteryName)}</div>
            <div class="text-[10px] text-slate-400 uppercase">${item.type} (${item.multiplier}x) • ${item.currency}</div>
          </td>
          <td><span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-black text-amber-300 text-xs">${this.escapeHtml(item.displayNum)}</span></td>
          <td class="text-right font-mono font-bold text-white">${this.formatMoney(item.totalBetGlobal, item.currency)}<div class="text-[10px] text-slate-400">${item.betsCount} jug.</div></td>
          <td class="text-right font-mono font-black text-amber-400">${this.formatMoney(item.potentialPrizeGlobal, item.currency)}</td>
          <td>
            <div class="flex items-center justify-between text-[10px] font-bold mb-1">
              <span class="${textColor}">${riskLabel}</span><span class="font-mono text-slate-300">${rawPct}%</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="${barColor} h-full rounded-full" style="width:${pct}%"></div></div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // 10. MÓDULO 4: CENTRO MAESTRO DE RESULTADOS Y LIQUIDACIÓN MULTI-RECEPTOR
  // =========================================================================
  populateResultsLotterySelect(preserveLotteryId = null) {
    const catSelect = document.getElementById('res-admin-category');
    const lotSelect = document.getElementById('res-admin-lottery');
    const signSelect = document.getElementById('res-admin-sign');
    const dateInput = document.getElementById('res-admin-date');

    if (dateInput && !dateInput.value) {
      const today = new Date();
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    if (signSelect && signSelect.options.length <= 1 && typeof ZODIAC_SIGNS !== 'undefined') {
      signSelect.innerHTML = '<option value="">-- Sin Signo --</option>';
      ZODIAC_SIGNS.forEach(s => {
        signSelect.innerHTML += `<option value="${s.code}">${s.code} - ${s.name}</option>`;
      });
    }

    const filterInput = document.getElementById('res-admin-lottery-filter');
    this.updateAdminLotteriesDropdown = (targetLotId = null) => {
      const cat = catSelect?.value || 'sin_signo';
      const q = (filterInput?.value || '').trim().toLowerCase();
      const catalogList = (typeof LOTTERY_CATALOGS !== 'undefined' && LOTTERY_CATALOGS[cat]) || [];
      const list = catalogList.filter(l => !q || l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q));
      if (lotSelect) {
        const currentSelected = targetLotId || lotSelect.value;
        lotSelect.innerHTML = '';
        list.forEach(l => {
          lotSelect.innerHTML += `<option value="${l.id}">${l.name}</option>`;
        });
        if (currentSelected && list.some(l => l.id === currentSelected)) lotSelect.value = currentSelected;
      }
      document.getElementById('res-admin-sign-box')?.classList.toggle('hidden', cat !== 'con_signo');
      document.getElementById('res-admin-5ta-box')?.classList.toggle('hidden', cat !== 'cuatro_cifras');
      this.updateAdminComodinBox();
    };

    this.updateAdminComodinBox = () => {
      const box = document.getElementById('res-admin-comodin-box');
      const sel = document.getElementById('res-admin-comodin');
      if (!box || !sel) return;
      const cat = catSelect?.value || 'sin_signo';
      const lotId = String(lotSelect?.value || '').toUpperCase();
      if (cat === 'animalitos' && lotId.startsWith('MEGA_ANIMAL')) {
        const prev = sel.value;
        sel.innerHTML = '<option value="">Estándar (30x)</option><option value="MEGA">Comodín MEGA (40x)</option>';
        if (prev === 'MEGA') sel.value = prev;
        box.classList.remove('hidden');
      } else if (cat === 'animalitos' && lotId.startsWith('SELVA_PLUS')) {
        const prev = sel.value;
        sel.innerHTML = '<option value="">Estándar (80x)</option><option value="COMODIN_A">Comodín A (160x)</option><option value="COMODIN_B">Comodín B (200x)</option>';
        if (prev === 'COMODIN_A' || prev === 'COMODIN_B') sel.value = prev;
        box.classList.remove('hidden');
      } else {
        sel.innerHTML = '<option value="">Estándar</option>';
        sel.value = '';
        box.classList.add('hidden');
      }
    };

    if (!this._resultsSelectBound) {
      this._resultsSelectBound = true;
      catSelect?.addEventListener('change', () => this.updateAdminLotteriesDropdown());
      filterInput?.addEventListener('input', () => this.updateAdminLotteriesDropdown());
      lotSelect?.addEventListener('change', () => this.updateAdminComodinBox());
    }
    this.updateAdminLotteriesDropdown(preserveLotteryId);
  }

  findCategoryForLotteryId(lotteryId) {
    if (typeof LOTTERY_CATALOGS === 'undefined') return 'sin_signo';
    for (const catKey of ['sin_signo', 'con_signo', 'cuatro_cifras', 'animalitos']) {
      if ((LOTTERY_CATALOGS[catKey] || []).some(l => l.id === lotteryId)) return catKey;
    }
    return 'sin_signo';
  }

  bindResultsModuleEvents() {
    const numInput = document.getElementById('res-admin-number');
    const catSelect = document.getElementById('res-admin-category');
    const lotSelect = document.getElementById('res-admin-lottery');
    const animalPreview = document.getElementById('res-admin-animal-preview');
    const animalLabel = document.getElementById('res-admin-animal-label');
    const editBanner = document.getElementById('admin-edit-result-banner');
    const btnSyncWeb = document.getElementById('btn-admin-sync-web-results');
    const chkAutoSync = document.getElementById('chk-admin-auto-sync-3min');
    const syncStatusEl = document.getElementById('admin-web-sync-status');

    if (chkAutoSync && window.bancaFcAutoResults) {
      chkAutoSync.checked = window.bancaFcAutoResults.isAdminAutoSyncEnabled();
      chkAutoSync.addEventListener('change', () => {
        window.bancaFcAutoResults.setAdminAutoSyncEnabled(chkAutoSync.checked);
        this.showToast(chkAutoSync.checked ? 'Auto-Sincronización Web activada.' : 'Auto-Sincronización pausada.', '🔄');
      });
    }

    btnSyncWeb?.addEventListener('click', async () => {
      if (!window.bancaFcAutoResults) return;
      const dateKey = document.getElementById('res-admin-date')?.value || new Date().toISOString().split('T')[0];
      const originalHtml = btnSyncWeb.innerHTML;
      btnSyncWeb.disabled = true;
      btnSyncWeb.innerHTML = '<span>⏳</span> Extrayendo Resultados...';
      const syncOutcome = await window.bancaFcAutoResults.syncFromOfficialWeb(dateKey, { silent: false });
      btnSyncWeb.disabled = false;
      btnSyncWeb.innerHTML = originalHtml;

      const totalPublished = syncOutcome?.results?.length || 0;
      const extractedNow = syncOutcome?.extractedCount || 0;
      const warn = window.bancaFcAutoResults.lastSyncWarning;
      if (syncStatusEl) {
        syncStatusEl.textContent = (warn && totalPublished === 0)
          ? `⚠️ ${warn}`
          : `✔ Sincronización Web completada (${totalPublished} sorteos publicados, ${extractedNow} nuevos).`;
      }
      this.refreshAllViews();
      this.showToast(`Sincronización completada (${totalPublished} sorteos publicados).`, '🔄');
    });

    window.addEventListener('banca_fc_official_results_synced', () => this.refreshAllViews());

    this.updateAnimalOrFruitPreview = () => {
      const val = (numInput?.value || '').trim();
      if (catSelect?.value === 'animalitos' && val !== '' && typeof validateAndResolveAnimalForLottery === 'function') {
        const res = validateAndResolveAnimalForLottery(val, lotSelect?.value || '');
        if (res && animalPreview && animalLabel) {
          animalLabel.textContent = res.valid
            ? `${res.emoji} ${res.code} - ${res.name} [${res.operatorLabel}]`
            : `⛔ Nro "${val}" fuera de rango para ${res.operatorLabel}`;
          animalLabel.style.color = res.valid ? '' : '#f87171';
          animalPreview.classList.remove('hidden');
          return;
        }
      }
      animalPreview?.classList.add('hidden');
    };

    numInput?.addEventListener('input', () => this.updateAnimalOrFruitPreview());
    lotSelect?.addEventListener('change', () => this.updateAnimalOrFruitPreview());
    catSelect?.addEventListener('change', () => this.updateAnimalOrFruitPreview());

    document.getElementById('btn-cancel-edit-result')?.addEventListener('click', () => {
      editBanner?.classList.add('hidden');
      if (numInput) numInput.value = '';
      const ball5Input = document.getElementById('res-admin-ball5');
      if (ball5Input) ball5Input.value = '';
      animalPreview?.classList.add('hidden');
    });

    document.getElementById('res-admin-date')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('admin-results-cat-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('admin-results-search-input')?.addEventListener('input', () => this.refreshAllViews());

    document.getElementById('form-admin-load-result')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateKey = document.getElementById('res-admin-date').value;
      const lotteryId = document.getElementById('res-admin-lottery').value;
      let number = document.getElementById('res-admin-number').value.trim();
      const sign = document.getElementById('res-admin-sign').value || null;
      const ball5 = document.getElementById('res-admin-ball5').value.trim() || null;
      if (!number || !lotteryId) return;

      let animalName = null;
      if (catSelect?.value === 'animalitos') {
        if (typeof validateAndResolveAnimalForLottery === 'function') {
          const resolved = validateAndResolveAnimalForLottery(number, lotteryId);
          if (resolved) {
            if (!resolved.valid) {
              alert(`⛔ El número "${number}" no es válido para esta operadora.`);
              return;
            }
            number = resolved.code;
            animalName = resolved.name;
          }
        }
      }

      const now = new Date();
      let hr = now.getHours();
      const min = String(now.getMinutes()).padStart(2, '0');
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;

      const catVal = catSelect?.value;
      const comodinVal = catVal === 'animalitos' ? (document.getElementById('res-admin-comodin')?.value || null) : null;

      const resStats = this.storage.saveResult(dateKey, lotteryId, {
        number,
        sign: catVal === 'con_signo' ? sign : null,
        ball5: catVal === 'cuatro_cifras' ? ball5 : null,
        comodin: comodinVal,
        isMega: comodinVal === 'MEGA',
        animalName,
        timestamp: `${hr}:${min} ${ampm}`,
        origen: 'MANUAL-ADMIN',
        source: 'MANUAL-ADMIN',
        bloqueadoPorAdmin: true,
        verified: true
      });
      if (window.bancaFcAutoResults) {
        await window.bancaFcAutoResults.pushToFirebaseOfficialNode(dateKey, this.storage.getResults(dateKey));
      }

      document.getElementById('res-admin-number').value = '';
      document.getElementById('res-admin-ball5').value = '';
      animalPreview?.classList.add('hidden');
      editBanner?.classList.add('hidden');
      this.refreshAllViews();
      this.showToast(`Resultado publicado y liquidado en todos los receptores. Ganadores: ${resStats.winnersCount}.`, '✅');
    });
  }

  loadResultIntoAdminFormForEdit(dateKey, lotteryId) {
    const r = this.storage.getResults(dateKey)?.[lotteryId];
    if (!r) return;
    const catKey = this.findCategoryForLotteryId(lotteryId);
    document.getElementById('res-admin-category').value = catKey;
    document.getElementById('res-admin-lottery-filter').value = '';
    this.updateAdminLotteriesDropdown?.(lotteryId);
    document.getElementById('res-admin-lottery').value = lotteryId;
    this.updateAdminComodinBox?.();
    document.getElementById('res-admin-comodin').value = r.comodin || (r.isMega ? 'MEGA' : '');
    document.getElementById('res-admin-number').value = r.number || '';
    document.getElementById('res-admin-sign').value = r.sign || '';
    document.getElementById('res-admin-ball5').value = r.ball5 || '';
    this.updateAnimalOrFruitPreview?.();

    const lotObj = typeof findLotteryById === 'function' ? findLotteryById(lotteryId) : null;
    document.getElementById('admin-edit-result-lottery-name').textContent = lotObj ? lotObj.name : lotteryId;
    document.getElementById('admin-edit-result-banner')?.classList.remove('hidden');
    document.getElementById('res-admin-number')?.focus();
  }

  renderResultsAndWinnersView(agencies, receptores) {
    const dateKey = document.getElementById('res-admin-date')?.value || new Date().toISOString().split('T')[0];
    const results = this.storage.getResults(dateKey);
    const allTickets = this.storage.getTickets();
    const globalCur = this.storage.getConsolidationCurrency();
    const recMap = new Map(receptores.map(r => [String(r.code).toUpperCase(), r]));

    const resultsTbody = document.getElementById('admin-results-tbody');
    const winnersTbody = document.getElementById('admin-winning-tickets-tbody');
    const countBadge = document.getElementById('results-count-badge');
    const catFilter = document.getElementById('admin-results-cat-filter')?.value || 'ALL';
    const searchQ = (document.getElementById('admin-results-search-input')?.value || '').trim().toLowerCase();

    const allKeys = Object.keys(results);
    const filteredKeys = allKeys.filter(lotId => {
      if (catFilter !== 'ALL' && this.findCategoryForLotteryId(lotId) !== catFilter) return false;
      if (searchQ) {
        const r = results[lotId] || {};
        const lotObj = typeof findLotteryById === 'function' ? findLotteryById(lotId) : null;
        const hay = `${lotId} ${lotObj ? lotObj.name : ''} ${r.number || ''} ${r.animalName || ''} ${r.sign || ''}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    if (countBadge) countBadge.textContent = `${allKeys.length} Sorteos`;

    if (resultsTbody) {
      if (filteredKeys.length === 0) {
        resultsTbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No hay resultados oficiales publicados para ${dateKey}.</td></tr>`;
      } else {
        resultsTbody.innerHTML = filteredKeys.map(lotId => {
          const r = results[lotId];
          let detail = r.number;
          if (r.sign) detail += ` - ${r.sign}`;
          if (r.animalName) detail += ` (${r.animalName})`;
          if (r.ball5) detail += ` [5ta: ${r.ball5}]`;

          let hitCount = 0;
          const prizeByCur = { COP: 0, USD: 0, VES: 0 };
          allTickets.forEach(t => {
            if (t.estado === 'ANULADO' || this.storage.extractTicketDateIso(t) !== dateKey) return;
            const tCur = (t.moneda || 'COP').toUpperCase();
            (t.winningPlays || []).forEach(wp => {
              if (wp.lotteryId === lotId) {
                hitCount++;
                prizeByCur[tCur] = (prizeByCur[tCur] || 0) + (Number(wp.prize) || 0);
              }
            });
          });

          const prizeHtml = ['COP', 'USD', 'VES'].filter(c => prizeByCur[c] > 0).map(c => `<div>${this.formatMoney(prizeByCur[c], c)}</div>`).join('') || this.formatMoney(0, globalCur);
          const lotObj = typeof findLotteryById === 'function' ? findLotteryById(lotId) : null;
          const isManual = r.bloqueadoPorAdmin || r.origen === 'MANUAL-ADMIN';
          return `
            <tr>
              <td><div class="font-bold text-white text-xs">${this.escapeHtml(lotObj ? lotObj.name : lotId)}</div><div class="text-[10px] text-slate-400 font-mono">${lotId}</div></td>
              <td><span class="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs">${this.escapeHtml(detail)}</span></td>
              <td class="text-xs">${isManual ? '<span class="text-amber-300 font-bold">🛡️ MANUAL</span>' : '<span class="text-sky-300 font-bold">🌐 AUTO-WEB</span>'}<div class="text-[10px] text-slate-400">${r.timestamp || ''}</div></td>
              <td class="text-center font-mono font-bold ${hitCount > 0 ? 'text-amber-400' : 'text-slate-500'}">${hitCount}</td>
              <td class="text-right font-mono font-bold ${hitCount > 0 ? 'text-amber-400' : 'text-slate-500'}">${prizeHtml}</td>
              <td class="text-center">
                <div class="inline-flex items-center gap-1">
                  <button type="button" class="btn-edit-official-res px-2 py-1 rounded bg-blue-600/30 text-sky-300 border border-blue-500/40 text-[11px] font-bold" data-lot="${lotId}">✏️</button>
                  <button type="button" class="btn-del-official-res px-2 py-1 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[11px] font-bold" data-lot="${lotId}">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        resultsTbody.querySelectorAll('.btn-edit-official-res').forEach(btn => btn.addEventListener('click', () => this.loadResultIntoAdminFormForEdit(dateKey, btn.dataset.lot)));
        resultsTbody.querySelectorAll('.btn-del-official-res').forEach(btn => btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este resultado oficial y revertir los premios?')) return;
          this.storage.deleteResult(dateKey, btn.dataset.lot);
          if (window.bancaFcAutoResults) await window.bancaFcAutoResults.pushToFirebaseOfficialNode(dateKey, this.storage.getResults(dateKey));
          this.refreshAllViews();
          this.showToast('Resultado eliminado y tickets recalculados.', '🗑️');
        }));
      }
    }

    if (winnersTbody) {
      const winningTickets = allTickets.filter(t => t.estado === 'GANADOR' || t.estado === 'PAGADO' || (t.premioCalculado && t.premioCalculado > 0));
      if (winningTickets.length === 0) {
        winnersTbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No hay tickets premiados registrados.</td></tr>`;
      } else {
        winnersTbody.innerHTML = winningTickets.map(t => {
          const cur = (t.moneda || 'COP').toUpperCase();
          const prize = Number(t.premioPagado || t.premioCalculado || 0);
          const tRec = this.storage.extractReceptorCodeFromAgencyOrTicket(t, agencies);
          const recName = recMap.get(tRec)?.name || tRec;
          const detail = (t.winningPlays || []).map(wp => `${this.escapeHtml(wp.lotteryName)}: <strong>${this.escapeHtml(wp.number)}</strong> (${wp.multiplier}x)`).join('<br>') || 'Premio Liquidado';
          return `
            <tr>
              <td class="font-mono font-black text-amber-400">#${this.escapeHtml(t.ticketId)}</td>
              <td>
                <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold">${this.escapeHtml(tRec)} • ${this.escapeHtml(recName)}</span>
                <div class="font-bold text-white text-xs mt-0.5">${this.escapeHtml(t.agencia)}</div>
              </td>
              <td class="text-xs text-slate-200">${detail}</td>
              <td class="text-right font-mono text-slate-300">${this.formatMoney(t.total, cur)}</td>
              <td class="text-right font-mono font-black text-amber-400">${this.formatMoney(prize, cur)}</td>
              <td class="text-center">${this.renderTicketStatusBadge(t.estado, t)}</td>
              <td class="text-center">
                <div class="inline-flex items-center gap-1">
                  <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 text-sky-400 text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">🖨️</button>
                  ${t.estado !== 'PAGADO' ? `<button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold" data-id="${this.escapeHtml(t.ticketId)}">Pagar</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
        this.bindTicketRowActionButtons(winnersTbody);
      }
    }
  }

  // =========================================================================
  // 11. MÓDULO 5: CUADRE GENERAL, COBRADORES Y PARÁMETROS MACRO
  // =========================================================================
  loadGlobalMultipliersForm() {
    const cfg = this.storage.getConfig();
    const m = cfg.multipliers || {};
    const topes = cfg.topes || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('param-mult-triple', m.triple || 500);
    setVal('param-mult-terminal', m.terminal || 60);
    setVal('param-mult-aprox', m.aproximacion || 5);
    setVal('param-mult-animalito', m.animalito || 30);
    setVal('param-mult-4cifras', m.cuatroCifrasDirecto || 4500);
    setVal('param-mult-4comb', m.cuatroCifrasCombinado || 208);
    setVal('param-mult-la5ta', m.la5ta || 25000);
    setVal('param-mult-astro4', m.astro4 || 40000);
    setVal('param-tope-triple', topes.triple || 20000);
    setVal('param-tope-terminal', topes.terminal || 50000);
    setVal('param-tope-animalito', topes.animalito || 30000);
    setVal('param-admin-reset-pass', this.storage.getAdminResetPassword());

    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setText('lbl-mult-triple', `${m.triple || 500}x`);
    setText('lbl-mult-terminal', `${m.terminal || 60}x`);
    setText('lbl-mult-aprox', `${m.aproximacion || 5}x`);
    setText('lbl-mult-animalito', `${m.animalito || 30}x`);
    setText('lbl-mult-4cifras', `${m.cuatroCifrasDirecto || 4500}x`);
    setText('lbl-mult-astro', `${m.astro4 || 40000}x`);
  }

  bindCollectorsAndParamsEvents() {
    document.getElementById('btn-add-collector')?.addEventListener('click', () => {
      const input = document.getElementById('input-new-collector-name');
      const name = (input?.value || '').trim();
      if (!name) return;
      this.storage.addCollector(name);
      input.value = '';
      this.populateCollectorDropdowns();
      this.refreshAllViews();
      this.showToast(`Cobrador "${name}" agregado.`, '🛵');
    });

    document.getElementById('form-global-multipliers')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = this.storage.getConfig();
      const newMultipliers = {
        ...cfg.multipliers,
        triple: Number(document.getElementById('param-mult-triple').value) || 500,
        terminal: Number(document.getElementById('param-mult-terminal').value) || 60,
        aproximacion: Number(document.getElementById('param-mult-aprox').value) || 5,
        animalito: Number(document.getElementById('param-mult-animalito').value) || 30,
        cuatroCifrasDirecto: Number(document.getElementById('param-mult-4cifras').value) || 4500,
        cuatroCifrasCombinado: Number(document.getElementById('param-mult-4comb').value) || 208,
        la5ta: Number(document.getElementById('param-mult-la5ta').value) || 25000,
        astro4: Number(document.getElementById('param-mult-astro4').value) || 40000
      };
      const newTopes = {
        triple: Number(document.getElementById('param-tope-triple').value) || 20000,
        terminal: Number(document.getElementById('param-tope-terminal').value) || 50000,
        animalito: Number(document.getElementById('param-tope-animalito').value) || 30000
      };
      const newResetPass = (document.getElementById('param-admin-reset-pass')?.value || '').trim() || 'osrovzlo2026';

      const master = this.storage.getMasterData();
      if (Array.isArray(master.agencies)) {
        master.agencies.forEach(ag => { ag.multipliers = { ...(ag.multipliers || {}), ...newMultipliers }; });
        this.storage.saveMasterData(master, false);
      }

      this.storage.updateConfig({ multipliers: newMultipliers, topes: newTopes, adminResetPassword: newResetPass });
      this.storage.recalculateAllTicketWinnings();
      this.loadGlobalMultipliersForm();
      this.refreshAllViews();
      this.showToast('Parámetros globales y contraseña maestra actualizados.', '⚙️');
    });
  }

  renderCuadreAndCollectors(receptorMetricsList, agencies, periodTickets) {
    const cuadreTbody = document.getElementById('cuadre-receptores-tbody');
    if (cuadreTbody) {
      cuadreTbody.innerHTML = receptorMetricsList.map(m => {
        const rec = m.receptor;
        const cCop = m.boxes.COP.macroUtility;
        const cUsd = m.boxes.USD.macroUtility;
        const cVes = m.boxes.VES.macroUtility;
        return `
          <tr>
            <td>
              <div class="font-black text-white text-xs">${this.escapeHtml(rec.code)} - ${this.escapeHtml(rec.name)}</div>
              <div class="text-[10px] text-slate-400">Com. Receptor: ${rec.receptorCommissionPct ?? 5}%</div>
            </td>
            <td class="text-center font-mono text-sky-400 font-bold">${m.agenciesCount}</td>
            <td class="text-right font-mono font-bold ${cCop >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(cCop, 'COP')}</td>
            <td class="text-right font-mono font-bold ${cUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(cUsd, 'USD')}</td>
            <td class="text-right font-mono font-bold ${cVes >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(cVes, 'VES')}</td>
            <td class="text-center">
              <button type="button" class="btn-cuadre-wa-rec px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold" data-code="${this.escapeHtml(rec.code)}">📲 Corte</button>
            </td>
          </tr>
        `;
      }).join('');
      cuadreTbody.querySelectorAll('.btn-cuadre-wa-rec').forEach(btn => {
        btn.addEventListener('click', () => this.sendReceptorWhatsAppSummary(btn.dataset.code));
      });
    }

    const colTbody = document.getElementById('collectors-summary-tbody');
    if (!colTbody) return;
    const collectors = this.storage.getCollectors();
    const selectedCur = this.storage.getConsolidationCurrency();

    colTbody.innerHTML = collectors.map(colName => {
      const assigned = agencies.filter(a => a.collector === colName);
      const routeBoxes = {
        COP: { net: 0, commission: 0, prizes: 0, utility: 0 },
        USD: { net: 0, commission: 0, prizes: 0, utility: 0 },
        VES: { net: 0, commission: 0, prizes: 0, utility: 0 }
      };
      assigned.forEach(ag => {
        const m = this.calculateAgencyFinancials(ag, periodTickets);
        ['COP', 'USD', 'VES'].forEach(c => {
          routeBoxes[c].net += m.boxes[c].net;
          routeBoxes[c].commission += m.boxes[c].commission;
          routeBoxes[c].prizes += m.boxes[c].totalPrizes;
          routeBoxes[c].utility += m.boxes[c].bancaUtility;
        });
      });

      const act = routeBoxes[selectedCur] || routeBoxes.COP;
      const badges = ['COP', 'USD', 'VES'].map(c =>
        `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono ${routeBoxes[c].utility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${c}: ${this.formatMoney(routeBoxes[c].utility, c)}</span>`
      ).join(' ');

      return `
        <tr>
          <td><div class="font-bold text-white">🛵 ${this.escapeHtml(colName)}</div><div class="mt-1 flex flex-wrap gap-1">${badges}</div></td>
          <td class="text-center font-mono text-sky-400 font-bold">${assigned.length}</td>
          <td class="text-right font-mono text-slate-200">${this.formatMoney(act.net, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(act.commission, selectedCur)}</td>
          <td class="text-right font-mono text-amber-400">${this.formatMoney(act.prizes, selectedCur)}</td>
          <td class="text-right font-mono font-black ${act.utility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(act.utility, selectedCur)}</td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="btn-wa-collector px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold" data-collector="${this.escapeHtml(colName)}">📲 WA</button>
              <button type="button" class="btn-del-collector px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold" data-collector="${this.escapeHtml(colName)}">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    colTbody.querySelectorAll('.btn-del-collector').forEach(btn => btn.addEventListener('click', () => this.handleDeleteCollector(btn.dataset.collector)));
    colTbody.querySelectorAll('.btn-wa-collector').forEach(btn => {
      btn.addEventListener('click', () => {
        const colName = btn.dataset.collector;
        const assigned = agencies.filter(a => a.collector === colName);
        const totals = { COP: 0, USD: 0, VES: 0 };
        const lines = [`🏛️ *BANCA GENERAL MACRO*`, `🛵 *RUTA COBRADOR:* ${colName}`, `----------------------------------`];
        assigned.forEach(ag => {
          const m = this.calculateAgencyFinancials(ag, periodTickets);
          const parts = ['COP', 'USD', 'VES']
            .filter(c => m.boxes[c].totalTicketsCount > 0 || (ag.allowedCurrencies || []).includes(c))
            .map(c => {
              totals[c] += m.boxes[c].bancaUtility;
              return `${c}: ${this.formatMoney(m.boxes[c].bancaUtility, c)}`;
            });
          lines.push(`• *${ag.code} ${ag.name}:* ${parts.join(' | ')}`);
        });
        lines.push(`----------------------------------`, `COP: ${this.formatMoney(totals.COP, 'COP')} | USD: ${this.formatMoney(totals.USD, 'USD')} | VES: ${this.formatMoney(totals.VES, 'VES')}`);
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
      });
    });
  }

  // =========================================================================
  // 12. EXPORTACIÓN CSV MACRO, SIMULADOR, SINCRONIZACIÓN Y RESETEO PROTEGIDO
  // =========================================================================
  simulateIncomingPosTicket() {
    const activeAgencies = this.storage.getAgencies().filter(a => a.status === 'ACTIVA');
    if (activeAgencies.length === 0) return alert('No hay taquillas activas.');
    const randomAg = activeAgencies[Math.floor(Math.random() * activeAgencies.length)];
    const ticketId = this.storage.getNextTicketNumber();
    const serial = this.storage.generateSecuritySerial();
    const now = new Date();
    let hr = now.getHours();
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${hr}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${ampm}`;
    const amount = randomAg.currency === 'VES' ? 250 : 10000;

    this.storage.saveTicket({
      ticketId,
      serialSeguridad: serial,
      fechaHora: dateStr,
      receptorCode: randomAg.receptorCode || 'FC-CASTANO',
      receptorName: randomAg.receptorName || 'FC EL CASTAÑO',
      agencyCode: randomAg.code,
      agencia: `${randomAg.code} - ${randomAg.name}`,
      usuario: randomAg.code,
      moneda: randomAg.currency || 'COP',
      items: [{ uid: Date.now().toString(36), lotteryId: 'CHANCE_A_1300', lotteryName: 'Chance A 1:00 PM', number: String(Math.floor(100 + Math.random() * 900)), type: 'triple', amount }],
      total: amount,
      estado: 'ACTIVO',
      premioCalculado: 0
    });

    this.refreshAllViews();
    this.showToast(`Venta recibida en ${randomAg.receptorName || 'FC EL CASTAÑO'} → ${randomAg.name} (#${ticketId})`, '🎰');
  }

  exportMacroReportCsv() {
    const periodTickets = this.getFilteredTicketsByDate();
    const agencies = this.storage.getAgencies();
    const receptores = this.storage.getReceptores();
    const recMap = new Map(receptores.map(r => [String(r.code).toUpperCase(), r]));

    let csv = '\uFEFF';
    csv += 'REPORTE CONSOLIDADO MACRO - BANCA GENERAL (MULTI-RECEPTOR)\n';
    csv += `Fecha Generacion,${new Date().toLocaleString('es-VE')},Contabilidad,3 Cajas Separadas (Sin Conversion)\n\n`;
    csv += 'Receptor Codigo,Receptor Nombre,Agencia Codigo,Agencia Nombre,Zona,Cobrador,Estado,Comision Taquilla %,Caja Moneda,Tickets Activos,Tickets Anulados,Venta Bruta,Anulados,Venta Neta,Comision Agencia,Premios,Utilidad Taquilla\n';

    agencies.forEach(ag => {
      const m = this.calculateAgencyFinancials(ag, periodTickets);
      const recCode = String(ag.receptorCode || 'FC-CASTANO').toUpperCase();
      const recName = recMap.get(recCode)?.name || ag.receptorName || recCode;
      ['COP', 'USD', 'VES'].forEach(curKey => {
        const b = m.boxes[curKey];
        if (b.totalTicketsCount > 0 || (ag.allowedCurrencies || [ag.currency]).includes(curKey)) {
          csv += [
            recCode,
            `"${recName}"`,
            ag.code,
            `"${ag.name}"`,
            `"${ag.zone}"`,
            `"${ag.collector}"`,
            ag.status,
            ag.commissionPct,
            curKey,
            b.activeCount,
            b.voidCount,
            b.gross.toFixed(2),
            b.voided.toFixed(2),
            b.net.toFixed(2),
            b.commission.toFixed(2),
            b.totalPrizes.toFixed(2),
            b.bancaUtility.toFixed(2)
          ].join(',') + '\n';
        }
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Banca_General_Macro_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Reporte Macro Excel / CSV descargado.', '📥');
  }

  bindRealtimeSync() {
    window.bancaFcServerClock?.startPeriodicSync();

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.MASTER_DB || e.key === STORAGE_KEYS.TICKETS || e.key === STORAGE_KEYS.RESULTS) {
        this.refreshAllViews();
        this.showToast('Movimiento en vivo sincronizado.', '📡');
      }
    });
    window.addEventListener('banca_fc_data_updated', () => {
      this.ensureSecurityBaselineAndAuditTickets();
      this.refreshAllViews();
    });
    setInterval(() => this.storage.pullFromRemoteServer(), 3000);
  }

  ensureSecurityBaselineAndAuditTickets() {
    try {
      const cloud = window.bancaFcCloud;
      if (!cloud || !cloud.isConnected) return;
      const master = this.storage.getMasterData();
      if (!master || !master.config) return;

      let changed = false;
      if (!master.config.securityBaselineTicketNumber) {
        let maxId = Math.max(0, Number(master.config.nextTicketNumber || 1) - 1);
        (master.tickets || []).forEach(t => {
          const n = parseInt(String(t.ticketId || '').replace(/\D/g, ''), 10);
          if (Number.isFinite(n) && n > maxId) maxId = n;
        });
        master.config.securityBaselineTicketNumber = maxId;
        changed = true;
        const cfgEndpoint = cloud.getDatabaseEndpoint('/banca_fc_master/config.json');
        if (cfgEndpoint) {
          fetch(cfgEndpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ securityBaselineTicketNumber: maxId })
          }).catch(() => {});
        }
      }

      const baseline = Number(master.config.securityBaselineTicketNumber || 0);
      let fraudFoundCount = 0;
      (master.tickets || []).forEach(t => {
        if (t.estado === 'ANULADO') return;
        const n = parseInt(String(t.ticketId || '').replace(/\D/g, ''), 10);
        const shouldAudit = Boolean(t.serverCreatedAt) || (baseline > 0 && Number.isFinite(n) && n > baseline);
        if (!shouldAudit) return;
        const evalRes = this.storage.evaluateTicket(t);
        if (evalRes.clockFraudDetected && !t.clockAuditBlocked) {
          t.clockAuditBlocked = true;
          t.clockAuditReason = evalRes.clockAuditReason || 'Manipulación de horario detectada';
          t.premioCalculado = 0;
          t.premioPagado = 0;
          t.winningPlays = [];
          if (t.estado === 'GANADOR') t.estado = 'ACTIVO';
          t.updatedAt = new Date().toISOString();
          changed = true;
          fraudFoundCount++;
        }
      });

      if (changed) {
        this.storage.saveMasterData(master, true, fraudFoundCount > 0);
        if (fraudFoundCount > 0) {
          this.showToast(`🚨 AUDITORÍA HORARIA: ${fraudFoundCount} ticket(s) bloqueado(s) por reloj manipulado / fuera de hora.`, '🚨');
        }
      }
    } catch (_) {}
  }

  openNetworkSyncModal() {
    document.getElementById('modal-network-sync')?.classList.remove('hidden');
    this.updateFirebaseModalView();
  }

  updateFirebaseModalView() {
    const inputEl = document.getElementById('input-firebase-db-url');
    const shareBox = document.getElementById('fb-share-links-box');
    const shareInput = document.getElementById('input-share-pos-url');
    const statusBadge = document.getElementById('fb-modal-status-badge');

    if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
      if (inputEl) inputEl.value = window.bancaFcCloud.databaseURL;
      shareBox?.classList.remove('hidden');
      if (shareInput) shareInput.value = window.bancaFcCloud.getShareablePosUrl();
      if (statusBadge) {
        statusBadge.className = 'badge-pill badge-activa';
        statusBadge.textContent = '🟢 Firebase Conectado en Vivo';
      }
    } else {
      shareBox?.classList.add('hidden');
      if (statusBadge) {
        statusBadge.className = 'badge-pill badge-suspendida';
        statusBadge.textContent = 'Sin configurar';
      }
    }
  }

  handleDeleteAgency(agencyCode, closeAuditModalAfter = false) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    if (!confirm(`⚠️ ¿Eliminar la Taquilla ${ag.code} - ${ag.name} y sus tickets?`)) return;
    this.storage.deleteAgency(ag.code, true);
    if (closeAuditModalAfter || this.currentAuditedAgencyCode === ag.code) {
      this.currentAuditedAgencyCode = null;
      document.getElementById('modal-audit-agency')?.classList.add('hidden');
    }
    this.refreshAllViews();
    this.showToast(`Agencia ${ag.code} eliminada.`, '🗑️');
  }

  openManageCollectorsModal() {
    this.renderModalCollectorsList();
    document.getElementById('modal-manage-collectors')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-input-collector-name')?.focus(), 80);
  }

  renderModalCollectorsList() {
    const container = document.getElementById('modal-collectors-list');
    if (!container) return;
    const collectors = this.storage.getCollectors();
    const agencies = this.storage.getAgencies();
    container.innerHTML = collectors.length === 0
      ? `<div class="text-xs text-slate-400 py-3 text-center">No hay cobradores registrados.</div>`
      : collectors.map(cName => {
          const count = agencies.filter(a => a.collector === cName).length;
          return `
            <div class="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
              <div><div class="text-xs font-bold text-white">🛵 ${this.escapeHtml(cName)}</div><div class="text-[10px] text-slate-400">${count} taquillas</div></div>
              <button type="button" class="btn-modal-del-collector px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold" data-name="${this.escapeHtml(cName)}">🗑️</button>
            </div>
          `;
        }).join('');
    container.querySelectorAll('.btn-modal-del-collector').forEach(btn => btn.addEventListener('click', () => this.handleDeleteCollector(btn.dataset.name)));
  }

  handleDeleteCollector(name) {
    if (!name || !confirm(`¿Eliminar cobrador "${name}"?`)) return;
    this.storage.deleteCollector(name);
    this.populateCollectorDropdowns();
    this.renderModalCollectorsList();
    this.refreshAllViews();
    this.showToast(`Cobrador "${name}" eliminado.`, '🗑️');
  }

  promptResetAgencyToZero(agencyCode) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    this.openPasswordResetModal({
      mode: 'AGENCY',
      agencyCode: ag.code,
      title: `🔐 Reiniciar Taquilla ${ag.code} en Cero`,
      description: `⚠️ Se dejarán en CERO las ventas, premios y tickets de <strong>${this.escapeHtml(ag.code)} - ${this.escapeHtml(ag.name)}</strong>.`
    });
  }

  openPasswordResetModal(configObj) {
    this.pendingResetAction = configObj;
    document.getElementById('modal-reset-title').innerHTML = configObj.title || '🔐 Autorización';
    document.getElementById('modal-reset-description').innerHTML = configObj.description || '';
    const inputEl = document.getElementById('input-reset-password');
    if (inputEl) inputEl.value = '';
    document.getElementById('reset-password-error')?.classList.add('hidden');
    document.getElementById('modal-password-reset')?.classList.remove('hidden');
    setTimeout(() => inputEl?.focus(), 80);
  }

  executePasswordProtectedReset() {
    if (!this.pendingResetAction) return;
    const inputEl = document.getElementById('input-reset-password');
    const errEl = document.getElementById('reset-password-error');
    const typedPass = (inputEl?.value || '').trim();

    let isAuthorized = this.storage.verifyAdminResetPassword(typedPass);
    if (!isAuthorized && this.pendingResetAction.mode === 'AGENCY' && this.pendingResetAction.agencyCode) {
      const ag = this.storage.getAgencyByCode(this.pendingResetAction.agencyCode);
      if (ag && ag.password && typedPass === String(ag.password)) isAuthorized = true;
    }

    if (!isAuthorized) {
      errEl?.classList.remove('hidden');
      inputEl?.select();
      return;
    }

    errEl?.classList.add('hidden');
    document.getElementById('modal-password-reset')?.classList.add('hidden');

    if (this.pendingResetAction.mode === 'GLOBAL') {
      this.storage.resetDatabaseToZero(true);
      this.refreshAllViews();
      this.showToast('✅ Base de datos global reiniciada en CERO.', '🔓');
    } else if (this.pendingResetAction.mode === 'RECEPTOR' && this.pendingResetAction.receptorCode) {
      this.storage.resetReceptorToZero(this.pendingResetAction.receptorCode);
      this.refreshAllViews();
      this.showToast(`✅ Receptor ${this.pendingResetAction.receptorCode} reiniciado en CERO.`, '🧹');
    } else if (this.pendingResetAction.mode === 'AGENCY' && this.pendingResetAction.agencyCode) {
      this.storage.resetAgencyToZero(this.pendingResetAction.agencyCode);
      this.refreshAllViews();
      this.showToast(`✅ Taquilla ${this.pendingResetAction.agencyCode} reiniciada en CERO.`, '🧹');
    }

    this.pendingResetAction = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.bancaGeneralMacro = new BancaGeneralMacroController(storage, printer);
});
