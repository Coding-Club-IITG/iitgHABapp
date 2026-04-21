import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../apis/manager_api.dart';
import '../constants/themes.dart';
import '../providers/auth_controller.dart';
import '../utils/name_case.dart';
import 'manager_user_profile_screen.dart';
import 'mess_subscriber_entry_screen.dart';

class MessSubscribersScreen extends StatefulWidget {
  const MessSubscribersScreen({super.key});

  @override
  State<MessSubscribersScreen> createState() => _MessSubscribersScreenState();
}

class _SubscriberRow {
  final String id;
  final String name;
  final String roll;
  final Map<String, bool> scanned;
  final bool onLeaveToday;

  const _SubscriberRow({
    required this.id,
    required this.name,
    required this.roll,
    required this.scanned,
    required this.onLeaveToday,
  });
}

class _MessSubscribersScreenState extends State<MessSubscribersScreen> {
  bool _loading = true;
  String? _error;
  final List<_SubscriberRow> _items = [];
  final ScrollController _scroll = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  int _page = 1;
  static const int _pageSize = 10;
  bool _loadingMore = false;
  bool _hasNext = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loading || _loadingMore || !_hasNext) return;
    final pos = _scroll.position;
    if (pos.pixels >= pos.maxScrollExtent - 320) {
      _loadNextPage();
    }
  }

  Future<void> _reload() async {
    setState(() {
      _items.clear();
      _page = 1;
      _hasNext = true;
      _error = null;
      _loading = true;
    });
    await _loadNextPage();
  }

  Future<void> _loadNextPage() async {
    final token = context.read<AuthController>().token;
    if (token == null) return;
    if (_loadingMore) return;
    setState(() {
      _loadingMore = true;
      _error = null;
    });
    try {
      final data = await ManagerApi.fetchManagerSubscribers(
        token: token,
        query: _query.trim().isEmpty ? null : _query.trim(),
        page: _page,
        limit: _pageSize,
      );
      final users = (data['users'] as List?) ?? const [];
      final mapped = users.whereType<Map>().map((u) {
        final id = (u['_id'] ?? '').toString();
        final name = (u['name'] ?? '').toString();
        final roll = (u['rollNumber'] ?? '').toString();
        final scannedMap = (u['scanned'] as Map?) ?? const {};
        return _SubscriberRow(
          id: id,
          name: name,
          roll: roll,
          scanned: {
            'breakfast': scannedMap['breakfast'] == true,
            'lunch': scannedMap['lunch'] == true,
            'dinner': scannedMap['dinner'] == true,
          },
          onLeaveToday: u['onLeaveToday'] == true,
        );
      }).toList();
      final count = (data['count'] as int?) ?? 0;
      final totalPages = (data['totalPages'] as int?) ?? 1;
      if (!mounted) return;
      setState(() {
        _items.addAll(mapped);
        _page += 1;
        _hasNext = _page <= totalPages && _items.length < count;
        _loading = false;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _onQueryChanged(String v) {
    setState(() => _query = v);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      _reload();
    });
  }

  void _clearSearch() {
    _searchController.clear();
    _onQueryChanged('');
    FocusScope.of(context).unfocus();
  }

  ({Color fg, Color bg}) _scannedPillColors(int scannedCount) {
    if (scannedCount >= 3) {
      return (fg: const Color(0xFF065F46), bg: const Color(0xFFD1FAE5));
    }
    if (scannedCount >= 1) {
      return (fg: const Color(0xFF92400E), bg: const Color(0xFFFEF3C7));
    }
    return (fg: const Color(0xFF374151), bg: const Color(0xFFF3F4F6));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text(
          'Mess Subscribers',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.w700,
          ),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _reload,
            icon: const Icon(Icons.refresh, color: Color(0xFF111827)),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Container(
              decoration: BoxDecoration(
                color: Themes.shimmerHighlight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Themes.shimmerBase),
              ),
              child: TextField(
                controller: _searchController,
                textInputAction: TextInputAction.search,
                autocorrect: false,
                enableSuggestions: false,
                cursorColor: Themes.kAccent,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF111827),
                      fontWeight: FontWeight.w500,
                    ),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: 'Search by name or roll number',
                  hintStyle: const TextStyle(
                    color: Color(0xFF6B7280),
                    fontWeight: FontWeight.w500,
                  ),
                  prefixIcon: const Icon(
                    Icons.search,
                    color: Color(0xFF6B7280),
                  ),
                  suffixIcon: _query.trim().isEmpty
                      ? null
                      : IconButton(
                          onPressed: _clearSearch,
                          icon: const Icon(Icons.close, color: Color(0xFF6B7280)),
                          tooltip: 'Clear search',
                        ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
                onChanged: _onQueryChanged,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Failed to load subscribers.\n$_error',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFFB91C1C),
                        ),
                      ),
                    ),
                  )
                : _items.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'No subscribers found',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _query.trim().isEmpty
                                ? 'Try refreshing, or search by name/roll number.'
                                : 'Try a different search.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (_query.trim().isNotEmpty) ...[
                            const SizedBox(height: 12),
                            TextButton.icon(
                              onPressed: _clearSearch,
                              icon: const Icon(Icons.close),
                              label: const Text('Clear search'),
                              style: TextButton.styleFrom(
                                foregroundColor: const Color(0xFF6149CD),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    controller: _scroll,
                    itemCount: _items.length + (_hasNext ? 1 : 0),
                    padding: const EdgeInsets.only(bottom: 12),
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      if (index >= _items.length) {
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      final u = _items[index];
                      final scannedCount =
                          (u.scanned['breakfast'] == true ? 1 : 0) +
                          (u.scanned['lunch'] == true ? 1 : 0) +
                          (u.scanned['dinner'] == true ? 1 : 0);
                      final scannedColors = _scannedPillColors(scannedCount);
                      final displayName = u.name.trim().isEmpty
                          ? 'Unknown'
                          : toTitleCase(u.name);

                      return ListTile(
                        splashColor: Colors.transparent,
                        hoverColor: Colors.transparent,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  ManagerUserProfileScreen(userId: u.id),
                            ),
                          );
                        },
                        title: Text(
                          displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF111827),
                              ),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                u.roll.isEmpty ? '-' : u.roll,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: const Color(0xFF6B7280),
                                    ),
                              ),
                              _Pill(
                                text: '$scannedCount/3 scanned',
                                color: scannedColors.fg,
                                background: scannedColors.bg,
                              ),
                              if (u.onLeaveToday)
                                const _Pill(
                                  text: 'On leave',
                                  color: Color(0xFFB91C1C),
                                  background: Color(0xFFFEE2E2),
                                ),
                            ],
                          ),
                        ),
                        trailing: TextButton.icon(
                          onPressed: () async {
                            final didUpdate =
                                await Navigator.of(context).push<bool>(
                              MaterialPageRoute<bool>(
                                builder: (_) => MessSubscriberEntryScreen(
                                  userId: u.id,
                                  name: displayName,
                                  rollNumber: u.roll,
                                ),
                              ),
                            );
                            if (didUpdate == true && mounted) {
                              await _reload();
                            }
                          },
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Entry'),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF6149CD),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                          ),
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

class _Pill extends StatelessWidget {
  final String text;
  final Color color;
  final Color? background;

  const _Pill({required this.text, required this.color, this.background});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
