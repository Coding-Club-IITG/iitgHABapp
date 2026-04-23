import java.util.Properties
import java.io.FileInputStream
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.isRegularFile
import kotlin.io.path.name

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
} else {
    println("⚠️ Warning: key.properties not found — release signing will fail.")
}

android {
    namespace = "com.codingclub.hqbithq"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.codingclub.hqbithq"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

/**
 * Some transitive Flutter plugins (e.g. open_filex) declare photo/video/storage permissions
 * in their own AndroidManifest.xml. Even if we never request them at runtime, Play Console
 * flags the app based on the merged manifest.
 *
 * This task strips those permissions from the merged *release* manifests after merging.
 */
val stripReleaseMediaPermissions = tasks.register("stripReleaseMediaPermissions") {
    doLast {
        val appRoot = rootProject.projectDir.parentFile // .../mess_frontend
        val intermediates = Path.of(appRoot.absolutePath, "build", "app", "intermediates")

        val candidateManifests = listOf(
            intermediates.resolve("merged_manifests/release/processReleaseManifest/AndroidManifest.xml"),
            intermediates.resolve("packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml"),
            intermediates.resolve("merged_manifest/release/outputReleaseAppLinkSettings/AndroidManifest.xml"),
        ).filter { it.exists() && it.isRegularFile() }

        if (candidateManifests.isEmpty()) {
            logger.lifecycle("[stripReleaseMediaPermissions] No candidate manifests found under $intermediates")
            return@doLast
        }

        val permissionNames = listOf(
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO",
            "android.permission.READ_MEDIA_AUDIO",
            "android.permission.READ_EXTERNAL_STORAGE",
            "android.permission.WRITE_EXTERNAL_STORAGE",
            "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        )

        candidateManifests.forEach { manifestPath ->
            val original = Files.readString(manifestPath)
            var updated = original

            // Remove both single-line and multi-line <uses-permission ...> nodes containing these names.
            permissionNames.forEach { perm ->
                updated = updated.replace(
                    Regex("""\s*<uses-permission\b[^>]*android:name\s*=\s*"$perm"[^>]*/>\s*"""),
                    "\n",
                )
                updated = updated.replace(
                    Regex("""\s*<uses-permission\b[^>]*android:name\s*=\s*"$perm"[^>]*>\s*</uses-permission>\s*"""),
                    "\n",
                )
            }

            if (updated != original) {
                Files.writeString(manifestPath, updated)
                logger.lifecycle("[stripReleaseMediaPermissions] Updated ${manifestPath.name}")
            } else {
                logger.lifecycle("[stripReleaseMediaPermissions] No changes needed for ${manifestPath.name}")
            }
        }
    }
}

// Ensure the stripping runs after manifest merge tasks for release.
tasks.matching { it.name in setOf("processReleaseMainManifest", "processReleaseManifest", "processReleaseManifestForPackage") }
    .configureEach { finalizedBy(stripReleaseMediaPermissions) }
