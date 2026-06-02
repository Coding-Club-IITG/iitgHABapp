# HABit — Student Mobile App

Primary student-facing Flutter application for IIT Guwahati residents. Used for mess QR scanning, room cleaning booking, mess menus, feedback, leave/rebate applications, laundry, gala dinner, and more.

**Version:** 2.2.0+28  
**Stack:** Flutter 3.x, Dart ^3.5.4, Provider (state management)

## Setup

```bash
flutter pub get
```

## Run

```bash
flutter run
```

## Build

```bash
# Android
flutter build apk --release
flutter build appbundle --release

# iOS
flutter build ios --release
```

## Configuration

### API Endpoint

Edit `lib/constants/endpoint.dart` to set the server URL:

```dart
const String baseUrl = "https://hab.codingclub.in/api";
```

### Firebase

Place the Firebase config files (`google-services.json` for Android, `GoogleService-Info.plist` for iOS) in the appropriate platform directories.

### Microsoft OAuth

The Azure AD client ID, tenant ID, and redirect URIs are configured in `lib/constants/endpoint.dart` under `AuthEndpoints`.

## Features

- **QR mess scanning** — camera-based scanning with vibration feedback and duplicate prevention
- **Weekly mess menus** — browse menus across all hostels, like/favorite items
- **Room cleaning booking** — slot selection with 14-day cooldown and capacity checks
- **Laundry service** — QR-based registration (once per 2 weeks)
- **Mess change** — apply and track mess change requests (requires Microsoft account)
- **Mess rebate / leave** — submit and track leave applications, upload medical documents
- **Summer mess registration** — apply for summer mess and check status
- **Gala dinner** — view info, scan QR per course
- **Meal feedback** — rate breakfast/lunch/dinner, SMC-specific fields
- **Notifications** — push via FCM with alert countdown timers
- **Weather-aware home screen** — dynamic backgrounds based on time/weather/festival mode
- **Festival mode** — server-driven theming and overlay
- **Google OAuth + Microsoft account linking**
- **Offline caching** via Hive and SharedPreferences
