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

  // 3. MODAL NÚMEROS PREMIADOS (CARGA DE RESULTADOS OFICIALES)
  setupResultadosModal() {
    const dateInput = document.getElementById('input-resultados-fecha');
    const lotSelect = document.getElementById('select-resultados-loteria');
    const numInput = document.getElementById('input-resultados-numero');
    const signSelect = document.getElementById('select-resultados-signo');
    const ball5Input = document.getElementById('input-resultados-5ta');
    const saveBtn = document.getElementById('btn-guardar-resultado');
    const tableBody = document.getElementById('tabla-resultados-guardados');

    // Inicializar fecha de hoy
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (dateInput) dateInput.value = todayStr;

    // Llenar selector de loterías con todo el catálogo
    if (lotSelect) {
      lotSelect.innerHTML = '';
      const allLots = [
        ...LOTTERY_CATALOGS.sin_signo.map(l => ({ ...l, cat: 'SIN SIGNO' })),
        ...LOTTERY_CATALOGS.con_signo.map(l => ({ ...l, cat: 'CON SIGNO' })),
        ...LOTTERY_CATALOGS.cuatro_cifras.map(l => ({ ...l, cat: '4 CIFRAS' })),
        ...LOTTERY_CATALOGS.animalitos.map(l => ({ ...l, cat: 'ANIMALITOS' }))
      ];

      allLots.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `[${l.cat}] ${l.name}`;
        lotSelect.appendChild(opt);
      });
    }

    // Llenar selector de signos
    if (signSelect) {
      signSelect.innerHTML = '<option value="">-- Sin Signo --</option>';
      ZODIAC_SIGNS.forEach(s => {
        signSelect.innerHTML += `<option value="${s.code}">${s.code} - ${s.name}</option>`;
      });
    }

    const renderResultsTable = () => {
      if (!tableBody || !dateInput) return;
      const dateKey = dateInput.value;
      const res = this.storage.getResults(dateKey);
      const keys = Object.keys(res);

      if (keys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3">No hay resultados cargados para esta fecha.</td></tr>';
        return;
      }

      let rows = '';
      keys.forEach(k => {
        const r = res[k];
        let detail = r.number;
        if (r.sign) detail += ` - ${r.sign}`;
        if (r.animalName) detail += ` (${r.animalName})`;
        if (r.ball5) detail += ` [5ta: ${r.ball5}]`;

        rows += `
          <tr>
            <td><strong>${k}</strong></td>
            <td><span class="badge-result-num">${detail}</span></td>
            <td>${r.timestamp || 'Cargado'}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger btn-del-res" data-id="${k}">Eliminar</button>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = rows;

      tableBody.querySelectorAll('.btn-del-res').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          const all = this.storage.getResults();
          if (all[dateKey]) {
            delete all[dateKey][id];
            localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(all));
            renderResultsTable();
          }
        });
      });
    };

    if (dateInput) dateInput.addEventListener('change', renderResultsTable);

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const dateKey = dateInput.value;
        const lotId = lotSelect.value;
        const number = numInput.value.trim();
        const sign = signSelect ? signSelect.value : '';
        const ball5 = ball5Input ? ball5Input.value.trim() : '';

        if (!number) {
          alert('Debe ingresar el número premiado');
          return;
        }

        let animalName = null;
        if (ANIMALITOS_DICT[number]) {
          animalName = ANIMALITOS_DICT[number].name;
        }

        const resObj = {
          number: number,
          sign: sign || null,
          ball5: ball5 || null,
          animalName: animalName,
          timestamp: new Date().toLocaleTimeString('es-VE')
        };

        this.storage.saveResult(dateKey, lotId, resObj);
        numInput.value = '';
        if (ball5Input) ball5Input.value = '';
        renderResultsTable();
        alert(`Resultado guardado para ${lotId}: ${number}`);
        this.pos.playBeep('success');
      });
    }

    this.renderResultadosTable = renderResultsTable;
  }

  // 4. MODAL VERIFICAR Y PAGAR TICKETS GANADORES
  setupVerificarPagoModal() {
    const inputSearch = document.getElementById('input-verificar-ticket');
    const btnSearch = document.getElementById('btn-verificar-ticket');
    const resContainer = document.getElementById('verificar-ticket-result');
    const btnPagar = document.getElementById('btn-pagar-ticket-ganador');

    const doVerify = () => {
      const q = inputSearch.value.trim();
      if (!q) {
        alert('Ingrese el número o serial del ticket');
        return;
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
      const targetDate = dateInput?.value || todayFormatted;
      const targetCurrency = curSelect?.value || 'COP';
      const tickets = this.storage.getTickets();
      const cfg = this.storage.getConfig();

      // Filtrar por fecha y moneda
      const dayTickets = tickets.filter(t => {
        const tDate = t.fechaHora.split(' ')[0];
        const matchDate = tDate === targetDate;
        const matchCur = (t.moneda || 'COP') === targetCurrency;
        return matchDate && matchCur;
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
      const comisionPct = cfg.agencyCommissionPct || 10;
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

  // 7. MODAL CONFIGURACIÓN Y PARÁMETROS
  setupConfigModal() {
    const form = document.getElementById('form-parametros');
    if (!form) return;

    const loadFormValues = () => {
      const cfg = this.storage.getConfig();
      document.getElementById('cfg-agency-code').value = cfg.agencyCode || '1000';
      document.getElementById('cfg-agency-name').value = cfg.agencyName || 'FERNANDO CASTAÑO';
      document.getElementById('cfg-user-id').value = cfg.terminalId || '1000';
      document.getElementById('cfg-currency').value = cfg.currency || 'COP';
      document.getElementById('cfg-paper-width').value = cfg.paperWidth || '58mm';
      document.getElementById('cfg-commission').value = cfg.agencyCommissionPct || 10;

      // Multiplicadores
      document.getElementById('cfg-mult-triple').value = cfg.multipliers.triple || 500;
      document.getElementById('cfg-mult-terminal').value = cfg.multipliers.terminal || 60;
      document.getElementById('cfg-mult-aprox').value = cfg.multipliers.aproximacion || 5;
      document.getElementById('cfg-mult-animalito').value = cfg.multipliers.animalito || 30;
      document.getElementById('cfg-mult-4cifras').value = cfg.multipliers.cuatroCifrasDirecto || 4500;
      document.getElementById('cfg-mult-la5ta').value = cfg.multipliers.la5ta || 25000;
      document.getElementById('cfg-mult-astro').value = cfg.multipliers.astro4 || 40000;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newConfig = {
        agencyCode: document.getElementById('cfg-agency-code').value.trim(),
        agencyName: document.getElementById('cfg-agency-name').value.trim(),
        terminalId: document.getElementById('cfg-user-id').value.trim(),
        currency: document.getElementById('cfg-currency').value,
        paperWidth: document.getElementById('cfg-paper-width').value,
        agencyCommissionPct: Number(document.getElementById('cfg-commission').value),
        multipliers: {
          triple: Number(document.getElementById('cfg-mult-triple').value),
          terminal: Number(document.getElementById('cfg-mult-terminal').value),
          aproximacion: Number(document.getElementById('cfg-mult-aprox').value),
          animalito: Number(document.getElementById('cfg-mult-animalito').value),
          cuatroCifrasDirecto: Number(document.getElementById('cfg-mult-4cifras').value),
          la5ta: Number(document.getElementById('cfg-mult-la5ta').value),
          astro4: Number(document.getElementById('cfg-mult-astro').value)
        }
      };

      this.storage.updateConfig(newConfig);
      alert('Configuración actualizada exitosamente.');
      this.closeModal('modal-configuracion');

      // Actualizar cabecera de la ventana
      const headerTitle = document.getElementById('window-title-bar-text');
      if (headerTitle) {
        headerTitle.textContent = `Agencia ${newConfig.agencyCode}: AG ${newConfig.agencyName} | Usuario: ${newConfig.terminalId} - [Ventas]`;
      }
      const headerAgency = document.getElementById('header-agency-label');
      if (headerAgency) {
        headerAgency.textContent = `AGENCIA: ${newConfig.agencyCode} - ${newConfig.agencyName}`;
      }
      const headerCur = document.getElementById('header-active-currency');
      if (headerCur) {
        headerCur.textContent = newConfig.currency;
      }

      if (this.pos) {
        this.pos.renderPreTicket();
      }
    });

    this.loadConfigValues = loadFormValues;
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
