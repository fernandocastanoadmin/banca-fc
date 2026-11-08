// js/pos.js - Motor de Taquilla de Alta Velocidad y Atajos de Teclado
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

class PosEngine {
  constructor(storageMgr, printerMgr) {
    this.storage = storageMgr || storage;
    this.printer = printerMgr || printer;

    this.currentCategory = 'sin_signo'; // 'sin_signo', 'con_signo', 'cuatro_cifras', 'animalitos'
    this.selectedLotteries = new Set();
    this.preTicketItems = [];
    this.audioCtx = null;
    this.lastNumberPlayed = '';
    this.lastMontoPlayed = 1000;
    this.lastLotteriesSelection = [];
    this.is5taActive = false;
    this.isCombinadoActive = false;

    this.initAudio();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio no disponible');
    }
  }

  playBeep(type = 'blip') {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'blip') {
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      // Audio silencioso si hay bloqueo de navegador
    }
  }

  // Cambia de categoría activa
  setCategory(categoryKey) {
    if (!LOTTERY_CATALOGS[categoryKey]) return;
    this.currentCategory = categoryKey;
    this.selectedLotteries.clear();

    // Actualizar UI de pestañas
    document.querySelectorAll('.cat-tab-btn').forEach(btn => {
      if (btn.dataset.cat === categoryKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Mostrar/ocultar campos condicionales
    const signoRow = document.getElementById('row-input-signo');
    const animalitoBar = document.getElementById('animalito-command-bar');
    const normalCommandBar = document.getElementById('normal-command-bar');
    const balota5Container = document.getElementById('container-5ta-balota');

    if (signoRow) {
      signoRow.classList.toggle('hidden', categoryKey !== 'con_signo');
    }
    if (animalitoBar && normalCommandBar) {
      const isAnm = categoryKey === 'animalitos';
      animalitoBar.classList.toggle('hidden', !isAnm);
      normalCommandBar.classList.toggle('hidden', isAnm);
    }
    if (balota5Container) {
      balota5Container.classList.toggle('hidden', categoryKey !== 'cuatro_cifras');
    }

    this.renderLotteriesList();
    this.updateCounters();
    this.focusNumberInput();
  }

  // Renderiza la lista de sorteos según la categoría y el filtro
  renderLotteriesList(filterText = '') {
    const listContainer = document.getElementById('lottery-checkbox-list');
    if (!listContainer) return;

    const catalog = LOTTERY_CATALOGS[this.currentCategory] || [];
    const query = filterText.toLowerCase().trim();

    const filtered = catalog.filter(lot => {
      return lot.name.toLowerCase().includes(query) || lot.id.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-list-notice">No hay sorteos que coincidan con "${filterText}"</div>`;
      return;
    }

    let html = '';
    filtered.forEach(lot => {
      const isChecked = this.selectedLotteries.has(lot.id);
      let badge = '';
      if (lot.time) {
        badge = `<span class="lottery-time-badge">${lot.time}</span>`;
      }
      if (lot.has5ta) {
        badge += `<span class="lottery-5ta-badge">5ta</span>`;
      }

      html += `
        <label class="lottery-item-row ${isChecked ? 'selected' : ''}" data-id="${lot.id}">
          <input type="checkbox" class="lot-chk" value="${lot.id}" ${isChecked ? 'checked' : ''}>
          <span class="lottery-name-text">${lot.name}</span>
          ${badge}
        </label>
      `;
    });

    listContainer.innerHTML = html;

    // Vincular evento de clic a las filas
    listContainer.querySelectorAll('.lot-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.value;
        if (e.target.checked) {
          this.selectedLotteries.add(id);
          e.target.closest('.lottery-item-row').classList.add('selected');
        } else {
          this.selectedLotteries.delete(id);
          e.target.closest('.lottery-item-row').classList.remove('selected');
        }
        this.updateCounters();
      });
    });
  }

  selectAllLotteries() {
    const catalog = LOTTERY_CATALOGS[this.currentCategory] || [];
    catalog.forEach(lot => this.selectedLotteries.add(lot.id));
    this.renderLotteriesList(document.getElementById('lottery-search-input')?.value || '');
    this.updateCounters();
    this.playBeep('blip');
  }

  deselectAllLotteries() {
    if (this.selectedLotteries.size > 0) {
      this.lastLotteriesSelection = Array.from(this.selectedLotteries);
    }
    this.selectedLotteries.clear();
    this.renderLotteriesList(document.getElementById('lottery-search-input')?.value || '');
    this.updateCounters();
    this.playBeep('blip');
  }

  repeatLotterySelection() {
    if (this.lastLotteriesSelection.length > 0) {
      this.selectedLotteries.clear();
      this.lastLotteriesSelection.forEach(id => this.selectedLotteries.add(id));
      this.renderLotteriesList(document.getElementById('lottery-search-input')?.value || '');
      this.updateCounters();
      this.playBeep('blip');
    }
  }

  focusNumberInput() {
    const numInput = document.getElementById('input-numero');
    if (numInput) {
      numInput.focus();
      numInput.select();
    }
  }

  focusMontoInput() {
    const montoInput = document.getElementById('input-monto');
    if (montoInput) {
      montoInput.focus();
      montoInput.select();
    }
  }

  // Agrega una jugada individual al pre-ticket
  addPlayItem(numberStr, amountVal, options = {}) {
    if (this.selectedLotteries.size === 0) {
      alert('¡Debe seleccionar al menos un sorteo en el panel izquierdo!');
      this.playBeep('error');
      return false;
    }

    const catalog = LOTTERY_CATALOGS[this.currentCategory] || [];
    const selectedLots = catalog.filter(l => this.selectedLotteries.has(l.id));

    let addedCount = 0;
    selectedLots.forEach(lot => {
      let playType = 'triple';
      let animalName = null;

      if (this.currentCategory === 'animalitos') {
        playType = 'animalito';
        const animalInfo = ANIMALITOS_DICT[numberStr] || { name: 'Animalito' };
        animalName = animalInfo.name;
      } else if (this.currentCategory === 'con_signo') {
        playType = lot.type === 'astro' ? 'astro' : 'zodiac';
      } else if (this.currentCategory === 'cuatro_cifras') {
        playType = 'cuatro_cifras';
      } else {
        // Sin signo: si tiene 2 dígitos es terminal, 3 es triple, etc.
        playType = numberStr.length === 2 ? 'terminal' : 'triple';
      }

      const item = {
        uid: Date.now() + Math.random().toString(36).substr(2, 6),
        lotteryId: lot.id,
        lotteryName: lot.name,
        number: numberStr,
        type: playType,
        sign: options.sign || null,
        animalName: animalName,
        is5ta: options.is5ta || false,
        isCombinado: options.isCombinado || false,
        amount: Number(amountVal)
      };

      this.preTicketItems.push(item);
      addedCount++;
    });

    this.lastNumberPlayed = numberStr;
    this.lastMontoPlayed = Number(amountVal);
    this.lastLotteriesSelection = Array.from(this.selectedLotteries);

    this.renderPreTicket();
    this.updateCounters();
    this.playBeep('blip');
    return true;
  }

  // Elimina una jugada del pre-ticket
  removePlayItem(uid) {
    this.preTicketItems = this.preTicketItems.filter(item => item.uid !== uid);
    this.renderPreTicket();
    this.updateCounters();
    this.playBeep('blip');
  }

  // Limpia todas las jugadas del pre-ticket
  clearPreTicket() {
    if (this.preTicketItems.length === 0) return;
    this.preTicketItems = [];
    this.renderPreTicket();
    this.updateCounters();
    this.playBeep('blip');
  }

  // Genera todas las permutaciones únicas de un número de 3 o 4 cifras
  generatePermutas(numberStr) {
    const digits = numberStr.split('');
    const results = new Set();

    function permute(arr, memo = []) {
      if (arr.length === 0) {
        results.add(memo.join(''));
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), memo.concat(next));
      }
    }

    permute(digits);
    return Array.from(results);
  }

  // Ejecuta comando 'P' (Permutas)
  executePermutas() {
    const numInput = document.getElementById('input-numero');
    const montoInput = document.getElementById('input-monto');
    const numStr = (numInput?.value || this.lastNumberPlayed || '').trim();
    const monto = Number(montoInput?.value || this.lastMontoPlayed || 1000);

    if (!numStr || numStr.length < 3) {
      alert('Ingrese un número de al menos 3 cifras para permutar (Ej. 123 o 1234)');
      this.playBeep('error');
      return;
    }

    if (this.selectedLotteries.size === 0) {
      alert('Seleccione al menos un sorteo en el panel izquierdo');
      this.playBeep('error');
      return;
    }

    const perms = this.generatePermutas(numStr);
    let count = 0;
    perms.forEach(permNum => {
      this.addPlayItem(permNum, monto);
      count++;
    });

    if (numInput) numInput.value = '';
    this.focusNumberInput();
    alert(`Se generaron ${perms.length} permutas para el número ${numStr}`);
  }

  // Ejecuta comando 'S' (Series del 0 al 9)
  executeSeries() {
    const numInput = document.getElementById('input-numero');
    const montoInput = document.getElementById('input-monto');
    const numStr = (numInput?.value || this.lastNumberPlayed || '').trim();
    const monto = Number(montoInput?.value || this.lastMontoPlayed || 1000);

    if (!numStr || (numStr.length !== 2 && numStr.length !== 3)) {
      alert('Ingrese 2 dígitos para generar serie de centena (ej. 45 -> 045 a 945) o 3 dígitos.');
      this.playBeep('error');
      return;
    }

    if (this.selectedLotteries.size === 0) {
      alert('Seleccione al menos un sorteo en el panel izquierdo');
      this.playBeep('error');
      return;
    }

    const series = [];
    if (numStr.length === 2) {
      // 045, 145, 245 ... 945
      for (let i = 0; i <= 9; i++) {
        series.push(`${i}${numStr}`);
      }
    } else if (numStr.length === 3) {
      // Variar el primer dígito o el último
      const terminal = numStr.slice(-2);
      for (let i = 0; i <= 9; i++) {
        series.push(`${i}${terminal}`);
      }
    }

    series.forEach(itemNum => {
      this.addPlayItem(itemNum, monto);
    });

    if (numInput) numInput.value = '';
    this.focusNumberInput();
    alert(`Se generó la serie de 10 números para el terminal ${numStr.slice(-2)}`);
  }

  // Ejecuta comando 'X' (Todos los signos)
  executeTodosLosSignos() {
    const numInput = document.getElementById('input-numero');
    const montoInput = document.getElementById('input-monto');
    const numStr = (numInput?.value || this.lastNumberPlayed || '').trim();
    const monto = Number(montoInput?.value || this.lastMontoPlayed || 1000);

    if (!numStr) {
      alert('Ingrese un número para apostar con todos los signos');
      this.playBeep('error');
      return;
    }

    if (this.currentCategory !== 'con_signo') {
      this.setCategory('con_signo');
    }

    if (this.selectedLotteries.size === 0) {
      alert('Seleccione un sorteo zodiacal o astro en el panel izquierdo');
      this.playBeep('error');
      return;
    }

    ZODIAC_SIGNS.forEach(sign => {
      this.addPlayItem(numStr, monto, { sign: sign.code });
    });

    if (numInput) numInput.value = '';
    this.focusNumberInput();
    alert(`Se agregaron 12 jugadas correspondientes a todos los signos zodiacales.`);
  }

  // Repite el terminal de la última jugada
  executeRepetirTerminal() {
    if (!this.lastNumberPlayed) {
      alert('No hay jugadas previas para repetir terminal');
      return;
    }
    const term = this.lastNumberPlayed.slice(-2);
    const numInput = document.getElementById('input-numero');
    if (numInput) {
      numInput.value = term;
      this.focusMontoInput();
    }
  }

  // Repite el último ticket impreso
  executeRepetirTicket() {
    const lastTicket = this.storage.getLastPrintedTicket();
    if (!lastTicket || !lastTicket.items || lastTicket.items.length === 0) {
      alert('No hay tickets anteriores registrados para repetir.');
      this.playBeep('error');
      return;
    }

    this.preTicketItems = lastTicket.items.map(item => ({
      ...item,
      uid: Date.now() + Math.random().toString(36).substr(2, 6)
    }));

    this.renderPreTicket();
    this.updateCounters();
    this.playBeep('success');
    alert(`Se cargó el contenido del Ticket #${lastTicket.ticketId} con ${lastTicket.items.length} jugadas.`);
  }

  // Renderiza el pre-ticket visual en el panel derecho
  renderPreTicket() {
    const container = document.getElementById('pre-ticket-items-list');
    const totalEl = document.getElementById('pre-ticket-total-display');
    const countEl = document.getElementById('pre-ticket-count-display');
    if (!container) return;

    const cfg = this.storage.getConfig();
    const currency = cfg.currency || 'COP';

    if (this.preTicketItems.length === 0) {
      container.innerHTML = `
        <div class="pre-ticket-empty">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">Sin jugadas en curso</div>
          <div class="empty-desc">Seleccione sorteo, ingrese número y monto para comenzar.</div>
        </div>
      `;
      if (totalEl) totalEl.textContent = printer.formatCurrency(0, currency);
      if (countEl) countEl.textContent = '0 jugadas';
      return;
    }

    let html = '';
    let total = 0;

    this.preTicketItems.forEach((item, index) => {
      total += item.amount;
      let tagDetail = '';
      if (item.sign) tagDetail = `<span class="tag-sign">${item.sign}</span>`;
      if (item.animalName) tagDetail = `<span class="tag-animal">${item.animalName}</span>`;
      if (item.is5ta) tagDetail += `<span class="tag-5ta">5TA</span>`;
      if (item.isCombinado) tagDetail += `<span class="tag-comb">COMB</span>`;

      html += `
        <div class="pre-ticket-row" data-uid="${item.uid}">
          <div class="row-left">
            <span class="row-index">${index + 1}.</span>
            <div class="row-data">
              <div class="row-lottery-name">${item.lotteryName}</div>
              <div class="row-number-value">
                <strong>${item.number}</strong> ${tagDetail}
              </div>
            </div>
          </div>
          <div class="row-right">
            <span class="row-monto">${printer.formatCurrency(item.amount, currency)}</span>
            <button type="button" class="btn-del-play" data-uid="${item.uid}" title="Eliminar jugada">×</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (totalEl) totalEl.textContent = printer.formatCurrency(total, currency);
    if (countEl) countEl.textContent = `${this.preTicketItems.length} jugadas`;

    // Asignar listeners a botones de eliminar
    container.querySelectorAll('.btn-del-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.target.dataset.uid;
        this.removePlayItem(uid);
      });
    });

    // Auto-scroll al final del contenedor
    container.scrollTop = container.scrollHeight;
  }

  // Actualiza los contadores en tiempo real (Triples, Terminales, Loterías)
  updateCounters() {
    const triplesCountEl = document.getElementById('count-triples');
    const termCountEl = document.getElementById('count-terminales');
    const lotCountEl = document.getElementById('count-loterias');

    let triples = 0;
    let terminales = 0;

    this.preTicketItems.forEach(item => {
      if (item.type === 'triple' || (item.number.length === 3 && item.type !== 'animalito')) {
        triples++;
      } else if (item.type === 'terminal' || (item.number.length === 2 && item.type !== 'animalito')) {
        terminales++;
      }
    });

    if (triplesCountEl) triplesCountEl.textContent = triples;
    if (termCountEl) termCountEl.textContent = terminales;
    if (lotCountEl) lotCountEl.textContent = this.selectedLotteries.size;
  }

  // Proceso final de emisión e impresión del ticket
  processTicketSubmission() {
    if (this.preTicketItems.length === 0) {
      alert('¡No hay jugadas cargadas en el ticket!');
      this.playBeep('error');
      return;
    }

    const cfg = this.storage.getConfig();
    const agencyInfo = this.storage.getAgencyByCode(cfg.agencyCode);
    if (agencyInfo && agencyInfo.status === 'SUSPENDIDA') {
      alert(`⛔ ACCESO DENEGADO: La Agencia ${agencyInfo.code} (${agencyInfo.name}) se encuentra SUSPENDIDA en el Panel Central de Banca FC Fernando Castaño. Comuníquese con administración.`);
      this.playBeep('error');
      return;
    }

    let total = 0;
    this.preTicketItems.forEach(p => total += p.amount);

    // Validación de Tope de Riesgo por Número en la Agencia
    if (agencyInfo && agencyInfo.maxBetLimit > 0) {
      const existingTickets = this.storage.getTickets().filter(t => t.estado !== 'ANULADO' && String(t.agencyCode || t.usuario) === String(cfg.agencyCode));
      for (const play of this.preTicketItems) {
        let currentNumberAccum = 0;
        existingTickets.forEach(t => {
          (t.items || []).forEach(it => {
            if (it.lotteryId === play.lotteryId && String(it.number) === String(play.number)) {
              currentNumberAccum += Number(it.amount);
            }
          });
        });
        if (currentNumberAccum + play.amount > agencyInfo.maxBetLimit) {
          const disponible = Math.max(0, agencyInfo.maxBetLimit - currentNumberAccum);
          alert(`⚠️ TOPE DE RIESGO EXCEDIDO EN BANCA FC:\nSorteo: ${play.lotteryName}\nNúmero/Animalito: ${play.number}\nTope Máximo Agencia: ${this.printer.formatCurrency(agencyInfo.maxBetLimit, cfg.currency)}\nDisponible para este número: ${this.printer.formatCurrency(disponible, cfg.currency)}`);
          this.playBeep('error');
          return;
        }
      }
    }

    const ticketId = this.storage.getNextTicketNumber();
    const serial = this.storage.generateSecuritySerial();
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${now.toLocaleTimeString('es-VE')}`;

    const ticket = {
      ticketId: ticketId,
      serialSeguridad: serial,
      fechaHora: dateStr,
      agencyCode: String(cfg.agencyCode || '1000'),
      agencia: `${cfg.agencyCode} - ${cfg.agencyName}`,
      usuario: cfg.terminalId || cfg.agencyCode,
      moneda: cfg.currency,
      items: [...this.preTicketItems],
      total: total,
      estado: 'ACTIVO',
      premioCalculado: 0
    };

    // Guardar en base de datos local
    this.storage.saveTicket(ticket);

    // Reproducir sonido de éxito de taquilla
    this.playBeep('success');

    // Disparar vista previa e impresión térmica
    this.printer.previewAndPrint(ticket, false);

    // Limpiar pre-ticket para la siguiente venta
    this.preTicketItems = [];
    this.renderPreTicket();
    this.updateCounters();

    // Actualizar indicador del próximo ticket correlativo en la cabecera
    const headerTicketNumEl = document.getElementById('header-ticket-correlativo');
    if (headerTicketNumEl) {
      const nextId = String(Number(ticketId) + 1).padStart(8, '0');
      headerTicketNumEl.textContent = `Ticket #${nextId}`;
    }

    // Devolver el foco al campo número para la próxima venta
    this.focusNumberInput();
  }
}

let posEngine = null;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PosEngine };
}
