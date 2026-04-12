import 'package:flutter/material.dart';

import 'shimmer_host.dart';

/// Shared loading skeletons using [ShimmerHost] — same gradient/timing as
/// [MessPreferenceScreen], [LeaveApplicationListScreen], etc. (home rhythm).

Widget buildLaundryServiceLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFC5C5D1)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      box(
                        height: 26,
                        width: 96,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      const SizedBox(height: 12),
                      box(height: 14, width: double.infinity),
                      const SizedBox(height: 8),
                      box(height: 12, width: 200),
                      const SizedBox(height: 12),
                      box(height: 10, width: 160),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                box(
                  height: 72,
                  width: 72,
                  borderRadius: BorderRadius.circular(16),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          box(height: 18, width: 140),
          const SizedBox(height: 12),
          for (int i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            box(
              height: 64,
              width: double.infinity,
              borderRadius: BorderRadius.circular(12),
            ),
          ],
        ],
      ),
    ),
  );
}

Widget buildRoomCleaningLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          box(height: 20, width: 180),
          const SizedBox(height: 20),
          for (int i = 0; i < 5; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            box(
              height: 52,
              width: double.infinity,
              borderRadius: BorderRadius.circular(16),
            ),
          ],
        ],
      ),
    ),
  );
}

Widget buildRebateApplicationStatusLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          box(height: 18, width: double.infinity),
          const SizedBox(height: 8),
          box(height: 14, width: 240),
          const SizedBox(height: 24),
          Row(
            children: [
              for (int i = 0; i < 5; i++) ...[
                Expanded(
                  child: box(
                    height: 6,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                if (i < 4) const SizedBox(width: 8),
              ],
            ],
          ),
          const SizedBox(height: 28),
          box(height: 14, width: 120),
          const SizedBox(height: 10),
          box(height: 40, width: double.infinity),
          const SizedBox(height: 12),
          box(
              height: 48,
              width: double.infinity,
              borderRadius: BorderRadius.circular(12)),
          const SizedBox(height: 12),
          box(
              height: 48,
              width: double.infinity,
              borderRadius: BorderRadius.circular(12)),
        ],
      ),
    ),
  );
}

Widget buildProfileLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          box(
            height: 136,
            width: 136,
            borderRadius: const BorderRadius.all(Radius.circular(68)),
          ),
          const SizedBox(height: 32),
          box(height: 20, width: 80),
          const SizedBox(height: 16),
          box(height: 56, width: double.infinity),
          const Divider(height: 24),
          box(height: 56, width: double.infinity),
          const Divider(height: 24),
          Row(
            children: [
              Expanded(child: box(height: 56)),
              const SizedBox(width: 16),
              Expanded(child: box(height: 56)),
            ],
          ),
          const Divider(height: 24),
          box(height: 56, width: double.infinity),
          const Divider(height: 24),
          box(height: 56, width: double.infinity),
        ],
      ),
    ),
  );
}

Widget buildHmcInfoLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => ListView(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      children: [
        const SizedBox(height: 16),
        box(height: 24, width: 120),
        const SizedBox(height: 8),
        _hmcMemberSkeletonCard(box),
        const SizedBox(height: 8),
        _hmcMemberSkeletonCard(box),
        const SizedBox(height: 24),
        box(height: 24, width: 140),
        const SizedBox(height: 8),
        _hmcMemberSkeletonCard(box),
        const SizedBox(height: 24),
        box(height: 24, width: 100),
        const SizedBox(height: 8),
        _hmcMemberSkeletonCard(box),
        const SizedBox(height: 32),
      ],
    ),
  );
}

Widget _hmcMemberSkeletonCard(ShimmerBoxBuilder box) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          box(
            height: 72,
            width: 72,
            borderRadius: const BorderRadius.all(Radius.circular(36)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                box(height: 20, width: 140),
                const SizedBox(height: 6),
                box(height: 16, width: 180),
                const SizedBox(height: 4),
                box(height: 16, width: 120),
              ],
            ),
          ),
          box(height: 24, width: 24),
        ],
      ),
    ),
  );
}

Widget buildMessChangeScreenLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          box(height: 16, width: 120),
          const SizedBox(height: 8),
          box(height: 28, width: 200),
          const SizedBox(height: 24),
          box(height: 16, width: 80),
          const SizedBox(height: 8),
          box(height: 22, width: 220),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              box(height: 16, width: 100),
              box(height: 16, width: 80),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              box(height: 22, width: 120),
              box(height: 22, width: 100),
            ],
          ),
          const SizedBox(height: 24),
          box(height: 16, width: 140),
          const SizedBox(height: 8),
          box(
            height: 48,
            width: double.infinity,
            borderRadius: BorderRadius.circular(12),
          ),
          const SizedBox(height: 16),
          box(height: 16, width: 180),
          const SizedBox(height: 8),
          box(
            height: 120,
            width: double.infinity,
            borderRadius: BorderRadius.circular(16),
          ),
        ],
      ),
    ),
  );
}

/// Full home scroll skeleton when the subscribed mess menu (or mess metadata) is loading.
Widget buildHomeScreenLoadingShimmer() {
  const surface = Color(0xFFFFFFFF);
  const border = Color(0xFFE6E6E6);
  const shadow = Color(0x14000000);
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      child: Column(
        children: [
          box(height: 220, width: double.infinity),
          const SizedBox(
            width: double.infinity,
            height: 8,
            child: ColoredBox(color: Color(0xFFF0F0F0)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                box(height: 24, width: 140),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: box(
                        height: 148,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: box(
                        height: 148,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: box(
                        height: 52,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: box(
                        height: 52,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(
            width: double.infinity,
            height: 8,
            child: ColoredBox(color: Color(0xFFF0F0F0)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    box(height: 28, width: 110),
                    const SizedBox(width: 8),
                    box(height: 24, width: 84),
                    const Spacer(),
                    box(height: 20, width: 110),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: border),
                    boxShadow: const [
                      BoxShadow(
                        color: shadow,
                        blurRadius: 16,
                        offset: Offset.zero,
                      ),
                    ],
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [surface, Color(0xFFFFFEF8)],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      box(
                        height: 16,
                        width: 48,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      const SizedBox(height: 12),
                      box(height: 18),
                      const SizedBox(height: 8),
                      box(height: 18, width: 180),
                      const SizedBox(height: 12),
                      const Divider(
                          height: 1, thickness: 1, color: Color(0xFFE6E6E6)),
                      const SizedBox(height: 20),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  box(
                                    height: 16,
                                    width: 96,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  const SizedBox(height: 12),
                                  box(height: 18),
                                  const SizedBox(height: 8),
                                  box(height: 18, width: 120),
                                ],
                              ),
                            ),
                            Container(
                              width: 1,
                              margin: const EdgeInsets.symmetric(horizontal: 24),
                              color: const Color(0xFFE6E6E6),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  box(
                                    height: 16,
                                    width: 60,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  const SizedBox(height: 12),
                                  box(height: 18),
                                  const SizedBox(height: 8),
                                  box(height: 18, width: 90),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget buildMessFeedbackLoadingShimmer() {
  return ShimmerHost(
    builder: (context, box) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          box(height: 36, width: 220),
          const SizedBox(height: 24),
          box(height: 16, width: 88),
          const SizedBox(height: 10),
          box(height: 4, width: double.infinity),
          const SizedBox(height: 20),
          box(height: 22, width: 280),
          const SizedBox(height: 20),
          for (int i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(height: 20),
            box(height: 20, width: 120),
            const SizedBox(height: 10),
            for (int j = 0; j < 5; j++) ...[
              if (j > 0) const SizedBox(height: 8),
              box(
                  height: 44,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(12)),
            ],
          ],
        ],
      ),
    ),
  );
}
