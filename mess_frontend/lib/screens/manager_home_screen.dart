import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../providers/auth_controller.dart';
import 'gala_summary_screen.dart';
import 'rebate_summary_screen.dart';
import 'today_mess_screen.dart';

/// Manager home with bottom navigation: Today Mess, Gala Dinner, Rebate.
class ManagerHomeScreen extends StatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  int _currentIndex = 0;
  bool _galaInitialized = false;
  bool _hasGalaToday = false;
  bool _rebateInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshHasGalaToday();
    });
  }

  Future<void> _refreshHasGalaToday() async {
    final auth = context.read<AuthController>();
    final token = auth.token;
    if (token == null) return;
    try {
      final has = await ManagerApi.hasTodayGala(token);
      if (!mounted) return;
      setState(() {
        _hasGalaToday = has;
        if (!_hasGalaToday && _currentIndex != 0) {
          _currentIndex = 0;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hasGalaToday = false;
        if (_currentIndex != 0) _currentIndex = 0;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not check Gala Dinner: $e'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final hostelName = auth.hostelName ?? '';

    final screens = <Widget>[
      TodayMessScreen(hostelName: hostelName),
      if (_hasGalaToday)
        (_galaInitialized
            ? GalaSummaryScreen(hostelName: hostelName)
            : const SizedBox.shrink()),
      (_rebateInitialized
          ? RebateSummaryScreen(hostelName: hostelName)
          : const SizedBox.shrink()),
    ];

    final items = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(
        icon: Icon(Icons.restaurant),
        label: 'Today Mess',
      ),
      if (_hasGalaToday)
        const BottomNavigationBarItem(
          icon: Icon(Icons.celebration),
          label: 'Gala Dinner',
        ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.receipt_long),
        label: 'Rebate',
      ),
    ];

    final rebateIndex = _hasGalaToday ? 2 : 1;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
      ),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(
          splashFactory: NoSplash.splashFactory,
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          items: items,
          onTap: (index) {
            setState(() {
              if (_hasGalaToday && index == 1) {
                _galaInitialized = true;
              }
              if (index == rebateIndex) {
                _rebateInitialized = true;
              }
              _currentIndex = index;
            });
          },
          selectedItemColor: const Color(0xFF111827),
          unselectedItemColor: const Color(0xFF9CA3AF),
          backgroundColor: Colors.white,
          type: BottomNavigationBarType.fixed,
        ),
      ),
    );
  }
}
