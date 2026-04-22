import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/screens/gala_qr_scanner_screen.dart';
import 'package:frontend2/widgets/common/shimmer_host.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _dio = DioClient().dio;

/// Gala Dinner screen — visual tokens from Figma (node 134:221).
abstract final class _GalaTokens {
  static const headerBg = Color(0xFFFAFAFA);
  static const headerBorder = Color(0xFFE6E6E6);
  static const grey1 = Color(0xFF676767);
  static const grey1b = Color(0xFF535353);
  static const grey2 = Color(0xFF2E2F31);
  static const orange = Color(0xFFB87402);
  static const scanWell = Color(0xFFFEF7EA);
  static const border = Color(0xFFE6E6E6);
  static const dividerBar = Color(0xFFF0F0F0);
  static const shadow = Color(0x14000000);
  static BoxShadow get cardShadow => const BoxShadow(
        color: shadow,
        blurRadius: 16,
        offset: Offset(0, 0),
      );
}

class GalaDinnerScreen extends StatefulWidget {
  final bool active;
  const GalaDinnerScreen({super.key, this.active = false});

  @override
  State<GalaDinnerScreen> createState() => _GalaDinnerScreenState();
}

class _GalaDinnerScreenState extends State<GalaDinnerScreen> {
  bool _loading = true;
  Map<String, dynamic>? _menuData;
  Map<String, dynamic>? _scanStatusData;
  String? _error;
  bool started_loading = false;

  @override
  void initState() {
    super.initState();
  }

  bool __isloading() {
    if (widget.active && !started_loading) {
      print("Loading Gala Screen Data!");
      started_loading = true;
      _fetchAll();
    }
    return _loading;
  }

  /// Backend Gala APIs expect Hostel ObjectId (24-char hex). GalaDinnerMenu.hostelId = Hostel._id (not Mess._id).
  /// Prefer hostelID (getUserMessInfo) or currMess (users API = User.curr_subscribed_mess). Reject placeholders.
  static bool _isValidObjectId(String? s) {
    if (s == null || s.isEmpty) return false;
    if (s == 'Not found' || s == 'Not provided') return false;
    return RegExp(r'^[a-fA-F0-9]{24}$').hasMatch(s);
  }

  Future<String?> _getHostelId() async {
    final prefs = await SharedPreferences.getInstance();
    final hostelID = prefs.getString('hostelID');
    final currMess = prefs.getString('currMess');
    final hostelId = _isValidObjectId(hostelID)
        ? hostelID
        : (_isValidObjectId(currMess) ? currMess : null);
    if (kDebugMode) {
      debugPrint(
          'Gala: _getHostelId hostelID=$hostelID currMess=$currMess => hostelId=$hostelId');
    }
    return hostelId;
  }

  Future<void> _fetchAll() async {
    if (kDebugMode) debugPrint('Gala: _fetchAll start');
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await getAccessToken();
      if (kDebugMode) debugPrint('Gala: token present=${token != "error"}');
      if (token == 'error') {
        setState(() {
          _error = 'Please log in';
          _loading = false;
        });
        return;
      }
      var hostelId = await _getHostelId();
      if (hostelId == null || hostelId.isEmpty) {
        if (kDebugMode)
          debugPrint(
              'Gala: no hostelId, fetching user details to populate currMess');
        try {
          await fetchUserDetails();
          if (!mounted) return;
          hostelId = await _getHostelId();
        } catch (_) {}
        if (hostelId == null || hostelId.isEmpty) {
          if (kDebugMode)
            debugPrint('Gala: no hostelId after fetch, showing error');
          setState(() {
            _error =
                'No hostel selected. Open Mess or Profile first to set your hostel.';
            _loading = false;
          });
          return;
        }
      }
      await Future.wait([
        _fetchUpcomingWithMenus(token, hostelId),
        _fetchScanStatus(token),
      ]);
      if (!mounted) return;
      if (kDebugMode)
        debugPrint(
            'Gala: _fetchAll done menus=${_menuData != null} scanStatus=${_scanStatusData != null}');
      setState(() {
        _loading = false;
      });
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('Gala: _fetchAll error=$e');
        debugPrint('Gala: stack=$st');
        if (e is DioException) {
          debugPrint(
              'Gala: DioException response=${e.response?.data} statusCode=${e.response?.statusCode}');
        }
      }
      if (!mounted) return;
      setState(() {
        _error = e is DioException
            ? (e.response?.data is Map && e.response?.data['message'] != null
                ? e.response!.data['message'] as String
                : 'Failed to load')
            : 'Failed to load';
        _loading = false;
      });
    }
  }

  Future<void> _fetchUpcomingWithMenus(String token, String hostelId) async {
    final url = GalaEndpoints.upcomingWithMenus(hostelId);
    if (kDebugMode) debugPrint('Gala: GET upcoming-with-menus url=$url');
    final response = await _dio.get(
      url,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
    if (kDebugMode)
      debugPrint('Gala: upcoming-with-menus status=${response.statusCode}');
    if (mounted) {
      setState(() {
        _menuData = response.data is Map
            ? Map<String, dynamic>.from(response.data)
            : null;
      });
    }
  }

  Future<void> _fetchScanStatus(String token) async {
    if (kDebugMode)
      debugPrint('Gala: GET scan-status url=${GalaEndpoints.scanStatus}');
    final response = await _dio.get(
      GalaEndpoints.scanStatus,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
    if (kDebugMode)
      debugPrint('Gala: scan-status status=${response.statusCode}');
    if (mounted) {
      setState(() {
        _scanStatusData = response.data is Map
            ? Map<String, dynamic>.from(response.data)
            : null;
      });
    }
  }

  void _refetchScanStatus() async {
    final token = await getAccessToken();
    if (token == 'error' || !mounted) return;
    await _fetchScanStatus(token);
  }

  /// Formats "HH:mm" (e.g. "18:30") to "6:30 PM". Returns null if invalid or missing.
  static String? _formatTimeDisplay(String? str) {
    if (str == null || str.isEmpty) return null;
    final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(str.trim());
    if (match == null) return str;
    final h = int.tryParse(match.group(1)!) ?? 0;
    final m = match.group(2)!;
    final h12 = h % 12;
    final hDisplay = h12 == 0 ? 12 : h12;
    final ampm = h < 12 ? 'AM' : 'PM';
    return '$hDisplay:$m $ampm';
  }

  bool _isScanned(String category) {
    final log = _scanStatusData?['scanLog'] as Map<String, dynamic>?;
    if (log == null) return false;
    switch (category) {
      case 'Starters':
        return log['startersScanned'] == true;
      case 'Main Course':
        return log['mainCourseScanned'] == true;
      case 'Desserts':
        return log['dessertsScanned'] == true;
      default:
        return false;
    }
  }

  String? _getScannedTime(String category) {
    final log = _scanStatusData?['scanLog'] as Map<String, dynamic>?;
    if (log == null) return null;
    switch (category) {
      case 'Starters':
        return log['startersTime'] as String?;
      case 'Main Course':
        return log['mainCourseTime'] as String?;
      case 'Desserts':
        return log['dessertsTime'] as String?;
      default:
        return null;
    }
  }

  Widget _buildGalaHeader(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: _GalaTokens.headerBg,
          border: Border(
            bottom: BorderSide(color: _GalaTokens.headerBorder, width: 1),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Row(
          children: [
            InkWell(
              onTap: () => Navigator.of(context).maybePop(),
              borderRadius: BorderRadius.circular(20),
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(
                  Icons.arrow_back,
                  size: 24,
                  color: _GalaTokens.grey2,
                ),
              ),
            ),
            const SizedBox(width: 16),
            const Text(
              'Gala Dinner',
              style: TextStyle(
                fontFamily: 'GeneralSans',
                fontSize: 20,
                fontWeight: FontWeight.w500,
                height: 28 / 20,
                color: _GalaTokens.grey2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (__isloading()) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildGalaHeader(context),
            Expanded(
              child: ShimmerHost(
                builder: (context, box) => SingleChildScrollView(
                  padding: const EdgeInsets.only(top: 24, bottom: 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            box(
                              height: 24,
                              width: 120,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            const SizedBox(height: 24),
                            Row(
                              children: [
                                for (int i = 0; i < 3; i++) ...[
                                  if (i > 0) const SizedBox(width: 12),
                                  Expanded(
                                    child: Container(
                                      height: 148,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        border: Border.all(
                                            color: _GalaTokens.border),
                                        borderRadius: BorderRadius.circular(16),
                                        boxShadow: [_GalaTokens.cardShadow],
                                      ),
                                      child: Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          SizedBox(
                                            width: double.infinity,
                                            child: box(
                                              height: 56,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                          ),
                                          box(
                                            height: 14,
                                            width: 72,
                                            borderRadius:
                                                BorderRadius.circular(6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
                      const SizedBox(
                        height: 8,
                        child: ColoredBox(color: _GalaTokens.dividerBar),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            box(height: 24, width: 100),
                            const SizedBox(height: 16),
                            for (int i = 0; i < 3; i++) ...[
                              if (i > 0) const SizedBox(height: 16),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  border: Border.all(color: _GalaTokens.border),
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [_GalaTokens.cardShadow],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    box(height: 24, width: 180),
                                    const SizedBox(height: 12),
                                    box(height: 20, width: 140),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildGalaHeader(context),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      TextButton(
                          onPressed: _fetchAll, child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final galaDinner = _menuData?['galaDinner'] as Map<String, dynamic>?;
    final menus = _menuData?['menus'] as List<dynamic>? ?? [];
    final hasGala = galaDinner != null && menus.isNotEmpty;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildGalaHeader(context),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchAll,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(top: 24, bottom: 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Quick Scans',
                            style: TextStyle(
                              fontFamily: 'GeneralSans',
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              height: 24 / 16,
                              color: _GalaTokens.grey1,
                            ),
                          ),
                          const SizedBox(height: 24),
                          _buildCourseBlocks(hasGala),
                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                    const SizedBox(
                      height: 8,
                      child: ColoredBox(color: _GalaTokens.dividerBar),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Gala Menu',
                            style: TextStyle(
                              fontFamily: 'GeneralSans',
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              height: 24 / 16,
                              color: _GalaTokens.grey1,
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (hasGala)
                            _buildMenuCards(menus, galaDinner)
                          else
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: _GalaTokens.border),
                                boxShadow: [_GalaTokens.cardShadow],
                              ),
                              child: const Text(
                                'No upcoming Gala Dinner scheduled.',
                                style: TextStyle(
                                  fontFamily: 'GeneralSans',
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: _GalaTokens.grey1,
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
          ),
        ],
      ),
    );
  }

  Widget _buildCourseBlocks(bool hasGala) {
    const categories = ['Starters', 'Main Course', 'Desserts'];
    return Row(
      children: [
        for (int i = 0; i < categories.length; i++) ...[
          if (i > 0) const SizedBox(width: 12),
          Expanded(child: _buildCourseCard(categories[i], hasGala)),
        ],
      ],
    );
  }

  static IconData _iconForCategory(String category) => Icons.crop_free_rounded;

  Widget _buildCourseCard(String category, bool hasGala) {
    final scanned = _isScanned(category);
    final time = _getScannedTime(category);

    final label = category;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: (!scanned && hasGala)
            ? () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) =>
                        GalaQRScannerScreen(expectedCategory: category),
                  ),
                );
                _refetchScanStatus();
              }
            : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 148,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.white,
            border: Border.all(color: _GalaTokens.border, width: 1),
            boxShadow: [_GalaTokens.cardShadow],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _GalaTokens.scanWell,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Icon(
                    _iconForCategory(category),
                    color: _GalaTokens.orange,
                    size: 24,
                  ),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'GeneralSans',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      height: 20 / 14,
                      color: _GalaTokens.grey2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (scanned && time != null && time.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      _formatTimeDisplay(time) ?? time,
                      style: const TextStyle(
                        fontFamily: 'GeneralSans',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: _GalaTokens.grey1,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _timeRangeForGala(Map<String, dynamic> galaDinner, String category) {
    final startersRaw = galaDinner['startersServingStartTime'] as String?;
    final dinnerRaw = galaDinner['dinnerServingStartTime'] as String?;

    DateTime? _parse(String? t) {
      if (t == null) return null;
      final parts = t.split(':');
      if (parts.length != 2) return null;
      final now = DateTime.now();
      return DateTime(
        now.year,
        now.month,
        now.day,
        int.parse(parts[0]),
        int.parse(parts[1]),
      );
    }

    String _format(DateTime dt) {
      final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour < 12 ? 'AM' : 'PM';
      return '$h:$m $ampm';
    }

    final startersTime = _parse(startersRaw);
    final dinnerTime = _parse(dinnerRaw);

    if (category == 'Starters' && startersTime != null) {
      final end = startersTime.add(const Duration(minutes: 90)); // 1.5 hrs
      return '${_format(startersTime)} - ${_format(end)}';
    }

    if ((category == 'Main Course' || category == 'Desserts') &&
        dinnerTime != null) {
      final end = dinnerTime.add(const Duration(hours: 2));
      return '${_format(dinnerTime)} - ${_format(end)}';
    }

    return '--';
  }

  Widget _buildMenuCards(List<dynamic> menus, Map<String, dynamic> galaDinner) {
    dynamic startersMenu;
    dynamic mainMenu;
    dynamic dessertsMenu;

    for (final m in menus) {
      final cat = m['category'] as String? ?? '';
      if (cat == 'Starters') startersMenu = m;
      if (cat == 'Main Course') mainMenu = m;
      if (cat == 'Desserts') dessertsMenu = m;
    }

    final ordered = <dynamic>[
      if (startersMenu != null) startersMenu,
      if (mainMenu != null) mainMenu,
      if (dessertsMenu != null) dessertsMenu,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (int i = 0; i < ordered.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          _buildMenuCard(
            ordered[i],
            initiallyExpanded: i == 0,
            galaDinner: galaDinner, // ✅ pass this
          ),
        ],
      ],
    );
  }

  Widget _buildMenuCard(
    dynamic menu, {
    required bool initiallyExpanded,
    required Map<String, dynamic> galaDinner, // ✅ new
  }) {
    final category = menu['category'] as String? ?? '';
    final items = menu['items'] as List<dynamic>? ?? [];

    return _GalaMenuCard(
      category: category,
      items: items,
      initiallyExpanded: initiallyExpanded,
      timeRangeText: _timeRangeForGala(galaDinner, category), // ✅ correct
    );
  }
}

/// Expandable/collapsible menu card matching Mess section style (dropdown).
class _GalaMenuCard extends StatefulWidget {
  final String category;
  final List<dynamic> items;
  final bool initiallyExpanded;
  final String timeRangeText;

  const _GalaMenuCard({
    required this.category,
    required this.items,
    required this.initiallyExpanded,
    required this.timeRangeText,
  });

  @override
  State<_GalaMenuCard> createState() => _GalaMenuCardState();
}

class _GalaMenuCardState extends State<_GalaMenuCard> {
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  static const _sectionLabelStyle = TextStyle(
    fontFamily: 'GeneralSans',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 16 / 12,
    color: _GalaTokens.grey1,
  );

  Widget _buildItem(String name, {String? type, double top = 0}) {
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Text(
              name,
              style: const TextStyle(
                fontFamily: 'GeneralSans',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                height: 20 / 14,
                color: _GalaTokens.grey2,
              ),
            ),
          ),
          if (type != null && type.isNotEmpty)
            Text(
              ' ($type)',
              style: TextStyle(
                fontFamily: 'GeneralSans',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade600,
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final displayCategory =
        widget.category == 'Starters' ? 'Starter' : widget.category;
    final isMainCourse = widget.category == 'Main Course';
    final dishItems = isMainCourse
        ? widget.items
            .where((i) => (i['type'] as String? ?? '').toLowerCase() == 'dish')
            .toList()
        : <dynamic>[];
    final breadsItems = isMainCourse
        ? widget.items
            .where((i) =>
                (i['type'] as String? ?? '').toLowerCase() == 'breads and rice')
            .toList()
        : <dynamic>[];
    final othersItems = isMainCourse
        ? widget.items
            .where(
                (i) => (i['type'] as String? ?? '').toLowerCase() == 'others')
            .toList()
        : <dynamic>[];

    final categoryColor = _expanded ? _GalaTokens.grey2 : _GalaTokens.grey1;

    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
          border: Border.all(color: _GalaTokens.border),
          boxShadow: [_GalaTokens.cardShadow],
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      displayCategory,
                      style: TextStyle(
                        fontFamily: 'GeneralSans',
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        height: 24 / 16,
                        color: categoryColor,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: _GalaTokens.grey1,
                    ),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.access_time_rounded,
                        size: 16,
                        color: _GalaTokens.grey1,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        widget.timeRangeText,
                        style: const TextStyle(
                          fontFamily: 'GeneralSans',
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          height: 20 / 14,
                          color: _GalaTokens.grey1b,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (isMainCourse)
                    _buildMainCourseContent(dishItems, breadsItems, othersItems)
                  else if (widget.items.isEmpty)
                    Text(
                      'No items',
                      style: TextStyle(
                        fontFamily: 'GeneralSans',
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade600,
                      ),
                    )
                  else
                    ..._buildDishItemList(),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildDishItemList() {
    return [
      const Text('DISH', style: _sectionLabelStyle),
      ...widget.items.asMap().entries.map((e) {
        final name = e.value['name'] as String? ?? '';
        return _buildItem(name, top: e.key == 0 ? 8 : 4);
      }),
    ];
  }

  Widget _buildMainCourseContent(
      List<dynamic> dish, List<dynamic> breads, List<dynamic> others) {
    final hasAny = dish.isNotEmpty || breads.isNotEmpty || others.isNotEmpty;
    if (!hasAny) {
      return Text(
        'No items',
        style: TextStyle(
          fontFamily: 'GeneralSans',
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.grey.shade600,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('DISH', style: _sectionLabelStyle),
        ...dish.asMap().entries.map((e) => _buildItem(
              e.value['name'] as String? ?? '',
              top: e.key == 0 ? 8 : 4,
            )),
        const Divider(
          color: _GalaTokens.border,
          thickness: 1,
          height: 24,
        ),
        if (breads.isEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('OTHERS', style: _sectionLabelStyle),
              ...others.asMap().entries.map((e) => _buildItem(
                    e.value['name'] as String? ?? '',
                    top: e.key == 0 ? 8 : 4,
                  )),
            ],
          )
        else
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('BREADS & RICE', style: _sectionLabelStyle),
                      ...breads.asMap().entries.map((e) => _buildItem(
                            e.value['name'] as String? ?? '',
                            top: e.key == 0 ? 8 : 4,
                          )),
                    ],
                  ),
                ),
                const VerticalDivider(
                  color: _GalaTokens.border,
                  thickness: 1,
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('OTHERS', style: _sectionLabelStyle),
                        ...others.asMap().entries.map((e) => _buildItem(
                              e.value['name'] as String? ?? '',
                              top: e.key == 0 ? 8 : 4,
                            )),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
