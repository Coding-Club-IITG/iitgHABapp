import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:go_router/go_router.dart';

import '../apis/manager_api.dart';
import '../constants/themes.dart';
import '../providers/auth_controller.dart';
import 'gala_summary_screen.dart';
import 'rebate_summary_screen.dart';
import 'summer_mess_summary_screen.dart';
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
  bool _summerInitialized = false;
  bool _rebateInitialized = false;

  Future<void> _logout() async {
    final auth = context.read<AuthController>();
    final navigator = Navigator.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to sign in again to continue.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    // Best-effort: sign out of Firebase & Google to avoid cached broken sessions.
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}

    await auth.signOut();

    if (!mounted) return;
    navigator.popUntil((r) => r.isFirst);
    context.go('/login');
  }

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
        SnackBar(content: Text('Could not check Gala Dinner: $e')),
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
      (_summerInitialized
          ? SummerMessSummaryScreen(hostelName: hostelName)
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
        icon: Icon(Icons.wb_sunny_outlined),
        label: 'Summer',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.receipt_long),
        label: 'Rebate',
      ),
    ];

    final summerIndex = _hasGalaToday ? 2 : 1;
    final rebateIndex = _hasGalaToday ? 3 : 2;

    return Scaffold(
      backgroundColor: Themes.pageBg,
      appBar: AppBar(
        title: Text(
          hostelName.isEmpty ? 'HABit HQ' : hostelName,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'logout') _logout();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18),
                    SizedBox(width: 10),
                    Text('Log out'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: IndexedStack(index: _currentIndex, children: screens),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        destinations: items
            .map(
              (item) => NavigationDestination(
                icon: item.icon,
                label: item.label ?? '',
              ),
            )
            .toList(),
        onDestinationSelected: (index) {
          setState(() {
            if (_hasGalaToday && index == 1) {
              _galaInitialized = true;
            }
            if (index == summerIndex) {
              _summerInitialized = true;
            }
            if (index == rebateIndex) {
              _rebateInitialized = true;
            }
            _currentIndex = index;
          });
        },
      ),
    );
  }
}
