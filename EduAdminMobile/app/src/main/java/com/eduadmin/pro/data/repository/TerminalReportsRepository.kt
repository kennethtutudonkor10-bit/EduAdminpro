package com.eduadmin.pro.data.repository

import com.eduadmin.pro.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────────────────────────────────────

// Used for INSERT / UPSERT — excludes server-generated columns (id, total, timestamps).
@Serializable
data class TerminalReportUpsert(
    @SerialName("student_id") val studentId: String,
    @SerialName("school_id") val schoolId: String,
    @SerialName("class_name") val className: String,
    val term: String,
    val subject: String,
    val test1: Double? = null,
    val test2: Double? = null,
    val homework: Double? = null,
    val exam: Double? = null,
    val remark: String? = null,
    @SerialName("created_by") val createdBy: String? = null
)

// Used for SELECT — includes all columns returned by Supabase.
@Serializable
data class SupabaseTerminalReport(
    val id: String,
    @SerialName("student_id") val studentId: String,
    @SerialName("school_id") val schoolId: String,
    @SerialName("class_name") val className: String,
    val term: String,
    val subject: String,
    val test1: Double? = null,
    val test2: Double? = null,
    val homework: Double? = null,
    val exam: Double? = null,
    val total: Double? = null,
    val remark: String? = null
)

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class TerminalReportsRepository {

    private val client = SupabaseClientProvider.client

    suspend fun fetchReports(studentId: String, term: String): List<SupabaseTerminalReport> =
        client.postgrest["terminal_reports"]
            .select {
                filter {
                    eq("student_id", studentId)
                    eq("term", term)
                }
            }
            .decodeList()

    suspend fun fetchReportsByClass(className: String, term: String): List<SupabaseTerminalReport> =
        client.postgrest["terminal_reports"]
            .select {
                filter {
                    eq("class_name", className)
                    eq("term", term)
                }
            }
            .decodeList()

    // Upserts a list of reports. Conflict key matches the unique constraint
    // (student_id, term, subject) defined in supabase_migration.sql.
    suspend fun upsertReports(reports: List<TerminalReportUpsert>) {
        if (reports.isEmpty()) return
        client.postgrest["terminal_reports"].upsert(reports) {
            onConflict = "student_id,term,subject"
        }
    }
}
