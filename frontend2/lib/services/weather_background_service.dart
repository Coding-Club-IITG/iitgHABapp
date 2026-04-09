import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class WeatherBackgroundData {
  final String assetPath;
  final bool isDay;
  final String weatherGroup;

  const WeatherBackgroundData({
    required this.assetPath,
    required this.isDay,
    required this.weatherGroup,
  });

  factory WeatherBackgroundData.fallback() {
    final isDay = _isLocalDaytime();
    return WeatherBackgroundData(
      assetPath: WeatherBackgroundService._assetFor(
        group: 'clear',
        isDay: isDay,
      ),
      isDay: isDay,
      weatherGroup: 'clear',
    );
  }

  factory WeatherBackgroundData.testing({
    required String group,
    required bool isDay,
  }) {
    return WeatherBackgroundData(
      assetPath: WeatherBackgroundService._assetFor(
        group: group,
        isDay: isDay,
      ),
      isDay: isDay,
      weatherGroup: group,
    );
  }

  static bool _isLocalDaytime() {
    final hour = DateTime.now().hour;
    return hour >= 6 && hour < 18;
  }
}

class WeatherBackgroundService {
  static const String _apiKey =
      String.fromEnvironment('OPENWEATHER_API_KEY', defaultValue: '');

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

      return WeatherBackgroundData(
        assetPath: _assetFor(group: weatherGroup, isDay: isDay),
        isDay: isDay,
        weatherGroup: weatherGroup,
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
    if (conditionId >= 200 && conditionId < 300) return 'thunder';
    if (conditionId >= 300 && conditionId < 600) return 'rainy';
    if (conditionId == 800) return 'clear';
    return 'cloudy';
  }

  static String _assetFor({
    required String group,
    required bool isDay,
  }) {
    if (group == 'thunder') {
      return isDay
          ? 'assets/images/thuder_day.png'
          : 'assets/images/thunder_night.png';
    }

    final suffix = isDay ? 'day' : 'night';
    return 'assets/images/${group}_$suffix.png';
  }
}
