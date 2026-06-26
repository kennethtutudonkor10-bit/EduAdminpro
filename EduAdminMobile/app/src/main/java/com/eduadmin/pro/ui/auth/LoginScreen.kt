package com.eduadmin.pro.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.eduadmin.pro.data.remote.NetworkConfig
import com.eduadmin.pro.data.remote.SupabaseClientProvider
import com.eduadmin.pro.data.remote.TokenStore
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Central authentication screen backed by Supabase email/password sign-in.
 *
 * After a successful sign-in the callback receives the user's role string
 * ("ADMIN", "TEACHER", or "PARENT") so the caller can navigate to the correct
 * dashboard without an extra network round-trip.
 *
 * The role is read from the user's `user_metadata.role` field, which is
 * populated by the handle_new_user trigger (see supabase_migration.sql) from
 * the `raw_user_meta_data` supplied when the admin created the account.
 */
@Composable
fun LoginScreen(onLoginSuccess: (role: String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    fun doLogin() {
        if (email.isBlank() || password.isBlank()) {
            errorMessage = "Email and password are required."
            return
        }
        isLoading = true
        errorMessage = null
        scope.launch {
            try {
                SupabaseClientProvider.client.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }
                val sessionStatus = SupabaseClientProvider.client.auth.sessionStatus.value
                val session = (sessionStatus as? SessionStatus.Authenticated)?.session
                val role = session?.user?.userMetadata
                    ?.get("role")?.jsonPrimitive?.contentOrNull
                    ?: "TEACHER"
                TokenStore.jwt = session?.accessToken ?: ""
                NetworkConfig.initialize()
                onLoginSuccess(role)
            } catch (e: Exception) {
                // Supabase exception messages contain HTTP status + detail; show the detail only
                errorMessage = e.message
                    ?.substringAfterLast(":")
                    ?.trim()
                    ?.ifBlank { "Sign-in failed. Check your credentials." }
                    ?: "Sign-in failed. Check your credentials."
            } finally {
                isLoading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "EduAdmin Pro",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Sign in to your school account",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(40.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; errorMessage = null },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it; errorMessage = null },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = if (passwordVisible) VisualTransformation.None
                                   else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Filled.Visibility
                                      else Icons.Filled.VisibilityOff,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password"
                    )
                }
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = { focusManager.clearFocus(); doLogin() }
            ),
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
        }

        Spacer(modifier = Modifier.height(28.dp))

        Button(
            onClick = { focusManager.clearFocus(); doLogin() },
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("Sign In")
            }
        }
    }
}
