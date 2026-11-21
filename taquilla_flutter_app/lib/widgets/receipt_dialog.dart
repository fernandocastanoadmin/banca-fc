// lib/widgets/receipt_dialog.dart - Vista de Recibo Térmico y Compartir por WhatsApp
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/firebase_sync_service.dart';

Future<void> showTicketReceiptDialog(
  BuildContext context,
  BancaFcFirebaseService cloud,
  Map<String, dynamic> ticket, {
  bool isCopy = false,
}) async {
  final cur = '${ticket['moneda'] ?? cloud.activeCurrency}';
  final items = (ticket['items'] as List? ?? [])
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();

  final grouped = <String, List<Map<String, dynamic>>>{};
  for (final it in items) {
    final name = '${it['lotteryName'] ?? it['lotteryId'] ?? 'Sorteo'}';
    grouped.putIfAbsent(name, () => []).add(it);
  }

  final rawSerial = '${ticket['serialSeguridad'] ?? ''}';
  final maskedSerial = isCopy && rawSerial.contains('-')
      ? rawSerial.replaceFirstMapped(
          RegExp(r'^(\d{4})-(\d{4})-(\d{4})$'),
          (m) => '${m[1]}-****-${m[3]}',
        )
      : rawSerial;

  final total = double.tryParse('${ticket['total'] ?? 0}') ?? 0;
  final estado = '${ticket['estado'] ?? 'ACTIVO'}';

  await showDialog<void>(
    context: context,
    builder: (ctx) {
      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFDF7),
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(color: Colors.black54, blurRadius: 24, offset: Offset(0, 12)),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Color(0xFF064E3B),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.receipt_long, color: Color(0xFFFBBF24)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        isCopy
                            ? 'Copia Ticket #${ticket['ticketId']}'
                            : 'Ticket Emitido #${ticket['ticketId']}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: DefaultTextStyle(
                    style: const TextStyle(
                      color: Color(0xFF111827),
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (estado == 'ANULADO')
                          Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.red, width: 2),
                            ),
                            child: const Text(
                              '*** TICKET ANULADO ***',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.red,
                                fontWeight: FontWeight.w900,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        const Text(
                          'BANCA EL CASTAÑO',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                        const Text(
                          'SEGURO TE PAGA (1000 SORTEOS)',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                        const Divider(color: Colors.black54),
                        Text('AGENCIA: ${ticket['agencia'] ?? ''}'),
                        Text('TAQUILLA: ${ticket['usuario'] ?? ''}'),
                        Text('FECHA: ${ticket['fechaHora'] ?? ''}'),
                        Text(
                          'TICKET NRO: #${ticket['ticketId'] ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text('SERIAL: $maskedSerial'),
                        Text(
                          'ESTADO: $estado',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: estado == 'GANADOR' || estado == 'PAGADO'
                                ? const Color(0xFF15803D)
                                : (estado == 'ANULADO'
                                    ? Colors.red
                                    : const Color(0xFF111827)),
                          ),
                        ),
                        const Divider(color: Colors.black54),
                        ...grouped.entries.map((entry) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  '*** ${entry.key.toUpperCase()} ***',
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                ...entry.value.map((p) {
                                  var label = '${p['number'] ?? ''}';
                                  if (p['sign'] != null && '${p['sign']}'.isNotEmpty) {
                                    label += '-${p['sign']}';
                                  }
                                  if (p['animalName'] != null &&
                                      '${p['animalName']}'.isNotEmpty) {
                                    label += ' ${'${p['animalName']}'.toUpperCase()}';
                                  }
                                  if (p['is5ta'] == true) label += ' [5ta]';
                                  if (p['isCombinado'] == true) label += ' [Comb]';
                                  final amt =
                                      double.tryParse('${p['amount'] ?? 0}') ?? 0;
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 1.5),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            label,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                        Text(
                                          cloud.formatCurrency(amt, cur),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                              ],
                            ),
                          );
                        }),
                        const Divider(color: Colors.black54),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('JUGADAS: ${items.length}'),
                            Text(
                              'TOTAL: ${cloud.formatCurrency(total, cur)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                        const Divider(color: Colors.black54),
                        const Text(
                          'Verifique su ticket antes de retirarse.\nCaduca a los tres (3) días continuos.\n¡BUENA SUERTE!',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 10.5, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
                ),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                      ),
                      icon: const Icon(Icons.chat, size: 18),
                      label: const Text('WhatsApp'),
                      onPressed: () async {
                        final text = cloud.generatePlainTextReceipt(ticket);
                        final uri = Uri.parse(
                          'https://api.whatsapp.com/send?text=${Uri.encodeComponent(text)}',
                        );
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        } else {
                          await Share.share(text);
                        }
                      },
                    ),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF111827),
                      ),
                      icon: const Icon(Icons.share, size: 18),
                      label: const Text('Compartir'),
                      onPressed: () {
                        Share.share(cloud.generatePlainTextReceipt(ticket));
                      },
                    ),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF111827),
                      ),
                      icon: const Icon(Icons.copy, size: 18),
                      label: const Text('Copiar'),
                      onPressed: () {
                        Clipboard.setData(
                          ClipboardData(text: cloud.generatePlainTextReceipt(ticket)),
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Recibo copiado al portapapeles'),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
