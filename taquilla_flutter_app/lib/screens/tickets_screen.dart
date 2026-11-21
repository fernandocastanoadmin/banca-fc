// lib/screens/tickets_screen.dart - Historial, Reimpresión, WhatsApp y Anulación de Tickets
import 'package:flutter/material.dart';
import '../services/firebase_sync_service.dart';
import '../widgets/receipt_dialog.dart';

class TicketsScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const TicketsScreen({super.key, required this.cloud});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  final _searchCtrl = TextEditingController();
  String _statusFilter = 'TODOS';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirmCancel(Map<String, dynamic> ticket) async {
    final tid = '${ticket['ticketId'] ?? ''}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF13221C),
        title: Text('Anular Ticket #$tid'),
        content: Text(
          '¿Confirma la anulación del Ticket #$tid por ${widget.cloud.formatCurrency(double.tryParse('${ticket['total'] ?? 0}') ?? 0, '${ticket['moneda'] ?? 'COP'}')}?\n\nEsta acción se sincronizará con la nube de Banca El Castaño.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sí, Anular'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final ok = await widget.cloud.cancelTicket(tid);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ok
                ? 'Ticket #$tid anulado y sincronizado en Firebase.'
                : 'No se encontró el ticket para anular.',
          ),
        ),
      );
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'GANADOR':
        return const Color(0xFFFBBF24);
      case 'PAGADO':
        return const Color(0xFF4ADE80);
      case 'ANULADO':
        return const Color(0xFFF87171);
      default:
        return const Color(0xFF60A5FA);
    }
  }

  @override
  Widget build(BuildContext context) {
    final agCode = widget.cloud.loggedAgencyCode ?? '1000';
    final allAgencyTickets = widget.cloud.getTickets(onlyAgencyCode: agCode);
    final q = _searchCtrl.text.trim().toLowerCase();

    final filtered = allAgencyTickets.where((t) {
      final estado = '${t['estado'] ?? 'ACTIVO'}'.toUpperCase();
      if (_statusFilter != 'TODOS' && estado != _statusFilter) return false;
      if (q.isEmpty) return true;
      final tid = '${t['ticketId'] ?? ''}'.toLowerCase();
      final serial = '${t['serialSeguridad'] ?? ''}'.toLowerCase();
      return tid.contains(q) || serial.contains(q);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Buscar por Ticket # o Serial...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() {});
                      },
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFF111D18),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: ['TODOS', 'ACTIVO', 'GANADOR', 'PAGADO', 'ANULADO'].map((st) {
              final active = _statusFilter == st;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  selected: active,
                  selectedColor: const Color(0xFF10B981),
                  backgroundColor: const Color(0xFF111D18),
                  labelStyle: TextStyle(
                    color: active ? Colors.black : Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                  label: Text(st),
                  onSelected: (_) => setState(() => _statusFilter = st),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text(
                    'No hay tickets registrados con ese filtro.',
                    style: TextStyle(color: Colors.white54),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => widget.cloud.pullAndMergeFromFirebase(),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, idx) {
                      final t = filtered[idx];
                      final estado = '${t['estado'] ?? 'ACTIVO'}'.toUpperCase();
                      final cur = '${t['moneda'] ?? 'COP'}';
                      final total = double.tryParse('${t['total'] ?? 0}') ?? 0;
                      final items = (t['items'] as List? ?? []);
                      final color = _statusColor(estado);

                      return Card(
                        color: const Color(0xFF111D18),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: const BorderSide(color: Color(0xFF1E372D)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '#${t['ticketId'] ?? ''}',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFFFBBF24),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: color.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: color.withOpacity(0.6)),
                                    ),
                                    child: Text(
                                      estado,
                                      style: TextStyle(
                                        color: color,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    widget.cloud.formatCurrency(total, cur),
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF4ADE80),
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Serial: ${t['serialSeguridad'] ?? ''} • ${items.length} jugadas',
                                style: const TextStyle(fontSize: 12, color: Colors.white70),
                              ),
                              Text(
                                '${t['fechaHora'] ?? ''} • Caja $cur',
                                style: const TextStyle(fontSize: 11.5, color: Colors.white54),
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                children: [
                                  FilledButton.tonalIcon(
                                    onPressed: () => showTicketReceiptDialog(
                                      context,
                                      widget.cloud,
                                      t,
                                      isCopy: true,
                                    ),
                                    icon: const Icon(Icons.receipt_long, size: 16),
                                    label: const Text('Ver / WhatsApp'),
                                  ),
                                  if (estado != 'ANULADO' && estado != 'PAGADO')
                                    OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(0xFFF87171),
                                        side: const BorderSide(
                                          color: Color(0xFFF87171),
                                        ),
                                      ),
                                      onPressed: () => _confirmCancel(t),
                                      icon: const Icon(Icons.cancel_outlined, size: 16),
                                      label: const Text('Anular'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
