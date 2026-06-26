package com.eduadmin.pro.data.remote

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

// ── Token store ────────────────────────────────────────────────────────────
// Holds the Supabase access token. Set by MainActivity on warm start (existing
// session) or by LoginScreen after a successful signInWith(Email) call.
// WorkManager sync workers read this to attach the Bearer header.
object TokenStore {
    @Volatile var jwt: String = ""
}

// ── OkHttp interceptor: Supabase auth headers ─────────────────────────────
// Every request must carry:
//   apikey        — the project's anon key (identifies the project)
//   Authorization — the user's bearer token (identifies the user within RLS)
private val authInterceptor = Interceptor { chain ->
    val token = TokenStore.jwt
    val request = chain.request().newBuilder()
        .header("apikey", SupabaseClientProvider.ANON_KEY)
        .header("X-EduAdmin-Client", "android")
        .apply { if (token.isNotBlank()) header("Authorization", "Bearer $token") }
        .build()
    chain.proceed(request)
}

private val loggingInterceptor = HttpLoggingInterceptor().apply {
    level = HttpLoggingInterceptor.Level.BODY
}

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
// Points Retrofit at the Supabase PostgREST endpoint. Replaces the old
// dynamic pairing flow — the base URL is now constant, derived from the
// production Supabase project URL in SupabaseClientProvider.
//
// TODO: Migrate EduAdminApiService endpoints from the legacy /api/v1/...
// paths to Supabase REST paths (e.g. GET /rest/v1/students?select=*).
// Until that migration is complete, endpoints that require Supabase-specific
// data should use SupabaseClientProvider.client.postgrest[...] directly.
object NetworkConfig {

    @Volatile
    var apiService: EduAdminApiService? = null
        private set

    // Call once after a successful Supabase sign-in (TokenStore.jwt must be
    // populated before calling this so the auth interceptor has a token).
    fun initialize() {
        val baseUrl = "${SupabaseClientProvider.SUPABASE_URL}/rest/v1/"
        apiService = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(buildLiveClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(EduAdminApiService::class.java)
    }

    // Sign-out: discard the in-memory token and Retrofit instance.
    // Call SupabaseClientProvider.client.auth.signOut() (suspend) alongside this.
    fun clear() {
        apiService = null
        TokenStore.jwt = ""
    }
}

// ── Convenience accessor ───────────────────────────────────────────────────
val apiService: EduAdminApiService
    get() = NetworkConfig.apiService
        ?: error("NetworkConfig not initialized — call NetworkConfig.initialize() after sign-in")

val retrofit: Retrofit
    get() = error("Use NetworkConfig.apiService instead of the bare retrofit instance")
