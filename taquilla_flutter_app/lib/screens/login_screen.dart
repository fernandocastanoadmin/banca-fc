// lib/screens/login_screen.dart - Autenticación Táctil de Taquilla Enlazada a Firebase
import 'package:flutter/material.dart';
import '../services/firebase_sync_service.dart';

class LoginScreen extends StatefulWidget {
  final BancaFcFirebaseService cloud;

  const LoginScreen({super.key, required this.cloud});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _agencyCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _errorMsg;

  @override
  void dispose() {
    _agencyCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _errorMsg = null;
    });

    final res = await widget.cloud.loginAgency(
      _agencyCtrl.text,
      _passCtrl.text,
    );

    if (!mounted) return;
    setState(() => _loading = false);
    if (!res.success) {
      setState(() => _errorMsg = res.reason ?? 'No se pudo iniciar sesión.');
    }
  }

  Future<void> _showCloudUrlDialog() async {
    final ctrl = TextEditingController(text: widget.cloud.databaseUrl);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF13221C),
        title: const Text('Configurar Nube Firebase'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ingrese la URL de Realtime Database usada por el Panel Central:',
              style: TextStyle(fontSize: 13, color: Colors.white70),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(
                labelText: 'URL Firebase',
                hintText: 'https://tu-proyecto-default-rtdb.firebaseio.com',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              final ok = await widget.cloud.updateFirebaseUrl(ctrl.text);
              if (!ctx.mounted) return;
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    ok
                        ? 'Conectado en vivo a Firebase'
                        : (widget.cloud.lastError ?? 'No se pudo conectar'),
                  ),
                ),
              );
            },
            child: const Text('Conectar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.cloud.status;

    Color statusColor;
    String statusText;
    switch (status) {
      case CloudConnectionStatus.connected:
        statusColor = const Color(0xFF10B981);
        statusText = 'Nube Firebase En Vivo';
        break;
      case CloudConnectionStatus.connecting:
        statusColor = const Color(0xFFF59E0B);
        statusText = 'Conectando a Firebase...';
        break;
      case CloudConnectionStatus.error:
        statusColor = const Color(0xFFEF4444);
        statusText = 'Sin conexión a Firebase';
        break;
      case CloudConnectionStatus.unconfigured:
        statusColor = Colors.grey;
        statusText = 'Nube sin configurar';
        break;
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                color: const Color(0xFF111D18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                  side: const BorderSide(color: Color(0xFF1F3B30)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: statusColor.withOpacity(0.5)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.cloud_done, size: 15, color: statusColor),
                                const SizedBox(width: 6),
                                Text(
                                  statusText,
                                  style: TextStyle(
                                    color: statusColor,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: 'Configurar URL Firebase',
                            onPressed: _showCloudUrlDialog,
                            icon: const Icon(Icons.settings_ethernet, color: Colors.white70),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Center(
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF10B981), Color(0xFF047857)],
                            ),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF10B981).withOpacity(0.35),
                                blurRadius: 18,
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'FC',
                            style: TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'BANCA EL CASTAÑO',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFFBBF24),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Taquilla Móvil & Tablet POS • Seguro Te Paga',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.5, color: Colors.white60),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: _agencyCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Código de Agencia / Usuario',
                          hintText: 'Ingrese su código asignado',
                          prefixIcon: const Icon(Icons.storefront),
                          filled: true,
                          fillColor: const Color(0xFF0B1410),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _passCtrl,
                        obscureText: _obscure,
                        onSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Contraseña POS',
                          hintText: 'Ingrese su contraseña',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure ? Icons.visibility : Icons.visibility_off,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                          filled: true,
                          fillColor: const Color(0xFF0B1410),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                      if (_errorMsg != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.redAccent),
                          ),
                          child: Text(
                            _errorMsg!,
                            style: const TextStyle(
                              color: Color(0xFFFCA5A5),
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 54,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          onPressed: _loading ? null : _submit,
                          icon: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Colors.black,
                                  ),
                                )
                              : const Icon(Icons.login),
                          label: Text(
                            _loading ? 'CONECTANDO...' : 'INGRESAR A TAQUILLA',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
