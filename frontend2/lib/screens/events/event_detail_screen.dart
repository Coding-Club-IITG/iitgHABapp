import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:frontend2/apis/events/events_api.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';
import 'package:frontend2/screens/events/event_scanner_screen.dart';
import 'package:frontend2/screens/events/events_screen.dart';
import 'package:frontend2/utils/api_error_message.dart';
import 'package:frontend2/widgets/common/snack_bar.dart';

class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  final EventsApi _api = EventsApi();
  CampusEvent? _event;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final event = await _api.getEvent(widget.eventId);
      if (!mounted) return;
      setState(() {
        _event = event;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _register() async {
    setState(() => _busy = true);
    try {
      final (event, message) = await _api.register(widget.eventId);
      if (!mounted) return;
      setState(() => _event = event);
      showSnackBar(message, Colors.green, context,
          duration: const Duration(seconds: 2));
    } catch (e) {
      if (!mounted) return;
      showSnackBar(userFacingApiError(e), Colors.red, context,
          duration: const Duration(seconds: 2));
      _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel registration?'),
        content: const Text(
            'Your entry QR will stop working. If the event has limited seats, '
            'you may not get one back.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel registration',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      final event = await _api.cancelRegistration(widget.eventId);
      if (!mounted) return;
      setState(() => _event = event);
    } catch (e) {
      if (!mounted) return;
      showSnackBar(userFacingApiError(e), Colors.red, context,
          duration: const Duration(seconds: 2));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enterVolunteerCode() async {
    final code = await showDialog<String>(
      context: context,
      builder: (_) => const _VolunteerCodeDialog(),
    );
    if (code == null || code.trim().isEmpty) return;

    setState(() => _busy = true);
    try {
      final event = await _api.joinAsVolunteer(widget.eventId, code.trim());
      if (!mounted) return;
      setState(() => _event = event);
      showSnackBar("You're a volunteer now. Open the Volunteer tab to scan.",
          Colors.green, context,
          duration: const Duration(seconds: 3));
    } catch (e) {
      if (!mounted) return;
      showSnackBar(userFacingApiError(e, fallback: 'Could not verify the code'),
          Colors.red, context,
          duration: const Duration(seconds: 2));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final event = _event;
    final appBar = AppBar(
      title: Text(event?.title ?? 'Event'),
      backgroundColor: AppUi.surface,
      foregroundColor: AppUi.textPrimary,
      elevation: 0,
      bottom: event != null && event.isVolunteer
          ? const TabBar(
              labelColor: AppUi.primary,
              unselectedLabelColor: AppUi.textSecondary,
              indicatorColor: AppUi.primary,
              tabs: [Tab(text: 'Details'), Tab(text: 'Volunteer')],
            )
          : null,
    );

    Widget body;
    if (event == null) {
      body = _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      userFacingApiError(_error!,
                          fallback: 'Could not load this event.'),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : const Center(child: CircularProgressIndicator());
    } else if (event.isVolunteer) {
      body = TabBarView(
        children: [_buildDetails(event), _VolunteerTab(event: event)],
      );
    } else {
      body = _buildDetails(event);
    }

    final scaffold = Scaffold(
      backgroundColor: const Color(0xFFF8F8F8),
      appBar: appBar,
      body: body,
    );
    return event != null && event.isVolunteer
        ? DefaultTabController(length: 2, child: scaffold)
        : scaffold;
  }

  Widget _buildDetails(CampusEvent event) {
    final badge = registrationBadge(event);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: AppUi.cardDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _InfoRow(
                  icon: Icons.schedule,
                  text: formatEventTime(event.startsAt, event.endsAt),
                ),
                if (event.venue.isNotEmpty)
                  _InfoRow(icon: Icons.place_outlined, text: event.venue),
                if (event.seatsLeft != null)
                  _InfoRow(
                    icon: Icons.event_seat_outlined,
                    text: '${event.seatsLeft} of ${event.capacity} seats left',
                  ),
                if (event.registrationClosesAt != null)
                  _InfoRow(
                    icon: Icons.how_to_reg_outlined,
                    text: 'Registrations close '
                        '${DateFormat('d MMM, h:mm a').format(event.registrationClosesAt!)}',
                  ),
                if (event.description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    event.description,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: AppUi.textPrimary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (badge != null)
            Align(
              alignment: Alignment.centerLeft,
              child: EventChip(
                label: badge.label,
                color: badge.color,
                background: badge.background,
              ),
            ),
          const SizedBox(height: 12),
          _buildRegistrationSection(event),
          if (!event.isVolunteer) ...[
            const SizedBox(height: 24),
            TextButton.icon(
              onPressed: _busy ? null : _enterVolunteerCode,
              icon: const Icon(Icons.badge_outlined, size: 18),
              label: const Text('Volunteering? Enter access code'),
              style: TextButton.styleFrom(foregroundColor: AppUi.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRegistrationSection(CampusEvent event) {
    final reg = event.myRegistration;

    if (reg == null) {
      final canRegister = event.registrationOpen && !event.isFull;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton(
            onPressed: canRegister && !_busy ? _register : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppUi.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : Text(!event.registrationOpen
                    ? 'Registrations closed'
                    : event.isFull
                        ? 'Event is full'
                        : 'Register'),
          ),
          if (canRegister && event.requiresApproval)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Registrations for this event are approved by the organisers. '
                "You'll get your entry QR once you're approved.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppUi.textSecondary),
              ),
            ),
        ],
      );
    }

    final children = <Widget>[];
    if (reg.isApproved && reg.qrPayload != null && reg.checkedInAt == null) {
      children.add(_EntryQrCard(payload: reg.qrPayload!));
    } else if (reg.checkedInAt != null) {
      children.add(_Note(
        'You entered at '
        '${DateFormat('d MMM, h:mm a').format(reg.checkedInAt!)}. Enjoy the event!',
      ));
    } else if (reg.isPending) {
      children.add(const _Note(
          "Your registration is waiting for approval. Your entry QR will "
          "appear here once you're approved."));
    } else if (reg.isRejected) {
      children.add(const _Note(
          "Your registration wasn't approved for this event."));
    }

    if (reg.checkedInAt == null && !reg.isRejected) {
      children.add(TextButton(
        onPressed: _busy ? null : _cancel,
        child: const Text('Cancel registration',
            style: TextStyle(color: Colors.red)),
      ));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}

class _EntryQrCard extends StatelessWidget {
  const _EntryQrCard({required this.payload});

  final String payload;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: AppUi.cardDecoration(),
      child: Column(
        children: [
          const Text('Your entry QR', style: AppUi.sheetTitle),
          const SizedBox(height: 4),
          const Text(
            'Show this to a volunteer at the entry. It works once and only for you.',
            textAlign: TextAlign.center,
            style: AppUi.sheetSubtitle,
          ),
          const SizedBox(height: 16),
          QrImageView(
            data: payload,
            version: QrVersions.auto,
            size: 240,
            backgroundColor: Colors.white,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppUi.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style:
                  const TextStyle(fontSize: 14, color: AppUi.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppUi.cardDecoration(),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 14, color: AppUi.textPrimary),
      ),
    );
  }
}

class _VolunteerTab extends StatefulWidget {
  const _VolunteerTab({required this.event});

  final CampusEvent event;

  @override
  State<_VolunteerTab> createState() => _VolunteerTabState();
}

class _VolunteerTabState extends State<_VolunteerTab> {
  final EventsApi _api = EventsApi();
  ({int approved, int checkedIn})? _stats;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await _api.checkInStats(widget.event.id);
      if (mounted) setState(() => _stats = stats);
    } catch (_) {
      // Stats are informational; scanning still works without them.
    }
  }

  Future<void> _openScanner() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EventScannerScreen(
          eventId: widget.event.id,
          eventTitle: widget.event.title,
        ),
      ),
    );
    _loadStats();
  }

  @override
  Widget build(BuildContext context) {
    final stats = _stats;
    return RefreshIndicator(
      onRefresh: _loadStats,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: AppUi.cardDecoration(),
            child: Column(
              children: [
                Text(
                  stats == null ? '–' : '${stats.checkedIn} / ${stats.approved}',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w600,
                    color: AppUi.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                const Text('entered / registered',
                    style: TextStyle(color: AppUi.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _openScanner,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan entry QRs'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppUi.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            "Check the attendee's name and photo on screen before letting them in.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: AppUi.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _VolunteerCodeDialog extends StatefulWidget {
  const _VolunteerCodeDialog();

  @override
  State<_VolunteerCodeDialog> createState() => _VolunteerCodeDialogState();
}

class _VolunteerCodeDialogState extends State<_VolunteerCodeDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Volunteer access code'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(
          hintText: 'e.g. K7XQ9M',
          helperText: 'Get this code from the event organisers.',
        ),
        onSubmitted: (value) => Navigator.pop(context, value),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, _controller.text),
          child: const Text('Continue'),
        ),
      ],
    );
  }
}
