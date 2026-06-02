# HABit RC: Room Cleaning Manager App

Mobile application for hostel room cleaning managers to manage daily cleaning schedules (assign cleaners, finalize statuses, and generate PDF reports).

**Version:** 1.0.0+1  
**Stack:** Flutter 3.x, Dart ^3.10.7, Dio

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
```

## Features

- **Yesterday**: view past bookings, mark statuses (Cleaned / Room Locked / Student Did Not Respond / Student Asked To Cancel / Room Cleaners Not Available), bulk finalize per cleaner
- **Today**: view current day's schedule filtered by cleaner
- **Tomorrow**: assign cleaners to bookings per slot (A/B/C/D), manage buffer slots, save assignments
- **PDF generation**: per-cleaner A4 assignment sheets with room numbers, slot times, phone numbers, and signature columns, shared via system share sheet (WhatsApp, email, etc.)
- **Password-based login**: per-hostel shared password (no Google OAuth)
- **App version enforcement**: update check on launch
