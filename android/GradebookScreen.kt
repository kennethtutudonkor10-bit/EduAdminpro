package com.eduadmin.pro.ui.teacher

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eduadmin.pro.data.repository.PendingGradeEntity
import com.eduadmin.pro.data.repository.StudentEntity
import com.eduadmin.pro.data.repository.SyncRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

data class GradeColumn(val id: String, val label: String, val maxMark: Int)

// Default EduAdmin assessment structure — mirrors the web app's assessmentColumns
val DEFAULT_COLUMNS = listOf(
    GradeColumn("test1", "Test 1", 20),
    GradeColumn("test2", "Test 2", 20),
    GradeColumn("hw",    "H/W",    10),
    GradeColumn("exam",  "Exam",   50),
)

// One row in the matrix: a student + their score map for every column
data class GradeRow(
    val student: StudentEntity,
    // columnId → raw input string (may be empty)
    val cells: MutableMap<String, String> = mutableMapOf()
)

fun Double?.gradeLabel(): String = when {
    this == null          -> "-"
    this >= 80            -> "A"
    this >= 70            -> "B"
    this >= 60            -> "C"
    this >= 50            -> "D"
    this >= 45            -> "E"
    else                  -> "F"
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class GradebookViewModel(
    private val repository: SyncRepository,
    val classId: String,
    val termId: String
) : ViewModel() {

    private val _rows = MutableStateFlow<List<GradeRow>>(emptyList())
    val rows: StateFlow<List<GradeRow>> = _rows.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _savedCount = MutableStateFlow(0)
    val savedCount: StateFlow<Int> = _savedCount.asStateFlow()

    val subjects = listOf(
        "Mathematics", "English Language", "Integrated Science",
        "Social Studies", "ICT", "French", "Religious & Moral Education"
    )
    private val _selectedSubject = MutableStateFlow(subjects.first())
    val selectedSubject: StateFlow<String> = _selectedSubject.asStateFlow()

    init { loadStudents() }

    private fun loadStudents() {
        viewModelScope.launch {
            repository.observeStudents()
                .map { all -> all.filter { it.classId == classId && it.status == "Enrolled" } }
                .collect { students ->
                    _rows.value = students.map { s ->
                        val existing = _rows.value.find { it.student.id == s.id }
                        existing ?: GradeRow(s)
                    }
                }
        }
    }

    fun selectSubject(subject: String) {
        _selectedSubject.value = subject
        // Reset cells when switching subject so stale values don't carry over
        _rows.value = _rows.value.map { it.copy(cells = mutableMapOf()) }
    }

    fun onCellChanged(studentId: String, columnId: String, raw: String) {
        _rows.value = _rows.value.map { row ->
            if (row.student.id == studentId) {
                row.copy(cells = row.cells.toMutableMap().also { it[columnId] = raw })
            } else row
        }
    }

    /** Persists all rows to Room and triggers a WorkManager sync to the PC. */
    fun saveAll() {
        viewModelScope.launch {
            _isSyncing.value = true
            val subj = _selectedSubject.value
            var count = 0
            _rows.value.forEach { row ->
                val grade = PendingGradeEntity(
                    studentId = row.student.id,
                    subjectId = subj,
                    termId    = termId,
                    test1     = row.cells["test1"]?.toDoubleOrNull(),
                    test2     = row.cells["test2"]?.toDoubleOrNull(),
                    hw        = row.cells["hw"]?.toDoubleOrNull(),
                    exam      = row.cells["exam"]?.toDoubleOrNull(),
                    remark    = null
                )
                repository.cacheGrade(grade)
                count++
            }
            _savedCount.value = count
            _isSyncing.value = false
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GradebookScreen(
    viewModel: GradebookViewModel,
    onNavigateBack: () -> Unit
) {
    val rows by viewModel.rows.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val savedCount by viewModel.savedCount.collectAsState()
    val selectedSubject by viewModel.selectedSubject.collectAsState()

    var subjectMenuExpanded by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(savedCount) {
        if (savedCount > 0) {
            snackbarHostState.showSnackbar(
                "$savedCount records saved locally. Syncing to server when online…"
            )
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Gradebook", fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text(
                            "${viewModel.classId}  •  ${viewModel.termId}",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.80f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    if (isSyncing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp).padding(end = 16.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        IconButton(onClick = { viewModel.saveAll() }) {
                            Icon(Icons.Outlined.CloudUpload, contentDescription = "Save & sync", tint = Color.White)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E3A5F),
                    titleContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                text = { Text("Save All", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Outlined.Save, contentDescription = null) },
                onClick = { viewModel.saveAll() },
                containerColor = Color(0xFF2563EB),
                contentColor = Color.White,
                expanded = !isSyncing
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(Color(0xFFF1F5F9))
        ) {
            // ── Subject selector ─────────────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                ExposedDropdownMenuBox(
                    expanded = subjectMenuExpanded,
                    onExpandedChange = { subjectMenuExpanded = !subjectMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedSubject,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Subject", fontSize = 11.sp) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = subjectMenuExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF2563EB),
                            focusedLabelColor  = Color(0xFF2563EB)
                        ),
                        textStyle = TextStyle(fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    )
                    ExposedDropdownMenu(
                        expanded = subjectMenuExpanded,
                        onDismissRequest = { subjectMenuExpanded = false }
                    ) {
                        viewModel.subjects.forEach { subj ->
                            DropdownMenuItem(
                                text = { Text(subj, fontWeight = FontWeight.Medium) },
                                onClick = {
                                    viewModel.selectSubject(subj)
                                    subjectMenuExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // ── Column header row ────────────────────────────────────────
            GradeHeaderRow()

            // ── Student rows ─────────────────────────────────────────────
            if (rows.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Outlined.Group, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("No students in this class", color = Color(0xFF94A3B8), fontSize = 13.sp)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 88.dp)
                ) {
                    items(items = rows, key = { it.student.id }) { row ->
                        GradeStudentRow(
                            row = row,
                            columns = DEFAULT_COLUMNS,
                            onCellChanged = { colId, value ->
                                viewModel.onCellChanged(row.student.id, colId, value)
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADE HEADER ROW
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun GradeHeaderRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1E3A5F))
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 8.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Index + Name columns are fixed
        Text(
            "#",
            modifier = Modifier.width(28.dp),
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Text(
            "Student Name",
            modifier = Modifier.width(160.dp).padding(start = 8.dp),
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        DEFAULT_COLUMNS.forEach { col ->
            Text(
                "${col.label}\n/${col.maxMark}",
                modifier = Modifier.width(62.dp),
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                lineHeight = 13.sp
            )
        }
        Text(
            "Total\nGrade",
            modifier = Modifier.width(62.dp),
            color = Color(0xFF93C5FD),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            lineHeight = 13.sp
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE STUDENT ROW  — each score cell is an inline text field
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun GradeStudentRow(
    row: GradeRow,
    columns: List<GradeColumn>,
    onCellChanged: (columnId: String, value: String) -> Unit,
    index: Int = 0
) {
    val focusManager = LocalFocusManager.current

    // Compute running total across non-null cells
    val total = columns.sumOf { col ->
        row.cells[col.id]?.toDoubleOrNull() ?: 0.0
    }.takeIf { row.cells.values.any { it.isNotBlank() } }

    val rowBg = if (index % 2 == 0) Color.White else Color(0xFFF8FAFC)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBg)
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 6.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Row index
        Text(
            text = "${index + 1}",
            modifier = Modifier.width(28.dp),
            fontSize = 11.sp,
            color = Color(0xFF94A3B8),
            textAlign = TextAlign.Center
        )

        // Student name — truncated
        Text(
            text = row.student.name,
            modifier = Modifier.width(160.dp).padding(start = 8.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF0F172A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        // Score cells
        columns.forEachIndexed { idx, col ->
            val raw = row.cells[col.id] ?: ""
            val isOverMax = raw.toDoubleOrNull()?.let { it > col.maxMark } == true

            BasicTextField(
                value = raw,
                onValueChange = { input ->
                    // Accept only numeric values within the column's max
                    val cleaned = input.filter { it.isDigit() || it == '.' }
                    onCellChanged(col.id, cleaned)
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = if (idx < columns.lastIndex) ImeAction.Next else ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Next) },
                    onDone = { focusManager.clearFocus() }
                ),
                textStyle = TextStyle(
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = if (isOverMax) Color(0xFFDC2626) else Color(0xFF1E3A5F)
                ),
                modifier = Modifier
                    .width(62.dp)
                    .padding(horizontal = 3.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(
                        when {
                            isOverMax -> Color(0xFFFEE2E2)
                            raw.isNotBlank() -> Color(0xFFEFF6FF)
                            else -> Color(0xFFF1F5F9)
                        }
                    )
                    .border(
                        1.dp,
                        if (isOverMax) Color(0xFFFCA5A5) else Color(0xFFE2E8F0),
                        RoundedCornerShape(6.dp)
                    )
                    .padding(vertical = 8.dp, horizontal = 4.dp),
                singleLine = true,
                decorationBox = { inner ->
                    if (raw.isEmpty()) {
                        Text("—", color = Color(0xFFCBD5E1), fontSize = 13.sp,
                            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    }
                    inner()
                }
            )
        }

        // Computed total + grade badge
        Box(
            modifier = Modifier.width(62.dp),
            contentAlignment = Alignment.Center
        ) {
            if (total != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "%.0f".format(total),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFF1E3A5F)
                    )
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = gradeColor(total).copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = total.gradeLabel(),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = gradeColor(total),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            } else {
                Text("—", color = Color(0xFFCBD5E1), fontSize = 13.sp)
            }
        }
    }

    HorizontalDivider(color = Color(0xFFE2E8F0), thickness = 0.5.dp)
}

private fun gradeColor(score: Double): Color = when {
    score >= 80 -> Color(0xFF16A34A)
    score >= 70 -> Color(0xFF0E7490)
    score >= 60 -> Color(0xFF2563EB)
    score >= 45 -> Color(0xFFD97706)
    else        -> Color(0xFFDC2626)
}
