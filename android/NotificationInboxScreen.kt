package com.eduadmin.pro.ui.inbox

import androidx.compose.animation.*
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eduadmin.pro.data.remote.apiService
import com.eduadmin.pro.ui.common.ShimmerBox
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

data class InboxMessage(
    val id: String,
    val type: String,           // "attendance_checkin" | "attendance_absence_alert" | "broadcast" | etc.
    val recipientName: String,
    val body: String,
    val timestamp: String,      // ISO-8601 from PC server
    val status: String,         // "pending" | "dispatched" | "failed"
    val isRead: Boolean = false
)

sealed class InboxState {
    object Loading                              : InboxState()
    data class Ready(val items: List<InboxMessage>) : InboxState()
    data class Error(val message: String)       : InboxState()
}

fun InboxMessage.isUrgent() = type == "attendance_absence_alert" || status == "failed"

fun InboxMessage.iconAndColor(): Pair<ImageVector, Color> = when (type) {
    "attendance_checkin"       -> Icons.Outlined.HowToReg   to Color(0xFF16A34A)
    "attendance_absence_alert" -> Icons.Outlined.Warning    to Color(0xFFDC2626)
    "broadcast"                -> Icons.Outlined.Campaign   to Color(0xFF2563EB)
    "grade_published"          -> Icons.Outlined.School     to Color(0xFF7C3AED)
    "fee_reminder"             -> Icons.Outlined.Payment    to Color(0xFFD97706)
    else                       -> Icons.Outlined.Notifications to Color(0xFF64748B)
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class NotificationInboxViewModel(
    val recipientName: String
) : ViewModel() {

    private val _state = MutableStateFlow<InboxState>(InboxState.Loading)
    val state: StateFlow<InboxState> = _state.asStateFlow()

    // Set of locally-marked-read IDs (server marks via /api/notifications/mark-read)
    private val _readIds = MutableStateFlow<Set<String>>(emptySet())
    val readIds: StateFlow<Set<String>> = _readIds.asStateFlow()

    private val _filter = MutableStateFlow<String?>(null)
    val filter: StateFlow<String?> = _filter.asStateFlow()

    init {
        load()
        startPolling()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = InboxState.Loading
            runCatching {
                val response = apiService.fetchInboxNotifications(recipientName)
                val body = response.body() ?: error("Empty response")
                body.map { n ->
                    InboxMessage(
                        id            = n["id"]?.toString()    ?: "",
                        type          = n["type"]?.toString()  ?: "broadcast",
                        recipientName = n["recipient_name"]?.toString() ?: recipientName,
                        body          = n["message"]?.toString() ?: "",
                        timestamp     = n["created_at"]?.toString() ?: "",
                        status        = n["status"]?.toString() ?: "pending"
                    )
                }
            }.onSuccess { items ->
                _state.value = InboxState.Ready(items)
            }.onFailure { e ->
                _state.value = InboxState.Error(e.message ?: "Cannot reach PC server")
            }
        }
    }

    fun markRead(id: String) {
        _readIds.value = _readIds.value + id
        viewModelScope.launch {
            runCatching { apiService.markNotificationRead(id) }
        }
    }

    fun setFilter(type: String?) {
        _filter.value = type
    }

    // Lightweight long-poll — re-fetches every 30 seconds while screen is open
    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (_state.value !is InboxState.Loading) load()
            }
        }
    }

    fun filteredItems(): List<InboxMessage> {
        val state = _state.value as? InboxState.Ready ?: return emptyList()
        val readSet = _readIds.value
        val f = _filter.value
        return state.items
            .map { msg -> if (msg.id in readSet) msg.copy(isRead = true) else msg }
            .filter { f == null || it.type == f }
            .sortedWith(compareBy({ it.isRead }, { it.timestamp }))
            .reversed()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationInboxScreen(
    viewModel: NotificationInboxViewModel,
    onNavigateBack: () -> Unit
) {
    val state   by viewModel.state.collectAsState()
    val readIds by viewModel.readIds.collectAsState()
    val filter  by viewModel.filter.collectAsState()

    val unreadCount = (state as? InboxState.Ready)
        ?.items?.count { it.id !in readIds && !it.isRead } ?: 0

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Notifications", fontWeight = FontWeight.Black, fontSize = 16.sp)
                            if (unreadCount > 0) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFFDC2626)
                                ) {
                                    Text(
                                        "$unreadCount",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                        Text(viewModel.recipientName, fontSize = 11.sp, color = Color.White.copy(alpha = 0.75f))
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
                .background(Color(0xFFF8FAFC))
        ) {
            // ── Filter chips ─────────────────────────────────────────────
            FilterChipRow(current = filter, onSelect = { viewModel.setFilter(it) })

            when (state) {
                is InboxState.Loading -> InboxShimmer()
                is InboxState.Error   -> InboxErrorState((state as InboxState.Error).message) { viewModel.load() }
                is InboxState.Ready   -> {
                    val items = viewModel.filteredItems()
                    if (items.isEmpty()) {
                        InboxEmptyState(filter)
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(items, key = { it.id }) { msg ->
                                NotificationCard(
                                    message   = msg,
                                    isRead    = msg.isRead || msg.id in readIds,
                                    onMarkRead = { viewModel.markRead(msg.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER CHIP ROW
// ─────────────────────────────────────────────────────────────────────────────

private val FILTER_OPTIONS = listOf(
    null                        to "All",
    "attendance_checkin"        to "Check-In",
    "attendance_absence_alert"  to "Absence",
    "broadcast"                 to "Broadcast",
    "grade_published"           to "Grades",
)

@Composable
private fun FilterChipRow(current: String?, onSelect: (String?) -> Unit) {
    androidx.compose.foundation.lazy.LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(FILTER_OPTIONS) { (type, label) ->
            val selected = current == type
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = if (selected) Color(0xFF0F172A) else Color(0xFFF1F5F9),
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .clickable { onSelect(type) }
            ) {
                Text(
                    label,
                    fontSize = 11.sp,
                    fontWeight = if (selected) FontWeight.Black else FontWeight.Medium,
                    color = if (selected) Color.White else Color(0xFF64748B),
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                )
            }
        }
    }
    HorizontalDivider(color = Color(0xFFF1F5F9))
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CARD  — expands to show full body on tap
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun NotificationCard(
    message: InboxMessage,
    isRead: Boolean,
    onMarkRead: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val (icon, iconColor) = message.iconAndColor()

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (!isRead) Color.White else Color(0xFFFAFAFA),
        shadowElevation = if (!isRead) 2.dp else 0.5.dp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                expanded = !expanded
                if (!isRead) onMarkRead()
            }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                // Icon badge
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(iconColor.copy(alpha = 0.10f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, null, tint = iconColor, modifier = Modifier.size(20.dp))
                }

                Spacer(Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = message.recipientName,
                            fontSize = 13.sp,
                            fontWeight = if (!isRead) FontWeight.Black else FontWeight.SemiBold,
                            color = if (!isRead) Color(0xFF0F172A) else Color(0xFF475569),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        if (!isRead) {
                            Box(
                                modifier = Modifier
                                    .padding(start = 6.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(iconColor)
                            )
                        }
                    }

                    Text(
                        text = message.body,
                        fontSize = 11.sp,
                        color = Color(0xFF64748B),
                        maxLines = if (expanded) Int.MAX_VALUE else 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(Modifier.width(4.dp))
                Icon(
                    if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                    null,
                    tint = Color(0xFFCBD5E1),
                    modifier = Modifier.size(18.dp)
                )
            }

            // Expanded section
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit  = shrinkVertically() + fadeOut()
            ) {
                Column {
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0xFFF1F5F9))
                    Spacer(Modifier.height(10.dp))

                    // Full message body
                    Text(
                        text = message.body,
                        fontSize = 13.sp,
                        color = Color(0xFF334155),
                        lineHeight = 19.sp
                    )

                    Spacer(Modifier.height(10.dp))

                    // Meta row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Status chip
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = when (message.status) {
                                "dispatched" -> Color(0xFF16A34A).copy(alpha = 0.10f)
                                "failed"     -> Color(0xFFDC2626).copy(alpha = 0.10f)
                                else         -> Color(0xFFD97706).copy(alpha = 0.10f)
                            }
                        ) {
                            Text(
                                message.status.replaceFirstChar { it.uppercase() },
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = when (message.status) {
                                    "dispatched" -> Color(0xFF16A34A)
                                    "failed"     -> Color(0xFFDC2626)
                                    else         -> Color(0xFFD97706)
                                },
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }

                        // Urgent badge
                        if (message.isUrgent()) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFFFEE2E2)
                            ) {
                                Text(
                                    "Urgent",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color(0xFFDC2626),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Text(
                            message.timestamp.take(16).replace("T", "  "),
                            fontSize = 10.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY + ERROR + SHIMMER STATES
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun InboxShimmer() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        repeat(6) {
            ShimmerBox(height = 72.dp, shape = RoundedCornerShape(14.dp))
        }
    }
}

@Composable
private fun InboxEmptyState(filter: String?) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Outlined.NotificationsNone, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(52.dp))
            Text("No notifications", fontWeight = FontWeight.Bold, color = Color(0xFF475569))
            if (filter != null) {
                Text("No \"$filter\" messages yet", fontSize = 12.sp, color = Color(0xFF94A3B8))
            }
        }
    }
}

@Composable
private fun InboxErrorState(message: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(48.dp))
            Text("Offline from school server", fontWeight = FontWeight.Bold, color = Color(0xFF475569))
            Text(message, fontSize = 11.sp, color = Color(0xFF94A3B8), textAlign = TextAlign.Center)
            Button(
                onClick = onRetry,
                colors  = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
            ) { Text("Retry") }
        }
    }
}
