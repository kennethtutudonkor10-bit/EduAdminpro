package com.eduadmin.pro.data.repository

import android.content.Context
import android.util.Base64
import androidx.room.*
import androidx.work.*
import com.eduadmin.pro.data.remote.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DB ENTITIES — offline cache; the PC server is the permanent store
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
    val test1: Double?,
    val test2: Double?,
    val hw: Double?,
    val exam: Double?,
    val remark: String?,
    // false = waiting to sync, true = successfully pushed to PC
    val synced: Boolean = false
)

@Entity(tableName = "pending_attendance")
data class PendingAttendanceEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val date: String,
    val classId: String,
    val termId: String,
    // JSON-encoded map: { "studentId": "Present" | "Absent" }
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
    version = 1,
    exportSchema = false
)
abstract class EduAdminDatabase : RoomDatabase() {
    abstract fun studentDao(): StudentDao
    abstract fun pendingGradeDao(): PendingGradeDao
    abstract fun pendingAttendanceDao(): PendingAttendanceDao

    companion object {
        @Volatile private var instance: EduAdminDatabase? = null

        fun getInstance(context: Context): EduAdminDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    EduAdminDatabase::class.java,
                    "eduadmin_cache.db"
                ).build().also { instance = it }
            }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKMANAGER SYNC WORKER
// Runs on background thread whenever network becomes available.
// Pushes all pending Room records to the PC server then marks them synced.
// ─────────────────────────────────────────────────────────────────────────────

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val db = EduAdminDatabase.getInstance(context)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            syncGrades()
            syncAttendance()
            Result.success()
        } catch (e: Exception) {
            // Retry up to 3 times with exponential back-off before giving up
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private suspend fun syncGrades() {
        val pending = db.pendingGradeDao().getUnsynced()
        if (pending.isEmpty()) return

        val payload = GradeSyncRequest(
            scores = pending.map {
                ScorePayload(it.studentId, it.subjectId, it.termId,
                    it.test1, it.test2, it.hw, it.exam, it.remark)
            }
        )
        val response = apiService.syncTeacherGrades(payload)
        if (response.isSuccessful) {
            db.pendingGradeDao().markSynced(pending.map { it.localId })
        }
    }

    private suspend fun syncAttendance() {
        val pending = db.pendingAttendanceDao().getUnsynced()
        if (pending.isEmpty()) return

        for (record in pending) {
            // Parse stored JSON back to a map — Gson is already on classpath via Retrofit
            val attendanceMap = com.google.gson.Gson().fromJson<Map<String, String>>(
                record.attendanceJson,
                object : com.google.gson.reflect.TypeToken<Map<String, String>>() {}.type
            )
            val body = mapOf(
                "date" to record.date,
                "classId" to record.classId,
                "termId" to record.termId,
                "attendance" to attendanceMap
            )
            val response = apiService.pushAttendanceRecord(body)
            if (response.isSuccessful) {
                db.pendingAttendanceDao().markSynced(listOf(record.localId))
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC REPOSITORY — called by ViewModels
// ─────────────────────────────────────────────────────────────────────────────

class SyncRepository(private val context: Context) {

    private val db = EduAdminDatabase.getInstance(context)

    // ── Student roster ────────────────────────────────────────────────────

    /** Fetches the full student list from the PC and refreshes the local cache. */
    suspend fun refreshStudents(): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val response = apiService.fetchAllStudents()
            val body = response.body() ?: error("Empty response from server")
            val entities = body.map {
                StudentEntity(it.id, it.name, it.classId, it.status, it.phoneNumber)
            }
            db.studentDao().upsertAll(entities)
            entities.size
        }
    }

    fun observeStudents(): Flow<List<StudentEntity>> = db.studentDao().observeAll()

    // ── Grade caching ─────────────────────────────────────────────────────

    /** Saves a grade entry locally. WorkManager pushes it to the PC when online. */
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

    /**
     * Converts a signature Bitmap to Base64 and sends it directly to the PC.
     * The PC server stamps it onto PDF reports — no local storage needed.
     */
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

    suspend fun updateParentChannels(
        whatsapp: Boolean,
        sms: Boolean,
        email: Boolean
    ): Result<ChannelState> = withContext(Dispatchers.IO) {
        runCatching {
            val response = apiService.updateParentChannels(
                ParentChannelsRequest(whatsapp, sms, email)
            )
            response.body()?.channels ?: error("No channel state returned")
        }
    }

    // ── Avatar upload ─────────────────────────────────────────────────────

    /**
     * Compresses the selected JPEG to at most 300 KB, Base64-encodes it,
     * and sends it to the PC server. Returns the avatar URL on success.
     */
    suspend fun uploadAvatar(
        bitmap: android.graphics.Bitmap,
        userId: String,
        role: String
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val stream = java.io.ByteArrayOutputStream()
            var quality = 90
            // Reduce quality until the payload is under 300 KB
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

    /**
     * Enqueues a one-time sync job that runs as soon as network is available.
     * Using KEEP policy prevents duplicate workers if already queued.
     */
    private fun enqueueSyncWork() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork("eduadmin_sync", ExistingWorkPolicy.KEEP, request)
    }

    /** Call this on app foreground to schedule a periodic background sync. */
    fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "eduadmin_periodic_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}
