import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

const _kFallbackSvg = 'assets/icon/hostel.svg';
const _kLogoDir = 'assets/images/hostel_logos';

/// Optional overrides when API hostel_name does not match the PNG filename stem.
const Map<String, String> _kHostelLogoStemOverrides = {
  // e.g. 'kameng hostel': 'kameng',
};

/// Lowercase filename stem for [hostelName], e.g. `Barak` → `barak`.
String hostelLogoAssetStem(String? hostelName) {
  if (hostelName == null || hostelName.isEmpty) return '';
  final key = hostelName.trim().toLowerCase();
  if (_kHostelLogoStemOverrides.containsKey(key)) {
    return _kHostelLogoStemOverrides[key]!;
  }
  var s = hostelName.trim();
  if (s.toLowerCase().endsWith(' hostel')) {
    s = s.substring(0, s.length - 7).trim();
  }
  final buf = StringBuffer();
  for (final c in s.toLowerCase().split('')) {
    if (RegExp(r'[a-z0-9]').hasMatch(c)) {
      buf.write(c);
    } else if (c == ' ' || c == '-' || c == '/' || c == '.') {
      buf.write('_');
    }
  }
  return buf.toString().replaceAll(RegExp(r'_+'), '_');
}

/// Asset path for `assets/images/hostel_logos/<stem>.png`, or null if no stem.
String? hostelLogoPngPath(String? hostelName) {
  final stem = hostelLogoAssetStem(hostelName);
  if (stem.isEmpty) return null;
  return '$_kLogoDir/$stem.png';
}

/// Hostel crest/logo for the selected hostel: PNG in [hostelLogoPngPath], else [hostel.svg].
/// [height] is fixed; width follows each asset’s aspect ratio.
class HostelLogo extends StatelessWidget {
  final String? hostelName;
  final double height;
  final Color backgroundColor;

  const HostelLogo({
    super.key,
    required this.hostelName,
    this.height = 56,
    this.backgroundColor = const Color(0xFFEDEDFB),
  });

  @override
  Widget build(BuildContext context) {
    final path = hostelLogoPngPath(hostelName);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: path == null
          ? _fallbackSquare()
          : Image.asset(
              path,
              height: height,
              fit: BoxFit.fitHeight,
              errorBuilder: (_, __, ___) => _fallbackSquare(),
            ),
    );
  }

  /// Square fallback so the generic icon stays aligned when PNG is missing.
  Widget _fallbackSquare() {
    return SizedBox(
      height: height,
      width: height,
      child: ColoredBox(
        color: backgroundColor,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: SvgPicture.asset(
            _kFallbackSvg,
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
