// ─────────────────────────────────────────────────────────────────────────────
// HMC Info screen
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:frontend2/apis/hostel/hmc.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:url_launcher/url_launcher.dart';

class HmcInfoScreen extends StatefulWidget {
  const HmcInfoScreen({super.key});

  @override
  State<HmcInfoScreen> createState() => _HmcInfoScreenState();
}

class _HmcInfoScreenState extends State<HmcInfoScreen> {
  // Track which member cards are expanded: key = "roleIndex-memberIndex"
  final Set<String> _expanded = {};
  List<HmcRole> _hmcRoles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHmcData();
  }

  Future<void> _fetchHmcData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final roles = await fetchHmcMembers();
      if (mounted) {
        setState(() {
          _hmcRoles = roles;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load HMC data';
          _loading = false;
        });
      }
    }
  }

  void _toggle(String key) {
    setState(() {
      if (_expanded.contains(key)) {
        _expanded.remove(key);
      } else {
        _expanded.add(key);
      }
    });
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _mail(String email) async {
    debugPrint("Attempting to mail $email");
    final uri = Uri(scheme: 'mailto', path: email);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.grey[50],
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'HMC Info',
          style: TextStyle(
              fontFamily: Themes.kFont,
              fontSize: 20,
              fontWeight: FontWeight.w500,
              color: Colors.black),
        ),
        centerTitle: false,
      ),
      body: _loading
          ? const _HmcLoadingSkeleton()
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchHmcData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _hmcRoles.isEmpty
                  ? const Center(child: Text('No HMC members found'))
                  : ListView(
                      padding: const EdgeInsets.symmetric(
                          vertical: 8, horizontal: 8),
                      children: [
                        for (int ri = 0; ri < _hmcRoles.length; ri++) ...[
                          // Role heading
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
                            child: Text(
                              _hmcRoles[ri].title,
                              style: const TextStyle(
                                fontFamily: Themes.kFont,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: Colors.black87,
                              ),
                            ),
                          ),
                          // Member cards
                          for (int mi = 0;
                              mi < _hmcRoles[ri].members.length;
                              mi++)
                            _HmcMemberCard(
                              member: _hmcRoles[ri].members[mi],
                              isExpanded: _expanded.contains('$ri-$mi'),
                              onToggle: () => _toggle('$ri-$mi'),
                              onCall: () =>
                                  _call(_hmcRoles[ri].members[mi].phone),
                              onMail: () =>
                                  _mail(_hmcRoles[ri].members[mi].email),
                            ),
                        ],
                        const SizedBox(height: 32),
                      ],
                    ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HMC member card
// ─────────────────────────────────────────────────────────────────────────────
class _HmcMemberCard extends StatelessWidget {
  final HmcMember member;
  final bool isExpanded;
  final VoidCallback onToggle;
  final VoidCallback onCall;
  final VoidCallback onMail;

  const _HmcMemberCard({
    required this.member,
    required this.isExpanded,
    required this.onToggle,
    required this.onCall,
    required this.onMail,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: isExpanded
              ? Border.all(color: const Color(0xFFDDDDDD), width: 1)
              : null,
        ),
        child: Column(
          children: [
            // ── Collapsed row ─────────────────────────────────────────
            InkWell(
              onTap: onToggle,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: Colors.grey[200],
                      backgroundImage: member.photoAsset != null
                          ? AssetImage(member.photoAsset!)
                          : null,
                      child: member.photoAsset == null
                          ? Text(
                              member.name.isNotEmpty
                                  ? member.name[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                  fontFamily: Themes.kFont,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black54),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(member.name,
                              style: const TextStyle(
                                  fontFamily: Themes.kFont,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(member.email,
                              style: TextStyle(
                                  fontFamily: Themes.kFont,
                                  fontSize: 14,
                                  color: Colors.grey[800])),
                          Text(member.phone,
                              style: TextStyle(
                                  fontFamily: Themes.kFont,
                                  fontSize: 14,
                                  color: Colors.grey[800])),
                        ],
                      ),
                    ),
                    Icon(
                      isExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: Themes.kAccent,
                    ),
                  ],
                ),
              ),
            ),

            // ── Expanded action row ───────────────────────────────────
            if (isExpanded) ...[
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        onPressed: onCall,
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFF2F2F2),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadiusGeometry.horizontal(
                                  left: const Radius.circular(8))),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        icon: SvgPicture.asset('assets/icon/call.svg',
                            width: 24, height: 24),
                        label: const Text('Call',
                            style: TextStyle(
                                fontFamily: Themes.kFont,
                                color: Themes.kAccent,
                                fontWeight: FontWeight.w500,
                                fontSize: 16)),
                      ),
                    ),
                    SizedBox(
                        width: 1,
                        height: 36,
                        child: Container(color: const Color(0xFFE2E2E2))),
                    Expanded(
                      child: TextButton.icon(
                        onPressed: onMail,
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFF2F2F2),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadiusGeometry.horizontal(
                                  right: const Radius.circular(8))),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        icon: SvgPicture.asset('assets/icon/mail.svg',
                            width: 24, height: 24),
                        label: const Text('Mail',
                            style: TextStyle(
                                fontFamily: Themes.kFont,
                                color: Themes.kAccent)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HmcLoadingSkeleton extends StatelessWidget {
  const _HmcLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      children: const [
        SizedBox(height: 16),
        _HmcShimmerBlock(height: 24, width: 120),
        SizedBox(height: 8),
        _HmcMemberSkeletonCard(),
        SizedBox(height: 8),
        _HmcMemberSkeletonCard(),
        SizedBox(height: 24),
        _HmcShimmerBlock(height: 24, width: 140),
        SizedBox(height: 8),
        _HmcMemberSkeletonCard(),
        SizedBox(height: 24),
        _HmcShimmerBlock(height: 24, width: 100),
        SizedBox(height: 8),
        _HmcMemberSkeletonCard(),
        SizedBox(height: 32),
      ],
    );
  }
}

class _HmcMemberSkeletonCard extends StatelessWidget {
  const _HmcMemberSkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: const Row(
          children: [
            _HmcShimmerBlock(
              height: 72,
              width: 72,
              radius: BorderRadius.all(Radius.circular(36)),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _HmcShimmerBlock(height: 20, width: 140),
                  SizedBox(height: 6),
                  _HmcShimmerBlock(height: 16, width: 180),
                  SizedBox(height: 4),
                  _HmcShimmerBlock(height: 16, width: 120),
                ],
              ),
            ),
            _HmcShimmerBlock(height: 24, width: 24),
          ],
        ),
      ),
    );
  }
}

class _HmcShimmerBlock extends StatefulWidget {
  final double height;
  final double? width;
  final BorderRadius radius;

  const _HmcShimmerBlock({
    required this.height,
    this.width,
    this.radius = const BorderRadius.all(Radius.circular(8)),
  });

  @override
  State<_HmcShimmerBlock> createState() => _HmcShimmerBlockState();
}

class _HmcShimmerBlockState extends State<_HmcShimmerBlock>
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

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.radius,
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
}
