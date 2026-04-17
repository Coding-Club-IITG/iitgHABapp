import 'dart:convert';

import 'package:flutter/services.dart';
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

  /// Clear-sky hero from local clock + weekend rules only (no sunrise/sunset API).
  factory WeatherBackgroundData.localTimeDefault() => WeatherBackgroundData.fallback();

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
  static const MethodChannel _configChannel =
      MethodChannel('in.codingclub.hab/config');
  static String? _cachedApiKey;

  Future<String> _resolveApiKey() async {
    if (_cachedApiKey != null) {
      return _cachedApiKey!;
    }

    var key = '';
    try {
      key = (await _configChannel
              .invokeMethod<String>('getOpenWeatherApiKey'))
              ?.trim() ??
          '';
    } catch (_) {
      key = '';
    }

    // Keep support for non-Android/testing builds via dart-define.
    if (key.isEmpty) {
      key = const String.fromEnvironment(
        'OPENWEATHER_API_KEY',
        defaultValue: '',
      ).trim();
    }

    _cachedApiKey = key;
    return key;
  }

  Future<WeatherBackgroundData> fetchBackground() async {
    try {
      final apiKey = await _resolveApiKey();
      if (apiKey.isEmpty) {
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
        'appid': apiKey,
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
        nowUnix: timestamp,
        isDay: isDay,
        sunriseUnix: sunrise,
        sunsetUnix: sunset,
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
    required int? nowUnix,
    required bool isDay,
    int? sunriseUnix,
    int? sunsetUnix,
  }) {
    if (group == 'rainy') {
      return 'rainy';
    }

    // Check if we're in the weekend period (7PM Friday to 10PM Sunday)
    if (_isWeekendPeriod()) {
      return 'weekend';
    }

    return _timeOfDayVariant(
      nowUnix: nowUnix,
      sunriseUnix: sunriseUnix,
      sunsetUnix: sunsetUnix,
    );
  }

  static bool _isWeekendPeriod() {
    final now = DateTime.now();
    final hour = now.hour;
    
    // Friday (5): 7PM (19:00) onwards
    if (now.weekday == DateTime.friday && hour >= 19) {
      return true;
    }
    // Saturday (6): entire day
    if (now.weekday == DateTime.saturday) {
      return true;
    }
    // Sunday (7): up to 10PM (22:00)
    if (now.weekday == DateTime.sunday && hour < 22) {
      return true;
    }
    return false;
  }

  static String _backgroundVariantForClear(DateTime now) {
    if (_isWeekendPeriod()) {
      return 'weekend';
    }
    return _timeOfDayVariant();
  }

  static String _timeOfDayVariant({
    int? nowUnix,
    int? sunriseUnix,
    int? sunsetUnix,
  }) {
    // Use actual sunrise/sunset times if available
    if (nowUnix != null && sunriseUnix != null && sunsetUnix != null) {
      // morning: sunrise to 12PM (solar noon)
      // afternoon: 12PM to sunset
      // evening: sunset to sunrise (next day)
      
      final noonUnix = sunriseUnix + ((sunsetUnix - sunriseUnix) ~/ 2);

      if (nowUnix >= sunriseUnix && nowUnix < noonUnix) {
        return 'morning';
      }
      if (nowUnix >= noonUnix && nowUnix < sunsetUnix) {
        return 'afternoon';
      }
      return 'evening';
    }

    // Fallback to hour-based logic if Unix timestamps not available
    // Assume sunrise at 6 AM and sunset at 6 PM
    final now = DateTime.now();
    final hour = now.hour;
    if (hour < 6 || hour >= 18) {
      return 'evening';
    }
    if (hour < 12) {
      return 'morning';
    }
    return 'afternoon';
  }

  static String _assetFor({
    required String group,
    required String backgroundVariant,
  }) {
    if (group == 'rainy') {
      return 'assets/images/Rainy.png';
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
