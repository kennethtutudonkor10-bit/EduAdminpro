package com.eduadmin.pro.ui.profile

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.eduadmin.pro.data.repository.SyncRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN MODELS
// ─────────────────────────────────────────────────────────────────────────────

/** The three portals that can display a profile screen. */
sealed class UserRole {
    data class Admin(val name: String, val title: String = "System Administrator") : UserRole()
    data class Teacher(val name: String, val assignedClass: String) : UserRole()
    data class Parent(val name: String, val linkedStudentName: String) : UserRole()
}

/** Full lifecycle of an avatar upload operation. */
sealed class UploadStatus {
    object Idle : UploadStatus()
    data class LocalSelected(val uri: Uri, val bitmap: Bitmap) : UploadStatus()
    object Uploading : UploadStatus()
    data class Success(val avatarUrl: String) : UploadStatus()
    data class Error(val message: String) : UploadStatus()
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWMODEL
// ─────────────────────────────────────────────────────────────────────────────

class UserProfileViewModel(
    private val userId: String,
    private val role: String,
    private val repository: SyncRepository
) : ViewModel() {

    private val _uploadStatus = MutableStateFlow<UploadStatus>(UploadStatus.Idle)
    val uploadStatus: StateFlow<UploadStatus> = _uploadStatus.asStateFlow()

    private val _avatarUrl = MutableStateFlow<String?>(null)
    val avatarUrl: StateFlow<String?> = _avatarUrl.asStateFlow()

    /** Called immediately after the user picks an image — before the upload. */
    fun onImageSelected(bitmap: Bitmap, uri: Uri) {
        _uploadStatus.value = UploadStatus.LocalSelected(uri, bitmap)
    }

    /** Compresses the bitmap and sends it to the PC server via SyncRepository. */
    fun commitUpload(bitmap: Bitmap) {
        viewModelScope.launch {
            _uploadStatus.value = UploadStatus.Uploading
            repository.uploadAvatar(bitmap, userId, role)
                .onSuccess { url ->
                    _avatarUrl.value = url
                    _uploadStatus.value = UploadStatus.Success(url)
                }
                .onFailure { e ->
                    _uploadStatus.value = UploadStatus.Error(e.message ?: "Upload failed")
                }
        }
    }

    fun resetStatus() { _uploadStatus.value = UploadStatus.Idle }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER UTILITY
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun shimmerBrush(widthPx: Float = 600f): Brush {
    val shimmerColors = listOf(
        Color(0xFFE8EDF2),
        Color(0xFFF4F7FA),
        Color(0xFFE8EDF2),
    )
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateX by transition.animateFloat(
        initialValue = -widthPx,
        targetValue = widthPx,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerX"
    )
    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateX, 0f),
        end = Offset(translateX + widthPx, 0f)
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE PROFILE AVATAR
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun EditableProfileAvatar(
    avatarUrl: String?,
    uploadStatus: UploadStatus,
    onPickImage: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isUploading = uploadStatus is UploadStatus.Uploading
    val localBitmap = (uploadStatus as? UploadStatus.LocalSelected)?.bitmap

    Box(
        modifier = modifier.size(110.dp),
        contentAlignment = Alignment.BottomEnd
    ) {
        // ── Circular avatar ──────────────────────────────────────────────
        Box(
            modifier = Modifier
                .size(110.dp)
                .clip(CircleShape)
                .border(3.dp, Color(0xFF2563EB), CircleShape)
                .clickable(enabled = !isUploading, onClick = onPickImage),
            contentAlignment = Alignment.Center
        ) {
            when {
                isUploading -> {
                    // Shimmer placeholder while upload is in flight
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(shimmerBrush())
                    )
                    CircularProgressIndicator(
                        modifier = Modifier.size(28.dp),
                        color = Color(0xFF2563EB),
                        strokeWidth = 3.dp
                    )
                }

                localBitmap != null -> {
                    androidx.compose.foundation.Image(
                        painter = androidx.compose.ui.graphics.painter.BitmapPainter(
                            localBitmap.asImageBitmap()
                        ),
                        contentDescription = "Selected avatar",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                avatarUrl != null -> {
                    // Load confirmed avatar from PC server via Coil
                    val context = LocalContext.current
                    SubcomposeAsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(avatarUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = "Profile avatar",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(shimmerBrush())
                            )
                        },
                        error = {
                            DefaultAvatarPlaceholder()
                        }
                    )
                }

                else -> DefaultAvatarPlaceholder()
            }
        }

        // ── Camera badge ─────────────────────────────────────────────────
        Surface(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .clickable(enabled = !isUploading, onClick = onPickImage),
            color = Color(0xFF2563EB),
            shadowElevation = 4.dp,
            shape = CircleShape
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Filled.CameraAlt,
                    contentDescription = "Change profile picture",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
private fun DefaultAvatarPlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFDDE5F0)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.Person,
            contentDescription = null,
            tint = Color(0xFF6B89AE),
            modifier = Modifier.size(52.dp)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HEADER  (avatar + role-specific details)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun ProfileHeader(
    userRole: UserRole,
    avatarUrl: String?,
    uploadStatus: UploadStatus,
    onPickImage: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        EditableProfileAvatar(
            avatarUrl = avatarUrl,
            uploadStatus = uploadStatus,
            onPickImage = onPickImage
        )

        Spacer(modifier = Modifier.height(14.dp))

        // ── Role-specific identity block ─────────────────────────────────
        when (userRole) {
            is UserRole.Admin -> {
                Text(
                    text = userRole.name,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF0F172A)
                )
                Spacer(modifier = Modifier.height(3.dp))
                RolePill(label = userRole.title, color = Color(0xFF2563EB))
            }

            is UserRole.Teacher -> {
                Text(
                    text = userRole.name,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF0F172A)
                )
                Spacer(modifier = Modifier.height(3.dp))
                RolePill(label = "Class Teacher  •  ${userRole.assignedClass}", color = Color(0xFF0E7490))
            }

            is UserRole.Parent -> {
                Text(
                    text = userRole.name,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF0F172A)
                )
                Spacer(modifier = Modifier.height(3.dp))
                RolePill(
                    label = "Parent  •  ${userRole.linkedStudentName}",
                    color = Color(0xFF16A34A)
                )
            }
        }

        // Upload status feedback
        val statusText = when (uploadStatus) {
            is UploadStatus.Uploading -> "Uploading to server..."
            is UploadStatus.Success   -> "Profile picture updated"
            is UploadStatus.Error     -> uploadStatus.message
            else -> null
        }
        if (statusText != null) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = statusText,
                fontSize = 11.sp,
                color = when (uploadStatus) {
                    is UploadStatus.Error   -> MaterialTheme.colorScheme.error
                    is UploadStatus.Success -> Color(0xFF16A34A)
                    else                   -> Color(0xFF64748B)
                },
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun RolePill(label: String, color: Color) {
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = 0.10f)
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserProfileScreen(
    viewModel: UserProfileViewModel,
    userRole: UserRole,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val uploadStatus by viewModel.uploadStatus.collectAsState()
    val avatarUrl by viewModel.avatarUrl.collectAsState()

    // ── Native Photo Picker ───────────────────────────────────────────────
    val photoPicker = rememberLauncherForActivityResult(
        contract = PickVisualMedia()
    ) { uri: Uri? ->
        uri?.let { selectedUri ->
            val bitmap = uriToBitmap(context, selectedUri)
            if (bitmap != null) {
                viewModel.onImageSelected(bitmap, selectedUri)
                // Immediately kick off the upload — no extra confirm step
                viewModel.commitUpload(bitmap)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF2563EB),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .background(Color(0xFFF8FAFC)),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── Gradient hero band ───────────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0xFF2563EB), Color(0xFF3B82F6))
                        )
                    )
            )

            // ── Profile card ─────────────────────────────────────────────
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .offset(y = (-56).dp),
                shape = RoundedCornerShape(20.dp),
                shadowElevation = 6.dp,
                color = Color.White
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    ProfileHeader(
                        userRole = userRole,
                        avatarUrl = avatarUrl,
                        uploadStatus = uploadStatus,
                        onPickImage = {
                            photoPicker.launch(
                                PickVisualMediaRequest(PickVisualMedia.ImageOnly)
                            )
                        }
                    )

                    Spacer(modifier = Modifier.height(20.dp))
                    HorizontalDivider(color = Color(0xFFE2E8F0))
                    Spacer(modifier = Modifier.height(16.dp))

                    // Tap-to-change hint
                    Text(
                        text = "Tap the avatar to update your photo. It syncs instantly to the EduAdmin server.",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8),
                        textAlign = TextAlign.Center,
                        lineHeight = 16.sp,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }
            }

            // ── Role capability summary cards ─────────────────────────────
            Spacer(modifier = Modifier.height(4.dp))
            CapabilitiesSection(userRole = userRole)
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY SUMMARY (shown below the profile card per role)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CapabilitiesSection(userRole: UserRole) {
    val items = when (userRole) {
        is UserRole.Admin -> listOf(
            "Broadcast announcements to all staff",
            "View system analytics and attendance heatmaps",
            "Upload digital signature for PDF report stamping",
            "Configure parent notification channels"
        )
        is UserRole.Teacher -> listOf(
            "Enter grades and remarks offline — auto-syncs on reconnect",
            "Take daily class attendance with one tap",
            "View individual student progress timelines",
            "Request admin review on terminal scores"
        )
        is UserRole.Parent -> listOf(
            "View child's latest term report cards",
            "Track daily attendance and presence percentage",
            "Receive SMS / WhatsApp alerts from school",
            "Download PDF reports when available"
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "Your Portal Capabilities",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF475569),
            modifier = Modifier.padding(bottom = 4.dp)
        )
        items.forEach { item ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(10.dp))
                    .padding(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = Color(0xFF2563EB),
                    modifier = Modifier.size(16.dp).padding(top = 1.dp)
                )
                Text(text = item, fontSize = 12.sp, color = Color(0xFF334155), lineHeight = 18.sp)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BITMAP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Decodes a content URI into a Bitmap. Returns null on failure. */
fun uriToBitmap(context: Context, uri: Uri): Bitmap? = runCatching {
    context.contentResolver.openInputStream(uri)?.use { stream ->
        BitmapFactory.decodeStream(stream)
    }
}.getOrNull()
