// lib/screens/pos_sell_screen.dart - Taquilla Táctil Moderna (Móvil / Tablet + Teclado Físico)
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/catalogs.dart';
import '../services/firebase_sync_service.dart';
import '../widgets/receipt_dialog.dart';

class PosSellScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const PosSellScreen({super.key, required this.cloud});

  @override
  State<PosSellScreen> createState() => _PosSellScreenState();
}

class _PosSellScreenState extends State<PosSellScreen> {
  String _category = 'sin_signo';
  final Set<String> _selectedLotteries = {};
  List<String> _lastLotterySelection = [];
  final List<Map<String, dynamic>> _preTicketItems = [];

  final _searchCtrl = TextEditingController();
  final _numCtrl = TextEditingController();
  final _montoCtrl = TextEditingController(text: '1000');
  final _numFocus = FocusNode();
  final _montoFocus = FocusNode();

  bool _editingAmount = false;
  String _selectedSign = 'ARI';
  bool _is5taActive = false;
  bool _isCombinadoActive = false;
  bool _showAllWeekLotteries = false;

  String _lastNumberPlayed = '';
  double _lastMontoPlayed = 1000;
  bool _submitting = false;
  Timer? _autoCloseTimer;

  @override
  void initState() {
    super.initState();
    _autoCloseTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _pruneClosedSelectedLotteries();
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _autoCloseTimer?.cancel();
    _searchCtrl.dispose();
    _numCtrl.dispose();
    _montoCtrl.dispose();
    _numFocus.dispose();
    _montoFocus.dispose();
    super.dispose();
  }

  void _pruneClosedSelectedLotteries() {
    if (!widget.cloud.serverClockVerified || widget.cloud.isDeviceClockTampered) {
      _selectedLotteries.clear();
      return;
    }
    final now = widget.cloud.officialCaracasNow;
    _selectedLotteries.removeWhere((id) {
      final lot = findLotteryById(id);
      if (lot == null) return true;
      return !isLotteryOpenForSale(
        lot,
        nowDate: now,
        showAllWeekDays: _showAllWeekLotteries,
      );
    });
  }

  List<LotteryDraw> _getOpenLotteries() {
    if (!widget.cloud.serverClockVerified || widget.cloud.isDeviceClockTampered) {
      return [];
    }
    final list = lotteryCatalogs[_category] ?? [];
    final now = widget.cloud.officialCaracasNow;
    final query = _searchCtrl.text.trim().toLowerCase();
    return list.where((lot) {
      final open = isLotteryOpenForSale(
        lot,
        nowDate: now,
        showAllWeekDays: _showAllWeekLotteries,
      );
      if (!open) return false;
      if (query.isEmpty) return true;
      return lot.name.toLowerCase().contains(query) ||
          lot.id.toLowerCase().contains(query) ||
          lot.time12.toLowerCase().contains(query);
    }).toList();
  }

  void _setCategory(String cat) {
    setState(() {
      _category = cat;
      _selectedLotteries.clear();
      _editingAmount = false;
    });
  }

  void _selectAllOpen() {
    final open = _getOpenLotteries();
    setState(() {
      for (final lot in open) {
        _selectedLotteries.add(lot.id);
      }
    });
  }

  void _clearSelectedLotteries() {
    setState(() {
      if (_selectedLotteries.isNotEmpty) {
        _lastLotterySelection = _selectedLotteries.toList();
      }
      _selectedLotteries.clear();
    });
  }

  void _repeatLastLotteries() {
    if (_lastLotterySelection.isEmpty) {
      _showToast('No hay selección previa de loterías');
      return;
    }
    final openIds = _getOpenLotteries().map((e) => e.id).toSet();
    setState(() {
      _selectedLotteries.clear();
      for (final id in _lastLotterySelection) {
        if (openIds.contains(id)) _selectedLotteries.add(id);
      }
    });
  }

  void _onKeypadTap(String key) {
    final ctrl = _editingAmount ? _montoCtrl : _numCtrl;
    if (key == 'CLEAR') {
      ctrl.clear();
    } else if (key == 'BACK') {
      if (ctrl.text.isNotEmpty) {
        ctrl.text = ctrl.text.substring(0, ctrl.text.length - 1);
      }
    } else {
      final maxNumDigits = (_category == 'cuatro_cifras' && _is5taActive) ? 5 : 4;
      if (!_editingAmount && ctrl.text.length >= maxNumDigits) return;
      if (_editingAmount && ctrl.text == '0') {
        ctrl.text = key;
      } else {
        ctrl.text = '${ctrl.text}$key';
      }
    }
    ctrl.selection = TextSelection.collapsed(offset: ctrl.text.length);
    setState(() {});
  }

  String? _validateNonAnimalitoNumber(
    String cleanNum,
    LotteryDraw lot,
    bool is5taActive,
  ) {
    if (!RegExp(r'^\d+$').hasMatch(cleanNum)) {
      return '⛔ Ingrese solo dígitos numéricos válidos.';
    }
    if (_category == 'sin_signo') {
      if (lot.type == 'terminal') {
        if (!RegExp(r'^\d{2}$').hasMatch(cleanNum)) {
          return '⛔ En ${lot.name} (Terminal) debe ingresar exactamente 2 cifras (ej: 08). No se permite 1 solo número.';
        }
        return null;
      }
      if (!RegExp(r'^\d{2,3}$').hasMatch(cleanNum)) {
        return '⛔ No está permitido jugar 1 solo número. Ingrese 2 cifras para Terminal (ej: 08) o 3 cifras para Triple (ej: 008).';
      }
      return null;
    }
    if (_category == 'con_signo') {
      if (lot.type == 'astro') {
        if (!RegExp(r'^\d{3,4}$').hasMatch(cleanNum)) {
          return '⛔ En ${lot.name} debe ingresar 3 cifras (ej: 008) o 4 cifras (ej: 0008). No se permite 1 ni 2 dígitos.';
        }
        return null;
      }
      if (!RegExp(r'^\d{3}$').hasMatch(cleanNum)) {
        return '⛔ No está permitido jugar menos de 3 cifras en Con Signo (${lot.name}). Ingrese exactamente 3 cifras (ej: 008).';
      }
      return null;
    }
    if (_category == 'cuatro_cifras') {
      if (lot.id == 'CASH_THREE_DIA' || lot.id == 'CASH_THREE_NOCHE') {
        if (!RegExp(r'^\d{3}$').hasMatch(cleanNum)) {
          return '⛔ En ${lot.name} debe ingresar exactamente 3 cifras (ej: 008).';
        }
        return null;
      }
      if (is5taActive && lot.has5ta) {
        if (!RegExp(r'^\d{4,5}$').hasMatch(cleanNum)) {
          return '⛔ Con La 5ta activa ingrese 4 cifras (ej: 0008) o 5 cifras (ej: 00085).';
        }
        return null;
      }
      if (!RegExp(r'^\d{4}$').hasMatch(cleanNum)) {
        return '⛔ No está permitido jugar menos de 4 cifras en ${lot.name}. Ingrese exactamente 4 cifras (ej: 0008).';
      }
      return null;
    }
    return null;
  }

  bool _addPlayItem(
    String numberStr,
    double amountVal, {
    String? signOverride,
    bool silent = false,
  }) {
    if (_selectedLotteries.isEmpty) {
      if (!silent) _showToast('Seleccione al menos un sorteo abierto');
      return false;
    }

    final cleanInput = numberStr.trim();
    if (cleanInput.isEmpty) {
      if (!silent) _showToast('Ingrese un número o animalito');
      return false;
    }
    if (amountVal <= 0) {
      if (!silent) _showToast('Ingrese un monto válido mayor a 0');
      return false;
    }

    if (!widget.cloud.serverClockVerified) {
      if (!silent) _showToast('⏳ Verificando hora oficial con Google Firebase...');
      return false;
    }
    if (widget.cloud.isDeviceClockTampered) {
      if (!silent) {
        _showToast('🚨 Reloj manipulado. Active hora automática para vender.');
      }
      return false;
    }

    final now = widget.cloud.officialCaracasNow;
    final openList = _getOpenLotteries();
    final selectedLots =
        openList.where((l) => _selectedLotteries.contains(l.id)).toList();

    if (selectedLots.isEmpty) {
      _pruneClosedSelectedLotteries();
      if (!silent) _showToast('Los sorteos seleccionados cerraron (-5 min)');
      setState(() {});
      return false;
    }

    var addedCount = 0;
    final omittedByRange = <String>[];
    final digitErrors = <Map<String, String>>[];
    for (final lot in selectedLots) {
      if (!isLotteryOpenForSale(
        lot,
        nowDate: now,
        showAllWeekDays: _showAllWeekLotteries,
      )) {
        _selectedLotteries.remove(lot.id);
        continue;
      }

      var playType = 'triple';
      String? animalName;
      var cleanNumber = cleanInput;
      final itemIs5ta = _category == 'cuatro_cifras' && lot.has5ta && _is5taActive;

      if (_category == 'animalitos') {
        playType = 'animalito';
        final info = getAnimalOrFruitInfo(cleanNumber, lotteryIdOrName: lot.id);
        if (!info.valid) {
          omittedByRange.add('${lot.name} (máx. ${info.maxNum})');
          continue;
        }
        cleanNumber = info.number;
        animalName = info.name;
      } else {
        final errReason =
            _validateNonAnimalitoNumber(cleanNumber, lot, itemIs5ta);
        if (errReason != null) {
          digitErrors.add({'lotName': lot.name, 'reason': errReason});
          continue;
        }
        if (_category == 'con_signo') {
          playType = lot.type == 'astro' ? 'astro' : 'zodiac';
        } else if (_category == 'cuatro_cifras') {
          playType = 'cuatro_cifras';
        } else {
          playType = (lot.type == 'terminal' || cleanNumber.length == 2)
              ? 'terminal'
              : 'triple';
        }
      }

      _preTicketItems.add({
        'uid': '${DateTime.now().microsecondsSinceEpoch}_$addedCount',
        'lotteryId': lot.id,
        'lotteryName': lot.name,
        'drawTime12': lot.time12,
        'number': cleanNumber,
        'type': playType,
        'sign': _category == 'con_signo' ? (signOverride ?? _selectedSign) : null,
        'animalName': animalName,
        'is5ta': itemIs5ta,
        'isCombinado': _category == 'cuatro_cifras' && _isCombinadoActive,
        'amount': amountVal,
      });
      addedCount++;
    }

    if (addedCount == 0) {
      if (!silent) {
        if (digitErrors.isNotEmpty) {
          _showToast(digitErrors.first['reason']!);
        } else {
          _showToast('⛔ Número $cleanInput fuera del límite oficial de la operadora');
        }
      }
      return false;
    }

    if (omittedByRange.isNotEmpty && !silent) {
      _showToast('Cargado en $addedCount sorteo(s). Omitido en: ${omittedByRange.join(', ')}');
    } else if (digitErrors.isNotEmpty && !silent) {
      _showToast('Cargado en $addedCount sorteo(s). Omitido en: ${digitErrors.map((e) => e['lotName']).join(', ')}');
    }

    _lastNumberPlayed = cleanInput;
    _lastMontoPlayed = amountVal;
    _lastLotterySelection = _selectedLotteries.toList();
    return true;
  }

  void _handleAddPlayPressed() {
    final monto = double.tryParse(_montoCtrl.text.trim()) ?? 0;
    final ok = _addPlayItem(_numCtrl.text, monto);
    if (ok) {
      setState(() {
        _numCtrl.clear();
        _editingAmount = false;
      });
    }
  }

  List<String> _generatePermutas(String numStr) {
    final chars = numStr.split('');
    final res = <String>{};
    void permute(List<String> arr, List<String> memo) {
      if (arr.isEmpty) {
        res.add(memo.join());
        return;
      }
      for (var i = 0; i < arr.length; i++) {
        final nextArr = List<String>.from(arr)..removeAt(i);
        permute(nextArr, [...memo, arr[i]]);
      }
    }

    permute(chars, []);
    return res.toList();
  }

  void _executePermutas() {
    final numStr =
        (_numCtrl.text.trim().isNotEmpty ? _numCtrl.text : _lastNumberPlayed)
            .trim();
    final monto = double.tryParse(_montoCtrl.text.trim()) ?? _lastMontoPlayed;
    if (numStr.length < 3) {
      _showToast('Ingrese 3 o 4 cifras para permutar');
      return;
    }
    if (_selectedLotteries.isEmpty) {
      _showToast('Seleccione al menos un sorteo');
      return;
    }
    final perms = _generatePermutas(numStr);
    if (perms.isEmpty || !_addPlayItem(perms.first, monto, silent: false)) {
      return;
    }
    for (final p in perms.skip(1)) {
      _addPlayItem(p, monto, silent: true);
    }
    setState(() => _numCtrl.clear());
    _showToast('Se agregaron ${perms.length} permutas de $numStr');
  }

  void _executeSeries() {
    final numStr =
        (_numCtrl.text.trim().isNotEmpty ? _numCtrl.text : _lastNumberPlayed)
            .trim();
    final monto = double.tryParse(_montoCtrl.text.trim()) ?? _lastMontoPlayed;
    if (numStr.length != 2 && numStr.length != 3) {
      _showToast('Ingrese 2 o 3 dígitos para serie del 0 al 9');
      return;
    }
    if (_selectedLotteries.isEmpty) {
      _showToast('Seleccione al menos un sorteo');
      return;
    }
    final term = numStr.substring(numStr.length - 2);
    if (!_addPlayItem('0$term', monto, silent: false)) {
      return;
    }
    for (var i = 1; i <= 9; i++) {
      _addPlayItem('$i$term', monto, silent: true);
    }
    setState(() => _numCtrl.clear());
    _showToast('Serie 0-9 generada para terminal $term');
  }

  void _executeAllSigns() {
    final numStr =
        (_numCtrl.text.trim().isNotEmpty ? _numCtrl.text : _lastNumberPlayed)
            .trim();
    final monto = double.tryParse(_montoCtrl.text.trim()) ?? _lastMontoPlayed;
    if (numStr.isEmpty) {
      _showToast('Ingrese un número para apostar con los 12 signos');
      return;
    }
    if (_category != 'con_signo') {
      _setCategory('con_signo');
    }
    if (_selectedLotteries.isEmpty) {
      _showToast('Seleccione un sorteo zodiacal o astro');
      return;
    }
    if (!_addPlayItem(numStr, monto, signOverride: zodiacSigns.first.code, silent: false)) {
      return;
    }
    for (final s in zodiacSigns.skip(1)) {
      _addPlayItem(numStr, monto, signOverride: s.code, silent: true);
    }
    setState(() => _numCtrl.clear());
    _showToast('12 signos agregados para el número $numStr');
  }

  void _executeRepeatTerminal() {
    if (_lastNumberPlayed.isEmpty) {
      _showToast('Sin jugada previa para repetir terminal');
      return;
    }
    final term = _lastNumberPlayed.length >= 2
        ? _lastNumberPlayed.substring(_lastNumberPlayed.length - 2)
        : _lastNumberPlayed;
    setState(() {
      _numCtrl.text = term;
      _editingAmount = true;
    });
  }

  void _executeRepeatLastTicket() {
    final last = widget.cloud.lastPrintedTicket;
    if (last == null || (last['items'] as List? ?? []).isEmpty) {
      _showToast('No hay tickets anteriores para repetir');
      return;
    }
    if (!widget.cloud.serverClockVerified) {
      _showToast('⏳ Verificando hora oficial con Google Firebase...');
      return;
    }
    if (widget.cloud.isDeviceClockTampered) {
      _showToast('🚨 Reloj manipulado. Active hora automática para vender.');
      return;
    }

    final now = widget.cloud.officialCaracasNow;
    final valid = <Map<String, dynamic>>[];
    final closed = <String>{};

    for (final raw in (last['items'] as List)) {
      if (raw is! Map) continue;
      final item = Map<String, dynamic>.from(raw);
      final lot = findLotteryById('${item['lotteryId']}');
      if (lot != null &&
          !isLotteryOpenForSale(
            lot,
            nowDate: now,
            showAllWeekDays: _showAllWeekLotteries,
          )) {
        closed.add('${item['lotteryName']}');
      } else {
        item['uid'] = '${DateTime.now().microsecondsSinceEpoch}_${valid.length}';
        valid.add(item);
      }
    }

    if (valid.isEmpty) {
      _showToast('Los sorteos del último ticket ya cerraron (-5 min)');
      return;
    }
    setState(() {
      _preTicketItems
        ..clear()
        ..addAll(valid);
    });
    _showToast(
      closed.isEmpty
          ? 'Ticket #${last['ticketId']} cargado (${valid.length} jugadas)'
          : '${valid.length} jugadas cargadas (cerrados omitidos: ${closed.join(', ')})',
    );
  }

  Future<void> _submitTicket() async {
    if (_submitting || _preTicketItems.isEmpty) return;

    // Verificar -5 min antes de enviar
    if (!widget.cloud.serverClockVerified) {
      _showToast('⏳ Verificando hora oficial con Google Firebase...');
      return;
    }
    if (widget.cloud.isDeviceClockTampered) {
      _showToast('🚨 Reloj manipulado. Active hora automática para vender.');
      return;
    }

    final now = widget.cloud.officialCaracasNow;
    final expired = <String>{};
    final active = <Map<String, dynamic>>[];

    for (final p in _preTicketItems) {
      final lot = findLotteryById('${p['lotteryId']}');
      if (lot != null &&
          !isLotteryOpenForSale(
            lot,
            nowDate: now,
            showAllWeekDays: _showAllWeekLotteries,
          )) {
        expired.add('${p['lotteryName']}');
      } else {
        active.add(p);
      }
    }

    if (expired.isNotEmpty) {
      setState(() {
        _preTicketItems
          ..clear()
          ..addAll(active);
      });
      _pruneClosedSelectedLotteries();
      _showToast('Retirados por cierre (-5 min): ${expired.join(', ')}');
      return;
    }

    setState(() => _submitting = true);
    final res = await widget.cloud.emitTicket(_preTicketItems);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (!res.success || res.ticket == null) {
      _showToast(res.error ?? 'No se pudo emitir el ticket');
      return;
    }

    setState(() => _preTicketItems.clear());
    await showTicketReceiptDialog(context, widget.cloud, res.ticket!);
  }

  void _showPreTicketSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF111D18),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final total = _preTicketItems.fold<double>(
              0,
              (sum, it) => sum + (double.tryParse('${it['amount'] ?? 0}') ?? 0),
            );
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.72,
              minChildSize: 0.45,
              maxChildSize: 0.92,
              builder: (_, scrollCtrl) => Column(
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 12, 12, 8),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt, color: Color(0xFFFBBF24)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Pre-Ticket (${_preTicketItems.length} jugadas)',
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _preTicketItems.isEmpty
                              ? null
                              : () {
                                  setState(() => _preTicketItems.clear());
                                  Navigator.of(ctx).pop();
                                },
                          icon: const Icon(Icons.delete_sweep, color: Colors.redAccent),
                          label: const Text(
                            'Limpiar',
                            style: TextStyle(color: Colors.redAccent),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: Colors.white12),
                  Expanded(
                    child: _preTicketItems.isEmpty
                        ? const Center(
                            child: Text(
                              'Sin jugadas en curso',
                              style: TextStyle(color: Colors.white54),
                            ),
                          )
                        : ListView.separated(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.all(14),
                            itemCount: _preTicketItems.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, idx) {
                              final item = _preTicketItems[idx];
                              final amt =
                                  double.tryParse('${item['amount'] ?? 0}') ?? 0;
                              var detail = '${item['number']}';
                              if (item['sign'] != null) detail += ' • ${item['sign']}';
                              if (item['animalName'] != null) {
                                detail += ' • ${item['animalName']}';
                              }
                              if (item['is5ta'] == true) detail += ' [5ta]';
                              if (item['isCombinado'] == true) detail += ' [Comb]';
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0B1410),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF1F3B30)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${item['lotteryName']}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Colors.white60,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            detail,
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      widget.cloud.formatCurrency(amt),
                                      style: const TextStyle(
                                        color: Color(0xFF4ADE80),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(
                                        Icons.close,
                                        color: Colors.redAccent,
                                        size: 20,
                                      ),
                                      onPressed: () {
                                        setState(() {
                                          _preTicketItems.removeAt(idx);
                                        });
                                        setSheetState(() {});
                                      },
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Color(0xFF0B1410),
                      border: Border(top: BorderSide(color: Colors.white12)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'TOTAL A COBRAR',
                                style: TextStyle(fontSize: 11, color: Colors.white60),
                              ),
                              Text(
                                widget.cloud.formatCurrency(total),
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF4ADE80),
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        ),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 22,
                              vertical: 16,
                            ),
                          ),
                          onPressed: _preTicketItems.isEmpty
                              ? null
                              : () {
                                  Navigator.of(ctx).pop();
                                  _submitTicket();
                                },
                          icon: const Icon(Icons.print),
                          label: const Text(
                            'EMITIR TICKET',
                            style: TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showToast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final openLots = _getOpenLotteries();
    final totalPre = _preTicketItems.fold<double>(
      0,
      (sum, it) => sum + (double.tryParse('${it['amount'] ?? 0}') ?? 0),
    );
    final isWide = MediaQuery.of(context).size.width >= 900;

    return Column(
      children: [
        // 1. Selector de categorías
        _buildCategoryBar(),
        Expanded(
          child: isWide
              ? Row(
                  children: [
                    Expanded(flex: 5, child: _buildLotteriesAndGridPane(openLots)),
                    const VerticalDivider(width: 1, color: Colors.white12),
                    Expanded(flex: 4, child: _buildCaptureKeypadPane()),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                  children: [
                    _buildLotteriesSection(openLots),
                    const SizedBox(height: 10),
                    if (_category == 'animalitos') _buildAnimalitosGrid(),
                    if (_category == 'con_signo') _buildZodiacSelector(),
                    if (_category == 'cuatro_cifras') _build4CifrasToggles(),
                    const SizedBox(height: 10),
                    _buildCaptureCard(),
                  ],
                ),
        ),
        // 3. Barra LCD inferior de Pre-Ticket
        _buildBottomPreTicketBar(totalPre),
      ],
    );
  }

  Widget _buildCategoryBar() {
    final tabs = [
      ('sin_signo', 'SIN SIGNO', Icons.looks_3),
      ('con_signo', 'CON SIGNO', Icons.auto_awesome),
      ('cuatro_cifras', '4 CIFRAS', Icons.looks_4),
      ('animalitos', 'ANIMALITOS', Icons.pets),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      color: const Color(0xFF0F1A15),
      child: Row(
        children: tabs.map((t) {
          final active = _category == t.$1;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _setCategory(t.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFF10B981) : const Color(0xFF172720),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: active ? const Color(0xFF34D399) : const Color(0xFF233E33),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        t.$3,
                        size: 18,
                        color: active ? Colors.black : const Color(0xFFFBBF24),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        t.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          color: active ? Colors.black : Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLotteriesAndGridPane(List<LotteryDraw> openLots) {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _buildLotteriesSection(openLots),
        const SizedBox(height: 12),
        if (_category == 'animalitos') _buildAnimalitosGrid(),
        if (_category == 'con_signo') _buildZodiacSelector(),
        if (_category == 'cuatro_cifras') _build4CifrasToggles(),
      ],
    );
  }

  Widget _buildCaptureKeypadPane() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: _buildCaptureCard(),
    );
  }

  Widget _buildLotteriesSection(List<LotteryDraw> openLots) {
    final now = widget.cloud.officialCaracasNow;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E372D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Buscar sorteo abierto...',
                    prefixIcon: const Icon(Icons.search, size: 19),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() {});
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: const Color(0xFF0B1410),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF064E3B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${openLots.length} abiertos',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6EE7B7),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              FilledButton.tonalIcon(
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  visualDensity: VisualDensity.compact,
                ),
                onPressed: _selectAllOpen,
                icon: const Icon(Icons.done_all, size: 16),
                label: const Text('Todos', style: TextStyle(fontSize: 12)),
              ),
              FilledButton.tonalIcon(
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  visualDensity: VisualDensity.compact,
                ),
                onPressed: _clearSelectedLotteries,
                icon: const Icon(Icons.clear_all, size: 16),
                label: const Text('Limpiar', style: TextStyle(fontSize: 12)),
              ),
              FilledButton.tonalIcon(
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  visualDensity: VisualDensity.compact,
                ),
                onPressed: _repeatLastLotteries,
                icon: const Icon(Icons.replay, size: 16),
                label: const Text('Rep. Lotería', style: TextStyle(fontSize: 12)),
              ),
              if (_selectedLotteries.isNotEmpty)
                Chip(
                  backgroundColor: const Color(0xFFFBBF24),
                  labelStyle: const TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.w900,
                    fontSize: 11.5,
                  ),
                  label: Text('${_selectedLotteries.length} marcadas'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 156,
            child: openLots.isEmpty
                ? Center(
                    child: Text(
                      widget.cloud.isDeviceClockTampered
                          ? '🚨 Reloj manipulado detectado. Ventas bloqueadas hasta restaurar hora automática.'
                          : (!widget.cloud.serverClockVerified
                              ? '⏳ Verificando hora oficial del servidor para habilitar sorteos...'
                              : 'No hay sorteos abiertos disponibles (cierres 5 min antes)'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: widget.cloud.isDeviceClockTampered
                            ? const Color(0xFFFCA5A5)
                            : Colors.white54,
                        fontSize: 13,
                        fontWeight: widget.cloud.isDeviceClockTampered
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                  )
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 230,
                      mainAxisExtent: 46,
                      crossAxisSpacing: 6,
                      mainAxisSpacing: 6,
                    ),
                    itemCount: openLots.length,
                    itemBuilder: (_, idx) {
                      final lot = openLots[idx];
                      final selected = _selectedLotteries.contains(lot.id);
                      final mins = getRemainingMinutesForLottery(lot, now);
                      return InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () {
                          setState(() {
                            if (selected) {
                              _selectedLotteries.remove(lot.id);
                            } else {
                              _selectedLotteries.add(lot.id);
                            }
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: selected
                                ? const Color(0xFF065F46)
                                : const Color(0xFF0B1410),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: selected
                                  ? const Color(0xFF34D399)
                                  : const Color(0xFF1F3B30),
                              width: selected ? 1.6 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                selected
                                    ? Icons.check_box
                                    : Icons.check_box_outline_blank,
                                size: 18,
                                color: selected
                                    ? const Color(0xFF4ADE80)
                                    : Colors.white38,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  lot.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: selected
                                        ? FontWeight.w800
                                        : FontWeight.w500,
                                  ),
                                ),
                              ),
                              if (mins > 0 && mins <= 30)
                                Text(
                                  '${mins}m',
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    color: Color(0xFFFBBF24),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildZodiacSelector() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E372D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Signo Zodiacal',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
              ),
              FilledButton.tonalIcon(
                onPressed: _executeAllSigns,
                icon: const Icon(Icons.auto_awesome, size: 16),
                label: const Text('Todos los Signos (12x)', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: zodiacSigns.map((z) {
              final active = _selectedSign == z.code;
              return ChoiceChip(
                selected: active,
                selectedColor: const Color(0xFF10B981),
                backgroundColor: const Color(0xFF0B1410),
                labelStyle: TextStyle(
                  color: active ? Colors.black : Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
                label: Text('${z.icon} ${z.code}'),
                onSelected: (_) => setState(() => _selectedSign = z.code),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _build4CifrasToggles() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E372D)),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: [
          FilterChip(
            label: const Text('La 5ta Balota'),
            selected: _is5taActive,
            selectedColor: const Color(0xFFFBBF24),
            labelStyle: TextStyle(
              color: _is5taActive ? Colors.black : Colors.white,
              fontWeight: FontWeight.bold,
            ),
            onSelected: (v) => setState(() => _is5taActive = v),
          ),
          FilterChip(
            label: const Text('Combinado (4c)'),
            selected: _isCombinadoActive,
            selectedColor: const Color(0xFF34D399),
            labelStyle: TextStyle(
              color: _isCombinadoActive ? Colors.black : Colors.white,
              fontWeight: FontWeight.bold,
            ),
            onSelected: (v) => setState(() => _isCombinadoActive = v),
          ),
          FilterChip(
            label: const Text('Toda la Semana'),
            selected: _showAllWeekLotteries,
            selectedColor: const Color(0xFF60A5FA),
            labelStyle: TextStyle(
              color: _showAllWeekLotteries ? Colors.black : Colors.white,
              fontWeight: FontWeight.bold,
            ),
            onSelected: (v) {
              setState(() => _showAllWeekLotteries = v);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAnimalitosGrid() {
    final opConfigs = <OperatorDictionaryConfig>[];
    final seen = <String>{};
    for (final id in _selectedLotteries) {
      final cfg = getOperatorConfigForLottery(id);
      if (seen.add(cfg.key)) opConfigs.add(cfg);
    }
    if (opConfigs.isEmpty) {
      opConfigs.add(operatorDictionaries['BASE_38']!);
    }
    opConfigs.sort((a, b) => b.maxNum.compareTo(a.maxNum));
    final primaryCfg = opConfigs.first;
    final maxNum = primaryCfg.maxNum;
    final keys = <String>['0', '00'];
    for (var i = 1; i <= maxNum; i++) {
      keys.add(i.toString().padLeft(2, '0'));
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E372D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  opConfigs.length == 1
                      ? '${primaryCfg.isFruta ? '🍉' : '🦁'} ${primaryCfg.label}'
                      : '🦁 Multi-Operadora (0, 00 al $maxNum)',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              Text(
                '${maxNum + 2} fig.',
                style: const TextStyle(fontSize: 11, color: Color(0xFFFBBF24)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 205,
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 92,
                mainAxisExtent: 64,
                crossAxisSpacing: 6,
                mainAxisSpacing: 6,
              ),
              itemCount: keys.length,
              itemBuilder: (_, idx) {
                final k = keys[idx];
                final figName = primaryCfg.dict[k] ?? '';
                final emoji = getEmojiForFigureName(figName, isFruta: primaryCfg.isFruta);
                final selected = normalizeAnimalCode(_numCtrl.text) == k;
                return InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    setState(() {
                      _numCtrl.text = k;
                      _editingAmount = false;
                    });
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: selected
                          ? const Color(0xFF065F46)
                          : const Color(0xFF0B1410),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected
                            ? const Color(0xFFFBBF24)
                            : const Color(0xFF1F3B30),
                      ),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$emoji $k',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          figName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 9.5,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCaptureCard() {
    final quickAmounts = widget.cloud.activeCurrency == 'VES'
        ? [10, 20, 50, 100, 200, 500]
        : (widget.cloud.activeCurrency == 'USD'
            ? [1, 2, 5, 10, 20, 50]
            : [500, 1000, 2000, 5000, 10000, 20000]);

    AnimalOrFruitInfo? animalPreview;
    if (_category == 'animalitos' && _numCtrl.text.trim().isNotEmpty) {
      final firstSel = _selectedLotteries.isNotEmpty
          ? _selectedLotteries.first
          : 'LOTTO_ACTIVO';
      animalPreview = getAnimalOrFruitInfo(
        _numCtrl.text.trim(),
        lotteryIdOrName: firstSel,
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF111D18),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF1F3B30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _editingAmount = false),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF04140B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: !_editingAmount
                            ? const Color(0xFF34D399)
                            : const Color(0xFF1E372D),
                        width: !_editingAmount ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'NÚMERO / JUGADA',
                          style: TextStyle(fontSize: 10, color: Colors.white60),
                        ),
                        TextField(
                          controller: _numCtrl,
                          focusNode: _numFocus,
                          readOnly: false,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(
                              (_category == 'cuatro_cifras' && _is5taActive) ? 5 : 4,
                            ),
                          ],
                          onTap: () => setState(() => _editingAmount = false),
                          onSubmitted: (_) {
                            setState(() => _editingAmount = true);
                            _montoFocus.requestFocus();
                          },
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                            color: Color(0xFF4ADE80),
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            hintText: '000',
                            hintStyle: TextStyle(color: Colors.white24),
                          ),
                        ),
                        if (animalPreview != null)
                          Text(
                            '${animalPreview.emoji} ${animalPreview.name}',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFFFBBF24),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _editingAmount = true),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF04140B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _editingAmount
                            ? const Color(0xFFFBBF24)
                            : const Color(0xFF1E372D),
                        width: _editingAmount ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'MONTO (${widget.cloud.activeCurrency})',
                          style: const TextStyle(fontSize: 10, color: Colors.white60),
                        ),
                        TextField(
                          controller: _montoCtrl,
                          focusNode: _montoFocus,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          onTap: () => setState(() => _editingAmount = true),
                          onSubmitted: (_) => _handleAddPlayPressed(),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                            color: Color(0xFFFBBF24),
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            hintText: '1000',
                            hintStyle: TextStyle(color: Colors.white24),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Montos rápidos táctiles
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: quickAmounts.map((amt) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    backgroundColor: const Color(0xFF1A2D25),
                    label: Text(
                      widget.cloud.formatCurrency(amt),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    onPressed: () {
                      setState(() => _montoCtrl.text = '$amt');
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 10),
          // Teclado numérico táctil
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 1.85,
            children: [
              ...['1', '2', '3', 'BACK', '4', '5', '6', 'CLEAR', '7', '8', '9', '00']
                  .map((k) {
                final isAction = k == 'BACK' || k == 'CLEAR';
                return ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isAction
                        ? const Color(0xFF3B1F22)
                        : const Color(0xFF1A2D25),
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () => _onKeypadTap(k),
                  child: k == 'BACK'
                      ? const Icon(Icons.backspace_outlined, size: 20)
                      : Text(
                          k == 'CLEAR' ? 'C' : k,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                );
              }),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A2D25),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () => _onKeypadTap('0'),
                child: const Text(
                  '0',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF064E3B),
                  foregroundColor: const Color(0xFF6EE7B7),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () => setState(() => _editingAmount = !_editingAmount),
                child: Text(
                  _editingAmount ? 'NRO' : 'MONTO',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.black,
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _handleAddPlayPressed,
                icon: const Icon(Icons.add_circle, size: 18),
                label: const Text(
                  'JUGAR',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFBBF24),
                  foregroundColor: Colors.black,
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _submitTicket,
                child: const Text(
                  'EMITIR',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Botones de comandos rápidos
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              OutlinedButton(
                onPressed: _executePermutas,
                child: const Text('P Permutas', style: TextStyle(fontSize: 11.5)),
              ),
              OutlinedButton(
                onPressed: _executeSeries,
                child: const Text('S Series 0-9', style: TextStyle(fontSize: 11.5)),
              ),
              OutlinedButton(
                onPressed: _executeRepeatTerminal,
                child: const Text('R Rep. Terminal', style: TextStyle(fontSize: 11.5)),
              ),
              OutlinedButton(
                onPressed: _executeRepeatLastTicket,
                child: const Text('T Rep. Ticket', style: TextStyle(fontSize: 11.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomPreTicketBar(double totalPre) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF07110C),
        border: Border(top: BorderSide(color: Color(0xFF1F3B30))),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: _showPreTicketSheet,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF041A0F),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF15803D)),
                ),
                child: Row(
                  children: [
                    Badge(
                      label: Text('${_preTicketItems.length}'),
                      backgroundColor: const Color(0xFFFBBF24),
                      textColor: Colors.black,
                      child: const Icon(
                        Icons.receipt_long,
                        color: Color(0xFF4ADE80),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'VER PRE-TICKET',
                            style: TextStyle(fontSize: 10, color: Colors.white60),
                          ),
                          Text(
                            widget.cloud.formatCurrency(totalPre),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF4ADE80),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.expand_less, color: Colors.white54),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            height: 54,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: (_preTicketItems.isEmpty || _submitting)
                  ? null
                  : _submitTicket,
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.black,
                      ),
                    )
                  : const Icon(Icons.check_circle),
              label: const Text(
                'EMITIR',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
