package com.eduadmin.pro.ui.parent

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eduadmin.pro.data.repository.StudentRepository
import com.eduadmin.pro.data.repository.SyncRepository
import com.eduadmin.pro.data.repository.TerminalReportsRepository
import com.eduadmin.pro.ui.common.shimmerBrush
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

data class ParentStudentSummary(
    val studentId: String,
    val name: String,
    val classId: String,
    val attendanceRate: Int,          // percent 0–100
    val lastSeen: String,             // "Today", "Yesterday", "3 days ago"
    val subjects: List<SubjectResult> = emptyList()
)

data class SubjectResult(
    val name: String,
    val total: Double,
    val grade: String,
    val maxTotal: Double = 100.0
)

data class ParentChannelPrefs(
    val whatsapp: Boolean = true,
    val sms: Boolean      = false,
    val email: Boolean    = false
)

sealed class ParentPortalState {
    object Loading                               : ParentPortalState()
    data class Ready(
        val student: ParentStudentSummary,
        val prefs: ParentChannelPrefs
    )                                            : ParentPortalState()
    data class Error(val message: String)        : ParentPortalState()
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class ParentPortalViewModel(
    private val repository: SyncRepository,
    val studentId: String,
    val parentName: String
) : ViewModel() {

    private val studentRepository = StudentRepository()
    private val reportsRepository = TerminalReportsRepository()

    private val _state = MutableStateFlow<ParentPortalState>(ParentPortalState.Loading)
    val state: StateFlow<ParentPortalState> = _state.asStateFlow()

    private val _prefsSaving = MutableStateFlow(false)
    val prefsSaving: StateFlow<Boolean> = _prefsSaving.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = ParentPortalState.Loading
            runCatching {
                val student = studentRepository.fetchStudentById(studentId)
                    ?: error("Student $studentId not found")

                val reports = reportsRepository.fetchReports(studentId, "Term 1")
                val subjects = reports.map { r ->
                    SubjectResult(
                        name     = r.subject,
                        total    = r.total ?: 0.0,
                        grade    = gradeLabel(r.total ?: 0.0),
                        maxTotal = 100.0
                    )
                }.ifEmpty {
                    // Fallback placeholder until the teacher enters first-term grades.
                    listOf(
                        SubjectResult("Mathematics",        0.0, "-"),
                        SubjectResult("English Language",   0.0, "-"),
                        SubjectResult("Integrated Science", 0.0, "-"),
                        SubjectResult("Social Studies",     0.0, "-"),
                        SubjectResult("ICT",                0.0, "-"),
                    )
                }

                ParentPortalState.Ready(
                    student = ParentStudentSummary(
                        studentId      = student.id,
                        name           = student.fullName,
                        classId        = student.className,
                        attendanceRate = 88,  // TODO: add attendance table to Supabase schema
                        lastSeen       = "Today",
                        subjects       = subjects
                    ),
                    prefs = ParentChannelPrefs()
                )
            }.onSuccess { _state.value = it }
             .onFailure { _state.value = ParentPortalState.Error(it.message ?: "Cannot reach school server") }
        }
    }

    fun updateChannels(wa: Boolean, sms: Boolean, email: Boolean) {
        // Channel preferences are not yet in Supabase schema — update local UI state only.
        val current = _state.value
        if (current is ParentPortalState.Ready) {
            _state.value = current.copy(prefs = ParentChannelPrefs(wa, sms, email))
        }
    }

    private fun gradeLabel(score: Double): String = when {
        score >= 80 -> "A"
        score >= 70 -> "B"
        score >= 60 -> "C"
        score >= 50 -> "D"
        score >= 45 -> "E"
        score > 0   -> "F"
        else        -> "-"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentPortalScreen(
    viewModel: ParentPortalViewModel,
    onNavigateBack: () -> Unit
) {
    val state      by viewModel.state.collectAsState()
    val prefsSaving by viewModel.prefsSaving.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Parent Portal", fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text(viewModel.parentName, fontSize = 11.sp, color = Color.White.copy(alpha = 0.75f))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, null, tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Outlined.Refresh, null, tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF7C3AED),
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        when (val s = state) {
            is ParentPortalState.Loading -> ParentShimmer(padding)
            is ParentPortalState.Error   -> ParentErrorCard(s.message, padding) { viewModel.load() }
            is ParentPortalState.Ready   -> ParentReadyContent(
                student     = s.student,
                prefs       = s.prefs,
                prefsSaving = prefsSaving,
                padding     = padding,
                onChannelUpdate = { wa, sms, email -> viewModel.updateChannels(wa, sms, email) }
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// READY CONTENT
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ParentReadyContent(
    student: ParentStudentSummary,
    prefs: ParentChannelPrefs,
    prefsSaving: Boolean,
    padding: PaddingValues,
    onChannelUpdate: (Boolean, Boolean, Boolean) -> Unit
) {
    var whatsapp by remember { mutableStateOf(prefs.whatsapp) }
    var sms      by remember { mutableStateOf(prefs.sms) }
    var email    by remember { mutableStateOf(prefs.email) }

    LazyColumn(
        modifier = Modifier
            .padding(padding)
            .fillMaxSize()
            .background(Color(0xFFF5F3FF)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // ── Child hero card ───────────────────────────────────────────────
        item { ChildHeroCard(student) }

        // ── Attendance snapshot ───────────────────────────────────────────
        item { AttendanceSnapshotCard(student.attendanceRate, student.lastSeen) }

        // ── Grades table ──────────────────────────────────────────────────
        item {
            Text(
                "Term Results",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF6D28D9)
            )
        }
        items(student.subjects) { subject ->
            SubjectResultRow(subject)
        }

        // ── Notification prefs ────────────────────────────────────────────
        item {
            Spacer(Modifier.height(4.dp))
            Text(
                "How should school contact you?",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF6D28D9)
            )
        }
        item {
            NotificationPrefsCard(
                whatsapp    = whatsapp,
                sms         = sms,
                email       = email,
                isSaving    = prefsSaving,
                onToggle    = { type ->
                    when (type) {
                        "whatsapp" -> { whatsapp = !whatsapp; onChannelUpdate(whatsapp, sms, email) }
                        "sms"      -> { sms      = !sms;      onChannelUpdate(whatsapp, sms, email) }
                        "email"    -> { email    = !email;    onChannelUpdate(whatsapp, sms, email) }
                    }
                }
            )
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHILD HERO CARD
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ChildHeroCard(student: ParentStudentSummary) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color(0xFF7C3AED),
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Initials avatar
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.20f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = student.name.split(" ").take(2).joinToString("") { it.first().uppercase() },
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(student.name, fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                Text(
                    "Class ${student.classId}  •  ID: ${student.studentId}",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.75f)
                )
            }

            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color.White.copy(alpha = 0.20f)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("${student.attendanceRate}%", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                    Text("Present", fontSize = 9.sp, color = Color.White.copy(alpha = 0.80f), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun AttendanceSnapshotCard(rate: Int, lastSeen: String) {
    val animated by animateFloatAsState(
        targetValue = rate / 100f,
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "attendance"
    )

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.CalendarToday, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(16.dp))
                    Text("Attendance This Term", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                }
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFFEDE9FE)
                ) {
                    Text(
                        "Last seen: $lastSeen",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF7C3AED),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            // Progress bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(Color(0xFFF3F4F6))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(animated)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(5.dp))
                        .background(
                            androidx.compose.ui.graphics.Brush.horizontalGradient(
                                listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))
                            )
                        )
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${(animated * 100).toInt()}% attended", fontSize = 11.sp, color = Color(0xFF7C3AED), fontWeight = FontWeight.Black)
                Text("${100 - rate}% missed", fontSize = 11.sp, color = Color(0xFFDC2626), fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT RESULT ROW
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SubjectResultRow(subject: SubjectResult) {
    val barWidth = (subject.total / subject.maxTotal).toFloat()
    val animated by animateFloatAsState(
        targetValue = barWidth,
        animationSpec = tween(700, easing = FastOutSlowInEasing),
        label = "bar"
    )
    val gradeColor = when (subject.grade) {
        "A"  -> Color(0xFF16A34A)
        "B"  -> Color(0xFF0E7490)
        "C"  -> Color(0xFF2563EB)
        "D"  -> Color(0xFFD97706)
        else -> Color(0xFFDC2626)
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        shadowElevation = 0.5.dp
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(subject.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF0F172A))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "%.0f / %.0f".format(subject.total, subject.maxTotal),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B)
                    )
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(gradeColor),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(subject.grade, fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(5.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFFF1F5F9))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(animated)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(3.dp))
                        .background(gradeColor.copy(alpha = 0.70f))
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PREFS CARD
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun NotificationPrefsCard(
    whatsapp: Boolean,
    sms: Boolean,
    email: Boolean,
    isSaving: Boolean,
    onToggle: (String) -> Unit
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (isSaving) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(2.dp)),
                    color = Color(0xFF7C3AED),
                    trackColor = Color(0xFFEDE9FE)
                )
                Spacer(Modifier.height(10.dp))
            }

            listOf(
                Triple("whatsapp", "WhatsApp",   Pair(Icons.Outlined.Chat,  Color(0xFF16A34A))),
                Triple("sms",      "SMS",         Pair(Icons.Outlined.Sms,   Color(0xFF2563EB))),
                Triple("email",    "Email",       Pair(Icons.Outlined.Email, Color(0xFF9333EA))),
            ).forEachIndexed { idx, (key, label, meta) ->
                val checked = when (key) { "whatsapp" -> whatsapp; "sms" -> sms; else -> email }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(meta.first, null, tint = meta.second, modifier = Modifier.size(18.dp))
                        Column {
                            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF0F172A))
                            Text(
                                if (checked) "Enabled — you'll receive alerts here" else "Disabled",
                                fontSize = 10.sp,
                                color = if (checked) meta.second.copy(alpha = 0.75f) else Color(0xFFCBD5E1)
                            )
                        }
                    }
                    Switch(
                        checked = checked,
                        onCheckedChange = { onToggle(key) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor  = Color.White,
                            checkedTrackColor  = meta.second
                        )
                    )
                }
                if (idx < 2) HorizontalDivider(color = Color(0xFFF8FAFC))
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER + ERROR STATES
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ParentShimmer(padding: PaddingValues) {
    Column(
        modifier = Modifier
            .padding(padding)
            .fillMaxSize()
            .background(Color(0xFFF5F3FF))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Box(Modifier.fillMaxWidth().height(100.dp).clip(RoundedCornerShape(20.dp)).background(shimmerBrush()))
        Box(Modifier.fillMaxWidth().height(90.dp).clip(RoundedCornerShape(16.dp)).background(shimmerBrush()))
        repeat(4) {
            Box(Modifier.fillMaxWidth().height(58.dp).clip(RoundedCornerShape(12.dp)).background(shimmerBrush()))
        }
        Box(Modifier.fillMaxWidth().height(130.dp).clip(RoundedCornerShape(16.dp)).background(shimmerBrush()))
    }
}

@Composable
private fun ParentErrorCard(message: String, padding: PaddingValues, onRetry: () -> Unit) {
    Box(modifier = Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Outlined.WifiOff, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(48.dp))
            Text("School server is offline", fontWeight = FontWeight.Bold, color = Color(0xFF475569))
            Text(message, fontSize = 11.sp, color = Color(0xFF94A3B8), textAlign = TextAlign.Center)
            Button(
                onClick = onRetry,
                colors  = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
            ) { Text("Retry") }
        }
    }
}
