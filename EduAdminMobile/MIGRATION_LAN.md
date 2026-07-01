# Android Cutover: Supabase → Free LAN Backend

> Implements decision **D-001** in `/docs/STRATEGY.md`: the mobile companion talks
> to the desktop Express server over the school LAN (pairing flow), not Supabase.
>
> **Why a written spec and not one big commit:** this cutover is *atomic* — auth,
> navigation, network, and all five repositories reference Supabase and must change
> together or the app won't compile. It also remaps data models. It must be built
> and run in **Android Studio** (this repo's CI/agent environment has no Android
> SDK/Gradle), so the steps below are written to be executed and compiled there.
>
> **Status:** `NetworkConfig.kt` has already been converted to the LAN version
> (keystone — restores the `getSavedBaseUrl` / `buildPairingService` / `saveBaseUrl`
> API that `ServerPairingScreen` already calls). Everything below is the remainder.

---

## 0. Target architecture

```
Android app ──(LAN, http://<pc-ip>:<port>)──► Desktop Express server ──► SQLite
   pair on ServerPairingScreen          /api/db/* and /api/v1/* (already exist)
   pick role on RoleSelectionScreen     (no cloud, no accounts, no internet)
```

Auth model: **no cloud login.** Identity is "which PC am I paired to + which role
did I pick." Replace Supabase email/password sign-in with pairing + role selection
(both screens already exist).

---

## 1. Endpoint map (LAN server — already implemented)

All of these are defined in `data/remote/EduAdminApiService.kt` and `server.ts`:

| Need | LAN endpoint | EduAdminApiService method |
|------|--------------|---------------------------|
| Handshake (verify server) | `GET /api/v1/system/handshake` | `performServerHandshake()` |
| Student roster | `GET /api/db/students` | `fetchAllStudents()` |
| Push grades (batch) | `POST /api/v1/sync/teacher-grades` | `syncTeacherGrades()` |
| Push attendance | `POST /api/db/attendance` | `pushAttendanceRecord()` |
| Admin signature | `POST /api/v1/admin/upload-signature` | `uploadAdminSignature()` |
| Parent channels | `PUT /api/v1/admin/parent-channels` | `updateParentChannels()` |
| Avatar | `POST /api/v1/user/upload-avatar` | `uploadAvatar()` |
| Biometric enroll | `POST /api/v1/biometrics/enroll` | `enrollBiometric()` |
| Biometric sync | `POST /api/v1/sync/biometric-attendance` | `syncBiometricAttendance()` |
| Inbox | `GET /api/v1/notifications/inbox` | `fetchInboxNotifications()` |
| Mark read | `POST /api/v1/notifications/{id}/read` | `markNotificationRead()` |

The desktop server is **single-school per PC**, so there is no `school_id`,
`profiles`, or RLS — drop all of that. Remove the `SupabaseStudent` / `SupabaseProfile`
`school_id`/`class_name` mapping; use the LAN `StudentSummary` model instead.

---

## 2. File-by-file changes

### 2.1 `data/remote/SupabaseClientProvider.kt` — **DELETE**
Removes the hardcoded Supabase URL + anon key (secret-hygiene win). Every reference
to it disappears in the steps below.

### 2.2 `data/remote/NetworkConfig.kt` — **DONE**
Already converted. Note the signature changes callers must adopt:
- `initialize()` → `initialize(context)`
- `clear()` → `clear(context)`
- `TokenStore.jwt` → removed; `TokenStore.apiKey` (optional X-EduAdmin-Key) instead.

### 2.3 `MainActivity.kt`
- Remove Supabase imports and the `runBlocking` session-status block.
- Start destination = paired? → `RoleSelect` : `Pairing`:
  ```kotlin
  val startDestination =
      if (NetworkConfig.getSavedBaseUrl(this) != null) {
          NetworkConfig.initialize(this)
          scheduleAcademicSync(); scheduleBiometricSync()
          Screen.RoleSelect.route
      } else {
          Screen.Pairing.route
      }
  ```
- Drop the `TokenStore.jwt` assignment.

### 2.4 `ui/auth/LoginScreen.kt` — **DELETE** (and remove `Screen.Login` + its
`composable(Screen.Login.route)` block in `AppNavigation.kt`). The free flow has no
cloud login. Role choice happens on `RoleSelectionScreen`.

### 2.5 `ui/navigation/AppNavigation.kt`
- Remove `import io.github.jan.supabase.*` and `SupabaseClientProvider`.
- Delete the `Login` route; make `Pairing` a real start destination again (it's
  already wired to navigate to `RoleSelect` on success).
- `onRepairConnection` becomes:
  ```kotlin
  onRepairConnection = {
      NetworkConfig.clear(context)
      navController.navigate(Screen.Pairing.route) { popUpTo(0) { inclusive = true } }
  }
  ```

### 2.6 `data/repository/StudentRepository.kt`
- Delete `SupabaseStudent` / `SupabaseProfile` and the postgrest calls.
- Back it with Retrofit:
  ```kotlin
  class StudentRepository {
      suspend fun fetchAllStudents(): List<StudentSummary> =
          apiService.fetchAllStudents().body().orEmpty()
      suspend fun fetchStudentsByClass(classId: String): List<StudentSummary> =
          fetchAllStudents().filter { it.classId == classId }
  }
  ```
  (`StudentSummary` already exists in `EduAdminApiService.kt`.) Drop `fetchCurrentProfile()`.

### 2.7 `data/repository/SyncRepository.kt`
- Keep the Room cache + DAOs + WorkManager wiring unchanged (the offline write-ahead
  cache is exactly right for LAN/offline).
- In `SyncWorker.syncGrades()`: drop the `profiles`/`schoolId` lookup; map pending
  grades to `ScorePayload` and call `apiService.syncTeacherGrades(GradeSyncRequest(...))`.
- In `SyncWorker.syncAttendance()`: post each day's record via
  `apiService.pushAttendanceRecord(mapOf("date" to ..., "termId" to ..., "classId" to ..., "attendance" to map))`.
- `refreshStudents()`: replace the postgrest select with `apiService.fetchAllStudents()`.
- `uploadSignature` / `uploadAvatar` already use `apiService` — leave as-is. Delete
  the "TODO: migrate to Supabase Storage" comments.

### 2.8 `data/repository/{AttendanceRepository,AnnouncementsRepository,TerminalReportsRepository}.kt`
- Replace each postgrest query with the matching Retrofit call from the endpoint map.
- `AnnouncementsRepository`: the LAN server has no announcements table yet — either
  back it with the notification inbox (`fetchInboxNotifications`) or stub it returning
  an empty list until a `/api/v1/announcements` endpoint is added to `server.ts`.

### 2.9 `ui/admin/AdminDashboardScreen.kt`, `ui/parent/ParentPortalScreen.kt`
- Remove the 1–2 Supabase references each (sign-out / profile reads). Sign-out becomes
  `NetworkConfig.clear(context)` → navigate to `Pairing`.

### 2.10 `app/build.gradle`
Remove:
```groovy
implementation 'io.github.jan-tennert.supabase:auth-kt:2.6.1'
implementation 'io.github.jan-tennert.supabase:postgrest-kt:2.6.1'
implementation 'io.github.jan-tennert.supabase:storage-kt:2.6.1'
implementation 'io.ktor:ktor-client-okhttp:2.3.12'
```
Also drop the `org.jetbrains.kotlin.plugin.serialization` plugin **iff** no
`@Serializable` models remain after the repo rewrites (they were Supabase models).
Keep Retrofit, OkHttp, Gson, Room, WorkManager, security-crypto, Coil.

---

## 3. Verification checklist (in Android Studio)
- [ ] Project compiles with zero `io.github.jan.supabase` / `io.ktor` references
      (`grep -rn "supabase\|io.ktor" app/src` returns nothing).
- [ ] Fresh install → lands on **ServerPairingScreen**.
- [ ] Pair with a running desktop server (`npm start`, port 3000) → handshake passes →
      **RoleSelectionScreen**.
- [ ] Teacher: edit a grade offline → toggle network → WorkManager syncs to the PC
      (`GET /api/db/scores` on the PC shows it).
- [ ] Attendance, signature upload, avatar, biometric sync, and inbox all round-trip
      to the PC.
- [ ] "Repair connection" returns to pairing and forgets the saved URL.

---

## 4. Server-side follow-ups (optional, separate)
- Add `X-EduAdmin-Key` middleware to `/api/*` in `server.ts` and surface the key on
  the pairing screen, if LAN-only trust is not enough.
- Add `/api/v1/announcements` if the announcements feature is kept.
