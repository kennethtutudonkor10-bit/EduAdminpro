package com.eduadmin.pro.data.remote

import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

// ── Request / Response models ──────────────────────────────────────────────

data class ScorePayload(
    val studentId: String,
    val subjectId: String,
    val termId: String,
    val test1: Double?,
    val test2: Double?,
    val hw: Double?,
    val exam: Double?,
    val remark: String?
)

data class GradeSyncRequest(val scores: List<ScorePayload>)
data class GradeSyncResponse(val synced: Int, val total: Int)

data class SignatureUploadRequest(val signatureBase64: String, val adminId: String)
data class SignatureUploadResponse(val saved: Boolean)

data class ParentChannelsRequest(val whatsapp: Boolean, val sms: Boolean, val email: Boolean)
data class ChannelState(val whatsapp: Boolean, val sms: Boolean, val email: Boolean)
data class ParentChannelsResponse(val channels: ChannelState)

data class AvatarUploadRequest(val avatarBase64: String, val userId: String, val role: String)
data class AvatarUploadResponse(val success: Boolean, val avatarUrl: String?, val message: String?)

// A lightweight summary of a student returned by the PC when the app re-syncs
data class StudentSummary(
    val id: String,
    val name: String,
    val classId: String,
    val status: String,
    val phoneNumber: String?
)

// ── Retrofit service interface ─────────────────────────────────────────────

interface EduAdminApiService {

    // ── Health ────────────────────────────────────────────────────────────

    @GET("api/health")
    suspend fun healthCheck(): Response<Map<String, Boolean>>

    // ── Server identity handshake ─────────────────────────────────────────
    //
    // Used exclusively by the pairing screen to verify the user typed the
    // correct IP before persisting it. Returns { success: true, app: "EduAdmin" }
    // so the client knows it's talking to EduAdmin and not a random device.

    @GET("api/v1/system/handshake")
    suspend fun performServerHandshake(): Response<Map<String, String>>

    // ── Batch grade sync ──────────────────────────────────────────────────
    //
    // Teacher taps "Sync Grades" after working offline. The locally cached
    // Room records are bundled here and sent to the PC for persistence.

    @POST("api/v1/sync/teacher-grades")
    suspend fun syncTeacherGrades(
        @Body payload: GradeSyncRequest
    ): Response<GradeSyncResponse>

    // ── Admin signature upload ────────────────────────────────────────────
    //
    // The Compose canvas byte array is Base64-encoded on the device then
    // sent here. The PC server saves it to the settings table so the PDF
    // generator can stamp it onto terminal reports.

    @POST("api/v1/admin/upload-signature")
    suspend fun uploadAdminSignature(
        @Body payload: SignatureUploadRequest
    ): Response<SignatureUploadResponse>

    // ── Parent notification channel preferences ───────────────────────────
    //
    // Admin toggles WhatsApp / SMS / Email from the mobile command center.
    // The PC server stores these flags and respects them on next dispatch.

    @PUT("api/v1/admin/parent-channels")
    suspend fun updateParentChannels(
        @Body payload: ParentChannelsRequest
    ): Response<ParentChannelsResponse>

    // ── Avatar upload (Base64 JSON variant) ──────────────────────────────
    //
    // The avatar JPEG is compressed on-device, Base64-encoded, and sent as
    // JSON. The PC server decodes and stores it. A Multipart variant is
    // kept below for direct file streaming if preferred.

    @POST("api/v1/user/upload-avatar")
    suspend fun uploadAvatar(
        @Body payload: AvatarUploadRequest
    ): Response<AvatarUploadResponse>

    // Multipart variant — use when the image is > 200 KB to avoid
    // Base64 overhead on slow networks.
    @Multipart
    @POST("api/v1/user/upload-avatar")
    suspend fun uploadAvatarMultipart(
        @Part avatar: MultipartBody.Part
    ): Response<AvatarUploadResponse>

    // ── Student roster fetch ──────────────────────────────────────────────
    //
    // Called on app launch or forced refresh to populate the local Room cache.

    @GET("api/db/students")
    suspend fun fetchAllStudents(): Response<List<StudentSummary>>

    // ── Attendance push ───────────────────────────────────────────────────

    @POST("api/db/attendance")
    suspend fun pushAttendanceRecord(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<Map<String, Boolean>>

    // ── Biometric enrollment ──────────────────────────────────────────────
    //
    // Pushes a SHA-256 template hash to the PC so the server can cross-verify
    // scan logs against its own biometric registry.

    @POST("api/v1/biometrics/enroll")
    suspend fun enrollBiometric(
        @Body payload: Map<String, @JvmSuppressWildcards String>
    ): Response<Map<String, @JvmSuppressWildcards Any>>

    // ── Biometric attendance batch sync ───────────────────────────────────
    //
    // WorkManager pushes all pending offline scan records in one call.
    // The server saves them and auto-dispatches parent check-in alerts.

    @POST("api/v1/sync/biometric-attendance")
    suspend fun syncBiometricAttendance(
        @Body payload: Map<String, @JvmSuppressWildcards Any>
    ): Response<Map<String, @JvmSuppressWildcards Any>>

    // ── Notification inbox ────────────────────────────────────────────────
    //
    // Returns all notifications addressed to this recipient (parent/teacher).
    // The mobile app polls this every 30 s to surface school alerts offline.

    @GET("api/v1/notifications/inbox")
    suspend fun fetchInboxNotifications(
        @Query("recipient") recipientName: String
    ): Response<List<Map<String, @JvmSuppressWildcards Any>>>

    // Marks a single notification as read so the PC can track delivery state.

    @POST("api/v1/notifications/{id}/read")
    suspend fun markNotificationRead(
        @Path("id") id: String
    ): Response<Map<String, Boolean>>
}

