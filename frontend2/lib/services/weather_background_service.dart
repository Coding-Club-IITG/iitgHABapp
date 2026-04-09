import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class WeatherBackgroundData {
  final String assetPath;
  final bool isDay;
  final String weatherGroup;
  final String backgroundVariant;
  final int? sunriseUnix;
  final int? sunsetUnix;

  const WeatherBackgroundData({
    required this.assetPath,
    required this.isDay,
    required this.weatherGroup,
    required this.backgroundVariant,
    this.sunriseUnix,
    this.sunsetUnix,
  });

  factory WeatherBackgroundData.fallback() {
    final now = DateTime.now();
    final isDay = _isLocalDaytime(now);
    final backgroundVariant =
        WeatherBackgroundService._backgroundVariantForClear(now);
    return WeatherBackgroundData(
      assetPath: WeatherBackgroundService._assetFor(
        group: 'clear',
        backgroundVariant: backgroundVariant,
      ),
      isDay: isDay,
      weatherGroup: 'clear',
      backgroundVariant: backgroundVariant,
      sunriseUnix: null,
      sunsetUnix: null,
    );
  }

  factory WeatherBackgroundData.testing({
    required String group,
    required bool isDay,
    String? backgroundVariant,
  }) {
    final resolvedVariant = backgroundVariant ?? (isDay ? 'afternoon' : 'evening');
    return WeatherBackgroundData(
      assetPath: WeatherBackgroundService._assetFor(
        group: group,
        backgroundVariant: resolvedVariant,
      ),
      isDay: isDay,
      weatherGroup: group,
      backgroundVariant: resolvedVariant,
      sunriseUnix: null,
      sunsetUnix: null,
    );
  }

  static bool _isLocalDaytime(DateTime now) {
    final hour = now.hour;
    return hour >= 6 && hour < 18;
  }
}

class WeatherBackgroundService {
  static const String _apiKey =
      "fac972ed26c46021158fe8e71bf560e1";    // TODO: remove before pushing 🙏

  Future<WeatherBackgroundData> fetchBackground() async {
    try {
      if (_apiKey.isEmpty) {
        return WeatherBackgroundData.fallback();
      }

      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return WeatherBackgroundData.fallback();
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return WeatherBackgroundData.fallback();
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
        ),
      );

      final uri = Uri.https('api.openweathermap.org', '/data/2.5/weather', {
        'lat': position.latitude.toString(),
        'lon': position.longitude.toString(),
        'appid': _apiKey,
      });

      final response = await http.get(uri).timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) {
        return WeatherBackgroundData.fallback();
      }

      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final weatherList = decoded['weather'] as List<dynamic>? ?? const [];
      final weather = weatherList.isNotEmpty
          ? weatherList.first as Map<String, dynamic>
          : const <String, dynamic>{};
      final conditionId = (weather['id'] as num?)?.toInt() ?? 800;
      final sys = decoded['sys'] as Map<String, dynamic>? ?? const {};
      final sunrise = (sys['sunrise'] as num?)?.toInt();
      final sunset = (sys['sunset'] as num?)?.toInt();
      final timestamp = (decoded['dt'] as num?)?.toInt();

      final isDay = _resolveIsDay(
        nowUnix: timestamp,
        sunriseUnix: sunrise,
        sunsetUnix: sunset,
      );
      final weatherGroup = _groupForCondition(conditionId);
      final backgroundVariant = _backgroundVariantFor(
        group: weatherGroup,
        now: DateTime.now(),
        isDay: isDay,
      );

      return WeatherBackgroundData(
        assetPath: _assetFor(
          group: weatherGroup,
          backgroundVariant: backgroundVariant,
        ),
        isDay: isDay,
        weatherGroup: weatherGroup,
        backgroundVariant: backgroundVariant,
        sunriseUnix: sunrise,
        sunsetUnix: sunset,
      );
    } catch (_) {
      return WeatherBackgroundData.fallback();
    }
  }

  bool _resolveIsDay({
    required int? nowUnix,
    required int? sunriseUnix,
    required int? sunsetUnix,
  }) {
    if (nowUnix != null && sunriseUnix != null && sunsetUnix != null) {
      return nowUnix >= sunriseUnix && nowUnix < sunsetUnix;
    }
    return WeatherBackgroundData.fallback().isDay;
  }

  String _groupForCondition(int conditionId) {
    if (conditionId >= 200 && conditionId < 600) return 'rainy';
    return 'clear';
  }

  static String _backgroundVariantFor({
    required String group,
    required DateTime now,
    required bool isDay,
  }) {
    if (group == 'rainy') {
      return 'rainy';
    }

    if (now.weekday == DateTime.saturday || now.weekday == DateTime.sunday) {
      return 'weekend';
    }

    return _timeOfDayVariant(now, isDay: isDay);
  }

  static String _backgroundVariantForClear(DateTime now) {
    if (now.weekday == DateTime.saturday || now.weekday == DateTime.sunday) {
      return 'weekend';
    }
    return _timeOfDayVariant(
      now,
      isDay: WeatherBackgroundData._isLocalDaytime(now),
    );
  }

  static String _timeOfDayVariant(DateTime now, {required bool isDay}) {
    final hour = now.hour;
    if (hour < 12) {
      return 'morning';
    }
    if (isDay && hour < 17) {
      return 'afternoon';
    }
    return 'evening';
  }

  static String _assetFor({
    required String group,
    required String backgroundVariant,
  }) {
    if (group == 'rainy') {
      return 'assets/images/Raining.png';
    }

    switch (backgroundVariant) {
      case 'weekend':
        return 'assets/images/weekend.png';
      case 'morning':
        return 'assets/images/Morning.png';
      case 'afternoon':
        return 'assets/images/Afternoon.png';
      case 'evening':
      default:
        return 'assets/images/Evening.png';
    }
  }
}
