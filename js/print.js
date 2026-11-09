// js/print.js - Módulo de Impresión Térmica POS (58mm / 80mm) y Compartir
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

class ThermalPrinter {
  constructor(storageMgr) {
    this.storage = storageMgr || storage;
  }

  // Genera un código de barras simulado en SVG tipo Code 128
  generateSvgBarcode(codeText) {
    const width = 240;
    const height = 45;
    // Generar barras variables basadas en el hash de los caracteres
    let barsHtml = '';
    let x = 10;
    const cleanStr = String(codeText).replace(/[^0-9A-Z]/gi, '');
    for (let i = 0; i < cleanStr.length; i++) {
      const charCode = cleanStr.charCodeAt(i);
      const w1 = (charCode % 3) + 1;
      const space = (charCode % 2) + 1;
      const w2 = ((charCode * 3) % 4) + 1;
      barsHtml += `<rect x="${x}" y="0" width="${w1}" height="${height}" fill="#000" />`;
      x += w1 + space;
      barsHtml += `<rect x="${x}" y="0" width="${w2}" height="${height}" fill="#000" />`;
      x += w2 + 2;
    }
    // Asegurar margen de cierre
    barsHtml += `<rect x="${x}" y="0" width="3" height="${height}" fill="#000" />`;

    return `
      <svg class="barcode-svg" viewBox="0 0 ${Math.max(x + 10, width)} ${height}" xmlns="http://www.w3.org/2000/svg">
        ${barsHtml}
      </svg>
    `;
  }

  formatCurrency(amount, currencyCode) {
    const val = Number(amount) || 0;
    if (currencyCode === 'COP') {
      return `$ ${val.toLocaleString('es-CO')}`;
    } else if (currencyCode === 'VES') {
      return `Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `USD $${val.toFixed(2)}`;
    }
  }

  // Agrupa jugadas por lotería y hora para ahorrar papel térmico
  groupPlaysByLottery(items) {
    const grouped = {};
    items.forEach(item => {
      const key = item.lotteryName || item.lotteryId;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }

  // Genera el HTML exacto del recibo para 58mm y 80mm
  generateReceiptHtml(ticket, options = {}) {
    const cfg = this.storage.getConfig();
    const isCopy = options.isCopy || false;
    const paperWidth = options.paperWidth || cfg.paperWidth || '58mm';
    const currency = ticket.moneda || cfg.currency || 'COP';

    const groupedPlays = this.groupPlaysByLottery(ticket.items);
    const maskedSerial = isCopy 
      ? ticket.serialSeguridad.replace(/(\d{4})-(\d{4})-(\d{4})/, '$1-****-$3')
      : ticket.serialSeguridad;

    const separator = paperWidth === '80mm'
      ? '================================================'
      : '--------------------------------';

    let playsHtml = '';
    for (const [lotteryName, plays] of Object.entries(groupedPlays)) {
      playsHtml += `
        <div class="ticket-group-header">*** ${lotteryName.toUpperCase()} ***</div>
        <div class="ticket-plays-table">
      `;

      plays.forEach(p => {
        let nroDisplay = p.number;
        if (p.sign) {
          nroDisplay += `-${p.sign}`;
        }
        if (p.animalName) {
          nroDisplay += ` ${p.animalName.toUpperCase()}`;
        }
        if (p.is5ta) {
          nroDisplay += ` [5ta]`;
        }
        if (p.isCombinado) {
          nroDisplay += ` [Comb]`;
        }

        const montoStr = this.formatCurrency(p.amount, currency);
        playsHtml += `
          <div class="ticket-play-row">
            <span class="play-num">${nroDisplay}</span>
            <span class="play-dot-leader">. . . . . . . . .</span>
            <span class="play-monto">${montoStr}</span>
          </div>
        `;
      });

      playsHtml += `</div>`;
    }

    const printMode = options.printMode || cfg.printMode || 'TEXT_ONLY';
    const printerName = cfg.printerName || 'Generic / Text Only';
    const barcodeSvg = printMode === 'TEXT_ONLY' ? '' : this.generateSvgBarcode(ticket.serialSeguridad || ticket.ticketId);
    const agenciaDisplay = ticket.agencia || `${cfg.agencyCode || '1000'} - ${cfg.agencyName || 'FERNANDO CASTAÑO'}`;

    return `
      <div class="thermal-receipt paper-${paperWidth} ${ticket.estado === 'ANULADO' ? 'is-anulado' : ''}" data-printer="${printerName}">
        ${ticket.estado === 'ANULADO' ? '<div class="watermark-anulado">ANULADO</div>' : ''}
        ${isCopy ? '<div class="watermark-copia">*** COPIA DE TICKET ***</div>' : ''}
        
        <div class="ticket-center-block header-brand">
          <div class="banca-title">BANCA FC</div>
          <div class="banca-subtitle">FERNANDO CASTAÑO</div>
          <div class="banca-slogan">SEGURO TE PAGA (1000 SORTEOS)</div>
        </div>

        <div class="ticket-line-separator">${separator}</div>

        <div class="ticket-meta-block">
          <div><strong>AGENCIA:</strong> ${agenciaDisplay}</div>
          <div><strong>TAQUILLA / USUARIO:</strong> ${ticket.usuario || cfg.terminalId || '1000'}</div>
          <div><strong>FECHA / HORA:</strong> ${ticket.fechaHora}</div>
          <div class="meta-ticket-num">
            <span><strong>TICKET NRO:</strong> #${ticket.ticketId}</span>
          </div>
          <div><strong>SERIAL:</strong> <span class="serial-text">${maskedSerial}</span></div>
          <div><strong>ESTADO:</strong> <span class="ticket-badge-status status-${(ticket.estado || 'ACTIVO').toLowerCase()}">${ticket.estado || 'ACTIVO'}</span></div>
        </div>

        <div class="ticket-line-separator">${separator}</div>

        <div class="ticket-body-plays">
          ${playsHtml}
        </div>

        <div class="ticket-line-separator">${separator}</div>

        <div class="ticket-total-block">
          <div class="total-plays-count">CANT. JUGADAS: ${ticket.items.length}</div>
          <div class="total-amount-row">
            <span class="total-label">TOTAL A PAGAR:</span>
            <span class="total-value">${this.formatCurrency(ticket.total, currency)}</span>
          </div>
        </div>

        <div class="ticket-line-separator">${separator}</div>

        <div class="ticket-barcode-block">
          ${barcodeSvg}
          <div class="barcode-number">*${ticket.ticketId}-${ticket.serialSeguridad}*</div>
        </div>

        <div class="ticket-footer-legal">
          <p>Verifique su ticket antes de retirarse de la taquilla.</p>
          <p>Los premios caducan a los tres (3) días continuos.</p>
          <p>No se pagan tickets rotos, enmendados o ilegibles.</p>
          <p class="ticket-blessing">¡BUENA SUERTE!</p>
        </div>
      </div>
    `;
  }

  // Muestra modal con vista previa térmica y dispara impresión en la impresora configurada
  previewAndPrint(ticket, autoPrint = false) {
    const modalEl = document.getElementById('modal-print-preview');
    const containerEl = document.getElementById('print-receipt-container');
    if (!modalEl || !containerEl) {
      console.warn('Contenedor de impresión no encontrado en el DOM.');
      return;
    }

    const cfg = this.storage.getConfig();
    const headerSpan = modalEl.querySelector('.modal-header span');
    if (headerSpan) {
      headerSpan.textContent = `Vista Previa — 🖨️ ${cfg.printerName || 'Generic / Text Only'} (${cfg.paperWidth || '58mm'})`;
    }

    const receiptHtml = this.generateReceiptHtml(ticket, {
      paperWidth: cfg.paperWidth,
      printMode: cfg.printMode
    });
    containerEl.innerHTML = receiptHtml;

    // Actualizar también el área exclusiva de impresión para @media print
    const printArea = document.getElementById('print-dedicated-area');
    if (printArea) {
      printArea.innerHTML = receiptHtml;
    }

    modalEl.classList.remove('hidden');

    const shouldTriggerPrint = autoPrint && (cfg.autoPrintDialog !== false);
    if (shouldTriggerPrint) {
      setTimeout(() => {
        window.print();
      }, 300);
    }
  }

  // Imprime un ticket de prueba con la impresora seleccionada en Parámetros del Sistema
  printTestPage() {
    const cfg = this.storage.getConfig();
    const now = new Date();
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const dummyTicket = {
      ticketId: '00000000',
      serialSeguridad: 'TEST-PRNT-0001',
      fechaHora: `${dd}/${mm}/${yyyy} ${hr}:${min}:${sec} ${ampm}`,
      agencia: `${cfg.agencyCode || '1000'} - ${cfg.agencyName || 'FERNANDO CASTAÑO'}`,
      usuario: cfg.terminalId || '1000',
      moneda: cfg.currency || 'COP',
      estado: 'PRUEBA IMPRESORA',
      total: 1000,
      items: [
        {
          lotteryId: 'TEST',
          lotteryName: `IMPRESORA: ${cfg.printerName || 'Generic / Text Only'}`,
          number: '777',
          type: 'triple',
          amount: 1000
        }
      ]
    };

    this.previewAndPrint(dummyTicket, true);
  }

  // Genera texto plano optimizado para compartir en WhatsApp o enviar por Telegram
  generatePlainTextReceipt(ticket) {
    const cfg = this.storage.getConfig();
    const currency = ticket.moneda || cfg.currency;
    const grouped = this.groupPlaysByLottery(ticket.items);
    const agenciaDisplay = ticket.agencia || `${cfg.agencyCode || '1000'} - ${cfg.agencyName || 'FERNANDO CASTAÑO'}`;

    let text = `🎟️ *BANCA FC - FERNANDO CASTAÑO*\n`;
    text += `📍 *AGENCIA:* ${agenciaDisplay}\n`;
    text += `🕒 *FECHA:* ${ticket.fechaHora}\n`;
    text += `🔢 *TICKET:* #${ticket.ticketId}\n`;
    text += `🔐 *SERIAL:* ${ticket.serialSeguridad}\n`;
    text += `--------------------------------\n`;

    for (const [lotteryName, plays] of Object.entries(grouped)) {
      text += `*▶ ${lotteryName.toUpperCase()}*\n`;
      plays.forEach(p => {
        let nro = p.number;
        if (p.sign) nro += `-${p.sign}`;
        if (p.animalName) nro += ` (${p.animalName})`;
        if (p.is5ta) nro += ` [5ta]`;
        text += `  • ${nro.padEnd(16, ' ')} -> ${this.formatCurrency(p.amount, currency)}\n`;
      });
    }

    text += `--------------------------------\n`;
    text += `💰 *TOTAL A PAGAR: ${this.formatCurrency(ticket.total, currency)}*\n`;
    text += `ℹ️ *Caduca a los 3 días. Conserve su comprobante.*`;
    return text;
  }

  shareViaWhatsApp(ticket) {
    const text = this.generatePlainTextReceipt(ticket);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  downloadTxtReceipt(ticket) {
    const text = this.generatePlainTextReceipt(ticket);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ticket_${ticket.ticketId}.txt`;
    link.click();
  }
}

const defaultStorage = typeof storage !== 'undefined' ? storage : (typeof require !== 'undefined' ? require('./storage.js').storage : null);
const printer = new ThermalPrinter(defaultStorage);
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { printer, ThermalPrinter };
}
