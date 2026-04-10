import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:hive/hive.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:frontend2/constants/endpoint.dart';

class FestivalModeData {
  final String?
      festivalId; // MongoDB document ID for caching by festival instance
  final bool isEnabled;
  final String? imageWithAlerts;
  final String? imageWithoutAlerts;
  final String overlayTextWithAlerts;
  final String overlayTextWithoutAlerts;
  final DateTime lastUpdatedAt;
  final DateTime cacheUntil;

  FestivalModeData({
    this.festivalId,
    required this.isEnabled,
    this.imageWithAlerts,
    this.imageWithoutAlerts,
    this.overlayTextWithAlerts = "Happy Diwali",
    this.overlayTextWithoutAlerts = "Happy Diwali",
    required this.lastUpdatedAt,
    required this.cacheUntil,
  });

  factory FestivalModeData.fromJson(Map<String, dynamic> json) {
    return FestivalModeData(
      festivalId: json['festivalId'],
      isEnabled: json['isEnabled'] ?? false,
      imageWithAlerts: json['imageWithAlerts'],
      imageWithoutAlerts: json['imageWithoutAlerts'],
      overlayTextWithAlerts: json['overlayTextWithAlerts'] ?? "Happy Diwali",
      overlayTextWithoutAlerts:
          json['overlayTextWithoutAlerts'] ?? "Happy Diwali",
      lastUpdatedAt: DateTime.parse(
          json['lastUpdatedAt'] ?? DateTime.now().toIso8601String()),
      cacheUntil: DateTime.parse(json['cacheUntil'] ??
          DateTime.now().add(Duration(hours: 6)).toIso8601String()),
    );
  }

  factory FestivalModeData.disabled() {
    return FestivalModeData(
      festivalId: null,
      isEnabled: false,
      imageWithAlerts: null,
      imageWithoutAlerts: null,
      overlayTextWithAlerts: "Happy Diwali",
      overlayTextWithoutAlerts: "Happy Diwali",
      lastUpdatedAt: DateTime.now(),
      cacheUntil: DateTime.now().add(Duration(hours: 6)),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'festivalId': festivalId,
      'isEnabled': isEnabled,
      'imageWithAlerts': imageWithAlerts,
      'imageWithoutAlerts': imageWithoutAlerts,
      'overlayTextWithAlerts': overlayTextWithAlerts,
      'overlayTextWithoutAlerts': overlayTextWithoutAlerts,
      'lastUpdatedAt': lastUpdatedAt.toIso8601String(),
      'cacheUntil': cacheUntil.toIso8601String(),
    };
  }

  bool isCacheExpired() => DateTime.now().isAfter(cacheUntil);
}

class FestivalModeService {
  static final FestivalModeService _instance = FestivalModeService._internal();

  factory FestivalModeService() {
    return _instance;
  }

  FestivalModeService._internal();

  late Box<dynamic> _festivalBox;
  FestivalModeData? _currentData;
  String? _lastKnownFestivalId; // Track festival ID to detect config changes
  bool _isInitialized = false;

  Future<void> initialize() async {
    if (_isInitialized) return;
    _festivalBox = await Hive.openBox('festival_mode_cache');
    _isInitialized = true;
  }

  /// Fetch festival mode with smart caching and pre-image loading
  Future<FestivalModeData> fetchFestivalMode({
    required BuildContext context,
    bool forceRefresh = false,
  }) async {
    try {
      // Check if we can use cached data
      if (!forceRefresh &&
          _currentData != null &&
          !_currentData!.isCacheExpired()) {
        debugPrint('[FestivalMode] Using in-memory cache (not expired)');
        return _currentData!;
      }

      // Check if we have cached data in Hive (keyed by festivalId)
      if (!forceRefresh) {
        if (_lastKnownFestivalId != null) {
          final cacheKey = 'festival_${_lastKnownFestivalId}';
          final cachedJson = _festivalBox.get(cacheKey);
          if (cachedJson != null) {
            try {
              final cached = FestivalModeData.fromJson(
                  Map<String, dynamic>.from(cachedJson));
              if (!cached.isCacheExpired()) {
                debugPrint(
                    '[FestivalMode] Using Hive cache for $_lastKnownFestivalId (not expired)');
                _currentData = cached;
                // Background refresh if close to expiration
                _backgroundRefresh(context);
                return cached;
              }
            } catch (e) {
              debugPrint('[FestivalMode] Error parsing Hive cache: $e');
            }
          }
        }
      }

      // Fetch fresh data from server
      debugPrint('[FestivalMode] Fetching fresh data from server');
      final response = await Dio().get(
        '$baseUrl/festival-mode/status',
        options: Options(
          connectTimeout: Duration(seconds: 10),
          receiveTimeout: Duration(seconds: 10),
        ),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to fetch festival mode');
      }

      final newData =
          FestivalModeData.fromJson(Map<String, dynamic>.from(response.data));

      // Pre-cache images BEFORE updating state (flicker prevention)
      if (newData.isEnabled) {
        await _preCacheImages(newData, context);
      }

      // Save to Hive with festivalId-based key
      if (newData.festivalId != null) {
        final cacheKey = 'festival_${newData.festivalId}';
        await _festivalBox.put(cacheKey, newData.toJson());
        _lastKnownFestivalId = newData.festivalId;
        debugPrint('[FestivalMode] Caching to key: $cacheKey');
      }
      _currentData = newData;

      debugPrint('[FestivalMode] Successfully fetched and cached new data');
      return newData;
    } catch (e) {
      debugPrint('[FestivalMode] Error fetching from server: $e');

      // BULLETPROOF FALLBACK: Return cached data (even if expired)
      try {
        if (_lastKnownFestivalId != null) {
          final cacheKey = 'festival_${_lastKnownFestivalId}';
          final cachedJson = _festivalBox.get(cacheKey);
          if (cachedJson != null) {
            debugPrint('[FestivalMode] Using expired Hive cache as fallback');
            final cached = FestivalModeData.fromJson(
                Map<String, dynamic>.from(cachedJson));
            _currentData = cached;
            return cached;
          }
        }
      } catch (cacheErr) {
        debugPrint('[FestivalMode] Error reading Hive fallback: $cacheErr');
      }

      // Final fallback: return disabled festival mode
      debugPrint(
          '[FestivalMode] All fallbacks failed, returning disabled mode');
      return FestivalModeData.disabled();
    }
  }

  /// Pre-cache images before UI update (prevents flicker)
  Future<void> _preCacheImages(
      FestivalModeData data, BuildContext context) async {
    try {
      final urls = [
        if (data.imageWithAlerts != null) data.imageWithAlerts!,
        if (data.imageWithoutAlerts != null) data.imageWithoutAlerts!,
      ];

      for (final url in urls) {
        try {
          debugPrint('[FestivalMode] Pre-caching image: $url');
          final imageProvider = CachedNetworkImageProvider(url);
          await precacheImage(imageProvider, context);
          debugPrint('[FestivalMode] Pre-cache successful for: $url');
        } catch (e) {
          debugPrint('[FestivalMode] Pre-cache failed for $url: $e');
          // Don't fail the whole thing if one image fails
        }
      }
    } catch (e) {
      debugPrint('[FestivalMode] Error in pre-caching: $e');
    }
  }

  /// Background refresh when cache is close to expiration
  void _backgroundRefresh(BuildContext context) {
    if (_currentData == null) return;

    final timeUntilExpiry = _currentData!.cacheUntil.difference(DateTime.now());
    const refreshThreshold =
        Duration(minutes: 30); // Refresh 30 min before expiry

    if (timeUntilExpiry < refreshThreshold) {
      debugPrint(
          '[FestivalMode] Triggering background refresh (cache expiring soon)');
      fetchFestivalMode(context: context, forceRefresh: true).ignore();
    }
  }

  /// Get appropriate image based on alert status
  String? getAppropriateFestivalImage(FestivalModeData data, bool hasAlerts) {
    if (!data.isEnabled) return null;

    if (hasAlerts) {
      return data.imageWithAlerts;
    } else {
      return data.imageWithoutAlerts;
    }
  }

  /// Invalidate cache (call after admin updates)
  Future<void> invalidateCache() async {
    _currentData = null;
    if (_festivalBox.isOpen && _lastKnownFestivalId != null) {
      final cacheKey = 'festival_${_lastKnownFestivalId}';
      await _festivalBox.delete(cacheKey);
      debugPrint(
          '[FestivalMode] Cache invalidated for festival: $_lastKnownFestivalId');
    }
  }
}
