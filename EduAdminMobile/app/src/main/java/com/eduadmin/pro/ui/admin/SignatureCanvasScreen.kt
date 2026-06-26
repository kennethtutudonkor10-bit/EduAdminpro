package com.eduadmin.pro.ui.admin

import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Paint
import android.graphics.Path as AndroidPath
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eduadmin.pro.data.repository.SyncRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

/** One continuous stroke: a sequence of points drawn without lifting the stylus/finger. */
data class SignaturePath(val points: List<Offset>)

sealed class UploadResult {
    object Idle                   : UploadResult()
    object Uploading              : UploadResult()
    object Success                : UploadResult()
    data class Failure(val msg: String) : UploadResult()
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class SignatureViewModel(
    private val repository: SyncRepository,
    val adminId: String
) : ViewModel() {

    private val _paths = MutableStateFlow<List<SignaturePath>>(emptyList())
    val paths: StateFlow<List<SignaturePath>> = _paths.asStateFlow()

    // Track the currently-being-drawn stroke separately so it recomposes smoothly
    private val _activePath = MutableStateFlow<List<Offset>>(emptyList())
    val activePath: StateFlow<List<Offset>> = _activePath.asStateFlow()

    private val _result = MutableStateFlow<UploadResult>(UploadResult.Idle)
    val result: StateFlow<UploadResult> = _result.asStateFlow()

    val hasStrokes get() = _paths.value.isNotEmpty() || _activePath.value.isNotEmpty()

    fun startStroke(point: Offset) {
        _activePath.value = listOf(point)
    }

    fun continueStroke(point: Offset) {
        _activePath.value = _activePath.value + point
    }

    fun endStroke() {
        if (_activePath.value.size > 1) {
            _paths.value = _paths.value + SignaturePath(_activePath.value)
        }
        _activePath.value = emptyList()
    }

    fun clear() {
        _paths.value = emptyList()
        _activePath.value = emptyList()
        _result.value = UploadResult.Idle
    }

    fun upload(canvasWidthPx: Int, canvasHeightPx: Int) {
        viewModelScope.launch {
            _result.value = UploadResult.Uploading
            val bitmap = renderToBitmap(canvasWidthPx, canvasHeightPx)
            repository.uploadSignature(bitmap, adminId)
                .onSuccess { _result.value = UploadResult.Success }
                .onFailure { _result.value = UploadResult.Failure(it.message ?: "Upload failed") }
        }
    }

    /**
     * Rasterises all recorded strokes into a transparent-background PNG Bitmap
     * at the exact canvas dimensions. The PC server stamps this onto PDF reports.
     */
    private fun renderToBitmap(width: Int, height: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = AndroidCanvas(bitmap)
        val paint = Paint().apply {
            color       = android.graphics.Color.BLACK
            strokeWidth = 8f
            style       = Paint.Style.STROKE
            strokeCap   = Paint.Cap.ROUND
            strokeJoin  = Paint.Join.ROUND
            isAntiAlias = true
        }
        _paths.value.forEach { sig ->
            if (sig.points.size < 2) return@forEach
            val path = AndroidPath()
            path.moveTo(sig.points.first().x, sig.points.first().y)
            sig.points.drop(1).forEach { path.lineTo(it.x, it.y) }
            canvas.drawPath(path, paint)
        }
        return bitmap
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignatureCanvasScreen(
    viewModel: SignatureViewModel,
    onNavigateBack: () -> Unit
) {
    val paths      by viewModel.paths.collectAsState()
    val activePath by viewModel.activePath.collectAsState()
    val result     by viewModel.result.collectAsState()
    val snackbar   = remember { SnackbarHostState() }

    // Canvas pixel dimensions — captured once the layout is measured
    var canvasWidthPx  by remember { mutableIntStateOf(0) }
    var canvasHeightPx by remember { mutableIntStateOf(0) }

    LaunchedEffect(result) {
        when (val r = result) {
            is UploadResult.Success     -> snackbar.showSnackbar("Signature uploaded. Reports will use your seal.")
            is UploadResult.Failure     -> snackbar.showSnackbar("Upload failed: ${r.msg}")
            else -> Unit
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Administrator Seal", fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text("Draw your official signature", fontSize = 11.sp, color = Color.White.copy(alpha = 0.75f))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, null, tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E3A5F),
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
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            InstructionBanner()

            // ── Signature canvas surface ──────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(
                        width = 2.dp,
                        color = when (result) {
                            is UploadResult.Success -> Color(0xFF16A34A)
                            is UploadResult.Failure -> Color(0xFFDC2626)
                            else                    -> Color(0xFFCBD5E1)
                        },
                        shape = RoundedCornerShape(16.dp)
                    )
            ) {
                Canvas(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart  = { offset -> viewModel.startStroke(offset) },
                                onDrag       = { change, _ -> viewModel.continueStroke(change.position) },
                                onDragEnd    = { viewModel.endStroke() },
                                onDragCancel = { viewModel.endStroke() }
                            )
                        }
                ) {
                    canvasWidthPx  = size.width.toInt()
                    canvasHeightPx = size.height.toInt()

                    // Baseline guide — a subtle dotted line at 70% height
                    drawLine(
                        color = Color(0xFFE2E8F0),
                        start = Offset(32f, size.height * 0.70f),
                        end   = Offset(size.width - 32f, size.height * 0.70f),
                        strokeWidth = 1.5f,
                        pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(
                            floatArrayOf(12f, 8f)
                        )
                    )

                    // Committed strokes
                    val strokeStyle = Stroke(width = 8f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                    paths.forEach { sig ->
                        if (sig.points.size < 2) return@forEach
                        val composePath = androidx.compose.ui.graphics.Path().apply {
                            moveTo(sig.points.first().x, sig.points.first().y)
                            sig.points.drop(1).forEach { lineTo(it.x, it.y) }
                        }
                        drawPath(composePath, Color(0xFF0F172A), style = strokeStyle)
                    }

                    // Active (in-progress) stroke — drawn in a slightly lighter ink
                    if (activePath.size >= 2) {
                        val liveStroke = androidx.compose.ui.graphics.Path().apply {
                            moveTo(activePath.first().x, activePath.first().y)
                            activePath.drop(1).forEach { lineTo(it.x, it.y) }
                        }
                        drawPath(liveStroke, Color(0xFF1E3A5F), style = strokeStyle)
                    }
                }

                // Empty-canvas placeholder
                if (paths.isEmpty() && activePath.isEmpty()) {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Outlined.Draw,
                            null,
                            tint = Color(0xFFCBD5E1),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Sign here",
                            color = Color(0xFFCBD5E1),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Success overlay
                if (result is UploadResult.Success) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF16A34A).copy(alpha = 0.08f))
                            .clip(RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.TopEnd
                    ) {
                        Surface(
                            modifier = Modifier.padding(10.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF16A34A)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Icon(Icons.Outlined.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Uploaded", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
            }

            // ── Action bar ────────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.clear() },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFCBD5E1))
                    )
                ) {
                    Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Clear", fontWeight = FontWeight.Bold, color = Color(0xFF475569))
                }

                Button(
                    onClick = {
                        if (viewModel.hasStrokes) {
                            viewModel.upload(canvasWidthPx, canvasHeightPx)
                        }
                    },
                    modifier = Modifier
                        .weight(2f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A5F)),
                    enabled = viewModel.hasStrokes && result !is UploadResult.Uploading
                ) {
                    when (result) {
                        is UploadResult.Uploading -> {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Uploading seal…", fontWeight = FontWeight.Bold)
                        }
                        is UploadResult.Success -> {
                            Icon(Icons.Outlined.CloudDone, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Seal Active", fontWeight = FontWeight.Bold)
                        }
                        else -> {
                            Icon(Icons.Outlined.Upload, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Upload Signature", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Text(
                "Your signature is uploaded as a PNG to the PC server. It will be stamped on all official PDF reports.",
                fontSize = 10.sp,
                color = Color(0xFF94A3B8),
                fontWeight = FontWeight.Medium,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION BANNER
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun InstructionBanner() {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFFEFF6FF),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Outlined.Info, null, tint = Color(0xFF2563EB), modifier = Modifier.size(18.dp))
            Text(
                "Use your finger or stylus to draw your official signature. It will be stamped automatically on every report card PDF.",
                fontSize = 11.sp,
                color = Color(0xFF1E40AF),
                fontWeight = FontWeight.Medium,
                lineHeight = 15.sp
            )
        }
    }
}
