package com.eduadmin.pro.data.biometric

import android.content.Context
import androidx.room.*
import androidx.work.*
import com.eduadmin.pro.data.remote.apiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

// ─────────────────────────────────────────────────────────────────────────────
// ROOM ENTITIES — biometric data is kept in its own isolated DB file.
// Academic cache (SyncRepository) and biometric cache must never share a file.
// ─────────────────────────────────────────────────────────────────────────────

@Entity(tableName = "student_biometrics")
data class StudentBiometricEntity(
    @PrimaryKey val studentId: String,
    val studentName: String,
    val classId: String,
    val templateHash: String,           // SHA-256 of raw USB scanner bytes
    val registeredAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "pending_biometric_attendance")
data class PendingBiometricAttendanceEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val studentId: String,
    val templateHash: String,
    val verifiedAt: String,             // ISO-8601 — kept as String for Gson compat
    val termId: String,
    val classId: String,
    val verificationTag: String = "BIOMETRIC",
    val synced: Boolean = false
)

// ─────────────────────────────────────────────────────────────────────────────
// DAOs
// ─────────────────────────────────────────────────────────────────────────────

@Dao
interface StudentBiometricDao {
    @Query("SELECT * FROM student_biometrics ORDER BY registeredAt DESC")
    fun observeAll(): Flow<List<StudentBiometricEntity>>

    @Query("SELECT * FROM student_biometrics WHERE templateHash = :hash LIMIT 1")
    suspend fun findByHash(hash: String): StudentBiometricEntity?

    @Query("SELECT * FROM student_biometrics WHERE studentId = :studentId LIMIT 1")
    suspend fun findByStudentId(studentId: String): StudentBiometricEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: StudentBiometricEntity)

    @Delete
    suspend fun delete(entity: StudentBiometricEntity)
}

@Dao
interface PendingBiometricAttendanceDao {
    @Query("SELECT * FROM pending_biometric_attendance WHERE synced = 0 ORDER BY verifiedAt ASC")
    suspend fun getUnsynced(): List<PendingBiometricAttendanceEntity>

    @Query("""
        SELECT * FROM pending_biometric_attendance
        WHERE studentId = :studentId AND verifiedAt LIKE :datePrefix || '%'
        LIMIT 1
    """)
    suspend fun findTodayRecord(studentId: String, datePrefix: String): PendingBiometricAttendanceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: PendingBiometricAttendanceEntity)

    @Query("UPDATE pending_biometric_attendance SET synced = 1 WHERE localId IN (:ids)")
    suspend fun markSynced(ids: List<Long>)
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DATABASE
// ─────────────────────────────────────────────────────────────────────────────

@Database(
    entities  = [StudentBiometricEntity::class, PendingBiometricAttendanceEntity::class],
    version   = 1,
    exportSchema = false
)
abstract class BiometricDatabase : RoomDatabase() {
    abstract fun biometricDao(): StudentBiometricDao
    abstract fun attendanceDao(): PendingBiometricAttendanceDao

    companion object {
        @Volatile private var instance: BiometricDatabase? = null

        fun getInstance(context: Context): BiometricDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    BiometricDatabase::class.java,
                    "eduadmin_biometric_cache.db"
                ).build().also { instance = it }
            }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKMANAGER SYNC WORKER
// Pushes all unsynced biometric attendance records to the PC, then marks them.
// ─────────────────────────────────────────────────────────────────────────────

class BiometricSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val db = BiometricDatabase.getInstance(context)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        runCatching {
            val pending = db.attendanceDao().getUnsynced()
            if (pending.isEmpty()) return@runCatching Result.success()

            val payload = pending.map { r ->
                mapOf(
                    "studentId"   to r.studentId,
                    "templateHash" to r.templateHash,
                    "verifiedAt"  to r.verifiedAt,
                    "termId"      to r.termId,
                    "classId"     to r.classId
                )
            }

            val response = apiService.syncBiometricAttendance(mapOf("records" to payload))
            if (response.isSuccessful) {
                db.attendanceDao().markSynced(pending.map { it.localId })
            }
            Result.success()
        }.getOrElse {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

class BiometricRepository(private val context: Context) {

    private val db = BiometricDatabase.getInstance(context)

    // ── Template management ───────────────────────────────────────────────────

    fun observeEnrollments(): Flow<List<StudentBiometricEntity>> =
        db.biometricDao().observeAll()

    /** Hash raw USB scanner bytes → SHA-256 hex string used as the stored key. */
    fun hashBytes(raw: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(raw).joinToString("") { "%02x".format(it) }
    }

    suspend fun enrollStudent(
        studentId: String,
        studentName: String,
        classId: String,
        templateHash: String
    ) = withContext(Dispatchers.IO) {
        // Push the hash to the PC first so both sides stay consistent
        runCatching {
            apiService.enrollBiometric(mapOf("studentId" to studentId, "templateHash" to templateHash))
        }
        // Always save locally regardless of network outcome
        db.biometricDao().upsert(
            StudentBiometricEntity(studentId, studentName, classId, templateHash)
        )
    }

    suspend fun revokeEnrollment(entity: StudentBiometricEntity) = withContext(Dispatchers.IO) {
        db.biometricDao().delete(entity)
    }

    // ── Attendance verification ───────────────────────────────────────────────

    /**
     * Looks up a scanner hash in the local Room cache. Returns the matching student
     * or null if the hash has not been enrolled. This is the hot path called on
     * every scan — it must be fast.
     */
    suspend fun verifyHash(hash: String): StudentBiometricEntity? =
        withContext(Dispatchers.IO) { db.biometricDao().findByHash(hash) }

    /**
     * Writes a verified check-in to the local Room cache.
     * Skips duplicate scans for the same student on the same calendar day.
     */
    suspend fun recordAttendance(
        student: StudentBiometricEntity,
        termId: String,
        timestamp: String
    ): Boolean = withContext(Dispatchers.IO) {
        val today = timestamp.take(10)  // yyyy-MM-dd prefix
        val existing = db.attendanceDao().findTodayRecord(student.studentId, today)
        if (existing != null) return@withContext false   // already checked in today

        db.attendanceDao().insert(
            PendingBiometricAttendanceEntity(
                studentId    = student.studentId,
                templateHash = student.templateHash,
                verifiedAt   = timestamp,
                termId       = termId,
                classId      = student.classId
            )
        )
        enqueueSyncWork()
        true
    }

    // ── WorkManager ───────────────────────────────────────────────────────────

    private fun enqueueSyncWork() {
        val request = OneTimeWorkRequestBuilder<BiometricSyncWorker>()
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("biometric_sync", ExistingWorkPolicy.KEEP, request)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETROFIT EXTENSION — two new endpoints wired in EduAdminApiService
// ─────────────────────────────────────────────────────────────────────────────

// These functions are called above; the matching @POST/@GET declarations
// must be added to EduAdminApiService.kt (done in the companion edit).
