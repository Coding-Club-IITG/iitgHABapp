/// Web OAuth 2.0 client ID from Google Cloud (used as `serverClientId` so the ID token
/// `aud` matches server verification). Pass at build time:
/// `flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com`
const String kGoogleServerClientId = String.fromEnvironment(
  'GOOGLE_SERVER_CLIENT_ID',
  defaultValue:
      '218706376793-3hgptn6u0ude0oqdiu7546l7ist67d1u.apps.googleusercontent.com',
);
