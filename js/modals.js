// js/modals.js - Controladores de Modales, Reportes, Premiación y Configuración
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

class ModalManager {
  constructor(storageMgr, printerMgr, posEngineMgr) {
    this.storage = storageMgr || storage;
    this.printer = printerMgr || printer;
    this.pos = posEngineMgr;
    this.calcMemory = 0;
    this.calcCurrent = '0';
    this.calcPendingOp = null;
    this.calcNewInput = true;
  }

  setPos(engine) {
    this.pos = engine;
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('hidden');
      const firstInput = el.querySelector('input:not([disabled]), button.btn-primary');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('hidden');
    }
    if (this.pos) {
      this.pos.focusNumberInput();
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    if (this.pos) {
      this.pos.focusNumberInput();
    }
  }

  // 1. MODAL ANULAR TICKET (F3)
  setupAnularTicketModal() {
    const searchBtn = document.getElementById('btn-buscar-anular');
    const inputSearch = document.getElementById('input-anular-search');
    const detailsContainer = document.getElementById('anular-ticket-details');
    const confirmBtn = document.getElementById('btn-confirmar-anular');

    const handleSearch = () => {
      const q = inputSearch.value.trim();
      if (!q) {
        alert('Ingrese el número de ticket o serial');
        return;
      }
      const ticket = this.storage.getTicketById(q) || this.storage.getTicketBySerial(q);
      if (!ticket) {
        detailsContainer.innerHTML = `<div class="alert alert-error">Ticket #${q} no encontrado. Verifique el número.</div>`;
        confirmBtn.disabled = true;
        return;
      }

      confirmBtn.disabled = ticket.estado === 'ANULADO';
      confirmBtn.dataset.ticketId = ticket.ticketId;

      const cfg = this.storage.getConfig();
      let playsList = '';
      ticket.items.forEach(p => {
        playsList += `<li><strong>${p.lotteryName}</strong>: ${p.number} ${p.sign || ''} ${p.animalName || ''} - ${this.printer.formatCurrency(p.amount, ticket.moneda)}</li>`;
      });

      detailsContainer.innerHTML = `
        <div class="ticket-info-card">
          <div class="info-row"><span>Ticket Nro:</span> <strong>#${ticket.ticketId}</strong></div>
          <div class="info-row"><span>Serial:</span> <strong>${ticket.serialSeguridad}</strong></div>
          <div class="info-row"><span>Fecha:</span> <strong>${ticket.fechaHora}</strong></div>
          <div class="info-row"><span>Total:</span> <strong>${this.printer.formatCurrency(ticket.total, ticket.moneda)}</strong></div>
          <div class="info-row"><span>Estado Actual:</span> <span class="ticket-badge-status status-${ticket.estado.toLowerCase()}">${ticket.estado}</span></div>
          <div class="plays-preview-list">
            <h4>Jugadas contenidas:</h4>
            <ul>${playsList}</ul>
          </div>
        </div>
      `;
    };

    if (searchBtn) searchBtn.addEventListener('click', handleSearch);
    if (inputSearch) {
      inputSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const ticketId = confirmBtn.dataset.ticketId;
        if (!ticketId) return;

        if (confirm(`¿Confirma la anulación del Ticket #${ticketId}? Esta acción es irreversible.`)) {
          const updated = this.storage.updateTicketStatus(ticketId, 'ANULADO', { fechaAnulacion: new Date().toLocaleString() });
          if (updated) {
            alert(`Ticket #${ticketId} ha sido ANULADO exitosamente.`);
            handleSearch();
            this.pos.playBeep('success');
          }
        }
      });
    }
  }

  // 2. MODAL REIMPRIMIR TICKET
  setupReimprimirModal() {
    const listContainer = document.getElementById('reimprimir-tickets-list');
    const inputSearch = document.getElementById('input-reimprimir-search');
    const btnLast = document.getElementById('btn-reimprimir-ultimo');

    const renderList = (filter = '') => {
      if (!listContainer) return;
      const tickets = this.storage.getTickets();
      const q = filter.trim().toLowerCase();
      const filtered = tickets.filter(t => 
        t.ticketId.includes(q) || t.serialSeguridad.toLowerCase().includes(q)
      ).slice(0, 15);

      if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-list-notice">No se encontraron tickets</div>';
        return;
      }

      let html = '';
      filtered.forEach(t => {
        html += `
          <div class="reprint-ticket-row">
            <div class="reprint-col-main">
              <strong>#${t.ticketId}</strong> - ${t.fechaHora}
              <div class="text-sm text-muted">Serial: ${t.serialSeguridad} | ${t.items.length} jugadas | <span class="status-${t.estado.toLowerCase()}">${t.estado}</span></div>
            </div>
            <div class="reprint-col-actions">
              <span class="reprint-monto">${this.printer.formatCurrency(t.total, t.moneda)}</span>
              <button type="button" class="btn btn-sm btn-primary btn-do-reprint" data-id="${t.ticketId}">Reimprimir</button>
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;

      listContainer.querySelectorAll('.btn-do-reprint').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          const ticket = this.storage.getTicketById(id);
          if (ticket) {
            this.printer.previewAndPrint(ticket, false);
          }
        });
      });
    };

    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => renderList(e.target.value));
    }

    if (btnLast) {
      btnLast.addEventListener('click', () => {
        const lastTicket = this.storage.getLastPrintedTicket();
        if (lastTicket) {
          this.printer.previewAndPrint(lastTicket, false);
        } else {
          alert('No hay tickets previos registrados para reimprimir');
        }
      });
    }

    // Exponer hook para abrir
    this.renderReimprimirList = renderList;
  }

  // 3. MODAL NÚMEROS PREMIADOS (MODO SOLO CONSULTA ANTIFRAUDE - SINCRONIZACIÓN AUTOMÁTICA)
  setupResultadosModal() {
    const dateInput = document.getElementById('input-resultados-fecha');
    const catSelect = document.getElementById('select-resultados-loteria');
    const filterInput = document.getElementById('input-resultados-filtro');
    const searchBtn = document.getElementById('btn-buscar-resultados');
    const statusLabel = document.getElementById('auto-results-sync-status');
    const tableBody = document.getElementById('tabla-resultados-guardados');

    // Inicializar fecha de hoy
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (dateInput) dateInput.value = todayStr;

    const getCategoryBadgeStyle = (catKey) => {
      if (catKey === 'sin_signo') return 'background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;';
      if (catKey === 'con_signo') return 'background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe;';
      if (catKey === 'cuatro_cifras') return 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;';
      return 'background: #dcfce7; color: #166534; border: 1px solid #86efac;';
    };

    const renderResultsTable = async (triggerLiveSync = false) => {
      if (!tableBody || !dateInput) return;
      const dateKey = dateInput.value || todayStr;
      const catFilter = catSelect ? catSelect.value : 'ALL';
      const searchQ = filterInput ? filterInput.value.trim() : '';

      if (triggerLiveSync && window.bancaFcAutoResults) {
        if (statusLabel) {
          statusLabel.textContent = '⏳ Sincronizando resultados oficiales desde la Web y Firebase...';
          statusLabel.style.color = '#0369a1';
        }
        await window.bancaFcAutoResults.syncOfficialResultsForDate(dateKey, { silent: false });
      }

      const items = window.bancaFcAutoResults
        ? window.bancaFcAutoResults.getFilteredOfficialResults(dateKey, catFilter, searchQ)
        : [];

      if (statusLabel) {
        const syncHour = (window.bancaFcAutoResults && window.bancaFcAutoResults.lastSyncTime) || 'En vivo';
        statusLabel.textContent = `✔ Sincronización Automática (${syncHour}) • ${items.length} sorteos oficiales`;
        statusLabel.style.color = '#15803d';
      }

      if (items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3">No hay resultados oficiales publicados para los filtros o la hora actual.</td></tr>';
        return;
      }

      let rows = '';
      items.forEach(item => {
        let detail = `<strong>${item.number}</strong>`;
        if (item.sign) detail += ` - <strong>${item.sign}</strong>`;
        if (item.animalName) detail += ` - <strong>${item.animalName}</strong>`;
        if (item.ball5) detail += ` <span style="font-size: 11px; color: #92400e;">[La 5ta: <strong>${item.ball5}</strong>]</span>`;

        rows += `
          <tr>
            <td>
              <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; ${getCategoryBadgeStyle(item.categoryKey)}">
                ${item.categoryLabel}
              </span>
            </td>
            <td><strong>${item.lotteryName}</strong></td>
            <td><span class="badge-result-num" style="font-size: 13px;">${detail}</span></td>
            <td>
              <span style="font-weight: bold; color: #374151;">${item.drawTime12h}</span>
              <span style="display: inline-block; margin-left: 6px; padding: 1px 6px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; border-radius: 3px; font-size: 10px; font-weight: bold;">
                ✔ OFICIAL VERIFICADO
              </span>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = rows;
    };

    if (dateInput) dateInput.addEventListener('change', () => renderResultsTable(true));
    if (catSelect) catSelect.addEventListener('change', () => renderResultsTable(false));
    if (filterInput) {
      filterInput.addEventListener('input', () => renderResultsTable(false));
      filterInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          renderResultsTable(true);
        }
      });
    }
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        renderResultsTable(true);
        if (this.pos) this.pos.playBeep('blip');
      });
    }

    // Actualizar automáticamente la tabla si llega un nuevo ciclo de 3 minutos mientras la ventana está abierta
    window.addEventListener('banca_fc_official_results_synced', () => {
      const modalEl = document.getElementById('modal-numeros-premiados');
      if (modalEl && !modalEl.classList.contains('hidden')) {
        renderResultsTable(false);
      }
    });

    this.renderResultadosTable = () => renderResultsTable(true);
  }

  // 4. MODAL VERIFICAR Y PAGAR TICKETS GANADORES
  setupVerificarPagoModal() {
    const inputSearch = document.getElementById('input-verificar-ticket');
    const btnSearch = document.getElementById('btn-verificar-ticket');
    const resContainer = document.getElementById('verificar-ticket-result');
    const btnPagar = document.getElementById('btn-pagar-ticket-ganador');

    const doVerify = async () => {
      const q = inputSearch.value.trim();
      if (!q) {
        alert('Ingrese el número o serial del ticket');
        return;
      }
      if (window.bancaFcAutoResults) {
        await window.bancaFcAutoResults.syncOfficialResultsForDate(undefined, { silent: true });
      }
      const ticket = this.storage.getTicketById(q) || this.storage.getTicketBySerial(q);
      if (!ticket) {
        resContainer.innerHTML = `<div class="alert alert-error">Ticket #${q} no encontrado.</div>`;
        btnPagar.disabled = true;
        return;
      }

      // Evaluar si es ganador contra los resultados
      const evalRes = this.storage.evaluateTicket(ticket);
      const isWinner = evalRes.totalPrize > 0;
      const isPaid = ticket.estado === 'PAGADO';
      const isAnulado = ticket.estado === 'ANULADO';

      btnPagar.disabled = !isWinner || isPaid || isAnulado;
      btnPagar.dataset.ticketId = ticket.ticketId;
      btnPagar.dataset.prize = evalRes.totalPrize;

      let winningRows = '';
      if (evalRes.winningPlays && evalRes.winningPlays.length > 0) {
        evalRes.winningPlays.forEach(wp => {
          winningRows += `
            <div class="winning-play-card">
              <span class="wp-title">⭐ ${wp.winType}</span>
              <div class="wp-details">
                <strong>${wp.lotteryName}</strong>: Jugado <strong>${wp.number}</strong> (Oficial: ${wp.resultNumber})
              </div>
              <div class="wp-prize">
                Premio (${wp.multiplier}x): <strong>${this.printer.formatCurrency(wp.prize, ticket.moneda)}</strong>
              </div>
            </div>
          `;
        });
      }

      resContainer.innerHTML = `
        <div class="verification-summary-card">
          <div class="card-status-banner banner-${evalRes.status.toLowerCase()}">
            ESTADO: ${evalRes.status.toUpperCase()}
          </div>
          <div class="info-row"><span>Ticket:</span> <strong>#${ticket.ticketId}</strong></div>
          <div class="info-row"><span>Serial:</span> <strong>${ticket.serialSeguridad}</strong></div>
          <div class="info-row"><span>Fecha:</span> <strong>${ticket.fechaHora}</strong></div>
          <div class="info-row"><span>Apostado:</span> <strong>${this.printer.formatCurrency(ticket.total, ticket.moneda)}</strong></div>
          <div class="info-row highlight-prize">
            <span>PREMIO TOTAL A PAGAR:</span>
            <strong class="text-xl text-success">${this.printer.formatCurrency(evalRes.totalPrize, ticket.moneda)}</strong>
          </div>
          ${winningRows ? `<div class="winning-plays-container"><h4>Aciertos Registrados:</h4>${winningRows}</div>` : ''}
          ${!isWinner && !isAnulado ? '<div class="alert alert-info">Este ticket no tiene aciertos registrados en los sorteos evaluados.</div>' : ''}
          ${isPaid ? `<div class="alert alert-success">Ticket PAGADO el ${ticket.fechaPago || 'previamente'}.</div>` : ''}
        </div>
      `;
    };

    if (btnSearch) btnSearch.addEventListener('click', doVerify);
    if (inputSearch) {
      inputSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doVerify();
      });
    }

    if (btnPagar) {
      btnPagar.addEventListener('click', () => {
        const tId = btnPagar.dataset.ticketId;
        const prize = Number(btnPagar.dataset.prize);
        if (!tId) return;

        if (confirm(`¿Confirma el pago del premio por ${this.printer.formatCurrency(prize, 'COP')} al cliente?`)) {
          const updated = this.storage.updateTicketStatus(tId, 'PAGADO', {
            fechaPago: new Date().toLocaleString(),
            premioPagado: prize
          });
          if (updated) {
            alert(`¡PREMIO PAGADO EXITOSAMENTE PARA EL TICKET #${tId}!`);
            this.pos.playBeep('success');
            doVerify();
          }
        }
      });
    }
  }

  // Sincroniza los selectores de moneda de la taquilla (Configuración, Cuadre y Cabecera)
  // exclusivamente con las monedas autorizadas por el Programa Administrativo para esta agencia
  populateAllowedCurrencySelect(selectEl, allowedCurrencies, currentCurrency) {
    if (!selectEl) return;
    const labels = {
      COP: 'COP ($ Pesos Colombianos)',
      USD: 'USD ($ Dólares)',
      VES: 'VES (Bs. Bolívares)'
    };
    const allowed = Array.isArray(allowedCurrencies) && allowedCurrencies.length > 0
      ? allowedCurrencies
      : ['COP'];
    selectEl.innerHTML = '';
    allowed.forEach(cur => {
      const opt = document.createElement('option');
      opt.value = cur;
      opt.textContent = labels[cur] || cur;
      selectEl.appendChild(opt);
    });
    selectEl.value = allowed.includes(currentCurrency) ? currentCurrency : allowed[0];
    selectEl.disabled = allowed.length <= 1;
  }

  // 5. MODAL RELACIÓN FINAL (CUADRE DE CAJA)
  setupCuadreCajaModal() {
    const dateInput = document.getElementById('input-cuadre-fecha');
    const curSelect = document.getElementById('select-cuadre-moneda');
    const btnFiltrar = document.getElementById('btn-filtrar-cuadre');
    const btnPrintCuadre = document.getElementById('btn-imprimir-cuadre');
    const btnExportCsv = document.getElementById('btn-exportar-cuadre-csv');

    const today = new Date();
    const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    if (dateInput) dateInput.value = todayFormatted;

    const calculateAndRenderCuadre = () => {
      const cfg = this.storage.getConfig();
      const allowedCurrencies = cfg.allowedCurrencies || ['COP'];

      // Asegurar que el selector del cuadre solo muestre las monedas autorizadas a esta agencia
      const selectedBefore = curSelect?.value || cfg.currency || 'COP';
      this.populateAllowedCurrencySelect(curSelect, allowedCurrencies, selectedBefore);

      const targetDate = dateInput?.value || todayFormatted;
      const targetCurrency = curSelect?.value || allowedCurrencies[0];
      const tickets = this.storage.getTickets();
      const activeAgencyCode = String(cfg.agencyCode || '1000').trim();

      // Filtrar por agencia activa, fecha y moneda autorizada
      const dayTickets = tickets.filter(t => {
        const tAgency = String(this.storage.extractAgencyCodeFromTicket(t)).trim();
        const tDate = (t.fechaHora || '').split(' ')[0];
        const matchAgency = tAgency === activeAgencyCode;
        const matchDate = tDate === targetDate;
        const matchCur = (t.moneda || 'COP') === targetCurrency;
        return matchAgency && matchDate && matchCur;
      });

      let ventasBrutas = 0;
      let anuladosTotal = 0;
      let premiosPagados = 0;
      let ticketsEmitidos = dayTickets.length;
      let ticketsAnuladosCount = 0;
      let ticketsPagadosCount = 0;

      dayTickets.forEach(t => {
        if (t.estado === 'ANULADO') {
          anuladosTotal += t.total;
          ticketsAnuladosCount++;
        } else {
          ventasBrutas += t.total;
          if (t.estado === 'PAGADO') {
            premiosPagados += (t.premioPagado || t.premioCalculado || 0);
            ticketsPagadosCount++;
          }
        }
      });

      const ventasNetas = ventasBrutas; // Las ventas brutas ya excluyen los anulados en el loop
      const comisionPct = Number(cfg.agencyCommissionPct ?? 15);
      const comisionMonto = (ventasNetas * comisionPct) / 100;
      const balanceBanca = ventasNetas - premiosPagados - comisionMonto;

      // Actualizar DOM
      document.getElementById('cuadre-val-tickets')?.replaceChildren(document.createTextNode(String(ticketsEmitidos)));
      document.getElementById('cuadre-val-brutas')?.replaceChildren(document.createTextNode(this.printer.formatCurrency(ventasBrutas + anuladosTotal, targetCurrency)));
      document.getElementById('cuadre-val-anulados')?.replaceChildren(document.createTextNode(this.printer.formatCurrency(anuladosTotal, targetCurrency)));
      document.getElementById('cuadre-val-netas')?.replaceChildren(document.createTextNode(this.printer.formatCurrency(ventasNetas, targetCurrency)));
      document.getElementById('cuadre-val-premios')?.replaceChildren(document.createTextNode(this.printer.formatCurrency(premiosPagados, targetCurrency)));
      document.getElementById('cuadre-val-comision')?.replaceChildren(document.createTextNode(`${this.printer.formatCurrency(comisionMonto, targetCurrency)} (${comisionPct}%)`));
      
      const balanceEl = document.getElementById('cuadre-val-balance');
      if (balanceEl) {
        balanceEl.textContent = this.printer.formatCurrency(balanceBanca, targetCurrency);
        balanceEl.className = balanceBanca >= 0 ? 'text-xl text-success font-bold' : 'text-xl text-danger font-bold';
      }

      this.currentCuadreData = {
        date: targetDate,
        currency: targetCurrency,
        ticketsEmitidos,
        ventasBrutas: ventasBrutas + anuladosTotal,
        anuladosTotal,
        ventasNetas,
        premiosPagados,
        comisionPct,
        comisionMonto,
        balanceBanca
      };
    };

    if (btnFiltrar) btnFiltrar.addEventListener('click', calculateAndRenderCuadre);

    if (btnPrintCuadre) {
      btnPrintCuadre.addEventListener('click', () => {
        const d = this.currentCuadreData;
        if (!d) return;
        const cfg = this.storage.getConfig();
        const text = `
--------------------------------
RELACIÓN FINAL - CUADRE DE CAJA
BANCA FC - FERNANDO CASTAÑO
AGENCIA: ${cfg.agencyCode || '1000'} - ${cfg.agencyName || 'FERNANDO CASTAÑO'}
FECHA: ${d.date} | MONEDA: ${d.currency}
--------------------------------
TICKETS EMITIDOS: ${d.ticketsEmitidos}
VENTAS BRUTAS:    ${this.printer.formatCurrency(d.ventasBrutas, d.currency)}
ANULACIONES:     -${this.printer.formatCurrency(d.anuladosTotal, d.currency)}
--------------------------------
VENTAS NETAS:     ${this.printer.formatCurrency(d.ventasNetas, d.currency)}
PREMIOS PAGADOS: -${this.printer.formatCurrency(d.premiosPagados, d.currency)}
COMISIÓN (${d.comisionPct}%):  -${this.printer.formatCurrency(d.comisionMonto, d.currency)}
--------------------------------
SALDO A LA BANCA: ${this.printer.formatCurrency(d.balanceBanca, d.currency)}
--------------------------------
Firma Taquillero: ______________
        `;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (w) w.print();
      });
    }

    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        const d = this.currentCuadreData;
        if (!d) return;
        const csvContent = "data:text/csv;charset=utf-8," +
          "Concepto,Monto,Moneda\n" +
          `Fecha,${d.date},${d.currency}\n` +
          `Tickets Emitidos,${d.ticketsEmitidos},\n` +
          `Ventas Brutas,${d.ventasBrutas},${d.currency}\n` +
          `Anulaciones,${d.anuladosTotal},${d.currency}\n` +
          `Ventas Netas,${d.ventasNetas},${d.currency}\n` +
          `Premios Pagados,${d.premiosPagados},${d.currency}\n` +
          `Comision Agencia,${d.comisionMonto},${d.currency}\n` +
          `Saldo Entregar Banca,${d.balanceBanca},${d.currency}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Cuadre_Caja_${d.date.replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    this.calculateAndRenderCuadre = calculateAndRenderCuadre;
  }

  // 6. MODAL REPORTE POR NÚMEROS (RIESGO / TOPES)
  setupReporteNumerosModal() {
    const listBody = document.getElementById('tabla-reporte-numeros');
    const renderNums = () => {
      if (!listBody) return;
      const tickets = this.storage.getTickets().filter(t => t.estado !== 'ANULADO');
      const numMap = {};
      const cfg = this.storage.getConfig();

      tickets.forEach(t => {
        t.items.forEach(p => {
          const key = `${p.number}${p.sign ? '-' + p.sign : ''}${p.animalName ? ' (' + p.animalName + ')' : ''}`;
          if (!numMap[key]) {
            numMap[key] = { number: key, type: p.type, totalAmount: 0, count: 0 };
          }
          numMap[key].totalAmount += p.amount;
          numMap[key].count++;
        });
      });

      const sorted = Object.values(numMap).sort((a, b) => b.totalAmount - a.totalAmount);
      if (sorted.length === 0) {
        listBody.innerHTML = '<tr><td colspan="4" class="text-center p-3">No hay ventas activas registradas.</td></tr>';
        return;
      }

      let rows = '';
      sorted.forEach(item => {
        rows += `
          <tr>
            <td><strong>${item.number}</strong></td>
            <td><span class="badge badge-secondary">${item.type.toUpperCase()}</span></td>
            <td>${item.count} apuestas</td>
            <td><strong>${this.printer.formatCurrency(item.totalAmount, cfg.currency)}</strong></td>
          </tr>
        `;
      });
      listBody.innerHTML = rows;
    };
    this.renderReporteNumeros = renderNums;
  }

  // 7A. MODAL DATOS DE LA AGENCIA (BLINDADO ANTIFRAUDE - CONTROLADO POR ADMIN CENTRAL)
  setupConfigModal() {
    const form = document.getElementById('form-parametros');
    if (!form) return;

    const loadFormValues = () => {
      const cfg = this.storage.getConfig();
      const allowedCurrencies = cfg.allowedCurrencies || ['COP'];

      const codeEl = document.getElementById('cfg-agency-code');
      const nameEl = document.getElementById('cfg-agency-name');
      const userEl = document.getElementById('cfg-user-id');
      const curSelect = document.getElementById('cfg-currency');
      const summaryBox = document.getElementById('cfg-readonly-summary');

      if (codeEl) codeEl.value = cfg.agencyCode || '1000';
      if (nameEl) nameEl.value = cfg.agencyName || 'FERNANDO CASTAÑO';
      if (userEl) userEl.value = cfg.terminalId || '1000';

      this.populateAllowedCurrencySelect(curSelect, allowedCurrencies, cfg.currency || allowedCurrencies[0]);

      if (summaryBox) {
        const m = cfg.multipliers || {};
        summaryBox.innerHTML = `
          <div>• <strong>Monedas Autorizadas en esta Taquilla:</strong> ${allowedCurrencies.join(' / ')}</div>
          <div>• <strong>Porcentaje de Ganancia / Comisión Asignada:</strong> ${cfg.agencyCommissionPct ?? 15}%</div>
          <div>• <strong>Multiplicadores Oficiales de Pago:</strong> Triple <strong>${m.triple || 500}x</strong> | Terminal <strong>${m.terminal || 60}x</strong> | Aprox. <strong>${m.aproximacion || 5}x</strong> | Animalitos/Frutas <strong>${m.animalito || 30}x</strong> | 4 Cifras <strong>${m.cuatroCifrasDirecto || 4500}x</strong> | La 5ta <strong>${m.la5ta || 25000}x</strong> | Astro <strong>${m.astro4 || 40000}x</strong></div>
        `;
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = this.storage.getConfig();
      const allowedCurrencies = cfg.allowedCurrencies || ['COP'];
      const requestedCur = document.getElementById('cfg-currency')?.value || allowedCurrencies[0];
      const validCurrency = allowedCurrencies.includes(requestedCur) ? requestedCur : allowedCurrencies[0];

      this.storage.updateConfig({
        currency: validCurrency
      });

      this.closeModal('modal-configuracion');

      const headerCur = document.getElementById('header-active-currency');
      if (headerCur) {
        headerCur.textContent = validCurrency;
      }

      if (this.pos) {
        this.pos.renderPreTicket();
      }
    });

    this.loadConfigValues = loadFormValues;
  }

  // 7B. MODAL PARÁMETROS DEL SISTEMA - CONFIGURACIÓN DE IMPRESORA DEL EQUIPO
  setupPrinterParamsModal() {
    const form = document.getElementById('form-parametros-impresora');
    const selectEl = document.getElementById('printer-device-select');
    const customInput = document.getElementById('printer-custom-name');
    const addBtn = document.getElementById('btn-add-custom-printer');
    const detectUsbBtn = document.getElementById('btn-detect-usb-printer');
    const paperSelect = document.getElementById('cfg-paper-width');
    const modeSelect = document.getElementById('cfg-print-mode');
    const autoPrintChk = document.getElementById('cfg-auto-print-dialog');
    const testBtn = document.getElementById('btn-test-printer');

    if (!form) return;

    const renderPrintersSelect = (printersList, selectedName) => {
      if (!selectEl) return;
      const defaultPrinters = [
        'Generic / Text Only',
        'BASIC 230',
        'POS-58',
        'POS-80',
        'XP-58',
        'XP-80C',
        'EPSON TM-T20II',
        'BIXOLON SRP-350',
        'Microsoft Print to PDF'
      ];
      const merged = Array.from(new Set([...(printersList || []), ...defaultPrinters]));
      if (selectedName && !merged.includes(selectedName)) {
        merged.unshift(selectedName);
      }

      selectEl.innerHTML = merged
        .map(name => `<option value="${name}">${name}</option>`)
        .join('');
      selectEl.value = selectedName || 'Generic / Text Only';
    };

    const loadPrinterValues = () => {
      const cfg = this.storage.getConfig();
      renderPrintersSelect(cfg.installedPrinters, cfg.printerName || 'Generic / Text Only');
      if (paperSelect) paperSelect.value = cfg.paperWidth || '58mm';
      if (modeSelect) modeSelect.value = cfg.printMode || 'TEXT_ONLY';
      if (autoPrintChk) autoPrintChk.checked = cfg.autoPrintDialog !== false;
      if (customInput) customInput.value = '';
    };

    // Si el usuario selecciona Generic / Text Only o BASIC 230, ajustar automáticamente a TEXT_ONLY
    selectEl?.addEventListener('change', () => {
      const val = (selectEl.value || '').toUpperCase();
      if (val.includes('GENERIC') || val.includes('TEXT ONLY') || val.includes('BASIC 230')) {
        if (modeSelect) modeSelect.value = 'TEXT_ONLY';
      }
    });

    // Agregar nombre exacto de impresora del Panel de Control de Windows
    addBtn?.addEventListener('click', () => {
      const customName = (customInput?.value || '').trim();
      if (!customName) {
        alert('Escriba el nombre exacto de la impresora tal como aparece en su Panel de Control de Windows (Ej: Generic / Text Only o BASIC 230).');
        customInput?.focus();
        return;
      }
      const cfg = this.storage.getConfig();
      const updatedList = Array.from(new Set([customName, ...(cfg.installedPrinters || [])]));
      const isTextDriver = customName.toUpperCase().includes('GENERIC') || customName.toUpperCase().includes('TEXT ONLY') || customName.toUpperCase().includes('BASIC');
      const nextMode = isTextDriver ? 'TEXT_ONLY' : (modeSelect?.value || 'TEXT_ONLY');

      this.storage.updateConfig({
        printerName: customName,
        installedPrinters: updatedList,
        printMode: nextMode
      });

      renderPrintersSelect(updatedList, customName);
      if (modeSelect) modeSelect.value = nextMode;
      if (customInput) customInput.value = '';
      if (this.pos) this.pos.playBeep('success');
    });

    // Detectar impresora USB / Serial conectada al equipo (WebUSB / WebSerial API)
    detectUsbBtn?.addEventListener('click', async () => {
      try {
        if (navigator.usb && navigator.usb.requestDevice) {
          const device = await navigator.usb.requestDevice({ filters: [] });
          if (device) {
            const devName = (device.productName || device.manufacturerName || 'Impresora USB POS').trim();
            const cfg = this.storage.getConfig();
            const updatedList = Array.from(new Set([devName, ...(cfg.installedPrinters || [])]));
            this.storage.updateConfig({
              printerName: devName,
              installedPrinters: updatedList
            });
            renderPrintersSelect(updatedList, devName);
            alert(`✅ Impresora detectada y seleccionada: ${devName}`);
            return;
          }
        }
        alert(
          'ℹ️ Sus impresoras de Windows ("Generic / Text Only" y "BASIC 230") ya están cargadas en la lista desplegable.\n\n' +
          'Si instaló otra impresora en "Bluetooth y dispositivos -> Impresoras y escáneres", puede seleccionarla en la lista o escribir su nombre exacto en el recuadro de abajo.'
        );
      } catch (err) {
        // Usuario canceló el diálogo USB o navegador sin WebUSB
      }
    });

    // Botón Imprimir Prueba
    testBtn?.addEventListener('click', () => {
      const selectedPrinter = selectEl?.value || 'Generic / Text Only';
      const selectedPaper = paperSelect?.value || '58mm';
      const selectedMode = modeSelect?.value || 'TEXT_ONLY';
      const autoDialog = autoPrintChk ? autoPrintChk.checked : true;

      this.storage.updateConfig({
        printerName: selectedPrinter,
        paperWidth: selectedPaper,
        printMode: selectedMode,
        autoPrintDialog: autoDialog
      });

      this.closeModal('modal-parametros-impresora');
      this.printer.printTestPage();
    });

    // Guardar configuración de impresora
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedPrinter = selectEl?.value || 'Generic / Text Only';
      const selectedPaper = paperSelect?.value || '58mm';
      const selectedMode = modeSelect?.value || 'TEXT_ONLY';
      const autoDialog = autoPrintChk ? autoPrintChk.checked : true;

      const cfg = this.storage.getConfig();
      const updatedList = Array.from(new Set([selectedPrinter, ...(cfg.installedPrinters || [])]));

      this.storage.updateConfig({
        printerName: selectedPrinter,
        installedPrinters: updatedList,
        paperWidth: selectedPaper,
        printMode: selectedMode,
        autoPrintDialog: autoDialog
      });

      this.closeModal('modal-parametros-impresora');
      if (this.pos) this.pos.playBeep('success');
    });

    this.loadPrinterParamsValues = loadPrinterValues;
  }

  // 8. CALCULADORA WINDOWS POS (F4)
  setupCalculadora() {
    const display = document.getElementById('calc-display');
    const updateDisplay = () => {
      if (display) display.value = this.calcCurrent;
    };

    const inputDigit = (digit) => {
      if (this.calcNewInput) {
        this.calcCurrent = String(digit);
        this.calcNewInput = false;
      } else {
        this.calcCurrent = this.calcCurrent === '0' ? String(digit) : this.calcCurrent + digit;
      }
      updateDisplay();
    };

    const handleOp = (op) => {
      const val = parseFloat(this.calcCurrent);
      if (this.calcPendingOp && !this.calcNewInput) {
        this.calculate();
      } else {
        this.calcMemory = val;
      }
      this.calcPendingOp = op;
      this.calcNewInput = true;
    };

    const calculate = () => {
      if (!this.calcPendingOp) return;
      const val = parseFloat(this.calcCurrent);
      let res = 0;
      switch (this.calcPendingOp) {
        case '+': res = this.calcMemory + val; break;
        case '-': res = this.calcMemory - val; break;
        case '*': res = this.calcMemory * val; break;
        case '/': res = val !== 0 ? this.calcMemory / val : 'ERROR'; break;
      }
      this.calcCurrent = String(res);
      this.calcMemory = typeof res === 'number' ? res : 0;
      this.calcPendingOp = null;
      this.calcNewInput = true;
      updateDisplay();
    };

    this.calculate = calculate;

    document.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.target.dataset.val;
        if (!val) return;
        if (!isNaN(val)) {
          inputDigit(val);
        } else if (val === '.') {
          if (!this.calcCurrent.includes('.')) {
            this.calcCurrent += '.';
            this.calcNewInput = false;
            updateDisplay();
          }
        } else if (val === 'C') {
          this.calcCurrent = '0';
          this.calcMemory = 0;
          this.calcPendingOp = null;
          this.calcNewInput = true;
          updateDisplay();
        } else if (val === 'CE') {
          this.calcCurrent = '0';
          this.calcNewInput = true;
          updateDisplay();
        } else if (val === '=') {
          calculate();
        } else {
          handleOp(val);
        }
      });
    });
  }

  // 9. MODAL MENSAJES
  setupMensajesModal() {
    const list = document.getElementById('mensajes-list-container');
    const render = () => {
      if (!list) return;
      const msgs = this.storage.getMessages();
      let html = '';
      msgs.forEach(m => {
        html += `
          <div class="message-card ${m.read ? 'read' : 'unread'}">
            <div class="msg-header">
              <strong>${m.from}</strong>
              <span class="msg-date">${m.date}</span>
            </div>
            <div class="msg-subject">${m.subject}</div>
            <div class="msg-body">${m.body}</div>
          </div>
        `;
      });
      list.innerHTML = html;
      this.storage.markMessagesRead();
    };
    this.renderMensajes = render;
  }
}

let modalManager = null;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalManager };
}
