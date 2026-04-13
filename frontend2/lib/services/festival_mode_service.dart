import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:hive/hive.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:frontend2/constants/endpoint.dart';

/// Default palette (web admin quick-picks). Server may send any valid hex; we use it as-is.
class FestivalThemePalette {
  FestivalThemePalette._();

  static const List<String> hexStrings = [
    '#4C4EDB',
    '#7C3AED',
    '#DB2777',
    '#DC2626',
    '#EA580C',
    '#D97706',
    '#16A34A',
    '#0EA5E9',
    '#2563EB',
    '#111827',
  ];

  static Color _colorFromHex6(String hex6) {
    final v = int.parse(hex6, radix: 16);
    return Color(0xFF000000 | v);
  }

  static Color? _tryParseServerColor(String? raw) {
    if (raw == null) return null;
    final s = raw.trim();
    if (s.isEmpty) return null;
    final n = s.startsWith('#') ? s.substring(1) : s;
    if (n.length != 6 && n.length != 8) return null;
    final withAlpha = n.length == 6 ? 'FF$n' : n;
    final value = int.tryParse(withAlpha, radix: 16);
    if (value == null) return null;
    return Color(value);
  }

  /// Uses the exact hex from the server when valid; otherwise the default swatch.
  static Color resolveColor(String? serverHex) {
    final parsed = _tryParseServerColor(serverHex);
    if (parsed != null) return parsed;
    return _colorFromHex6(hexStrings.first.substring(1));
  }
}

class FestivalModeData {
  final String?
      festivalId; // MongoDB document ID for caching by festival instance
  final bool isEnabled;
  final String? imageWithAlerts;
  final String? imageWithoutAlerts;
  final String overlayTextWithAlerts;
  final String overlayTextWithoutAlerts;
  final List<String> imagesWithAlerts;
  final List<String> imagesWithoutAlerts;
  final List<String> textsWithAlerts;
  final List<String> textsWithoutAlerts;
  final String themeColor; // hex color like "#4C4EDB"
  /// Greeting prefix ("Good morning, ") — empty means use weather [_getTextColor].
  final String greetingTextColor;
  /// "N notifications today" — empty means use weather [_getTextColor].
  final String notificationSubtitleColor;
  final DateTime lastUpdatedAt;
  final DateTime cacheUntil;

  FestivalModeData({
    this.festivalId,
    required this.isEnabled,
    this.imageWithAlerts,
    this.imageWithoutAlerts,
    this.overlayTextWithAlerts = '',
    this.overlayTextWithoutAlerts = '',
    this.imagesWithAlerts = const [],
    this.imagesWithoutAlerts = const [],
    this.textsWithAlerts = const [],
    this.textsWithoutAlerts = const [],
    this.themeColor = '#4C4EDB',
    this.greetingTextColor = '',
    this.notificationSubtitleColor = '',
    required this.lastUpdatedAt,
    required this.cacheUntil,
  });

  static String _overlayFromJson(dynamic value) {
    if (value == null) return '';
    final s = value.toString().trim();
    return s;
  }

  static String? _getFullUrl(String? url) {
    if (url == null) return null;
    if (url.startsWith('http')) return url;
    final uri = Uri.parse(baseUrl);
    // Support standard frontend /api path by constructing the origin explicitly
    final portString = uri.hasPort ? ':${uri.port}' : '';
    return '${uri.scheme}://${uri.host}$portString$url';
  }

  factory FestivalModeData.fromJson(Map<String, dynamic> json) {
    final rawImagesWith = (json['imagesWithAlerts'] is List)
        ? List<dynamic>.from(json['imagesWithAlerts'])
        : const <dynamic>[];
    final rawImagesWithout = (json['imagesWithoutAlerts'] is List)
        ? List<dynamic>.from(json['imagesWithoutAlerts'])
        : const <dynamic>[];
    final rawTextsWith = (json['textsWithAlerts'] is List)
        ? List<dynamic>.from(json['textsWithAlerts'])
        : const <dynamic>[];
    final rawTextsWithout = (json['textsWithoutAlerts'] is List)
        ? List<dynamic>.from(json['textsWithoutAlerts'])
        : const <dynamic>[];

    final imagesWithAlerts = rawImagesWith
        .whereType<String>()
        .map((u) => _getFullUrl(u))
        .whereType<String>()
        .toList();
    final imagesWithoutAlerts = rawImagesWithout
        .whereType<String>()
        .map((u) => _getFullUrl(u))
        .whereType<String>()
        .toList();

    final textsWithAlerts =
        rawTextsWith.whereType<String>().map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
    final textsWithoutAlerts =
        rawTextsWithout.whereType<String>().map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

    final themeColor = (json['themeColor'] is String &&
            (json['themeColor'] as String).trim().isNotEmpty)
        ? (json['themeColor'] as String).trim()
        : FestivalThemePalette.hexStrings.first;

    final greetingTextColor = json['greetingTextColor'] is String
        ? (json['greetingTextColor'] as String).trim()
        : '';
    final notificationSubtitleColor =
        json['notificationSubtitleColor'] is String
            ? (json['notificationSubtitleColor'] as String).trim()
            : '';

    return FestivalModeData(
      festivalId: json['festivalId'],
      isEnabled: json['isEnabled'] ?? false,
      imageWithAlerts: _getFullUrl(json['imageWithAlerts']),
      imageWithoutAlerts: _getFullUrl(json['imageWithoutAlerts']),
      overlayTextWithAlerts: _overlayFromJson(json['overlayTextWithAlerts']),
      overlayTextWithoutAlerts:
          _overlayFromJson(json['overlayTextWithoutAlerts']),
      imagesWithAlerts: imagesWithAlerts,
      imagesWithoutAlerts: imagesWithoutAlerts,
      textsWithAlerts: textsWithAlerts,
      textsWithoutAlerts: textsWithoutAlerts,
      themeColor: themeColor,
      greetingTextColor: greetingTextColor,
      notificationSubtitleColor: notificationSubtitleColor,
      lastUpdatedAt: DateTime.parse(
          json['lastUpdatedAt'] ?? DateTime.now().toIso8601String()),
      cacheUntil: DateTime.parse(json['cacheUntil'] ??
          DateTime.now().add(const Duration(hours: 6)).toIso8601String()),
    );
  }

  factory FestivalModeData.disabled() {
    return FestivalModeData(
      festivalId: null,
      isEnabled: false,
      imageWithAlerts: null,
      imageWithoutAlerts: null,
      overlayTextWithAlerts: '',
      overlayTextWithoutAlerts: '',
      imagesWithAlerts: const [],
      imagesWithoutAlerts: const [],
      textsWithAlerts: const [],
      textsWithoutAlerts: const [],
      themeColor: FestivalThemePalette.hexStrings.first,
      greetingTextColor: '',
      notificationSubtitleColor: '',
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
      'imagesWithAlerts': imagesWithAlerts,
      'imagesWithoutAlerts': imagesWithoutAlerts,
      'textsWithAlerts': textsWithAlerts,
      'textsWithoutAlerts': textsWithoutAlerts,
      'themeColor': themeColor,
      'greetingTextColor': greetingTextColor,
      'notificationSubtitleColor': notificationSubtitleColor,
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
  FestivalModeData? get currentData => _currentData;

  /// Drives [FestivalBackgroundBuilder] without an initial network round-trip on Home.
  final ValueNotifier<FestivalModeData> festivalVisualNotifier =
      ValueNotifier<FestivalModeData>(FestivalModeData.disabled());

  /// After [bootstrapBeforeHome], full `/status` fetch is deferred until Home runs
  /// [_syncFestivalConfigFromServerIfPending] on the first frame (not after a long delay).
  bool _needsDeferredFullFestivalFetch = false;

  bool get needsDeferredFullFestivalFetch => _needsDeferredFullFestivalFetch;

  /// One-shot: returns whether Home should run [fetchFestivalMode]; clears the flag.
  bool tryConsumeDeferredFestivalFetch() {
    if (!_needsDeferredFullFestivalFetch) return false;
    _needsDeferredFullFestivalFetch = false;
    return true;
  }

  void _publishFestivalVisual() {
    festivalVisualNotifier.value = _currentData ?? FestivalModeData.disabled();
  }

  /// Synchronously retrieve cached config if available to prevent UI flicker
  FestivalModeData? getCachedDataSynchronously() {
    if (_currentData != null) return _currentData;
    if (_isInitialized) {
      try {
        final cachedJson = _festivalBox.get('current_festival_config');
        if (cachedJson != null) {
          final cached = FestivalModeData.fromJson(
              Map<String, dynamic>.from(cachedJson));
          // _currentData = cached; // Don't permanently override memory cache during a sync read
          return cached;
        }
      } catch (e) {
        debugPrint('[FestivalMode] Sync cache read failed: $e');
      }
    }
    return null;
  }

  String? _lastKnownFestivalId; // Track festival ID to detect config changes
  bool _isInitialized = false;

  static DateTime? _parseIso(dynamic v) {
    if (v == null) return null;
    try {
      return DateTime.parse(v.toString());
    } catch (_) {
      return null;
    }
  }

  Future<void> initialize() async {
    if (_isInitialized) return;
    _festivalBox = await Hive.openBox('festival_mode_cache');
    _isInitialized = true;
    try {
      final cachedJson = _festivalBox.get('current_festival_config');
      if (cachedJson != null) {
        final cached = FestivalModeData.fromJson(
            Map<String, dynamic>.from(cachedJson));
        _lastKnownFestivalId = cached.festivalId;
      }
    } catch (e) {
      debugPrint('[FestivalMode] init hive read failed: $e');
    }
  }

  /// Call once before [MainNavigationScreen] / Home: GET active-summary, hydrate from Hive on id match.
  Future<void> bootstrapBeforeHome() async {
    if (!_isInitialized) await initialize();

    FestivalModeData? hiveCurrent;
    try {
      final raw = _festivalBox.get('current_festival_config');
      if (raw != null) {
        hiveCurrent =
            FestivalModeData.fromJson(Map<String, dynamic>.from(raw));
      }
    } catch (e) {
      debugPrint('[FestivalMode] bootstrap hive read failed: $e');
    }

    try {
      final response = await Dio().get(
        '$baseUrl/festival-mode/active-summary',
        options: Options(
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );

      if (response.statusCode != 200) {
        throw Exception('active-summary status ${response.statusCode}');
      }

      final data = Map<String, dynamic>.from(response.data as Map);
      final remoteId = data['festivalId']?.toString();
      final remoteEnabled = data['isEnabled'] == true;
      final remoteLastUpdated = _parseIso(data['lastUpdatedAt']);

      if (!remoteEnabled) {
        _needsDeferredFullFestivalFetch = false;
        _currentData = FestivalModeData.disabled();
        if (remoteId != null) _lastKnownFestivalId = remoteId;
        _publishFestivalVisual();
        return;
      }

      // Same MongoDB doc id — admin can still change theme/text/images; use server lastUpdatedAt.
      // Require server time to be clearly after Hive (tolerance for clock skew), not "almost any" newer.
      final hiveLastUpdated = hiveCurrent?.lastUpdatedAt;
      final serverHasNewerConfig = remoteLastUpdated != null &&
          hiveLastUpdated != null &&
          remoteLastUpdated.isAfter(hiveLastUpdated.add(const Duration(seconds: 2)));

      final hasAnyImageCache = hiveCurrent != null &&
          (hiveCurrent.imageWithAlerts != null ||
              hiveCurrent.imageWithoutAlerts != null ||
              hiveCurrent.imagesWithAlerts.isNotEmpty ||
              hiveCurrent.imagesWithoutAlerts.isNotEmpty);

      final cacheHit = !serverHasNewerConfig &&
          hiveCurrent != null &&
          hiveCurrent.festivalId != null &&
          remoteId != null &&
          hiveCurrent.festivalId == remoteId &&
          !hiveCurrent.isCacheExpired() &&
          hasAnyImageCache;

      if (cacheHit) {
        _currentData = hiveCurrent;
        _lastKnownFestivalId = hiveCurrent.festivalId;
        _needsDeferredFullFestivalFetch = false;
        _publishFestivalVisual();
        debugPrint('[FestivalMode] bootstrap cache hit for $remoteId');
        return;
      }

      // Stale config or missing full /status payload: keep Hive visuals if any until fetch completes.
      if (hiveCurrent != null && hasAnyImageCache) {
        _currentData = hiveCurrent;
        _lastKnownFestivalId = hiveCurrent.festivalId;
      } else {
        _currentData = FestivalModeData.disabled();
      }
      _needsDeferredFullFestivalFetch = true;
      _publishFestivalVisual();
      debugPrint(
        '[FestivalMode] bootstrap: full /status sync needed (serverUpdated=$serverHasNewerConfig)');

    } catch (e) {
      debugPrint('[FestivalMode] bootstrap network error: $e');
      final hiveHasImages = hiveCurrent != null &&
          (hiveCurrent.imageWithAlerts != null ||
              hiveCurrent.imageWithoutAlerts != null ||
              hiveCurrent.imagesWithAlerts.isNotEmpty ||
              hiveCurrent.imagesWithoutAlerts.isNotEmpty);
      if (hiveCurrent != null &&
          hiveCurrent.isEnabled &&
          !hiveCurrent.isCacheExpired() &&
          hiveHasImages) {
        _currentData = hiveCurrent;
        _lastKnownFestivalId = hiveCurrent.festivalId;
        _needsDeferredFullFestivalFetch = true;
      } else {
        _currentData = FestivalModeData.disabled();
        _needsDeferredFullFestivalFetch = true;
      }
      _publishFestivalVisual();
    }
  }

  /// Fetch festival mode with smart caching and pre-image loading
  Future<FestivalModeData> fetchFestivalMode({
    required BuildContext context,
    bool forceRefresh = false,
  }) async {
    try {
      // Check if we can use cached data
      // Do not short-circuit on placeholder [disabled] from bootstrap cache-miss
      // (it is "not expired" but must not block [forceRefresh] / deferred full fetch).
      final mem = _currentData;
      if (!forceRefresh &&
          mem != null &&
          !mem.isCacheExpired() &&
          (mem.isEnabled || mem.festivalId != null)) {
        debugPrint('[FestivalMode] Using in-memory cache (not expired)');
        _publishFestivalVisual();
        return mem;
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
                _publishFestivalVisual();
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
        
        // Save as the absolute current config for bulletproof cold-start offline fallback
        await _festivalBox.put('current_festival_config', newData.toJson());
        
        _lastKnownFestivalId = newData.festivalId;
        debugPrint('[FestivalMode] Caching to key: $cacheKey');
      }
      _currentData = newData;
      _needsDeferredFullFestivalFetch = false;

      debugPrint('[FestivalMode] Successfully fetched and cached new data');
      _publishFestivalVisual();
      return newData;
    } catch (e) {
      debugPrint('[FestivalMode] Error fetching from server: $e');

      // BULLETPROOF FALLBACK: Return cached data (even if expired)
      try {
        final cachedJson = _festivalBox.get('current_festival_config');
        if (cachedJson != null) {
          debugPrint('[FestivalMode] Using expired Hive cache as fallback');
          final cached = FestivalModeData.fromJson(
              Map<String, dynamic>.from(cachedJson));
          _currentData = cached;
          _publishFestivalVisual();
          return cached;
        }
      } catch (cacheErr) {
        debugPrint('[FestivalMode] Error reading Hive fallback: $cacheErr');
      }

      // Final fallback: return disabled festival mode
      debugPrint(
          '[FestivalMode] All fallbacks failed, returning disabled mode');
      final disabled = FestivalModeData.disabled();
      _currentData = disabled;
      _publishFestivalVisual();
      return disabled;
    }
  }

  /// Pre-cache images before UI update (prevents flicker)
  Future<void> _preCacheImages(
      FestivalModeData data, BuildContext context) async {
    try {
      final urls = <String>[
        if (data.imageWithAlerts != null) data.imageWithAlerts!,
        if (data.imageWithoutAlerts != null) data.imageWithoutAlerts!,
        ...data.imagesWithAlerts,
        ...data.imagesWithoutAlerts,
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
      // Prefer multi-image list; fall back to legacy single field.
      if (data.imagesWithAlerts.isNotEmpty) return data.imagesWithAlerts.first;
      return data.imageWithAlerts;
    } else {
      if (data.imagesWithoutAlerts.isNotEmpty) return data.imagesWithoutAlerts.first;
      return data.imageWithoutAlerts;
    }
  }

  /// Invalidate cache (call after admin updates)
  Future<void> invalidateCache() async {
    _currentData = null;
    if (_festivalBox.isOpen) {
      try {
        await _festivalBox.delete('current_festival_config');
      } catch (_) {}
      if (_lastKnownFestivalId != null) {
        final cacheKey = 'festival_${_lastKnownFestivalId}';
        await _festivalBox.delete(cacheKey);
        debugPrint(
            '[FestivalMode] Cache invalidated for festival: $_lastKnownFestivalId');
      }
    }
    _publishFestivalVisual();
  }
}
