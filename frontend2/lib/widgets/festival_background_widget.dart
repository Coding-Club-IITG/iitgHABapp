import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:frontend2/services/festival_mode_service.dart';

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
        return _buildFestivalBackground(context, festivalImageUrl);
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
  Widget _buildFestivalBackground(BuildContext context, String imageUrl) {
    // This grabs your app's default background color (likely white or off-white)
    final bgColor = Theme.of(context).scaffoldBackgroundColor;

    return Container(
      color: bgColor, // Solid color for the bottom part of the app
      child: Stack(
        children: [
          // 1. The Hero Image pinned to the top
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 380, // Adjust this to match your sunset image height
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

          // 2. The Fade Gradient (Mimics the sunset blend)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 385, // Slightly taller than the image to prevent hard edges
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(
                        0.4), // Dark top so top-bar text is readable
                    Colors.transparent,
                    bgColor, // Fades completely into the app's background color
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),

          // 3. Your main app content sits on top
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
class FestivalBackgroundBuilder extends StatefulWidget {
  final bool hasAlerts;
  final WidgetBuilder builder;

  const FestivalBackgroundBuilder({
    Key? key,
    required this.hasAlerts,
    required this.builder,
  }) : super(key: key);

  @override
  State<FestivalBackgroundBuilder> createState() =>
      _FestivalBackgroundBuilderState();
}

class _FestivalBackgroundBuilderState extends State<FestivalBackgroundBuilder> {
  late Future<FestivalModeData> _festivalFuture;

  @override
  void initState() {
    super.initState();
    _loadFestivalMode();
  }

  void _loadFestivalMode() {
    _festivalFuture = FestivalModeService().fetchFestivalMode(context: context);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<FestivalModeData>(
      initialData: FestivalModeService().getCachedDataSynchronously(),
      future: _festivalFuture,
      builder: (context, snapshot) {
        String? backgroundImage;

        if (snapshot.hasData) {
          final data = snapshot.data!;
          backgroundImage = FestivalModeService().getAppropriateFestivalImage(
            data,
            widget.hasAlerts,
          );
          backgroundImage =
              backgroundImage?.replaceAll('localhost', '10.0.2.2');
        }

        return _BackgroundContainer(
          backgroundImage: backgroundImage,
          child: widget.builder(context),
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

    return Container(
      color: bgColor,
      child: Stack(
        children: [
          // 1. Hero Image
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 380, // Height of the header
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

          // 2. Fade Gradient
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 385,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.4),
                    Colors.transparent,
                    bgColor,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),

          // 3. Content
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
