// lib/screens/cashier_screen.dart - Relación Final / Cuadre de Caja Independiente por Moneda
import 'package:flutter/material.dart';
import '../services/firebase_sync_service.dart';

class CashierScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const CashierScreen({super.key, required this.cloud});

  @override
  State<CashierScreen> createState() => _CashierScreenState();
}

class _CashierScreenState extends State<CashierScreen> {
  String _selectedCurrency = 'COP';
  String _selectedDateIso = BancaFcFirebaseService.getTodayIso();

  @override
  void initState() {
    super.initState();
    _selectedCurrency = widget.cloud.activeCurrency;
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final agCode = widget.cloud.loggedAgencyCode ?? '1000';
    final allowed = widget.cloud.getAllowedCurrenciesForAgency(agCode);
    if (!allowed.contains(_selectedCurrency) && allowed.isNotEmpty) {
      _selectedCurrency = allowed.first;
    }

    final agencyTickets = widget.cloud.getTickets(onlyAgencyCode: agCode).where((t) {
      return widget.cloud.extractTicketDateIso(t) == _selectedDateIso;
    }).toList();

    final box = widget.cloud.calculateCurrencyBoxMetrics(
      agencyTickets,
      _selectedCurrency,
    );

    final utilPositive = box.bancaUtility >= 0;

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.calendar_today, size: 16),
              label: Text(_selectedDateIso),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['COP', 'VES', 'USD'].map((cur) {
                    final active = _selectedCurrency == cur;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        selected: active,
                        selectedColor: const Color(0xFF10B981),
                        backgroundColor: const Color(0xFF111D18),
                        labelStyle: TextStyle(
                          color: active ? Colors.black : Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                        label: Text(cur),
                        onSelected: (_) => setState(() => _selectedCurrency = cur),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: utilPositive
                  ? [const Color(0xFF064E3B), const Color(0xFF0B241A)]
                  : [const Color(0xFF7F1D1D), const Color(0xFF280D0D)],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: utilPositive ? const Color(0xFF10B981) : Colors.redAccent,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SALDO NETO A ENTREGAR ($_selectedCurrency)',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.cloud.formatCurrency(box.bancaUtility, _selectedCurrency),
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  fontFamily: 'monospace',
                  color: utilPositive
                      ? const Color(0xFF4ADE80)
                      : const Color(0xFFFCA5A5),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${box.activeCount} tickets activos • ${box.voidCount} anulados',
                style: const TextStyle(fontSize: 12, color: Colors.white70),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: MediaQuery.of(context).size.width >= 700 ? 3 : 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.8,
          children: [
            _metricCard(
              'Ventas Brutas',
              widget.cloud.formatCurrency(box.gross, _selectedCurrency),
              Colors.white,
            ),
            _metricCard(
              'Anulaciones',
              widget.cloud.formatCurrency(box.voided, _selectedCurrency),
              const Color(0xFFF87171),
            ),
            _metricCard(
              'Ventas Netas',
              widget.cloud.formatCurrency(box.net, _selectedCurrency),
              const Color(0xFF60A5FA),
            ),
            _metricCard(
              'Comisión (${box.commissionPct}%)',
              widget.cloud.formatCurrency(box.commission, _selectedCurrency),
              const Color(0xFFFBBF24),
            ),
            _metricCard(
              'Premios Pagados (${box.paidCount})',
              widget.cloud.formatCurrency(box.paidPrizes, _selectedCurrency),
              const Color(0xFF4ADE80),
            ),
            _metricCard(
              'Pend. por Pagar (${box.winnerPendingCount})',
              widget.cloud.formatCurrency(box.pendingPrizes, _selectedCurrency),
              const Color(0xFFFDE047),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Card(
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
                const Text(
                  'Desglose de Ventas Netas por Categoría',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 10),
                _catRow(
                  'Sin Signo (Triples / Terminales)',
                  box.categoryCounts['sin_signo'] ?? 0,
                  box.categoryAmounts['sin_signo'] ?? 0,
                ),
                _catRow(
                  'Con Signo (Zodiacales / Astros)',
                  box.categoryCounts['con_signo'] ?? 0,
                  box.categoryAmounts['con_signo'] ?? 0,
                ),
                _catRow(
                  '4 Cifras / Chances / 5ta',
                  box.categoryCounts['cuatro_cifras'] ?? 0,
                  box.categoryAmounts['cuatro_cifras'] ?? 0,
                ),
                _catRow(
                  'Animalitos / Frutas',
                  box.categoryCounts['animalitos'] ?? 0,
                  box.categoryAmounts['animalitos'] ?? 0,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _metricCard(String title, String value, Color valColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1E372D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, color: Colors.white60),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: valColor,
                fontFamily: 'monospace',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _catRow(String label, int count, double amount) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '$label ($count)',
              style: const TextStyle(fontSize: 12.5, color: Colors.white70),
            ),
          ),
          Text(
            widget.cloud.formatCurrency(amount, _selectedCurrency),
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Color(0xFF4ADE80),
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
