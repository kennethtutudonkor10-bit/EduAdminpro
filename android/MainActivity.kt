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
import com.eduadmin.pro.data.repository.SyncWorker
import com.eduadmin.pro.ui.navigation.AppNavigation
import com.eduadmin.pro.ui.navigation.Screen
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val savedUrl = NetworkConfig.getSavedBaseUrl(applicationContext)

        val startDestination: String
        if (savedUrl != null) {
            // Known server: rebind Retrofit immediately so screens never hit a null apiService
            NetworkConfig.initialize(applicationContext)
            // Register both periodic background workers before the first frame paints
            scheduleAcademicSync()
            scheduleBiometricSync()
            startDestination = Screen.RoleSelect.route
        } else {
            startDestination = Screen.Pairing.route
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
            .setInitialDelay(2, TimeUnit.MINUTES)          // don't hit server before user lands
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
