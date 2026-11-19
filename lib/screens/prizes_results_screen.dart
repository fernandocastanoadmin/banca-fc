// lib/screens/prizes_results_screen.dart - Verificador, Pago de Premios y Resultados Oficiales
import 'package:flutter/material.dart';
import '../data/catalogs.dart';
import '../services/firebase_sync_service.dart';

class PrizesResultsScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const PrizesResultsScreen({super.key, required this.cloud});

  @override
  State<PrizesResultsScreen> createState() => _PrizesResultsScreenState();
}

class _PrizesResultsScreenState extends State<PrizesResultsScreen> {
  final _verifyCtrl = TextEditingController();
  Map<String, dynamic>? _foundTicket;
  TicketEvaluationResult? _evalResult;
  String? _searchNote;

  @override
  void dispose() {
    _verifyCtrl.dispose();
    super.dispose();
  }

  Future<void> _verifyTicket([String? queryOverride]) async {
    final q = (queryOverride ?? _verifyCtrl.text).trim();
    if (q.isEmpty) {
      setState(() {
        _searchNote = 'Ingrese número o serial del ticket.';
        _foundTicket = null;
        _evalResult = null;
      });
      return;
    }

    await widget.cloud.pullAndMergeFromFirebase();
    final t = widget.cloud.getTicketByIdOrSerial(q);
    if (!mounted) return;
    if (t == null) {
      setState(() {
        _foundTicket = null;
        _evalResult = null;
        _searchNote = 'Ticket "$q" no encontrado en la base de datos.';
      });
      return;
    }

    final eval = widget.cloud.evaluateTicket(t);
    setState(() {
      _verifyCtrl.text = '${t['ticketId'] ?? q}';
      _foundTicket = t;
      _evalResult = eval;
      _searchNote = null;
    });
  }

  Future<void> _payWinner() async {
    final t = _foundTicket;
    final eval = _evalResult;
    if (t == null || eval == null || eval.totalPrize <= 0) return;
    final cur = '${t['moneda'] ?? 'COP'}';
    final tid = '${t['ticketId'] ?? ''}';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF13221C),
        title: Text('Pagar Premio #$tid'),
        content: Text(
          '¿Confirma pagar ${widget.cloud.formatCurrency(eval.totalPrize, cur)} (Caja $cur) al cliente?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.black,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirmar Pago'),
          ),
        ],
      ),
    );

    if (ok == true) {
      final paid = await widget.cloud.payWinningTicket(tid, eval.totalPrize);
      if (!mounted) return;
      if (paid) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Premio del ticket #$tid marcado como PAGADO.')),
        );
        await _verifyTicket(tid);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final agCode = widget.cloud.loggedAgencyCode ?? '1000';
    final winners = widget.cloud
        .getTickets(onlyAgencyCode: agCode)
        .where((t) => t['estado'] == 'GANADOR' || t['estado'] == 'PAGADO')
        .toList();

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _verifyCtrl,
                onSubmitted: (_) => _verifyTicket(),
                decoration: InputDecoration(
                  hintText: 'Ticket # o Serial...',
                  prefixIcon: const Icon(Icons.qr_code_scanner),
                  filled: true,
                  fillColor: const Color(0xFF111D18),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 54,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.black,
                ),
                onPressed: () => _verifyTicket(),
                child: const Text(
                  'VERIFICAR',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ),
          ],
        ),
        if (_searchNote != null) ...[
          const SizedBox(height: 12),
          Text(_searchNote!, style: const TextStyle(color: Colors.amber)),
        ],
        if (_foundTicket != null && _evalResult != null) ...[
          const SizedBox(height: 14),
          _buildVerificationCard(_foundTicket!, _evalResult!),
        ],
        const SizedBox(height: 18),
        Text(
          'Tickets Premiados de la Agencia (${winners.length})',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14.5,
            color: Color(0xFFFBBF24),
          ),
        ),
        const SizedBox(height: 8),
        if (winners.isEmpty)
          const Card(
            color: Color(0xFF111D18),
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Sin tickets ganadores registrados aún para esta agencia.',
                style: TextStyle(color: Colors.white60),
              ),
            ),
          )
        else
          ...winners.map((w) {
            final cur = '${w['moneda'] ?? 'COP'}';
            final prize = double.tryParse(
                    '${w['premioPagado'] ?? w['premioCalculado'] ?? 0}') ??
                0;
            final isPaid = w['estado'] == 'PAGADO';
            return Card(
              color: const Color(0xFF111D18),
              child: ListTile(
                onTap: () => _verifyTicket('${w['ticketId']}'),
                leading: Icon(
                  isPaid ? Icons.verified : Icons.emoji_events,
                  color: isPaid
                      ? const Color(0xFF4ADE80)
                      : const Color(0xFFFBBF24),
                ),
                title: Text(
                  '#${w['ticketId']} • ${widget.cloud.formatCurrency(prize, cur)}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(
                  '${w['fechaHora'] ?? ''} • ${isPaid ? 'PAGADO' : 'PENDIENTE DE PAGO'}',
                ),
                trailing: const Icon(Icons.chevron_right),
              ),
            );
          }),
      ],
    );
  }

  Widget _buildVerificationCard(
    Map<String, dynamic> ticket,
    TicketEvaluationResult eval,
  ) {
    final cur = '${ticket['moneda'] ?? 'COP'}';
    final canPay = eval.totalPrize > 0 &&
        ticket['estado'] != 'PAGADO' &&
        ticket['estado'] != 'ANULADO';

    return Card(
      color: const Color(0xFF111D18),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF10B981)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Ticket #${ticket['ticketId']}',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Chip(
                  backgroundColor: eval.status == 'GANADOR'
                      ? const Color(0xFFFBBF24)
                      : (eval.status == 'PAGADO'
                          ? const Color(0xFF10B981)
                          : const Color(0xFF1E372D)),
                  label: Text(
                    eval.status,
                    style: TextStyle(
                      color: (eval.status == 'GANADOR' || eval.status == 'PAGADO')
                          ? Colors.black
                          : Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            Text('Serial: ${ticket['serialSeguridad'] ?? ''}'),
            Text('Fecha: ${ticket['fechaHora'] ?? ''}'),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF041A0F),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'PREMIO ($cur):',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    widget.cloud.formatCurrency(eval.totalPrize, cur),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF4ADE80),
                    ),
                  ),
                ],
              ),
            ),
            if (eval.winningPlays.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...eval.winningPlays.map((wp) {
                final p = double.tryParse('${wp['prize'] ?? 0}') ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '⭐ ${wp['lotteryName']}: ${wp['number']} (${wp['multiplier']}x) -> ${widget.cloud.formatCurrency(p, cur)}',
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFFFDE68A)),
                  ),
                );
              }),
            ],
            if (canPay) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _payWinner,
                icon: const Icon(Icons.payments),
                label: const Text(
                  'PAGAR PREMIO AHORA',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class OfficialResultsScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const OfficialResultsScreen({super.key, required this.cloud});

  @override
  State<OfficialResultsScreen> createState() => _OfficialResultsScreenState();
}

class _OfficialResultsScreenState extends State<OfficialResultsScreen> {
  String _selectedDateIso = BancaFcFirebaseService.getTodayIso();
  String _categoryFilter = 'ALL';
  String _resultsFilter = '';
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _refreshResults();
  }

  Future<void> _refreshResults() async {
    if (_loading) return;
    setState(() => _loading = true);
    await widget.cloud.fetchOfficialResultsForDate(_selectedDateIso);
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final current = DateTime.tryParse(_selectedDateIso) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() {
        _selectedDateIso =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
      await _refreshResults();
    }
  }

  @override
  Widget build(BuildContext context) {
    final dayResults = widget.cloud.getResultsForDate(_selectedDateIso);
    final query = _resultsFilter.trim().toLowerCase();

    final items = <Map<String, dynamic>>[];
    dayResults.forEach((lotId, rawVal) {
      final lot = findLotteryById(lotId);
      final catKey = lot?.categoryKey ?? 'sin_signo';
      if (_categoryFilter != 'ALL' && catKey != _categoryFilter) return;

      final r = rawVal is Map
          ? Map<String, dynamic>.from(rawVal)
          : <String, dynamic>{};
      final name = lot?.name ?? lotId;
      if (query.isNotEmpty) {
        final hay =
            '$name $catKey ${r['number'] ?? ''} ${r['animalName'] ?? ''} ${r['sign'] ?? ''}'
                .toLowerCase();
        if (!hay.contains(query)) return;
      }
      final sortMinutes =
          lot != null ? (lot.drawHour24 * 60 + lot.drawMinute) : 720;
      items.add({
        'lotId': lotId,
        'name': name,
        'catKey': catKey,
        'sortMinutes': sortMinutes,
        'result': r,
      });
    });

    items.sort((a, b) {
      final c = (b['sortMinutes'] as int).compareTo(a['sortMinutes'] as int);
      if (c != 0) return c;
      return '${a['name']}'.compareTo('${b['name']}');
    });

    const catOptions = [
      ('ALL', 'TODAS'),
      ('sin_signo', 'SIN SIGNO'),
      ('con_signo', 'CON SIGNO'),
      ('cuatro_cifras', '4 CIFRAS'),
      ('animalitos', 'ANIMALITOS'),
    ];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Resultados Oficiales (Sincronización Automática)',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13.5,
                    color: Color(0xFFFBBF24),
                  ),
                ),
              ),
              Text(
                '${items.length} sorteos',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF4ADE80),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              OutlinedButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_today, size: 16),
                label: Text(_selectedDateIso),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: (v) => setState(() => _resultsFilter = v),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Filtrar lotería, número o animalito...',
                    prefixIcon: const Icon(Icons.search, size: 18),
                    filled: true,
                    fillColor: const Color(0xFF111D18),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                onPressed: _loading ? null : _refreshResults,
                child: _loading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 18),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: catOptions.map((c) {
              final active = _categoryFilter == c.$1;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  selected: active,
                  selectedColor: const Color(0xFF10B981),
                  labelStyle: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: active ? Colors.black : Colors.white,
                  ),
                  label: Text(c.$2),
                  onSelected: (_) => setState(() => _categoryFilter = c.$1),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: items.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'No hay resultados oficiales publicados para esta fecha o filtro.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54),
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (_, idx) {
                    final item = items[idx];
                    final r = item['result'] as Map<String, dynamic>;
                    var numText = '${r['number'] ?? ''}';
                    if (r['sign'] != null && '${r['sign']}'.isNotEmpty) {
                      numText += ' • ${r['sign']}';
                    }
                    if (r['animalName'] != null &&
                        '${r['animalName']}'.isNotEmpty) {
                      numText += ' (${r['animalName']})';
                    }
                    if (r['ball5'] != null && '${r['ball5']}'.isNotEmpty) {
                      numText += ' [5ta: ${r['ball5']}]';
                    }
                    return ListTile(
                      tileColor: const Color(0xFF111D18),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFF1E372D)),
                      ),
                      title: Text(
                        '${item['name']}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13.5,
                        ),
                      ),
                      subtitle: Text(
                        '${'${item['catKey']}'.toUpperCase()} • ${r['timestamp'] ?? ''} • ${r['origen'] ?? 'OFICIAL'}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.white54,
                        ),
                      ),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF064E3B),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          numText,
                          style: const TextStyle(
                            color: Color(0xFF4ADE80),
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
