package com.eduadmin.pro.ui.onboarding

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

enum class UserRole { TEACHER, ADMIN, PARENT }

data class TeacherParams(val classId: String, val termId: String)
data class ParentParams(val studentId: String, val parentName: String)

sealed class RoleSelection {
    object None                              : RoleSelection()
    object Admin                             : RoleSelection()
    data class Teacher(val params: TeacherParams?) : RoleSelection()
    data class Parent(val params: ParentParams?)   : RoleSelection()
}

val CLASS_OPTIONS = listOf(
    "Basic 1", "Basic 2", "Basic 3", "Basic 4", "Basic 5", "Basic 6",
    "JHS 1", "JHS 2", "JHS 3"
)

val TERM_OPTIONS = listOf("Term 1", "Term 2", "Term 3")

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleSelectionScreen(
    onEnterAsTeacher: (classId: String, termId: String) -> Unit,
    onEnterAsAdmin: () -> Unit,
    onEnterAsParent: (studentId: String, parentName: String) -> Unit,
    onRepairConnection: () -> Unit
) {
    var selection by remember { mutableStateOf<RoleSelection>(RoleSelection.None) }

    // Teacher sub-form state
    var selectedClass by remember { mutableStateOf(CLASS_OPTIONS.first()) }
    var selectedTerm  by remember { mutableStateOf(TERM_OPTIONS.first()) }
    var classMenuOpen by remember { mutableStateOf(false) }
    var termMenuOpen  by remember { mutableStateOf(false) }

    // Parent sub-form state
    var studentId  by remember { mutableStateOf("") }
    var parentName by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9))
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(20.dp))

        // ── Header ────────────────────────────────────────────────────────
        Text(
            "EduAdmin",
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF1E3A5F),
            letterSpacing = 2.sp
        )
        Text(
            "Who are you?",
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF0F172A)
        )
        Text(
            "Select your access profile to enter your workspace.",
            fontSize = 13.sp,
            color = Color(0xFF64748B)
        )

        Spacer(Modifier.height(8.dp))

        // ── Role cards ────────────────────────────────────────────────────
        RoleCard(
            icon       = Icons.Outlined.MenuBook,
            title      = "Teacher",
            subtitle   = "Grade entry, attendance & biometric register",
            color      = Color(0xFF2563EB),
            selected   = selection is RoleSelection.Teacher,
            onClick    = { selection = if (selection is RoleSelection.Teacher) RoleSelection.None else RoleSelection.Teacher(null) }
        )

        // Teacher sub-form
        AnimatedVisibility(
            visible  = selection is RoleSelection.Teacher,
            enter    = expandVertically() + fadeIn(),
            exit     = shrinkVertically() + fadeOut()
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFFEFF6FF),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Your Class & Term", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF2563EB))

                    // Class picker
                    ExposedDropdownMenuBox(
                        expanded         = classMenuOpen,
                        onExpandedChange = { classMenuOpen = !classMenuOpen }
                    ) {
                        OutlinedTextField(
                            value        = selectedClass,
                            onValueChange = {},
                            readOnly     = true,
                            label        = { Text("Class", fontSize = 11.sp) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(classMenuOpen) },
                            modifier     = Modifier.menuAnchor().fillMaxWidth(),
                            shape        = RoundedCornerShape(10.dp),
                            colors       = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF2563EB),
                                focusedLabelColor  = Color(0xFF2563EB)
                            )
                        )
                        ExposedDropdownMenu(expanded = classMenuOpen, onDismissRequest = { classMenuOpen = false }) {
                            CLASS_OPTIONS.forEach { cls ->
                                DropdownMenuItem(
                                    text    = { Text(cls, fontWeight = FontWeight.Medium) },
                                    onClick = { selectedClass = cls; classMenuOpen = false }
                                )
                            }
                        }
                    }

                    // Term picker
                    ExposedDropdownMenuBox(
                        expanded         = termMenuOpen,
                        onExpandedChange = { termMenuOpen = !termMenuOpen }
                    ) {
                        OutlinedTextField(
                            value        = selectedTerm,
                            onValueChange = {},
                            readOnly     = true,
                            label        = { Text("Term", fontSize = 11.sp) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(termMenuOpen) },
                            modifier     = Modifier.menuAnchor().fillMaxWidth(),
                            shape        = RoundedCornerShape(10.dp),
                            colors       = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF2563EB),
                                focusedLabelColor  = Color(0xFF2563EB)
                            )
                        )
                        ExposedDropdownMenu(expanded = termMenuOpen, onDismissRequest = { termMenuOpen = false }) {
                            TERM_OPTIONS.forEach { term ->
                                DropdownMenuItem(
                                    text    = { Text(term, fontWeight = FontWeight.Medium) },
                                    onClick = { selectedTerm = term; termMenuOpen = false }
                                )
                            }
                        }
                    }

                    Button(
                        onClick = { onEnterAsTeacher(selectedClass, selectedTerm) },
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                    ) {
                        Text("Enter Teacher Workspace", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }

        // Admin card
        RoleCard(
            icon     = Icons.Outlined.AdminPanelSettings,
            title    = "Administrator",
            subtitle = "Dashboard, KPIs, notifications & digital seal",
            color    = Color(0xFF1E3A5F),
            selected = selection == RoleSelection.Admin,
            onClick  = {
                selection = RoleSelection.Admin
                onEnterAsAdmin()
            }
        )

        // Parent card
        RoleCard(
            icon     = Icons.Outlined.FamilyRestroom,
            title    = "Parent / Guardian",
            subtitle = "View child's grades, attendance & alerts",
            color    = Color(0xFF7C3AED),
            selected = selection is RoleSelection.Parent,
            onClick  = { selection = if (selection is RoleSelection.Parent) RoleSelection.None else RoleSelection.Parent(null) }
        )

        // Parent sub-form
        AnimatedVisibility(
            visible = selection is RoleSelection.Parent,
            enter   = expandVertically() + fadeIn(),
            exit    = shrinkVertically() + fadeOut()
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFFF5F3FF),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Your Details", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED))

                    OutlinedTextField(
                        value         = parentName,
                        onValueChange = { parentName = it },
                        label         = { Text("Your Name", fontSize = 11.sp) },
                        placeholder   = { Text("e.g.  Mrs. Boateng", fontSize = 11.sp) },
                        singleLine    = true,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Words,
                            imeAction      = ImeAction.Next
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape    = RoundedCornerShape(10.dp),
                        colors   = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF7C3AED),
                            focusedLabelColor  = Color(0xFF7C3AED)
                        )
                    )

                    OutlinedTextField(
                        value         = studentId,
                        onValueChange = { studentId = it.uppercase() },
                        label         = { Text("Child's Student ID", fontSize = 11.sp) },
                        placeholder   = { Text("e.g.  STU-2024-001", fontSize = 11.sp) },
                        singleLine    = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction    = ImeAction.Done
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape    = RoundedCornerShape(10.dp),
                        colors   = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF7C3AED),
                            focusedLabelColor  = Color(0xFF7C3AED)
                        )
                    )

                    Button(
                        onClick  = {
                            if (parentName.isNotBlank() && studentId.isNotBlank()) {
                                onEnterAsParent(studentId.trim(), parentName.trim())
                            }
                        },
                        enabled  = parentName.isNotBlank() && studentId.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape    = RoundedCornerShape(10.dp),
                        colors   = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
                    ) {
                        Text("View My Child's Profile", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        TextButton(onClick = onRepairConnection) {
            Icon(Icons.Outlined.SettingsEthernet, null, modifier = Modifier.size(14.dp), tint = Color(0xFF94A3B8))
            Spacer(Modifier.width(4.dp))
            Text("Change server connection", fontSize = 11.sp, color = Color(0xFF94A3B8))
        }

        Spacer(Modifier.height(16.dp))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CARD
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun RoleCard(
    icon:     ImageVector,
    title:    String,
    subtitle: String,
    color:    Color,
    selected: Boolean,
    onClick:  () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .then(
                if (selected) Modifier.border(2.dp, color, RoundedCornerShape(16.dp))
                else Modifier
            ),
        shape           = RoundedCornerShape(16.dp),
        color           = if (selected) color.copy(alpha = 0.06f) else Color.White,
        shadowElevation = if (selected) 0.dp else 1.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = color, modifier = Modifier.size(24.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFF0F172A))
                Text(subtitle, fontSize = 11.sp, color = Color(0xFF64748B), lineHeight = 14.sp)
            }

            Icon(
                if (selected) Icons.Outlined.KeyboardArrowDown else Icons.Outlined.ChevronRight,
                null,
                tint     = if (selected) color else Color(0xFFCBD5E1),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
