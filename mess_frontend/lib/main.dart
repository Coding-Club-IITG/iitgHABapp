import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'habit_hq_app.dart';
import 'navigation/app_router.dart';
import 'providers/auth_controller.dart';
import 'utilities/hq_version_checker.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await HqVersionChecker.init();
  final bool updateRequired = await HqVersionChecker.checkForUpdate();

  final auth = AuthController();
  await auth.hydrate();

  final router = createAppRouter(updateRequired: updateRequired, auth: auth);

  runApp(
    ChangeNotifierProvider<AuthController>.value(
      value: auth,
      child: HabitHqApp(router: router),
    ),
  );
}
