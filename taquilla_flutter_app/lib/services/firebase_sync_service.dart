// lib/services/firebase_sync_service.dart - Sincronización en Tiempo Real con Firebase y Lógica de Negocio
// Sistema "Banca El Castaño (Seguro Te Paga)"

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

enum CloudConnectionStatus { unconfigured, connecting, connected, error }

class CurrencyBoxMetrics {
  final String currency;
  final int activeCount;
  final int voidCount;
  final int paidCount;
  final int winnerPendingCount;
  final double gross;
  final double voided;
  final double net;
  final double commissionPct;
  final double commission;
  final double paidPrizes;
  final double pendingPrizes;
  final double totalPrizes;
  final double bancaUtility;
  final Map<String, double> categoryAmounts;
  final Map<String, int> categoryCounts;

  const CurrencyBoxMetrics({
    required this.currency,
    required this.activeCount,
    required this.voidCount,
    required this.paidCount,
    required this.winnerPendingCount,
    required this.gross,
    required this.voided,
    required this.net,
    required this.commissionPct,
    required this.commission,
    required this.paidPrizes,
    required this.pendingPrizes,
    required this.totalPrizes,
    required this.bancaUtility,
    required this.categoryAmounts,
    required this.categoryCounts,
  });
}

class PlayWinningResult {
  final String winType;
  final num multiplier;
  final double prize;

  const PlayWinningResult({
    required this.winType,
    required this.multiplier,
    required this.prize,
  });
}

class TicketEvaluationResult {
  final String status;
  final double totalPrize;
  final List<Map<String, dynamic>> winningPlays;

  const TicketEvaluationResult({
    required this.status,
    required this.totalPrize,
    required this.winningPlays,
  });
}

class AuthResult {
  final bool success;
  final String? reason;
  final Map<String, dynamic>? agency;

  const AuthResult({required this.success, this.reason, this.agency});
}

class TicketSubmissionResult {
  final bool success;
  final String? error;
  final Map<String, dynamic>? ticket;

  const TicketSubmissionResult({required this.success, this.error, this.ticket});
}

class BancaFcFirebaseService extends ChangeNotifier {
  static const String defaultDatabaseUrl =
      'https://banca-fc-castano-default-rtdb.firebaseio.com';
  static const String _prefDbUrlKey = 'banca_fc_firebase_url';
  static const String _prefMasterKey = 'banca_fc_master_cache';
  static const String _prefAgencyKey = 'banca_fc_logged_agency';
  static const String _prefCurrencyKey = 'banca_fc_active_currency';
  static const String _prefLastTicketKey = 'banca_fc_last_printed_ticket';

  static const int _maxDeviceDriftMs = 120000;
  static const int _ticketAuditDriftMs = 180000;

  String _databaseUrl = defaultDatabaseUrl;
  CloudConnectionStatus _status = CloudConnectionStatus.connecting;
  String? _lastError;
  String? _lastRemoteTimestamp;
  String? _lastSyncClock;
  bool _isPushing = false;
  Timer? _pollTimer;
  Timer? _clockTimer;

  bool _serverClockVerified = false;
  int? _lastServerUtcMs;
  final Stopwatch _monotonicWatch = Stopwatch();
  String _deviceClockId = 'flt_${Random().nextInt(999999)}';
  DateTime? _lastTamperAlertAt;

  bool get serverClockVerified => _serverClockVerified;

  int? get verifiedUtcMs {
    if (!_serverClockVerified || _lastServerUtcMs == null) return null;
    return _lastServerUtcMs! + _monotonicWatch.elapsedMilliseconds;
  }

  static DateTime toCaracasWallClock(int utcMs) {
    return DateTime.fromMillisecondsSinceEpoch(utcMs, isUtc: true)
        .subtract(const Duration(hours: 4));
  }

  DateTime get officialCaracasNow {
    final vMs = verifiedUtcMs;
    if (vMs != null) return toCaracasWallClock(vMs);
    return toCaracasWallClock(DateTime.now().toUtc().millisecondsSinceEpoch);
  }

  int get currentDeviceDriftMs {
    final vMs = verifiedUtcMs;
    if (vMs == null) return 0;
    return DateTime.now().toUtc().millisecondsSinceEpoch - vMs;
  }

  bool get isDeviceClockTampered {
    if (!_serverClockVerified) return false;
    return currentDeviceDriftMs.abs() > _maxDeviceDriftMs;
  }

  Map<String, dynamic> _masterData = {};
  String? _loggedAgencyCode;
  String _activeCurrency = 'COP';
  Map<String, dynamic>? _lastPrintedTicket;

  String get databaseUrl => _databaseUrl;
  CloudConnectionStatus get status => _status;
  String? get lastError => _lastError;
  String? get lastSyncClock => _lastSyncClock;
  String? get loggedAgencyCode => _loggedAgencyCode;
  bool get isLoggedIn => _loggedAgencyCode != null && _loggedAgencyCode!.isNotEmpty;
  String get activeCurrency => _activeCurrency;

  Map<String, dynamic> get masterData => _masterData;

  BancaFcFirebaseService() {
    _init();
  }

  Future<void> _init() async {
    _masterData = _buildDefaultMasterData();
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString(_prefDbUrlKey);
      if (savedUrl != null && isValidFirebaseUrl(savedUrl)) {
        _databaseUrl = _cleanUrl(savedUrl);
      }

      final cachedMaster = prefs.getString(_prefMasterKey);
      if (cachedMaster != null && cachedMaster.isNotEmpty) {
        final decoded = jsonDecode(cachedMaster);
        if (decoded is Map<String, dynamic>) {
          _masterData = decoded;
        }
      }

      final savedAgency = prefs.getString(_prefAgencyKey);
      if (savedAgency != null && savedAgency.isNotEmpty) {
        _loggedAgencyCode = savedAgency;
      }

      final savedCurrency = prefs.getString(_prefCurrencyKey);
      if (savedCurrency != null && ['COP', 'USD', 'VES'].contains(savedCurrency)) {
        _activeCurrency = savedCurrency;
      }

      final lastTktRaw = prefs.getString(_prefLastTicketKey);
      if (lastTktRaw != null && lastTktRaw.isNotEmpty) {
        final dec = jsonDecode(lastTktRaw);
        if (dec is Map<String, dynamic>) {
          _lastPrintedTicket = dec;
        }
      }
    } catch (_) {}

    notifyListeners();
    await connect();
  }

  String _cleanUrl(String url) {
    return url
        .trim()
        .replaceAll(RegExp(r'/+$'), '')
        .replaceAll(RegExp(r'/banca_fc_master\.json$', caseSensitive: false), '');
  }

  bool isValidFirebaseUrl(String? url) {
    if (url == null) return false;
    final clean = url.trim().toLowerCase();
    return clean.startsWith('https://') &&
        (clean.contains('.firebaseio.com') || clean.contains('.firebasedatabase.app'));
  }

  Uri? _endpoint([String path = '/banca_fc_master.json']) {
    if (!isValidFirebaseUrl(_databaseUrl)) return null;
    return Uri.parse('${_cleanUrl(_databaseUrl)}$path');
  }

  Future<bool> updateFirebaseUrl(String newUrlInput) async {
    final cleaned = _cleanUrl(newUrlInput);
    if (!isValidFirebaseUrl(cleaned)) {
      _lastError =
          'URL inválida. Debe iniciar con https:// y terminar en .firebaseio.com o .firebasedatabase.app';
      _status = CloudConnectionStatus.error;
      notifyListeners();
      return false;
    }
    _databaseUrl = cleaned;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefDbUrlKey, cleaned);
    return await connect();
  }

  Future<bool> syncServerTime({bool force = false}) async {
    if (!force &&
        _serverClockVerified &&
        _monotonicWatch.elapsedMilliseconds < 15000) {
      return true;
    }
    final uri = _endpoint('/banca_fc_server_clock/$_deviceClockId.json');
    if (uri == null) return false;

    try {
      final sw = Stopwatch()..start();
      final res = await http
          .put(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'serverMs': {'.sv': 'timestamp'},
            }),
          )
          .timeout(const Duration(seconds: 6));
      sw.stop();
      if (res.statusCode == 200) {
        final dec = jsonDecode(res.body);
        if (dec is Map && dec['serverMs'] is num) {
          final rttHalf = min(2000, max(0, sw.elapsedMilliseconds ~/ 2));
          _lastServerUtcMs = (dec['serverMs'] as num).toInt() + rttHalf;
          _monotonicWatch
            ..reset()
            ..start();
          _serverClockVerified = true;
          if (isDeviceClockTampered && _loggedAgencyCode != null) {
            unawaited(_reportTamperAlert(_loggedAgencyCode!));
          }
          notifyListeners();
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  Future<void> _reportTamperAlert(String agencyCode) async {
    final now = DateTime.now().toUtc();
    if (_lastTamperAlertAt != null &&
        now.difference(_lastTamperAlertAt!).inSeconds < 60) {
      return;
    }
    _lastTamperAlertAt = now;
    final cleanCode = agencyCode.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final uri = _endpoint('/banca_fc_security_alerts/$cleanCode.json');
    if (uri == null) return;
    try {
      await http
          .put(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'agencyCode': agencyCode,
              'deviceTimeIso': now.toIso8601String(),
              'driftMinutes': (currentDeviceDriftMs.abs() / 60000).round(),
              'detectedAtServerMs': {'.sv': 'timestamp'},
              'source': 'FLUTTER-APP',
            }),
          )
          .timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  Future<({bool ok, int? serverCreatedAt, String? stampKey})>
      _stampTicketInFirebase(Map<String, dynamic> prelimTicket) async {
    final tid = '${prelimTicket['ticketId'] ?? ''}'.trim();
    final serial = '${prelimTicket['serialSeguridad'] ?? ''}'
        .replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '');
    final stampKey = '${tid}_$serial';
    final uri = _endpoint('/banca_fc_ticket_stamps/$stampKey.json');
    if (uri == null) {
      return (ok: false, serverCreatedAt: null, stampKey: null);
    }
    try {
      final res = await http
          .put(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'ticketId': tid,
              'stampKey': stampKey,
              'agencyCode': '${prelimTicket['agencyCode'] ?? ''}',
              'clientFechaHora': '${prelimTicket['fechaHora'] ?? ''}',
              'clientDeviceEpochMs':
                  DateTime.now().toUtc().millisecondsSinceEpoch,
              'serverCreatedAt': {'.sv': 'timestamp'},
            }),
          )
          .timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final p = jsonDecode(res.body);
        if (p is Map && p['serverCreatedAt'] is num) {
          final srv = (p['serverCreatedAt'] as num).toInt();
          _lastServerUtcMs = srv;
          _monotonicWatch
            ..reset()
            ..start();
          _serverClockVerified = true;
          return (ok: true, serverCreatedAt: srv, stampKey: stampKey);
        }
      }
    } catch (_) {}
    return (ok: false, serverCreatedAt: null, stampKey: null);
  }

  int? _parseFechaHoraCaracasUtcMs(String fechaHoraStr) {
    final m = RegExp(
            r'^(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$',
            caseSensitive: false)
        .firstMatch(fechaHoraStr.trim());
    if (m == null) return null;
    final dd = int.parse(m.group(1)!);
    final mm = int.parse(m.group(2)!);
    final yyyy = int.parse(m.group(3)!);
    var hr = int.parse(m.group(4)!);
    final min = int.parse(m.group(5)!);
    final sec = int.parse(m.group(6) ?? '0');
    final ampm = (m.group(7) ?? '').toUpperCase();
    if (ampm == 'PM' && hr < 12) hr += 12;
    if (ampm == 'AM' && hr == 12) hr = 0;
    return DateTime.utc(yyyy, mm, dd, hr + 4, min, sec).millisecondsSinceEpoch;
  }

  String? _auditTicketPlayTiming(
    Map<String, dynamic> ticket,
    LotteryDraw? lot,
  ) {
    if (ticket['clockAuditBlocked'] == true) {
      return '${ticket['clockAuditReason'] ?? 'Ticket bloqueado por manipulación de horario'}';
    }
    final srvRaw = ticket['serverCreatedAt'];
    final serverTs = srvRaw is num ? srvRaw.toInt() : int.tryParse('$srvRaw');
    if (serverTs != null && serverTs > 1700000000000) {
      final repMs = _parseFechaHoraCaracasUtcMs('${ticket['fechaHora'] ?? ''}');
      if (repMs != null && (repMs - serverTs).abs() > _ticketAuditDriftMs) {
        return 'Hora reportada (${ticket['fechaHora']}) difiere del servidor';
      }
      if (lot != null) {
        final cNow = toCaracasWallClock(serverTs);
        final drawUtc = DateTime.utc(
          cNow.year,
          cNow.month,
          cNow.day,
          lot.drawHour24 + 4,
          lot.drawMinute,
        ).subtract(const Duration(minutes: 5)).millisecondsSinceEpoch;
        if (serverTs > drawUtc) {
          return 'Emitido después del cierre oficial (-5 min) según servidor';
        }
      }
      return null;
    }

    final cfg = _masterData['config'];
    final baseline = cfg is Map
        ? (int.tryParse('${cfg['securityBaselineTicketNumber'] ?? 0}') ?? 0)
        : 0;
    final tktNum =
        int.tryParse('${ticket['ticketId'] ?? ''}'.replaceAll(RegExp(r'\D'), '')) ??
            0;
    if (baseline > 0 && tktNum > baseline) {
      return 'Ticket nuevo emitido sin sello de hora del servidor';
    }
    return null;
  }

  Future<bool> connect() async {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    if (!isValidFirebaseUrl(_databaseUrl)) {
      _status = CloudConnectionStatus.unconfigured;
      notifyListeners();
      return false;
    }

    if (_status != CloudConnectionStatus.connected) {
      _status = CloudConnectionStatus.connecting;
      notifyListeners();
    }

    unawaited(syncServerTime(force: true));
    _clockTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      unawaited(syncServerTime(force: true));
    });
    _pollTimer = Timer.periodic(const Duration(milliseconds: 3000), (_) {
      pullAndMergeFromFirebase(isInitialConnect: false);
    });

    return await pullAndMergeFromFirebase(isInitialConnect: true);
  }

  Future<bool> pullAndMergeFromFirebase({bool isInitialConnect = false}) async {
    final uri = _endpoint();
    if (uri == null) return false;
    if (_isPushing) return true;

    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) {
        if (response.statusCode == 401 || response.statusCode == 403) {
          _lastError =
              'Permiso denegado en Firebase (HTTP ${response.statusCode}). Revise las reglas .read/.write.';
          _status = CloudConnectionStatus.error;
          notifyListeners();
        }
        return false;
      }

      final body = response.body.trim();
      final decoded = body.isEmpty || body == 'null' ? null : jsonDecode(body);

      _status = CloudConnectionStatus.connected;
      _lastError = null;
      _lastSyncClock = _formatTimeOnly12h(DateTime.now());

      if (decoded == null ||
          (decoded is Map && decoded['agencies'] == null && decoded['tickets'] == null)) {
        await pushMasterData(_masterData, forceOverwriteCloud: true);
        return true;
      }

      if (decoded is Map<String, dynamic>) {
        final remoteTs = decoded['updatedAt']?.toString();
        if (isInitialConnect || remoteTs == null || remoteTs != _lastRemoteTimestamp) {
          final merged = mergeLocalAndCloud(_masterData, decoded);
          _lastRemoteTimestamp = remoteTs;
          _masterData = merged;
          await _persistLocalCache();
          _syncCurrencyAfterCloudUpdate();
          notifyListeners();
        } else {
          notifyListeners();
        }
      }
      if (isInitialConnect) {
        unawaited(fetchOfficialResultsForDate(getTodayIso()));
      }
      return true;
    } catch (e) {
      _lastError = 'Error de red: $e';
      if (_status != CloudConnectionStatus.connected && isInitialConnect) {
        _status = CloudConnectionStatus.error;
        notifyListeners();
      }
      return false;
    }
  }

  Future<int> fetchOfficialResultsForDate(String dateIso) async {
    final cleanDate = dateIso.trim().isEmpty ? getTodayIso() : dateIso.trim();
    final uri = _endpoint('/banca_fc_resultados_oficiales/$cleanDate.json');
    if (uri == null) return 0;

    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) return 0;
      final body = response.body.trim();
      if (body.isEmpty || body == 'null') {
        return getResultsForDate(cleanDate).length;
      }
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded.isNotEmpty) {
        final updatedMaster = Map<String, dynamic>.from(_masterData);
        final allRes =
            Map<String, dynamic>.from(updatedMaster['results'] as Map? ?? {});
        allRes[cleanDate] = Map<String, dynamic>.from(decoded);
        updatedMaster['results'] = allRes;
        _masterData = updatedMaster;
        await _persistLocalCache();
        notifyListeners();
        return decoded.length;
      }
      return getResultsForDate(cleanDate).length;
    } catch (_) {
      return getResultsForDate(cleanDate).length;
    }
  }

  Future<bool> pushMasterData(
    Map<String, dynamic> localMasterData, {
    bool forceOverwriteCloud = false,
  }) async {
    final uri = _endpoint();
    if (uri == null) return false;

    _isPushing = true;
    try {
      var dataToSave = Map<String, dynamic>.from(localMasterData);

      if (forceOverwriteCloud) {
        dataToSave['lastResetTimestamp'] = DateTime.now().toUtc().toIso8601String();
      } else {
        try {
          final getRes = await http.get(uri).timeout(const Duration(seconds: 8));
          if (getRes.statusCode == 200 && getRes.body.trim() != 'null') {
            final currentCloud = jsonDecode(getRes.body);
            if (currentCloud is Map<String, dynamic> &&
                currentCloud['tickets'] is List) {
              dataToSave = mergeLocalAndCloud(localMasterData, currentCloud);
            }
          }
        } catch (_) {}
      }

      final nowIso = DateTime.now().toUtc().toIso8601String();
      dataToSave['updatedAt'] = nowIso;
      _lastRemoteTimestamp = nowIso;

      final putRes = await http
          .put(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(dataToSave),
          )
          .timeout(const Duration(seconds: 12));

      if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
        _status = CloudConnectionStatus.connected;
        _lastError = null;
        _lastSyncClock = _formatTimeOnly12h(DateTime.now());
        _masterData = dataToSave;
        await _persistLocalCache();
        notifyListeners();
        return true;
      } else if (putRes.statusCode == 401 || putRes.statusCode == 403) {
        _status = CloudConnectionStatus.error;
        _lastError = 'Firebase rechazó la escritura (HTTP ${putRes.statusCode}).';
        notifyListeners();
      }
    } catch (e) {
      _lastError = 'No se pudo subir a Firebase: $e';
    } finally {
      _isPushing = false;
    }
    return false;
  }

  Map<String, dynamic> mergeLocalAndCloud(
    Map<String, dynamic> localDb,
    Map<String, dynamic> cloudDb,
  ) {
    final cloudReset = cloudDb['lastResetTimestamp']?.toString();
    final localReset = localDb['lastResetTimestamp']?.toString();
    if (cloudReset != null &&
        cloudReset.isNotEmpty &&
        (localReset == null || cloudReset.compareTo(localReset) > 0)) {
      final cloudTicketsList = List<dynamic>.from(cloudDb['tickets'] as List? ?? []);
      String keyOfT(Map t) =>
          '${t['serialSeguridad'] ?? t['ticketId'] ?? ''}_${t['agencyCode'] ?? t['usuario'] ?? '1000'}';
      final cloudKeys = cloudTicketsList.whereType<Map>().map(keyOfT).toSet();
      final freshLocal = (localDb['tickets'] as List? ?? [])
          .whereType<Map>()
          .where((t) {
        final created = '${t['createdAt'] ?? ''}';
        return !cloudKeys.contains(keyOfT(t)) &&
            created.isNotEmpty &&
            created.compareTo(cloudReset) > 0;
      }).toList();
      return {
        ...localDb,
        ...cloudDb,
        'tickets': [...freshLocal, ...cloudTicketsList],
        'agencies': List<dynamic>.from(
            (cloudDb['agencies'] as List?) ?? (localDb['agencies'] as List? ?? [])),
        'collectors': List<dynamic>.from(
            (cloudDb['collectors'] as List?) ?? (localDb['collectors'] as List? ?? [])),
        'results': Map<String, dynamic>.from(cloudDb['results'] as Map? ?? {}),
      };
    }

    final merged = <String, dynamic>{...localDb, ...cloudDb};
    final localUpdated = localDb['updatedAt']?.toString();
    final cloudUpdated = cloudDb['updatedAt']?.toString();
    final cloudNewer = localUpdated == null ||
        (cloudUpdated != null && cloudUpdated.compareTo(localUpdated) >= 0);

    // 1. Agencias
    if (cloudNewer && cloudDb['agencies'] is List) {
      merged['agencies'] = List<dynamic>.from(cloudDb['agencies'] as List);
    } else {
      final agMap = <String, Map<String, dynamic>>{};
      for (final a in (localDb['agencies'] as List? ?? [])) {
        if (a is Map<String, dynamic>) agMap['${a['code']}'] = a;
      }
      for (final a in (cloudDb['agencies'] as List? ?? [])) {
        if (a is Map<String, dynamic>) agMap['${a['code']}'] = a;
      }
      merged['agencies'] = agMap.values.toList();
    }

    // 2. Cobradores
    if (cloudNewer && cloudDb['collectors'] is List) {
      merged['collectors'] = List<dynamic>.from(cloudDb['collectors'] as List);
    } else {
      final colSet = <String>{
        ...(localDb['collectors'] as List? ?? []).map((e) => '$e'),
        ...(cloudDb['collectors'] as List? ?? []).map((e) => '$e'),
      };
      merged['collectors'] = colSet.toList();
    }

    // 3. Tickets (fusión sin pérdida ni sobreescritura)
    final ticketMap = <String, Map<String, dynamic>>{};
    String getKey(Map<String, dynamic> t) {
      final idPart = t['serialSeguridad'] ?? t['ticketId'] ?? '';
      final agPart = t['agencyCode'] ?? t['usuario'] ?? '1000';
      return '${idPart}_$agPart';
    }

    for (final raw in (cloudDb['tickets'] as List? ?? [])) {
      if (raw is Map<String, dynamic>) {
        ticketMap[getKey(raw)] = Map<String, dynamic>.from(raw);
      }
    }

    const rank = {'ACTIVO': 1, 'GANADOR': 2, 'PAGADO': 3, 'ANULADO': 4};
    for (final raw in (localDb['tickets'] as List? ?? [])) {
      if (raw is! Map<String, dynamic>) continue;
      final t = Map<String, dynamic>.from(raw);
      final key = getKey(t);
      final inCloud = ticketMap[key];
      if (inCloud == null) {
        ticketMap[key] = t;
      } else {
        final cloudTUpdated = inCloud['updatedAt']?.toString();
        final localTUpdated = t['updatedAt']?.toString();
        if (cloudTUpdated != null &&
            localTUpdated != null &&
            cloudTUpdated != localTUpdated) {
          ticketMap[key] = cloudTUpdated.compareTo(localTUpdated) > 0
              ? {...t, ...inCloud}
              : {...inCloud, ...t};
        } else {
          final cRank = rank['${inCloud['estado']}'] ?? 1;
          final lRank = rank['${t['estado']}'] ?? 1;
          ticketMap[key] = cRank >= lRank
              ? {...t, ...inCloud}
              : {...inCloud, ...t};
        }
      }
    }

    final mergedTickets = ticketMap.values.toList()
      ..sort((a, b) {
        final na = int.tryParse('${a['ticketId'] ?? 0}') ?? 0;
        final nb = int.tryParse('${b['ticketId'] ?? 0}') ?? 0;
        return nb.compareTo(na);
      });
    merged['tickets'] = mergedTickets;

    // 4. Resultados
    final cloudResTs = cloudDb['resultsUpdatedAt']?.toString();
    final localResTs = localDb['resultsUpdatedAt']?.toString();
    final cloudResultsNewer = (cloudResTs != null &&
            (localResTs == null || cloudResTs.compareTo(localResTs) >= 0)) ||
        (localResTs == null && cloudNewer);

    if (cloudResultsNewer && cloudDb['results'] != null) {
      merged['results'] = Map<String, dynamic>.from(cloudDb['results'] as Map? ?? {});
      merged['resultsUpdatedAt'] = cloudResTs ?? cloudUpdated;
    } else if (localResTs != null &&
        (cloudResTs == null || localResTs.compareTo(cloudResTs) > 0)) {
      merged['results'] = Map<String, dynamic>.from(localDb['results'] as Map? ?? {});
      merged['resultsUpdatedAt'] = localResTs;
    } else {
      final mergedResults =
          Map<String, dynamic>.from(localDb['results'] as Map? ?? {});
      final cloudResMap = cloudDb['results'] as Map? ?? {};
      cloudResMap.forEach((dateKey, resObj) {
        final prevDay = Map<String, dynamic>.from(
            mergedResults['$dateKey'] as Map? ?? {});
        final incDay = Map<String, dynamic>.from(resObj as Map? ?? {});
        mergedResults['$dateKey'] = {...prevDay, ...incDay};
      });
      merged['results'] = mergedResults;
    }

    // 5. Correlativo máximo
    final localConfig = Map<String, dynamic>.from(localDb['config'] as Map? ?? {});
    final cloudConfig = Map<String, dynamic>.from(cloudDb['config'] as Map? ?? {});
    final mergedConfig = {...localConfig, ...cloudConfig};
    final localNext = int.tryParse('${localConfig['nextTicketNumber'] ?? 1}') ?? 1;
    final cloudNext = int.tryParse('${cloudConfig['nextTicketNumber'] ?? 1}') ?? 1;
    mergedConfig['nextTicketNumber'] = max(localNext, cloudNext);
    merged['config'] = mergedConfig;

    return merged;
  }

  Future<void> _persistLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefMasterKey, jsonEncode(_masterData));
    } catch (_) {}
  }

  List<Map<String, dynamic>> getAgencies() {
    final raw = _masterData['agencies'];
    if (raw is List) {
      return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return _defaultAgencies();
  }

  Map<String, dynamic>? getAgencyByCode(String code) {
    final clean = code.trim();
    for (final ag in getAgencies()) {
      if ('${ag['code']}'.trim() == clean) return ag;
    }
    return null;
  }

  Map<String, dynamic>? get activeAgency {
    if (_loggedAgencyCode == null) return null;
    return getAgencyByCode(_loggedAgencyCode!);
  }

  List<String> getAllowedCurrenciesForAgency(String agencyCode) {
    final ag = getAgencyByCode(agencyCode);
    if (ag != null) {
      final allowed = ag['allowedCurrencies'];
      if (allowed is List && allowed.isNotEmpty) {
        final filtered = allowed
            .map((e) => '$e'.toUpperCase())
            .where((c) => ['COP', 'USD', 'VES'].contains(c))
            .toList();
        if (filtered.isNotEmpty) return filtered;
      }
      final primary = '${ag['currency'] ?? ''}'.toUpperCase();
      if (['COP', 'USD', 'VES'].contains(primary)) return [primary];
    }
    return ['COP'];
  }

  Future<AuthResult> loginAgency(String userCode, String password) async {
    // Intentar sincronizar primero por si hay agencias recién creadas en el Panel Admin
    await pullAndMergeFromFirebase(isInitialConnect: false);

    final code = userCode.trim();
    final pass = password.trim();
    final agency = getAgencyByCode(code);

    if (agency == null) {
      return AuthResult(
        success: false,
        reason: 'La Agencia / Taquilla "$code" no existe en la nube de Banca El Castaño.',
      );
    }

    if ('${agency['status']}'.toUpperCase() == 'SUSPENDIDA') {
      return AuthResult(
        success: false,
        reason:
            'La Agencia ${agency['code']} (${agency['name']}) se encuentra SUSPENDIDA por la Administración Central.',
      );
    }

    final expectedPass = '${agency['password'] ?? ''}'.trim();
    if (expectedPass.isNotEmpty && pass != expectedPass) {
      return const AuthResult(
        success: false,
        reason: 'Contraseña POS incorrecta para esta taquilla.',
      );
    }

    _loggedAgencyCode = '${agency['code']}';
    final allowed = getAllowedCurrenciesForAgency(_loggedAgencyCode!);
    if (!allowed.contains(_activeCurrency)) {
      _activeCurrency = allowed.first;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefAgencyKey, _loggedAgencyCode!);
    await prefs.setString(_prefCurrencyKey, _activeCurrency);
    notifyListeners();
    return AuthResult(success: true, agency: agency);
  }

  Future<void> logout() async {
    _loggedAgencyCode = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefAgencyKey);
    notifyListeners();
  }

  Future<void> setActiveCurrency(String currency) async {
    final cur = currency.toUpperCase();
    if (_loggedAgencyCode != null) {
      final allowed = getAllowedCurrenciesForAgency(_loggedAgencyCode!);
      if (!allowed.contains(cur)) return;
    }
    _activeCurrency = cur;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefCurrencyKey, cur);
    notifyListeners();
  }

  void _syncCurrencyAfterCloudUpdate() {
    if (_loggedAgencyCode == null) return;
    final allowed = getAllowedCurrenciesForAgency(_loggedAgencyCode!);
    if (!allowed.contains(_activeCurrency)) {
      _activeCurrency = allowed.first;
    }
  }

  Map<String, dynamic> getConfig() {
    final base = Map<String, dynamic>.from(_masterData['config'] as Map? ?? {});
    return {..._defaultConfig(), ...base};
  }

  int get nextTicketNumber {
    final cfg = getConfig();
    return int.tryParse('${cfg['nextTicketNumber'] ?? 10926}') ?? 10926;
  }

  Map<String, num> getEffectiveMultipliersForAgency(String agencyCode) {
    final cfg = getConfig();
    final globalMult = Map<String, dynamic>.from(
        cfg['multipliers'] as Map? ?? _defaultMultipliers());
    final ag = getAgencyByCode(agencyCode);
    final merged = <String, num>{};
    _defaultMultipliers().forEach((k, v) {
      merged[k] = num.tryParse('${globalMult[k] ?? v}') ?? v;
    });
    if (ag != null && ag['multipliers'] is Map) {
      final agM = ag['multipliers'] as Map;
      agM.forEach((k, v) {
        final parsed = num.tryParse('$v');
        if (parsed != null && parsed > 0) merged['$k'] = parsed;
      });
    }
    return merged;
  }

  double getEffectiveCommissionForAgency(String agencyCode) {
    final ag = getAgencyByCode(agencyCode);
    if (ag != null && ag['commissionPct'] != null) {
      return double.tryParse('${ag['commissionPct']}') ?? 15.0;
    }
    final cfg = getConfig();
    return double.tryParse('${cfg['agencyCommissionPct'] ?? 15}') ?? 15.0;
  }

  List<Map<String, dynamic>> getTickets({String? onlyAgencyCode}) {
    final raw = _masterData['tickets'];
    if (raw is! List) return [];
    final all =
        raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    if (onlyAgencyCode == null || onlyAgencyCode.isEmpty) return all;
    return all
        .where((t) => extractAgencyCodeFromTicket(t) == onlyAgencyCode)
        .toList();
  }

  String extractAgencyCodeFromTicket(Map<String, dynamic> ticket) {
    final ac = ticket['agencyCode']?.toString().trim();
    if (ac != null && ac.isNotEmpty) return ac;
    final usr = ticket['usuario']?.toString().trim();
    if (usr != null && RegExp(r'^\d+$').hasMatch(usr)) return usr;
    final agStr = ticket['agencia']?.toString() ?? '';
    if (agStr.contains('-')) return agStr.split('-').first.trim();
    return '1000';
  }

  Map<String, dynamic>? getTicketByIdOrSerial(String query) {
    final clean = query.trim().replaceAll('#', '');
    if (clean.isEmpty) return null;
    final padded = clean.padLeft(8, '0');
    final upper = clean.toUpperCase();
    for (final t in getTickets()) {
      final tid = '${t['ticketId'] ?? ''}';
      final serial = '${t['serialSeguridad'] ?? ''}'.toUpperCase();
      if (tid == padded || tid == clean || tid.endsWith(clean) || serial == upper) {
        return t;
      }
    }
    return null;
  }

  Map<String, dynamic>? get lastPrintedTicket {
    if (_lastPrintedTicket != null) return _lastPrintedTicket;
    final list = getTickets(onlyAgencyCode: _loggedAgencyCode);
    return list.isNotEmpty ? list.first : null;
  }

  Future<TicketSubmissionResult> emitTicket(
    List<Map<String, dynamic>> items,
  ) async {
    if (items.isEmpty) {
      return const TicketSubmissionResult(
        success: false,
        error: 'No hay jugadas cargadas en el pre-ticket.',
      );
    }

    final syncOk = await syncServerTime(force: true);
    if (!syncOk || !_serverClockVerified) {
      return const TicketSubmissionResult(
        success: false,
        error:
            '⛔ No se pudo verificar la hora oficial con el servidor. Verifique su conexión a internet.',
      );
    }
    if (isDeviceClockTampered) {
      return const TicketSubmissionResult(
        success: false,
        error:
            '🚨 RELOJ DEL TELÉFONO MANIPULADO: Active la fecha y hora automática para poder vender.',
      );
    }

    final caracasNow = officialCaracasNow;
    for (final p in items) {
      final lot = findLotteryById('${p['lotteryId']}');
      if (lot != null && !isLotteryOpenForSale(lot, nowDate: caracasNow)) {
        return TicketSubmissionResult(
          success: false,
          error: '⛔ El sorteo ${p['lotteryName']} ya cerró (-5 min hora oficial).',
        );
      }
    }

    final agencyCode = _loggedAgencyCode ?? '1000';
    final agency = getAgencyByCode(agencyCode);
    if (agency != null && '${agency['status']}'.toUpperCase() == 'SUSPENDIDA') {
      return TicketSubmissionResult(
        success: false,
        error:
            'ACCESO DENEGADO: La Agencia $agencyCode (${agency['name']}) está SUSPENDIDA.',
      );
    }

    // Validación de Topes de Riesgo
    final maxLimit = double.tryParse('${agency?['maxBetLimit'] ?? 0}') ?? 0;
    if (maxLimit > 0) {
      final existing = getTickets(onlyAgencyCode: agencyCode)
          .where((t) => t['estado'] != 'ANULADO')
          .toList();
      for (final play in items) {
        double accum = 0;
        for (final t in existing) {
          for (final it in (t['items'] as List? ?? [])) {
            if (it is Map &&
                '${it['lotteryId']}' == '${play['lotteryId']}' &&
                '${it['number']}' == '${play['number']}') {
              accum += double.tryParse('${it['amount'] ?? 0}') ?? 0;
            }
          }
        }
        final playAmount = double.tryParse('${play['amount'] ?? 0}') ?? 0;
        if (accum + playAmount > maxLimit) {
          final available = max(0.0, maxLimit - accum);
          return TicketSubmissionResult(
            success: false,
            error:
                'TOPE DE RIESGO EXCEDIDO:\nSorteo: ${play['lotteryName']}\nNúmero: ${play['number']}\nTope: ${formatCurrency(maxLimit, _activeCurrency)}\nDisponible: ${formatCurrency(available, _activeCurrency)}',
          );
        }
      }
    }

    final currentNext = nextTicketNumber;
    final ticketId = currentNext.toString().padLeft(8, '0');
    final serial = _generateSecuritySerial();
    final prelimDateStr = formatDateTime12h(caracasNow);

    final stampRes = await _stampTicketInFirebase({
      'ticketId': ticketId,
      'serialSeguridad': serial,
      'agencyCode': agencyCode,
      'fechaHora': prelimDateStr,
    });
    if (!stampRes.ok || stampRes.serverCreatedAt == null) {
      return const TicketSubmissionResult(
        success: false,
        error: '⛔ Error registrando sello oficial de hora en Firebase.',
      );
    }

    final exactServerWall = toCaracasWallClock(stampRes.serverCreatedAt!);
    for (final p in items) {
      final lot = findLotteryById('${p['lotteryId']}');
      if (lot != null && !isLotteryOpenForSale(lot, nowDate: exactServerWall)) {
        return TicketSubmissionResult(
          success: false,
          error:
              '⛔ ${p['lotteryName']} cerró en el servidor antes de sellar el ticket.',
        );
      }
    }

    final dateStr = formatDateTime12h(exactServerWall);
    final agencyName = '${agency?['name'] ?? 'EL CASTAÑO'}';

    double total = 0;
    for (final p in items) {
      total += double.tryParse('${p['amount'] ?? 0}') ?? 0;
    }

    final cleanItems = items.map((e) => Map<String, dynamic>.from(e)).toList();
    final serverIso =
        DateTime.fromMillisecondsSinceEpoch(stampRes.serverCreatedAt!, isUtc: true)
            .toIso8601String();
    final ticket = <String, dynamic>{
      'ticketId': ticketId,
      'serialSeguridad': serial,
      'fechaHora': dateStr,
      'agencyCode': agencyCode,
      'agencia': '$agencyCode - $agencyName',
      'usuario': agencyCode,
      'moneda': _activeCurrency,
      'items': cleanItems,
      'total': total,
      'estado': 'ACTIVO',
      'premioCalculado': 0,
      'origenApp': 'FLUTTER-MOVIL',
      'serverCreatedAt': stampRes.serverCreatedAt,
      'serverStampKey': stampRes.stampKey,
      'clockVerified': true,
      'clientDeviceEpochMs': DateTime.now().toUtc().millisecondsSinceEpoch,
      'createdAt': serverIso,
      'updatedAt': serverIso,
    };

    final evalRes = evaluateTicket(ticket);
    if (evalRes.status == 'BLOQUEADO_HORA') {
      ticket['clockAuditBlocked'] = true;
      ticket['premioCalculado'] = 0;
      ticket['winningPlays'] = <dynamic>[];
    } else if (evalRes.totalPrize > 0) {
      ticket['estado'] = 'GANADOR';
      ticket['premioCalculado'] = evalRes.totalPrize;
      ticket['winningPlays'] = evalRes.winningPlays;
    }

    final updatedMaster = Map<String, dynamic>.from(_masterData);
    final cfg = Map<String, dynamic>.from(
        updatedMaster['config'] as Map? ?? _defaultConfig());
    cfg['nextTicketNumber'] = currentNext + 1;
    updatedMaster['config'] = cfg;

    final ticketList =
        List<dynamic>.from(updatedMaster['tickets'] as List? ?? []);
    ticketList.insert(0, ticket);
    updatedMaster['tickets'] = ticketList;

    _masterData = updatedMaster;
    _lastPrintedTicket = ticket;
    await _persistLocalCache();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefLastTicketKey, jsonEncode(ticket));
    notifyListeners();

    await pushMasterData(updatedMaster);
    return TicketSubmissionResult(success: true, ticket: ticket);
  }

  Future<bool> cancelTicket(String ticketId) async {
    final cleanId = ticketId.trim().replaceAll('#', '').padLeft(8, '0');
    final updatedMaster = Map<String, dynamic>.from(_masterData);
    final list = List<dynamic>.from(updatedMaster['tickets'] as List? ?? []);
    var found = false;

    for (var i = 0; i < list.length; i++) {
      final raw = list[i];
      if (raw is Map &&
          ('${raw['ticketId']}' == cleanId || '${raw['ticketId']}' == ticketId)) {
        final copy = Map<String, dynamic>.from(raw);
        copy['estado'] = 'ANULADO';
        copy['fechaAnulacion'] = formatDateTime12h(DateTime.now());
        copy['updatedAt'] = DateTime.now().toUtc().toIso8601String();
        list[i] = copy;
        found = true;
        break;
      }
    }
    if (!found) return false;

    updatedMaster['tickets'] = list;
    _masterData = updatedMaster;
    await _persistLocalCache();
    notifyListeners();
    await pushMasterData(updatedMaster);
    return true;
  }

  Future<bool> payWinningTicket(String ticketId, double prize) async {
    final cleanId = ticketId.trim().replaceAll('#', '').padLeft(8, '0');
    final updatedMaster = Map<String, dynamic>.from(_masterData);
    final list = List<dynamic>.from(updatedMaster['tickets'] as List? ?? []);
    var found = false;

    for (var i = 0; i < list.length; i++) {
      final raw = list[i];
      if (raw is Map &&
          ('${raw['ticketId']}' == cleanId || '${raw['ticketId']}' == ticketId)) {
        final copy = Map<String, dynamic>.from(raw);
        copy['estado'] = 'PAGADO';
        copy['premioPagado'] = prize;
        copy['fechaPago'] = formatDateTime12h(DateTime.now());
        copy['updatedAt'] = DateTime.now().toUtc().toIso8601String();
        list[i] = copy;
        found = true;
        break;
      }
    }
    if (!found) return false;

    updatedMaster['tickets'] = list;
    _masterData = updatedMaster;
    await _persistLocalCache();
    notifyListeners();
    await pushMasterData(updatedMaster);
    return true;
  }

  Map<String, dynamic> getResultsForDate(String dateIso) {
    final allResults = _masterData['results'];
    if (allResults is Map && allResults[dateIso] is Map) {
      return Map<String, dynamic>.from(allResults[dateIso] as Map);
    }
    return {};
  }

  String extractTicketDateIso(Map<String, dynamic> ticket) {
    final direct = ticket['dateIso']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;
    final raw = '${ticket['fechaHora'] ?? ''}'.trim();
    final slash = RegExp(r'(\d{2})/(\d{2})/(\d{4})').firstMatch(raw);
    if (slash != null) {
      return '${slash.group(3)}-${slash.group(2)}-${slash.group(1)}';
    }
    final iso = RegExp(r'(\d{4})-(\d{2})-(\d{2})').firstMatch(raw);
    if (iso != null) {
      return '${iso.group(1)}-${iso.group(2)}-${iso.group(3)}';
    }
    return getTodayIso();
  }

  PlayWinningResult? checkPlayWinning(
    Map<String, dynamic> play,
    Map<String, dynamic> officialResult,
    Map<String, num> multipliers,
  ) {
    final winNum = '${officialResult['number'] ?? ''}'.trim();
    if (winNum.isEmpty) return null;
    final playNum = '${play['number'] ?? ''}'.trim();
    final playAmount = double.tryParse('${play['amount'] ?? 0}') ?? 0;
    final playType = '${play['type'] ?? 'triple'}';

    if (playType == 'animalito') {
      final isDzPlay = playNum == '00';
      final isDzWin = winNum == '00';
      final matched = (isDzPlay || isDzWin)
          ? (isDzPlay && isDzWin)
          : (int.tryParse(playNum) != null &&
              int.tryParse(playNum) == int.tryParse(winNum));
      if (matched) {
        final baseMult = multipliers['animalito'] ?? 30;
        final lid = '${play['lotteryId'] ?? ''}'.toUpperCase();
        final parsedNum = isDzPlay ? -1 : (int.tryParse(playNum) ?? -1);
        final comodinRaw =
            '${officialResult['comodin'] ?? officialResult['bonus'] ?? officialResult['sign'] ?? ''}'
                .toUpperCase()
                .trim();
        final animalText =
            '${officialResult['animalName'] ?? ''}'.toUpperCase();

        var mult = baseMult;
        var winType = 'ANIMALITO GANADOR';

        if (lid.startsWith('GUACHARO_ACTIVO') || lid.startsWith('GUACHARO_')) {
          if (parsedNum == 75) {
            mult = 120;
            winType = 'COMODÍN GUÁCHARO (75)';
          } else {
            mult = 60;
          }
        } else if (lid.startsWith('GUACHARITO_MILL') ||
            lid.startsWith('GUACHARITO')) {
          if (parsedNum == 99) {
            mult = 150;
            winType = 'COMODÍN GUACHARITO (99)';
          } else {
            mult = 70;
          }
        } else if (lid.startsWith('CONDOR_GANA')) {
          mult = 60;
        } else if (lid.startsWith('MEGA_ANIMAL')) {
          final isMega = officialResult['isMega'] == true ||
              comodinRaw == 'MEGA' ||
              comodinRaw.contains('MEGA') ||
              animalText.contains('MEGA');
          if (isMega) {
            mult = 40;
            winType = 'ANIMALITO MEGA';
          }
        } else if (lid.startsWith('SELVA_PLUS')) {
          if (comodinRaw == 'COMODIN_B' ||
              comodinRaw == 'B' ||
              comodinRaw.contains('COMODIN B') ||
              comodinRaw.contains('COMODÍN B') ||
              animalText.contains('COMODIN B') ||
              animalText.contains('COMODÍN B')) {
            mult = 200;
            winType = 'SELVA PLUS COMODÍN B';
          } else if (comodinRaw == 'COMODIN_A' ||
              comodinRaw == 'A' ||
              comodinRaw.contains('COMODIN A') ||
              comodinRaw.contains('COMODÍN A') ||
              animalText.contains('COMODIN A') ||
              animalText.contains('COMODÍN A')) {
            mult = 160;
            winType = 'SELVA PLUS COMODÍN A';
          } else {
            mult = 80;
          }
        }

        return PlayWinningResult(
          winType: winType,
          multiplier: mult,
          prize: playAmount * mult,
        );
      }
      return null;
    }

    if (playType == 'zodiac' || playType == 'astro') {
      final playSign = '${play['sign'] ?? ''}'.toUpperCase();
      final winSign = '${officialResult['sign'] ?? ''}'.toUpperCase();
      final signMatches =
          winSign.isEmpty || playSign == 'TODOS' || playSign == winSign;

      if (playNum.length == 4 && winNum.length >= 4) {
        if (playNum == winNum.substring(winNum.length - 4) && signMatches) {
          final mult = multipliers['astro4'] ?? 40000;
          return PlayWinningResult(
            winType: 'ASTRO 4 CIFRAS + SIGNO',
            multiplier: mult,
            prize: playAmount * mult,
          );
        }
      }
      final playTriple =
          playNum.length >= 3 ? playNum.substring(playNum.length - 3) : playNum;
      final winTriple =
          winNum.length >= 3 ? winNum.substring(winNum.length - 3) : winNum;
      if (playTriple == winTriple && signMatches) {
        final mult = playType == 'astro'
            ? (multipliers['astro3'] ?? 1000)
            : (multipliers['triple'] ?? 500);
        return PlayWinningResult(
          winType: 'TRIPLE ZODIACAL + SIGNO',
          multiplier: mult,
          prize: playAmount * mult,
        );
      }
      return null;
    }

    if (playType == 'cuatro_cifras') {
      final ball5 = '${officialResult['ball5'] ?? ''}'.trim();
      if (play['is5ta'] == true && ball5.isNotEmpty) {
        final fullWin = '$winNum$ball5';
        if (playNum == fullWin || playNum == winNum) {
          final mult = multipliers['la5ta'] ?? 25000;
          return PlayWinningResult(
            winType: 'CHANCE LA 5TA BALOTA',
            multiplier: mult,
            prize: playAmount * mult,
          );
        }
      }
      if (playNum.length == 4 &&
          winNum.length >= 4 &&
          playNum == winNum.substring(winNum.length - 4)) {
        final mult = multipliers['cuatroCifrasDirecto'] ?? 4500;
        return PlayWinningResult(
          winType: 'CHANCE 4 CIFRAS DIRECTO',
          multiplier: mult,
          prize: playAmount * mult,
        );
      }
      if (play['isCombinado'] == true &&
          playNum.length == 4 &&
          winNum.length >= 4) {
        final s1 = (playNum.split('')..sort()).join();
        final s2 = (winNum.substring(winNum.length - 4).split('')..sort()).join();
        if (s1 == s2) {
          final mult = multipliers['cuatroCifrasCombinado'] ?? 208;
          return PlayWinningResult(
            winType: 'CHANCE 4 CIFRAS COMBINADO',
            multiplier: mult,
            prize: playAmount * mult,
          );
        }
      }
      return null;
    }

    // Sin signo (triple / terminal / aproximación)
    if (playNum.length >= 3 && winNum.length >= 3) {
      final p3 = playNum.substring(playNum.length - 3);
      final w3 = winNum.substring(winNum.length - 3);
      if (p3 == w3) {
        final mult = multipliers['triple'] ?? 500;
        return PlayWinningResult(
          winType: 'TRIPLE DIRECTO',
          multiplier: mult,
          prize: playAmount * mult,
        );
      }
    }

    if (playNum.length == 2 && winNum.length >= 2) {
      final p2 = playNum.substring(playNum.length - 2);
      final w2 = winNum.substring(winNum.length - 2);
      if (p2 == w2) {
        final mult = multipliers['terminal'] ?? 60;
        return PlayWinningResult(
          winType: 'TERMINAL DERECHO',
          multiplier: mult,
          prize: playAmount * mult,
        );
      }
      final pv = int.tryParse(p2);
      final wv = int.tryParse(w2);
      if (pv != null && wv != null) {
        if (pv == (wv + 1) % 100 || pv == (wv - 1 + 100) % 100) {
          final mult = multipliers['aproximacion'] ?? 5;
          return PlayWinningResult(
            winType: 'APROXIMACIÓN TERMINAL',
            multiplier: mult,
            prize: playAmount * mult,
          );
        }
      }
    }

    return null;
  }

  TicketEvaluationResult evaluateTicket(
    Map<String, dynamic> ticket, {
    String? targetDateIso,
  }) {
    if ('${ticket['estado']}' == 'ANULADO' || ticket['clockAuditBlocked'] == true) {
      return TicketEvaluationResult(
        status: ticket['clockAuditBlocked'] == true ? 'BLOQUEADO_HORA' : 'ANULADO',
        totalPrize: 0,
        winningPlays: const [],
      );
    }

    final agCode = extractAgencyCodeFromTicket(ticket);
    final mults = getEffectiveMultipliersForAgency(agCode);
    final dateKey = targetDateIso ?? extractTicketDateIso(ticket);
    final dayResults = getResultsForDate(dateKey);

    double totalPrize = 0;
    final winningPlays = <Map<String, dynamic>>[];

    for (final rawPlay in (ticket['items'] as List? ?? [])) {
      if (rawPlay is! Map) continue;
      final play = Map<String, dynamic>.from(rawPlay);
      final lot = findLotteryById('${play['lotteryId']}');
      final auditErr = _auditTicketPlayTiming(ticket, lot);
      if (auditErr != null) {
        return const TicketEvaluationResult(
          status: 'BLOQUEADO_HORA',
          totalPrize: 0,
          winningPlays: [],
        );
      }
      final offResRaw = dayResults['${play['lotteryId']}'];
      if (offResRaw is Map) {
        final offRes = Map<String, dynamic>.from(offResRaw);
        final win = checkPlayWinning(play, offRes, mults);
        if (win != null) {
          totalPrize += win.prize;
          winningPlays.add({
            ...play,
            'winType': win.winType,
            'multiplier': win.multiplier,
            'prize': win.prize,
            'resultNumber': offRes['number'],
            'resultSign': offRes['sign'],
          });
        }
      }
    }

    final isWinner = totalPrize > 0;
    final status = ('${ticket['estado']}' == 'PAGADO' && isWinner)
        ? 'PAGADO'
        : (isWinner ? 'GANADOR' : 'ACTIVO');
    return TicketEvaluationResult(
      status: status,
      totalPrize: totalPrize,
      winningPlays: winningPlays,
    );
  }

  CurrencyBoxMetrics calculateCurrencyBoxMetrics(
    List<Map<String, dynamic>> tickets,
    String currencyCode,
  ) {
    final target = currencyCode.toUpperCase();
    final filtered = tickets
        .where((t) => '${t['moneda'] ?? 'COP'}'.toUpperCase() == target)
        .toList();

    var activeCount = 0;
    var voidCount = 0;
    var paidCount = 0;
    var winnerPendingCount = 0;
    double gross = 0;
    double voided = 0;
    double net = 0;
    double commission = 0;
    double paidPrizes = 0;
    double pendingPrizes = 0;

    final catAmounts = {
      'sin_signo': 0.0,
      'con_signo': 0.0,
      'cuatro_cifras': 0.0,
      'animalitos': 0.0,
    };
    final catCounts = {
      'sin_signo': 0,
      'con_signo': 0,
      'cuatro_cifras': 0,
      'animalitos': 0,
    };

    for (final t in filtered) {
      final tTotal = double.tryParse('${t['total'] ?? 0}') ?? 0;
      final agCode = extractAgencyCodeFromTicket(t);
      final commPct = getEffectiveCommissionForAgency(agCode);
      gross += tTotal;

      if ('${t['estado']}' == 'ANULADO') {
        voidCount++;
        voided += tTotal;
      } else {
        activeCount++;
        net += tTotal;
        commission += (tTotal * commPct) / 100.0;

        final prizeVal =
            double.tryParse('${t['premioPagado'] ?? t['premioCalculado'] ?? 0}') ?? 0;
        if ('${t['estado']}' == 'PAGADO') {
          paidCount++;
          paidPrizes += prizeVal;
        } else if ('${t['estado']}' == 'GANADOR' || prizeVal > 0) {
          winnerPendingCount++;
          pendingPrizes += prizeVal;
        }

        for (final rawPlay in (t['items'] as List? ?? [])) {
          if (rawPlay is! Map) continue;
          final pAmt = double.tryParse('${rawPlay['amount'] ?? 0}') ?? 0;
          final pType = '${rawPlay['type'] ?? ''}';
          if (pType == 'animalito') {
            catAmounts['animalitos'] = catAmounts['animalitos']! + pAmt;
            catCounts['animalitos'] = catCounts['animalitos']! + 1;
          } else if (pType == 'zodiac' || pType == 'astro') {
            catAmounts['con_signo'] = catAmounts['con_signo']! + pAmt;
            catCounts['con_signo'] = catCounts['con_signo']! + 1;
          } else if (pType == 'cuatro_cifras') {
            catAmounts['cuatro_cifras'] = catAmounts['cuatro_cifras']! + pAmt;
            catCounts['cuatro_cifras'] = catCounts['cuatro_cifras']! + 1;
          } else {
            catAmounts['sin_signo'] = catAmounts['sin_signo']! + pAmt;
            catCounts['sin_signo'] = catCounts['sin_signo']! + 1;
          }
        }
      }
    }

    final totalPrizes = paidPrizes + pendingPrizes;
    final utility = net - commission - totalPrizes;
    final effCommPct = net > 0
        ? double.parse(((commission / net) * 100).toStringAsFixed(1))
        : getEffectiveCommissionForAgency(_loggedAgencyCode ?? '1000');

    return CurrencyBoxMetrics(
      currency: target,
      activeCount: activeCount,
      voidCount: voidCount,
      paidCount: paidCount,
      winnerPendingCount: winnerPendingCount,
      gross: gross,
      voided: voided,
      net: net,
      commissionPct: effCommPct,
      commission: commission,
      paidPrizes: paidPrizes,
      pendingPrizes: pendingPrizes,
      totalPrizes: totalPrizes,
      bancaUtility: utility,
      categoryAmounts: catAmounts,
      categoryCounts: catCounts,
    );
  }

  List<Map<String, dynamic>> getMessages() {
    final raw = _masterData['messages'];
    if (raw is List) {
      return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  String generatePlainTextReceipt(Map<String, dynamic> ticket) {
    final cur = '${ticket['moneda'] ?? _activeCurrency}';
    final items = (ticket['items'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final it in items) {
      final name = '${it['lotteryName'] ?? it['lotteryId'] ?? 'Sorteo'}';
      grouped.putIfAbsent(name, () => []).add(it);
    }

    final sb = StringBuffer();
    sb.writeln('🎟️ *BANCA EL CASTAÑO*');
    sb.writeln('📍 *AGENCIA:* ${ticket['agencia'] ?? ''}');
    sb.writeln('🕒 *FECHA:* ${ticket['fechaHora'] ?? ''}');
    sb.writeln('🔢 *TICKET:* #${ticket['ticketId'] ?? ''}');
    sb.writeln('🔐 *SERIAL:* ${ticket['serialSeguridad'] ?? ''}');
    sb.writeln('--------------------------------');

    grouped.forEach((lotName, plays) {
      sb.writeln('*▶ ${lotName.toUpperCase()}*');
      for (final p in plays) {
        var nro = '${p['number'] ?? ''}';
        if (p['sign'] != null && '${p['sign']}'.isNotEmpty) nro += '-${p['sign']}';
        if (p['animalName'] != null && '${p['animalName']}'.isNotEmpty) {
          nro += ' (${p['animalName']})';
        }
        if (p['is5ta'] == true) nro += ' [5ta]';
        if (p['isCombinado'] == true) nro += ' [Comb]';
        final amt = double.tryParse('${p['amount'] ?? 0}') ?? 0;
        sb.writeln('  • $nro -> ${formatCurrency(amt, cur)}');
      }
    });

    final total = double.tryParse('${ticket['total'] ?? 0}') ?? 0;
    sb.writeln('--------------------------------');
    sb.writeln('💰 *TOTAL: ${formatCurrency(total, cur)}*');
    sb.writeln('ℹ️ *Caduca a los 3 días. Conserve su comprobante.*');
    return sb.toString();
  }

  String formatCurrency(num amount, [String? currencyCode]) {
    final cur = (currencyCode ?? _activeCurrency).toUpperCase();
    final val = amount.toDouble();
    if (cur == 'COP') {
      final intVal = val.round();
      final formatted = _formatGroupedInt(intVal, '.');
      return '\$ $formatted';
    } else if (cur == 'VES') {
      final sign = val < 0 ? '-' : '';
      final absVal = val.abs();
      final intPart = absVal.floor();
      final decPart = ((absVal - intPart) * 100).round().toString().padLeft(2, '0');
      return '${sign}Bs. ${_formatGroupedInt(intPart, '.')},$decPart';
    }
    return 'USD \$${val.toStringAsFixed(2)}';
  }

  String _formatGroupedInt(int val, String sep) {
    final neg = val < 0;
    final s = val.abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(sep);
      buf.write(s[i]);
    }
    return neg ? '-$buf' : '$buf';
  }

  String _generateSecuritySerial() {
    final rng = Random();
    String part() => (1000 + rng.nextInt(9000)).toString();
    return '${part()}-${part()}-${part()}';
  }

  static String getTodayIso() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  static String getTodayFormatted() {
    final now = DateTime.now();
    return '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
  }

  static String formatDateTime12h(DateTime dt) {
    final dd = dt.day.toString().padLeft(2, '0');
    final mm = dt.month.toString().padLeft(2, '0');
    final yyyy = dt.year;
    final ampm = dt.hour >= 12 ? 'pm' : 'am';
    var hr = dt.hour % 12;
    if (hr == 0) hr = 12;
    final min = dt.minute.toString().padLeft(2, '0');
    final sec = dt.second.toString().padLeft(2, '0');
    return '$dd/$mm/$yyyy $hr:$min:$sec $ampm';
  }

  static String _formatTimeOnly12h(DateTime dt) {
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    var hr = dt.hour % 12;
    if (hr == 0) hr = 12;
    final min = dt.minute.toString().padLeft(2, '0');
    final sec = dt.second.toString().padLeft(2, '0');
    return '$hr:$min:$sec $ampm';
  }

  Map<String, num> _defaultMultipliers() => {
        'triple': 500,
        'terminal': 60,
        'aproximacion': 5,
        'animalito': 30,
        'cuatroCifrasDirecto': 4500,
        'cuatroCifrasCombinado': 208,
        'la5ta': 25000,
        'astro4': 40000,
        'astro3': 1000,
      };

  Map<String, dynamic> _defaultConfig() => {
        'agencyCode': '1000',
        'agencyName': 'EL CASTAÑO',
        'currency': 'COP',
        'agencyCommissionPct': 15,
        'nextTicketNumber': 10926,
        'multipliers': _defaultMultipliers(),
      };

  List<Map<String, dynamic>> _defaultAgencies() => [
        {
          'code': '1000',
          'name': 'AG PRINCIPAL EL CASTAÑO',
          'manager': 'El Castaño',
          'currency': 'COP',
          'allowedCurrencies': ['COP', 'USD', 'VES'],
          'commissionPct': 15,
          'maxBetLimit': 100000,
          'password': '1000',
          'status': 'ACTIVA',
        },
        {
          'code': '7336',
          'name': 'AG BARRIO SUCRE',
          'manager': 'Carlos Andrés Méndez',
          'currency': 'COP',
          'commissionPct': 15,
          'maxBetLimit': 50000,
          'password': '7336',
          'status': 'ACTIVA',
        },
        {
          'code': '7337',
          'name': 'AG CENTRO QUINTA AVENIDA',
          'manager': 'María Eugenia Chacón',
          'currency': 'VES',
          'commissionPct': 15,
          'maxBetLimit': 800,
          'password': '7337',
          'status': 'ACTIVA',
        },
      ];

  Map<String, dynamic> _buildDefaultMasterData() => {
        'bancaName': 'BANCA EL CASTAÑO',
        'config': _defaultConfig(),
        'agencies': _defaultAgencies(),
        'tickets': <dynamic>[],
        'results': <String, dynamic>{},
        'messages': <dynamic>[],
      };

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    super.dispose();
  }
}
