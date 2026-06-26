package com.eduadmin.pro.data.remote

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

// ── Token store ────────────────────────────────────────────────────────────
// JWT placeholder. Phase 2 replaces the bare String with EncryptedSharedPreferences.

object TokenStore {
    var jwt: String = ""
}

// ── Auth + client-identity interceptor ────────────────────────────────────

private val authInterceptor = Interceptor { chain ->
    val original = chain.request()
    val token = TokenStore.jwt
    val request = if (token.isNotBlank()) {
        original.newBuilder()
            .header("Authorization", "Bearer $token")
            .header("X-EduAdmin-Client", "android")
            .build()
    } else {
        original.newBuilder()
            .header("X-EduAdmin-Client", "android")
            .build()
    }
    chain.proceed(request)
}

// ── Logging interceptor (stripped from release builds by ProGuard) ─────────

private val loggingInterceptor = HttpLoggingInterceptor().apply {
    level = HttpLoggingInterceptor.Level.BODY
}

// ── Two OkHttpClient variants ──────────────────────────────────────────────
//
// pairingClient: short 5s connect timeout so the pairing screen fails fast
//                when the IP is wrong, retryOnConnectionFailure = false so
//                we surface the error immediately instead of hanging.
//
// liveClient:    generous timeouts for slow school LAN; auto-retry enabled.

private fun buildPairingClient(): OkHttpClient =
    OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .retryOnConnectionFailure(false)
        .build()

private fun buildLiveClient(): OkHttpClient =
    OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .retryOnConnectionFailure(true)
        .build()

// ── NetworkConfig singleton ────────────────────────────────────────────────
//
// Replaces the two top-level `val retrofit` and `val apiService` that used a
// fixed BASE_URL. The pairing screen calls initialize() with the chosen URL;
// every other screen accesses apiService through this object.

object NetworkConfig {

    // Exposed to the rest of the app. Null until initialize() is called.
    @Volatile
    var apiService: EduAdminApiService? = null
        private set

    // Builds a one-shot service with a short timeout, used only by the pairing check.
    fun buildPairingService(baseUrl: String): EduAdminApiService =
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(buildPairingClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(EduAdminApiService::class.java)

    // Wires the live Retrofit client to the saved (or supplied) URL.
    fun initialize(context: Context, customUrl: String? = null) {
        val url = customUrl ?: getSavedBaseUrl(context) ?: return
        apiService = Retrofit.Builder()
            .baseUrl(url)
            .client(buildLiveClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(EduAdminApiService::class.java)
    }

    // ── EncryptedSharedPreferences helpers ────────────────────────────────

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        "eduadmin_secure_prefs",
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveBaseUrl(context: Context, url: String) {
        prefs(context).edit().putString("server_base_url", url).apply()
        initialize(context, url)           // rebind immediately after save
    }

    fun getSavedBaseUrl(context: Context): String? =
        prefs(context).getString("server_base_url", null)

    fun clearSavedUrl(context: Context) {
        prefs(context).edit().remove("server_base_url").apply()
        apiService = null
    }
}

// ── Convenience accessor ───────────────────────────────────────────────────
// Legacy call sites (SyncRepository, SyncWorker) used the bare `apiService` val.
// This shim keeps them compiling without edits during the migration.

val apiService: EduAdminApiService
    get() = NetworkConfig.apiService
        ?: error("NetworkConfig not initialized — call NetworkConfig.initialize() at app startup")

// Kept for SyncWorker which still imports `retrofit` directly; remove once Phase 2 is complete.
val retrofit: Retrofit get() = error("Use NetworkConfig.apiService instead of retrofit directly")
