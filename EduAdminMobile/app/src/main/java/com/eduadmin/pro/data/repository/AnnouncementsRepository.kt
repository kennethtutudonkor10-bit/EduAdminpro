package com.eduadmin.pro.data.repository

import com.eduadmin.pro.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SupabaseAnnouncement(
    val id: String,
    @SerialName("school_id") val schoolId: String,
    @SerialName("target_class") val targetClass: String? = null,
    val title: String,
    val body: String,
    @SerialName("created_at") val createdAt: String
)

class AnnouncementsRepository {

    private val client = SupabaseClientProvider.client

    // Fetches all announcements visible to this user (RLS enforces school isolation),
    // then filters client-side to keep school-wide broadcasts and class-specific ones.
    suspend fun fetchAnnouncements(className: String): List<SupabaseAnnouncement> {
        val all: List<SupabaseAnnouncement> = client.postgrest["announcements"]
            .select()
            .decodeList()
        return all
            .filter { it.targetClass == null || it.targetClass == className }
            .sortedByDescending { it.createdAt }
    }

    suspend fun fetchAllAnnouncements(): List<SupabaseAnnouncement> =
        client.postgrest["announcements"]
            .select()
            .decodeList<SupabaseAnnouncement>()
            .sortedByDescending { it.createdAt }
}
