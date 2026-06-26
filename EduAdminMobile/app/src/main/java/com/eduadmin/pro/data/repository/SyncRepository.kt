package com.eduadmin.pro.data.repository

import android.content.Context
import android.util.Base64
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.work.*
import com.eduadmin.pro.data.remote.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DB ENTITIES — offline write-ahead cache; Supabase is the permanent store
// ─────────────────────────────────────────────────────────────────────────────

@Entity(tableName = "students")
data class StudentEntity(
    @PrimaryKey val id: String,
    val name: String,
    val classId: String,
    val status: String,
    val phoneNumber: String?
)

@Entity(tableName = "pending_grades")
data class PendingGradeEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val studentId: String,
    val subjectId: String,
    val termId: String,
    // Populated from GradebookViewModel.classId so the SyncWorker can write
    // the correct class_name column in Supabase terminal_reports.
    @ColumnInfo(defaultValue = "") val className: String = "",
    val test1: Double?,
    val test2: Double?,
    val hw: Double?,
    val exam: Double?,
    val remark: String?,
    val synced: Boolean = false
)

@Entity(tableName = "pending_attendance")
data class PendingAttendanceEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val date: String,
    val classId: String,
    val termId: String,
    // JSON-encoded map: { "studentId": "Present" | "Absent" | "Late" }
    val attendanceJson: String,
    val synced: Boolean = false
)

// ─────────────────────────────────────────────────────────────────────────────
// DAOs
// ─────────────────────────────────────────────────────────────────────────────

@Dao
interface StudentDao {
    @Query("SELECT * FROM students ORDER BY classId, name")
    fun observeAll(): Flow<List<StudentEntity>>

    @Query("SELECT * FROM students WHERE classId = :classId AND status = 'Enrolled'")
    suspend fun getByClass(classId: String): List<StudentEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(students: List<StudentEntity>)
}

@Dao
interface PendingGradeDao {
    @Query("SELECT * FROM pending_grades WHERE synced = 0")
    suspend fun getUnsynced(): List<PendingGradeEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(grade: PendingGradeEntity)

    @Query("UPDATE pending_grades SET synced = 1 WHERE localId IN (:ids)")
    suspend fun markSynced(ids: List<Long>)
}

@Dao
interface PendingAttendanceDao {
    @Query("SELECT * FROM pending_attendance WHERE synced = 0")
    suspend fun getUnsynced(): List<PendingAttendanceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: PendingAttendanceEntity)

    @Query("UPDATE pending_attendance SET synced = 1 WHERE localId IN (:ids)")
    suspend fun markSynced(ids: List<Long>)
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DATABASE
// ─────────────────────────────────────────────────────────────────────────────

@Database(
    entities = [StudentEntity::class, PendingGradeEntity::class, PendingAttendanceEntity::class],
    version = 2,
    exportSchema = false
)
abstract class EduAdminDatabase : RoomDatabase() {
    abstract fun studentDao(): StudentDao
    abstract fun pendingGradeDao(): PendingGradeDao
    abstract fun pendingAttendanceDao(): PendingAttendanceDao

    companion object {
        @Volatile private var instance: EduAdminDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE pending_grades ADD COLUMN className TEXT NOT NULL DEFAULT ''"
                )
            }
        }

        fun getInstance(context: Context): EduAdminDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    EduAdminDatabase::class.java,
                    "eduadmin_cache.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .build()
                    .also { instance = it }
            }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKMANAGER SYNC WORKER
// Pushes all pending Room records to Supabase then marks them synced.
// ─────────────────────────────────────────────────────────────────────────────

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val db = EduAdminDatabase.getInstance(context)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            syncGrades()
            syncAttendance()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private suspend fun syncGrades() {
        val pending = db.pendingGradeDao().getUnsynced()
        if (pending.isEmpty()) return

        val client = SupabaseClientProvider.client
        val userId = client.auth.currentUserOrNull()?.id ?: return
        val profile = client.postgrest["profiles"]
            .select { filter { eq("id", userId) } }
            .decodeSingle<SupabaseProfile>()
        val schoolId = profile.schoolId ?: return

        val reports = pending.map { grade ->
            TerminalReportUpsert(
                studentId = grade.studentId,
                schoolId  = schoolId,
                className = grade.className,
                term      = grade.termId,
                subject   = grade.subjectId,
                test1     = grade.test1,
                test2     = grade.test2,
                homework  = grade.hw,
                exam      = grade.exam,
                remark    = grade.remark,
                createdBy = userId
            )
        }

        client.postgrest["terminal_reports"].upsert(reports) {
            onConflict = "student_id,term,subject"
        }
        db.pendingGradeDao().markSynced(pending.map { it.localId })
    }

    private suspend fun syncAttendance() {
        val pending = db.pendingAttendanceDao().getUnsynced()
        if (pending.isEmpty()) return

        val client = SupabaseClientProvider.client
        val userId = client.auth.currentUserOrNull()?.id ?: return
        val profile = client.postgrest["profiles"]
            .select { filter { eq("id", userId) } }
            .decodeSingle<SupabaseProfile>()
        val schoolId = profile.schoolId ?: return

        val gson = Gson()
        val allRecords = mutableListOf<AttendanceUpsert>()

        pending.forEach { entity ->
            val type = object : TypeToken<Map<String, String>>() {}.type
            val attendanceMap: Map<String, String> = gson.fromJson(entity.attendanceJson, type)

            attendanceMap.forEach { (studentId, status) ->
                allRecords.add(
                    AttendanceUpsert(
                        studentId = studentId,
                        schoolId  = schoolId,
                        date      = entity.date,
                        status    = status.uppercase(),
                        term      = entity.termId,
                        markedBy  = userId
                    )
                )
            }
        }

        if (allRecords.isNotEmpty()) {
            client.postgrest["attendance"].upsert(allRecords) {
                onConflict = "student_id,date,term"
            }
        }

        db.pendingAttendanceDao().markSynced(pending.map { it.localId })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC REPOSITORY — called by ViewModels
// ─────────────────────────────────────────────────────────────────────────────

class SyncRepository(private val context: Context) {

    private val db = EduAdminDatabase.getInstance(context)

    // ── Student roster ────────────────────────────────────────────────────

    // Fetches the full student list from Supabase and refreshes the local cache.
    suspend fun refreshStudents(): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val students = SupabaseClientProvider.client
                .postgrest["students"]
                .select()
                .decodeList<SupabaseStudent>()
            val entities = students.map { s ->
                StudentEntity(s.id, s.fullName, s.className, "Enrolled", null)
            }
            db.studentDao().upsertAll(entities)
            entities.size
        }
    }

    fun observeStudents(): Flow<List<StudentEntity>> = db.studentDao().observeAll()

    // ── Grade caching ─────────────────────────────────────────────────────

    // Saves a grade entry locally. WorkManager pushes it to Supabase when online.
    suspend fun cacheGrade(grade: PendingGradeEntity) = withContext(Dispatchers.IO) {
        db.pendingGradeDao().insert(grade)
        enqueueSyncWork()
    }

    // ── Attendance caching ────────────────────────────────────────────────

    suspend fun cacheAttendance(record: PendingAttendanceEntity) = withContext(Dispatchers.IO) {
        db.pendingAttendanceDao().insert(record)
        enqueueSyncWork()
    }

    // ── Admin signature upload ────────────────────────────────────────────
    // TODO: Migrate to Supabase Storage (storage-kt). Currently calls the old
    // Retrofit endpoint — this will fail until the endpoint is updated.

    suspend fun uploadSignature(
        signaturePng: android.graphics.Bitmap,
        adminId: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val stream = java.io.ByteArrayOutputStream()
            signaturePng.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream)
            val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            val response = apiService.uploadAdminSignature(
                SignatureUploadRequest("data:image/png;base64,$base64", adminId)
            )
            response.body()?.saved ?: false
        }
    }

    // ── Parent channel preferences ────────────────────────────────────────
    // TODO: Supabase schema does not yet have a channel_prefs table.
    // Returns a no-op success; prefs are kept as local ViewModel state only.

    suspend fun updateParentChannels(
        whatsapp: Boolean,
        sms: Boolean,
        email: Boolean
    ): Result<ChannelState> = withContext(Dispatchers.IO) {
        Result.success(ChannelState(whatsapp, sms, email))
    }

    // ── Avatar upload ─────────────────────────────────────────────────────
    // TODO: Migrate to Supabase Storage (storage-kt).

    suspend fun uploadAvatar(
        bitmap: android.graphics.Bitmap,
        userId: String,
        role: String
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val stream = java.io.ByteArrayOutputStream()
            var quality = 90
            do {
                stream.reset()
                bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, quality, stream)
                quality -= 10
            } while (stream.size() > 300_000 && quality > 30)

            val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            val response = apiService.uploadAvatar(
                AvatarUploadRequest("data:image/jpeg;base64,$base64", userId, role)
            )
            response.body()?.avatarUrl ?: error("Server did not return avatarUrl")
        }
    }

    // ── WorkManager helpers ───────────────────────────────────────────────

    private fun enqueueSyncWork() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork("eduadmin_sync", ExistingWorkPolicy.KEEP, request)
    }

    fun schedulePeriodicSync() {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "eduadmin_periodic_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}
