import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:frontend2/apis/dio_client.dart';
import 'package:frontend2/constants/endpoint.dart';
import 'package:frontend2/apis/protected.dart';
import 'package:frontend2/apis/users/user.dart';
import 'package:frontend2/screens/gala_qr_scanner_screen.dart';
import 'package:frontend2/widgets/common/hostel_name.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _dio = DioClient().dio;

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
  String? _hostelDisplayName;
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
    final hostelId =
        _isValidObjectId(hostelID) ? hostelID : (_isValidObjectId(currMess) ? currMess : null);
    if (kDebugMode) {
      debugPrint('Gala: _getHostelId hostelID=$hostelID currMess=$currMess => hostelId=$hostelId');
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
        if (kDebugMode) debugPrint('Gala: no hostelId, fetching user details to populate currMess');
        try {
          await fetchUserDetails();
          if (!mounted) return;
          hostelId = await _getHostelId();
        } catch (_) {}
        if (hostelId == null || hostelId.isEmpty) {
          if (kDebugMode) debugPrint('Gala: no hostelId after fetch, showing error');
          setState(() {
            _error = 'No hostel selected. Open Mess or Profile first to set your hostel.';
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
      final name = await calculateHostelAsync(hostelId);
      if (!mounted) return;
      if (kDebugMode) debugPrint('Gala: _fetchAll done menus=${_menuData != null} scanStatus=${_scanStatusData != null}');
      setState(() {
        _loading = false;
        _hostelDisplayName = name;
      });
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('Gala: _fetchAll error=$e');
        debugPrint('Gala: stack=$st');
        if (e is DioException) {
          debugPrint('Gala: DioException response=${e.response?.data} statusCode=${e.response?.statusCode}');
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
    if (kDebugMode) debugPrint('Gala: upcoming-with-menus status=${response.statusCode} hasGala=${response.data is Map && (response.data as Map)['galaDinner'] != null} menusCount=${response.data is Map ? ((response.data as Map)['menus'] as List?)?.length : 0}');
    if (mounted) {
      setState(() {
        _menuData = response.data is Map ? Map<String, dynamic>.from(response.data) : null;
      });
    }
  }

  Future<void> _fetchScanStatus(String token) async {
    if (kDebugMode) debugPrint('Gala: GET scan-status url=${GalaEndpoints.scanStatus}');
    final response = await _dio.get(
      GalaEndpoints.scanStatus,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
    if (kDebugMode) debugPrint('Gala: scan-status status=${response.statusCode} hasScanLog=${response.data is Map && (response.data as Map)['scanLog'] != null}');
    if (mounted) {
      setState(() {
        _scanStatusData = response.data is Map ? Map<String, dynamic>.from(response.data) : null;
      });
    }
  }

  void _refetchScanStatus() async {
    final token = await getAccessToken();
    if (token == 'error' || !mounted) return;
    await _fetchScanStatus(token);
  }

  /// Format gala date for display. Use local time so "7 Mar" picked in admin shows as 7 Mar
  /// (backend may store as 6 Mar 18:30 UTC = 7 Mar 00:00 IST).
  static String _formatDate(dynamic date) {
    if (date == null) return '';
    final d = date is String ? DateTime.tryParse(date) : null;
    if (d == null) return date.toString();
    final local = d.toLocal();
    return '${local.day} ${_month(local.month)} ${local.year}';
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

  static const List<String> _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static String _month(int m) => m >= 1 && m <= 12 ? _months[m - 1] : '';

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

  @override
  Widget build(BuildContext context) {
    if (__isloading()) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                TextButton(onPressed: _fetchAll, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final galaDinner = _menuData?['galaDinner'] as Map<String, dynamic>?;
    final menus = _menuData?['menus'] as List<dynamic>? ?? [];
    final hasGala = galaDinner != null && menus.isNotEmpty;
    final dateStr = hasGala ? _formatDate(galaDinner['date']) : null;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchAll,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Gala Dinner',
                  style: TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontSize: 32,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E2F31),
                  ),
                ),
                if (hasGala) ...[
                  const SizedBox(height: 12),
                  Card(
                    elevation: 1,
                    color: const Color(0xFFF7F7FB),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (dateStr != null)
                            Text(
                              dateStr,
                              style: const TextStyle(
                                fontSize: 15,
                                color: Color(0xFF676767),
                              ),
                            ),
                          const SizedBox(height: 10),
                          Text(
                            _hostelDisplayName != null && _hostelDisplayName != 'Unknown'
                                ? "${_hostelDisplayName!} Gala Dinner"
                                : 'Gala Dinner',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2E2F31),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _hostelDisplayName != null && _hostelDisplayName != 'Unknown'
                                ? 'You are warmly invited to a special gala dinner at $_hostelDisplayName.'
                                : 'You are warmly invited to a special gala dinner.',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Color(0xFF676767),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Builder(
                            builder: (context) {
                              final starters = _formatTimeDisplay(
                                  galaDinner['startersServingStartTime'] as String?);
                              final dinner = _formatTimeDisplay(
                                  galaDinner['dinnerServingStartTime'] as String?);

                              String line;
                              if (starters != null && dinner != null) {
                                line = 'Starters • $starters   ·   Dinner • $dinner';
                              } else if (starters != null) {
                                line = 'Starters • $starters';
                              } else if (dinner != null) {
                                line = 'Dinner • $dinner';
                              } else {
                                line = 'Serving times will be announced soon.';
                              }

                              return Text(
                                line,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF4C4EDB),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                ],
                _buildCourseBlocks(hasGala),
                if (hasGala) ...[
                  const SizedBox(height: 8),
                  const Text(
                    '*Please scan only while collecting your plate. Once scanned, it cannot be scanned again.',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF929292),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                if (hasGala)
                  _buildMenuCards(menus)
                else
                  Card(
                    elevation: 0.5,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(20.0),
                      child: Center(
                        child: Text(
                          'No upcoming Gala Dinner scheduled.',
                          style: TextStyle(
                            fontSize: 15,
                            color: Color(0xFF676767),
                          ),
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

  Widget _buildCourseBlocks(bool hasGala) {
    const categories = ['Starters', 'Main Course', 'Desserts'];
    return Row(
      children: categories.map((category) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: _buildCourseCard(category, hasGala),
          ),
        );
      }).toList(),
    );
  }

  static IconData _iconForCategory(String category) {
    switch (category) {
      case 'Starters':
        return Icons.soup_kitchen;
      case 'Main Course':
        return Icons.restaurant;
      case 'Desserts':
        return Icons.cake;
      default:
        return Icons.qr_code_scanner;
    }
  }

  static Color _iconBgForCategory(String category, bool hasGala) {
    if (!hasGala) return Colors.grey.shade200;
    switch (category) {
      case 'Starters':
        return const Color(0xFFE8F0FE);
      case 'Main Course':
      case 'Desserts':
        return const Color(0xFFEDEDFB);
      default:
        return const Color(0xFFEDEDFB);
    }
  }

  Widget _buildCourseCard(String category, bool hasGala) {
    final scanned = _isScanned(category);
    final time = _getScannedTime(category);
    const primaryBlue = Color(0xFF4C4EDB);
    const textGrey = Color(0xFF676767);

    Widget content;
    if (scanned) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.green.shade500,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.green.withValues(alpha: 0.18),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(
              _iconForCategory(category),
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            category,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: textGrey,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (time != null && time.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              time,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ],
      );
    } else {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _iconBgForCategory(category, hasGala),
              shape: BoxShape.circle,
              boxShadow: hasGala
                  ? [
                      BoxShadow(
                        color: primaryBlue.withValues(alpha: 0.08),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Icon(
              _iconForCategory(category),
              color: hasGala ? primaryBlue : Colors.grey,
              size: 18,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            category,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: hasGala ? const Color(0xFF2E2F31) : Colors.grey,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (hasGala) ...[
            const SizedBox(height: 4),
            const Text(
              'Tap to scan',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: primaryBlue,
              ),
            ),
          ],
        ],
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: (!scanned && hasGala)
            ? () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => GalaQRScannerScreen(expectedCategory: category),
                  ),
                );
                _refetchScanStatus();
              }
            : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.white,
            border: Border.all(
              color: scanned ? Colors.green.shade100 : const Color(0xFFE6E6E6),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: content,
        ),
      ),
    );
  }

  /// Layout: Main Course full width, then Starters (half) | Desserts (half).
  Widget _buildMenuCards(List<dynamic> menus) {
    dynamic mainMenu;
    dynamic startersMenu;
    dynamic dessertsMenu;
    for (final m in menus) {
      final cat = m['category'] as String? ?? '';
      if (cat == 'Main Course') {
        mainMenu = m;
      } else if (cat == 'Starters') {
        startersMenu = m;
      } else if (cat == 'Desserts') {
        dessertsMenu = m;
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mainMenu != null) _buildMenuCard(mainMenu),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: startersMenu != null ? _buildMenuCard(startersMenu) : const SizedBox.shrink()),
            const SizedBox(width: 8),
            Expanded(child: dessertsMenu != null ? _buildMenuCard(dessertsMenu) : const SizedBox.shrink()),
          ],
        ),
      ],
    );
  }

  Widget _buildMenuCard(dynamic menu) {
    final category = menu['category'] as String? ?? '';
    final items = menu['items'] as List<dynamic>? ?? [];
    return _GalaMenuCard(category: category, items: items);
  }
}

/// Expandable/collapsible menu card matching Mess section style (dropdown).
class _GalaMenuCard extends StatefulWidget {
  final String category;
  final List<dynamic> items;

  const _GalaMenuCard({required this.category, required this.items});

  @override
  State<_GalaMenuCard> createState() => _GalaMenuCardState();
}

class _GalaMenuCardState extends State<_GalaMenuCard> {
  bool _expanded = false;

  static const _sectionLabelStyle = TextStyle(
    fontFamily: "Manrope_semibold",
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: Color(0xFF676767),
  );

  Widget _buildItem(String name, [String? type]) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Text(
              name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2E2F31),
              ),
            ),
          ),
          if (type != null && type.isNotEmpty)
            Text(
              ' ($type)',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMainCourse = widget.category == 'Main Course';
    final dishItems = isMainCourse
        ? widget.items.where((i) => (i['type'] as String? ?? '').toLowerCase() == 'dish').toList()
        : <dynamic>[];
    final breadsItems = isMainCourse
        ? widget.items.where((i) => (i['type'] as String? ?? '').toLowerCase() == 'breads and rice').toList()
        : <dynamic>[];
    final othersItems = isMainCourse
        ? widget.items.where((i) => (i['type'] as String? ?? '').toLowerCase() == 'others').toList()
        : <dynamic>[];

    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: const Color(0xFFFFFFFF),
          border: Border.all(color: const Color(0xFFC5C5D1)),
        ),
        child: InkWell(
          customBorder: Border.all(color: const Color(0xFFC5C5D1), width: 1),
          borderRadius: BorderRadius.circular(16),
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          focusColor: Colors.transparent,
          splashColor: Colors.transparent,
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.category,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF676767),
                        ),
                      ),
                    ),
                    Icon(
                      _expanded ? Icons.expand_less : Icons.expand_more,
                      size: 20,
                      color: const Color(0xFF4C4EDB),
                    ),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 12),
                  if (isMainCourse) _buildMainCourseContent(dishItems, breadsItems, othersItems)
                  else if (widget.items.isEmpty)
                    Text(
                      'No items',
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    )
                  else
                    ...widget.items.map<Widget>((item) {
                      final name = item['name'] as String? ?? '';
                      return _buildItem(name);
                    }),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMainCourseContent(List<dynamic> dish, List<dynamic> breads, List<dynamic> others) {
    final hasAny = dish.isNotEmpty || breads.isNotEmpty || others.isNotEmpty;
    if (!hasAny) {
      return Text(
        'No items',
        style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("DISH", style: _sectionLabelStyle),
        ...dish.map<Widget>((item) => _buildItem(item['name'] as String? ?? '')),
        const Divider(
          color: Color(0xFFE6E6E6),
          thickness: 1.8,
          height: 32,
        ),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("BREADS & RICE", style: _sectionLabelStyle),
                    ...breads.map<Widget>((item) => _buildItem(item['name'] as String? ?? '')),
                  ],
                ),
              ),
              const VerticalDivider(
                color: Color(0xFFE6E6E6),
                thickness: 1.8,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text("OTHERS", style: _sectionLabelStyle),
                      ...others.map<Widget>((item) => _buildItem(item['name'] as String? ?? '')),
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
