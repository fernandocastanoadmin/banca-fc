// js/app.js - Inicializador Principal, Autenticación y Mapeo Global de Eventos
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Motores y Servicios
  const storageInstance = storage;
  const printerInstance = printer;
  const pos = new PosEngine(storageInstance, printerInstance);
  const modals = new ModalManager(storageInstance, printerInstance, pos);
  modals.setPos(pos);

  // Exponer a nivel global para debugging e integraciones
  window.posApp = {
    storage: storageInstance,
    printer: printerInstance,
    pos: pos,
    modals: modals
  };

  // 2. Control de Reloj en Tiempo Real (Formato 12h AM/PM estricto)
  function updateLiveClock() {
    const clockEl = document.getElementById('header-live-clock');
    if (!clockEl) return;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    let hr = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12;
    if (hr === 0) hr = 12;
    clockEl.textContent = `${dd}/${mm}/${yyyy} | ${hr}:${min}:${sec} ${ampm}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // 3. Inicializar Correlativo en Cabecera
  const cfg = storageInstance.getConfig();
  const nextTicketEl = document.getElementById('header-ticket-correlativo');
  if (nextTicketEl) {
    const nextNum = String(cfg.nextTicketNumber || 10919).padStart(8, '0');
    nextTicketEl.textContent = `Ticket #${nextNum}`;
  }
  const headerAgencyInit = document.getElementById('header-agency-label');
  if (headerAgencyInit) {
    headerAgencyInit.textContent = `AGENCIA: ${cfg.agencyCode || '1000'} - ${cfg.agencyName || 'FERNANDO CASTAÑO'}`;
  }
  const headerTitleInit = document.getElementById('window-title-bar-text');
  if (headerTitleInit) {
    headerTitleInit.textContent = `Agencia ${cfg.agencyCode || '1000'}: AG ${cfg.agentName || cfg.agencyName || 'Fernando Castaño'} | Usuario: 1000 - [Ventas]`;
  }

  // 4. Módulo de Autenticación y Pantalla de Login
  const loginModal = document.getElementById('modal-login-pos');
  const loginUser = document.getElementById('login-usuario');
  const loginPass = document.getElementById('login-password');
  const loginCapsWarning = document.getElementById('login-caps-warning');
  const btnLoginAceptar = document.getElementById('btn-login-aceptar');
  const btnLoginCancelar = document.getElementById('btn-login-cancelar');

  // Detector de Bloq Mayús (Caps Lock)
  const checkCapsLock = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      loginCapsWarning?.classList.remove('hidden');
    } else {
      loginCapsWarning?.classList.add('hidden');
    }
  };

  if (loginPass) {
    loginPass.addEventListener('keyup', checkCapsLock);
    loginPass.addEventListener('keydown', checkCapsLock);
  }

  const executeLogin = () => {
    const userVal = loginUser?.value.trim() || '1000';
    const passVal = loginPass?.value.trim() || '';

    // Autenticar contra las agencias creadas en el Panel Administrativo de Banca FC
    const authRes = storageInstance.authenticatePosAgency(userVal, passVal);
    if (!authRes.success) {
      alert(authRes.reason);
      pos.playBeep('error');
      return;
    }

    const updatedCfg = storageInstance.getConfig();
    loginModal.classList.add('hidden');
    pos.playBeep('success');

    // Actualizar título y cabecera con la agencia activa
    const headerTitle = document.getElementById('window-title-bar-text');
    if (headerTitle) {
      headerTitle.textContent = `Agencia ${updatedCfg.agencyCode || userVal}: ${updatedCfg.agencyName || 'FERNANDO CASTAÑO'} | Usuario: ${userVal} - [Ventas]`;
    }
    const headerAgencyLabel = document.getElementById('header-agency-label');
    if (headerAgencyLabel) {
      headerAgencyLabel.textContent = `AGENCIA: ${updatedCfg.agencyCode || userVal} - ${updatedCfg.agencyName || 'FERNANDO CASTAÑO'}`;
    }
    const headerCur = document.getElementById('header-active-currency');
    if (headerCur) {
      headerCur.textContent = updatedCfg.currency || 'COP';
    }

    pos.renderPreTicket();
    // Iniciar con foco directo en la taquilla rápida
    pos.focusNumberInput();
  };

  if (btnLoginAceptar) btnLoginAceptar.addEventListener('click', executeLogin);
  if (btnLoginCancelar) {
    btnLoginCancelar.addEventListener('click', () => {
      if (confirm('¿Desea salir del sistema de taquilla?')) {
        window.close();
      }
    });
  }

  // Tecla Enter o ESC en Login
  loginModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeLogin();
    } else if (e.key === 'Escape') {
      btnLoginCancelar?.click();
    }
  });

  // 5. Configurar Pestañas de Categorías (Panel Izquierdo)
  document.querySelectorAll('.cat-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pos.setCategory(btn.dataset.cat);
    });
  });

  // Filtro en tiempo real de sorteos
  const searchInput = document.getElementById('lottery-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      pos.renderLotteriesList(e.target.value);
    });
  }

  // Botones de selección rápida de loterías
  document.getElementById('btn-marcar-todos')?.addEventListener('click', () => pos.selectAllLotteries());
  document.getElementById('btn-desmarcar-todos')?.addEventListener('click', () => pos.deselectAllLotteries());
  document.getElementById('chk-show-all-week')?.addEventListener('change', (e) => {
    pos.showAllWeekLotteries = e.target.checked;
    pos.renderLotteriesList(document.getElementById('lottery-search-input')?.value || '');
  });

  // 6. Configuración de Inputs de Captura Rápida (Panel Central)
  const inputNumero = document.getElementById('input-numero');
  const inputMonto = document.getElementById('input-monto');
  const inputSigno = document.getElementById('select-signo-rapido');
  const animalitoPreviewBadge = document.getElementById('badge-animalito-live-preview');
  const chk5ta = document.getElementById('chk-la-5ta-balota');
  const chkComb = document.getElementById('chk-combinado-rapido');

  // Llenar selector rápido de signo
  if (inputSigno) {
    inputSigno.innerHTML = '<option value="TODOS">TODOS LOS SIGNOS</option>';
    ZODIAC_SIGNS.forEach(s => {
      inputSigno.innerHTML += `<option value="${s.code}">${s.code} - ${s.name}</option>`;
    });
  }

  // Previsualización instantánea de Animalito o Fruta Gana al digitar número
  if (inputNumero) {
    inputNumero.addEventListener('input', () => {
      pos.updateAnimalitoPreviewBadge();
    });

    // Enter en Número salta a Monto
    inputNumero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputNumero.value.trim();
        if (!val) return;
        pos.focusMontoInput();
        pos.playBeep('blip');
      }
    });
  }

  // Manejo de Monto: Enter inserta la jugada
  if (inputMonto) {
    inputMonto.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const numVal = inputNumero.value.trim();
        const montoVal = Number(inputMonto.value);

        if (!numVal) {
          pos.focusNumberInput();
          return;
        }

        if (isNaN(montoVal) || montoVal <= 0) {
          alert('Ingrese un monto válido');
          pos.playBeep('error');
          return;
        }

        const options = {};
        if (pos.currentCategory === 'con_signo') {
          options.sign = inputSigno?.value || 'TODOS';
        }
        if (pos.currentCategory === 'cuatro_cifras') {
          options.is5ta = chk5ta?.checked || false;
          options.isCombinado = chkComb?.checked || false;
        }

        const added = pos.addPlayItem(numVal, montoVal, options);
        if (added) {
          inputNumero.value = '';
          if (animalitoPreviewBadge) animalitoPreviewBadge.classList.add('hidden');
          pos.focusNumberInput();
        }
      }
    });
  }

  // 7. Configuración de Botones de Panel de Comandos
  document.getElementById('cmd-btn-permuta')?.addEventListener('click', () => pos.executePermutas());
  document.getElementById('cmd-btn-series')?.addEventListener('click', () => pos.executeSeries());
  document.getElementById('cmd-btn-todos-signos')?.addEventListener('click', () => pos.executeTodosLosSignos());
  document.getElementById('cmd-btn-repetir-terminal')?.addEventListener('click', () => pos.executeRepetirTerminal());
  document.getElementById('cmd-btn-repetir-loteria')?.addEventListener('click', () => pos.repeatLotterySelection());
  document.getElementById('cmd-btn-repetir-ticket')?.addEventListener('click', () => pos.executeRepetirTicket());
  document.getElementById('cmd-btn-anular-todo')?.addEventListener('click', () => {
    if (confirm('¿Limpiar todas las jugadas del pre-ticket?')) {
      pos.clearPreTicket();
    }
  });
  document.getElementById('cmd-btn-desmarcar-lot')?.addEventListener('click', () => pos.deselectAllLotteries());
  document.getElementById('cmd-btn-imprimir')?.addEventListener('click', () => pos.processTicketSubmission());
  document.getElementById('cmd-btn-mensajes')?.addEventListener('click', () => {
    modals.renderMensajes();
    modals.openModal('modal-mensajes');
  });

  // Botones de Animalitos (Barra Inferior Especial)
  document.getElementById('btn-anm-borrar')?.addEventListener('click', () => pos.clearPreTicket());
  document.getElementById('btn-anm-desmarcar')?.addEventListener('click', () => pos.deselectAllLotteries());
  document.getElementById('btn-anm-repetir')?.addEventListener('click', () => pos.executeRepetirTicket());
  document.getElementById('btn-anm-anular')?.addEventListener('click', () => modals.openModal('modal-anular-ticket'));
  document.getElementById('btn-anm-pagar')?.addEventListener('click', () => modals.openModal('modal-verificar-ticket'));
  document.getElementById('btn-anm-imprimir')?.addEventListener('click', () => pos.processTicketSubmission());
  document.getElementById('btn-anm-ruleta-rapida')?.addEventListener('click', () => modals.openModal('modal-ruleta-animalitos'));

  // Botón directo de Pre-Ticket "Imprimir Ticket"
  document.getElementById('btn-imprimir-pre-ticket')?.addEventListener('click', () => pos.processTicketSubmission());
  document.getElementById('btn-limpiar-pre-ticket')?.addEventListener('click', () => pos.clearPreTicket());

  // 8. Configuración de Menús Superiores Desplegables
  const setupTopMenus = () => {
    // Cerrar submenús al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-item-dropdown')) {
        document.querySelectorAll('.dropdown-menu-list').forEach(m => m.classList.add('hidden'));
      }
    });

    document.querySelectorAll('.dropdown-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = btn.closest('.menu-item-dropdown');
        const menu = parent.querySelector('.dropdown-menu-list');
        const isHidden = menu.classList.contains('hidden');
        document.querySelectorAll('.dropdown-menu-list').forEach(m => m.classList.add('hidden'));
        if (isHidden) {
          menu.classList.remove('hidden');
        }
      });
    });

    // Menú Ventas
    document.getElementById('menu-item-f2-venta')?.addEventListener('click', () => modals.closeAllModals());
    document.getElementById('menu-item-f3-anular')?.addEventListener('click', () => modals.openModal('modal-anular-ticket'));
    document.getElementById('menu-item-reimprimir')?.addEventListener('click', () => {
      modals.renderReimprimirList();
      modals.openModal('modal-reimprimir-ticket');
    });

    // Menú Premiación
    document.getElementById('menu-item-status-ganadores')?.addEventListener('click', () => modals.openModal('modal-verificar-ticket'));
    document.getElementById('menu-item-numeros-premiados')?.addEventListener('click', () => {
      modals.renderResultadosTable();
      modals.openModal('modal-numeros-premiados');
    });
    document.getElementById('menu-item-pago-ticket')?.addEventListener('click', () => modals.openModal('modal-verificar-ticket'));

    // Menú Reportes
    document.getElementById('menu-item-reporte-general-num')?.addEventListener('click', () => {
      modals.renderReporteNumeros();
      modals.openModal('modal-reporte-numeros');
    });
    document.getElementById('menu-item-cuadre-caja')?.addEventListener('click', () => {
      modals.calculateAndRenderCuadre();
      modals.openModal('modal-cuadre-caja');
    });

    // Menú Configuración
    document.getElementById('menu-item-parametros')?.addEventListener('click', () => {
      modals.loadConfigValues();
      modals.openModal('modal-configuracion');
    });

    // Menú Mensajes
    document.getElementById('menu-item-leer-mensajes')?.addEventListener('click', () => {
      modals.renderMensajes();
      modals.openModal('modal-mensajes');
    });

    // Menú Utilidades
    document.getElementById('menu-item-f4-calculadora')?.addEventListener('click', () => modals.openModal('modal-calculadora'));
    document.getElementById('menu-item-f10-minimizar')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Menú Actualizar y Nube Google Firebase
    document.getElementById('menu-item-actualizar')?.addEventListener('click', async () => {
      if (window.bancaFcCloud && window.bancaFcCloud.isConfigured()) {
        await window.bancaFcCloud.pullAndMergeFromCloud();
        await window.bancaFcCloud.pushMasterData(storageInstance.getMasterData());
      } else {
        await storageInstance.pullFromRemoteServer();
      }
      pos.renderLotteriesList();
      pos.updateCounters();
      pos.playBeep('success');
      alert('☁️ Sincronización completada con Google Firebase / Panel Central. Sorteos, agencias y resultados actualizados.');
    });

    const promptConfigureFirebasePos = async () => {
      const currentFb = (window.bancaFcCloud && window.bancaFcCloud.databaseURL) || '';
      const inputUrl = prompt(
        '☁️ CONEXIÓN EN TIEMPO REAL CON GOOGLE FIREBASE (BANCA FC):\n\n' +
        'Pegue aquí la URL de su Firebase Realtime Database (ej: https://banca-fc-default-rtdb.firebaseio.com) para que todos los tickets de esta taquilla se sincronicen automáticamente en vivo con el Panel Administrativo:\n\n' +
        '(Deje vacío para desconectar)',
        currentFb || 'https://banca-fc-castano-default-rtdb.firebaseio.com'
      );
      if (inputUrl === null) return;
      if (!inputUrl.trim()) {
        window.bancaFcCloud?.disconnect();
        alert('Sincronización Firebase desconectada en esta taquilla.');
        return;
      }
      if (window.bancaFcCloud) {
        const res = await window.bancaFcCloud.saveConfig(inputUrl);
        if (res.ok) {
          pos.updateCounters();
          alert('✅ ¡Conectado a Google Firebase! Cada ticket emitido en esta taquilla aparecerá al instante en el Panel Administrativo Central.');
        } else {
          alert('❌ Error al conectar con Firebase: ' + (res.error || 'Verifique la URL.'));
        }
      }
    };

    document.getElementById('menu-item-config-red-server')?.addEventListener('click', promptConfigureFirebasePos);
    document.getElementById('pos-firebase-status-badge')?.addEventListener('click', promptConfigureFirebasePos);

    // Actualizar contadores de la taquilla cuando entran cambios en vivo desde Firebase
    window.addEventListener('banca_fc_data_updated', () => {
      pos.updateCounters();
    });

    const downloadPosJsonPackage = () => {
      const curCfg = storageInstance.getConfig();
      const jsonStr = storageInstance.exportSyncPackage();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ventas_Taquilla_${curCfg.agencyCode || '1000'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    document.getElementById('menu-item-exportar-cierre-json')?.addEventListener('click', downloadPosJsonPackage);
    document.getElementById('btn-exportar-paquete-json')?.addEventListener('click', downloadPosJsonPackage);

    // Menú Salir
    document.getElementById('menu-item-salir')?.addEventListener('click', () => {
      loginModal?.classList.remove('hidden');
    });
  };
  setupTopMenus();

  // 9. Configuración de Modales Individuales
  modals.setupAnularTicketModal();
  modals.setupReimprimirModal();
  modals.setupResultadosModal();
  modals.setupVerificarPagoModal();
  modals.setupCuadreCajaModal();
  modals.setupReporteNumerosModal();
  modals.setupConfigModal();
  modals.setupCalculadora();
  modals.setupMensajesModal();

  // 10. Mapeo Global de Atajos de Teclado (Taquilla Rápida POS)
  window.addEventListener('keydown', (e) => {
    // Si la pantalla de login está abierta, ignorar otros atajos
    if (!loginModal?.classList.contains('hidden')) return;

    // F2: Venta de Ticket (Cerrar cualquier modal y volver a foco de taquilla)
    if (e.key === 'F2') {
      e.preventDefault();
      modals.closeAllModals();
      pos.focusNumberInput();
      return;
    }

    // F3: Anular Ticket
    if (e.key === 'F3') {
      e.preventDefault();
      modals.openModal('modal-anular-ticket');
      return;
    }

    // F4: Calculadora
    if (e.key === 'F4') {
      e.preventDefault();
      modals.openModal('modal-calculadora');
      return;
    }

    // F10: Pantalla Completa / Minimizar
    if (e.key === 'F10') {
      e.preventDefault();
      document.getElementById('menu-item-f10-minimizar')?.click();
      return;
    }

    // ESC: Cerrar modales abiertos o limpiar foco
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (openModal) {
        openModal.classList.add('hidden');
        pos.focusNumberInput();
      } else {
        pos.focusNumberInput();
      }
      return;
    }

    // Tecla '+' o '/' en el teclado numérico: Imprimir Ticket directamente
    // (Solo si no estamos escribiendo dentro de un campo de búsqueda o texto específico)
    const activeTagName = document.activeElement?.tagName;
    const isSpecialInput = document.activeElement?.id === 'lottery-search-input' ||
                           document.activeElement?.id === 'input-anular-search' ||
                           document.activeElement?.id === 'input-reimprimir-search';

    if ((e.key === '+' || e.key === '/') && !isSpecialInput) {
      // Si estamos en un input y es un '+' o '/', evitamos escribir el carácter y disparamos impresión
      if (pos.preTicketItems.length > 0) {
        e.preventDefault();
        pos.processTicketSubmission();
        return;
      }
    }

    // Atajos de comandos con letras (Cuando NO se está escribiendo texto)
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(activeTagName)) {
      const key = e.key.toUpperCase();
      switch (key) {
        case 'P':
          e.preventDefault();
          pos.executePermutas();
          break;
        case 'S':
          e.preventDefault();
          pos.executeSeries();
          break;
        case 'X':
          e.preventDefault();
          pos.executeTodosLosSignos();
          break;
        case 'R':
          e.preventDefault();
          pos.executeRepetirTerminal();
          break;
        case 'L':
          e.preventDefault();
          pos.repeatLotterySelection();
          break;
        case 'T':
          e.preventDefault();
          pos.executeRepetirTicket();
          break;
        case 'A':
          e.preventDefault();
          if (confirm('¿Limpiar pre-ticket?')) pos.clearPreTicket();
          break;
        case 'C':
          e.preventDefault();
          pos.deselectAllLotteries();
          break;
        case 'M':
          e.preventDefault();
          modals.renderMensajes();
          modals.openModal('modal-mensajes');
          break;
        case 'O':
          e.preventDefault();
          if (chkComb) chkComb.checked = !chkComb.checked;
          break;
      }
    }
  });

  // 11. Modal de Impresión Térmica y Botones de Compartir
  document.getElementById('btn-close-print-preview')?.addEventListener('click', () => {
    document.getElementById('modal-print-preview')?.classList.add('hidden');
    pos.focusNumberInput();
  });

  document.getElementById('btn-trigger-window-print')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => {
    const last = storageInstance.getLastPrintedTicket();
    if (last) printerInstance.shareViaWhatsApp(last);
  });

  document.getElementById('btn-download-ticket-txt')?.addEventListener('click', () => {
    const last = storageInstance.getLastPrintedTicket();
    if (last) printerInstance.downloadTxtReceipt(last);
  });

  // 12. Modal de Ruleta / Selector Rápido de Animalitos y Fruta Gana
  const setupAnimalitosGrid = () => {
    const grid = document.getElementById('animalitos-quick-grid');
    if (!grid) return;

    const selectedIds = Array.from(pos.selectedLotteries || []);
    const isFrutaOnly = selectedIds.length > 0 && selectedIds.every(id => id.includes('FRUTA_GANA'));
    const dict = (isFrutaOnly && typeof FRUTAS_DICT !== 'undefined') ? FRUTAS_DICT : ANIMALITOS_DICT;

    let html = '';
    const codes = ['0', '00'];
    for (let i = 1; i <= 36; i++) {
      codes.push(i < 10 ? `0${i}` : String(i));
    }

    codes.forEach(code => {
      const info = dict[code] || { name: 'Item', emoji: '🐾' };
      const fruitSub = (!isFrutaOnly && typeof FRUTAS_DICT !== 'undefined' && FRUTAS_DICT[code])
        ? `<span style="font-size:9px;color:#64748b;display:block;">${FRUTAS_DICT[code].emoji} ${FRUTAS_DICT[code].name}</span>`
        : '';
      html += `
        <button type="button" class="animal-picker-btn" data-code="${code}">
          <span class="ap-code">${code}</span>
          <span class="ap-emoji">${info.emoji}</span>
          <span class="ap-name">${info.name}</span>
          ${fruitSub}
        </button>
      `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.animal-picker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (inputNumero) {
          inputNumero.value = code;
          inputNumero.dispatchEvent(new Event('input'));
        }
        modals.closeModal('modal-ruleta-animalitos');
        pos.focusMontoInput();
      });
    });
  };
  setupAnimalitosGrid();
  document.getElementById('btn-anm-ruleta-rapida')?.addEventListener('click', () => setupAnimalitosGrid());

  // 13. Cierre general de modales mediante botones con data-close
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.closeModal;
      modals.closeModal(target);
    });
  });

  // Inicializar estado de la taquilla
  pos.setCategory('sin_signo');

  // Escuchar cambios en vivo desde el Panel Administrativo Central de Banca FC
  window.addEventListener('storage', (e) => {
    if (e.key === 'banca_fc_data') {
      const updatedCfg = storageInstance.getConfig();
      const nextNumEl = document.getElementById('header-ticket-correlativo');
      if (nextNumEl) {
        nextNumEl.textContent = `Ticket #${String(updatedCfg.nextTicketNumber || 10926).padStart(8, '0')}`;
      }
      pos.renderPreTicket();
    }
  });

  // Polling ligero cada 4 segundos para sincronizar con el Servidor Central en red LAN
  setInterval(() => {
    storageInstance.pullFromRemoteServer();
  }, 4000);
});
