{
  description = "iitgHABapp Development";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {nixpkgs, ...}: let
    supportedSystems = ["x86_64-linux" "aarch64-linux"];
    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    pkgsFor = system:
      import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          android_sdk.accept_license = true;
        };
      };
  in {
    devShells = forAllSystems (
      system: let
        pkgs = pkgsFor system;

        # Android SDK
        androidEnv = pkgs.androidenv.composeAndroidPackages {
          cmdLineToolsVersion = "8.0";
          toolsVersion = "26.1.1";
          platformToolsVersion = "35.0.2";
          buildToolsVersions = ["34.0.0" "35.0.0"];
          includeEmulator = true;
          platformVersions = ["34" "35" "36"];
          includeSystemImages = true;
          systemImageTypes = ["google_apis" "google_apis_playstore"];
          abiVersions = ["x86_64"];
          includeSources = false;
          cmakeVersions = ["3.22.1"];
          includeNDK = true;
          ndkVersions = ["27.0.12077973"];
          extraLicenses = [
            "android-sdk-license"
            "android-sdk-preview-license"
          ];
        };

        androidsdk = androidEnv.androidsdk;

        # Flutter libraries
        linuxBuildInputs = with pkgs; [
          at-spi2-atk
          atkmm
          cairo
          dbus
          gdk-pixbuf
          glib
          glib-networking
          gtk3
          harfbuzz
          jsoncpp
          libepoxy
          pango
          libsecret
          libunwind
          gst_all_1.gstreamer
          gst_all_1.gst-plugins-base
          gst_all_1.gst-plugins-good
        ];
      in {
        default = pkgs.mkShell {
          name = "iitgHABapp-devshell";

          nativeBuildInputs = with pkgs; [
            # Flutter & Dart
            flutter
            dart

            # Android & Java
            jdk17
            gradle
            androidsdk

            # JS / Node Stack
            nodejs
            typescript
            eslint
            pm2

            # Build Tools
            pkg-config
            cmake
            ninja
            clang
          ];

          buildInputs = linuxBuildInputs;

          JAVA_HOME = pkgs.jdk17;
          ANDROID_HOME = "${androidsdk}/libexec/android-sdk";
          ANDROID_SDK_ROOT = "${androidsdk}/libexec/android-sdk";
          ANDROID_NDK_ROOT = "${androidsdk}/libexec/android-sdk/ndk-bundle";
          GRADLE_HOME = "${pkgs.gradle}/lib/gradle";
          GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${androidsdk}/libexec/android-sdk/build-tools/35.0.0/aapt2";
          FLUTTER_ROOT = pkgs.flutter;
          DART_ROOT = "${pkgs.flutter}/bin/cache/dart-sdk";

          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath linuxBuildInputs;

          shellHook = ''
            mkdir -p .gradle .pub-cache .npm .cache .config .local/share .android/avd

            export GRADLE_USER_HOME="$PWD/.gradle"
            export PUB_CACHE="$PWD/.pub-cache"
            export NPM_CONFIG_CACHE="$PWD/.npm"
            export XDG_CACHE_HOME="$PWD/.cache"
            export XDG_CONFIG_HOME="$PWD/.config"
            export XDG_DATA_HOME="$PWD/.local/share"
            export ANDROID_USER_HOME="$PWD/.android"
            export ANDROID_AVD_HOME="$PWD/.android/avd"
            export ANDROID_EMULATOR_HOME="$PWD/.android"

            echo "--------------------------------------------------------"
            echo " iitgHABapp Devshell"
            echo " - Flutter: $(flutter --version 2>/dev/null | head -n 1)"
            echo " - Node: $(node --version 2>/dev/null)"
            echo " - Java: $(java --version 2>/dev/null | head -n 1)"
            echo "--------------------------------------------------------"
          '';
        };
      }
    );
  };
}
