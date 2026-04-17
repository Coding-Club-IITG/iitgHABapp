# Bootstrap Grouped API Refactor

Date: 2026-04-17

## Objective
Consolidate multiple frontend startup and navigation API calls into one backend bootstrap endpoint, then hydrate frontend state from that single payload while keeping safe fallbacks.

## High-Level Outcome
- Added one grouped backend endpoint: GET /api/app/bootstrap.
- Refactored frontend login and main navigation flows to use grouped bootstrap first.
- Preserved legacy per-endpoint behavior as fallback if bootstrap fails.
- Added frontend hydration helpers to apply grouped payloads into existing caches/providers.

## Backend Changes

### New App Bootstrap Module
- Added new controller at server/v1/modules/app/appController.js.
- Added new router at server/v1/modules/app/appRoute.js.
- Mounted route in v1 server at /api/app via server/v1/index.js.

### New Endpoint
- GET /api/app/bootstrap
- Auth: authenticateJWT
- Response shape:
- success: boolean
- data.user: current user payload (same shape used by /api/users/ consumers)
- data.userMessInfo: current subscribed mess info (same shape expected by user mess client)
- data.hostels: hostel list (same shape expected by HostelsNotifier)
- data.allMessInfo: mess list (same shape expected by MessInfoProvider)
- data.upcomingGala: next gala (same shape as /api/gala/upcoming)
- data.alerts: active alerts array
- data.roomCleaningBookings.bookings: room cleaning bookings array
- data.todayMenu: current day menu payload for subscribed mess
- errors: keyed partial-failure map for sections that failed
- meta: day and fetchedAt

### Backend Aggregation Logic
- Uses Promise.allSettled pattern so one subsection failure does not fail full response.
- Applies per-section fallbacks when a subsection fails.
- Reuses equivalent data logic for:
- user enrichment with hostel name and subscribed mess display
- mess info and all mess list
- alerts relevant to user target scope
- room cleaning booking cancellability flags
- day menu with item ordering and isLiked projection

## Frontend Changes

### New Bootstrap API Client
- Added frontend2/lib/apis/app_bootstrap.dart.
- Added AppBootstrapCache with short-lived in-memory cache.
- Added fetchAppBootstrapData().
- Added applyAppBootstrapData() to hydrate user, mess, hostel, alerts, bookings, and menu cache.

### Endpoint Constants
- Added AppBootstrapEndpoints.bootstrap in frontend2/lib/constants/endpoint.dart.

### Main Navigation Flow Refactor
- Updated frontend2/lib/screens/main_navigation_screen.dart.
- _runPhase2AndPhase3 now:
- tries grouped bootstrap first
- hydrates providers and local caches from grouped payload
- falls back to legacy calls if grouped bootstrap unavailable
- keeps FCM registration and analytics behavior
- resolves gala tab from preloaded payload when available
- Added gating so HomeScreen and bottom nav render only after _homeDataReady.
- This prevents early Home init calls from firing before grouped hydration is applied.

### Authentication Flow Refactor
- Updated frontend2/lib/apis/authentication/login.dart.
- authenticate(), guestAuthenticate(), signInWithApple(), and linkMicrosoftAccount() now:
- prefer grouped bootstrap hydration
- fallback to existing multi-call flow on failure
- logoutHandler() now clears AppBootstrapCache.

### Frontend Hydration Helpers Added
- frontend2/lib/apis/users/user.dart
- Added persistUserDetailsFromPayload().
- fetchUserDetails() now reuses the same persistence helper.

- frontend2/lib/apis/mess/user_mess_info.dart
- Added persistUserMessInfoFromPayload().
- getUserMessInfo() now reuses the same persistence helper.

- frontend2/lib/providers/hostels.dart
- Added preloaded hostels support in init({preloadedHostels}).
- Added internal apply/persist/finalize helpers.

- frontend2/lib/utilities/startupitem.dart
- Added applyMessInfoList() to hydrate provider from grouped payload.

- frontend2/lib/utilities/alert_manager.dart
- Added applyAlertsFromServerJson() helper.
- syncAlerts() now reuses this helper.

- frontend2/lib/providers/room_cleaning_provider.dart
- Added applyBookingsFromJson() helper.

- frontend2/lib/apis/mess/mess_menu.dart
- Added seedMenuCache() and seedMenuCacheWithModels() to pre-prime menu cache.

### Main App Init Adjustment
- Updated frontend2/lib/main.dart.
- Removed eager AlertsManager.syncAlerts() call in app init because alerts are now hydrated via grouped bootstrap after navigation.

## Call Consolidation Map

Previous grouped startup pattern in frontend (multiple calls):
- /users/
- /mess/get
- /hostel/all
- /mess/all
- /gala/upcoming
- /api/v2/alerts
- /room-cleaning/booking/my
- /mess/menu/:messId (day)

New grouped pattern:
- /app/bootstrap
- plus independent side-effect calls retained where appropriate:
- /notification/register-token
- /notification/welcome (as existing behavior)
- profile picture fetch remains conditional by cache logic

## Fallback and Compatibility Behavior
- If /app/bootstrap fails or is unavailable, old behavior remains active.
- Existing endpoint-specific methods are still present and used by fallback paths.
- This reduces rollout risk and keeps compatibility with partial backend deployments.

## Files Changed
- server/v1/index.js
- server/v1/modules/app/appController.js
- server/v1/modules/app/appRoute.js
- frontend2/lib/constants/endpoint.dart
- frontend2/lib/apis/app_bootstrap.dart
- frontend2/lib/screens/main_navigation_screen.dart
- frontend2/lib/apis/authentication/login.dart
- frontend2/lib/apis/users/user.dart
- frontend2/lib/apis/mess/user_mess_info.dart
- frontend2/lib/providers/hostels.dart
- frontend2/lib/utilities/startupitem.dart
- frontend2/lib/utilities/alert_manager.dart
- frontend2/lib/providers/room_cleaning_provider.dart
- frontend2/lib/apis/mess/mess_menu.dart
- frontend2/lib/main.dart

## Validation Status
- JS syntax checks for backend changed files: passed.
- IDE error scan for changed backend and frontend files: no errors reported.
- flutter analyze command failed in this environment due local Flutter script line ending issue:
- /mnt/c/Users/praji/dev/flutter/bin/internal/shared.sh: line 5: $'\r': command not found

## Notes
- The grouped endpoint intentionally returns partial data with per-section errors rather than failing the whole payload.
- Frontend grouped hydration writes through existing storage/provider pathways to preserve current app behavior.
