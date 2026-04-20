import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_controller.dart';
import '../screens/manager_home_screen.dart';
import '../screens/mess_manager_login_screen.dart';
import '../screens/update_required_screen.dart';

GoRouter createAppRouter({
  required bool updateRequired,
  required AuthController auth,
}) {
  return GoRouter(
    initialLocation: updateRequired
        ? '/update-required'
        : (auth.isAuthenticated ? '/home' : '/login'),
    refreshListenable: auth,
    redirect: (BuildContext context, GoRouterState state) {
      if (updateRequired) {
        if (state.matchedLocation != '/update-required') {
          return '/update-required';
        }
        return null;
      }
      final loggedIn = auth.isAuthenticated;
      final loc = state.matchedLocation;
      if (!loggedIn && loc == '/home') {
        return '/login';
      }
      if (loggedIn && loc == '/login') {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/update-required',
        builder: (context, state) => const UpdateRequiredScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const MessManagerLoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const ManagerHomeScreen(),
      ),
    ],
  );
}
