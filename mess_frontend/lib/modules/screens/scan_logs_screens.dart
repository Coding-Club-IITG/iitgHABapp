import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../apis/manager_api.dart';
import '../../constants/endpoint.dart';
import '../models/manager_models.dart';
import '../widgets/shared_widgets.dart';
import 'user_profile_screen.dart';

class MessMealScanLogsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final String meal;

  const MessMealScanLogsScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
    required this.meal,
  });

  @override
  State<MessMealScanLogsScreen> createState() => _MessMealScanLogsScreenState();
}

class _MessMealScanLogsScreenState extends State<MessMealScanLogsScreen> {
  final List<RecentEntry> _logs = [];
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _connecting = true;
  String? _connectionError;
  Timer? _pollTimer;
  bool _initialLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialLogs();
    _connectWebSocket();
    _startPolling();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadInitialLogs() async {
    try {
      final summary = await ManagerApi.fetchTodayMessSummary(widget.authToken);
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
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _initialLoading = false;
      });
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadInitialLogs();
    });
  }

  void _connectWebSocket() {
    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    final uri = Uri.parse(
      MessManagerEndpoints.mealScanLogsWs(widget.meal, widget.authToken),
    );

    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      setState(() {
        _connecting = false;
      });

      _subscription = channel.stream.listen(
        (event) {
          try {
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

            setState(() {
              _logs.insert(0, entry);
              if (_logs.length > 200) {
                _logs.removeRange(200, _logs.length);
              }
            });
          } catch (e) {
            setState(() {
              _connectionError = 'Failed to parse scan log: $e';
            });
          }
        },
        onError: (error) {
          if (!mounted) return;
          setState(() {
            _connectionError = 'Connection error: $error';
          });
        },
        onDone: () {
          if (!mounted) return;
          setState(() {
            _connectionError ??= 'Connection closed';
          });
        },
      );
    } catch (e) {
      setState(() {
        _connecting = false;
        _connectionError = 'Failed to connect: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = '${widget.meal} Scans';

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
              children: [
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
                      ? const Center(
                          child: Text(
                            'No scans yet.\nNew scans will appear here instantly.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 14,
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
                              onTap: entry.userId.isEmpty
                                  ? null
                                  : () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              ManagerUserProfileScreen(
                                            userId: entry.userId,
                                            authToken: widget.authToken,
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

class GalaCourseScanLogsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final String course;

  const GalaCourseScanLogsScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
    required this.course,
  });

  @override
  State<GalaCourseScanLogsScreen> createState() =>
      _GalaCourseScanLogsScreenState();
}

class _GalaCourseScanLogsScreenState extends State<GalaCourseScanLogsScreen> {
  final List<RecentEntry> _logs = [];
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _connecting = true;
  String? _connectionError;
  Timer? _pollTimer;
  bool _initialLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialLogs();
    _connectWebSocket();
    _startPolling();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _pollTimer?.cancel();
    super.dispose();
  }

  String _recentKeyForCourse() {
    final lower = widget.course.toLowerCase();
    if (lower.startsWith('starter')) return 'starters';
    if (lower.startsWith('main')) return 'mainCourse';
    return 'desserts';
  }

  Future<void> _loadInitialLogs() async {
    try {
      final summary = await ManagerApi.fetchGalaSummary(widget.authToken);
      final recent =
          summary['recent'] as Map<String, dynamic>? ?? <String, dynamic>{};

      final key = _recentKeyForCourse();
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

      entries.sort((a, b) {
        final ta = parseScanTimeForSort(a.time);
        final tb = parseScanTimeForSort(b.time);
        return tb.compareTo(ta);
      });

      if (!mounted) return;
      setState(() {
        _logs
          ..clear()
          ..addAll(entries);
        _initialLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _initialLoading = false;
      });
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadInitialLogs();
    });
  }

  void _connectWebSocket() {
    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    final uri = Uri.parse(GalaManagerEndpoints.wsUrl(widget.authToken));

    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      setState(() {
        _connecting = false;
      });

      _subscription = channel.stream.listen(
        (event) {
          try {
            final data = jsonDecode(event as String) as Map<String, dynamic>;
            final log = GalaScanLog.fromJson(data);

            if (log.mealType != widget.course) {
              return;
            }

            final entry = RecentEntry(
              name: log.userName,
              rollNumber: log.rollNumber,
              time: log.time,
              userId: log.userId,
            );

            setState(() {
              _logs.insert(0, entry);
              if (_logs.length > 200) {
                _logs.removeRange(200, _logs.length);
              }
            });
          } catch (e) {
            setState(() {
              _connectionError = 'Failed to parse scan log: $e';
            });
          }
        },
        onError: (error) {
          if (!mounted) return;
          setState(() {
            _connectionError = 'Connection error: $error';
          });
        },
        onDone: () {
          if (!mounted) return;
          setState(() {
            _connectionError ??= 'Connection closed';
          });
        },
      );
    } catch (e) {
      setState(() {
        _connecting = false;
        _connectionError = 'Failed to connect: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = '${widget.course} Scans';

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
              children: [
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
                const Divider(
                  color: Color(0xFFE5E7EB),
                  height: 1,
                ),
                Expanded(
                  child: _logs.isEmpty
                      ? const Center(
                          child: Text(
                            'No scans yet.\nNew scans will appear here instantly.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 13,
                            ),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                          itemCount: _logs.length,
                          itemBuilder: (context, index) {
                            final entry = _logs[index];
                            final number = _logs.length - index;
                            return GestureDetector(
                              onTap: () {
                                if (entry.userId.isEmpty) return;
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ManagerUserProfileScreen(
                                      userId: entry.userId,
                                      authToken: widget.authToken,
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