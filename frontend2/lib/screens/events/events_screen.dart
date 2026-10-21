import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:frontend2/apis/events/events_api.dart';
import 'package:frontend2/constants/app_ui_tokens.dart';
import 'package:frontend2/screens/events/event_detail_screen.dart';
import 'package:frontend2/utils/api_error_message.dart';

String formatEventTime(DateTime start, DateTime? end) {
  final day = DateFormat('EEE, d MMM');
  final time = DateFormat('h:mm a');
  if (end == null) return '${day.format(start)} · ${time.format(start)}';
  final sameDay = start.year == end.year &&
      start.month == end.month &&
      start.day == end.day;
  return sameDay
      ? '${day.format(start)} · ${time.format(start)} – ${time.format(end)}'
      : '${day.format(start)} – ${day.format(end)}';
}

/// Short status for the user's registration, or null if not registered.
({String label, Color color, Color background})? registrationBadge(
    CampusEvent event) {
  final reg = event.myRegistration;
  if (reg == null) return null;
  if (reg.checkedInAt != null) {
    return (
      label: 'Entered',
      color: AppUi.textSecondary,
      background: AppUi.sectionDivider,
    );
  }
  if (reg.isApproved) {
    return (
      label: 'Registered',
      color: const Color(0xFF1E7B34),
      background: const Color(0xFFE6F6EA),
    );
  }
  if (reg.isPending) {
    return (
      label: 'Awaiting approval',
      color: AppUi.yellow,
      background: AppUi.yellowSoft,
    );
  }
  return (
    label: 'Not approved',
    color: const Color(0xFFB42318),
    background: const Color(0xFFFEF3F2),
  );
}

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  final EventsApi _api = EventsApi();
  late Future<List<CampusEvent>> _future;

  @override
  void initState() {
    super.initState();
    _future = _api.listEvents();
  }

  Future<void> _refresh() async {
    final future = _api.listEvents();
    setState(() => _future = future);
    await future.catchError((_) => <CampusEvent>[]);
  }

  Future<void> _open(CampusEvent event) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => EventDetailScreen(eventId: event.id)),
    );
    if (mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F8F8),
      appBar: AppBar(
        title: const Text('Events'),
        backgroundColor: AppUi.surface,
        foregroundColor: AppUi.textPrimary,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<CampusEvent>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _Message(
                icon: Icons.cloud_off_outlined,
                text: userFacingApiError(
                  snapshot.error!,
                  fallback: 'Could not load events. Pull down to retry.',
                ),
              );
            }
            final events = snapshot.data ?? [];
            if (events.isEmpty) {
              return const _Message(
                icon: Icons.event_busy_outlined,
                text: 'No upcoming events right now.',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) => _EventCard(
                event: events[i],
                onTap: () => _open(events[i]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});

  final CampusEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final badge = registrationBadge(event);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: AppUi.cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    event.title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppUi.textPrimary,
                    ),
                  ),
                ),
                if (event.isVolunteer)
                  const EventChip(
                    label: 'Volunteer',
                    color: AppUi.primary,
                    background: AppUi.primarySoft,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            _IconLine(
              icon: Icons.schedule,
              text: formatEventTime(event.startsAt, event.endsAt),
            ),
            if (event.venue.isNotEmpty) ...[
              const SizedBox(height: 4),
              _IconLine(icon: Icons.place_outlined, text: event.venue),
            ],
            if (badge != null) ...[
              const SizedBox(height: 12),
              EventChip(
                label: badge.label,
                color: badge.color,
                background: badge.background,
              ),
            ] else if (!event.registrationOpen || event.isFull) ...[
              const SizedBox(height: 12),
              EventChip(
                label: event.isFull ? 'Full' : 'Registrations closed',
                color: AppUi.textSecondary,
                background: AppUi.sectionDivider,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppUi.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: AppUi.textSecondary),
          ),
        ),
      ],
    );
  }
}

class EventChip extends StatelessWidget {
  const EventChip({
    super.key,
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    // ListView so pull-to-refresh still works on empty and error states.
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 120),
      children: [
        Icon(icon, size: 48, color: AppUi.textMuted),
        const SizedBox(height: 12),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppUi.textSecondary),
        ),
      ],
    );
  }
}
