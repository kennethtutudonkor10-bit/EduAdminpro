package com.eduadmin.pro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.work.*
import com.eduadmin.pro.data.biometric.BiometricSyncWorker
import com.eduadmin.pro.data.remote.NetworkConfig
import com.eduadmin.pro.data.remote.SupabaseClientProvider
import com.eduadmin.pro.data.remote.TokenStore
import com.eduadmin.pro.data.repository.SyncWorker
import com.eduadmin.pro.ui.navigation.AppNavigation
import com.eduadmin.pro.ui.navigation.Screen
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Block briefly on the main thread while Supabase loads the persisted
        // session from EncryptedSharedPreferences. In practice this is a single
        // local disk read and completes well under 50 ms on any modern device.
        val sessionStatus = runBlocking(Dispatchers.IO) {
            try {
                // The Auth plugin emits LoadingFromStorage until the stored
                // session has been fully restored. We wait for that to settle.
                SupabaseClientProvider.client.auth.sessionStatus
                    .first { it is SessionStatus.Authenticated || it is SessionStatus.NotAuthenticated }
            } catch (_: Exception) {
                SessionStatus.NotAuthenticated
            }
        }

        val startDestination: String

        if (sessionStatus is SessionStatus.Authenticated) {
            val session = sessionStatus.session
            TokenStore.jwt = session.accessToken
            NetworkConfig.initialize()
            scheduleAcademicSync()
            scheduleBiometricSync()

            // Read the role baked into the user's metadata at account creation.
            // ADMIN goes straight to the command centre; TEACHER and PARENT land
            // on RoleSelect so they can pick a class/student before proceeding.
            val role = session.user?.userMetadata
                ?.get("role")?.toString()?.trim('"')
                ?: "TEACHER"

            startDestination = when (role) {
                "ADMIN" -> Screen.AdminDashboard.route
                else    -> Screen.RoleSelect.route
            }
        } else {
            startDestination = Screen.Login.route
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavigation(startDestination = startDestination)
                }
            }
        }
    }

    // ── Academic sync — grades and attendance every 15 minutes ─────────────────

    private fun scheduleAcademicSync() {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setInitialDelay(2, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            "eduadmin_academic_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    // ── Biometric sync — scanned check-ins every 15 minutes ────────────────────

    private fun scheduleBiometricSync() {
        val request = PeriodicWorkRequestBuilder<BiometricSyncWorker>(15, TimeUnit.MINUTES)
            .setInitialDelay(3, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            "eduadmin_biometric_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}
