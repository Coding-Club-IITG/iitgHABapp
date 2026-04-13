import 'package:flutter/material.dart';
import 'package:frontend2/services/festival_mode_service.dart';

/// Design canvas width 390; heights match admin exports.
/// Used by [FestivalBackgroundBuilder] (layout) and Home scroll-embedded banner.
double festivalBannerHeight(bool hasAlerts) => hasAlerts ? 385.0 : 305.0;

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
        }

        // If festival mode is off or no image, render default
        if (festivalImageUrl == null) {
          return _buildDefaultBackground(context);
        }

        return _buildFestivalBackground(context);
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

  /// Banner image is painted in Home's scroll view, not here.
  Widget _buildFestivalBackground(BuildContext context) {
    final bgColor = Theme.of(context).scaffoldBackgroundColor;
    return Container(
      color: bgColor,
      child: widget.child,
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
        final backgroundImage = FestivalModeService().getAppropriateFestivalImage(
          data,
          hasAlerts,
        );

        return _BackgroundContainer(
          backgroundImage: backgroundImage,
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
  final Widget child;

  const _BackgroundContainer({
    this.backgroundImage,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (backgroundImage == null) {
      return _buildDefault(context);
    }

    final bgColor = Theme.of(context).scaffoldBackgroundColor;
    // Banner image is drawn inside Home's scroll view so it scrolls with content.
    return Container(
      color: bgColor,
      child: child,
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
