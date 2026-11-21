# Banca El Castaño Taquilla App (Flutter / Android)

Proyecto independiente en **Flutter** para operar la taquilla de **Banca El Castaño** desde teléfonos y tablets Android con interfaz moderna táctil, conectado en tiempo real a la misma nube Firebase del sistema central.

## 🔗 Conexión a la Misma Nube
- Endpoint por defecto: `https://banca-fc-castano-default-rtdb.firebaseio.com/banca_fc_master.json`
- Sincroniza automáticamente cada 3 segundos y al instante al emitir tickets, anular tickets o pagar premios.
- Usa exactamente la misma estructura y fusión sin pérdida de tickets que el sistema POS de escritorio y el Panel Administrativo.
- Desde la pantalla de Login o en la pestaña **Nube** puede cambiar la URL de Firebase si utiliza otra instancia.

## 📱 Funcionalidades Incluidas
1. **Login por Agencia / Taquilla**: Valida estado (`ACTIVA` / `SUSPENDIDA`), contraseña y monedas autorizadas (`COP`, `VES`, `USD`).
2. **Vender (POS Touch)**:
   - 4 categorías oficiales: `SIN SIGNO`, `CON SIGNO`, `4 CIFRAS` (con `La 5ta Balota`, `Combinado` y `Toda la Semana`) y `ANIMALITOS` (tablero visual interactivo con emojis de animalitos y Fruta Gana).
   - Regla automática de cierre `-5 minutos` antes de cada sorteo.
   - Teclado numérico táctil + montos rápidos + comandos `Permutas`, `Series 0-9`, `Repetir Terminal` y `Repetir Ticket` + soporte de teclado físico.
   - Validación de topes de riesgo por agencia/sorteo/número.
   - Emisión con recibo térmico y envío directo por **WhatsApp**, compartir o copiar.
3. **Tickets**: Búsqueda por correlativo/serial, filtro por estado, vista de copia y anulación en vivo.
4. **Premios y Resultados**: Verificación y pago de tickets ganadores (`PAGADO` en Firebase) + consulta de resultados oficiales publicados desde el Panel Administrativo.
5. **Cuadre de Caja**: Relación financiera independiente por moneda (`COP`, `VES`, `USD`) sin mezclar divisas.

## 🛠️ Cómo Generar el Archivo `.apk`

### Opción 1: En este PC Windows
1. Instale Flutter SDK y Android Studio (`flutter doctor` sin errores en Android toolchain).
2. Ejecute doble clic en `COMPILAR_APK.bat` (o en consola `flutter pub get && flutter build apk --release`).
3. El instalador quedará en:
   `build/app/outputs/flutter-apk/app-release.apk`

### Opción 2: Automático en la Nube (GitHub Actions, sin instalar Android Studio)
1. Suba el repositorio a GitHub.
2. En la pestaña **Actions**, ejecute el flujo **"Compilar APK - Banca El Castaño"**.
3. Descargue el artefacto `BancaFC-Taquilla-App-APK` listo para instalar en cualquier Android.
