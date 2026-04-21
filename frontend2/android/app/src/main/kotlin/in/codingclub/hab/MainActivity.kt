package `in`.codingclub.hab

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
	override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
		super.configureFlutterEngine(flutterEngine)

		MethodChannel(
			flutterEngine.dartExecutor.binaryMessenger,
			"in.codingclub.hab/config",
		).setMethodCallHandler { call, result ->
			when (call.method) {
				"getOpenWeatherApiKey" -> result.success(BuildConfig.OPENWEATHER_API_KEY)
				else -> result.notImplemented()
			}
		}
	}
}