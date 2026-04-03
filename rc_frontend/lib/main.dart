import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'apis/manager_api.dart';
import 'constants/themes.dart';
import 'constants/rc_constants.dart';
import 'utilities/hq_version_checker.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await HqVersionChecker.init();
  final bool updateRequired = await HqVersionChecker.checkForUpdate();

  runApp(HabitRcApp(updateRequired: updateRequired));
}

class HabitRcApp extends StatelessWidget {
  final bool updateRequired;

  const HabitRcApp({super.key, required this.updateRequired});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'HABit RC',
      theme: Themes.theme,
      home: updateRequired
          ? const RcUpdateRequiredScreen()
          : const RcLoginScreen(),
    );
  }
}

class RcUpdateRequiredScreen extends StatelessWidget {
  const RcUpdateRequiredScreen({super.key});

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
            colors: [Color(0xFF0B1220), Color(0xFF0F172A)],
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

class RcLoginScreen extends StatefulWidget {
  const RcLoginScreen({super.key});

  @override
  State<RcLoginScreen> createState() => _RcLoginScreenState();
}

class _RcLoginScreenState extends State<RcLoginScreen> {
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
      final hostels = await ManagerApi.fetchHostels();
      if (!mounted) return;
      _hostels.value = hostels;
      await prefs.setStringList('rc_hostels', hostels);
      setState(() {
        _loadingHostels = false;
        if (hostels.isNotEmpty) _selectedHostel ??= hostels.first;
      });
      return;
    } catch (_) {
      final cached = prefs.getStringList('rc_hostels');
      if (cached != null && cached.isNotEmpty) {
        if (!mounted) return;
        _hostels.value = cached;
        setState(() {
          _loadingHostels = false;
          if (cached.isNotEmpty) _selectedHostel ??= cached.first;
        });
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
      await prefs.setString('rc_hostelName', _selectedHostel!);
      await prefs.setString('rc_token', token);

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              RcHomeScreen(hostelName: _selectedHostel!, authToken: token),
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
                'HABit RC',
                style: TextStyle(
                  color: Color(0xFF2E2F31),
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select your hostel and enter the manager password to access room-cleaning dashboard.',
                style: TextStyle(color: Color(0xFF4B5563), fontSize: 14),
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
                          return Theme(
                            data: Theme.of(
                              context,
                            ).copyWith(canvasColor: Colors.white),
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
                        hintStyle: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF9CA3AF),
                        ),
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

class RcHomeScreen extends StatelessWidget {
  final String hostelName;
  final String authToken;

  const RcHomeScreen({
    super.key,
    required this.hostelName,
    required this.authToken,
  });

  @override
  Widget build(BuildContext context) {
    return _RcHomeScaffold(hostelName: hostelName, authToken: authToken);
  }
}

class _RcHomeScaffold extends StatefulWidget {
  final String hostelName;
  final String authToken;

  const _RcHomeScaffold({required this.hostelName, required this.authToken});

  @override
  State<_RcHomeScaffold> createState() => _RcHomeScaffoldState();
}

class _RcHomeScaffoldState extends State<_RcHomeScaffold> {
  int _currentIndex = 1; // default to Today

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        title: Text(
          'HABit RC • ${widget.hostelName}',
          style: const TextStyle(
            fontFamily: 'OpenSans_regular',
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.black,
          ),
        ),
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _RcYesterdayTab(authToken: widget.authToken),
          _RcTodayTab(authToken: widget.authToken),
          _RcAssignTab(authToken: widget.authToken),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        selectedItemColor: const Color(0xFF4C4EDB),
        unselectedItemColor: const Color(0xFF6B7280),
        showUnselectedLabels: true,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            label: 'Yesterday',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.today_rounded),
            label: 'Today',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.arrow_forward_ios_rounded, size: 18),
            label: 'Tomorrow',
          ),
        ],
      ),
    );
  }
}

class _RcYesterdayTab extends StatefulWidget {
  final String authToken;

  const _RcYesterdayTab({required this.authToken});

  @override
  State<_RcYesterdayTab> createState() => _RcYesterdayTabState();
}

class _RcYesterdayTabState extends State<_RcYesterdayTab> {
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _cleaners = [];
  bool _loading = true;
  String? _loadError;

  /// null = Unassigned, else cleanerId (RcCleaner._id)
  String? _selectedCleanerId;

  /// bookingId -> status choice (default "Select")
  final Map<String, String> _statusByBookingId = {};

  static const List<String> _statusOptions = [
    'Select',
    'Cleaned',
    'Room Locked',
    'Student Did Not Respond',
    'Student Asked To Cancel',
    'Room Cleaners Not Available',
  ];

  String get _yesterdayDateParam {
    final t = DateTime.now().subtract(const Duration(days: 1));
    return '${t.year.toString().padLeft(4, '0')}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
  }

  Future<void> _loadYesterday() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await ManagerApi.fetchRcTomorrow(
        widget.authToken,
        _yesterdayDateParam,
      );
      final list =
          (data['bookings'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      final cleaners =
          (data['cleaners'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];

      // Ensure every booking has a default "Select" choice.
      for (final b in list) {
        final id = b['_id']?.toString();
        if (id == null || id.isEmpty) continue;
        _statusByBookingId.putIfAbsent(id, () => 'Select');
      }

      setState(() {
        _bookings = list;
        _cleaners = cleaners;
        _loading = false;
        _loadError = null;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  bool get _canFinalizeSelectedCleaner {
    final filtered = _filteredBookings;
    if (filtered.isEmpty) return false;
    for (final b in filtered) {
      final id = b['_id']?.toString();
      if (id == null || id.isEmpty) return false;
      final v = _statusByBookingId[id] ?? 'Select';
      if (v == 'Select') return false;
    }
    return true;
  }

  Map<String, String>? _mapUiStatusToBackend(String ui) {
    switch (ui) {
      case 'Cleaned':
        return {'status': 'Cleaned'};
      case 'Room Locked':
      case 'Student Did Not Respond':
        return {
          'status': 'CouldNotBeCleaned',
          'reason': 'Student Did Not Respond',
        };
      case 'Student Asked To Cancel':
        return {
          'status': 'CouldNotBeCleaned',
          'reason': 'Student Asked To Cancel',
        };
      case 'Room Cleaners Not Available':
        return {
          'status': 'CouldNotBeCleaned',
          'reason': 'Room Cleaners Not Available',
        };
      default:
        return null;
    }
  }

  Future<void> _finalizeSelected() async {
    if (!_canFinalizeSelectedCleaner) return;

    final filtered = _filteredBookings;
    final updates = <Map<String, dynamic>>[];

    for (final b in filtered) {
      final id = b['_id']?.toString();
      if (id == null || id.isEmpty) continue;
      final uiValue = _statusByBookingId[id] ?? 'Select';
      final mapped = _mapUiStatusToBackend(uiValue);
      if (mapped == null) continue;
      updates.add({'bookingId': id, ...mapped});
    }

    try {
      final data = await ManagerApi.postRcFinalizeStatuses(
        widget.authToken,
        date: _yesterdayDateParam,
        updates: updates,
      );
      if (!mounted) return;
      final updated = (data['updated'] as num?)?.toInt() ?? 0;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Finalized ${updates.length} bookings (updated: $updated)',
          ),
          backgroundColor: const Color(0xFF4C4EDB),
        ),
      );
      await _loadYesterday();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to finalize: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  List<Map<String, dynamic>> get _filteredBookings {
    return _bookings.where((b) {
      final assignedId = b['assignedTo']?.toString();
      if (_selectedCleanerId == null) return assignedId == null;
      return assignedId == _selectedCleanerId;
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadYesterday();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Failed to load yesterday\'s schedule:\n$_loadError',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'OpenSans_regular',
                  fontSize: 12,
                  color: Color(0xFF6B7280),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(onPressed: _loadYesterday, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final filtered = _filteredBookings;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Yesterday',
                style: TextStyle(
                  fontFamily: 'OpenSans_regular',
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                  color: Color(0xFF111827),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    value: _selectedCleanerId,
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          'Unassigned',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 13,
                            color: Color(0xFF111827),
                          ),
                        ),
                      ),
                      ..._cleaners.map((c) {
                        final id = c['_id']?.toString();
                        if (id == null)
                          return const DropdownMenuItem<String?>(
                            value: null,
                            child: SizedBox.shrink(),
                          );
                        final name = c['name']?.toString() ?? 'Cleaner';
                        return DropdownMenuItem<String?>(
                          value: id,
                          child: Text(
                            name,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 13,
                              color: Color(0xFF111827),
                            ),
                          ),
                        );
                      }),
                    ],
                    onChanged: (value) =>
                        setState(() => _selectedCleanerId = value),
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: Color(0xFF6B7280),
                    ),
                    dropdownColor: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text(
                    'No bookings in this view.',
                    style: TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 13,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final b = filtered[index];
                    final id = b['_id']?.toString() ?? '';
                    final room = b['roomNumber']?.toString() ?? '—';
                    final slot = b['slot']?.toString() ?? '';
                    final timeRange = b['timeRange']?.toString();
                    final slotLabel =
                        (timeRange != null && timeRange.isNotEmpty)
                            ? timeRange
                            : 'Slot $slot';
                    final finalized = b['statusFinalizedAt'] != null;
                    final status = b['status']?.toString();
                    final reason = b['reason']?.toString();
                    final value = finalized
                        ? (status == 'Cleaned'
                            ? 'Cleaned'
                            : (status == 'CouldNotBeCleaned' &&
                                    reason != null &&
                                    reason.isNotEmpty
                                ? reason
                                : 'Select'))
                        : (_statusByBookingId[id] ?? 'Select');

                    return _RcYesterdayRow(
                      room: room.startsWith('Room ') ? room : 'Room $room',
                      slotLabel: slotLabel,
                      value: value,
                      finalized: finalized,
                      options: _statusOptions,
                      onChanged: (v) {
                        setState(() => _statusByBookingId[id] = v);
                      },
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              onPressed: _canFinalizeSelectedCleaner ? _finalizeSelected : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4C4EDB),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Finalize',
                style: TextStyle(
                  fontFamily: 'OpenSans_regular',
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _RcYesterdayRow extends StatelessWidget {
  final String room;
  final String slotLabel;
  final String value;
  final bool finalized;
  final List<String> options;
  final ValueChanged<String> onChanged;

  const _RcYesterdayRow({
    required this.room,
    required this.slotLabel,
    required this.value,
    required this.finalized,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isSelect = value == 'Select';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: finalized ? const Color(0xFFF9FAFB) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    room,
                    style: const TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    slotLabel,
                    style: const TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Flexible(
              flex: 0,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 160, maxWidth: 240),
                child: DropdownButtonFormField<String>(
                  value: value,
                  disabledHint: Text(
                    value,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 13,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  items: options
                      .map(
                        (opt) => DropdownMenuItem<String>(
                          value: opt,
                          child: Text(
                            opt,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 13,
                              color: opt == 'Select'
                                  ? const Color(0xFF6B7280)
                                  : const Color(0xFF111827),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  selectedItemBuilder: (context) => options
                      .map(
                        (opt) => Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            opt,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 13,
                              color: opt == 'Select'
                                  ? const Color(0xFF6B7280)
                                  : const Color(0xFF111827),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: finalized
                      ? null
                      : (v) {
                          if (v == null) return;
                          onChanged(v);
                        },
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    filled: true,
                    fillColor: finalized
                        ? const Color(0xFFF3F4F6)
                        : (isSelect ? const Color(0xFFF9FAFB) : Colors.white),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                  ),
                  dropdownColor: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: Color(0xFF6B7280),
                  ),
                  isExpanded: true,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RcTodayTab extends StatefulWidget {
  final String authToken;

  const _RcTodayTab({required this.authToken});

  @override
  State<_RcTodayTab> createState() => _RcTodayTabState();
}

class _RcTodayTabState extends State<_RcTodayTab> {
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _cleaners = [];
  bool _loading = true;
  String? _loadError;

  /// null = Unassigned, else cleanerId (RcCleaner._id)
  String? _selectedCleanerId;

  String get _todayDateParam {
    final t = DateTime.now();
    return '${t.year.toString().padLeft(4, '0')}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
  }

  Future<void> _loadToday() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await ManagerApi.fetchRcTomorrow(
        widget.authToken,
        _todayDateParam,
      );
      final list =
          (data['bookings'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      final cleaners =
          (data['cleaners'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      setState(() {
        _bookings = list;
        _cleaners = cleaners;
        _loading = false;
        _loadError = null;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadToday();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Failed to load today\'s schedule:\n$_loadError',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'OpenSans_regular',
                  fontSize: 12,
                  color: Color(0xFF6B7280),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(onPressed: _loadToday, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final filtered = _bookings.where((b) {
      final assignedId = b['assignedTo']?.toString();
      if (_selectedCleanerId == null) return assignedId == null;
      return assignedId == _selectedCleanerId;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Today',
                style: TextStyle(
                  fontFamily: 'OpenSans_regular',
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                  color: Color(0xFF111827),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    value: _selectedCleanerId,
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          'Unassigned',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 13,
                            color: Color(0xFF111827),
                          ),
                        ),
                      ),
                      ..._cleaners.map((c) {
                        final id = c['_id']?.toString();
                        if (id == null) {
                          return const DropdownMenuItem<String?>(
                            value: null,
                            child: SizedBox.shrink(),
                          );
                        }
                        final name = c['name']?.toString() ?? 'Cleaner';
                        return DropdownMenuItem<String?>(
                          value: id,
                          child: Text(
                            name,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 13,
                              color: Color(0xFF111827),
                            ),
                          ),
                        );
                      }),
                    ],
                    onChanged: (value) =>
                        setState(() => _selectedCleanerId = value),
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: Color(0xFF6B7280),
                    ),
                    dropdownColor: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text(
                    'No bookings in this view.',
                    style: TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 13,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final b = filtered[index];
                    final room = b['roomNumber']?.toString() ?? '—';
                    final slot = b['slot']?.toString() ?? '';
                    final timeRange = b['timeRange']?.toString();
                    final slotLabel =
                        (timeRange != null && timeRange.isNotEmpty)
                        ? timeRange
                        : 'Slot $slot';
                    return _RcScheduleRow(
                      title: room.startsWith('Room ') ? room : 'Room $room',
                      subtitle: slotLabel,
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _RcScheduleRow extends StatelessWidget {
  final String title;
  final String subtitle;

  const _RcScheduleRow({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontFamily: 'OpenSans_regular',
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                fontFamily: 'OpenSans_regular',
                fontSize: 12,
                color: Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RcBookingRow extends StatefulWidget {
  final String title;
  final String subtitle;

  const _RcBookingRow({required this.title, required this.subtitle});

  @override
  State<_RcBookingRow> createState() => _RcBookingRowState();
}

class _RcBookingRowState extends State<_RcBookingRow> {
  String _selectedStatus = 'Cleaned';

  static const _options = <String>[
    'Cleaned',
    'Room Locked',
    'Student Did not Respond',
    'Student Cancelled',
    'Room Cleaner Not Available',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.title,
                    style: const TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.subtitle,
                    style: const TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 190,
              child: DropdownButtonFormField<String>(
                value: _selectedStatus,
                items: _options
                    .map(
                      (opt) => DropdownMenuItem<String>(
                        value: opt,
                        child: Text(
                          opt,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 13,
                            color: Color(0xFF111827),
                          ),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _selectedStatus = value;
                  });
                },
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                ),
                dropdownColor: Colors.white,
                borderRadius: BorderRadius.circular(10),
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 18,
                  color: Color(0xFF6B7280),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RcAssignTab extends StatefulWidget {
  final String authToken;

  const _RcAssignTab({required this.authToken});

  @override
  State<_RcAssignTab> createState() => _RcAssignTabState();
}

class _RcAssignTabState extends State<_RcAssignTab> {
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _cleaners = [];
  List<String?> _assignments = [];

  /// Last saved/loaded state; when _assignments != _savedAssignments, show Save instead of Share.
  List<String?> _savedAssignments = [];
  bool _loading = true;
  String? _loadError;
  bool _saving = false;
  bool _sharingPdf = false;
  bool _confirmedSlotsExpanded = true;
  bool _bufferSlotsExpanded = true;
  String _selectedSlot = 'A';

  bool get _hasAllocationChange {
    if (_assignments.length != _savedAssignments.length) return true;
    for (var i = 0; i < _assignments.length; i++) {
      if (_assignments[i] != _savedAssignments[i]) return true;
    }
    return false;
  }

  bool get _allConfirmedAssigned {
    for (var i = 0; i < _bookings.length; i++) {
      final status = _bookings[i]['status']?.toString();
      if (status == 'Buffered') continue;
      if (_assignments.length <= i || _assignments[i] == null) return false;
    }
    return true;
  }

  /// Tomorrow's date for PDF (local date + 1 day).
  String get _tomorrowDateStr {
    final t = DateTime.now().add(const Duration(days: 1));
    return '${t.day.toString().padLeft(2, '0')}-${t.month.toString().padLeft(2, '0')}-${t.year}';
  }

  Future<void> _generateAndSharePdf() async {
    if (_sharingPdf || _bookings.isEmpty) return;
    setState(() => _sharingPdf = true);
    try {
      final dateStr = _tomorrowDateStr;
      final pdf = pw.Document();
      int pagesAdded = 0;

      for (final cleaner in _cleaners) {
        final cleanerId = cleaner['_id']?.toString();
        if (cleanerId == null) continue;
        final cleanerName = cleaner['name']?.toString() ?? 'Room Cleaner';
        final rows = <List<String>>[];
        int slNo = 0;
        for (var i = 0; i < _bookings.length; i++) {
          if (_assignments[i] != cleanerId) continue;
          slNo++;
          final b = _bookings[i];
          final slotTime = b['timeRange']?.toString() ?? '';
          final roomNumber = b['roomNumber']?.toString() ?? '—';
          final phoneNumber = b['phoneNumber']?.toString() ?? '—';
          rows.add([
            slNo.toString(),
            slotTime,
            roomNumber,
            phoneNumber,
            '', // Signature column left blank
          ]);
        }
        if (rows.isEmpty) continue;

        pagesAdded++;
        pdf.addPage(
          pw.Page(
            pageFormat: PdfPageFormat.a4,
            margin: const pw.EdgeInsets.all(24),
            build: (pw.Context context) {
              return pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'Date: $dateStr',
                    style: pw.TextStyle(
                      fontSize: 14,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    cleanerName,
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 16),
                  pw.Table(
                    border: pw.TableBorder.all(color: PdfColors.grey800),
                    columnWidths: {
                      0: const pw.FlexColumnWidth(1),
                      1: const pw.FlexColumnWidth(2),
                      2: const pw.FlexColumnWidth(2),
                      3: const pw.FlexColumnWidth(2.5),
                      4: const pw.FlexColumnWidth(2),
                    },
                    children: [
                      pw.TableRow(
                        decoration: const pw.BoxDecoration(
                          color: PdfColors.grey300,
                        ),
                        children: [
                          _cell('Sl.No'),
                          _cell('Slot Time'),
                          _cell('Room Number'),
                          _cell('Phone Number'),
                          _cell('Signature'),
                        ],
                      ),
                      ...rows.map(
                        (row) => pw.TableRow(
                          children: row.map((s) => _cell(s)).toList(),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        );
      }

      if (pagesAdded == 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'No assignments to export. Assign bookings to room cleaners first.',
              ),
            ),
          );
        }
        return;
      }

      final bytes = await pdf.save();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/room_cleaning_$dateStr.pdf');
      await file.writeAsBytes(bytes);

      if (mounted) {
        await Share.shareXFiles(
          [XFile(file.path)],
          text: 'Room cleaning schedule - $dateStr',
          subject: 'Room cleaning schedule',
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate PDF: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sharingPdf = false);
    }
  }

  pw.Widget _cell(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: pw.Text(text, style: const pw.TextStyle(fontSize: 10)),
    );
  }

  Future<void> _loadTomorrow() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await ManagerApi.fetchRcTomorrow(widget.authToken);
      final list =
          (data['bookings'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      final cleaners =
          (data['cleaners'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      final assignments = list.map((b) {
        final a = b['assignedTo'];
        if (a == null) return null;
        return a.toString();
      }).toList();
      setState(() {
        _bookings = list;
        _cleaners = cleaners;
        _assignments = assignments;
        _savedAssignments = List<String?>.from(assignments);
        _loading = false;
        _loadError = null;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadTomorrow();
  }

  Map<String, int> _buildCleanerSummary(String slotFilter) {
    final Map<String, int> summary = {};
    for (var i = 0; i < _bookings.length; i++) {
      final cleanerId = _assignments[i];
      if (cleanerId == null) continue;
      final slot = _bookings[i]['slot']?.toString() ?? '';
      if (slotFilter.isNotEmpty && slot != slotFilter) continue;
      summary.update(cleanerId, (value) => value + 1, ifAbsent: () => 1);
    }
    return summary;
  }

  Future<void> _saveAssignments() async {
    if (_saving || _bookings.isEmpty) return;
    setState(() => _saving = true);
    try {
      final assignments = <Map<String, dynamic>>[];
      for (var i = 0; i < _bookings.length; i++) {
        final id = _bookings[i]['_id'];
        if (id == null) continue;
        assignments.add({'bookingId': id, 'assignedTo': _assignments[i]});
      }
      await ManagerApi.postRcTomorrowAssign(
        widget.authToken,
        assignments: assignments,
      );
      if (mounted) {
        setState(() => _savedAssignments = List<String?>.from(_assignments));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Assignments finalized'),
            backgroundColor: Color(0xFF4C4EDB),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(color: Color(0xFF4C4EDB)),
        ),
      );
    }
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _loadError!,
                style: const TextStyle(color: Colors.red),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              TextButton(onPressed: _loadTomorrow, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final cleanerSummary = _buildCleanerSummary(_selectedSlot);
    final confirmedIndices = <int>[];
    final bufferIndices = <int>[];
    for (var i = 0; i < _bookings.length; i++) {
      final b = _bookings[i];
      final status = b['status']?.toString();
      final slot = b['slot']?.toString() ?? '';
      if (slot != _selectedSlot) continue;
      if (status == 'Buffered') {
        bufferIndices.add(i);
      } else {
        confirmedIndices.add(i);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header row: "Tomorrow" + slot dropdown + Share/Save on the right
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Text(
                      'Tomorrow',
                      style: TextStyle(
                        fontFamily: 'OpenSans_regular',
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Flexible(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          // Prevent RenderFlex overflow on small screens.
                          maxWidth: 170,
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedSlot,
                              isExpanded: true,
                              items: ['A', 'B', 'C', 'D']
                                  .map(
                                    (s) => DropdownMenuItem<String>(
                                      value: s,
                                      child: Text(
                                        '${rcSlotTimeRange[s] ?? 'Slot $s'}',
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: 'OpenSans_regular',
                                          fontSize: 13,
                                          color: Color(0xFF111827),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) {
                                if (v == null) return;
                                setState(() {
                                  _selectedSlot = v;
                                });
                              },
                              icon: const Icon(
                                Icons.keyboard_arrow_down_rounded,
                                size: 18,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              if (_hasAllocationChange || !_allConfirmedAssigned)
                TextButton(
                  onPressed:
                      (!_hasAllocationChange ||
                          !_allConfirmedAssigned ||
                          _saving)
                      ? null
                      : _saveAssignments,
                  child: Text(
                    'Save',
                    style: TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color:
                          (!_hasAllocationChange ||
                              !_allConfirmedAssigned ||
                              _saving)
                          ? const Color(0xFF9CA3AF)
                          : const Color(0xFF4C4EDB),
                    ),
                  ),
                )
              else
                TextButton.icon(
                  onPressed: _sharingPdf ? null : _generateAndSharePdf,
                  icon: const FaIcon(
                    FontAwesomeIcons.whatsapp,
                    color: Color(0xFF25D366),
                    size: 18,
                  ),
                  label: const Text(
                    'Share',
                    style: TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Color(0xFF111827),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // Cleaner summary slider: show all cleaners horizontally with
        // "Cleaner Name (Slots)     Count in this slot".
        SizedBox(
          height: 72,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: _cleaners.map((c) {
                final cleanerId = c['_id']?.toString();
                if (cleanerId == null) {
                  return const SizedBox.shrink();
                }

                final cleanerName = c['name']?.toString() ?? 'Room Cleaner';
                final slotsList =
                    (c['slots'] as List?)?.map((e) => e.toString()).toList() ??
                    const <String>[];
                final slotsLabel = slotsList.isEmpty
                    ? '-'
                    : slotsList.join(', ');
                final countInSlot = cleanerSummary[cleanerId] ?? 0;

                return Container(
                  width: 220,
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          '$cleanerName ($slotsLabel)',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF111827),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '$countInSlot',
                        style: const TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF4C4EDB),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(height: 8),
        // Bookings: Confirmed Slots and Buffer Slots as dropdowns
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            children: [
              ExpansionTile(
                initiallyExpanded: _confirmedSlotsExpanded,
                onExpansionChanged: (v) =>
                    setState(() => _confirmedSlotsExpanded = v),
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: 4,
                  vertical: 0,
                ),
                childrenPadding: const EdgeInsets.only(
                  left: 4,
                  right: 4,
                  bottom: 8,
                ),
                title: Text(
                  'Confirmed Slots (${confirmedIndices.length})',
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xFF111827),
                  ),
                ),
                children: confirmedIndices.isEmpty
                    ? [
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'No confirmed bookings.',
                            style: TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ),
                      ]
                    : confirmedIndices.map((index) {
                        final booking = _bookings[index];
                        final room = booking['roomNumber']?.toString() ?? '—';
                        final slot = booking['slot']?.toString() ?? '';
                        final timeRange = booking['timeRange']?.toString();
                        final slotLabel =
                            (timeRange != null && timeRange.isNotEmpty)
                            ? timeRange
                            : 'Slot $slot';
                        final phone = booking['phoneNumber']?.toString();
                        return _RcAssignRow(
                          room: room.startsWith('Room ') ? room : 'Room $room',
                          slotLabel: slotLabel,
                          phoneNumber: phone,
                          cleaners: _cleaners,
                          value: _assignments[index],
                          onChanged: (value) {
                            setState(() => _assignments[index] = value);
                          },
                        );
                      }).toList(),
              ),
              ExpansionTile(
                initiallyExpanded: _bufferSlotsExpanded,
                onExpansionChanged: (v) =>
                    setState(() => _bufferSlotsExpanded = v),
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: 4,
                  vertical: 0,
                ),
                childrenPadding: const EdgeInsets.only(
                  left: 4,
                  right: 4,
                  bottom: 8,
                ),
                title: Text(
                  'Buffer Slots (${bufferIndices.length})',
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xFF111827),
                  ),
                ),
                children: bufferIndices.isEmpty
                    ? [
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'No buffer bookings.',
                            style: TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ),
                      ]
                    : bufferIndices.map((index) {
                        final booking = _bookings[index];
                        final room = booking['roomNumber']?.toString() ?? '—';
                        final slot = booking['slot']?.toString() ?? '';
                        final timeRange = booking['timeRange']?.toString();
                        final slotLabel =
                            (timeRange != null && timeRange.isNotEmpty)
                            ? timeRange
                            : 'Slot $slot';
                        final phone = booking['phoneNumber']?.toString();
                        return _RcAssignRow(
                          room: room.startsWith('Room ') ? room : 'Room $room',
                          slotLabel: slotLabel,
                          phoneNumber: phone,
                          cleaners: _cleaners,
                          value: _assignments[index],
                          onChanged: (value) {
                            setState(() => _assignments[index] = value);
                          },
                        );
                      }).toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RcAssignRow extends StatelessWidget {
  final String room;
  final String slotLabel;
  final String? phoneNumber;
  final List<Map<String, dynamic>> cleaners;
  final String? value;
  final ValueChanged<String?> onChanged;

  const _RcAssignRow({
    required this.room,
    required this.slotLabel,
    required this.phoneNumber,
    required this.cleaners,
    required this.value,
    required this.onChanged,
  });

  Future<void> _launchDialer() async {
    final phone = phoneNumber?.trim();
    if (phone == null || phone.isEmpty || phone == '—') return;
    final uri = Uri(scheme: 'tel', path: phone);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Prevent small-screen overflows by making the dropdown responsive.
            // Slightly reduce width to make room for phone icon.
            final dropdownWidth = (constraints.maxWidth * 0.42)
                .clamp(140.0, 180.0)
                .toDouble();

            return Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        room,
                        style: const TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: Colors.black,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        slotLabel,
                        style: const TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (phoneNumber != null && phoneNumber!.trim().isNotEmpty)
                  IconButton(
                    icon: const Icon(
                      Icons.phone_rounded,
                      size: 20,
                      color: Color(0xFF10B981),
                    ),
                    tooltip: 'Call',
                    visualDensity: VisualDensity.compact,
                    onPressed: _launchDialer,
                  ),
                const SizedBox(width: 4),
                SizedBox(
                  width: dropdownWidth,
                  child: DropdownButtonFormField<String?>(
                    value: value,
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          'Unassigned',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'OpenSans_regular',
                            fontSize: 13,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ),
                      ...cleaners.map((c) {
                        final id = c['_id']?.toString();
                        if (id == null) {
                          return const DropdownMenuItem<String?>(
                            value: null,
                            child: SizedBox.shrink(),
                          );
                        }
                        final name = c['name']?.toString() ?? 'Room Cleaner';
                        return DropdownMenuItem<String?>(
                          value: id,
                          child: Text(
                            name,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'OpenSans_regular',
                              fontSize: 13,
                              color: Color(0xFF111827),
                            ),
                          ),
                        );
                      }),
                    ],
                    onChanged: onChanged,
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                    ),
                    dropdownColor: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
