package com.eduadmin.pro.data.remote

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

// ── Optional shared key ──────────────────────────────────────────────────────
// EduAdmin Pro is free and offline-first: the mobile app pairs with the desktop
// Express server over the school LAN. The desktop server currently accepts
// unauthenticated LAN calls, so this is blank by default. If/when the server adds
// the documented X-EduAdmin-Key middleware, set this after pairing and every
// request will carry it.
object TokenStore {
    @Volatile var apiKey: String = ""
}

// ── NetworkConfig ────────────────────────────────────────────────────────────
// Points Retrofit at the desktop server the user paired with on the
// ServerPairingScreen. The base URL (http://<pc-ip>:<port>/) is persisted in
// EncryptedSharedPreferences so it survives restarts. No cloud, no accounts.
object NetworkConfig {

    private const val PREFS        = "eduadmin_network"
    private const val KEY_BASE_URL = "base_url"

    @Volatile
    var apiService: EduAdminApiService? = null
        private set

    @Volatile
    private var baseUrl: String? = null

    private fun prefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREFS,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun normalize(url: String): String = if (url.endsWith("/")) url else "$url/"

    /** The saved paired-server base URL, or null if the device has never paired. */
    fun getSavedBaseUrl(context: Context): String? =
        baseUrl ?: prefs(context).getString(KEY_BASE_URL, null)?.also { baseUrl = it }

    /** Persists the paired URL and (re)builds the live Retrofit service. */
    fun saveBaseUrl(context: Context, url: String) {
        val normalized = normalize(url)
        prefs(context).edit().putString(KEY_BASE_URL, normalized).apply()
        baseUrl = normalized
        apiService = buildService(normalized)
    }

    /** Warm-start: rebuild the service from the saved URL. No-op if never paired. */
    fun initialize(context: Context) {
        val url = getSavedBaseUrl(context) ?: return
        apiService = buildService(url)
    }

    /** Forget the paired server (used by "Repair connection"). */
    fun clear(context: Context) {
        prefs(context).edit().remove(KEY_BASE_URL).apply()
        baseUrl = null
        apiService = null
    }

    /**
     * Builds a throwaway service pointed at [url] for the pairing handshake,
     * before the URL is committed. The ServerPairingScreen calls
     * performServerHandshake() on this to confirm it's really an EduAdmin server.
     */
    fun buildPairingService(url: String): EduAdminApiService = buildService(normalize(url))

    private fun buildService(url: String): EduAdminApiService =
        Retrofit.Builder()
            .baseUrl(url)
            .client(buildClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(EduAdminApiService::class.java)

    private fun buildClient(): OkHttpClient {
        val authInterceptor = Interceptor { chain ->
            val builder = chain.request().newBuilder()
                .header("X-EduAdmin-Client", "android")
            if (TokenStore.apiKey.isNotBlank()) {
                builder.header("X-EduAdmin-Key", TokenStore.apiKey)
            }
            chain.proceed(builder.build())
        }
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .retryOnConnectionFailure(true)
            .build()
    }
}

// ── Convenience accessor ─────────────────────────────────────────────────────
val apiService: EduAdminApiService
    get() = NetworkConfig.apiService
        ?: error("NetworkConfig not initialized — pair with a server first")
