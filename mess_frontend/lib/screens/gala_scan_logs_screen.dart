import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../constants/endpoint.dart';
import '../models/gala_scan_log.dart';
import '../providers/auth_controller.dart';
import '../util/ws_uri_log.dart';

/// Full-screen live Gala scan log viewer (tabs per course). Currently unused by navigation.
class GalaScanLogsScreen extends StatefulWidget {
  const GalaScanLogsScreen({super.key, required this.hostelName});

  final String hostelName;

  @override
  State<GalaScanLogsScreen> createState() => _GalaScanLogsScreenState();
}

class _GalaScanLogsScreenState extends State<GalaScanLogsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;

  final List<GalaScanLog> _startersLogs = [];
  final List<GalaScanLog> _mainCourseLogs = [];
  final List<GalaScanLog> _dessertsLogs = [];

  bool _connecting = true;
  String? _connectionError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _connectWebSocket();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _tabController.dispose();
    super.dispose();
  }

  void _connectWebSocket() {
    _subscription?.cancel();
    _channel?.sink.close();

    final token = context.read<AuthController>().token;
    if (token == null) {
      setState(() {
        _connecting = false;
        _connectionError = 'Not signed in.';
      });
      return;
    }

    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    final uri = Uri.parse(GalaManagerEndpoints.wsUrl(token));
    debugPrintWsConnect('GalaScanLogs', uri);

    final channel = WebSocketChannel.connect(uri);
    _channel = channel;

    _subscription = channel.stream.listen(
      (event) {
        try {
          final data = jsonDecode(event as String) as Map<String, dynamic>;
          final log = GalaScanLog.fromJson(data);
          setState(() {
            _connecting = false;
            _addLog(log);
          });
        } catch (e) {
          setState(() {
            _connectionError = 'Failed to parse scan log: $e';
            _connecting = false;
          });
        }
      },
      onError: (error) {
        if (!mounted) return;
        setState(() {
          _connectionError = 'Connection error: $error';
          _connecting = false;
        });
      },
      onDone: () {
        if (!mounted) return;
        setState(() {
          _connecting = false;
          _connectionError ??= 'Connection closed';
        });
      },
    );
  }

  void _addLog(GalaScanLog log) {
    List<GalaScanLog> target;
    switch (log.mealType) {
      case 'Starters':
        target = _startersLogs;
        break;
      case 'Main Course':
        target = _mainCourseLogs;
        break;
      case 'Desserts':
        target = _dessertsLogs;
        break;
      default:
        target = _mainCourseLogs;
    }
    target.insert(0, log);
    if (target.length > 200) {
      target.removeRange(200, target.length);
    }
  }

  void _clearLogs() {
    setState(() {
      _startersLogs.clear();
      _mainCourseLogs.clear();
      _dessertsLogs.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1D40),
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gala Dinner Scans',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            Text(
              widget.hostelName,
              style: const TextStyle(fontSize: 13, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Clear logs',
            onPressed: _clearLogs,
            icon: const Icon(Icons.delete_outline),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Starters'),
                  const SizedBox(width: 6),
                  _buildCountChip(_startersLogs.length),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Main'),
                  const SizedBox(width: 6),
                  _buildCountChip(_mainCourseLogs.length),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Desserts'),
                  const SizedBox(width: 6),
                  _buildCountChip(_dessertsLogs.length),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B1220), Color(0xFF0F172A)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              if (_connecting || _connectionError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      if (_connecting)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Color(0xFF22C55E),
                            ),
                          ),
                        )
                      else
                        const Icon(
                          Icons.error_outline,
                          color: Color(0xFFF97316),
                          size: 20,
                        ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _connecting
                              ? 'Connecting to live scan stream...'
                              : _connectionError ?? 'Connection closed',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (!_connecting)
                        TextButton(
                          onPressed: _connectWebSocket,
                          child: const Text(
                            'Reconnect',
                            style: TextStyle(
                              color: Color(0xFF60A5FA),
                              fontSize: 13,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildLogList(_startersLogs, 'Starters'),
                    _buildLogList(_mainCourseLogs, 'Main Course'),
                    _buildLogList(_dessertsLogs, 'Desserts'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCountChip(int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF4B5563),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          fontSize: 11,
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildLogList(List<GalaScanLog> logs, String category) {
    if (logs.isEmpty) {
      return Center(
        child: Text(
          'No $category scans yet.\nNew scans will appear here instantly.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, fontSize: 14),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: logs.length,
      itemBuilder: (context, index) {
        final log = logs[index];
        final isDuplicate = log.alreadyScanned;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF111827),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDuplicate
                  ? const Color(0xFFF97316)
                  : const Color(0xFF22C55E),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isDuplicate
                      ? const Color(0xFF7C2D12)
                      : const Color(0xFF14532D),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Icon(
                  isDuplicate ? Icons.warning_amber_rounded : Icons.check,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      log.userName.isEmpty ? 'Unknown' : log.userName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (log.rollNumber.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          log.rollNumber,
                          style: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    log.time,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: isDuplicate
                          ? const Color(0xFF7C2D12)
                          : const Color(0xFF14532D),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      isDuplicate ? 'Duplicate' : 'New',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
