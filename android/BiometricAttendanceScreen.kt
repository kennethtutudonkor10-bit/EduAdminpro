package com.eduadmin.pro.ui.teacher

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.*
import android.os.Build
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eduadmin.pro.data.biometric.BiometricRepository
import com.eduadmin.pro.data.biometric.PendingBiometricAttendanceEntity
import com.eduadmin.pro.data.biometric.StudentBiometricEntity
import com.eduadmin.pro.ui.common.shimmerBrush
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

private const val USB_PERMISSION_ACTION = "com.eduadmin.pro.USB_PERMISSION"
private val ISO_FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME

// ─────────────────────────────────────────────────────────────────────────────
// SCAN STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

sealed class ScanEvent {
    object Idle                                          : ScanEvent()
    object WaitingForFinger                              : ScanEvent()
    data class Matched(val student: StudentBiometricEntity, val alreadyCheckedIn: Boolean) : ScanEvent()
    data class Unregistered(val hash: String)            : ScanEvent()
    data class UsbError(val reason: String)              : ScanEvent()
}

data class CheckInLogEntry(
    val studentName: String,
    val classId: String,
    val time: String,
    val duplicate: Boolean
)

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class BiometricAttendanceViewModel(
    private val repository: BiometricRepository,
    val classId: String,
    val termId: String
) : ViewModel() {

    private val _scanEvent = MutableStateFlow<ScanEvent>(ScanEvent.Idle)
    val scanEvent: StateFlow<ScanEvent> = _scanEvent.asStateFlow()

    private val _log = MutableStateFlow<List<CheckInLogEntry>>(emptyList())
    val log: StateFlow<List<CheckInLogEntry>> = _log.asStateFlow()

    private val _usbConnected = MutableStateFlow(false)
    val usbConnected: StateFlow<Boolean> = _usbConnected.asStateFlow()

    val enrollments = repository.observeEnrollments()

    // Counts for the KPI bar
    val presentCount get() = _log.value.count { !it.duplicate }
    val duplicateCount get() = _log.value.count { it.duplicate }

    // ── USB device lifecycle ──────────────────────────────────────────────────

    private var usbConnection: UsbDeviceConnection? = null
    private var usbEndpointIn: UsbEndpoint? = null
    private var readJob: Job? = null

    fun onDeviceAttached(manager: UsbManager, device: UsbDevice) {
        if (!manager.hasPermission(device)) return
        val iface = device.getInterface(0)
        for (i in 0 until iface.endpointCount) {
            val ep = iface.getEndpoint(i)
            if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                ep.direction == UsbConstants.USB_DIR_IN
            ) {
                usbEndpointIn = ep
                break
            }
        }
        val conn = manager.openDevice(device) ?: return
        conn.claimInterface(iface, true)
        usbConnection = conn
        _usbConnected.value = true
        _scanEvent.value = ScanEvent.WaitingForFinger
        startReading()
    }

    fun onDeviceDetached() {
        readJob?.cancel()
        usbConnection?.close()
        usbConnection = null
        usbEndpointIn = null
        _usbConnected.value = false
        _scanEvent.value = ScanEvent.UsbError("USB scanner disconnected. Reconnect via OTG adapter.")
    }

    private fun startReading() {
        val conn     = usbConnection ?: return
        val endpoint = usbEndpointIn ?: return

        readJob = viewModelScope.launch(Dispatchers.IO) {
            val buffer = ByteArray(endpoint.maxPacketSize)
            while (isActive) {
                val transferred = conn.bulkTransfer(endpoint, buffer, buffer.size, 2000)
                if (transferred > 0) {
                    val raw  = buffer.copyOf(transferred)
                    val hash = repository.hashBytes(raw)
                    withContext(Dispatchers.Main) { processHash(hash) }
                }
            }
        }
    }

    // ── Scan processing ───────────────────────────────────────────────────────

    private fun processHash(hash: String) {
        viewModelScope.launch {
            val match = repository.verifyHash(hash)
            if (match == null) {
                _scanEvent.value = ScanEvent.Unregistered(hash.take(12) + "…")
                resetToWaiting()
                return@launch
            }

            val ts       = LocalDateTime.now().format(ISO_FMT)
            val recorded = repository.recordAttendance(match, termId, ts)

            _scanEvent.value = ScanEvent.Matched(match, alreadyCheckedIn = !recorded)

            if (recorded) {
                _log.value = listOf(
                    CheckInLogEntry(
                        studentName = match.studentName,
                        classId     = match.classId,
                        time        = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")),
                        duplicate   = false
                    )
                ) + _log.value
            } else {
                _log.value = listOf(
                    CheckInLogEntry(match.studentName, match.classId,
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")), duplicate = true)
                ) + _log.value
            }

            resetToWaiting()
        }
    }

    private fun resetToWaiting() {
        viewModelScope.launch {
            delay(2_500)
            _scanEvent.value = ScanEvent.WaitingForFinger
        }
    }

    override fun onCleared() {
        super.onCleared()
        readJob?.cancel()
        usbConnection?.close()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BiometricAttendanceScreen(
    viewModel: BiometricAttendanceViewModel,
    onNavigateBack: () -> Unit
) {
    val context     = LocalContext.current
    val scanEvent   by viewModel.scanEvent.collectAsState()
    val log         by viewModel.log.collectAsState()
    val usbOk       by viewModel.usbConnected.collectAsState()

    // USB broadcast receiver — must be registered/unregistered with the screen lifecycle
    DisposableEffect(Unit) {
        val manager = context.getSystemService(Context.USB_SERVICE) as UsbManager

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                }
                when (intent.action) {
                    USB_PERMISSION_ACTION -> {
                        if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false) && device != null) {
                            viewModel.onDeviceAttached(manager, device)
                        }
                    }
                    UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                        if (device != null) {
                            if (manager.hasPermission(device)) {
                                viewModel.onDeviceAttached(manager, device)
                            } else {
                                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                                    PendingIntent.FLAG_MUTABLE else 0
                                val pi = PendingIntent.getBroadcast(ctx, 0, Intent(USB_PERMISSION_ACTION), flags)
                                manager.requestPermission(device, pi)
                            }
                        }
                    }
                    UsbManager.ACTION_USB_DEVICE_DETACHED -> viewModel.onDeviceDetached()
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(USB_PERMISSION_ACTION)
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }

        // Check if scanner is already plugged in at screen entry
        manager.deviceList.values.firstOrNull()?.let { device ->
            if (manager.hasPermission(device)) {
                viewModel.onDeviceAttached(manager, device)
            } else {
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
                val pi = PendingIntent.getBroadcast(context, 0, Intent(USB_PERMISSION_ACTION), flags)
                manager.requestPermission(device, pi)
            }
        }

        onDispose { context.unregisterReceiver(receiver) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Biometric Register", fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text(
                            "${viewModel.classId}  •  ${viewModel.termId}",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.75f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, null, tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor    = Color(0xFF0F172A),
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(Color(0xFFF1F5F9))
        ) {
            // ── USB status banner ─────────────────────────────────────────
            UsbStatusBanner(usbOk)

            // ── KPI strip ─────────────────────────────────────────────────
            BiometricKpiBar(
                present   = viewModel.presentCount,
                duplicate = viewModel.duplicateCount,
                total     = log.size
            )

            // ── Scan pad ──────────────────────────────────────────────────
            ScanPad(scanEvent, modifier = Modifier.padding(16.dp))

            // ── Live check-in log ─────────────────────────────────────────
            Text(
                "Today's Log",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF64748B),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
            if (log.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No scans recorded yet", color = Color(0xFFCBD5E1), fontSize = 12.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(log, key = { "${it.studentName}${it.time}" }) { entry ->
                        LogRow(entry)
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// USB STATUS BANNER
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun UsbStatusBanner(connected: Boolean) {
    Surface(
        modifier  = Modifier.fillMaxWidth(),
        color     = if (connected) Color(0xFF16A34A) else Color(0xFF64748B)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                if (connected) Icons.Outlined.Usb else Icons.Outlined.UsbOff,
                null,
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
            Text(
                if (connected) "USB scanner connected — ready to scan"
                else           "No scanner detected — connect via OTG adapter",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI BAR
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun BiometricKpiBar(present: Int, duplicate: Int, total: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        KpiCell("$present",   "Checked In",  Color(0xFF16A34A))
        KpiCell("$duplicate", "Duplicates",  Color(0xFFD97706))
        KpiCell("$total",     "Total Scans", Color(0xFF2563EB))
    }
    HorizontalDivider(color = Color(0xFFF1F5F9))
}

@Composable
private fun KpiCell(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = color)
        Text(label, fontSize = 9.sp,  fontWeight = FontWeight.Bold,  color = Color(0xFF94A3B8))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN PAD — the main feedback area
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ScanPad(event: ScanEvent, modifier: Modifier = Modifier) {
    Surface(
        modifier      = modifier.fillMaxWidth(),
        shape         = RoundedCornerShape(20.dp),
        color         = Color.White,
        shadowElevation = 3.dp
    ) {
        AnimatedContent(
            targetState = event,
            transitionSpec = {
                fadeIn(tween(250)) togetherWith fadeOut(tween(200))
            },
            label = "scanPad"
        ) { state ->
            when (state) {
                ScanEvent.Idle              -> ScanPadIdle()
                ScanEvent.WaitingForFinger  -> ScanPadWaiting()
                is ScanEvent.Matched        -> ScanPadMatched(state)
                is ScanEvent.Unregistered   -> ScanPadUnregistered(state.hash)
                is ScanEvent.UsbError       -> ScanPadError(state.reason)
            }
        }
    }
}

@Composable
private fun ScanPadIdle() {
    Column(
        modifier = Modifier.padding(32.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Outlined.Usb, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(40.dp))
        Text("Connect USB fingerprint scanner", color = Color(0xFF94A3B8), fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ScanPadWaiting() {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.6f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "alpha"
    )
    Column(
        modifier = Modifier.padding(32.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(Color(0xFF1E3A5F).copy(alpha = pulse)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.Fingerprint, null, tint = Color.White, modifier = Modifier.size(38.dp))
        }
        Text("Place finger on scanner", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E3A5F))
        Text("Awaiting biometric input…", fontSize = 11.sp, color = Color(0xFF94A3B8))
    }
}

@Composable
private fun ScanPadMatched(event: ScanEvent.Matched) {
    val bg    = if (event.alreadyCheckedIn) Color(0xFFFFFBEB) else Color(0xFFF0FFF4)
    val tint  = if (event.alreadyCheckedIn) Color(0xFFD97706) else Color(0xFF16A34A)
    val icon  = if (event.alreadyCheckedIn) Icons.Outlined.Warning else Icons.Outlined.CheckCircle
    val label = if (event.alreadyCheckedIn) "Already checked in today" else "Check-in confirmed"

    Column(
        modifier = Modifier.fillMaxWidth().background(bg, RoundedCornerShape(20.dp)).padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(48.dp))
        Text(event.student.studentName, fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFF0F172A))
        Text("Class ${event.student.classId}", fontSize = 12.sp, color = Color(0xFF64748B))
        Surface(shape = RoundedCornerShape(8.dp), color = tint.copy(alpha = 0.12f)) {
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = tint,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
        }
    }
}

@Composable
private fun ScanPadUnregistered(hashPreview: String) {
    Column(
        modifier = Modifier.fillMaxWidth().background(Color(0xFFFFF5F5), RoundedCornerShape(20.dp)).padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Outlined.PersonOff, null, tint = Color(0xFFDC2626), modifier = Modifier.size(44.dp))
        Text("Not enrolled", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color(0xFF0F172A))
        Text("Hash: $hashPreview", fontSize = 10.sp, color = Color(0xFF94A3B8), fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
        Text("This finger has no student profile. Enroll first.", fontSize = 11.sp, color = Color(0xFFDC2626), textAlign = TextAlign.Center)
    }
}

@Composable
private fun ScanPadError(reason: String) {
    Column(
        modifier = Modifier.fillMaxWidth().background(Color(0xFFFFF5F5), RoundedCornerShape(20.dp)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(Icons.Outlined.UsbOff, null, tint = Color(0xFFDC2626), modifier = Modifier.size(36.dp))
        Text("Scanner error", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFF0F172A))
        Text(reason, fontSize = 11.sp, color = Color(0xFF94A3B8), textAlign = TextAlign.Center, lineHeight = 15.sp)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN LOG ROW
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LogRow(entry: CheckInLogEntry) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = if (entry.duplicate) Color(0xFFFFFBEB) else Color.White,
        shadowElevation = 0.5.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    if (entry.duplicate) Icons.Outlined.Warning else Icons.Outlined.Fingerprint,
                    null,
                    tint = if (entry.duplicate) Color(0xFFD97706) else Color(0xFF16A34A),
                    modifier = Modifier.size(16.dp)
                )
                Column {
                    Text(entry.studentName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                    Text("Class ${entry.classId}", fontSize = 10.sp, color = Color(0xFF94A3B8))
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(entry.time, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E3A5F))
                if (entry.duplicate) {
                    Text("duplicate", fontSize = 9.sp, color = Color(0xFFD97706), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
