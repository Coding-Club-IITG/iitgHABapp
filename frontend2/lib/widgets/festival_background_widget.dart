import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:frontend2/services/festival_mode_service.dart';

/// Design canvas width 390; heights match admin exports.
double _festivalBannerHeight(bool hasAlerts) => hasAlerts ? 385.0 : 305.0;

/// Bulletproof Festival Background Widget
/// Handles: flicker prevention, fallbacks, error states, offline mode
class FestivalBackgroundWidget extends StatefulWidget {
  final bool hasAlerts;
  final Widget child;
  final bool forceRefresh;

  const FestivalBackgroundWidget({
    Key? key,
    required this.hasAlerts,
    required this.child,
    this.forceRefresh = false,
  }) : super(key: key);

  @override
  State<FestivalBackgroundWidget> createState() =>
      _FestivalBackgroundWidgetState();
}

class _FestivalBackgroundWidgetState extends State<FestivalBackgroundWidget> {
  late Future<FestivalModeData> _festivalFuture;

  @override
  void initState() {
    super.initState();
    _loadFestivalMode();
  }

  @override
  void didUpdateWidget(FestivalBackgroundWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.forceRefresh != oldWidget.forceRefresh && widget.forceRefresh) {
      _loadFestivalMode();
    }
  }

  void _loadFestivalMode() {
    _festivalFuture = FestivalModeService().fetchFestivalMode(
      context: context,
      forceRefresh: widget.forceRefresh,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<FestivalModeData>(
      initialData: FestivalModeService().getCachedDataSynchronously(),
      future: _festivalFuture,
      builder: (context, snapshot) {
        // Determine which image to use
        String? festivalImageUrl;

        if (snapshot.hasData) {
          final data = snapshot.data!;
          festivalImageUrl = FestivalModeService().getAppropriateFestivalImage(
            data,
            widget.hasAlerts,
          );
          festivalImageUrl =
              festivalImageUrl?.replaceAll('localhost', '10.0.2.2');
        }

        // If festival mode is off or no image, render default
        if (festivalImageUrl == null) {
          return _buildDefaultBackground(context);
        }

        // Render with festival image and bulletproof error handling
        return _buildFestivalBackground(
          context,
          festivalImageUrl,
          hasAlerts: widget.hasAlerts,
        );
      },
    );
  }

  /// Build default background (fallback when festival disabled or error)
  Widget _buildDefaultBackground(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1a1a2e),
            const Color(0xFF16213e),
          ],
        ),
      ),
      child: widget.child,
    );
  }

  /// Build with festival image with bulletproof error handling
  /// Build with festival image as a Hero Banner with a smooth fade
  Widget _buildFestivalBackground(
    BuildContext context,
    String imageUrl, {
    required bool hasAlerts,
  }) {
    final bgColor = Theme.of(context).scaffoldBackgroundColor;
    final bannerH = _festivalBannerHeight(hasAlerts);

    return Container(
      color: bgColor,
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: bannerH,
            child: CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              placeholder: (context, url) =>
                  Container(color: const Color(0xFF1a1a2e)),
              errorWidget: (context, url, error) {
                debugPrint('[FestivalBG] CachedNetworkImage error: $error');
                return _buildDefaultBackground(context);
              },
            ),
          ),

          Positioned.fill(
            child: widget.child,
          ),
        ],
      ),
    );
  }

  /// Show placeholder while image loads (prevents blank space)
  Widget _buildLoadingPlaceholder() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1a1a2e).withOpacity(0.8),
            const Color(0xFF16213e).withOpacity(0.8),
          ],
        ),
      ),
    );
  }

  /// Optional: Add semi-transparent overlay to ensure readability
  BoxDecoration _buildOverlayIfNeeded() {
    return BoxDecoration(
      color: Colors.black.withOpacity(0.1),
    );
  }
}

/// Festival Background Builder - simpler API for common use case
class FestivalBackgroundBuilder extends StatelessWidget {
  final bool hasAlerts;
  /// When true, skips festival imagery so callers can show weather (e.g. rain) instead.
  final bool suppressFestivalBackdrop;
  final WidgetBuilder builder;

  const FestivalBackgroundBuilder({
    Key? key,
    required this.hasAlerts,
    this.suppressFestivalBackdrop = false,
    required this.builder,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (suppressFestivalBackdrop) {
      return Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: builder(context),
      );
    }

    return ValueListenableBuilder<FestivalModeData>(
      valueListenable: FestivalModeService().festivalVisualNotifier,
      builder: (context, data, _) {
        var backgroundImage = FestivalModeService().getAppropriateFestivalImage(
          data,
          hasAlerts,
        );
        backgroundImage =
            backgroundImage?.replaceAll('localhost', '10.0.2.2');

        return _BackgroundContainer(
          backgroundImage: backgroundImage,
          hasAlerts: hasAlerts,
          child: builder(context),
        );
      },
    );
  }
}

/// Reusable background container with all error handling
/// Reusable background container with all error handling
class _BackgroundContainer extends StatelessWidget {
  final String? backgroundImage;
  final bool hasAlerts;
  final Widget child;

  const _BackgroundContainer({
    this.backgroundImage,
    this.hasAlerts = true,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (backgroundImage == null) {
      return _buildDefault(context);
    }

    final bgColor = Theme.of(context).scaffoldBackgroundColor;
    final bannerH = _festivalBannerHeight(hasAlerts);

    return Container(
      color: bgColor,
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: bannerH,
            child: CachedNetworkImage(
              imageUrl: backgroundImage!,
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              placeholder: (context, url) =>
                  Container(color: const Color(0xFF1a1a2e)),
              errorWidget: (context, url, error) {
                debugPrint('[BG] Image failed to load: $url');
                return _buildDefault(context);
              },
            ),
          ),

          Positioned.fill(
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildDefault(BuildContext context) {
    final bgColor = Theme.of(context).scaffoldBackgroundColor;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1a1a2e),
            bgColor, // Fade out the default gradient too!
          ],
          stops: const [0.0, 0.4],
        ),
      ),
      child: child,
    );
  }
}
