// lib/screens/cloud_config_screen.dart - Nube Firebase, Moneda, Mensajes y Sesión
import 'package:flutter/material.dart';
import '../services/firebase_sync_service.dart';

class CloudConfigScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const CloudConfigScreen({super.key, required this.cloud});

  @override
  State<CloudConfigScreen> createState() => _CloudConfigScreenState();
}

class _CloudConfigScreenState extends State<CloudConfigScreen> {
  late final TextEditingController _urlCtrl;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _urlCtrl = TextEditingController(text: widget.cloud.databaseUrl);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveAndReconnect() async {
    setState(() => _syncing = true);
    final ok = await widget.cloud.updateFirebaseUrl(_urlCtrl.text);
    if (!mounted) return;
    setState(() => _syncing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Sincronización en vivo activa con Firebase.'
              : (widget.cloud.lastError ?? 'No se pudo conectar.'),
        ),
      ),
    );
  }

  Future<void> _syncNow() async {
    setState(() => _syncing = true);
    final ok = await widget.cloud.pullAndMergeFromFirebase(isInitialConnect: true);
    if (!mounted) return;
    setState(() => _syncing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Datos actualizados desde la nube (${widget.cloud.lastSyncClock ?? ''}).'
              : (widget.cloud.lastError ?? 'Error al sincronizar.'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ag = widget.cloud.activeAgency;
    final agCode = widget.cloud.loggedAgencyCode ?? '1000';
    final allowedCurrencies = widget.cloud.getAllowedCurrenciesForAgency(agCode);
    final messages = widget.cloud.getMessages();

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Card(
          color: const Color(0xFF111D18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF1E372D)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Conexión a Nube Compartida (Firebase)',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: Color(0xFFFBBF24),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Estado: ${widget.cloud.status.name.toUpperCase()} • Última sync: ${widget.cloud.lastSyncClock ?? 'Pendiente'}',
                  style: const TextStyle(fontSize: 12.5, color: Colors.white70),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _urlCtrl,
                  decoration: InputDecoration(
                    labelText: 'URL Realtime Database',
                    filled: true,
                    fillColor: const Color(0xFF0B1410),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.black,
                        ),
                        onPressed: _syncing ? null : _saveAndReconnect,
                        icon: const Icon(Icons.cloud_upload),
                        label: const Text('Guardar URL'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _syncing ? null : _syncNow,
                        icon: const Icon(Icons.sync),
                        label: const Text('Sincronizar'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: const Color(0xFF111D18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF1E372D)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Taquilla Activa: $agCode - ${ag?['name'] ?? 'EL CASTAÑO'}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                ),
                const SizedBox(height: 4),
                Text(
                  'Encargado: ${ag?['manager'] ?? 'El Castaño'} • Comisión: ${widget.cloud.getEffectiveCommissionForAgency(agCode)}%',
                  style: const TextStyle(fontSize: 12, color: Colors.white60),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Moneda Autorizada de Venta:',
                  style: TextStyle(fontSize: 12.5, color: Colors.white70),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: allowedCurrencies.map((c) {
                    final active = widget.cloud.activeCurrency == c;
                    return ChoiceChip(
                      selected: active,
                      selectedColor: const Color(0xFF10B981),
                      labelStyle: TextStyle(
                        color: active ? Colors.black : Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                      label: Text(c),
                      onSelected: (_) => widget.cloud.setActiveCurrency(c),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: const Color(0xFF111D18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF1E372D)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Mensajes de la Central',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                ),
                const SizedBox(height: 8),
                if (messages.isEmpty)
                  const Text(
                    'Sin circulares registradas.',
                    style: TextStyle(color: Colors.white54),
                  )
                else
                  ...messages.take(10).map((m) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0B1410),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${m['subject'] ?? 'Aviso'}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFFBBF24),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${m['body'] ?? ''}',
                            style: const TextStyle(fontSize: 12.5),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${m['from'] ?? ''} • ${m['date'] ?? ''}',
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: Colors.white54,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 50,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFF87171),
              side: const BorderSide(color: Color(0xFFF87171)),
            ),
            onPressed: () => widget.cloud.logout(),
            icon: const Icon(Icons.logout),
            label: const Text(
              'CERRAR SESIÓN DE TAQUILLA',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }
}
