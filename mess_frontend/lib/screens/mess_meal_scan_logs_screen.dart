import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../apis/manager_api.dart';
import '../constants/endpoint.dart';
import '../models/recent_entry.dart';
import '../providers/auth_controller.dart';
import '../util/ws_uri_log.dart';
import '../widgets/recent_scan_card.dart';
import 'manager_user_profile_screen.dart';

class MessMealScanLogsScreen extends StatefulWidget {
  const MessMealScanLogsScreen({super.key, required this.meal});

  final String meal;

  @override
  State<MessMealScanLogsScreen> createState() =>
      _MessMealScanLogsScreenState();
}

class _MessMealScanLogsScreenState extends State<MessMealScanLogsScreen> {
  final List<RecentEntry> _logs = [];
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  bool _connecting = true;
  String? _connectionError;
  Timer? _pollTimer;
  bool _initialLoading = true;
  String? _initialFetchError;

  @override
  void initState() {
    super.initState();
    _loadInitialLogs();
    _startFallbackPolling();
    _connectWebSocket();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startFallbackPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadInitialLogs();
    });
  }

  void _stopFallbackPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _loadInitialLogs() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;
    try {
      final summary = await ManagerApi.fetchTodayMessSummary(token);
      final recent =
          summary['recent'] as Map<String, dynamic>? ?? <String, dynamic>{};

      String key;
      switch (widget.meal.toLowerCase()) {
        case 'breakfast':
          key = 'breakfast';
          break;
        case 'lunch':
          key = 'lunch';
          break;
        default:
          key = 'dinner';
      }

      final list = recent[key] as List<dynamic>? ?? const [];
      final entries = list.map((raw) {
        final m = raw as Map<String, dynamic>;
        return RecentEntry(
          name: (m['name'] ?? '') as String,
          rollNumber: (m['rollNumber'] ?? '') as String,
          time: (m['time'] ?? '') as String,
          userId: (m['userId'] ?? '') as String,
        );
      }).toList();

      if (!mounted) return;
      setState(() {
        _logs
          ..clear()
          ..addAll(entries);
        _initialLoading = false;
        _initialFetchError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initialLoading = false;
        _initialFetchError ??= e.toString();
      });
    }
  }

  void _reconnect() {
    _subscription?.cancel();
    _channel?.sink.close();
    _subscription = null;
    _channel = null;
    setState(() {
      _connectionError = null;
    });
    _startFallbackPolling();
    _connectWebSocket();
  }

  void _connectWebSocket() {
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

    final uri = Uri.parse(
      MessManagerEndpoints.mealScanLogsWs(widget.meal, token),
    );
    debugPrintWsConnect('MessMealScanLogs', uri, extra: 'meal=${widget.meal}');

    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      setState(() {
        _connecting = false;
      });

      _stopFallbackPolling();

      _subscription = channel.stream.listen(
        (event) {
          try {
            if (kDebugMode) {
              debugPrint('[MessMealScanLogs] WS message for ${widget.meal}');
            }
            final data = jsonDecode(event as String) as Map<String, dynamic>;
            final user = data['user'] as Map<String, dynamic>? ?? {};
            final name = (user['name'] ?? '') as String;
            final roll = (user['rollNumber'] ?? '') as String;
            final time = (data['time'] ?? '') as String;
            final userId = (user['_id'] ?? '') as String;

            final entry = RecentEntry(
              name: name,
              rollNumber: roll,
              time: time,
              userId: userId,
            );

            if (!mounted) return;
            setState(() {
              _connectionError = null;
              _logs.insert(0, entry);
              if (_logs.length > 200) {
                _logs.removeRange(200, _logs.length);
              }
            });
          } catch (e) {
            if (!mounted) return;
            setState(() {
              _connectionError = 'Failed to parse scan log: $e';
            });
          }
        },
        onError: (error) {
          if (!mounted) return;
          if (kDebugMode) {
            debugPrint(
                '[MessMealScanLogs] WS error for ${widget.meal}: $error');
          }
          setState(() {
            _connectionError = 'Connection error: $error';
          });
          _startFallbackPolling();
        },
        onDone: () {
          if (!mounted) return;
          if (kDebugMode) {
            debugPrint(
                '[MessMealScanLogs] WS done for ${widget.meal} (closed by server/client)');
          }
          setState(() {
            _connectionError ??= 'Connection closed';
          });
          _startFallbackPolling();
        },
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _connecting = false;
        _connectionError = 'Failed to connect: $e';
      });
      _startFallbackPolling();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = '${widget.meal} Scans';
    final token = context.watch<AuthController>().token;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          title,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: _initialLoading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_initialFetchError != null)
                  Material(
                    color: const Color(0xFFFFF7ED),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.wifi_off_outlined,
                            color: Color(0xFF9A3412),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Could not refresh list: $_initialFetchError',
                              style: const TextStyle(
                                color: Color(0xFF9A3412),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() => _initialFetchError = null);
                              _loadInitialLogs();
                            },
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_connectionError != null)
                  Material(
                    color: const Color(0xFFFFF7ED),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.link_off,
                            color: Color(0xFF9A3412),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _connectionError!,
                              style: const TextStyle(
                                color: Color(0xFF9A3412),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _reconnect,
                            child: const Text('Reconnect'),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_logs.isNotEmpty && _connecting)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    child: Row(
                      children: const [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Connecting to live scans...',
                            style: TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: _logs.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'No scans yet.\nNew scans will appear here when the live feed is connected.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Color(0xFF6B7280),
                                    fontSize: 14,
                                  ),
                                ),
                                if (_initialFetchError != null) ...[
                                  const SizedBox(height: 12),
                                  TextButton.icon(
                                    onPressed: _loadInitialLogs,
                                    icon: const Icon(Icons.refresh),
                                    label: const Text('Reload from server'),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          itemCount: _logs.length,
                          itemBuilder: (context, index) {
                            final entry = _logs[index];
                            final number = _logs.length - index;
                            return GestureDetector(
                              onTap: entry.userId.isEmpty || token == null
                                  ? null
                                  : () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) =>
                                              ManagerUserProfileScreen(
                                            userId: entry.userId,
                                          ),
                                        ),
                                      );
                                    },
                              child: RecentScanCard(
                                entry: entry,
                                index: number,
                                showIndex: true,
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
