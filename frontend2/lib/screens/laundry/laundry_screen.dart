import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../apis/laundry/laundry_api.dart';
import '../../widgets/microsoft_required_dialog.dart';
import 'laundry_qr_scan.dart';

class LaundryScreen extends StatefulWidget {
  const LaundryScreen({super.key});

  @override
  State<LaundryScreen> createState() => _LaundryScreenState();
}

class _LaundryScreenState extends State<LaundryScreen> {
  final LaundryApi _api = LaundryApi();
  LaundryStatus? _status;
  bool _loading = true;
  String? _error;

  static const Color _appPrimary = Color(0xFF3754DB);
  static const Color _appPrimaryLight = Color(0xFFEEF1FC);
  static const Color _cardBorder = Color(0xFFC5C5D1);
  static const Color _surfaceLight = Color(0xFFF5F5F5);
  static const Color _textMuted = Color(0xFF6B7280);
  static const Color _disabledBg = Color(0xFFE5E7EB);
  static const Color _disabledFg = Color(0xFF9CA3AF);

  static const int _cooldownDays = 14;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final status = await _api.getStatus();
      if (mounted) {
        setState(() {
          _status = status;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  /// Calendar-day difference in local time (IST-friendly).
  /// Example: 15 Mar 23:30 → on 16 Mar 00:05 this returns 1 (\"yesterday\"),
  /// even though less than 24 hours passed.
  int? _daysSince(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now().toLocal();
    final d = date.toLocal();
    final today = DateTime(now.year, now.month, now.day);
    final thatDay = DateTime(d.year, d.month, d.day);
    return today.difference(thatDay).inDays;
  }

  /// Calendar-day difference until target date in local time.
  int? _daysUntil(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now().toLocal();
    final d = date.toLocal();
    final today = DateTime(now.year, now.month, now.day);
    final targetDay = DateTime(d.year, d.month, d.day);
    return targetDay.difference(today).inDays;
  }

  String _daysAgoText(int? days) {
    if (days == null || days < 0) return 'recently';
    if (days == 0) return 'today';
    return days == 1 ? '1 day ago' : '$days days ago';
  }

  String _daysLeftText(int? days) {
    if (days == null || days <= 0) return 'soon';
    return days == 1 ? '1 day' : '$days days';
  }

  /// Days left for display: day-of-use counts as day 1, so show 14 (not 13).
  int? _daysLeftForDisplay(LaundryStatus s) {
    final daysSince = _daysSince(s.lastUsed);
    if (daysSince == 0) return _cooldownDays; // used today = 14 days left
    return _daysUntil(s.nextAvailable);
  }

  String _buildStatusTitle(LaundryStatus s) {
    if (!s.hostelHasLaundry) return 'Not available for your hostel.';
    if (s.canUse) {
      if (s.lastUsed == null) return "You're ready for a free wash.";
      return "You're eligible to wash again.";
    }
    final daysAgo = _daysSince(s.lastUsed);
    final daysLeft = _daysLeftForDisplay(s);
    if (daysLeft != null && daysLeft > 0) {
      return 'Used ${_daysAgoText(daysAgo)}. Next wash in ${_daysLeftText(daysLeft)}.';
    }
    return 'Next free wash coming soon.';
  }

  String _buildStatusSubtitle(LaundryStatus s) {
    if (!s.hostelHasLaundry) {
      return s.message ?? 'Contact your hostel admin for more information.';
    }
    if (s.canUse) {
      return 'Visit the laundry point in your hostel and scan the QR code below.';
    }
    return 'Free washes reset every $_cooldownDays days after your last use.';
  }

  Future<void> _openScanner() async {
    final prefs = await SharedPreferences.getInstance();
    final hasMicrosoftLinked = prefs.getBool('hasMicrosoftLinked') ?? false;
    if (!mounted) return;
    if (!hasMicrosoftLinked) {
      showDialog(
        context: context,
        builder: (context) => const MicrosoftRequiredDialog(
          featureName: 'Laundry Service',
        ),
      );
      return;
    }
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (context) => const LaundryQrScanScreen()),
    );
    if (result == true && mounted) _loadStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        title: const Text(
          'Laundry Service',
          style: TextStyle(
            fontFamily: 'OpenSans_regular',
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.black,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _appPrimary))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadStatus,
                  color: _appPrimary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    child: _status == null
                        ? const SizedBox.shrink()
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildStatusCard(),
                              const SizedBox(height: 28),
                              _buildHistorySection(),
                            ],
                          ),
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _loadStatus,
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: _appPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final s = _status!;
    final canScan = s.hostelHasLaundry && s.canUse;
    final title = _buildStatusTitle(s);
    final subtitle = _buildStatusSubtitle(s);

    final daysSinceLastUse = _daysSince(s.lastUsed);
    // Day of use = day 1 (not 0): progress 1/14, "1 of 14 days", "14 days left"
    final dayNumber = daysSinceLastUse != null ? (daysSinceLastUse + 1) : 0;
    final cooldownProgress = (!canScan && daysSinceLastUse != null)
        ? (dayNumber / _cooldownDays).clamp(0.0, 1.0)
        : null;

    final showLastUsedChip = canScan && s.lastUsed != null;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _cardBorder, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /// STATUS PILL
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: canScan ? _appPrimaryLight : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: canScan ? _appPrimary : _disabledFg,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        canScan ? 'Available' : 'Unavailable',
                        style: TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: canScan ? _appPrimary : _textMuted,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                /// TITLE
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                    height: 1.4,
                  ),
                ),

                const SizedBox(height: 5),

                /// SUBTITLE
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontSize: 12,
                    color: _textMuted,
                    height: 1.45,
                  ),
                ),

                /// LAST USED CHIP (available + has history)
                if (showLastUsedChip) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _appPrimaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Last used ${_daysAgoText(_daysSince(s.lastUsed))}',
                      style: const TextStyle(
                        fontFamily: 'OpenSans_regular',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: _appPrimary,
                      ),
                    ),
                  ),
                ],

                /// COOLDOWN PROGRESS BAR (unavailable state)
                if (cooldownProgress != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${dayNumber.clamp(1, _cooldownDays)} of $_cooldownDays days',
                        style: const TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontSize: 11,
                          color: _textMuted,
                        ),
                      ),
                      Text(
                        '${_daysLeftText(_daysLeftForDisplay(s))} left',
                        style: const TextStyle(
                          fontFamily: 'OpenSans_regular',
                          fontSize: 11,
                          color: _textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: cooldownProgress,
                      minHeight: 5,
                      backgroundColor: const Color(0xFFE5E7EB),
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(_appPrimary),
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(width: 16),

          /// QR BUTTON
          GestureDetector(
            onTap: canScan ? _openScanner : null,
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: canScan ? _appPrimary : _disabledBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.qr_code_scanner_rounded,
                    color: canScan ? Colors.white : _disabledFg,
                    size: 28,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Scan QR',
                    style: TextStyle(
                      fontFamily: 'OpenSans_regular',
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: canScan ? Colors.white : _disabledFg,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistorySection() {
    final bookings = _status!.recentBookings;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 2, bottom: 12),
          child: Text(
            'Usage History',
            style: TextStyle(
              fontFamily: 'OpenSans_regular',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
        ),
        if (bookings.isEmpty)
          _buildEmptyHistory()
        else
          Column(
            children: List.generate(bookings.length, (index) {
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index < bookings.length - 1 ? 8 : 0,
                ),
                child: _buildBookingTile(bookings[index]),
              );
            }),
          ),
      ],
    );
  }

  Widget _buildEmptyHistory() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      decoration: BoxDecoration(
        color: _surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _cardBorder, width: 1),
      ),
      child: const Column(
        children: [
          _EmptyHistoryIcon(),
          SizedBox(height: 10),
          Text(
            'No washes yet',
            style: TextStyle(
              fontFamily: 'OpenSans_regular',
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Your usage history will appear here.',
            style: TextStyle(
              fontFamily: 'OpenSans_regular',
              fontSize: 12,
              color: _textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBookingTile(LaundryBookingSummary booking) {
    final ist =
        booking.usedAt.toUtc().add(const Duration(hours: 5, minutes: 30));
    final dateStr = DateFormat('d MMM yyyy').format(ist);
    final timeStr = DateFormat('h:mm a').format(ist);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _cardBorder, width: 1),
      ),
      child: Row(
        children: [
          /// ICON
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: _appPrimaryLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.access_time_rounded,
              color: _appPrimary,
              size: 16,
            ),
          ),

          const SizedBox(width: 12),

          /// DATE + TIME stacked
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateStr,
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  timeStr,
                  style: const TextStyle(
                    fontFamily: 'OpenSans_regular',
                    fontSize: 12,
                    color: _textMuted,
                  ),
                ),
              ],
            ),
          ),

          /// FREE WASH BADGE
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _appPrimaryLight,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'Free wash',
              style: TextStyle(
                fontFamily: 'OpenSans_regular',
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _appPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyHistoryIcon extends StatelessWidget {
  const _EmptyHistoryIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: _LaundryScreenState._appPrimaryLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(
        Icons.local_laundry_service_outlined,
        color: _LaundryScreenState._appPrimary,
        size: 22,
      ),
    );
  }
}
