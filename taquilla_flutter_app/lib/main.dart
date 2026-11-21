// lib/main.dart - Banca El Castaño App Móvil & Tablet POS
import 'dart:async';
import 'package:flutter/material.dart';
import 'services/firebase_sync_service.dart';
import 'screens/login_screen.dart';
import 'screens/pos_sell_screen.dart';
import 'screens/tickets_screen.dart';
import 'screens/prizes_results_screen.dart';
import 'screens/cashier_screen.dart';
import 'screens/cloud_config_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BancaFcTaquillaApp());
}

class BancaFcTaquillaApp extends StatefulWidget {
  const BancaFcTaquillaApp({super.key});

  @override
  State<BancaFcTaquillaApp> createState() => _BancaFcTaquillaAppState();
}

class _BancaFcTaquillaAppState extends State<BancaFcTaquillaApp> {
  final BancaFcFirebaseService _cloud = BancaFcFirebaseService();

  @override
  void dispose() {
    _cloud.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _cloud,
      builder: (context, _) {
        return MaterialApp(
          title: 'Banca El Castaño Taquilla',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.dark,
            scaffoldBackgroundColor: const Color(0xFF0B1410),
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF10B981),
              brightness: Brightness.dark,
              primary: const Color(0xFF10B981),
              secondary: const Color(0xFFFBBF24),
              surface: const Color(0xFF111D18),
            ),
          ),
          home: _cloud.isLoggedIn
              ? TaquillaShell(cloud: _cloud)
              : LoginScreen(cloud: _cloud),
        );
      },
    );
  }
}

class TaquillaShell extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const TaquillaShell({super.key, required this.cloud});

  @override
  State<TaquillaShell> createState() => _TaquillaShellState();
}

class _TaquillaShellState extends State<TaquillaShell> {
  int _tabIndex = 0;
  String _clockLabel = '';
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _updateClock();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateClock();
    });
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  void _updateClock() {
    final now = DateTime.now();
    final ampm = now.hour >= 12 ? 'PM' : 'AM';
    var hr = now.hour % 12;
    if (hr == 0) hr = 12;
    final min = now.minute.toString().padLeft(2, '0');
    final sec = now.second.toString().padLeft(2, '0');
    if (mounted) {
      setState(() => _clockLabel = '$hr:$min:$sec $ampm');
    }
  }

  @override
  Widget build(BuildContext context) {
    final agCode = widget.cloud.loggedAgencyCode ?? '1000';
    final nextNum = widget.cloud.nextTicketNumber.toString().padLeft(8, '0');
    final status = widget.cloud.status;

    final badgeColor = status == CloudConnectionStatus.connected
        ? const Color(0xFF10B981)
        : (status == CloudConnectionStatus.error
            ? Colors.redAccent
            : const Color(0xFFFBBF24));

    final pages = [
      PosSellScreen(cloud: widget.cloud),
      TicketsScreen(cloud: widget.cloud),
      PrizesResultsScreen(cloud: widget.cloud),
      OfficialResultsScreen(cloud: widget.cloud),
      CashierScreen(cloud: widget.cloud),
      CloudConfigScreen(cloud: widget.cloud),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF07110C),
        elevation: 0,
        titleSpacing: 12,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: const Text(
                'FC',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AGENCIA $agCode • ${widget.cloud.activeCurrency}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFFBBF24),
                    ),
                  ),
                  Text(
                    'Ticket #$nextNum • $_clockLabel',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: ActionChip(
              backgroundColor: badgeColor.withOpacity(0.15),
              side: BorderSide(color: badgeColor.withOpacity(0.6)),
              avatar: Icon(Icons.cloud_done, size: 15, color: badgeColor),
              label: Text(
                status == CloudConnectionStatus.connected ? 'NUBE OK' : 'SYNC',
                style: TextStyle(
                  color: badgeColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              onPressed: () => setState(() => _tabIndex = 5),
            ),
          ),
        ],
      ),
      body: IndexedStack(index: _tabIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(0xFF07110C),
        indicatorColor: const Color(0xFF064E3B),
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale, color: Color(0xFF4ADE80)),
            label: 'Vender',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long, color: Color(0xFF4ADE80)),
            label: 'Tickets',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            selectedIcon: Icon(Icons.emoji_events, color: Color(0xFFFBBF24)),
            label: 'Premios',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            selectedIcon: Icon(Icons.fact_check, color: Color(0xFF4ADE80)),
            label: 'Resultados',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(
              Icons.account_balance_wallet,
              color: Color(0xFF4ADE80),
            ),
            label: 'Caja',
          ),
          NavigationDestination(
            icon: Icon(Icons.cloud_outlined),
            selectedIcon: Icon(Icons.cloud, color: Color(0xFF4ADE80)),
            label: 'Nube',
          ),
        ],
      ),
    );
  }
}
