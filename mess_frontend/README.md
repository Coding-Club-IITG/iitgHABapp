# HABit HQ: Mess Manager App

Mobile application for mess and caterer staff to manage daily operations like live QR scan monitoring, subscriber management, rebate processing, summer mess, and gala dinner attendance.

**Version:** 1.0.0+6  
**Stack:** Flutter 3.x, Dart ^3.10.7, GoRouter, Provider, WebSocket

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
flutter build apk --release
```

## Configuration

### API Endpoint

Edit `lib/constants/endpoint.dart`:

```dart
const String baseUrl = 'https://hab.codingclub.in/api';
const String baseWsUrl = 'wss://hab.codingclub.in/api';
```

### Firebase

Place `google-services.json` in `android/app/` for Firebase Auth.

## Features

- **Live scan dashboard**: real-time QR scan feed (5-second WebSocket refresh), per-meal totals (breakfast/lunch/dinner)
- **Scan log history**: full per-meal scan logs with student details
- **Mess subscribers**: view current subscriber list
- **Rebate management**: view and process mess rebate/leave applications
- **Summer mess**: view registrations and attendance
- **Gala dinner**: attendance view and per-course scan logs
- **Google OAuth + Firebase Auth** login
- **App version enforcement**: update check on launch
