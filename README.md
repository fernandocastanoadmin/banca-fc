# BANCA EL CASTAÑO (1000 SORTEOS)
## Sistema POS de Loterías de Alta Velocidad para Taquillas (Venezuela / Colombia)

Aplicación web completa, autónoma y de alta velocidad que emula fielmente la interfaz operativa, diseño visual Windows Clásico POS y velocidad de digitación de taquilla del sistema **"Banca El Castaño"** (Agencia 1000 - Seguro Te Paga).

---

### 🚀 Características Principales

1. **Autenticación Clásica Windows POS:**
   - Fondo retro celeste con patrón de herraduras y logotipo superior con las iniciales **FC**: **"Banca El Castaño - Seguro Te Paga (1000 Sorteos)"** situado de forma destacada en la parte superior del cuadro de diálogo para evitar solapamientos.
   - Emblema distintivo **FC** en la esquina inferior izquierda: **"Banca El Castaño | Taquilla Oficial"**.
   - Diálogo modal con `ID: 202606111000`, `Usuario: 1000` y detector en vivo de *Bloq Mayús*.
   - Atajos de confirmación rápida con `Enter` y cancelación con `ESC`.

2. **Cabecera Operativa con Reloj y Correlativo:**
   - Título de ventana: `Agencia 1000: AG El Castaño | Usuario: 1000 - [Ventas]`.
   - Barra de estado superior: `AGENCIA: 1000 - EL CASTAÑO`.
   - Menú superior desplegable 100% funcional:
     - **Ventas:** F2 Venta de Ticket, F3 Anular Ticket, Reimprimir Ticket, Águila Última Polla.
     - **Premiación:** Status Ticket Ganadores, Números Premiados, Tickets Ganadores, Pago de Ticket, Pagar Polla.
     - **Reportes:** Reporte General x Nros, Relación Final (Cuadre de Caja), Reportes de Tickets, Edo. de Cuentas, Reporte de Polla.
     - **Configuración:** Datos de la Agencia, Parámetros (Moneda COP/VES/USD, Ancho de papel 58mm/80mm, Multiplicadores).
     - **Mensajes:** Leer Mensajes de la central.
     - **Utilidades:** F4 Calculadora POS, F10 Pantalla Completa.
     - **Actualizar:** Sincronización instantánea de horarios y catálogos.
     - **Salir:** Bloqueo de sesión a pantalla de login.
   - Reloj en tiempo real y contador de Ticket correlativo (`Ticket #00010919`).

3. **Arquitectura de 3 Paneles de Taquilla Rápida:**
   - **Panel Izquierdo (Sorteos y Categorías):**
     - Pestañas: `SIN SIGNO`, `CON SIGNO`, `4 CIFRAS`, `ANIMALITOS`.
     - Buscador reactivo en tiempo real con filtrado instantáneo.
     - Selección múltiple de sorteos mediante casillas (Checkboxes).
     - Botones `Marcar Todos` y `Desmarcar (C)`.
     - Catálogo exhaustivo precargado con todas las operadoras: Táchira (4A, 4B, 4C, 10A, 10B, 10C), Zulia (4A..7C), Triples Caliente, Caracas, Zamora, Ricachona, TriActivo, Astro Sol, Astro Luna, Dorado, Paisita, Chontico, Cafeterito, Sinuano, Culona, Motilón, Antioqueñita, Bogotá, Medellín, Santander, Ruletas de Animalitos (Lotto Activo, La Granjita, Guácharo, Selva Plus, Mega Animal, etc.) y soporte para **"La 5ta"** balota.
   - **Panel Central (Captura Rápida y Teclado Numérico):**
     - Entradas numéricas de alta velocidad tipo LCD: `Número / Nro` (con previsualización instantánea de animalitos y emojis) y `Monto`.
     - Flujo de digitación continua: `Enter` salta de Número a Monto, y `Enter` en Monto agrega la jugada a todos los sorteos marcados, limpia el número y devuelve el foco inmediatamente sin tocar el ratón.
     - Contadores reactivos en vivo: `Triples`, `Terminales` y `Loterías`.
     - Cuadro de comandos rápidos físicos con etiquetas de atajo.
   - **Panel Derecho (Pre-visualización de Ticket):**
     - Emulación de rollo térmico continuo con lista de jugadas, loterías, tipo y montos.
     - Botón de eliminación rápida línea por línea (`×`).
     - Display totalizador en pantalla LCD oscura con fuente verde de alto contraste.
     - Botones de acción directa `IMPRIMIR (+ / /)` y `LIMPIAR (A)`.

4. **Reglas de Negocio, Premiación y Persistencia Local:**
   - Almacenamiento local automático en `localStorage` con aislamiento seguro.
   - Multiplicadores configurables:
     - Triple: `500x`
     - Terminal: `60x`
     - Aproximación de Terminal (+1 / -1): `5x`
     - Animalitos: `30x`
     - 4 Cifras Directo: `4500x` | Combinado: `208x` | La 5ta: `25000x`
     - Astro 4 Cifras + Signo: `40000x` | Astro 3 Cifras + Signo: `1000x`
   - Módulo de carga de números premiados oficiales por fecha y sorteo.
   - Verificador y liquidador automático de premios por ticket o serial con botón de pago y comprobante.
   - Cuadre de caja (Relación Final) con cálculo automático de Ventas Brutas, Anulaciones, Ventas Netas, Premios Pagados, Comisión de Agencia (%) y Saldo Neto a Entregar a la Banca (con exportación a CSV e impresión térmica).

5. **Módulo de Impresión Térmica POS (58mm y 80mm):**
   - Encabezado oficial: **BANCA EL CASTAÑO** - **AGENCIA: 1000 - EL CASTAÑO**.
   - Agrupación automática de jugadas por sorteo y horario para ahorro de papel térmico.
   - Generación de código de barras simulado en SVG tipo Code 128 con serial y correlativo.
   - Opciones para compartir el ticket directamente por **WhatsApp**, descargar en archivo **.TXT** o imprimir mediante el diálogo nativo con estilos de corte `@media print` libres de márgenes.

---

### ⌨️ Atajos de Teclado (Uso Intensivo de Taquilla)

| Tecla / Atajo | Acción |
|---------------|--------|
| **`Enter`** | Navegar entre Número -> Monto -> Agregar Jugada al Pre-Ticket |
| **`+` o `/`** (Teclado Numérico) | **Imprimir Ticket** inmediatamente |
| **`P`** | **Permutas** (Genera todas las permutaciones del número de 3 o 4 cifras) |
| **`S`** | **Series** (Genera serie del 0 al 9 para terminal o centena) |
| **`X`** | **Todos los Signos** (Aplica el número y monto a los 12 signos zodiacales) |
| **`R`** | **Repetir Terminal** (Copia el terminal de la jugada anterior) |
| **`L`** | **Repetir Lotería** (Restaura la última selección de sorteos) |
| **`T`** | **Repetir Ticket** (Carga las jugadas del último ticket emitido) |
| **`C`** | **Desmarcar Loterías** activas |
| **`A`** | **Anular Todo** / Limpiar Pre-Ticket |
| **`M`** | Abrir bandeja de **Mensajes** de la Central |
| **`O`** | Alternar modo **Combinado** (4 cifras) |
| **`F2`** | Volver a la **Venta de Ticket** (cierra ventanas flotantes y enfoca número) |
| **`F3`** | Abrir ventana de **Anular Ticket** |
| **`F4`** | Abrir **Calculadora POS** |
| **`F10`** | Alternar **Pantalla Completa** |
| **`ESC`** | Cerrar modales abiertos o restablecer foco |

---

### 💻 Cómo Ejecutar la Aplicación

#### Opción 1: Directamente en el Navegador (Sin servidor)
1. Abra el archivo `index.html` con cualquier navegador moderno (Google Chrome, Microsoft Edge, Brave o Firefox).
2. En la pantalla de login, presione `Enter` o haga clic en **Aceptar**.
3. ¡Listo! Ya puede operar la taquilla.

#### Opción 2: Usando el Servidor Local Ultraligero de Node.js
```bash
node server.js
```
Abra en su navegador la URL: `http://localhost:3000`

#### Opción 3: Ejecutar como Aplicación de Escritorio con Electron
```bash
electron .
```
