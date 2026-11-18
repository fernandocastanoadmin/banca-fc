// app_movil/app_main.js - Controlador Completo de la App Móvil & Tablet POS Banca FC
// Código independiente enlazado en tiempo real con Firebase

document.addEventListener('DOMContentLoaded', () => {
  const cloud = window.appCloud;

  const state = {
    activeTab: 'vender',
    category: 'sin_signo',
    selectedLotteries: new Set(),
    lastLotterySelection: [],
    preTicketItems: [],
    editingAmount: false,
    selectedSign: 'ARI',
    is5ta: false,
    isCombinado: false,
    showAllWeek: false,
    lastNumberPlayed: '',
    lastMontoPlayed: 1000,
    ticketStatusFilter: 'TODOS',
    cashierCurrency: cloud.session.currency || 'COP',
    currentReceiptTicket: null,
    submitting: false
  };

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // ==================== ESTADO NUBE Y LOGIN ====================
  function updateCloudPills() {
    const pills = [
      document.getElementById('login-cloud-pill'),
      document.getElementById('btn-header-cloud')
    ];
    let cls = 'connecting';
    let loginText = '⏳ Conectando Nube...';
    let headerText = '⏳ SYNC';

    if (cloud.status === 'CONNECTED') {
      cls = 'connected';
      loginText = '🟢 Nube Firebase En Vivo';
      headerText = '🟢 NUBE OK';
    } else if (cloud.status === 'ERROR') {
      cls = 'error';
      loginText = '🔴 Error Firebase';
      headerText = '🔴 ERROR';
    }

    pills.forEach((el, idx) => {
      if (!el) return;
      el.className = `cloud-pill ${cls}`;
      el.textContent = idx === 0 ? loginText : headerText;
    });

    const cloudDetail = document.getElementById('app-cloud-detail');
    if (cloudDetail) {
      cloudDetail.textContent = `Estado: ${cloud.status} • Última sincronización: ${cloud.lastSyncClock || 'Pendiente'}`;
    }
    const urlInput = document.getElementById('app-firebase-url');
    if (urlInput && document.activeElement !== urlInput) {
      urlInput.value = cloud.databaseURL || '';
    }
  }

  function renderQuickAgencies() {
    // Eliminado listado público de códigos de agencias por privacidad y seguridad entre taquillas
  }

  function syncShellVisibility() {
    const loginEl = document.getElementById('app-login-screen');
    const shellEl = document.getElementById('app-main-shell');
    const loggedIn = Boolean(cloud.session && cloud.session.agencyCode);

    if (loggedIn) {
      loginEl?.classList.add('hidden');
      shellEl?.classList.remove('hidden');
      renderHeader();
      renderActiveTab();
    } else {
      loginEl?.classList.remove('hidden');
      shellEl?.classList.add('hidden');
    }
    updateCloudPills();
  }

  async function doLogin() {
    const code = (document.getElementById('app-login-code')?.value || '').trim();
    const pass = (document.getElementById('app-login-pass')?.value || '').trim();
    const errEl = document.getElementById('app-login-error');
    const btn = document.getElementById('btn-app-login');

    if (!code) {
      if (errEl) {
        errEl.textContent = 'Ingrese el código de su agencia asignada.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (btn) btn.disabled = true;
    errEl?.classList.add('hidden');

    const res = await cloud.authenticateAgency(code, pass);
    if (btn) btn.disabled = false;

    if (!res.success) {
      if (errEl) {
        errEl.textContent = res.reason;
        errEl.classList.remove('hidden');
      }
      return;
    }

    state.cashierCurrency = cloud.session.currency || 'COP';
    syncShellVisibility();
  }

  document.getElementById('btn-app-login')?.addEventListener('click', doLogin);
  document.getElementById('app-login-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('btn-login-cloud-cfg')?.addEventListener('click', async () => {
    const newUrl = prompt('URL de Firebase Realtime Database:', cloud.databaseURL);
    if (!newUrl) return;
    const res = await cloud.saveFirebaseUrl(newUrl);
    showToast(res.ok ? 'Conectado a Firebase' : (res.error || 'Error conectando'));
  });

  // ==================== CABECERA Y RELOJ ====================
  function renderHeader() {
    const code = cloud.session.agencyCode || '1000';
    const cur = cloud.session.currency || 'COP';
    const nextNum = String(cloud.masterData.config?.nextTicketNumber || 10926).padStart(8, '0');
    const agEl = document.getElementById('app-header-agency');
    const subEl = document.getElementById('app-header-sub');
    const montoLbl = document.getElementById('lcd-monto-label');

    if (agEl) agEl.textContent = `AGENCIA ${code} • ${cur}`;
    if (subEl) subEl.textContent = `Ticket #${nextNum} • ${cloud.formatTimeOnly12h(new Date())}`;
    if (montoLbl) montoLbl.textContent = `MONTO (${cur})`;
    renderQuickAmounts();
  }

  setInterval(() => {
    if (cloud.session.agencyCode) renderHeader();
  }, 1000);

  // ==================== NAVEGACIÓN INFERIOR ====================
  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    ['vender', 'tickets', 'premios', 'caja', 'nube'].forEach(t => {
      document.getElementById(`view-${t}`)?.classList.toggle('hidden', t !== tabName);
    });
    renderActiveTab();
  }

  function renderActiveTab() {
    if (state.activeTab === 'vender') {
      renderLotteries();
      renderConditionalPanels();
      renderPreTicketBar();
    } else if (state.activeTab === 'tickets') {
      renderTicketsTab();
    } else if (state.activeTab === 'premios') {
      renderWinnersAndResultsTab();
    } else if (state.activeTab === 'caja') {
      renderCashierTab();
    } else if (state.activeTab === 'nube') {
      renderCloudTab();
    }
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('btn-header-cloud')?.addEventListener('click', () => switchTab('nube'));

  // ==================== PESTAÑA VENDER (POS TOUCH) ====================
  function getOpenLotteries() {
    const list = APP_LOTTERY_CATALOGS[state.category] || [];
    const now = new Date();
    const q = (document.getElementById('app-lottery-search')?.value || '').trim().toLowerCase();
    return list.filter(lot => {
      if (!appIsLotteryOpen(lot, now, state.showAllWeek)) return false;
      if (!q) return true;
      return lot.name.toLowerCase().includes(q) || lot.id.toLowerCase().includes(q) || lot.time12.toLowerCase().includes(q);
    });
  }

  function pruneClosedSelections() {
    const now = new Date();
    for (const id of Array.from(state.selectedLotteries)) {
      const lot = appFindLotteryById(id);
      if (!lot || !appIsLotteryOpen(lot, now, state.showAllWeek)) {
        state.selectedLotteries.delete(id);
      }
    }
  }

  function renderLotteries() {
    pruneClosedSelections();
    const open = getOpenLotteries();
    const grid = document.getElementById('app-lotteries-grid');
    const countEl = document.getElementById('app-open-count');
    const selBadge = document.getElementById('app-selected-lot-badge');
    const now = new Date();

    if (countEl) countEl.textContent = `${open.length} abiertos`;
    if (selBadge) {
      if (state.selectedLotteries.size > 0) {
        selBadge.textContent = `${state.selectedLotteries.size} marcadas`;
        selBadge.classList.remove('hidden');
      } else {
        selBadge.classList.add('hidden');
      }
    }
    if (!grid) return;

    if (open.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:24px; color:#9ca3af; font-size:12.5px;">No hay sorteos abiertos (cierran 5 min antes)</div>';
      return;
    }

    grid.innerHTML = open.map(lot => {
      const sel = state.selectedLotteries.has(lot.id);
      const mins = appGetRemainingMinutes(lot, now);
      return `
        <div class="lot-card ${sel ? 'selected' : ''}" data-id="${esc(lot.id)}">
          <span>${sel ? '☑️' : '⬜'}</span>
          <span class="lot-card-name">${esc(lot.name)}</span>
          ${mins > 0 && mins <= 30 ? `<span class="lot-mins">${mins}m</span>` : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.lot-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (state.selectedLotteries.has(id)) {
          state.selectedLotteries.delete(id);
        } else {
          state.selectedLotteries.add(id);
        }
        renderLotteries();
        renderConditionalPanels();
      });
    });
  }

  function renderConditionalPanels() {
    document.getElementById('panel-app-zodiac')?.classList.toggle('hidden', state.category !== 'con_signo');
    document.getElementById('panel-app-4cifras')?.classList.toggle('hidden', state.category !== 'cuatro_cifras');
    document.getElementById('panel-app-animalitos')?.classList.toggle('hidden', state.category !== 'animalitos');

    if (state.category === 'con_signo') {
      const zWrap = document.getElementById('app-zodiac-chips');
      if (zWrap) {
        zWrap.innerHTML = APP_ZODIAC_SIGNS.map(z => `
          <button type="button" class="chip-btn ${state.selectedSign === z.code ? 'active' : ''}" data-sign="${z.code}">
            ${z.icon} ${z.code}
          </button>
        `).join('');
        zWrap.querySelectorAll('.chip-btn').forEach(b => {
          b.addEventListener('click', () => {
            state.selectedSign = b.dataset.sign;
            renderConditionalPanels();
          });
        });
      }
    }

    if (state.category === 'animalitos') {
      const selectedIds = Array.from(state.selectedLotteries);
      const opConfigs = [];
      const seenKeys = new Set();
      selectedIds.forEach(id => {
        const cfg = appGetOperatorConfig(id);
        if (cfg && !seenKeys.has(cfg.key)) {
          seenKeys.add(cfg.key);
          opConfigs.push(cfg);
        }
      });
      if (opConfigs.length === 0) {
        opConfigs.push(APP_OPERATOR_DICTIONARIES.BASE_38);
      }
      opConfigs.sort((a, b) => b.maxNum - a.maxNum);
      const primaryCfg = opConfigs[0];
      const maxNum = primaryCfg.maxNum || 36;

      const titleEl = document.getElementById('animalitos-grid-title');
      if (titleEl) {
        titleEl.textContent = opConfigs.length === 1
          ? `${primaryCfg.isFruta ? '🍉' : '🦁'} ${primaryCfg.label}`
          : `🦁 Multi-Operadora (0, 00 al ${maxNum})`;
      }

      const keys = ['0', '00'];
      for (let i = 1; i <= maxNum; i++) keys.push(String(i).padStart(2, '0'));
      const curNum = appNormalizeAnimalCode(document.getElementById('app-input-num')?.value || '');
      const grid = document.getElementById('app-animalitos-grid');
      if (grid) {
        grid.innerHTML = keys.map(k => {
          const figName = primaryCfg.dict[k] || '';
          const emoji = appGetEmojiForFigure(figName, Boolean(primaryCfg.isFruta));
          return `
            <div class="animal-card ${curNum === k ? 'selected' : ''}" data-num="${k}">
              <div class="animal-num">${emoji} ${k}</div>
              <div class="animal-name">${esc(figName)}</div>
            </div>
          `;
        }).join('');
        grid.querySelectorAll('.animal-card').forEach(card => {
          card.addEventListener('click', () => {
            const numInput = document.getElementById('app-input-num');
            if (numInput) numInput.value = card.dataset.num;
            setEditingField(false);
            updateAnimalPreview();
            renderConditionalPanels();
          });
        });
      }
    }
    updateAnimalPreview();
  }

  function updateAnimalPreview() {
    const el = document.getElementById('app-animal-live');
    const numVal = (document.getElementById('app-input-num')?.value || '').trim();
    if (!el) return;
    if (state.category !== 'animalitos' || !numVal) {
      el.textContent = '';
      return;
    }
    const selectedIds = Array.from(state.selectedLotteries);
    const probeIds = selectedIds.length > 0 ? selectedIds : ['LOTTO_ACTIVO'];
    const validLabels = new Set();
    const outOfRange = new Set();

    probeIds.forEach(id => {
      const res = appValidateAndResolveAnimal(numVal, id);
      if (res.valid) {
        validLabels.add(`${res.emoji} ${res.name}`);
      } else {
        outOfRange.add(`máx ${res.maxNum}`);
      }
    });

    if (validLabels.size > 0) {
      let txt = Array.from(validLabels).join(' / ');
      if (outOfRange.size > 0) txt += ` (⚠️ Omitido en ${Array.from(outOfRange).join(', ')})`;
      el.textContent = txt;
      el.style.color = '#fbbf24';
    } else {
      el.textContent = `⛔ Fuera de rango (${Array.from(outOfRange).join(', ')})`;
      el.style.color = '#f87171';
    }
  }

  function setEditingField(isAmount) {
    state.editingAmount = isAmount;
    document.getElementById('lcd-box-num')?.classList.toggle('active-num', !isAmount);
    document.getElementById('lcd-box-monto')?.classList.toggle('active-monto', isAmount);
    const sw = document.getElementById('btn-switch-field');
    if (sw) sw.textContent = isAmount ? 'NRO' : 'MONTO';
  }

  function renderQuickAmounts() {
    const wrap = document.getElementById('app-quick-amounts');
    if (!wrap) return;
    const cur = cloud.session.currency || 'COP';
    const amounts = cur === 'VES'
      ? [10, 20, 50, 100, 200, 500]
      : (cur === 'USD' ? [1, 2, 5, 10, 20, 50] : [500, 1000, 2000, 5000, 10000, 20000]);
    wrap.innerHTML = amounts.map(a => `<button type="button" class="chip-btn" data-amt="${a}">${esc(cloud.formatCurrency(a, cur))}</button>`).join('');
    wrap.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('app-input-monto');
        if (inp) inp.value = btn.dataset.amt;
      });
    });
  }

  function addPlayItem(numberStr, amountVal, signOverride = null, silent = false) {
    if (state.selectedLotteries.size === 0) {
      if (!silent) showToast('Seleccione al menos un sorteo abierto');
      return false;
    }
    const cleanInput = String(numberStr || '').trim();
    const monto = Number(amountVal);
    if (!cleanInput) {
      if (!silent) showToast('Ingrese un número o animalito');
      return false;
    }
    if (!monto || monto <= 0) {
      if (!silent) showToast('Ingrese un monto válido');
      return false;
    }

    const now = new Date();
    const selectedLots = getOpenLotteries().filter(l => state.selectedLotteries.has(l.id));
    if (selectedLots.length === 0) {
      renderLotteries();
      if (!silent) showToast('Los sorteos seleccionados ya cerraron (-5 min)');
      return false;
    }

    let added = 0;
    const omittedByRange = [];
    selectedLots.forEach(lot => {
      if (!appIsLotteryOpen(lot, now, state.showAllWeek)) return;
      let playType = 'triple';
      let animalName = null;
      let cleanNum = cleanInput;

      if (state.category === 'animalitos') {
        playType = 'animalito';
        const resolved = appValidateAndResolveAnimal(cleanNum, lot.id || lot.name);
        if (!resolved.valid) {
          omittedByRange.push(`${lot.name} (máx. ${resolved.maxNum})`);
          return;
        }
        cleanNum = resolved.code;
        animalName = resolved.name;
      } else if (state.category === 'con_signo') {
        playType = lot.type === 'astro' ? 'astro' : 'zodiac';
      } else if (state.category === 'cuatro_cifras') {
        playType = 'cuatro_cifras';
      } else {
        playType = (lot.type === 'terminal' || cleanNum.length === 2) ? 'terminal' : 'triple';
      }

      state.preTicketItems.push({
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        lotteryId: lot.id,
        lotteryName: lot.name,
        drawTime12: lot.time12,
        number: cleanNum,
        type: playType,
        sign: state.category === 'con_signo' ? (signOverride || state.selectedSign) : null,
        animalName,
        is5ta: state.category === 'cuatro_cifras' && Boolean(lot.has5ta) && state.is5ta,
        isCombinado: state.category === 'cuatro_cifras' && state.isCombinado,
        amount: monto
      });
      added++;
    });

    if (added === 0) {
      if (!silent) showToast(`⛔ Número ${cleanInput} fuera del rango oficial de la operadora`);
      return false;
    }

    if (omittedByRange.length > 0 && !silent) {
      showToast(`Cargado en ${added} sorteo(s). Ignorado en: ${omittedByRange.join(', ')}`);
    }

    state.lastNumberPlayed = cleanInput;
    state.lastMontoPlayed = monto;
    state.lastLotterySelection = Array.from(state.selectedLotteries);
    return true;
  }

  function renderPreTicketBar() {
    const countEl = document.getElementById('app-preticket-count');
    const totalEl = document.getElementById('app-preticket-total');
    const emitBtn = document.getElementById('btn-emit-bar');
    const total = state.preTicketItems.reduce((s, it) => s + Number(it.amount || 0), 0);

    if (countEl) countEl.textContent = String(state.preTicketItems.length);
    if (totalEl) totalEl.textContent = cloud.formatCurrency(total);
    if (emitBtn) emitBtn.disabled = state.preTicketItems.length === 0 || state.submitting;
    renderPreTicketSheet();
  }

  function renderPreTicketSheet() {
    const listEl = document.getElementById('sheet-preticket-list');
    const titleEl = document.getElementById('sheet-preticket-title');
    const totalEl = document.getElementById('sheet-preticket-total');
    const total = state.preTicketItems.reduce((s, it) => s + Number(it.amount || 0), 0);

    if (titleEl) titleEl.textContent = `Pre-Ticket (${state.preTicketItems.length} jugadas)`;
    if (totalEl) totalEl.textContent = cloud.formatCurrency(total);
    if (!listEl) return;

    if (state.preTicketItems.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:32px; color:#9ca3af;">Sin jugadas en curso</div>';
      return;
    }

    listEl.innerHTML = state.preTicketItems.map((it, idx) => {
      let detail = esc(it.number);
      if (it.sign) detail += ` • ${esc(it.sign)}`;
      if (it.animalName) detail += ` • ${esc(it.animalName)}`;
      if (it.is5ta) detail += ' [5ta]';
      if (it.isCombinado) detail += ' [Comb]';
      return `
        <div style="background:var(--bg-input); border:1px solid var(--border-card); border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:10px;">
          <div style="flex:1;">
            <div style="font-size:11.5px; color:#9ca3af;">${esc(it.lotteryName)}</div>
            <div style="font-size:15px; font-weight:800;">${detail}</div>
          </div>
          <strong style="color:#4ade80; font-family:monospace;">${esc(cloud.formatCurrency(it.amount))}</strong>
          <button type="button" class="mini-btn btn-del-play" data-idx="${idx}" style="color:var(--danger);">✕</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-del-play').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.preTicketItems.splice(idx, 1);
        renderPreTicketBar();
      });
    });
  }

  async function submitPreTicket() {
    if (state.submitting || state.preTicketItems.length === 0) return;

    const now = new Date();
    const expired = new Set();
    const active = [];
    state.preTicketItems.forEach(p => {
      const lot = appFindLotteryById(p.lotteryId);
      if (lot && !appIsLotteryOpen(lot, now, state.showAllWeek)) {
        expired.add(p.lotteryName);
      } else {
        active.push(p);
      }
    });

    if (expired.size > 0) {
      state.preTicketItems = active;
      renderLotteries();
      renderPreTicketBar();
      showToast(`Retirados por cierre (-5 min): ${Array.from(expired).join(', ')}`);
      return;
    }

    state.submitting = true;
    renderPreTicketBar();
    const res = await cloud.emitTicket(state.preTicketItems);
    state.submitting = false;

    if (!res.ok) {
      renderPreTicketBar();
      showToast(res.error || 'Error al emitir ticket');
      return;
    }

    state.preTicketItems = [];
    document.getElementById('sheet-preticket')?.classList.add('hidden');
    renderPreTicketBar();
    renderHeader();
    openReceiptModal(res.ticket, false);
  }

  // Categorías & Loterías Listeners
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      state.selectedLotteries.clear();
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b === btn));
      renderLotteries();
      renderConditionalPanels();
    });
  });

  document.getElementById('app-lottery-search')?.addEventListener('input', renderLotteries);
  document.getElementById('btn-app-lot-all')?.addEventListener('click', () => {
    getOpenLotteries().forEach(l => state.selectedLotteries.add(l.id));
    renderLotteries();
    renderConditionalPanels();
  });
  document.getElementById('btn-app-lot-clear')?.addEventListener('click', () => {
    if (state.selectedLotteries.size > 0) {
      state.lastLotterySelection = Array.from(state.selectedLotteries);
    }
    state.selectedLotteries.clear();
    renderLotteries();
  });
  document.getElementById('btn-app-lot-repeat')?.addEventListener('click', () => {
    if (state.lastLotterySelection.length === 0) {
      showToast('Sin selección previa');
      return;
    }
    const openIds = new Set(getOpenLotteries().map(l => l.id));
    state.selectedLotteries.clear();
    state.lastLotterySelection.forEach(id => {
      if (openIds.has(id)) state.selectedLotteries.add(id);
    });
    renderLotteries();
  });

  document.getElementById('btn-toggle-5ta')?.addEventListener('click', (e) => {
    state.is5ta = !state.is5ta;
    e.currentTarget.classList.toggle('active', state.is5ta);
  });
  document.getElementById('btn-toggle-comb')?.addEventListener('click', (e) => {
    state.isCombinado = !state.isCombinado;
    e.currentTarget.classList.toggle('active', state.isCombinado);
  });
  document.getElementById('btn-toggle-week')?.addEventListener('click', (e) => {
    state.showAllWeek = !state.showAllWeek;
    e.currentTarget.classList.toggle('active', state.showAllWeek);
    renderLotteries();
  });

  document.getElementById('btn-app-all-signs')?.addEventListener('click', () => {
    const numEl = document.getElementById('app-input-num');
    const montoEl = document.getElementById('app-input-monto');
    const num = (numEl?.value || state.lastNumberPlayed || '').trim();
    const monto = Number(montoEl?.value || state.lastMontoPlayed || 1000);
    if (!num) return showToast('Ingrese un número para los 12 signos');
    if (state.selectedLotteries.size === 0) return showToast('Seleccione un sorteo con signo');
    APP_ZODIAC_SIGNS.forEach(s => addPlayItem(num, monto, s.code, true));
    if (numEl) numEl.value = '';
    renderPreTicketBar();
    showToast('12 signos agregados');
  });

  // Teclado Numérico Táctil + Inputs LCD
  const numInput = document.getElementById('app-input-num');
  const montoInput = document.getElementById('app-input-monto');

  document.getElementById('lcd-box-num')?.addEventListener('click', () => setEditingField(false));
  document.getElementById('lcd-box-monto')?.addEventListener('click', () => setEditingField(true));
  numInput?.addEventListener('focus', () => setEditingField(false));
  montoInput?.addEventListener('focus', () => setEditingField(true));
  numInput?.addEventListener('input', () => {
    updateAnimalPreview();
    if (state.category === 'animalitos') renderConditionalPanels();
  });

  numInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingField(true);
      montoInput?.focus();
      montoInput?.select();
    }
  });
  montoInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-app-add-play')?.click();
    }
  });

  document.querySelectorAll('.keypad-grid [data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const target = state.editingAmount ? montoInput : numInput;
      if (!target) return;
      if (key === 'CLEAR') {
        target.value = '';
      } else if (key === 'BACK') {
        target.value = target.value.slice(0, -1);
      } else {
        if (!state.editingAmount && target.value.length >= 4) return;
        target.value = (state.editingAmount && target.value === '0') ? key : `${target.value}${key}`;
      }
      updateAnimalPreview();
    });
  });

  document.getElementById('btn-switch-field')?.addEventListener('click', () => {
    setEditingField(!state.editingAmount);
  });

  document.getElementById('btn-app-add-play')?.addEventListener('click', () => {
    const ok = addPlayItem(numInput?.value, montoInput?.value);
    if (ok) {
      if (numInput) numInput.value = '';
      setEditingField(false);
      updateAnimalPreview();
      renderPreTicketBar();
    }
  });

  document.getElementById('btn-app-emit-quick')?.addEventListener('click', submitPreTicket);
  document.getElementById('btn-emit-bar')?.addEventListener('click', submitPreTicket);
  document.getElementById('btn-sheet-emit')?.addEventListener('click', submitPreTicket);

  document.getElementById('btn-open-preticket')?.addEventListener('click', () => {
    renderPreTicketSheet();
    document.getElementById('sheet-preticket')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-preticket')?.addEventListener('click', () => {
    document.getElementById('sheet-preticket')?.classList.add('hidden');
  });
  document.getElementById('btn-clear-preticket')?.addEventListener('click', () => {
    state.preTicketItems = [];
    renderPreTicketBar();
  });

  // Comandos Rápidos (P, S, R, T)
  document.getElementById('btn-cmd-permutas')?.addEventListener('click', () => {
    const numStr = (numInput?.value || state.lastNumberPlayed || '').trim();
    const monto = Number(montoInput?.value || state.lastMontoPlayed || 1000);
    if (numStr.length < 3) return showToast('Ingrese 3 o 4 cifras para permutar');
    if (state.selectedLotteries.size === 0) return showToast('Seleccione al menos un sorteo');

    const res = new Set();
    const perm = (arr, m = []) => {
      if (arr.length === 0) { res.add(m.join('')); return; }
      for (let i = 0; i < arr.length; i++) {
        const next = arr.slice();
        const picked = next.splice(i, 1);
        perm(next, m.concat(picked));
      }
    };
    perm(numStr.split(''));
    res.forEach(p => addPlayItem(p, monto, null, true));
    if (numInput) numInput.value = '';
    renderPreTicketBar();
    showToast(`${res.size} permutas agregadas`);
  });

  document.getElementById('btn-cmd-series')?.addEventListener('click', () => {
    const numStr = (numInput?.value || state.lastNumberPlayed || '').trim();
    const monto = Number(montoInput?.value || state.lastMontoPlayed || 1000);
    if (numStr.length !== 2 && numStr.length !== 3) return showToast('Ingrese 2 o 3 cifras para serie');
    if (state.selectedLotteries.size === 0) return showToast('Seleccione al menos un sorteo');
    const term = numStr.slice(-2);
    for (let i = 0; i <= 9; i++) addPlayItem(`${i}${term}`, monto, null, true);
    if (numInput) numInput.value = '';
    renderPreTicketBar();
    showToast(`Serie 0-9 generada (${term})`);
  });

  document.getElementById('btn-cmd-rep-term')?.addEventListener('click', () => {
    if (!state.lastNumberPlayed) return showToast('Sin jugada previa');
    if (numInput) numInput.value = state.lastNumberPlayed.slice(-2);
    setEditingField(true);
  });

  document.getElementById('btn-cmd-rep-ticket')?.addEventListener('click', () => {
    const last = cloud.getLastPrintedTicket();
    if (!last || !Array.isArray(last.items) || last.items.length === 0) {
      return showToast('Sin tickets previos para repetir');
    }
    const now = new Date();
    const valid = [];
    const closed = new Set();
    last.items.forEach(it => {
      const lot = appFindLotteryById(it.lotteryId);
      if (lot && !appIsLotteryOpen(lot, now, state.showAllWeek)) {
        closed.add(it.lotteryName);
      } else {
        valid.push({ ...it, uid: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
      }
    });
    if (valid.length === 0) return showToast('Los sorteos del último ticket ya cerraron');
    state.preTicketItems = valid;
    renderPreTicketBar();
    showToast(`Ticket #${last.ticketId} cargado (${valid.length} jugadas)`);
  });

  // Auto-cierre cada 10s
  setInterval(() => {
    if (cloud.session.agencyCode && state.activeTab === 'vender') {
      renderLotteries();
    }
  }, 10000);

  // ==================== RECIBO TÉRMICO & WHATSAPP ====================
  function openReceiptModal(ticket, isCopy = false) {
    state.currentReceiptTicket = ticket;
    const modal = document.getElementById('modal-app-receipt');
    const titleEl = document.getElementById('receipt-modal-title');
    const bodyEl = document.getElementById('receipt-paper-body');
    const printArea = document.getElementById('app-print-area');
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = isCopy ? `Copia Ticket #${ticket.ticketId}` : `Ticket Emitido #${ticket.ticketId}`;

    const cur = ticket.moneda || 'COP';
    const grouped = {};
    (ticket.items || []).forEach(it => {
      const k = it.lotteryName || it.lotteryId;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(it);
    });
    const maskedSerial = isCopy
      ? String(ticket.serialSeguridad || '').replace(/(\d{4})-(\d{4})-(\d{4})/, '$1-****-$3')
      : ticket.serialSeguridad;

    let playsHtml = '';
    for (const [lotName, plays] of Object.entries(grouped)) {
      playsHtml += `<div style="font-weight:bold; margin-top:8px;">*** ${esc(lotName.toUpperCase())} ***</div>`;
      plays.forEach(p => {
        let lbl = esc(p.number);
        if (p.sign) lbl += `-${esc(p.sign)}`;
        if (p.animalName) lbl += ` ${esc(p.animalName.toUpperCase())}`;
        if (p.is5ta) lbl += ' [5ta]';
        if (p.isCombinado) lbl += ' [Comb]';
        playsHtml += `<div style="display:flex; justify-content:space-between;"><span>${lbl}</span><strong>${esc(cloud.formatCurrency(p.amount, cur))}</strong></div>`;
      });
    }

    const html = `
      ${ticket.estado === 'ANULADO' ? '<div style="text-align:center; border:2px solid red; color:red; font-weight:900; padding:4px; margin-bottom:8px;">*** ANULADO ***</div>' : ''}
      <div style="text-align:center;">
        <div style="font-size:16px; font-weight:900;">BANCA FC</div>
        <div style="font-weight:900;">FERNANDO CASTAÑO</div>
        <div style="font-size:10.5px;">SEGURO TE PAGA (1000 SORTEOS)</div>
      </div>
      <hr style="border:none; border-top:1px dashed #666;" />
      <div><strong>AGENCIA:</strong> ${esc(ticket.agencia)}</div>
      <div><strong>FECHA:</strong> ${esc(ticket.fechaHora)}</div>
      <div><strong>TICKET:</strong> #${esc(ticket.ticketId)}</div>
      <div><strong>SERIAL:</strong> ${esc(maskedSerial)}</div>
      <div><strong>ESTADO:</strong> ${esc(ticket.estado)}</div>
      <hr style="border:none; border-top:1px dashed #666;" />
      ${playsHtml}
      <hr style="border:none; border-top:1px dashed #666;" />
      <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900;">
        <span>JUGADAS: ${(ticket.items || []).length}</span>
        <span>TOTAL: ${esc(cloud.formatCurrency(ticket.total, cur))}</span>
      </div>
      <hr style="border:none; border-top:1px dashed #666;" />
      <div style="text-align:center; font-size:10.5px;">Verifique su ticket. Caduca a los 3 días.<br/>¡BUENA SUERTE!</div>
    `;

    bodyEl.innerHTML = html;
    if (printArea) printArea.innerHTML = `<div style="padding:8px; font-family:monospace; font-size:11px;">${html}</div>`;
    modal.classList.remove('hidden');
  }

  document.getElementById('btn-close-receipt')?.addEventListener('click', () => {
    document.getElementById('modal-app-receipt')?.classList.add('hidden');
  });
  document.getElementById('btn-receipt-wa')?.addEventListener('click', () => {
    if (!state.currentReceiptTicket) return;
    const text = cloud.generatePlainTextReceipt(state.currentReceiptTicket);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  });
  document.getElementById('btn-receipt-print')?.addEventListener('click', () => window.print());
  document.getElementById('btn-receipt-copy')?.addEventListener('click', async () => {
    if (!state.currentReceiptTicket) return;
    const text = cloud.generatePlainTextReceipt(state.currentReceiptTicket);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Recibo copiado');
    } catch (_) {
      showToast('No se pudo copiar automáticamente');
    }
  });
  document.getElementById('btn-receipt-txt')?.addEventListener('click', () => {
    if (!state.currentReceiptTicket) return;
    const text = cloud.generatePlainTextReceipt(state.currentReceiptTicket);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Ticket_${state.currentReceiptTicket.ticketId}.txt`;
    a.click();
  });

  // ==================== PESTAÑA TICKETS ====================
  function renderTicketsTab() {
    const filtersEl = document.getElementById('app-tickets-filters');
    const listEl = document.getElementById('app-tickets-list');
    const q = (document.getElementById('app-tickets-search')?.value || '').trim().toLowerCase();

    if (filtersEl) {
      filtersEl.innerHTML = ['TODOS', 'ACTIVO', 'GANADOR', 'PAGADO', 'ANULADO'].map(st => `
        <button type="button" class="chip-btn ${state.ticketStatusFilter === st ? 'active' : ''}" data-st="${st}">${st}</button>
      `).join('');
      filtersEl.querySelectorAll('.chip-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.ticketStatusFilter = b.dataset.st;
          renderTicketsTab();
        });
      });
    }

    const tickets = cloud.getTickets(cloud.session.agencyCode).filter(t => {
      const est = (t.estado || 'ACTIVO').toUpperCase();
      if (state.ticketStatusFilter !== 'TODOS' && est !== state.ticketStatusFilter) return false;
      if (!q) return true;
      return String(t.ticketId || '').toLowerCase().includes(q) || String(t.serialSeguridad || '').toLowerCase().includes(q);
    });

    if (!listEl) return;
    if (tickets.length === 0) {
      listEl.innerHTML = '<div class="panel-card" style="text-align:center; color:#9ca3af;">Sin tickets con ese filtro.</div>';
      return;
    }

    listEl.innerHTML = tickets.map(t => {
      const est = (t.estado || 'ACTIVO').toUpperCase();
      const cur = t.moneda || 'COP';
      return `
        <div class="ticket-card">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <strong style="color:var(--gold); font-size:15px;">#${esc(t.ticketId)}</strong>
            <span class="status-pill status-${est.toLowerCase()}">${esc(est)}</span>
            <strong style="margin-left:auto; color:#4ade80; font-family:monospace;">${esc(cloud.formatCurrency(t.total, cur))}</strong>
          </div>
          <div style="font-size:12px; color:#d1d5db;">Serial: ${esc(t.serialSeguridad)} • ${(t.items || []).length} jugadas</div>
          <div style="font-size:11.5px; color:#9ca3af; margin-bottom:10px;">${esc(t.fechaHora)} • Caja ${esc(cur)}</div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="mini-btn btn-view-tkt" data-id="${esc(t.ticketId)}">🧾 Ver / WhatsApp</button>
            ${est !== 'ANULADO' && est !== 'PAGADO' ? `<button type="button" class="mini-btn btn-cancel-tkt" data-id="${esc(t.ticketId)}" style="color:var(--danger); border-color:var(--danger);">✕ Anular</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-view-tkt').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = cloud.getTicketByIdOrSerial(btn.dataset.id);
        if (t) openReceiptModal(t, true);
      });
    });
    listEl.querySelectorAll('.btn-cancel-tkt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm(`¿Confirma anular el Ticket #${id}?`)) return;
        const ok = await cloud.cancelTicket(id);
        showToast(ok ? `Ticket #${id} anulado en Firebase` : 'Error al anular');
        renderTicketsTab();
      });
    });
  }
  document.getElementById('app-tickets-search')?.addEventListener('input', renderTicketsTab);

  // ==================== PESTAÑA PREMIOS Y RESULTADOS ====================
  async function verifyWinnerTicket(queryOverride = null) {
    const inp = document.getElementById('app-verify-input');
    const resBox = document.getElementById('app-verify-result');
    const q = (queryOverride ?? inp?.value ?? '').trim();
    if (!q || !resBox) return;
    if (inp) inp.value = q;

    await cloud.pullAndMerge(false);
    const t = cloud.getTicketByIdOrSerial(q);
    if (!t) {
      resBox.innerHTML = `<div class="error-banner">Ticket #${esc(q)} no encontrado.</div>`;
      return;
    }

    const evalRes = cloud.evaluateTicket(t);
    const cur = t.moneda || 'COP';
    const canPay = evalRes.totalPrize > 0 && t.estado !== 'PAGADO' && t.estado !== 'ANULADO';

    resBox.innerHTML = `
      <div style="background:var(--bg-input); border:1px solid var(--emerald); border-radius:12px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>#${esc(t.ticketId)}</strong>
          <span class="status-pill status-${evalRes.status.toLowerCase()}">${esc(evalRes.status)}</span>
        </div>
        <div style="font-size:12px; color:#9ca3af;">Serial: ${esc(t.serialSeguridad)} • ${esc(t.fechaHora)}</div>
        <div style="margin:8px 0; font-size:17px; font-weight:900; color:#4ade80;">
          Premio (${esc(cur)}): ${esc(cloud.formatCurrency(evalRes.totalPrize, cur))}
        </div>
        ${evalRes.winningPlays.map(wp => `<div style="font-size:12px; color:#fde68a;">⭐ ${esc(wp.lotteryName)}: ${esc(wp.number)} (${wp.multiplier}x) → ${esc(cloud.formatCurrency(wp.prize, cur))}</div>`).join('')}
        ${canPay ? `<button type="button" id="btn-do-pay-winner" class="btn-primary-lg" style="margin-top:10px; padding:11px;">💵 PAGAR PREMIO AHORA</button>` : ''}
      </div>
    `;

    document.getElementById('btn-do-pay-winner')?.addEventListener('click', async () => {
      if (!confirm(`¿Pagar ${cloud.formatCurrency(evalRes.totalPrize, cur)} al ticket #${t.ticketId}?`)) return;
      const ok = await cloud.payTicket(t.ticketId, evalRes.totalPrize);
      showToast(ok ? `Ticket #${t.ticketId} pagado en Firebase` : 'Error al pagar');
      verifyWinnerTicket(t.ticketId);
    });
  }

  function renderWinnersAndResultsTab() {
    const winEl = document.getElementById('app-agency-winners-list');
    const winners = cloud.getTickets(cloud.session.agencyCode).filter(t => t.estado === 'GANADOR' || t.estado === 'PAGADO');
    if (winEl) {
      winEl.innerHTML = winners.length === 0
        ? '<div style="font-size:12.5px; color:#9ca3af;">Sin tickets ganadores aún para esta taquilla.</div>'
        : winners.map(w => {
            const cur = w.moneda || 'COP';
            const prize = Number(w.premioPagado || w.premioCalculado || 0);
            return `
              <div class="lot-card btn-pick-win" data-id="${esc(w.ticketId)}">
                <span>${w.estado === 'PAGADO' ? '✅' : '🏆'}</span>
                <span class="lot-card-name"><strong>#${esc(w.ticketId)}</strong> • ${esc(cloud.formatCurrency(prize, cur))}</span>
                <span class="status-pill status-${w.estado.toLowerCase()}">${esc(w.estado)}</span>
              </div>
            `;
          }).join('');
      winEl.querySelectorAll('.btn-pick-win').forEach(b => {
        b.addEventListener('click', () => verifyWinnerTicket(b.dataset.id));
      });
    }

    const dateInp = document.getElementById('app-results-date');
    if (dateInp && !dateInp.value) dateInp.value = cloud.getTodayIso();
    const dateKey = dateInp?.value || cloud.getTodayIso();
    const filterQ = (document.getElementById('app-results-filter')?.value || '').trim().toLowerCase();
    const dayRes = (cloud.masterData.results && cloud.masterData.results[dateKey]) || {};
    const resList = document.getElementById('app-results-list');
    if (!resList) return;

    const entries = Object.entries(dayRes).filter(([lotId]) => {
      if (!filterQ) return true;
      const lot = appFindLotteryById(lotId);
      return (lot?.name || lotId).toLowerCase().includes(filterQ);
    });

    resList.innerHTML = entries.length === 0
      ? '<div style="font-size:12.5px; color:#9ca3af;">No hay resultados publicados para esta fecha.</div>'
      : entries.map(([lotId, r]) => {
          const lot = appFindLotteryById(lotId);
          let val = esc(r.number || '');
          if (r.sign) val += ` • ${esc(r.sign)}`;
          if (r.animalName) val += ` (${esc(r.animalName)})`;
          if (r.ball5) val += ` [5ta: ${esc(r.ball5)}]`;
          return `
            <div style="background:var(--bg-input); border:1px solid var(--border-card); border-radius:10px; padding:9px 12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:13px;">${esc(lot?.name || lotId)}</div>
                <div style="font-size:11px; color:#9ca3af;">${esc(r.timestamp || '')} • ${esc(r.origen || 'OFICIAL')}</div>
              </div>
              <span style="background:var(--emerald-deep); color:#4ade80; padding:5px 10px; border-radius:8px; font-weight:900;">${val}</span>
            </div>
          `;
        }).join('');
  }

  document.getElementById('btn-app-verify')?.addEventListener('click', () => verifyWinnerTicket());
  document.getElementById('app-results-date')?.addEventListener('change', renderWinnersAndResultsTab);
  document.getElementById('app-results-filter')?.addEventListener('input', renderWinnersAndResultsTab);

  // ==================== PESTAÑA CUADRE DE CAJA ====================
  function renderCashierTab() {
    const dateInp = document.getElementById('app-caja-date');
    if (dateInp && !dateInp.value) dateInp.value = cloud.getTodayIso();
    const targetDate = dateInp?.value || cloud.getTodayIso();

    const curChips = document.getElementById('app-caja-currency-chips');
    if (curChips) {
      curChips.innerHTML = ['COP', 'VES', 'USD'].map(c => `
        <button type="button" class="chip-btn ${state.cashierCurrency === c ? 'active' : ''}" data-cur="${c}">${c}</button>
      `).join('');
      curChips.querySelectorAll('.chip-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.cashierCurrency = b.dataset.cur;
          renderCashierTab();
        });
      });
    }

    const dayTickets = cloud.getTickets(cloud.session.agencyCode).filter(t => cloud.extractTicketDateIso(t) === targetDate);
    const box = cloud.calculateCurrencyBoxMetrics(dayTickets, state.cashierCurrency);
    const cur = state.cashierCurrency;
    const content = document.getElementById('app-caja-content');
    if (!content) return;

    content.innerHTML = `
      <div class="cashier-hero ${box.bancaUtility < 0 ? 'negative' : ''}">
        <div style="font-size:11.5px; color:#d1d5db; font-weight:700;">SALDO NETO A ENTREGAR (${esc(cur)})</div>
        <div style="font-size:28px; font-weight:900; font-family:monospace; color:${box.bancaUtility >= 0 ? '#4ade80' : '#fca5a5'}; margin:4px 0;">
          ${esc(cloud.formatCurrency(box.bancaUtility, cur))}
        </div>
        <div style="font-size:12px; color:#d1d5db;">${box.activeCount} tickets activos • ${box.voidCount} anulados</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Ventas Brutas</div><strong style="font-size:15px;">${esc(cloud.formatCurrency(box.gross, cur))}</strong></div>
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Anulaciones</div><strong style="font-size:15px; color:var(--danger);">${esc(cloud.formatCurrency(box.voided, cur))}</strong></div>
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Ventas Netas</div><strong style="font-size:15px; color:var(--info);">${esc(cloud.formatCurrency(box.net, cur))}</strong></div>
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Comisión (${box.commissionPct}%)</div><strong style="font-size:15px; color:var(--gold);">${esc(cloud.formatCurrency(box.commission, cur))}</strong></div>
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Premios Pagados (${box.paidCount})</div><strong style="font-size:15px; color:#4ade80;">${esc(cloud.formatCurrency(box.paidPrizes, cur))}</strong></div>
        <div class="metric-box"><div style="font-size:11px; color:#9ca3af;">Pend. por Pagar (${box.winnerPendingCount})</div><strong style="font-size:15px; color:#fde047;">${esc(cloud.formatCurrency(box.pendingPrizes, cur))}</strong></div>
      </div>

      <div class="panel-card">
        <strong style="display:block; margin-bottom:8px;">Desglose por Categoría</strong>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Sin Signo (${box.categoryBreakdown.sin_signo.count})</span><strong>${esc(cloud.formatCurrency(box.categoryBreakdown.sin_signo.amount, cur))}</strong></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Con Signo (${box.categoryBreakdown.con_signo.count})</span><strong>${esc(cloud.formatCurrency(box.categoryBreakdown.con_signo.amount, cur))}</strong></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>4 Cifras (${box.categoryBreakdown.cuatro_cifras.count})</span><strong>${esc(cloud.formatCurrency(box.categoryBreakdown.cuatro_cifras.amount, cur))}</strong></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Animalitos (${box.categoryBreakdown.animalitos.count})</span><strong>${esc(cloud.formatCurrency(box.categoryBreakdown.animalitos.amount, cur))}</strong></div>
      </div>
    `;
  }
  document.getElementById('app-caja-date')?.addEventListener('change', renderCashierTab);

  // ==================== PESTAÑA NUBE Y CONFIGURACIÓN ====================
  function renderCloudTab() {
    updateCloudPills();
    const code = cloud.session.agencyCode || '1000';
    const ag = cloud.getAgencyByCode(code);
    const nameEl = document.getElementById('app-cfg-agency-name');
    const metaEl = document.getElementById('app-cfg-agency-meta');
    if (nameEl) nameEl.textContent = `Taquilla Activa: ${code} - ${ag?.name || 'FERNANDO CASTAÑO'}`;
    if (metaEl) metaEl.textContent = `Encargado: ${ag?.manager || 'Fernando Castaño'} • Comisión: ${cloud.getEffectiveCommissionForAgency(code)}%`;

    const curChips = document.getElementById('app-cfg-currency-chips');
    if (curChips) {
      const allowed = cloud.getAllowedCurrenciesForAgency(code);
      curChips.innerHTML = allowed.map(c => `
        <button type="button" class="chip-btn ${cloud.session.currency === c ? 'active' : ''}" data-cur="${c}">${c}</button>
      `).join('');
      curChips.querySelectorAll('.chip-btn').forEach(b => {
        b.addEventListener('click', () => {
          cloud.saveSession({ currency: b.dataset.cur });
          renderHeader();
          renderCloudTab();
        });
      });
    }

    const msgList = document.getElementById('app-messages-list');
    const msgs = cloud.masterData.messages || [];
    if (msgList) {
      msgList.innerHTML = msgs.length === 0
        ? '<div style="font-size:12px; color:#9ca3af;">Sin mensajes de la Central.</div>'
        : msgs.slice(0, 10).map(m => `
            <div style="background:var(--bg-input); border-radius:10px; padding:10px;">
              <div style="font-weight:800; color:var(--gold); font-size:13px;">${esc(m.subject)}</div>
              <div style="font-size:12.5px; margin:4px 0;">${esc(m.body)}</div>
              <div style="font-size:10.5px; color:#9ca3af;">${esc(m.from)} • ${esc(m.date)}</div>
            </div>
          `).join('');
    }
  }

  document.getElementById('btn-save-firebase-url')?.addEventListener('click', async () => {
    const val = document.getElementById('app-firebase-url')?.value || '';
    const res = await cloud.saveFirebaseUrl(val);
    showToast(res.ok ? 'Firebase conectado en vivo' : (res.error || 'Error conectando'));
  });
  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    const ok = await cloud.pullAndMerge(true);
    showToast(ok ? 'Sincronizado con Firebase' : (cloud.lastError || 'No se pudo sincronizar'));
  });
  document.getElementById('btn-app-logout')?.addEventListener('click', () => {
    cloud.logout();
    syncShellVisibility();
  });

  // Suscripción en vivo a cambios de la nube
  cloud.onChange(() => {
    updateCloudPills();
    if (cloud.session.agencyCode) {
      renderHeader();
      if (state.activeTab === 'tickets') renderTicketsTab();
      if (state.activeTab === 'premios') renderWinnersAndResultsTab();
      if (state.activeTab === 'caja') renderCashierTab();
      if (state.activeTab === 'nube') renderCloudTab();
    } else {
      renderQuickAgencies();
    }
  });

  // ==================== SIMULADOR DE DISPOSITIVO ANDROID EN PC ====================
  const isNativeAndroidWebView = /Android/i.test(navigator.userAgent || '');
  if (isNativeAndroidWebView) {
    document.body.classList.remove('sim-mode-phone', 'sim-mode-tablet');
    document.getElementById('device-simulator-toolbar')?.classList.add('hidden');
  }

  document.querySelectorAll('.sim-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.sim;
      document.body.classList.remove('sim-mode-phone', 'sim-mode-tablet');
      if (mode === 'phone') document.body.classList.add('sim-mode-phone');
      if (mode === 'tablet') document.body.classList.add('sim-mode-tablet');
      document.querySelectorAll('.sim-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  function updateAndroidStatusBarClock() {
    const el = document.getElementById('android-status-clock');
    if (!el) return;
    const now = new Date();
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${hr}:${min}`;
  }
  updateAndroidStatusBarClock();
  setInterval(updateAndroidStatusBarClock, 5000);

  document.getElementById('btn-android-back')?.addEventListener('click', () => {
    const receiptModal = document.getElementById('modal-app-receipt');
    const preSheet = document.getElementById('sheet-preticket');
    if (receiptModal && !receiptModal.classList.contains('hidden')) {
      receiptModal.classList.add('hidden');
      return;
    }
    if (preSheet && !preSheet.classList.contains('hidden')) {
      preSheet.classList.add('hidden');
      return;
    }
    if (state.activeTab !== 'vender') {
      switchTab('vender');
    }
  });

  document.getElementById('btn-android-home')?.addEventListener('click', () => {
    document.getElementById('modal-app-receipt')?.classList.add('hidden');
    document.getElementById('sheet-preticket')?.classList.add('hidden');
    if (cloud.session.agencyCode) switchTab('vender');
  });

  document.getElementById('btn-android-recent')?.addEventListener('click', () => {
    if (!cloud.session.agencyCode) return;
    renderPreTicketSheet();
    document.getElementById('sheet-preticket')?.classList.toggle('hidden');
  });

  syncShellVisibility();
});
