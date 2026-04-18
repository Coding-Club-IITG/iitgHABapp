import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart';

class PermissionHandler {
  Future<void> requestCameraPermission(Function onGranted) async {
    var status = await Permission.camera.status;
    if (!status.isGranted) {
      status = await Permission.camera.request();

      if (status.isGranted) {
        onGranted();
      } else if (status.isDenied) {
        if (kDebugMode) debugPrint("Camera permission denied");
      } else if (status.isPermanentlyDenied) {
        if (kDebugMode) debugPrint("Camera permission permanently denied");
        openAppSettings();
      }
    } else {
      onGranted();
    }
  }
}
