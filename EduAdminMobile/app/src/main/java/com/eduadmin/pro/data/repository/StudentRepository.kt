package com.eduadmin.pro.data.repository

import com.eduadmin.pro.data.remote.SupabaseClientProvider
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE MODELS
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class SupabaseStudent(
    val id: String,
    @SerialName("school_id") val schoolId: String,
    @SerialName("full_name") val fullName: String,
    @SerialName("class_name") val className: String
)

@Serializable
data class SupabaseProfile(
    val id: String,
    @SerialName("school_id") val schoolId: String? = null,
    @SerialName("full_name") val fullName: String,
    val role: String
)

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class StudentRepository {

    private val client = SupabaseClientProvider.client

    suspend fun fetchStudentsByClass(className: String): List<SupabaseStudent> =
        client.postgrest["students"]
            .select { filter { eq("class_name", className) } }
            .decodeList()

    suspend fun fetchAllStudents(): List<SupabaseStudent> =
        client.postgrest["students"]
            .select()
            .decodeList()

    suspend fun fetchStudentById(studentId: String): SupabaseStudent? =
        runCatching {
            client.postgrest["students"]
                .select { filter { eq("id", studentId) } }
                .decodeSingle<SupabaseStudent>()
        }.getOrNull()

    suspend fun fetchCurrentProfile(): SupabaseProfile? =
        runCatching {
            val userId = client.auth.currentUserOrNull()?.id ?: return@runCatching null
            client.postgrest["profiles"]
                .select { filter { eq("id", userId) } }
                .decodeSingle<SupabaseProfile>()
        }.getOrNull()
}
