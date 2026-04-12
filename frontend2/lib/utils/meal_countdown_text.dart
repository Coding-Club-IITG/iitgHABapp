/// Human-readable meal countdown strings (Mess tab, home mess card, QR status).
String _hourUnit(int hours) => hours == 1 ? 'hr' : 'hrs';

/// Time until the meal window opens, e.g. `In 1 hr 5 m`, `In 40 m`.
String mealTimeUntilStart(Duration diff) {
  if (diff.inSeconds <= 0) return 'Starting now';
  final hours = diff.inHours;
  final minutes = diff.inMinutes.remainder(60);
  if (hours > 0 && minutes == 0) return 'In $hours ${_hourUnit(hours)}';
  if (hours > 0) return 'In $hours ${_hourUnit(hours)} $minutes m';
  return 'In $minutes m';
}

/// Time until the meal window ends, e.g. `1 hr 1 m left`, `45 m left`.
String mealTimeRemaining(Duration duration) {
  if (duration.inSeconds <= 0) return '0 m left';
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60);
  if (hours > 0) {
    if (minutes == 0) return '$hours ${_hourUnit(hours)} left';
    return '$hours ${_hourUnit(hours)} $minutes m left';
  }
  final safeMinutes = minutes <= 0 ? 1 : minutes;
  return '$safeMinutes m left';
}
