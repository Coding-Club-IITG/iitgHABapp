// ─────────────────────────────────────────────────────────────────────────────
// HMC Info screen
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:frontend2/apis/hostel/hmc.dart';
import 'package:frontend2/constants/themes.dart';
import 'package:frontend2/widgets/common/page_loading_shimmer.dart';
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
              fontSize: 20,
              fontWeight: FontWeight.w500,
              color: Colors.black),
        ),
        centerTitle: false,
      ),
      body: _loading
          ? buildHmcInfoLoadingShimmer()
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
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(member.email,
                              style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[800])),
                          Text(member.phone,
                              style: TextStyle(
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
