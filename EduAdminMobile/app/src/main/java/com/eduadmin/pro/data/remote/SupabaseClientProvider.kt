package com.eduadmin.pro.data.remote

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

/**
 * Singleton that owns the Supabase client for the entire app lifetime.
 *
 * Replace SUPABASE_URL and ANON_KEY with values from:
 *   Supabase Dashboard → Settings → API → Project URL & anon public key
 *
 * The `client` is created lazily on first access, so no Context is needed.
 */
object SupabaseClientProvider {

    const val SUPABASE_URL = "https://jysprabkzxqetxwbnzys.supabase.co"
    const val ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5c3ByYWJrenhxZXR4d2JuenlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjYzNDEsImV4cCI6MjA5NTA0MjM0MX0.BXreufrWLYOg_oGnUVxG7FIR6K9Yjkrz7cEDsrCGLNI"

    val client: SupabaseClient by lazy {
        createSupabaseClient(SUPABASE_URL, ANON_KEY) {
            install(Auth)
            install(Postgrest)
            install(Storage)
        }
    }
}
