import 'package:flutter/material.dart';
import 'package:frontend2/constants/themes.dart';

/// Builds one animated gradient placeholder. All boxes share [ShimmerHost]'s ticker.
typedef ShimmerBoxBuilder = Widget Function({
  required double height,
  double? width,
  BorderRadius borderRadius,
});

/// Single [AnimationController] driving every shimmer bar under [child].
class ShimmerHost extends StatefulWidget {
  const ShimmerHost({super.key, required this.builder});

  final Widget Function(BuildContext context, ShimmerBoxBuilder box) builder;

  @override
  State<ShimmerHost> createState() => _ShimmerHostState();
}

class _ShimmerHostState extends State<ShimmerHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _animation = Tween<double>(begin: -1.5, end: 2.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _animatedBox({
    required double height,
    double? width,
    BorderRadius borderRadius = const BorderRadius.all(Radius.circular(8)),
  }) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: borderRadius,
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value + 1, 0),
              colors: const [
                Themes.shimmerBase,
                Themes.shimmerHighlight,
                Themes.shimmerBase,
              ],
              stops: const [0.1, 0.5, 0.9],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget buildBox({
      required double height,
      double? width,
      BorderRadius borderRadius = const BorderRadius.all(Radius.circular(8)),
    }) {
      return _animatedBox(
        height: height,
        width: width,
        borderRadius: borderRadius,
      );
    }

    return widget.builder(context, buildBox);
  }
}
