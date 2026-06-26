package com.eduadmin.pro.data.repository

import com.eduadmin.pro.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────────────────────────────────────

// Write model — no id or created_at (server-generated).
@Serializable
data class AttendanceUpsert(
    @SerialName("student_id") val studentId: String,
    @SerialName("school_id")  val schoolId: String,
    val date: String,
    val status: String,          // "PRESENT" | "ABSENT" | "LATE"
    val term: String,
    @SerialName("marked_by")  val markedBy: String
)

// Read model — includes all columns Supabase returns.
@Serializable
data class SupabaseAttendance(
    val id: String,
    @SerialName("student_id") val studentId: String,
    @SerialName("school_id")  val schoolId: String,
    val date: String,
    val status: String,
    val term: String,
    @SerialName("marked_by")  val markedBy: String,
    @SerialName("created_at") val createdAt: String
)

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class AttendanceRepository {

    private val client = SupabaseClientProvider.client

    // Fetch all attendance records for a single student within a term.
    suspend fun fetchStudentAttendance(
        studentId: String,
        term: String
    ): List<SupabaseAttendance> =
        client.postgrest["attendance"]
            .select {
                filter {
                    eq("student_id", studentId)
                    eq("term", term)
                }
            }
            .decodeList()

    // Fetch a full class register for a specific date and term.
    suspend fun fetchClassAttendance(
        date: String,
        term: String
    ): List<SupabaseAttendance> =
        client.postgrest["attendance"]
            .select {
                filter {
                    eq("date", date)
                    eq("term", term)
                }
            }
            .decodeList()

    // Upsert a batch of rows. Conflict key matches the unique constraint
    // UNIQUE (student_id, date, term) from the schema migration.
    suspend fun upsertAttendance(records: List<AttendanceUpsert>): Result<Unit> =
        runCatching {
            if (records.isEmpty()) return@runCatching
            client.postgrest["attendance"].upsert(records) {
                onConflict = "student_id,date,term"
            }
        }
}
