// js/admin.js - Controlador Central de Banca FC Fernando Castaño
// Sincronización en tiempo real con el POS mediante localStorage ('banca_fc_data')

class BancaFcAdminController {
  constructor(storageMgr, printerMgr) {
    this.storage = storageMgr || storage;
    this.printer = printerMgr || printer;
    this.activeTab = 'tab-agencias';
    this.currentAuditedAgencyCode = null;
    this.currentPreviewTicket = null;
    this.init();
  }

  init() {
    this.setupAdminLoginGate();
    this.loadHeaderControls();
    this.bindHeaderEvents();
    this.bindTabNavigation();
    this.bindAgencyModuleEvents();
    this.bindAuditModalEvents();
    this.bindTicketsAndRiskEvents();
    this.bindResultsModuleEvents();
    this.bindCollectorsAndParamsEvents();
    this.bindRealtimeSync();

    this.populateCollectorDropdowns();
    this.populateResultsLotterySelect();
    this.loadGlobalMultipliersForm();
    this.refreshAllViews();
  }

  setupAdminLoginGate() {
    const loginModal = document.getElementById('modal-admin-login');
    const loginForm = document.getElementById('form-admin-login');
    const passInput = document.getElementById('input-admin-login-pass');
    const errEl = document.getElementById('admin-login-error');
    const lockBtn = document.getElementById('btn-lock-admin');

    if (!loginModal) return;

    const isUnlocked = sessionStorage.getItem('banca_fc_admin_unlocked') === 'true';
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
        sessionStorage.setItem('banca_fc_admin_unlocked', 'true');
        loginModal.classList.add('hidden');
        errEl?.classList.add('hidden');
        if (passInput) passInput.value = '';
        this.showToast('Bienvenido al Panel Central de Banca FC Fernando Castaño.', '🔓');
      } else {
        errEl?.classList.remove('hidden');
        passInput?.select();
      }
    });

    lockBtn?.addEventListener('click', () => {
      sessionStorage.removeItem('banca_fc_admin_unlocked');
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
    } else {
      return `${sign}USD $${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // Parseo de fecha DD/MM/YYYY de los tickets a objeto Date
  parseTicketDate(fechaHoraStr) {
    if (!fechaHoraStr) return new Date();
    const datePart = fechaHoraStr.split(' ')[0];
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

    if (filterType === 'TODAY') {
      return tDayStart === todayStart;
    }
    if (filterType === 'YESTERDAY') {
      return tDayStart === (todayStart - oneDayMs);
    }
    if (filterType === 'WEEK') {
      return tDayStart >= (todayStart - 7 * oneDayMs) && tDayStart <= todayStart;
    }
    if (filterType === 'MONTH') {
      return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    }
    if (filterType === 'CUSTOM') {
      const fromVal = document.getElementById('filter-date-from')?.value;
      const toVal = document.getElementById('filter-date-to')?.value;
      let ok = true;
      if (fromVal) {
        const [fy, fm, fd] = fromVal.split('-').map(Number);
        const fromMs = new Date(fy, fm - 1, fd).getTime();
        if (tDayStart < fromMs) ok = false;
      }
      if (toVal) {
        const [ty, tm, td] = toVal.split('-').map(Number);
        const toMs = new Date(ty, tm - 1, td).getTime();
        if (tDayStart > toMs) ok = false;
      }
      return ok;
    }
    return true;
  }

  getFilteredTicketsByDate() {
    const allTickets = this.storage.getTickets();
    return allTickets.filter(t => this.isTicketInDateFilter(t));
  }

  // Calcula las 3 Cajas Independientes (COP, USD, VES) de una agencia con CERO conversión de tasas
  calculateAgencyFinancials(agency, periodTickets) {
    const agencyTickets = periodTickets.filter(t => {
      const code = this.storage.extractAgencyCodeFromTicket(t);
      return String(code) === String(agency.code);
    });

    const nativeCur = (agency.currency || 'COP').toUpperCase();
    const selectedCur = this.storage.getConsolidationCurrency();
    const commissionPct = Number(agency.commissionPct ?? 15);

    // Calcular las 3 cajas independientes sin mezclar ni convertir monedas
    const boxes = this.storage.calculateThreeCurrencyBoxes(agencyTickets, commissionPct);
    const nativeBox = boxes[nativeCur] || boxes.COP;
    const selectedBox = boxes[selectedCur] || boxes.COP;

    return {
      agency,
      tickets: agencyTickets,
      boxes,
      activeCount: selectedBox.activeCount,
      voidCount: selectedBox.voidCount,
      totalTicketsCount: selectedBox.totalTicketsCount,
      nativeCurrency: nativeCur,
      selectedCurrency: selectedCur,
      commissionPct,
      native: nativeBox,
      global: selectedBox,
      categoryBreakdown: selectedBox.categoryBreakdown
    };
  }

  // =========================================================================
  // 1. CONTROLES DE CABECERA GLOBAL (FILTRO DE CAJA/MONEDA Y FECHAS)
  // =========================================================================
  loadHeaderControls() {
    const curSelector = document.getElementById('global-currency-selector');
    if (curSelector) {
      curSelector.value = this.storage.getConsolidationCurrency();
    }

    const todayIso = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('filter-date-from');
    const toInput = document.getElementById('filter-date-to');
    if (fromInput && !fromInput.value) fromInput.value = todayIso;
    if (toInput && !toInput.value) toInput.value = todayIso;
  }

  bindHeaderEvents() {
    const curSelector = document.getElementById('global-currency-selector');
    curSelector?.addEventListener('change', (e) => {
      this.storage.setConsolidationCurrency(e.target.value);
      this.refreshAllViews();
      this.showToast(`Filtro de Caja cambiado a ${e.target.value} (Contabilidad independiente sin conversión)`, '🏦');
    });

    // Filtro de fecha
    const dateFilter = document.getElementById('global-date-filter');
    const customBox = document.getElementById('custom-date-range-box');
    dateFilter?.addEventListener('change', (e) => {
      if (e.target.value === 'CUSTOM') {
        customBox?.classList.remove('hidden');
      } else {
        customBox?.classList.add('hidden');
      }
      this.refreshAllViews();
    });

    document.getElementById('filter-date-from')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('filter-date-to')?.addEventListener('change', () => this.refreshAllViews());

    // Botones de acción rápida en cabecera
    document.getElementById('btn-header-new-agency')?.addEventListener('click', () => this.openAgencyFormModal(null));
    document.getElementById('btn-open-new-agency-2')?.addEventListener('click', () => this.openAgencyFormModal(null));

    document.getElementById('btn-header-load-results')?.addEventListener('click', () => {
      this.switchTab('tab-resultados');
      document.getElementById('res-admin-number')?.focus();
    });

    document.getElementById('btn-header-export-csv')?.addEventListener('click', () => this.exportGlobalReportCsv());

    // Simular venta POS en vivo para pruebas
    document.getElementById('btn-simulate-live-sale')?.addEventListener('click', () => this.simulateIncomingPosTicket());

    // Abrir Modal de Conexión Nube Firebase / Multiequipo
    document.getElementById('btn-open-network-modal')?.addEventListener('click', () => this.openNetworkSyncModal());
    document.getElementById('btn-header-firebase-config')?.addEventListener('click', () => this.openNetworkSyncModal());
    document.getElementById('header-firebase-status-badge')?.addEventListener('click', () => this.openNetworkSyncModal());

    // Formulario de Configuración de Google Firebase Realtime Database
    document.getElementById('form-firebase-config')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputEl = document.getElementById('input-firebase-db-url');
      const rawVal = (inputEl?.value || '').trim();
      if (!rawVal || !window.bancaFcCloud) return;

      const btn = document.getElementById('btn-save-firebase-url');
      if (btn) btn.textContent = '⏳ Conectando con Firebase...';

      const res = await window.bancaFcCloud.saveConfig(rawVal);
      if (btn) btn.textContent = '☁️ Guardar y Conectar con Firebase Ahora';

      if (res.ok) {
        this.updateFirebaseModalView();
        this.refreshAllViews();
        this.showToast('✅ Conectado en tiempo real con Google Firebase.', '☁️');
      } else {
        alert('❌ Error al conectar con Firebase:\n' + (res.error || 'Verifique que la URL termine en .firebaseio.com y esté en Modo de Prueba.'));
      }
    });

    document.getElementById('btn-disconnect-firebase')?.addEventListener('click', () => {
      if (!window.bancaFcCloud) return;
      if (confirm('¿Desea desconectar la sincronización en la nube de Firebase en este navegador?')) {
        window.bancaFcCloud.disconnect();
        this.updateFirebaseModalView();
        this.showToast('Sincronización Firebase desconectada.', '☁️');
      }
    });

    document.getElementById('btn-copy-share-pos-url')?.addEventListener('click', () => {
      const shareInput = document.getElementById('input-share-pos-url');
      if (!shareInput || !shareInput.value) return;
      shareInput.select();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareInput.value).catch(() => {});
      }
      this.showToast('📋 Enlace de Taquilla POS con Firebase copiado al portapapeles.', '📲');
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
      this.refreshAllViews();
      this.showToast(updated ? 'Sincronización con la nube Firebase completada.' : 'El Panel Administrativo ya está al día.', '☁️');
    });
    document.getElementById('btn-export-master-json')?.addEventListener('click', () => {
      const jsonStr = this.storage.exportSyncPackage();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_Banca_FC_${new Date().toISOString().split('T')[0]}.json`;
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
          this.populateCollectorDropdowns();
          this.refreshAllViews();
          document.getElementById('modal-network-sync')?.classList.add('hidden');
          this.showToast(`¡Sincronización exitosa! Se sumaron ${stats.importedTicketsCount} tickets nuevos de la taquilla (Total: ${stats.totalTickets}).`, '🎉');
        } catch (err) {
          alert('Error al importar el archivo JSON: ' + err.message);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    // Restaurar Demo
    document.getElementById('btn-restore-demo')?.addEventListener('click', () => {
      if (confirm('¿Desea restaurar los datos de demostración de Banca FC Fernando Castaño (agencias, ventas y premios precargados)?')) {
        this.storage.restoreDemoData();
        this.populateCollectorDropdowns();
        this.refreshAllViews();
        this.showToast('Datos de demostración restaurados correctamente.', '🔄');
      }
    });

    // Reiniciar Base de Datos en Cero (CON CONTRASEÑA ADMINISTRATIVA)
    document.getElementById('btn-reset-zero')?.addEventListener('click', () => {
      this.openPasswordResetModal({
        mode: 'GLOBAL',
        title: '🔐 Reiniciar Banca FC en Cero (Producción)',
        description: '⚠️ Se eliminarán TODOS los tickets y resultados del sistema, manteniendo las agencias configuradas listas para vender desde el Ticket #00000001. Ingrese la contraseña maestra para autorizar.'
      });
    });

    // Botones rápidos para abrir el modal de Agregar / Eliminar Cobrador
    document.getElementById('btn-quick-manage-collectors')?.addEventListener('click', () => {
      this.openManageCollectorsModal();
    });
    document.getElementById('btn-form-manage-collectors')?.addEventListener('click', () => {
      this.openManageCollectorsModal();
    });

    // Eventos del modal de gestión rápida de cobradores
    const formModalCollector = document.getElementById('form-modal-add-collector');
    formModalCollector?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('modal-input-collector-name');
      const name = (input?.value || '').trim();
      if (!name) return;
      this.storage.addCollector(name);
      input.value = '';
      this.populateCollectorDropdowns();
      this.renderModalCollectorsList();
      this.refreshAllViews();
      this.showToast(`Cobrador "${name}" agregado exitosamente.`, '🛵');
    });

    // Eventos del modal de confirmación con contraseña para reiniciar en cero
    const formPassReset = document.getElementById('form-password-reset');
    formPassReset?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.executePasswordProtectedReset();
    });

    // Cerrar cualquier modal administrativo
    document.querySelectorAll('[data-close-admin-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.closeAdminModal;
        document.getElementById(targetId)?.classList.add('hidden');
      });
    });
  }

  bindTabNavigation() {
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
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
  // 2. ACTUALIZACIÓN GLOBAL DE LOS 6 KPIs Y VISTAS
  // =========================================================================
  refreshAllViews() {
    const syncEl = document.getElementById('last-sync-timestamp');
    if (syncEl) {
      syncEl.textContent = `Sincronizado: ${new Date().toLocaleTimeString('es-VE')}`;
    }

    const periodTickets = this.getFilteredTicketsByDate();
    const agencies = this.storage.getAgencies();

    // Asegurar que cualquier código de agencia huérfano en tickets también aparezca
    const knownCodes = new Set(agencies.map(a => String(a.code)));
    periodTickets.forEach(t => {
      const tCode = this.storage.extractAgencyCodeFromTicket(t);
      if (!knownCodes.has(String(tCode))) {
        const autoAgency = this.storage.saveAgency({
          code: tCode,
          name: t.agencia ? t.agencia.replace(`${tCode} - `, '') : `AGENCIA ${tCode}`,
          currency: t.moneda || 'COP',
          commissionPct: 15,
          status: 'ACTIVA'
        });
        agencies.push(autoAgency);
        knownCodes.add(String(tCode));
      }
    });

    // Filtros activos en la tabla de agencias
    const collectorFilter = document.getElementById('filter-agency-collector')?.value || 'ALL';
    const statusFilter = document.getElementById('filter-agency-status')?.value || 'ALL';
    const searchQuery = (document.getElementById('agency-search-input')?.value || '').trim().toLowerCase();

    const filteredAgencies = agencies.filter(ag => {
      if (collectorFilter !== 'ALL' && ag.collector !== collectorFilter) return false;
      if (statusFilter !== 'ALL' && ag.status !== statusFilter) return false;
      if (searchQuery) {
        const hay = `${ag.code} ${ag.name} ${ag.zone} ${ag.manager} ${ag.collector} ${ag.terminalSerial}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    const agencyMetricsList = filteredAgencies.map(ag => this.calculateAgencyFinancials(ag, periodTickets));

    this.renderGlobalKpis(agencyMetricsList);
    this.renderAgenciesMasterTable(agencyMetricsList);
    this.renderLiveTicketsMonitor(periodTickets, agencies);
    this.renderRiskSemaphoreTable(periodTickets);
    this.renderResultsAndWinnersView();
    this.renderCollectorsSummaryTable(agencies, periodTickets);

    if (this.currentAuditedAgencyCode) {
      const modalAudit = document.getElementById('modal-audit-agency');
      if (modalAudit && !modalAudit.classList.contains('hidden')) {
        this.openAuditAgencyModal(this.currentAuditedAgencyCode);
      }
    }
  }

  renderGlobalKpis(agencyMetricsList) {
    const selectedCur = this.storage.getConsolidationCurrency();

    // 1. Sumar de forma independiente cada una de las 3 Cajas (COP, USD, VES) con CERO conversión
    const globalBoxes = {
      COP: { gross: 0, voided: 0, net: 0, commission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, bancaUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 },
      USD: { gross: 0, voided: 0, net: 0, commission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, bancaUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 },
      VES: { gross: 0, voided: 0, net: 0, commission: 0, paidPrizes: 0, pendingPrizes: 0, totalPrizes: 0, bancaUtility: 0, activeCount: 0, voidCount: 0, totalTicketsCount: 0 }
    };

    agencyMetricsList.forEach(m => {
      ['COP', 'USD', 'VES'].forEach(curKey => {
        const b = m.boxes[curKey];
        if (!b) return;
        globalBoxes[curKey].gross += b.gross;
        globalBoxes[curKey].voided += b.voided;
        globalBoxes[curKey].net += b.net;
        globalBoxes[curKey].commission += b.commission;
        globalBoxes[curKey].paidPrizes += b.paidPrizes;
        globalBoxes[curKey].pendingPrizes += b.pendingPrizes;
        globalBoxes[curKey].totalPrizes += b.totalPrizes;
        globalBoxes[curKey].bancaUtility += b.bancaUtility;
        globalBoxes[curKey].activeCount += b.activeCount;
        globalBoxes[curKey].voidCount += b.voidCount;
        globalBoxes[curKey].totalTicketsCount += b.totalTicketsCount;
      });
    });

    // 2. Renderizar las 3 Cajas Simultáneas Independientes en #admin-three-boxes-grid
    const threeBoxesContainer = document.getElementById('admin-three-boxes-grid');
    if (threeBoxesContainer) {
      const boxStyles = {
        COP: { title: '🇨🇴 CAJA PESOS (COP $)', borderActive: 'border-amber-400 ring-2 ring-amber-400/30', headerBg: 'from-blue-900/90 to-slate-900' },
        USD: { title: '🇺🇸 CAJA DÓLARES (USD $)', borderActive: 'border-emerald-400 ring-2 ring-emerald-400/30', headerBg: 'from-emerald-900/90 to-slate-900' },
        VES: { title: '🇻🇪 CAJA BOLÍVARES (VES Bs.)', borderActive: 'border-sky-400 ring-2 ring-sky-400/30', headerBg: 'from-amber-900/90 to-slate-900' }
      };

      threeBoxesContainer.innerHTML = ['COP', 'USD', 'VES'].map(curKey => {
        const b = globalBoxes[curKey];
        const st = boxStyles[curKey];
        const isSelected = curKey === selectedCur;
        const utilPositive = b.bancaUtility >= 0;

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
                <span class="font-sans">Tickets Anulados (-):</span>
                <strong>-${this.formatMoney(b.voided, curKey)}</strong>
              </div>
              <div class="flex justify-between text-sky-300 border-t border-slate-800/80 pt-1">
                <span class="font-sans font-bold">Ventas Netas:</span>
                <strong>${this.formatMoney(b.net, curKey)}</strong>
              </div>
              <div class="flex justify-between text-indigo-300">
                <span class="font-sans">Comisión Agencias (-):</span>
                <strong>-${this.formatMoney(b.commission, curKey)}</strong>
              </div>
              <div class="flex justify-between text-amber-400">
                <span class="font-sans">Premios Ganadores / Pagados (-):</span>
                <strong>-${this.formatMoney(b.totalPrizes, curKey)}</strong>
              </div>
              <div class="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between bg-slate-950/90 px-2.5 py-1.5 rounded-lg">
                <span class="font-sans text-[11px] font-black uppercase ${utilPositive ? 'text-emerald-400' : 'text-rose-400'}">Utilidad / Saldo Banca:</span>
                <strong class="text-sm font-black ${utilPositive ? 'text-emerald-400' : 'text-rose-400'}">${this.formatMoney(b.bancaUtility, curKey)}</strong>
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

    // 3. Actualizar los 6 KPIs superiores exclusivamente con la Caja Seleccionada (CERO conversión)
    const activeBox = globalBoxes[selectedCur] || globalBoxes.COP;
    const avgCommPct = activeBox.net > 0 ? ((activeBox.commission / activeBox.net) * 100).toFixed(1) : '15.0';
    const marginPct = activeBox.net > 0 ? ((activeBox.bancaUtility / activeBox.net) * 100).toFixed(1) : '0.0';

    document.getElementById('kpi-ventas-brutas').textContent = this.formatMoney(activeBox.gross, selectedCur);
    document.getElementById('kpi-sub-tickets-total').textContent = `${activeBox.totalTicketsCount} tickets en ${selectedCur}`;
    document.getElementById('kpi-badge-currency-1').textContent = `CAJA ${selectedCur}`;

    document.getElementById('kpi-tickets-anulados').textContent = this.formatMoney(activeBox.voided, selectedCur);
    document.getElementById('kpi-sub-anulados-count').textContent = `${activeBox.voidCount} anulados (${selectedCur})`;

    document.getElementById('kpi-ventas-netas').textContent = this.formatMoney(activeBox.net, selectedCur);
    document.getElementById('kpi-sub-activos-count').textContent = `${activeBox.activeCount} activos (${selectedCur})`;

    document.getElementById('kpi-comision-agencias').textContent = this.formatMoney(activeBox.commission, selectedCur);
    document.getElementById('kpi-sub-comision-promedio').textContent = `Prom: ${avgCommPct}%`;

    document.getElementById('kpi-total-premios').textContent = this.formatMoney(activeBox.totalPrizes, selectedCur);
    document.getElementById('kpi-sub-premios-pagados').textContent = `Pagados: ${this.formatMoney(activeBox.paidPrizes, selectedCur)}`;
    document.getElementById('kpi-sub-premios-pendientes').textContent = `Pend: ${this.formatMoney(activeBox.pendingPrizes, selectedCur)}`;

    const utilityEl = document.getElementById('kpi-utilidad-neta');
    const utilityCard = document.getElementById('kpi-card-utilidad');
    const utilityBadge = document.getElementById('kpi-utilidad-badge');
    const marginEl = document.getElementById('kpi-sub-margen-pct');

    if (utilityEl) utilityEl.textContent = this.formatMoney(activeBox.bancaUtility, selectedCur);
    if (marginEl) marginEl.textContent = `Margen Rentabilidad (${selectedCur}): ${marginPct}%`;

    if (utilityCard && utilityBadge) {
      if (activeBox.bancaUtility >= 0) {
        utilityCard.classList.remove('kpi-profit-negative');
        utilityCard.classList.add('kpi-profit-positive');
        utilityBadge.className = 'badge-pill badge-activa';
        utilityBadge.textContent = `A FAVOR BANCA (${selectedCur})`;
      } else {
        utilityCard.classList.remove('kpi-profit-positive');
        utilityCard.classList.add('kpi-profit-negative');
        utilityBadge.className = 'badge-pill badge-suspendida';
        utilityBadge.textContent = `SALDO EN CONTRA (${selectedCur})`;
      }
    }
  }

  // =========================================================================
  // 3. MÓDULO 1: GESTIÓN Y TABLA MAESTRA DE AGENCIAS
  // =========================================================================
  populateCollectorDropdowns() {
    const collectors = this.storage.getCollectors();
    const filterSelect = document.getElementById('filter-agency-collector');
    const formSelect = document.getElementById('ag-collector');

    if (filterSelect) {
      const currentVal = filterSelect.value || 'ALL';
      filterSelect.innerHTML = '<option value="ALL">Todos los Cobradores</option>';
      collectors.forEach(c => {
        filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
      });
      filterSelect.value = currentVal;
    }

    if (formSelect) {
      formSelect.innerHTML = '';
      collectors.forEach(c => {
        formSelect.innerHTML += `<option value="${c}">${c}</option>`;
      });
    }
  }

  bindAgencyModuleEvents() {
    document.getElementById('agency-search-input')?.addEventListener('input', () => this.refreshAllViews());
    document.getElementById('filter-agency-collector')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('filter-agency-status')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('chk-convert-table-amounts')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('btn-gen-serial')?.addEventListener('click', () => {
      const serialInput = document.getElementById('ag-serial');
      if (serialInput) {
        serialInput.value = this.storage.generateTerminalSerial();
      }
    });

    // Sincronizar selector de Moneda Predeterminada con las casillas de Monedas Autorizadas
    const curSelectForm = document.getElementById('ag-currency');
    curSelectForm?.addEventListener('change', () => {
      const val = curSelectForm.value;
      if (val === 'COP') document.getElementById('ag-allow-cop').checked = true;
      if (val === 'USD') document.getElementById('ag-allow-usd').checked = true;
      if (val === 'VES') document.getElementById('ag-allow-ves').checked = true;
    });

    const form = document.getElementById('form-agency-crud');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const allowedCurrencies = [];
      if (document.getElementById('ag-allow-cop')?.checked) allowedCurrencies.push('COP');
      if (document.getElementById('ag-allow-usd')?.checked) allowedCurrencies.push('USD');
      if (document.getElementById('ag-allow-ves')?.checked) allowedCurrencies.push('VES');

      let primaryCurrency = document.getElementById('ag-currency').value || 'COP';
      if (allowedCurrencies.length === 0) {
        allowedCurrencies.push(primaryCurrency);
      } else if (!allowedCurrencies.includes(primaryCurrency)) {
        primaryCurrency = allowedCurrencies[0];
      }

      const agencyData = {
        code: document.getElementById('ag-code').value.trim(),
        terminalSerial: document.getElementById('ag-serial').value.trim(),
        name: document.getElementById('ag-name').value.trim(),
        zone: document.getElementById('ag-zone').value.trim(),
        manager: document.getElementById('ag-manager').value.trim(),
        whatsapp: document.getElementById('ag-whatsapp').value.trim(),
        collector: document.getElementById('ag-collector').value,
        currency: primaryCurrency,
        allowedCurrencies: allowedCurrencies,
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
      this.showToast(
        `Agencia ${saved.code} (${saved.allowedCurrencies.join('/')}) • Com: ${saved.commissionPct}% guardada y sincronizada.`,
        '🏢'
      );
    });
  }

  openAgencyFormModal(agencyCode = null) {
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
      document.getElementById('ag-code').value = ag.code;
      document.getElementById('ag-serial').value = ag.terminalSerial || this.storage.generateTerminalSerial();
      document.getElementById('ag-name').value = ag.name;
      document.getElementById('ag-zone').value = ag.zone || '';
      document.getElementById('ag-manager').value = ag.manager || '';
      document.getElementById('ag-whatsapp').value = ag.whatsapp || '';
      document.getElementById('ag-collector').value = ag.collector || 'Raúl Zambrano';
      document.getElementById('ag-currency').value = ag.currency || allowed[0] || 'COP';
      document.getElementById('ag-commission').value = ag.commissionPct ?? 15;

      if (document.getElementById('ag-allow-cop')) document.getElementById('ag-allow-cop').checked = allowed.includes('COP');
      if (document.getElementById('ag-allow-usd')) document.getElementById('ag-allow-usd').checked = allowed.includes('USD');
      if (document.getElementById('ag-allow-ves')) document.getElementById('ag-allow-ves').checked = allowed.includes('VES');

      if (document.getElementById('ag-mult-triple')) document.getElementById('ag-mult-triple').value = agMult.triple || 500;
      if (document.getElementById('ag-mult-terminal')) document.getElementById('ag-mult-terminal').value = agMult.terminal || 60;
      if (document.getElementById('ag-mult-aprox')) document.getElementById('ag-mult-aprox').value = agMult.aproximacion || 5;
      if (document.getElementById('ag-mult-animalito')) document.getElementById('ag-mult-animalito').value = agMult.animalito || 30;
      if (document.getElementById('ag-mult-4cifras')) document.getElementById('ag-mult-4cifras').value = agMult.cuatroCifrasDirecto || 4500;
      if (document.getElementById('ag-mult-4comb')) document.getElementById('ag-mult-4comb').value = agMult.cuatroCifrasCombinado || 208;
      if (document.getElementById('ag-mult-la5ta')) document.getElementById('ag-mult-la5ta').value = agMult.la5ta || 25000;
      if (document.getElementById('ag-mult-astro4')) document.getElementById('ag-mult-astro4').value = agMult.astro4 || 40000;

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
      document.getElementById('ag-code').value = nextCode;
      document.getElementById('ag-serial').value = this.storage.generateTerminalSerial();
      document.getElementById('ag-name').value = '';
      document.getElementById('ag-zone').value = 'San Cristóbal (VEN)';
      document.getElementById('ag-manager').value = '';
      document.getElementById('ag-whatsapp').value = '+58414';
      document.getElementById('ag-currency').value = 'COP';
      document.getElementById('ag-commission').value = 15;

      if (document.getElementById('ag-allow-cop')) document.getElementById('ag-allow-cop').checked = true;
      if (document.getElementById('ag-allow-usd')) document.getElementById('ag-allow-usd').checked = false;
      if (document.getElementById('ag-allow-ves')) document.getElementById('ag-allow-ves').checked = false;

      if (document.getElementById('ag-mult-triple')) document.getElementById('ag-mult-triple').value = globalMult.triple || 500;
      if (document.getElementById('ag-mult-terminal')) document.getElementById('ag-mult-terminal').value = globalMult.terminal || 60;
      if (document.getElementById('ag-mult-aprox')) document.getElementById('ag-mult-aprox').value = globalMult.aproximacion || 5;
      if (document.getElementById('ag-mult-animalito')) document.getElementById('ag-mult-animalito').value = globalMult.animalito || 30;
      if (document.getElementById('ag-mult-4cifras')) document.getElementById('ag-mult-4cifras').value = globalMult.cuatroCifrasDirecto || 4500;
      if (document.getElementById('ag-mult-4comb')) document.getElementById('ag-mult-4comb').value = globalMult.cuatroCifrasCombinado || 208;
      if (document.getElementById('ag-mult-la5ta')) document.getElementById('ag-mult-la5ta').value = globalMult.la5ta || 25000;
      if (document.getElementById('ag-mult-astro4')) document.getElementById('ag-mult-astro4').value = globalMult.astro4 || 40000;

      document.getElementById('ag-max-bet').value = 50000;
      document.getElementById('ag-credit-limit').value = 2500000;
      document.getElementById('ag-password').value = nextCode;
      document.getElementById('ag-status').value = 'ACTIVA';
    }

    modal.classList.remove('hidden');
  }

  renderAgenciesMasterTable(agencyMetricsList) {
    const tbody = document.getElementById('agencies-master-tbody');
    const tfoot = document.getElementById('agencies-master-tfoot');
    if (!tbody) return;

    const selectedCur = this.storage.getConsolidationCurrency();
    const boxBadgeEl = document.getElementById('agency-table-active-box-badge');
    if (boxBadgeEl) {
      boxBadgeEl.textContent = `🔒 Filtro de Caja Activo: CAJA ${selectedCur} (Cero Conversión)`;
    }

    if (agencyMetricsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-8 text-slate-400">
            No se encontraron agencias que coincidan con los filtros seleccionados.
          </td>
        </tr>
      `;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let rowsHtml = '';
    let sumGross = 0;
    let sumNet = 0;
    let sumComm = 0;
    let sumPrizes = 0;
    let sumUtility = 0;
    let sumActiveTickets = 0;
    let sumVoidTickets = 0;

    agencyMetricsList.forEach(m => {
      const ag = m.agency;
      const vals = m.boxes[selectedCur] || m.global;

      sumGross += vals.gross;
      sumNet += vals.net;
      sumComm += vals.commission;
      sumPrizes += vals.totalPrizes;
      sumUtility += vals.bancaUtility;
      sumActiveTickets += vals.activeCount;
      sumVoidTickets += vals.voidCount;

      const isActiva = ag.status === 'ACTIVA';
      const statusBadge = isActiva
        ? `<span class="badge-pill badge-activa">● ACTIVA</span>`
        : `<span class="badge-pill badge-suspendida">⛔ SUSPENDIDA</span>`;

      const utilityPositive = vals.bancaUtility >= 0;
      const utilityColorClass = utilityPositive ? 'text-emerald-400' : 'text-rose-400';
      const utilitySubTag = vals.totalTicketsCount === 0
        ? `Sin mov. en ${selectedCur}`
        : (utilityPositive ? `A favor Banca (${selectedCur})` : `Caída Premios (${selectedCur})`);

      // Mostrar indicador compacto si la agencia tiene movimientos en otras cajas distintas a la filtrada
      const otherBoxesBadges = ['COP', 'USD', 'VES']
        .filter(c => c !== selectedCur && m.boxes[c] && m.boxes[c].totalTicketsCount > 0)
        .map(c => `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] text-sky-300 font-mono" title="Movimiento en Caja ${c}">${c}: ${this.formatMoney(m.boxes[c].net, c)} (${m.boxes[c].activeCount}t)</span>`)
        .join(' ');

      rowsHtml += `
        <tr>
          <td>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-black text-amber-400 text-xs">${ag.code}</span>
              <div>
                <div class="font-bold text-white leading-tight">${ag.name}</div>
                <div class="text-[11px] text-slate-400 font-mono">ID: ${ag.terminalSerial || 'N/A'} • Resp: ${ag.manager}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="font-semibold text-slate-200">${ag.zone}</div>
            <div class="text-[11px] text-sky-400 font-medium">🛵 Cobrador: ${ag.collector}</div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <span class="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold text-xs" title="Monedas Autorizadas en Taquilla">${this.storage.getAllowedCurrenciesForAgency(ag.code).join(' / ')}</span>
            <div class="text-[10px] text-slate-400 mt-0.5">Com: ${ag.commissionPct}% • Caja: <strong>${selectedCur}</strong></div>
            ${otherBoxesBadges ? `<div class="mt-1 flex flex-wrap gap-1">${otherBoxesBadges}</div>` : ''}
          </td>
          <td class="text-center font-mono">
            <span class="text-emerald-400 font-bold" title="Tickets Activos en ${selectedCur}">${vals.activeCount}</span>
            <span class="text-slate-600 mx-1">/</span>
            <span class="text-rose-400 font-bold" title="Tickets Anulados en ${selectedCur}">${vals.voidCount}</span>
          </td>
          <td class="text-right font-mono font-semibold text-slate-200">${this.formatMoney(vals.gross, selectedCur)}</td>
          <td class="text-right font-mono font-bold text-sky-300">${this.formatMoney(vals.net, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">
            ${this.formatMoney(vals.commission, selectedCur)}
            <div class="text-[10px] text-slate-400">(${ag.commissionPct}%)</div>
          </td>
          <td class="text-right font-mono font-bold ${vals.totalPrizes > 0 ? 'text-amber-400' : 'text-slate-500'}">
            ${this.formatMoney(vals.totalPrizes, selectedCur)}
            ${vals.pendingPrizes > 0 ? `<div class="text-[10px] text-amber-300">Pend: ${this.formatMoney(vals.pendingPrizes, selectedCur)}</div>` : ''}
          </td>
          <td class="text-right font-mono">
            <div class="font-black text-sm ${utilityColorClass}">${this.formatMoney(vals.bancaUtility, selectedCur)}</div>
            <div class="text-[10px] ${utilityPositive ? 'text-emerald-500' : 'text-rose-400'} font-semibold">${utilitySubTag}</div>
          </td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="btn-audit-ag px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition" data-code="${ag.code}" title="Auditar las 3 Cajas y Tickets de la Taquilla">
                🔍 Auditar
              </button>
              <button type="button" class="btn-edit-ag px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] transition" data-code="${ag.code}" title="Editar Parámetros de la Agencia">
                ✏️
              </button>
              <button type="button" class="btn-toggle-ag px-2 py-1 rounded ${isActiva ? 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800' : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'} text-[11px] font-bold transition" data-code="${ag.code}" title="${isActiva ? 'Suspender Agencia' : 'Activar Agencia'}">
                ${isActiva ? '🔒' : '🔓'}
              </button>
              <button type="button" class="btn-wa-ag px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition" data-code="${ag.code}" title="Enviar Relación / Corte por WhatsApp">
                📲 WA
              </button>
              <button type="button" class="btn-reset-ag px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition" data-code="${ag.code}" title="Reiniciar Agencia en Cero (Con Contraseña)">
                🧹 0
              </button>
              <button type="button" class="btn-delete-ag px-2 py-1 rounded bg-rose-900/70 hover:bg-rose-700 text-rose-200 border border-rose-700 text-[11px] font-bold transition" data-code="${ag.code}" title="Eliminar Agencia del Sistema">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    if (tfoot) {
      const totalPositive = sumUtility >= 0;
      tfoot.innerHTML = `
        <tr>
          <td colspan="4" class="py-3 px-3 text-right uppercase text-xs text-slate-300">
            TOTAL CAJA ${selectedCur} (${agencyMetricsList.length} Agencias - Cero Conversión):
          </td>
          <td class="text-center font-mono text-xs">
            <span class="text-emerald-400">${sumActiveTickets}</span> / <span class="text-rose-400">${sumVoidTickets}</span>
          </td>
          <td class="text-right font-mono text-white">${this.formatMoney(sumGross, selectedCur)}</td>
          <td class="text-right font-mono text-sky-300">${this.formatMoney(sumNet, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(sumComm, selectedCur)}</td>
          <td class="text-right font-mono text-amber-400">${this.formatMoney(sumPrizes, selectedCur)}</td>
          <td class="text-right font-mono text-sm ${totalPositive ? 'text-emerald-400' : 'text-rose-400'}">
            ${this.formatMoney(sumUtility, selectedCur)}
          </td>
          <td></td>
        </tr>
      `;
    }

    // Vincular eventos de botones de fila
    tbody.querySelectorAll('.btn-audit-ag').forEach(btn => {
      btn.addEventListener('click', () => this.openAuditAgencyModal(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-edit-ag').forEach(btn => {
      btn.addEventListener('click', () => this.openAgencyFormModal(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-toggle-ag').forEach(btn => {
      btn.addEventListener('click', () => {
        const updated = this.storage.toggleAgencyStatus(btn.dataset.code);
        if (updated) {
          this.refreshAllViews();
          this.showToast(`Agencia ${updated.code} ahora está ${updated.status}`, updated.status === 'ACTIVA' ? '🟢' : '⛔');
        }
      });
    });
    tbody.querySelectorAll('.btn-wa-ag').forEach(btn => {
      btn.addEventListener('click', () => this.sendAgencyWhatsAppSummary(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-reset-ag').forEach(btn => {
      btn.addEventListener('click', () => this.promptResetAgencyToZero(btn.dataset.code));
    });
    tbody.querySelectorAll('.btn-delete-ag').forEach(btn => {
      btn.addEventListener('click', () => this.handleDeleteAgency(btn.dataset.code));
    });
  }

  // =========================================================================
  // 4. MÓDULO 2: AUDITORÍA INDIVIDUAL DE TAQUILLA (EXPEDIENTE DE AGENCIA)
  // =========================================================================
  bindAuditModalEvents() {
    document.getElementById('btn-audit-copy-whatsapp')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) {
        this.sendAgencyWhatsAppSummary(this.currentAuditedAgencyCode, true);
      }
    });

    document.getElementById('btn-audit-reset-agency')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) {
        this.promptResetAgencyToZero(this.currentAuditedAgencyCode);
      }
    });

    document.getElementById('btn-audit-delete-agency')?.addEventListener('click', () => {
      if (this.currentAuditedAgencyCode) {
        this.handleDeleteAgency(this.currentAuditedAgencyCode, true);
      }
    });

    document.getElementById('btn-audit-open-pos-as')?.addEventListener('click', () => {
      if (!this.currentAuditedAgencyCode) return;
      const ag = this.storage.getAgencyByCode(this.currentAuditedAgencyCode);
      if (ag) {
        this.storage.authenticatePosAgency(ag.code, ag.password);
        this.showToast(`Taquilla POS configurada ahora como Agencia ${ag.code} - ${ag.name}`, '🎰');
        window.open('index.html', '_blank');
      }
    });

    // Inyector manual de ventas o premios en el expediente
    document.getElementById('btn-inject-sale')?.addEventListener('click', () => {
      this.injectManualTicketForAuditedAgency(false);
    });
    document.getElementById('btn-inject-prize')?.addEventListener('click', () => {
      this.injectManualTicketForAuditedAgency(true);
    });
  }

  openAuditAgencyModal(agencyCode, forcedCurrency = null) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    this.currentAuditedAgencyCode = ag.code;

    const periodTickets = this.getFilteredTicketsByDate();
    const m = this.calculateAgencyFinancials(ag, periodTickets);
    const allowed = this.storage.getAllowedCurrenciesForAgency(ag.code);
    const cur = forcedCurrency || this.currentAuditedCurrency || (m.boxes[this.storage.getConsolidationCurrency()]?.totalTicketsCount > 0 ? this.storage.getConsolidationCurrency() : (ag.currency || allowed[0] || 'COP'));
    this.currentAuditedCurrency = cur;
    const activeBox = m.boxes[cur] || m.boxes.COP;

    document.getElementById('audit-ag-code').textContent = ag.code;
    document.getElementById('audit-ag-name').textContent = `${ag.name} (Caja ${cur})`;
    const statusBadge = document.getElementById('audit-ag-status-badge');
    if (statusBadge) {
      statusBadge.className = ag.status === 'ACTIVA' ? 'badge-pill badge-activa' : 'badge-pill badge-suspendida';
      statusBadge.textContent = ag.status;
    }
    document.getElementById('audit-ag-meta').textContent =
      `Serial Terminal: ${ag.terminalSerial} • Monedas Autorizadas: ${allowed.join(' / ')} • Zona: ${ag.zone} • Encargado: ${ag.manager} • Cobrador: ${ag.collector}`;

    // Renderizar las 3 Cajas Independientes de la Agencia en #audit-three-boxes-grid
    const auditThreeBoxesEl = document.getElementById('audit-three-boxes-grid');
    if (auditThreeBoxesEl) {
      const boxMeta = {
        COP: { title: '🇨🇴 CAJA PESOS (COP $)', border: 'border-amber-400', headerBg: 'bg-blue-950/80' },
        USD: { title: '🇺🇸 CAJA DÓLARES (USD $)', border: 'border-emerald-400', headerBg: 'bg-emerald-950/80' },
        VES: { title: '🇻🇪 CAJA BOLÍVARES (VES Bs.)', border: 'border-sky-400', headerBg: 'bg-amber-950/80' }
      };
      auditThreeBoxesEl.innerHTML = ['COP', 'USD', 'VES'].map(curKey => {
        const b = m.boxes[curKey];
        const meta = boxMeta[curKey];
        const isSel = curKey === cur;
        return `
          <div class="audit-currency-box cursor-pointer rounded-xl bg-slate-950 p-3 border ${isSel ? meta.border + ' ring-2 ring-amber-400/20' : 'border-slate-800 hover:border-slate-700'} transition" data-currency="${curKey}">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span class="text-xs font-black text-white">${meta.title}</span>
              ${isSel ? '<span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">ACTIVA</span>' : `<span class="text-[10px] text-slate-400">${b.totalTicketsCount} tickets</span>`}
            </div>
            <div class="space-y-1 text-[11px] font-mono">
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Tickets (Act/Anul):</span><strong class="text-white">${b.activeCount} / ${b.voidCount}</strong></div>
              <div class="flex justify-between"><span class="text-slate-400 font-sans">Ventas Brutas:</span><strong class="text-white">${this.formatMoney(b.gross, curKey)}</strong></div>
              <div class="flex justify-between text-rose-400"><span class="font-sans">Anulados (-):</span><strong>-${this.formatMoney(b.voided, curKey)}</strong></div>
              <div class="flex justify-between text-sky-300"><span class="font-sans font-bold">Ventas Netas:</span><strong>${this.formatMoney(b.net, curKey)}</strong></div>
              <div class="flex justify-between text-indigo-300"><span class="font-sans">Comisión (${ag.commissionPct}%) (-):</span><strong>-${this.formatMoney(b.commission, curKey)}</strong></div>
              <div class="flex justify-between text-amber-400"><span class="font-sans">Premios (-):</span><strong>-${this.formatMoney(b.totalPrizes, curKey)}</strong></div>
              <div class="flex justify-between pt-1 border-t border-slate-800 ${b.bancaUtility >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black">
                <span class="font-sans uppercase">Saldo Banca:</span>
                <strong>${this.formatMoney(b.bancaUtility, curKey)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('');

      auditThreeBoxesEl.querySelectorAll('.audit-currency-box').forEach(el => {
        el.addEventListener('click', () => {
          this.openAuditAgencyModal(ag.code, el.dataset.currency);
        });
      });
    }

    // Resumen Financiero Individual de la Caja Seleccionada (CERO conversión)
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
        balanceLabel.textContent = `Saldo a Pagar Agencia (${cur})`;
      }
    }

    // Desglose por Categorías en la Caja Seleccionada
    document.getElementById('audit-cat-sinsigno').textContent = this.formatMoney(activeBox.categoryBreakdown.sin_signo.amount, cur);
    document.getElementById('audit-cat-sinsigno-cnt').textContent = `${activeBox.categoryBreakdown.sin_signo.count} jugadas (${cur})`;

    document.getElementById('audit-cat-consigno').textContent = this.formatMoney(activeBox.categoryBreakdown.con_signo.amount, cur);
    document.getElementById('audit-cat-consigno-cnt').textContent = `${activeBox.categoryBreakdown.con_signo.count} jugadas (${cur})`;

    document.getElementById('audit-cat-4cifras').textContent = this.formatMoney(activeBox.categoryBreakdown.cuatro_cifras.amount, cur);
    document.getElementById('audit-cat-4cifras-cnt').textContent = `${activeBox.categoryBreakdown.cuatro_cifras.count} jugadas (${cur})`;

    document.getElementById('audit-cat-animalitos').textContent = this.formatMoney(activeBox.categoryBreakdown.animalitos.amount, cur);
    document.getElementById('audit-cat-animalitos-cnt').textContent = `${activeBox.categoryBreakdown.animalitos.count} jugadas (${cur})`;

    // Listado de Tickets de esta Agencia en la Caja Seleccionada
    const boxTickets = activeBox.tickets || [];
    document.getElementById('audit-tickets-count').textContent = `${boxTickets.length} tickets registrados en Caja ${cur} (Total agencia: ${m.tickets.length})`;
    const tbody = document.getElementById('audit-agency-tickets-tbody');

    if (boxTickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">Esta agencia no tiene tickets vendidos en <strong>${cur}</strong> para el rango de fechas seleccionado.</td></tr>`;
    } else {
      let rows = '';
      boxTickets.forEach(t => {
        const tCur = (t.moneda || cur).toUpperCase();
        const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
        const playsSummary = (t.items || []).map(p => {
          let label = `${p.lotteryName}: <strong>${p.number}</strong>`;
          if (p.sign) label += `-${p.sign}`;
          if (p.animalName) label += ` (${p.animalName})`;
          if (p.is5ta) label += ` [5ta]`;
          return label;
        }).slice(0, 3).join(' • ') + ((t.items || []).length > 3 ? ` (+${t.items.length - 3} más)` : '');

        rows += `
          <tr>
            <td class="font-mono font-bold text-amber-400">#${t.ticketId}</td>
            <td class="font-mono text-xs text-slate-300">${t.serialSeguridad}</td>
            <td class="text-xs text-slate-400">${t.fechaHora}</td>
            <td class="text-xs text-slate-200">${playsSummary}</td>
            <td class="text-right font-mono font-bold text-white">${this.formatMoney(t.total, tCur)}</td>
            <td class="text-right font-mono font-bold ${prizeVal > 0 ? 'text-amber-400' : 'text-slate-500'}">${this.formatMoney(prizeVal, tCur)}</td>
            <td class="text-center">${this.renderTicketStatusBadge(t.estado)}</td>
            <td class="text-center">
              <div class="inline-flex items-center gap-1">
                <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold" data-id="${t.ticketId}" title="Ver Ticket Térmico">
                  🖨️ Ver
                </button>
                ${t.estado !== 'PAGADO' && t.estado !== 'ANULADO' ? `
                  <button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold" data-id="${t.ticketId}" title="Marcar como Pagado">
                    💵 Pagar
                  </button>
                ` : ''}
                ${t.estado !== 'ANULADO' ? `
                  <button type="button" class="btn-void-admin px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-bold" data-id="${t.ticketId}" title="Anular Ticket Administrativamente">
                    🚫 Anular
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = rows;

      this.bindTicketRowActionButtons(tbody);
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

    const targetCur = this.currentAuditedCurrency || ag.currency || 'COP';
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

    let lotteryId = 'CHANCE_A_1300';
    let lotteryName = 'Chance A 1:00 PM';
    let animalName = null;
    let sign = null;
    let multiplier = agMult.triple || 500;

    if (catType === 'terminal') {
      lotteryId = 'NAPA_GANA_1300';
      lotteryName = 'Ñapa Gana 1:00 PM';
      multiplier = agMult.terminal || 60;
    } else if (catType === 'animalito') {
      lotteryId = 'LOTTO_ACTIVO_1300';
      lotteryName = 'Lotto Activo 1:00 PM';
      animalName = (ANIMALITOS_DICT[numVal] || { name: 'León' }).name;
      multiplier = agMult.animalito || 30;
    } else if (catType === 'zodiac') {
      lotteryId = 'TACHIRA_ZODIACAL_1645';
      lotteryName = 'Táchira Zodiacal 4:45 PM';
      sign = 'LEO';
      multiplier = agMult.triple || 500;
    } else if (catType === 'cuatro_cifras') {
      lotteryId = 'DORADO_NOCHE';
      lotteryName = 'Dorado Noche 10:05 PM';
      multiplier = agMult.cuatroCifrasDirecto || 4500;
    }

    const playItem = {
      uid: Date.now().toString(36),
      lotteryId,
      lotteryName,
      number: numVal,
      type: catType,
      sign,
      animalName,
      amount: amountVal
    };

    const prizeAmount = isWinningTicket ? (amountVal * multiplier) : 0;
    const newTicket = {
      ticketId,
      serialSeguridad: serial,
      fechaHora: dateStr,
      agencyCode: ag.code,
      agencia: `${ag.code} - ${ag.name}`,
      usuario: ag.code,
      moneda: targetCur,
      items: [playItem],
      total: amountVal,
      estado: isWinningTicket ? 'GANADOR' : 'ACTIVO',
      premioCalculado: prizeAmount,
      winningPlays: isWinningTicket ? [{
        ...playItem,
        winType: `PREMIO ${catType.toUpperCase()}`,
        multiplier,
        prize: prizeAmount,
        resultNumber: numVal
      }] : []
    };

    this.storage.saveTicket(newTicket);
    this.refreshAllViews();
    this.showToast(
      isWinningTicket
        ? `Ticket Premiado #${ticketId} inyectado en Caja ${targetCur} de ${ag.name} (Premio: ${this.formatMoney(prizeAmount, targetCur)})`
        : `Ticket de Venta #${ticketId} inyectado en Caja ${targetCur} de ${ag.name} (${this.formatMoney(amountVal, targetCur)})`,
      isWinningTicket ? '🏆' : '⚡'
    );
  }

  sendAgencyWhatsAppSummary(agencyCode, copyToClipboardOnly = false) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;
    const periodTickets = this.getFilteredTicketsByDate();
    const m = this.calculateAgencyFinancials(ag, periodTickets);
    const allowed = this.storage.getAllowedCurrenciesForAgency(ag.code);
    const currenciesToReport = Array.from(new Set([...allowed, ...['COP', 'USD', 'VES'].filter(c => m.boxes[c].totalTicketsCount > 0)]));

    const boxSections = currenciesToReport.map(cur => {
      const b = m.boxes[cur];
      const balanceTag = b.bancaUtility >= 0
        ? `✅ *SALDO BANCA (${cur}):* ${this.formatMoney(b.bancaUtility, cur)}`
        : `🔴 *SALDO A PAGAR AGENCIA (${cur}):* ${this.formatMoney(Math.abs(b.bancaUtility), cur)}`;

      return [
        `🏦 *CAJA INDEPENDIENTE ${cur}*`,
        `🎟️ *Tickets Activos:* ${b.activeCount} | *Anulados:* ${b.voidCount}`,
        `💰 *Ventas Brutas:* ${this.formatMoney(b.gross, cur)}`,
        `🚫 *Anulados:* -${this.formatMoney(b.voided, cur)}`,
        `📈 *VENTA NETA:* ${this.formatMoney(b.net, cur)}`,
        `🏪 *Comisión (${ag.commissionPct}%):* -${this.formatMoney(b.commission, cur)}`,
        `🏆 *Premios Totales:* -${this.formatMoney(b.totalPrizes, cur)}`,
        balanceTag
      ].join('\n');
    }).join('\n----------------------------------\n');

    const text = [
      `🏦 *BANCA FC FERNANDO CASTAÑO*`,
      `📋 *CORTE Y RELACIÓN DE TAQUILLA (CAJAS INDEPENDIENTES)*`,
      `----------------------------------`,
      `🏪 *Agencia:* ${ag.code} - ${ag.name}`,
      `👤 *Responsable:* ${ag.manager}`,
      `🛵 *Cobrador:* ${ag.collector}`,
      `📍 *Zona:* ${ag.zone}`,
      `----------------------------------`,
      boxSections,
      `----------------------------------`,
      `🕒 *Generado:* ${new Date().toLocaleString('es-VE')}`
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (copyToClipboardOnly) {
      this.showToast(`Relación de ${ag.name} copiada al portapapeles. Abriendo WhatsApp...`, '📲');
    }

    const cleanPhone = (ag.whatsapp || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  // =========================================================================
  // 5. MÓDULO 3: AUDITORÍA DE TICKETS EN VIVO Y SEMÁFORO DE RIESGO
  // =========================================================================
  bindTicketsAndRiskEvents() {
    document.getElementById('live-ticket-search')?.addEventListener('input', () => this.refreshAllViews());
    document.getElementById('live-ticket-agency-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('live-ticket-status-filter')?.addEventListener('change', () => this.refreshAllViews());
    document.getElementById('risk-category-filter')?.addEventListener('change', () => this.refreshAllViews());

    document.getElementById('btn-admin-print-ticket')?.addEventListener('click', () => {
      window.print();
    });
    document.getElementById('btn-admin-wa-ticket')?.addEventListener('click', () => {
      if (this.currentPreviewTicket) {
        this.printer.shareViaWhatsApp(this.currentPreviewTicket);
      }
    });
  }

  renderTicketStatusBadge(status) {
    const st = (status || 'ACTIVO').toUpperCase();
    if (st === 'GANADOR') return `<span class="badge-pill badge-ganador">🏆 GANADOR</span>`;
    if (st === 'PAGADO') return `<span class="badge-pill badge-pagado">💵 PAGADO</span>`;
    if (st === 'ANULADO') return `<span class="badge-pill badge-anulado">🚫 ANULADO</span>`;
    return `<span class="badge-pill badge-activa">ACTIVO</span>`;
  }

  renderLiveTicketsMonitor(periodTickets, agencies) {
    const tbody = document.getElementById('live-tickets-tbody');
    const agFilterEl = document.getElementById('live-ticket-agency-filter');
    if (!tbody) return;

    // Actualizar dropdown de filtro de agencias
    if (agFilterEl) {
      const currentVal = agFilterEl.value || 'ALL';
      agFilterEl.innerHTML = '<option value="ALL">Todas las Agencias</option>';
      agencies.forEach(a => {
        agFilterEl.innerHTML += `<option value="${a.code}">${a.code} - ${a.name}</option>`;
      });
      agFilterEl.value = currentVal;
    }

    const q = (document.getElementById('live-ticket-search')?.value || '').trim().toLowerCase();
    const agFilter = agFilterEl?.value || 'ALL';
    const stFilter = document.getElementById('live-ticket-status-filter')?.value || 'ALL';

    const filtered = periodTickets.filter(t => {
      const tCode = this.storage.extractAgencyCodeFromTicket(t);
      if (agFilter !== 'ALL' && String(tCode) !== String(agFilter)) return false;
      if (stFilter !== 'ALL' && t.estado !== stFilter) return false;
      if (q) {
        const itemsText = (t.items || []).map(p => `${p.lotteryName} ${p.number} ${p.animalName || ''} ${p.sign || ''}`).join(' ');
        const hay = `${t.ticketId} ${t.serialSeguridad} ${t.agencia} ${t.usuario} ${itemsText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No hay tickets que coincidan con el filtro actual.</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(t => {
      const prizeVal = Number(t.premioPagado || t.premioCalculado || 0);
      const cur = t.moneda || 'COP';
      const playsDetailHtml = (t.items || []).map(p => {
        let numTag = `<strong class="text-amber-300 font-mono">${p.number}</strong>`;
        if (p.sign) numTag += ` <span class="text-sky-300 font-bold">${p.sign}</span>`;
        if (p.animalName) numTag += ` <span class="text-emerald-300">(${p.animalName})</span>`;
        if (p.is5ta) numTag += ` <span class="text-amber-400 font-bold">[5ta]</span>`;
        return `<div class="text-[11px] leading-snug"><span class="text-slate-200 font-semibold">${p.lotteryName}:</span> ${numTag} <span class="text-slate-400 font-mono">(${this.formatMoney(p.amount, cur)})</span></div>`;
      }).join('');

      html += `
        <tr>
          <td>
            <div class="font-mono font-black text-amber-400">#${t.ticketId}</div>
            <div class="font-mono text-[11px] text-slate-400">${t.serialSeguridad}</div>
          </td>
          <td class="text-xs text-slate-300">${t.fechaHora}</td>
          <td>
            <div class="font-bold text-white text-xs">${t.agencia}</div>
            <div class="text-[10px] text-slate-400">Moneda: ${cur} • ${(t.items || []).length} jug.</div>
          </td>
          <td class="text-left max-w-xs space-y-0.5 py-1.5">${playsDetailHtml || '<span class="text-slate-500">-</span>'}</td>
          <td class="text-right font-mono font-bold text-white">${this.formatMoney(t.total, cur)}</td>
          <td class="text-right font-mono font-bold ${prizeVal > 0 ? 'text-amber-400' : 'text-slate-500'}">
            ${this.formatMoney(prizeVal, cur)}
          </td>
          <td class="text-center">${this.renderTicketStatusBadge(t.estado)}</td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold" data-id="${t.ticketId}" title="Vista Previa Ticket Térmico">
                🖨️ Ticket
              </button>
              ${t.estado !== 'PAGADO' && t.estado !== 'ANULADO' ? `
                <button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold" data-id="${t.ticketId}" title="Marcar como Pagado">
                  💵
                </button>
              ` : ''}
              ${t.estado !== 'ANULADO' ? `
                <button type="button" class="btn-void-admin px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-bold" data-id="${t.ticketId}" title="Anular Ticket">
                  🚫
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    this.bindTicketRowActionButtons(tbody);
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
        let prizeToPay = Number(ticket.premioCalculado || 0);
        if (prizeToPay <= 0) {
          const inputPrize = prompt(`Ingrese el monto de premio a registrar como PAGADO para el Ticket #${ticket.ticketId} (${ticket.moneda}):`, String(ticket.total * 30));
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
        this.showToast(`Ticket #${ticket.ticketId} marcado como PAGADO (${this.formatMoney(prizeToPay, ticket.moneda)})`, '💵');
      });
    });

    containerEl.querySelectorAll('.btn-void-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticket = this.storage.getTicketById(btn.dataset.id);
        if (!ticket) return;
        if (confirm(`¿Confirma ANULAR administrativamente el Ticket #${ticket.ticketId} de ${ticket.agencia}?`)) {
          this.storage.updateTicketStatus(ticket.ticketId, 'ANULADO', {
            fechaAnulacion: new Date().toLocaleString('es-VE')
          });
          this.refreshAllViews();
          this.showToast(`Ticket #${ticket.ticketId} ha sido ANULADO.`, '🚫');
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

  // Semáforo de Riesgo y Topes por Número y Animalito (Estrictamente en la Caja Seleccionada - Cero Conversión)
  renderRiskSemaphoreTable(periodTickets) {
    const tbody = document.getElementById('risk-semaphore-tbody');
    if (!tbody) return;

    const cfg = this.storage.getConfig();
    const selectedCur = this.storage.getConsolidationCurrency();
    const catFilter = document.getElementById('risk-category-filter')?.value || 'ALL';

    const activeTickets = periodTickets.filter(t => t.estado !== 'ANULADO' && (t.moneda || 'COP').toUpperCase() === selectedCur);
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
            mult = cfg.multipliers.animalito || 30;
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
            const emoji = (ANIMALITOS_DICT[p.number] || {}).emoji || '🐾';
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
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Sin exposición activa en Caja <strong>${selectedCur}</strong> para los filtros actuales.</td></tr>`;
      return;
    }

    let html = '';
    sorted.slice(0, 30).forEach(item => {
      const pct = item.topeGlobal > 0 ? Math.min(100, Math.round((item.totalBetGlobal / item.topeGlobal) * 100)) : 0;
      const rawPct = item.topeGlobal > 0 ? Math.round((item.totalBetGlobal / item.topeGlobal) * 100) : 0;

      let barColor = 'bg-emerald-500';
      let textColor = 'text-emerald-400';
      let riskLabel = 'Bajo';

      if (rawPct >= 85) {
        barColor = 'bg-rose-500';
        textColor = 'text-rose-400';
        riskLabel = 'CRÍTICO';
      } else if (rawPct >= 50) {
        barColor = 'bg-amber-500';
        textColor = 'text-amber-400';
        riskLabel = 'Alerta';
      }

      html += `
        <tr>
          <td>
            <div class="font-bold text-white text-xs">${item.lotteryName}</div>
            <div class="text-[10px] text-slate-400 uppercase">${item.type} (${item.multiplier}x) • Caja ${item.currency}</div>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-black text-amber-300 text-xs">
              ${item.displayNum}
            </span>
          </td>
          <td class="text-right font-mono font-bold text-white">
            ${this.formatMoney(item.totalBetGlobal, item.currency)}
            <div class="text-[10px] text-slate-400">${item.betsCount} jugadas</div>
          </td>
          <td class="text-right font-mono font-black text-amber-400">
            ${this.formatMoney(item.potentialPrizeGlobal, item.currency)}
          </td>
          <td>
            <div class="flex items-center justify-between text-[10px] font-bold mb-1">
              <span class="${textColor}">${riskLabel}</span>
              <span class="font-mono text-slate-300">${rawPct}%</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="${barColor} h-full rounded-full transition-all" style="width: ${pct}%"></div>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // =========================================================================
  // 6. MÓDULO 4: CARGA DE RESULTADOS Y LIQUIDACIÓN AUTOMÁTICA DE PREMIOS
  // =========================================================================
  populateResultsLotterySelect() {
    const catSelect = document.getElementById('res-admin-category');
    const lotSelect = document.getElementById('res-admin-lottery');
    const signSelect = document.getElementById('res-admin-sign');
    const dateInput = document.getElementById('res-admin-date');

    if (dateInput && !dateInput.value) {
      const today = new Date();
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    if (signSelect && signSelect.options.length <= 1) {
      signSelect.innerHTML = '<option value="">-- Sin Signo --</option>';
      ZODIAC_SIGNS.forEach(s => {
        signSelect.innerHTML += `<option value="${s.code}">${s.code} - ${s.name}</option>`;
      });
    }

    const filterInput = document.getElementById('res-admin-lottery-filter');

    const updateLotteriesByCat = () => {
      const cat = catSelect?.value || 'sin_signo';
      const q = (filterInput?.value || '').trim().toLowerCase();
      const list = (LOTTERY_CATALOGS[cat] || []).filter(l => {
        if (!q) return true;
        return l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
      });
      if (lotSelect) {
        lotSelect.innerHTML = '';
        list.forEach(l => {
          lotSelect.innerHTML += `<option value="${l.id}">${l.name}</option>`;
        });
      }
      document.getElementById('res-admin-sign-box')?.classList.toggle('hidden', cat !== 'con_signo');
      document.getElementById('res-admin-5ta-box')?.classList.toggle('hidden', cat !== 'cuatro_cifras');
    };

    catSelect?.addEventListener('change', updateLotteriesByCat);
    filterInput?.addEventListener('input', updateLotteriesByCat);
    updateLotteriesByCat();
  }

  bindResultsModuleEvents() {
    const numInput = document.getElementById('res-admin-number');
    const catSelect = document.getElementById('res-admin-category');
    const lotSelect = document.getElementById('res-admin-lottery');
    const animalPreview = document.getElementById('res-admin-animal-preview');
    const animalLabel = document.getElementById('res-admin-animal-label');

    const updateAnimalOrFruitPreview = () => {
      const val = (numInput?.value || '').trim();
      if (catSelect?.value === 'animalitos' && val) {
        const lotId = lotSelect?.value || '';
        const info = typeof getAnimalOrFruitInfo === 'function'
          ? getAnimalOrFruitInfo(val, lotId)
          : (ANIMALITOS_DICT[val] || ANIMALITOS_DICT['0' + val]);
        if (info && animalPreview && animalLabel) {
          animalLabel.textContent = `${info.emoji} ${val} - ${info.name}`;
          animalPreview.classList.remove('hidden');
          return;
        }
      }
      animalPreview?.classList.add('hidden');
    };

    numInput?.addEventListener('input', updateAnimalOrFruitPreview);
    lotSelect?.addEventListener('change', updateAnimalOrFruitPreview);

    document.getElementById('res-admin-date')?.addEventListener('change', () => this.renderResultsAndWinnersView());

    const form = document.getElementById('form-admin-load-result');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateKey = document.getElementById('res-admin-date').value;
      const lotteryId = document.getElementById('res-admin-lottery').value;
      let number = document.getElementById('res-admin-number').value.trim();
      const sign = document.getElementById('res-admin-sign').value || null;
      const ball5 = document.getElementById('res-admin-ball5').value.trim() || null;

      if (!number) return;

      let animalName = null;
      if (document.getElementById('res-admin-category')?.value === 'animalitos') {
        if (number !== '0' && number !== '00' && number.length === 1) {
          number = '0' + number;
        }
        const info = typeof getAnimalOrFruitInfo === 'function'
          ? getAnimalOrFruitInfo(number, lotteryId)
          : (ANIMALITOS_DICT[number] || ANIMALITOS_DICT['0' + number]);
        if (info) animalName = info.name;
      }

      const now = new Date();
      let hr = now.getHours();
      const min = String(now.getMinutes()).padStart(2, '0');
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;

      const resultObj = {
        number,
        sign,
        ball5,
        animalName,
        timestamp: `${hr}:${min} ${ampm}`,
        source: 'OFICIAL BANCA FC',
        verified: true
      };

      const resStats = this.storage.saveResult(dateKey, lotteryId, resultObj);
      if (window.bancaFcAutoResults) {
        window.bancaFcAutoResults.pushToFirebaseOfficialNode(dateKey, this.storage.getResults(dateKey));
      }
      document.getElementById('res-admin-number').value = '';
      document.getElementById('res-admin-ball5').value = '';
      animalPreview?.classList.add('hidden');

      const lotObj = typeof findLotteryById === 'function' ? findLotteryById(lotteryId) : null;
      const lotDisplay = lotObj ? lotObj.name : lotteryId;

      this.refreshAllViews();
      this.showToast(
        `Resultado ${lotDisplay}: ${number}${animalName ? ' (' + animalName + ')' : ''} publicado. Se liquidaron ${resStats.winnersCount} tickets ganadores.`,
        '🏆'
      );
    });
  }

  renderResultsAndWinnersView() {
    const dateKey = document.getElementById('res-admin-date')?.value || new Date().toISOString().split('T')[0];
    const results = this.storage.getResults(dateKey);
    const allTickets = this.storage.getTickets();
    const globalCur = this.storage.getConsolidationCurrency();

    const resultsTbody = document.getElementById('admin-results-tbody');
    const winnersTbody = document.getElementById('admin-winning-tickets-tbody');
    const countBadge = document.getElementById('results-count-badge');

    const keys = Object.keys(results);
    if (countBadge) countBadge.textContent = `${keys.length} Sorteos`;

    if (resultsTbody) {
      if (keys.length === 0) {
        resultsTbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No hay resultados cargados para la fecha ${dateKey}.</td></tr>`;
      } else {
        let rows = '';
        keys.forEach(lotId => {
          const r = results[lotId];
          let detail = r.number;
          if (r.sign) detail += ` - ${r.sign}`;
          if (r.animalName) detail += ` (${r.animalName})`;
          if (r.ball5) detail += ` [5ta: ${r.ball5}]`;

          // Contar cuántos tickets ganaron en este sorteo por cada moneda nativa (CERO conversión)
          let hitCount = 0;
          const prizeByCur = { COP: 0, USD: 0, VES: 0 };
          allTickets.forEach(t => {
            if (t.estado === 'ANULADO') return;
            const tCur = (t.moneda || 'COP').toUpperCase();
            (t.winningPlays || []).forEach(wp => {
              if (wp.lotteryId === lotId) {
                hitCount++;
                prizeByCur[tCur] = (prizeByCur[tCur] || 0) + (Number(wp.prize) || 0);
              }
            });
          });

          const prizeSummaryHtml = ['COP', 'USD', 'VES']
            .filter(c => prizeByCur[c] > 0)
            .map(c => `<div>${this.formatMoney(prizeByCur[c], c)}</div>`)
            .join('') || this.formatMoney(0, globalCur);

          const lotObj = typeof findLotteryById === 'function' ? findLotteryById(lotId) : null;
          const lotDisplayName = lotObj ? lotObj.name : lotId;

          rows += `
            <tr>
              <td class="font-bold text-white text-xs">${lotDisplayName}</td>
              <td><span class="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs">${detail}</span></td>
              <td class="text-xs text-slate-400">${r.timestamp || 'Oficial'}</td>
              <td class="text-center font-mono font-bold ${hitCount > 0 ? 'text-amber-400' : 'text-slate-500'}">${hitCount} aciertos</td>
              <td class="text-right font-mono font-bold ${hitCount > 0 ? 'text-amber-400' : 'text-slate-500'}">${prizeSummaryHtml}</td>
              <td class="text-center">
                <button type="button" class="btn-del-official-res px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-bold" data-lot="${lotId}">
                  Eliminar
                </button>
              </td>
            </tr>
          `;
        });
        resultsTbody.innerHTML = rows;

        resultsTbody.querySelectorAll('.btn-del-official-res').forEach(btn => {
          btn.addEventListener('click', () => {
            this.storage.deleteResult(dateKey, btn.dataset.lot);
            this.refreshAllViews();
            this.showToast(`Resultado de ${btn.dataset.lot} eliminado y premios recalculados.`, '🗑️');
          });
        });
      }
    }

    if (winnersTbody) {
      const winningTickets = allTickets.filter(t => t.estado === 'GANADOR' || t.estado === 'PAGADO' || (t.premioCalculado && t.premioCalculado > 0));
      if (winningTickets.length === 0) {
        winnersTbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No hay tickets premiados registrados.</td></tr>`;
      } else {
        let wRows = '';
        winningTickets.forEach(t => {
          const cur = t.moneda || 'COP';
          const prize = Number(t.premioPagado || t.premioCalculado || 0);
          const detail = (t.winningPlays || []).map(wp => `${wp.lotteryName}: <strong>${wp.number}</strong> (${wp.winType} ${wp.multiplier}x)`).join('<br>') || 'Premio Liquidado';

          wRows += `
            <tr>
              <td class="font-mono font-black text-amber-400">#${t.ticketId}</td>
              <td class="font-bold text-white text-xs">${t.agencia}</td>
              <td class="text-xs text-slate-200">${detail}</td>
              <td class="text-right font-mono text-slate-300">${this.formatMoney(t.total, cur)}</td>
              <td class="text-right font-mono font-black text-amber-400">${this.formatMoney(prize, cur)}</td>
              <td class="text-center">${this.renderTicketStatusBadge(t.estado)}</td>
              <td class="text-center">
                <div class="inline-flex items-center gap-1">
                  <button type="button" class="btn-view-thermal px-2 py-1 rounded bg-slate-800 text-sky-400 text-[11px] font-bold" data-id="${t.ticketId}">🖨️</button>
                  ${t.estado !== 'PAGADO' ? `
                    <button type="button" class="btn-mark-paid px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold" data-id="${t.ticketId}">Pagar</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        });
        winnersTbody.innerHTML = wRows;
        this.bindTicketRowActionButtons(winnersTbody);
      }
    }
  }

  // =========================================================================
  // 7. COBRADORES POR RUTA Y PARÁMETROS DE MULTIPLICADORES
  // =========================================================================
  loadGlobalMultipliersForm() {
    const cfg = this.storage.getConfig();
    const m = cfg.multipliers || {};
    const topes = cfg.topes || {};

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

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

    // Actualizar etiquetas en la pestaña de resultados
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
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
      this.showToast(`Cobrador "${name}" agregado a las rutas de Banca FC.`, '🛵');
    });

    const formMult = document.getElementById('form-global-multipliers');
    formMult?.addEventListener('submit', (e) => {
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

      // Propagar también como base a las agencias registradas cuando se guarda desde Parámetros Globales
      const master = this.storage.getMasterData();
      if (Array.isArray(master.agencies)) {
        master.agencies.forEach(ag => {
          ag.multipliers = { ...(ag.multipliers || {}), ...newMultipliers };
        });
        this.storage.saveMasterData(master, false);
      }

      this.storage.updateConfig({
        multipliers: newMultipliers,
        topes: newTopes,
        adminResetPassword: newResetPass
      });
      this.storage.recalculateAllTicketWinnings();
      this.loadGlobalMultipliersForm();
      this.refreshAllViews();
      this.showToast('Multiplicadores, topes y contraseña maestra actualizados.', '⚙️');
    });
  }

  renderCollectorsSummaryTable(agencies, periodTickets) {
    const tbody = document.getElementById('collectors-summary-tbody');
    if (!tbody) return;

    const collectors = this.storage.getCollectors();
    const selectedCur = this.storage.getConsolidationCurrency();

    let html = '';
    collectors.forEach(colName => {
      const assignedAgencies = agencies.filter(a => a.collector === colName);
      const routeBoxes = {
        COP: { net: 0, commission: 0, prizes: 0, utility: 0 },
        USD: { net: 0, commission: 0, prizes: 0, utility: 0 },
        VES: { net: 0, commission: 0, prizes: 0, utility: 0 }
      };

      assignedAgencies.forEach(ag => {
        const m = this.calculateAgencyFinancials(ag, periodTickets);
        ['COP', 'USD', 'VES'].forEach(curKey => {
          const b = m.boxes[curKey];
          if (!b) return;
          routeBoxes[curKey].net += b.net;
          routeBoxes[curKey].commission += b.commission;
          routeBoxes[curKey].prizes += b.totalPrizes;
          routeBoxes[curKey].utility += b.bancaUtility;
        });
      });

      const activeRoute = routeBoxes[selectedCur] || routeBoxes.COP;
      const isPositive = activeRoute.utility >= 0;

      const multiCurBadges = ['COP', 'USD', 'VES']
        .map(c => `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono ${routeBoxes[c].utility >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${c}: ${this.formatMoney(routeBoxes[c].utility, c)}</span>`)
        .join(' ');

      html += `
        <tr>
          <td>
            <div class="font-bold text-white">🛵 ${colName}</div>
            <div class="mt-1 flex flex-wrap gap-1">${multiCurBadges}</div>
          </td>
          <td class="text-center font-mono text-sky-400 font-bold">${assignedAgencies.length} taquillas</td>
          <td class="text-right font-mono text-slate-200">${this.formatMoney(activeRoute.net, selectedCur)}</td>
          <td class="text-right font-mono text-indigo-300">${this.formatMoney(activeRoute.commission, selectedCur)}</td>
          <td class="text-right font-mono text-amber-400">${this.formatMoney(activeRoute.prizes, selectedCur)}</td>
          <td class="text-right font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}">
            ${this.formatMoney(activeRoute.utility, selectedCur)}
            <div class="text-[10px] text-slate-400">Caja ${selectedCur}</div>
          </td>
          <td class="text-center">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" class="btn-wa-collector px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold" data-collector="${colName}">
                📲 Enviar Ruta WA
              </button>
              <button type="button" class="btn-del-collector px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-800 text-rose-300 border border-rose-800 text-xs font-bold" data-collector="${colName}" title="Eliminar Cobrador">
                🗑️ Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.btn-del-collector').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleDeleteCollector(btn.dataset.collector);
      });
    });

    tbody.querySelectorAll('.btn-wa-collector').forEach(btn => {
      btn.addEventListener('click', () => {
        const colName = btn.dataset.collector;
        const assigned = agencies.filter(a => a.collector === colName);
        const routeTotals = { COP: 0, USD: 0, VES: 0 };
        const lines = [
          `🏦 *BANCA FC FERNANDO CASTAÑO*`,
          `🛵 *HOJA DE RUTA DE COBRADOR (CAJAS SEPARADAS):* ${colName}`,
          `----------------------------------`
        ];

        assigned.forEach(ag => {
          const m = this.calculateAgencyFinancials(ag, periodTickets);
          const agParts = [];
          ['COP', 'USD', 'VES'].forEach(c => {
            if (m.boxes[c].totalTicketsCount > 0 || (ag.allowedCurrencies || []).includes(c)) {
              routeTotals[c] += m.boxes[c].bancaUtility;
              agParts.push(`${c}: ${this.formatMoney(m.boxes[c].bancaUtility, c)}`);
            }
          });
          lines.push(`• *${ag.code} ${ag.name}:* ${agParts.join(' | ')}`);
        });

        lines.push(`----------------------------------`);
        lines.push(`💰 *TOTAL CAJA PESOS (COP):* ${this.formatMoney(routeTotals.COP, 'COP')}`);
        lines.push(`💵 *TOTAL CAJA DÓLARES (USD):* ${this.formatMoney(routeTotals.USD, 'USD')}`);
        lines.push(`🇻🇪 *TOTAL CAJA BOLÍVARES (VES):* ${this.formatMoney(routeTotals.VES, 'VES')}`);

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
        window.open(url, '_blank');
      });
    });
  }

  // =========================================================================
  // 8. SIMULADOR DE VENTA POS Y EXPORTACIÓN CSV / EXCEL
  // =========================================================================
  simulateIncomingPosTicket() {
    const activeAgencies = this.storage.getAgencies().filter(a => a.status === 'ACTIVA');
    if (activeAgencies.length === 0) {
      alert('No hay agencias activas para simular ventas.');
      return;
    }

    const randomAg = activeAgencies[Math.floor(Math.random() * activeAgencies.length)];
    const ticketId = this.storage.getNextTicketNumber();
    const serial = this.storage.generateSecuritySerial();
    const now = new Date();
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${hr}:${min}:${sec} ${ampm}`;

    const samplePlays = [
      { lotteryId: 'CHANCE_A_1300', lotteryName: 'Chance A 1:00 PM', number: String(Math.floor(100 + Math.random() * 900)), type: 'triple' },
      { lotteryId: 'FRUTA_GANA_1400', lotteryName: 'Fruta Gana 2:00 PM', number: '07', animalName: 'Patilla', type: 'animalito' },
      { lotteryId: 'SELVA_PLUS_1515', lotteryName: 'Selva Plus 3:15 PM', number: '12', animalName: 'Caballo', type: 'animalito' },
      { lotteryId: 'ASTRO_LUNA_2230', lotteryName: 'Super Astro Luna 10:30 PM', number: String(Math.floor(1000 + Math.random() * 9000)), sign: 'LEO', type: 'astro' },
      { lotteryId: 'DORADO_NOCHE', lotteryName: 'Dorado Noche 10:05 PM', number: String(Math.floor(1000 + Math.random() * 9000)), is5ta: true, type: 'cuatro_cifras' }
    ];

    const chosen = samplePlays[Math.floor(Math.random() * samplePlays.length)];
    const baseAmount = randomAg.currency === 'VES' ? (Math.floor(2 + Math.random() * 15) * 50) : (Math.floor(2 + Math.random() * 15) * 2000);

    const ticket = {
      ticketId,
      serialSeguridad: serial,
      fechaHora: dateStr,
      agencyCode: randomAg.code,
      agencia: `${randomAg.code} - ${randomAg.name}`,
      usuario: randomAg.code,
      moneda: randomAg.currency,
      items: [{
        uid: Date.now().toString(36),
        ...chosen,
        amount: baseAmount
      }],
      total: baseAmount,
      estado: 'ACTIVO',
      premioCalculado: 0
    };

    this.storage.saveTicket(ticket);
    this.refreshAllViews();
    this.showToast(`Venta en vivo recibida: Ticket #${ticketId} en ${randomAg.name} (${this.formatMoney(baseAmount, randomAg.currency)})`, '🎰');
  }

  exportGlobalReportCsv() {
    const periodTickets = this.getFilteredTicketsByDate();
    const agencies = this.storage.getAgencies();

    let csv = '\uFEFF'; // BOM para Excel UTF-8
    csv += 'REPORTE MULTIMONEDA POR CAJAS INDEPENDIENTES - BANCA FC FERNANDO CASTANO\n';
    csv += `Fecha Generacion,${new Date().toLocaleString('es-VE')},Contabilidad,3 Cajas Separadas (Sin Conversion)\n\n`;
    csv += 'Codigo,Agencia,Zona,Cobrador,Estado,Comision %,Caja Moneda,Tickets Activos,Tickets Anulados,Venta Bruta,Anulados,Venta Neta,Comision Agencia,Premios,Utilidad Banca FC\n';

    agencies.forEach(ag => {
      const m = this.calculateAgencyFinancials(ag, periodTickets);
      ['COP', 'USD', 'VES'].forEach(curKey => {
        const b = m.boxes[curKey];
        if (b.totalTicketsCount > 0 || (ag.allowedCurrencies || [ag.currency]).includes(curKey)) {
          csv += [
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
    link.download = `Reporte_Banca_FC_Fernando_Castano_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Reporte CSV / Excel descargado exitosamente.', '📥');
  }

  // =========================================================================
  // 9. ESCUCHA EN TIEMPO REAL DEL POS (STORAGE EVENT + POLLING + API)
  // =========================================================================
  bindRealtimeSync() {
    // 1. Escuchar el evento nativo 'storage' cuando la Taquilla POS imprime o anula un ticket en otra pestaña
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.MASTER_DB || e.key === STORAGE_KEYS.TICKETS || e.key === STORAGE_KEYS.RESULTS) {
        this.refreshAllViews();
        this.showToast('Sincronización en vivo: Movimiento detectado desde Taquilla POS.', '📡');
      }
    });

    // 2. Escuchar evento interno en la misma ventana
    window.addEventListener('banca_fc_data_updated', () => {
      this.refreshAllViews();
    });

    // 3. Polling automático cada 3 segundos contra el Servidor Central en Red LAN (si está activo)
    setInterval(() => {
      this.storage.pullFromRemoteServer();
    }, 3000);
  }

  openNetworkSyncModal() {
    const modal = document.getElementById('modal-network-sync');
    modal?.classList.remove('hidden');
    this.updateFirebaseModalView();
  }

  updateFirebaseModalView() {
    const inputEl = document.getElementById('input-firebase-db-url');
    const shareBox = document.getElementById('fb-share-links-box');
    const shareInput = document.getElementById('input-share-pos-url');
    const statusBadge = document.getElementById('fb-modal-status-badge');

    if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
      if (inputEl) inputEl.value = window.bancaFcCloud.databaseURL;
      if (shareBox) shareBox.classList.remove('hidden');
      if (shareInput) shareInput.value = window.bancaFcCloud.getShareablePosUrl();
      if (statusBadge) {
        statusBadge.className = 'badge-pill badge-activa';
        statusBadge.textContent = '🟢 Firebase Conectado en Vivo';
      }
    } else {
      if (shareBox) shareBox.classList.add('hidden');
      if (statusBadge) {
        statusBadge.className = 'badge-pill badge-suspendida';
        statusBadge.textContent = 'Sin configurar';
      }
    }
  }

  // =========================================================================
  // 10. ELIMINAR AGENCIA, GESTIONAR COBRADORES Y REINICIO CON CONTRASEÑA
  // =========================================================================
  handleDeleteAgency(agencyCode, closeAuditModalAfter = false) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;

    const confirmMsg = `⚠️ ¿Está seguro de ELIMINAR la Agencia ${ag.code} - ${ag.name} y todos sus tickets asociados del sistema Banca FC Fernando Castaño?\n\nEsta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) return;

    this.storage.deleteAgency(ag.code, true);
    if (closeAuditModalAfter || this.currentAuditedAgencyCode === ag.code) {
      this.currentAuditedAgencyCode = null;
      document.getElementById('modal-audit-agency')?.classList.add('hidden');
    }
    this.refreshAllViews();
    this.showToast(`Agencia ${ag.code} (${ag.name}) eliminada del sistema.`, '🗑️');
  }

  openManageCollectorsModal() {
    this.renderModalCollectorsList();
    document.getElementById('modal-manage-collectors')?.classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('modal-input-collector-name')?.focus();
    }, 80);
  }

  renderModalCollectorsList() {
    const container = document.getElementById('modal-collectors-list');
    if (!container) return;

    const collectors = this.storage.getCollectors();
    const agencies = this.storage.getAgencies();

    if (collectors.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">No hay cobradores registrados.</div>`;
      return;
    }

    let html = '';
    collectors.forEach(cName => {
      const count = agencies.filter(a => a.collector === cName).length;
      html += `
        <div class="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <div>
            <div class="text-xs font-bold text-white">🛵 ${cName}</div>
            <div class="text-[10px] text-slate-400">${count} agencias asignadas</div>
          </div>
          <button type="button" class="btn-modal-del-collector px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-800 text-rose-300 border border-rose-800 text-xs font-bold transition" data-name="${cName}" title="Eliminar Cobrador">
            🗑️ Eliminar
          </button>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-modal-del-collector').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleDeleteCollector(btn.dataset.name);
      });
    });
  }

  handleDeleteCollector(collectorName) {
    if (!collectorName) return;
    if (!confirm(`¿Desea eliminar al cobrador "${collectorName}" de la lista de rutas de Banca FC?`)) {
      return;
    }
    this.storage.deleteCollector(collectorName);
    this.populateCollectorDropdowns();
    this.renderModalCollectorsList();
    this.refreshAllViews();
    this.showToast(`Cobrador "${collectorName}" eliminado correctamente.`, '🗑️');
  }

  promptResetAgencyToZero(agencyCode) {
    const ag = this.storage.getAgencyByCode(agencyCode);
    if (!ag) return;

    this.openPasswordResetModal({
      mode: 'AGENCY',
      agencyCode: ag.code,
      title: `🔐 Reiniciar Agencia ${ag.code} en Cero`,
      description: `⚠️ Se dejarán en CERO ($ 0) todas las ventas brutas, anulados, comisiones, premios y tickets de la taquilla <strong>${ag.code} - ${ag.name}</strong>. Ingrese la contraseña administrativa para confirmar.`
    });
  }

  openPasswordResetModal(configObj) {
    this.pendingResetAction = configObj;
    const modal = document.getElementById('modal-password-reset');
    const titleEl = document.getElementById('modal-reset-title');
    const descEl = document.getElementById('modal-reset-description');
    const inputEl = document.getElementById('input-reset-password');
    const errEl = document.getElementById('reset-password-error');

    if (titleEl) titleEl.innerHTML = configObj.title || '🔐 Autorización Requerida';
    if (descEl) descEl.innerHTML = configObj.description || '';
    if (inputEl) inputEl.value = '';
    if (errEl) errEl.classList.add('hidden');

    modal?.classList.remove('hidden');
    setTimeout(() => inputEl?.focus(), 80);
  }

  executePasswordProtectedReset() {
    if (!this.pendingResetAction) return;
    const inputEl = document.getElementById('input-reset-password');
    const errEl = document.getElementById('reset-password-error');
    const typedPass = (inputEl?.value || '').trim();

    let isAuthorized = this.storage.verifyAdminResetPassword(typedPass);

    // Si es reinicio de una agencia específica, también permitir la contraseña propia de esa agencia si coincide
    if (!isAuthorized && this.pendingResetAction.mode === 'AGENCY' && this.pendingResetAction.agencyCode) {
      const ag = this.storage.getAgencyByCode(this.pendingResetAction.agencyCode);
      if (ag && ag.password && typedPass === String(ag.password)) {
        isAuthorized = true;
      }
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
      this.showToast('✅ Base de datos de Banca FC reiniciada en CERO con autorización.', '🔓');
    } else if (this.pendingResetAction.mode === 'AGENCY' && this.pendingResetAction.agencyCode) {
      const ag = this.storage.getAgencyByCode(this.pendingResetAction.agencyCode);
      this.storage.resetAgencyToZero(this.pendingResetAction.agencyCode);
      this.refreshAllViews();
      this.showToast(`✅ Agencia ${ag ? ag.code + ' - ' + ag.name : this.pendingResetAction.agencyCode} reiniciada en CERO.`, '🧹');
    }

    this.pendingResetAction = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.bancaFcAdmin = new BancaFcAdminController(storage, printer);
});
