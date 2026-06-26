package com.eduadmin.pro.ui.onboarding

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.eduadmin.pro.data.remote.NetworkConfig
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// PAIRING STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

sealed class PairingState {
    object Idle                           : PairingState()
    object Checking                       : PairingState()
    object Success                        : PairingState()
    data class Failed(val reason: String) : PairingState()
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun ServerPairingScreen(
    onPairingSuccess: () -> Unit,
    onSkip: (() -> Unit)? = null         // null → no skip button shown
) {
    val context      = LocalContext.current
    val focusManager = LocalFocusManager.current
    val scope        = rememberCoroutineScope()

    // Pre-fill fields from any previously saved URL
    val savedUrl = remember { NetworkConfig.getSavedBaseUrl(context) }
    var ipAddress by remember {
        val ip = savedUrl?.removePrefix("http://")?.substringBefore(":") ?: ""
        mutableStateOf(ip)
    }
    var port by remember {
        val p = savedUrl?.substringAfterLast(":")?.trimEnd('/') ?: "3000"
        mutableStateOf(p)
    }
    var pairingState by remember { mutableStateOf<PairingState>(PairingState.Idle) }

    val accentColor = when (pairingState) {
        is PairingState.Success -> Color(0xFF16A34A)
        is PairingState.Failed  -> Color(0xFFDC2626)
        else                    -> Color(0xFF2563EB)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            // ── App identity strip ────────────────────────────────────────
            Text(
                "EduAdmin",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF1E3A5F),
                letterSpacing = 1.5.sp
            )
            Spacer(Modifier.height(24.dp))

            // ── Animated state icon ───────────────────────────────────────
            StateIcon(pairingState)

            Spacer(Modifier.height(20.dp))
            Text(
                text = when (pairingState) {
                    is PairingState.Success -> "Server paired"
                    is PairingState.Failed  -> "Connection failed"
                    PairingState.Checking   -> "Connecting…"
                    else                    -> "Pair with School Server"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF0F172A)
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Enter the local network IP of the PC running EduAdmin Pro. Both devices must be on the same Wi-Fi.",
                fontSize = 12.sp,
                color = Color(0xFF64748B),
                textAlign = TextAlign.Center,
                lineHeight = 17.sp
            )

            Spacer(Modifier.height(28.dp))

            // ── Input card ────────────────────────────────────────────────
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                shadowElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    OutlinedTextField(
                        value = ipAddress,
                        onValueChange = {
                            ipAddress = it.filter { c -> c.isDigit() || c == '.' }
                            if (pairingState !is PairingState.Idle) pairingState = PairingState.Idle
                        },
                        label = { Text("PC IP Address", fontSize = 12.sp) },
                        placeholder = { Text("e.g.  192.168.1.10", fontSize = 12.sp, color = Color(0xFFCBD5E1)) },
                        leadingIcon = { Icon(Icons.Outlined.Computer, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Decimal,
                            imeAction    = ImeAction.Next
                        ),
                        isError = pairingState is PairingState.Failed,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF2563EB),
                            focusedLabelColor  = Color(0xFF2563EB)
                        )
                    )

                    OutlinedTextField(
                        value = port,
                        onValueChange = {
                            port = it.filter { c -> c.isDigit() }
                            if (pairingState !is PairingState.Idle) pairingState = PairingState.Idle
                        },
                        label = { Text("Port", fontSize = 12.sp) },
                        placeholder = { Text("3000", fontSize = 12.sp, color = Color(0xFFCBD5E1)) },
                        leadingIcon = { Icon(Icons.Outlined.Router, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction    = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                        isError = pairingState is PairingState.Failed,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF2563EB),
                            focusedLabelColor  = Color(0xFF2563EB)
                        )
                    )
                }
            }

            // ── Error banner ──────────────────────────────────────────────
            AnimatedVisibility(
                visible = pairingState is PairingState.Failed,
                enter   = expandVertically() + fadeIn(),
                exit    = shrinkVertically() + fadeOut()
            ) {
                val msg = (pairingState as? PairingState.Failed)?.reason ?: ""
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFEF2F2)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.ErrorOutline, null, tint = Color(0xFFDC2626), modifier = Modifier.size(16.dp))
                        Text(msg, fontSize = 11.sp, color = Color(0xFFB91C1C), fontWeight = FontWeight.Medium, lineHeight = 15.sp)
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // ── Pair button ───────────────────────────────────────────────
            Button(
                onClick = {
                    focusManager.clearFocus()
                    val url = buildUrl(ipAddress.trim(), port.trim())
                    scope.launch {
                        pairingState = PairingState.Checking
                        pairingState = attemptPairing(context, url)
                        if (pairingState is PairingState.Success) {
                            kotlinx.coroutines.delay(600)   // let the user see the green tick
                            onPairingSuccess()
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = ipAddress.isNotBlank() && port.isNotBlank() && pairingState !is PairingState.Checking,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A5F))
            ) {
                AnimatedContent(
                    targetState = pairingState,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "pairBtn"
                ) { state ->
                    when (state) {
                        PairingState.Checking ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                                Text("Connecting…", fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        PairingState.Success  ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Outlined.CheckCircle, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                Text("Paired", fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        else ->
                            Text("Connect to School Server", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }

            // ── Skip option ───────────────────────────────────────────────
            if (onSkip != null) {
                Spacer(Modifier.height(12.dp))
                TextButton(onClick = onSkip) {
                    Text("Skip for now", fontSize = 12.sp, color = Color(0xFF94A3B8))
                }
            }

            Spacer(Modifier.height(20.dp))

            // ── Help tip ──────────────────────────────────────────────────
            HelpTipCard()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAIRING LOGIC
// ─────────────────────────────────────────────────────────────────────────────

private fun buildUrl(ip: String, port: String): String {
    val p = if (port.isBlank()) "3000" else port
    return "http://$ip:$p/"
}

private suspend fun attemptPairing(context: Context, url: String): PairingState {
    return try {
        val service  = NetworkConfig.buildPairingService(url)
        val response = service.performServerHandshake()
        val body     = response.body()

        if (response.isSuccessful && body?.get("success") == "true" && body["app"] == "EduAdmin") {
            NetworkConfig.saveBaseUrl(context, url)
            PairingState.Success
        } else {
            PairingState.Failed("Server responded but is not EduAdmin Pro. Check you have the right IP.")
        }
    } catch (e: java.net.ConnectException) {
        PairingState.Failed("Cannot reach $url — make sure the PC is on and EduAdmin is running.")
    } catch (e: java.net.SocketTimeoutException) {
        PairingState.Failed("Connection timed out. Check that both devices are on the same Wi-Fi.")
    } catch (e: Exception) {
        PairingState.Failed(e.message ?: "Unknown error. Verify the IP and port.")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED STATE ICON
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StateIcon(state: PairingState) {
    val (icon, bg, tint) = when (state) {
        is PairingState.Success -> Triple(Icons.Outlined.CheckCircle, Color(0xFFDCFCE7), Color(0xFF16A34A))
        is PairingState.Failed  -> Triple(Icons.Outlined.LinkOff,     Color(0xFFFEE2E2), Color(0xFFDC2626))
        PairingState.Checking   -> Triple(Icons.Outlined.Sync,        Color(0xFFEFF6FF), Color(0xFF2563EB))
        else                    -> Triple(Icons.Outlined.Dns,         Color(0xFFEFF6FF), Color(0xFF1E3A5F))
    }

    val rotation by rememberInfiniteTransition(label = "spin").animateFloat(
        initialValue = 0f,
        targetValue  = if (state == PairingState.Checking) 360f else 0f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "iconRot"
    )

    Box(
        modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(bg),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector  = icon,
            contentDescription = null,
            tint         = tint,
            modifier     = Modifier
                .size(34.dp)
                .then(if (state == PairingState.Checking) Modifier.graphicsLayer { rotationZ = rotation } else Modifier)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELP TIP
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun HelpTipCard() {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFFF0F9FF),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(Icons.Outlined.Info, null, tint = Color(0xFF0E7490), modifier = Modifier.size(16.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Finding your PC IP", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0E7490))
                Text(
                    "On the school PC, open Command Prompt and type ipconfig. Look for IPv4 Address under your Wi-Fi adapter.",
                    fontSize = 10.sp,
                    color = Color(0xFF0E7490).copy(alpha = 0.80f),
                    lineHeight = 14.sp
                )
            }
        }
    }
}
