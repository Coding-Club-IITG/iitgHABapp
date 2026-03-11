import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'apis/manager_api.dart';
import 'constants/endpoint.dart';
import 'constants/themes.dart';
import 'utilities/hq_version_checker.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Check device type and app version on startup (same flow as frontend2)
  await HqVersionChecker.init();
  final bool updateRequired = await HqVersionChecker.checkForUpdate();

  runApp(MessManagerApp(updateRequired: updateRequired));
}

// ---- App root (same pattern as frontend2 MyApp) ----

class MessManagerApp extends StatelessWidget {
  final bool updateRequired;

  const MessManagerApp({super.key, required this.updateRequired});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'HABit HQ',
      theme: Themes.theme.copyWith(
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Color(0xFFF9FAFB),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFFE5E7EB)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFFE5E7EB)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFF4C4EDB), width: 1.5),
          ),
          hintStyle: TextStyle(color: Color(0xFF6B7280), fontSize: 14),
        ),
      ),
      home: updateRequired
          ? const UpdateRequiredScreen()
          : const MessManagerLoginScreen(),
    );
  }
}

// ---- Update required screen (same UI as frontend2 UpdateRequiredScreen) ----

class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0B1220),
              Color(0xFF0F172A),
            ],
          ),
        ),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1A000000),
                  blurRadius: 16,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Update Required',
                  style: TextStyle(
                    color: Color(0xFF2563EB),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  HqVersionChecker.updateMessage,
                  style: const TextStyle(
                    color: Color(0xFF1A1A2E),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    onPressed: () => HqVersionChecker.openStore(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4C4EDB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Update',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---- Login screen: hostel dropdown + password ----

class MessManagerLoginScreen extends StatefulWidget {
  const MessManagerLoginScreen({super.key});

  @override
  State<MessManagerLoginScreen> createState() => _MessManagerLoginScreenState();
}

class _MessManagerLoginScreenState extends State<MessManagerLoginScreen> {
  final TextEditingController _passwordController = TextEditingController();
  final ValueNotifier<List<String>> _hostels = ValueNotifier<List<String>>(
    <String>[],
  );
  String? _selectedHostel;
  bool _loadingHostels = true;
  bool _loggingIn = false;

  @override
  void initState() {
    super.initState();
    _loadHostels();
  }

  Future<void> _loadHostels() async {
    final prefs = await SharedPreferences.getInstance();
    try {
      // Debug logging to understand real-device behaviour
      debugPrint(
          '[MessManagerLogin] Starting _loadHostels; endpoint=${HostelEndpoints.allHostels}');
      final hostels = await ManagerApi.fetchHostels();
      debugPrint(
          '[MessManagerLogin] _loadHostels success, got ${hostels.length} hostels');
      if (!mounted) return;
      _hostels.value = hostels;
      await prefs.setStringList('mm_hostels', hostels);
      setState(() {
        _loadingHostels = false;
        if (hostels.isNotEmpty) _selectedHostel ??= hostels.first;
      });
      return;
    } catch (e, st) {
      debugPrint('[MessManagerLogin] _loadHostels error: $e');
      debugPrint('[MessManagerLogin] stack: $st');
      // Fallback to cached hostels if API fails
      final cached = prefs.getStringList('mm_hostels');
      if (cached != null && cached.isNotEmpty) {
        if (!mounted) return;
        _hostels.value = cached;
        setState(() {
          _loadingHostels = false;
          if (cached.isNotEmpty) _selectedHostel ??= cached.first;
        });
        debugPrint(
            '[MessManagerLogin] Using cached hostels (${cached.length})');
        return;
      }
    }

    if (!mounted) return;
    setState(() {
      _loadingHostels = false;
    });
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _hostels.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final messenger = ScaffoldMessenger.of(context);
    debugPrint(
      '[MessManagerLogin] _login tapped; selectedHostel=$_selectedHostel, '
      'passwordLength=${_passwordController.text.trim().length}',
    );

    if (_selectedHostel == null || _selectedHostel!.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please select a hostel')),
      );
      return;
    }
    if (_passwordController.text.trim().isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please enter the hostel password')),
      );
      return;
    }

    setState(() {
      _loggingIn = true;
    });

    try {
      debugPrint(
        '[MessManagerLogin] Calling ManagerApi.loginManager for '
        'hostel=$_selectedHostel',
      );
      final data = await ManagerApi.loginManager(
        hostelName: _selectedHostel!,
        password: _passwordController.text.trim(),
      );
      final success = data['success'] == true;
      final token = data['token']?.toString();

      if (!success || token == null) {
        final msg =
            data['message']?.toString() ?? 'Invalid hostel or password.';
        messenger.showSnackBar(SnackBar(content: Text(msg)));
        setState(() {
          _loggingIn = false;
        });
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('mm_hostelName', _selectedHostel!);
      await prefs.setString('mm_token', token);

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ManagerHomeScreen(
            hostelName: _selectedHostel!,
            authToken: token,
          ),
        ),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Login failed: $e')));
      setState(() {
        _loggingIn = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              const Text(
                'HABit HQ',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select your hostel and enter the manager password to view mess & Gala Dinner scans.',
                style: TextStyle(
                  color: Color(0xFF4B5563),
                  fontSize: 14,
                ),
              ),
              SizedBox(height: size.height * 0.04),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 20,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 12,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hostel',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_loadingHostels)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else
                      ValueListenableBuilder<List<String>>(
                        valueListenable: _hostels,
                        builder: (context, hostels, _) {
                          debugPrint(
                            '[MessManagerLogin] Dropdown builder: '
                            'loading=$_loadingHostels, '
                            'hostelCount=${hostels.length}, '
                            'selectedHostel=$_selectedHostel',
                          );
                          return Theme(
                            data: Theme.of(context)
                                .copyWith(canvasColor: Colors.white),
                            child: DropdownButtonFormField<String>(
                              initialValue: _selectedHostel,
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFFF9FAFB),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFE5E7EB),
                                  ),
                                ),
                              ),
                              dropdownColor: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              iconEnabledColor: const Color(0xFF111827),
                              iconDisabledColor: const Color(0xFF9CA3AF),
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF111827),
                              ),
                              items: hostels
                                  .map(
                                    (h) => DropdownMenuItem<String>(
                                      value: h,
                                      child: Text(
                                        h,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Color(0xFF111827),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedHostel = value;
                                });
                              },
                              hint: const Text(
                                'Select hostel',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 16),
                    const Text(
                      'Password',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      style: const TextStyle(
                        color: Color(0xFF111827),
                        fontSize: 14,
                      ),
                      cursorColor: const Color(0xFF4C4EDB),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFFF9FAFB),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFFE5E7EB),
                          ),
                        ),
                        hintText: 'Enter hostel password',
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _loggingIn ? null : _login,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4C4EDB),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _loggingIn
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Continue',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---- Model + logs screen (read-only, WebSocket) ----

class GalaScanLog {
  final String userId;
  final String userName;
  final String rollNumber;
  final String mealType;
  final String time;
  final bool alreadyScanned;

  GalaScanLog({
    required this.userId,
    required this.userName,
    required this.rollNumber,
    required this.mealType,
    required this.time,
    required this.alreadyScanned,
  });

  factory GalaScanLog.fromJson(Map<String, dynamic> json) {
    final user = json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : <String, dynamic>{};
    return GalaScanLog(
      userId: user['_id']?.toString() ?? '',
      userName: user['name']?.toString() ?? '',
      rollNumber: user['rollNumber']?.toString() ?? '',
      mealType: json['mealType']?.toString() ?? '',
      time: json['time']?.toString() ?? '',
      alreadyScanned: json['alreadyScanned'] == true,
    );
  }
}

/// Manager home with bottom navigation: Today Mess, Gala Dinner.
class ManagerHomeScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const ManagerHomeScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  int _currentIndex = 0;
  bool _galaInitialized = false;

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      TodayMessScreen(
        hostelName: widget.hostelName,
        authToken: widget.authToken,
      ),
      // Lazily create GalaSummaryScreen only after the Gala tab is visited
      if (_galaInitialized)
        GalaSummaryScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
        )
      else
        const SizedBox.shrink(),
    ];

    final items = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(
        icon: Icon(Icons.restaurant),
        label: 'Today Mess',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.celebration),
        label: 'Gala Dinner',
      ),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        items: items,
        onTap: (index) {
          setState(() {
            if (index == 1) {
              _galaInitialized = true;
            }
            _currentIndex = index;
          });
        },
        selectedItemColor: const Color(0xFF111827),
        unselectedItemColor: const Color(0xFF9CA3AF),
        backgroundColor: Colors.white,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}

// ---- Today Mess summary screen (auto-refreshing) ----

class TodayMessScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const TodayMessScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<TodayMessScreen> createState() => _TodayMessScreenState();
}

class _TodayMessScreenState extends State<TodayMessScreen> {
  bool _loading = true;
  String? _error;
  List<_RecentEntry> _breakfastEntries = const [];
  List<_RecentEntry> _lunchEntries = const [];
  List<_RecentEntry> _dinnerEntries = const [];
  Timer? _timer;
  Map<String, int> _totals = const {
    'breakfast': 0,
    'lunch': 0,
    'dinner': 0,
  };

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _openMealLogs(BuildContext context, String meal) async {
    // Temporarily stop polling while on the dedicated screen.
    _timer?.cancel();
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MessMealScanLogsScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
          meal: meal,
        ),
      ),
    );
    if (mounted) {
      _startTimer();
      _fetch();
    }
  }

  @override
  void initState() {
    super.initState();
    _fetch();
    // Poll every 5 seconds so new scans appear automatically.
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final data = await ManagerApi.fetchTodayMessSummary(widget.authToken);
      final recentMap =
          (data['recent'] as Map<String, dynamic>? ?? <String, dynamic>{});

      final totalsMap =
          (data['totals'] as Map<String, dynamic>? ?? <String, dynamic>{});

      List<_RecentEntry> breakfast = _mapRecent(recentMap['breakfast']);
      List<_RecentEntry> lunch = _mapRecent(recentMap['lunch']);
      List<_RecentEntry> dinner = _mapRecent(recentMap['dinner']);

      int compareByTime(_RecentEntry a, _RecentEntry b) {
        final ta = _parseScanTimeForSort(a.time);
        final tb = _parseScanTimeForSort(b.time);
        return tb.compareTo(ta); // newest first
      }

      breakfast.sort(compareByTime);
      lunch.sort(compareByTime);
      dinner.sort(compareByTime);

      if (!mounted) return;
      setState(() {
        _breakfastEntries = breakfast;
        _lunchEntries = lunch;
        _dinnerEntries = dinner;
        _totals = {
          'breakfast': (totalsMap['breakfast'] as int?) ?? 0,
          'lunch': (totalsMap['lunch'] as int?) ?? 0,
          'dinner': (totalsMap['dinner'] as int?) ?? 0,
        };
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorState(
        message: 'Failed to load today\'s scans.\n$_error',
      );
    }

    // Merge all meals for "recent" view (limited to 20)
    final allMerged = <_RecentEntry>[
      ..._breakfastEntries,
      ..._lunchEntries,
      ..._dinnerEntries,
    ];
    allMerged.sort((a, b) {
      final ta = _parseScanTimeForSort(a.time);
      final tb = _parseScanTimeForSort(b.time);
      return tb.compareTo(ta);
    });
    final visibleEntries =
        allMerged.length > 20 ? allMerged.take(20).toList() : allMerged;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Today\'s Mess',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.hostelName,
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Total Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Breakfast'),
                      child: _TotalPill(
                        label: 'Breakfast',
                        count: _totals['breakfast'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Lunch'),
                      child: _TotalPill(
                        label: 'Lunch',
                        count: _totals['lunch'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openMealLogs(context, 'Dinner'),
                      child: _TotalPill(
                        label: 'Dinner',
                        count: _totals['dinner'] ?? 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Recent Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
        const Divider(
          color: Color(0xFFE5E7EB),
          height: 1,
        ),
        Expanded(
          child: visibleEntries.isEmpty
              ? const Center(
                  child: Text(
                    'No scans yet for today.\nNew scans will appear here instantly.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 13,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  itemCount: visibleEntries.length,
                  itemBuilder: (context, index) {
                    final entry = visibleEntries[index];
                    return GestureDetector(
                      onTap: entry.userId.isEmpty
                          ? null
                          : () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ManagerUserProfileScreen(
                                    userId: entry.userId,
                                    authToken: widget.authToken,
                                  ),
                                ),
                              );
                            },
                      child: _RecentScanCard(entry: entry),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// ---- Gala Dinner summary screen ----

class GalaSummaryScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const GalaSummaryScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<GalaSummaryScreen> createState() => _GalaSummaryScreenState();
}

class _GalaSummaryScreenState extends State<GalaSummaryScreen> {
  bool _loading = true;
  String? _error;
  List<_RecentEntry> _startersEntries = const [];
  List<_RecentEntry> _mainCourseEntries = const [];
  List<_RecentEntry> _dessertsEntries = const [];
  Timer? _timer;
  Map<String, int> _totals = const {
    'starters': 0,
    'mainCourse': 0,
    'desserts': 0,
  };
  bool _hasGalaToday = false;

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _openCourseLogs(BuildContext context, String course) async {
    _timer?.cancel();
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GalaCourseScanLogsScreen(
          hostelName: widget.hostelName,
          authToken: widget.authToken,
          course: course,
        ),
      ),
    );
    if (mounted) {
      _startTimer();
      _fetch();
    }
  }

  @override
  void initState() {
    super.initState();
    _fetch();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final data = await ManagerApi.fetchGalaSummary(widget.authToken);
      final gala = data['galaDinner'];
      if (gala == null) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = null;
          _hasGalaToday = false;
          _startersEntries = const [];
          _mainCourseEntries = const [];
          _dessertsEntries = const [];
          _totals = const {
            'starters': 0,
            'mainCourse': 0,
            'desserts': 0,
          };
        });
        return;
      }

      final recentMap =
          (data['recent'] as Map<String, dynamic>? ?? <String, dynamic>{});
      final totalsMap =
          (data['totals'] as Map<String, dynamic>? ?? <String, dynamic>{});

      List<_RecentEntry> starters = _mapRecent(recentMap['starters']);
      List<_RecentEntry> main = _mapRecent(recentMap['mainCourse']);
      List<_RecentEntry> desserts = _mapRecent(recentMap['desserts']);

      int compareByTime(_RecentEntry a, _RecentEntry b) {
        final ta = _parseScanTimeForSort(a.time);
        final tb = _parseScanTimeForSort(b.time);
        return tb.compareTo(ta); // newest first
      }

      starters.sort(compareByTime);
      main.sort(compareByTime);
      desserts.sort(compareByTime);

      if (!mounted) return;
      setState(() {
        _startersEntries = starters;
        _mainCourseEntries = main;
        _dessertsEntries = desserts;
        _totals = {
          'starters': (totalsMap['starters'] as int?) ?? 0,
          'mainCourse': (totalsMap['mainCourse'] as int?) ?? 0,
          'desserts': (totalsMap['desserts'] as int?) ?? 0,
        };
        _hasGalaToday = true;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorState(
        message: 'Failed to load Gala Dinner scans.\n$_error',
      );
    }
    if (!_hasGalaToday) {
      return const Center(
        child: Text(
          'No Gala Dinner Scheduled for Today',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF6B7280),
            fontSize: 14,
          ),
        ),
      );
    }

    final allMerged = <_RecentEntry>[
      ..._startersEntries,
      ..._mainCourseEntries,
      ..._dessertsEntries,
    ];
    allMerged.sort((a, b) {
      final ta = _parseScanTimeForSort(a.time);
      final tb = _parseScanTimeForSort(b.time);
      return tb.compareTo(ta);
    });
    final visibleEntries =
        allMerged.length > 20 ? allMerged.take(20).toList() : allMerged;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Gala Dinner',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.hostelName,
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Total Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Starters'),
                      child: _TotalPill(
                        label: 'Starters',
                        count: _totals['starters'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Main Course'),
                      child: _TotalPill(
                        label: 'Main',
                        count: _totals['mainCourse'] ?? 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCourseLogs(context, 'Desserts'),
                      child: _TotalPill(
                        label: 'Desserts',
                        count: _totals['desserts'] ?? 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Recent Scans',
                style: TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
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
          child: visibleEntries.isEmpty
              ? const Center(
                  child: Text(
                    'No Gala Dinner scans yet for today.\nNew scans will appear here instantly.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 13,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: visibleEntries.length,
                  itemBuilder: (context, index) {
                    final entry = visibleEntries[index];
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
                      child: _RecentScanCard(entry: entry),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// ---- Shared UI helpers ----

class _SectionData {
  final String label;
  final List<_RecentEntry> entries;
  final String emptyText;

  const _SectionData({
    required this.label,
    required this.entries,
    required this.emptyText,
  });
}

class _RecentEntry {
  final String name;
  final String rollNumber;
  final String time;
  final String userId;

  const _RecentEntry({
    required this.name,
    required this.rollNumber,
    required this.time,
    required this.userId,
  });
}

List<_RecentEntry> _mapRecent(dynamic raw) {
  if (raw is! List) return const [];
  return raw.map<_RecentEntry>((item) {
    final m = item as Map<String, dynamic>;
    return _RecentEntry(
      name: (m['name'] ?? '') as String,
      rollNumber: (m['rollNumber'] ?? '') as String,
      time: (m['time'] ?? '') as String,
      userId: (m['userId'] ?? '') as String,
    );
  }).toList();
}

String _formatScanTime(String raw) {
  // Try strict ISO parsing first. Convert to local timezone so that
  // ISO strings like "2026-03-05T10:15:00.000Z" (UTC) show as IST on device.
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt != null) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  // Fallback: extract the first HH:mm substring from arbitrary text.
  final regex = RegExp(r'(\d{1,2}:\d{2})');
  final match = regex.firstMatch(raw);
  if (match != null) {
    return match.group(1)!;
  }

  // Last resort: return as-is.
  return raw;
}

DateTime _parseScanTimeForSort(String raw) {
  // Prefer strict ISO timestamps if available.
  final iso = DateTime.tryParse(raw);
  if (iso != null) return iso;

  // Otherwise, try to extract HH:mm and treat it as "today" in local time.
  final regex = RegExp(r'(\d{1,2}):(\d{2})');
  final match = regex.firstMatch(raw);
  if (match != null) {
    final h = int.tryParse(match.group(1)!);
    final m = int.tryParse(match.group(2)!);
    if (h != null && m != null) {
      final now = DateTime.now();
      return DateTime(now.year, now.month, now.day, h, m);
    }
  }

  // Fallback very old date so invalid timestamps sink to the bottom.
  return DateTime.fromMillisecondsSinceEpoch(0);
}

// ignore: unused_element
class _ScansLayout extends StatelessWidget {
  final String title;
  final String subtitle;
  final Map<String, dynamic> totals;
  final List<_SectionData> sections;

  const _ScansLayout({
    required this.title,
    required this.subtitle,
    required this.totals,
    required this.sections,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: totals.entries.map((e) {
                  return _TotalPill(
                    label: e.key,
                    count: (e.value as int?) ?? 0,
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const Divider(
          color: Color(0xFFE5E7EB),
          height: 1,
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            itemCount: sections.length,
            itemBuilder: (context, index) {
              final section = sections[index];
              return _SectionCard(section: section);
            },
          ),
        ),
      ],
    );
  }
}

class _TotalPill extends StatelessWidget {
  final String label;
  final int count;

  const _TotalPill({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$count',
            style: const TextStyle(
              color: Color(0xFF111827),
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final _SectionData section;

  const _SectionCard({required this.section});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.label,
            style: const TextStyle(
              color: Color(0xFF111827),
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          if (section.entries.isEmpty)
            Text(
              section.emptyText,
              style: const TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 13,
              ),
            )
          else
            Column(
              children: section.entries.map((e) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.name.isEmpty ? 'Unknown' : e.name,
                              style: const TextStyle(
                                color: Color(0xFF111827),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (e.rollNumber.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  e.rollNumber,
                                  style: const TextStyle(
                                    color: Color(0xFF6B7280),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        e.time,
                        style: const TextStyle(
                          color: Color(0xFF4C4EDB),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

class _RecentScanCard extends StatelessWidget {
  final _RecentEntry entry;
  final int? index;
  final bool showIndex;

  const _RecentScanCard({
    required this.entry,
    this.index,
    this.showIndex = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayName =
        entry.name.isEmpty ? 'Unknown' : entry.name.trim();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          if (showIndex && index != null) ...[
            Text(
              '${index!}.',
              style: const TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              displayName,
              style: const TextStyle(
                color: Color(0xFF111827),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _formatScanTime(entry.time),
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ---- Live Mess meal scan logs (WebSocket) ----

class MessMealScanLogsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final String meal; // "Breakfast" | "Lunch" | "Dinner"

  const MessMealScanLogsScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
    required this.meal,
  });

  @override
  State<MessMealScanLogsScreen> createState() =>
      _MessMealScanLogsScreenState();
}

class _MessMealScanLogsScreenState extends State<MessMealScanLogsScreen> {
  final List<_RecentEntry> _logs = [];
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
      final summary =
          await ManagerApi.fetchTodayMessSummary(widget.authToken);
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
        return _RecentEntry(
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
      // Ignore initial load errors; screen will still work live via WebSocket.
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
    debugPrint(
        '[MessMealScanLogs] Connecting WS for meal=${widget.meal} -> $uri');

    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      setState(() {
        _connecting = false;
      });

      _subscription = channel.stream.listen(
        (event) {
          try {
            debugPrint(
                '[MessMealScanLogs] WS message for ${widget.meal}: $event');
            final data = jsonDecode(event as String) as Map<String, dynamic>;
            final user = data['user'] as Map<String, dynamic>? ?? {};
            final name = (user['name'] ?? '') as String;
            final roll = (user['rollNumber'] ?? '') as String;
            final time = (data['time'] ?? '') as String;
            final userId = (user['_id'] ?? '') as String;

            final entry = _RecentEntry(
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
          debugPrint(
              '[MessMealScanLogs] WS error for ${widget.meal}: $error');
          setState(() {
            _connectionError = 'Connection error: $error';
          });
        },
        onDone: () {
          if (!mounted) return;
          debugPrint(
              '[MessMealScanLogs] WS done for ${widget.meal} (closed by server/client)');
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
                // Show a small "connecting" banner only while establishing
                // the WebSocket connection and only when we already have logs.
                // If there are no logs yet, we just rely on the empty state.
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
                              child: _RecentScanCard(
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

// ---- Live Gala course scan logs (per course) ----

class GalaCourseScanLogsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;
  final String course; // "Starters" | "Main Course" | "Desserts"

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
  final List<_RecentEntry> _logs = [];
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
      final summary =
          await ManagerApi.fetchGalaSummary(widget.authToken);
      final recent =
          summary['recent'] as Map<String, dynamic>? ?? <String, dynamic>{};

      final key = _recentKeyForCourse();
      final list = recent[key] as List<dynamic>? ?? const [];
      final entries = list.map((raw) {
        final m = raw as Map<String, dynamic>;
        return _RecentEntry(
          name: (m['name'] ?? '') as String,
          rollNumber: (m['rollNumber'] ?? '') as String,
          time: (m['time'] ?? '') as String,
          userId: (m['userId'] ?? '') as String,
        );
      }).toList();

      entries.sort((a, b) {
        final ta = _parseScanTimeForSort(a.time);
        final tb = _parseScanTimeForSort(b.time);
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
      // Ignore errors; live WS + polling will keep trying.
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
    debugPrint(
        '[GalaCourseLogs] Connecting WS for course=${widget.course} -> $uri');

    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      setState(() {
        _connecting = false;
      });

      _subscription = channel.stream.listen(
        (event) {
          try {
            debugPrint(
                '[GalaCourseLogs] WS message for ${widget.course}: $event');
            final data = jsonDecode(event as String) as Map<String, dynamic>;
            final log = GalaScanLog.fromJson(data);

            // Only keep logs for this course
            if (log.mealType != widget.course) {
              return;
            }

            final entry = _RecentEntry(
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
            debugPrint(
                '[GalaCourseLogs] Failed to parse WS scan log for ${widget.course}: $e');
            setState(() {
              _connectionError = 'Failed to parse scan log: $e';
            });
          }
        },
        onError: (error) {
          if (!mounted) return;
          debugPrint(
              '[GalaCourseLogs] WS error for ${widget.course}: $error');
          setState(() {
            _connectionError = 'Connection error: $error';
          });
        },
        onDone: () {
          if (!mounted) return;
          debugPrint(
              '[GalaCourseLogs] WS done for ${widget.course} (closed by server/client)');
          setState(() {
            _connectionError ??= 'Connection closed';
          });
        },
      );
    } catch (e) {
      debugPrint(
          '[GalaCourseLogs] Failed to connect WS for ${widget.course}: $e');
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
                // Match Today Mess meal logs: show a small connecting banner
                // only while establishing the WS connection, and only when
                // there are already some logs on screen.
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
                              child: _RecentScanCard(
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

class _ErrorState extends StatelessWidget {
  final String message;

  const _ErrorState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Text(
          // Always show a friendly, generic error rather than
          // leaking raw backend or network error details.
          'No Internet connection.',
          style: const TextStyle(
            color: Color(0xFFB91C1C),
            fontSize: 14,
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

// ignore: unused_element
class _EmptyState extends StatelessWidget {
  final String message;

  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        message,
        style: const TextStyle(
          color: Color(0xFF6B7280),
          fontSize: 14,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

// ---- Manager user profile screen ----

class ManagerUserProfileScreen extends StatefulWidget {
  final String userId;
  final String authToken;

  const ManagerUserProfileScreen({
    super.key,
    required this.userId,
    required this.authToken,
  });

  @override
  State<ManagerUserProfileScreen> createState() =>
      _ManagerUserProfileScreenState();
}

class _ManagerProfileData {
  final Map<String, dynamic> profile;
  final Uint8List? pictureBytes;

  _ManagerProfileData({
    required this.profile,
    required this.pictureBytes,
  });
}

class _ManagerUserProfileScreenState extends State<ManagerUserProfileScreen> {
  late Future<_ManagerProfileData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ManagerProfileData> _load() async {
    final profile = await ManagerApi.fetchUserProfileForManager(
      token: widget.authToken,
      userId: widget.userId,
    );
    final picture = await ManagerApi.fetchUserProfilePictureForManager(
      token: widget.authToken,
      userId: widget.userId,
    );
    return _ManagerProfileData(profile: profile, pictureBytes: picture);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(
            color: Color(0xFF111827),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: FutureBuilder<_ManagerProfileData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Text(
                  'Failed to load profile.\n${snapshot.error}',
                  style: const TextStyle(
                    color: Color(0xFFB91C1C),
                    fontSize: 14,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          final data = snapshot.data!;
          final profile = data.profile;
          final bytes = data.pictureBytes;

          final name = (profile['name'] ?? 'Unknown') as String;
          final roll = (profile['rollNumber'] ?? '') as String;
          final hostel = (profile['hostelName'] ?? '') as String;
          final mess = (profile['messName'] ?? '') as String;

          final initial = name.isNotEmpty ? name.trim()[0].toUpperCase() : '?';
          final hasImage = bytes != null && bytes.isNotEmpty;

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
          children: [
                CircleAvatar(
                  radius: 100,
                  backgroundColor: const Color(0xFFE5E7EB),
                  backgroundImage: hasImage ? MemoryImage(bytes) : null,
                  child: !hasImage
                      ? Text(
                          initial,
                          style: const TextStyle(
                            color: Color(0xFF111827),
                            fontSize: 32,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 12),
            Text(
                  name,
                  style: const TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 24),
                _ProfileFieldRow(
                  icon: Icons.badge_outlined,
                  label: 'Roll Number',
                  value: roll,
                ),
                _ProfileFieldRow(
                  icon: Icons.restaurant_outlined,
                  label: 'Current Mess',
                  value: mess,
                ),
                _ProfileFieldRow(
                  icon: Icons.home_outlined,
                  label: 'Hostel',
                  value: hostel,
            ),
          ],
        ),
          );
        },
      ),
    );
  }
}

class _ProfileFieldRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileFieldRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 20,
            color: const Color(0xFF6B7280),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isEmpty ? '-' : value,
                  style: const TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class GalaScanLogsScreen extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const GalaScanLogsScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  State<GalaScanLogsScreen> createState() => _GalaScanLogsScreenState();
}

class _GalaScanLogsScreenState extends State<GalaScanLogsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;

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
    setState(() {
      _connecting = true;
      _connectionError = null;
    });

    final uri = Uri.parse(GalaManagerEndpoints.wsUrl(widget.authToken));

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
