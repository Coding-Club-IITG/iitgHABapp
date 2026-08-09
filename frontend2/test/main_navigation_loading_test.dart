import 'package:flutter_test/flutter_test.dart';
import 'package:frontend2/screens/main_navigation_screen.dart';

void main() {
  group('main navigation loading overlay', () {
    test('stays visible until navigation bootstrap is ready', () {
      expect(
        shouldShowMainLoadingOverlay(
          navigationReady: false,
          setupDone: false,
          homeInitialDataReady: false,
        ),
        isTrue,
      );
    });

    test('does not cover initial setup after navigation is ready', () {
      expect(
        shouldShowMainLoadingOverlay(
          navigationReady: true,
          setupDone: false,
          homeInitialDataReady: false,
        ),
        isFalse,
      );
    });

    test('waits for home data only when setup is complete', () {
      expect(
        shouldShowMainLoadingOverlay(
          navigationReady: true,
          setupDone: true,
          homeInitialDataReady: false,
        ),
        isTrue,
      );
      expect(
        shouldShowMainLoadingOverlay(
          navigationReady: true,
          setupDone: true,
          homeInitialDataReady: true,
        ),
        isFalse,
      );
    });
  });
}
