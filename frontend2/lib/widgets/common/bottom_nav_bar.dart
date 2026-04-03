import 'package:flutter/material.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;
  /// When false, only Home and Mess are shown; Gala Dinner tab is hidden.
  final bool showGalaTab;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.showGalaTab = true,
  });

  @override
  Widget build(BuildContext context) {
    // return BottomNavigationBar(
    //   currentIndex: currentIndex,
    //   onTap: onTap,
    //   items: const [
    //     BottomNavigationBarItem(
    //       icon: Icon(Icons.home_rounded),
    //       label: "Home",
    //     ),
    //     BottomNavigationBarItem(
    //       icon: Icon(Icons.restaurant_menu_rounded),
    //       label: "Mess",
    //     ),
    //     BottomNavigationBarItem(
    //       icon: Icon(Icons.report_gmailerrorred_rounded),
    //       label: "Complaints",
    //     ),
    //   ],
    // );
    return Container(
      color: Colors.white,
      child: SafeArea(
        top: false,
        child: Container(
          height: 64,
          decoration: const BoxDecoration(
              color: Colors.white,
              border:
                  Border(top: BorderSide(color: Color(0xFFE6E6E6), width: 1))),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Expanded(
                child: InkWell(
                  onTap: () {
                    onTap(0);
                  },
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.home_outlined,
                        size: 22,
                        color: currentIndex == 0
                            ? const Color(0xFF4C4EDB)
                            : const Color(0xFF676767),
                      ),
                      const SizedBox(height: 3),
                      Text("Home",
                          style: TextStyle(
                            fontSize: 12,
                            color: currentIndex == 0
                                ? const Color(0xFF4C4EDB)
                                : const Color(0xFF676767),
                          ))
                    ],
                  ),
                ),
              ),
              Expanded(
                child: InkWell(
                  onTap: () {
                    onTap(1);
                  },
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.restaurant_menu,
                        size: 22,
                        color: currentIndex == 1
                            ? const Color(0xFF4C4EDB)
                            : const Color(0xFF676767),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        "Mess",
                        style: TextStyle(
                            fontSize: 12,
                            color: currentIndex == 1
                                ? const Color(0xFF4C4EDB)
                                : const Color(0xFF676767)),
                      )
                    ],
                  ),
                ),
              ),
              if (showGalaTab)
                Expanded(
                  child: InkWell(
                    onTap: () {
                      onTap(2);
                    },
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.celebration,
                          size: 22,
                          color: currentIndex == 2
                              ? const Color(0xFF4C4EDB)
                              : const Color(0xFF676767),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          "Gala Dinner",
                          style: TextStyle(
                              fontSize: 12,
                              color: currentIndex == 2
                                  ? const Color(0xFF4C4EDB)
                                  : const Color(0xFF676767)),
                        )
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
