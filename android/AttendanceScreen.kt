package com.eduadmin.pro.ui.teacher

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.eduadmin.pro.data.repository.PendingAttendanceEntity
import com.eduadmin.pro.data.repository.StudentEntity
import com.eduadmin.pro.data.repository.SyncRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

enum class AttendanceStatus { PRESENT, ABSENT, LATE }

data class AttendanceRow(
    val student: StudentEntity,
    val status: AttendanceStatus = AttendanceStatus.PRESENT
)

private val DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE   // yyyy-MM-dd

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class AttendanceViewModel(
    private val repository: SyncRepository,
    val classId: String,
    val termId: String
) : ViewModel() {

    private val _date = MutableStateFlow(LocalDate.now().format(DATE_FMT))
    val date: StateFlow<String> = _date.asStateFlow()

    private val _rows = MutableStateFlow<List<AttendanceRow>>(emptyList())
    val rows: StateFlow<List<AttendanceRow>> = _rows.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saveEvent = MutableSharedFlow<String>()
    val saveEvent: SharedFlow<String> = _saveEvent.asSharedFlow()

    val presentCount  get() = _rows.value.count { it.status == AttendanceStatus.PRESENT }
    val absentCount   get() = _rows.value.count { it.status == AttendanceStatus.ABSENT }
    val lateCount     get() = _rows.value.count { it.status == AttendanceStatus.LATE }

    init {
        viewModelScope.launch {
            repository.observeStudents()
                .map { all -> all.filter { it.classId == classId && it.status == "Enrolled" } }
                .collect { students ->
                    // Preserve existing status when the list refreshes
                    val existing = _rows.value.associateBy { it.student.id }
                    _rows.value = students.map { s ->
                        existing[s.id] ?: AttendanceRow(s)
                    }
                }
        }
    }

    fun markStatus(studentId: String, status: AttendanceStatus) {
        _rows.value = _rows.value.map { row ->
            if (row.student.id == studentId) row.copy(status = status) else row
        }
    }

    fun markAll(status: AttendanceStatus) {
        _rows.value = _rows.value.map { it.copy(status = status) }
    }

    fun save() {
        viewModelScope.launch {
            _isSaving.value = true
            val attendanceMap = _rows.value.associate { row ->
                row.student.id to row.status.name.lowercase().replaceFirstChar { it.uppercase() }
            }
            val entity = PendingAttendanceEntity(
                date         = _date.value,
                classId      = classId,
                termId       = termId,
                attendanceJson = Gson().toJson(attendanceMap)
            )
            repository.cacheAttendance(entity)
            _isSaving.value = false
            _saveEvent.emit("Attendance saved for ${_date.value}. Syncing when online.")
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(
    viewModel: AttendanceViewModel,
    onNavigateBack: () -> Unit
) {
    val rows by viewModel.rows.collectAsState()
    val date by viewModel.date.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.saveEvent.collect { message ->
            snackbarHostState.showSnackbar(message)
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Attendance", fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text(
                            "${viewModel.classId}  •  $date",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.80f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, null, tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0E7490),
                    titleContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                text = {
                    if (isSaving) Text("Saving…") else Text("Save Attendance", fontWeight = FontWeight.Bold)
                },
                icon = {
                    if (isSaving) {
                        CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Outlined.CloudDone, null)
                    }
                },
                onClick = { if (!isSaving) viewModel.save() },
                containerColor = Color(0xFF0E7490),
                contentColor = Color.White
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(Color(0xFFF0FDFF))
        ) {
            // ── KPI Summary bar ──────────────────────────────────────────
            AttendanceSummaryBar(
                present = viewModel.presentCount,
                absent  = viewModel.absentCount,
                late    = viewModel.lateCount,
                total   = rows.size
            )

            // ── Bulk action strip ────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    "Mark all:",
                    fontSize = 11.sp,
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.align(Alignment.CenterVertically)
                )
                AttendanceStatus.values().forEach { status ->
                    OutlinedButton(
                        onClick = { viewModel.markAll(status) },
                        modifier = Modifier.height(30.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(status.chipColor())
                        )
                    ) {
                        Text(
                            status.label(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = status.chipColor()
                        )
                    }
                }
            }

            HorizontalDivider(color = Color(0xFFE0F2FE))

            // ── Swipe-hint header ────────────────────────────────────────
            Text(
                "← Swipe right: Present   |   Swipe left: Absent →",
                fontSize = 10.sp,
                color = Color(0xFF94A3B8),
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF0FDFF))
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            )

            // ── Student list ─────────────────────────────────────────────
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 88.dp)
            ) {
                items(items = rows, key = { it.student.id }) { row ->
                    AttendanceStudentCard(
                        row = row,
                        index = rows.indexOf(row),
                        onSwipePresent = { viewModel.markStatus(row.student.id, AttendanceStatus.PRESENT) },
                        onSwipeAbsent  = { viewModel.markStatus(row.student.id, AttendanceStatus.ABSENT) },
                        onChipClick    = { status -> viewModel.markStatus(row.student.id, status) }
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI SUMMARY BAR
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun AttendanceSummaryBar(
    present: Int,
    absent: Int,
    late: Int,
    total: Int
) {
    val percent = if (total > 0) (present * 100) / total else 0

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        KpiChip(value = "$present", label = "Present", color = Color(0xFF16A34A))
        KpiChip(value = "$absent",  label = "Absent",  color = Color(0xFFDC2626))
        KpiChip(value = "$late",    label = "Late",    color = Color(0xFFD97706))
        KpiChip(value = "$percent%", label = "Rate",   color = Color(0xFF2563EB))
    }
}

@Composable
private fun KpiChip(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = color)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SWIPEABLE STUDENT CARD
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun AttendanceStudentCard(
    row: AttendanceRow,
    index: Int,
    onSwipePresent: () -> Unit,
    onSwipeAbsent: () -> Unit,
    onChipClick: (AttendanceStatus) -> Unit
) {
    var offsetX by remember { mutableFloatStateOf(0f) }
    val animatedOffset by animateFloatAsState(
        targetValue = offsetX,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "swipeOffset"
    )
    // Snap back to center after swipe completes
    val coroutineScope = rememberCoroutineScope()

    val cardBg = when (row.status) {
        AttendanceStatus.PRESENT -> Color(0xFFF0FFF4)
        AttendanceStatus.ABSENT  -> Color(0xFFFFF5F5)
        AttendanceStatus.LATE    -> Color(0xFFFFFBEB)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(cardBg)
            .pointerInput(row.student.id) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        when {
                            offsetX > 80f  -> { onSwipePresent(); offsetX = 0f }
                            offsetX < -80f -> { onSwipeAbsent();  offsetX = 0f }
                            else           -> { offsetX = 0f }
                        }
                    }
                ) { _, dragAmount ->
                    offsetX = (offsetX + dragAmount).coerceIn(-120f, 120f)
                }
            }
    ) {
        // Swipe reveal backgrounds
        if (animatedOffset > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width((animatedOffset / 2).dp)
                    .background(Color(0xFF16A34A).copy(alpha = 0.15f))
                    .align(Alignment.CenterStart),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Check, null, tint = Color(0xFF16A34A), modifier = Modifier.size(20.dp))
            }
        }
        if (animatedOffset < 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width((-animatedOffset / 2).dp)
                    .background(Color(0xFFDC2626).copy(alpha = 0.15f))
                    .align(Alignment.CenterEnd),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Close, null, tint = Color(0xFFDC2626), modifier = Modifier.size(20.dp))
            }
        }

        // Card content
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .graphicsLayer { translationX = animatedOffset }
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Row index + avatar initial
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(row.status.chipColor().copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${index + 1}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = row.status.chipColor()
                )
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = row.student.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "ID: ${row.student.id}",
                    fontSize = 10.sp,
                    color = Color(0xFF94A3B8),
                    fontWeight = FontWeight.Medium
                )
            }

            // Three-state chip selector
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                AttendanceStatus.values().forEach { status ->
                    val selected = row.status == status
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = if (selected) status.chipColor() else Color(0xFFF1F5F9),
                        modifier = Modifier
                            .height(28.dp)
                            .width(52.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .then(
                                Modifier.clickable { onChipClick(status) }
                            )
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = status.label(),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = if (selected) Color.White else Color(0xFF94A3B8)
                            )
                        }
                    }
                }
            }
        }
    }

    HorizontalDivider(color = Color(0xFFE0F2FE), thickness = 0.5.dp)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENSIONS
// ─────────────────────────────────────────────────────────────────────────────

private fun AttendanceStatus.label() = when (this) {
    AttendanceStatus.PRESENT -> "Present"
    AttendanceStatus.ABSENT  -> "Absent"
    AttendanceStatus.LATE    -> "Late"
}

private fun AttendanceStatus.chipColor() = when (this) {
    AttendanceStatus.PRESENT -> Color(0xFF16A34A)
    AttendanceStatus.ABSENT  -> Color(0xFFDC2626)
    AttendanceStatus.LATE    -> Color(0xFFD97706)
}
