package com.eduadmin.pro.ui.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.*
import androidx.navigation.compose.*
import com.eduadmin.pro.data.biometric.BiometricRepository
import com.eduadmin.pro.data.remote.NetworkConfig
import com.eduadmin.pro.data.repository.SyncRepository
import com.eduadmin.pro.ui.admin.*
import com.eduadmin.pro.ui.inbox.*
import com.eduadmin.pro.ui.onboarding.*
import com.eduadmin.pro.ui.parent.*
import com.eduadmin.pro.ui.teacher.*

// ─────────────────────────────────────────────────────────────────────────────
// TYPE-SAFE ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

sealed class Screen(val route: String) {

    // ── Onboarding ────────────────────────────────────────────────────────
    object Pairing      : Screen("pairing")
    object RoleSelect   : Screen("roles")

    // ── Teacher workspace ─────────────────────────────────────────────────
    object Attendance : Screen("teacher/attendance/{classId}/{termId}") {
        fun go(classId: String, termId: String) =
            "teacher/attendance/${encode(classId)}/${encode(termId)}"
    }
    object Gradebook : Screen("teacher/gradebook/{classId}/{termId}") {
        fun go(classId: String, termId: String) =
            "teacher/gradebook/${encode(classId)}/${encode(termId)}"
    }
    object BiometricRegister : Screen("teacher/biometric/{classId}/{termId}") {
        fun go(classId: String, termId: String) =
            "teacher/biometric/${encode(classId)}/${encode(termId)}"
    }

    // ── Admin command center ──────────────────────────────────────────────
    object AdminDashboard  : Screen("admin/dashboard")
    object SignatureCanvas : Screen("admin/signature/{adminId}") {
        fun go(adminId: String) = "admin/signature/${encode(adminId)}"
    }

    // ── Parent portal ─────────────────────────────────────────────────────
    object ParentPortal : Screen("parent/portal/{studentId}/{parentName}") {
        fun go(studentId: String, parentName: String) =
            "parent/portal/${encode(studentId)}/${encode(parentName)}"
    }
    object NotificationInbox : Screen("inbox/{recipientName}") {
        fun go(recipientName: String) = "inbox/${encode(recipientName)}"
    }
}

private fun encode(value: String) = Uri.encode(value)

// ─────────────────────────────────────────────────────────────────────────────
// NAV GRAPH
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController(),
    startDestination: String
) {
    val context = LocalContext.current

    NavHost(
        navController    = navController,
        startDestination = startDestination,
        enterTransition  = { fadeIn()  + slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start) },
        exitTransition   = { fadeOut() + slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Start) },
        popEnterTransition  = { fadeIn()  + slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.End) },
        popExitTransition   = { fadeOut() + slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.End) }
    ) {
        // ── Pairing ───────────────────────────────────────────────────────
        composable(Screen.Pairing.route) {
            ServerPairingScreen(
                onPairingSuccess = {
                    navController.navigate(Screen.RoleSelect.route) {
                        popUpTo(Screen.Pairing.route) { inclusive = true }
                    }
                }
            )
        }

        // ── Role selection ────────────────────────────────────────────────
        composable(Screen.RoleSelect.route) {
            RoleSelectionScreen(
                onEnterAsTeacher = { classId, termId ->
                    navController.navigate(Screen.Attendance.go(classId, termId))
                },
                onEnterAsAdmin = {
                    navController.navigate(Screen.AdminDashboard.route)
                },
                onEnterAsParent = { studentId, parentName ->
                    navController.navigate(Screen.ParentPortal.go(studentId, parentName))
                },
                onRepairConnection = {
                    NetworkConfig.clearSavedUrl(context)
                    navController.navigate(Screen.Pairing.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // ── Attendance ────────────────────────────────────────────────────
        composable(
            route     = Screen.Attendance.route,
            arguments = listOf(
                navArgument("classId") { type = NavType.StringType },
                navArgument("termId")  { type = NavType.StringType }
            )
        ) { back ->
            val classId = back.arguments?.getString("classId") ?: ""
            val termId  = back.arguments?.getString("termId")  ?: "Term 1"
            val vm = viewModel<AttendanceViewModel>(
                key     = "attendance_${classId}_$termId",
                factory = viewModelFactory {
                    initializer { AttendanceViewModel(SyncRepository(context), classId, termId) }
                }
            )
            AttendanceScreen(
                viewModel      = vm,
                onNavigateBack = { navController.navigateUp() }
            )
        }

        // ── Gradebook ─────────────────────────────────────────────────────
        composable(
            route     = Screen.Gradebook.route,
            arguments = listOf(
                navArgument("classId") { type = NavType.StringType },
                navArgument("termId")  { type = NavType.StringType }
            )
        ) { back ->
            val classId = back.arguments?.getString("classId") ?: ""
            val termId  = back.arguments?.getString("termId")  ?: "Term 1"
            val vm = viewModel<GradebookViewModel>(
                key     = "gradebook_${classId}_$termId",
                factory = viewModelFactory {
                    initializer { GradebookViewModel(SyncRepository(context), classId, termId) }
                }
            )
            GradebookScreen(
                viewModel      = vm,
                onNavigateBack = {
                    // Return to the Attendance screen which shares the same classId/termId
                    navController.navigate(Screen.Attendance.go(classId, termId)) {
                        popUpTo(Screen.Attendance.go(classId, termId)) { inclusive = true }
                    }
                }
            )
        }

        // ── Biometric register ────────────────────────────────────────────
        composable(
            route     = Screen.BiometricRegister.route,
            arguments = listOf(
                navArgument("classId") { type = NavType.StringType },
                navArgument("termId")  { type = NavType.StringType }
            )
        ) { back ->
            val classId = back.arguments?.getString("classId") ?: ""
            val termId  = back.arguments?.getString("termId")  ?: "Term 1"
            val vm = viewModel<BiometricAttendanceViewModel>(
                key     = "biometric_${classId}_$termId",
                factory = viewModelFactory {
                    initializer { BiometricAttendanceViewModel(BiometricRepository(context), classId, termId) }
                }
            )
            BiometricAttendanceScreen(
                viewModel      = vm,
                onNavigateBack = { navController.navigateUp() }
            )
        }

        // ── Admin dashboard ───────────────────────────────────────────────
        composable(Screen.AdminDashboard.route) {
            val vm = viewModel<AdminDashboardViewModel>()
            AdminDashboardScreen(
                viewModel          = vm,
                onOpenSignatureCanvas = {
                    navController.navigate(Screen.SignatureCanvas.go("admin"))
                },
                onNavigateBack     = { navController.navigateUp() }
            )
        }

        // ── Signature canvas ──────────────────────────────────────────────
        composable(
            route     = Screen.SignatureCanvas.route,
            arguments = listOf(navArgument("adminId") { type = NavType.StringType })
        ) { back ->
            val adminId = back.arguments?.getString("adminId") ?: "admin"
            val vm = viewModel<SignatureViewModel>(
                key     = "signature_$adminId",
                factory = viewModelFactory {
                    initializer { SignatureViewModel(SyncRepository(context), adminId) }
                }
            )
            SignatureCanvasScreen(
                viewModel      = vm,
                onNavigateBack = { navController.navigateUp() }
            )
        }

        // ── Parent portal ─────────────────────────────────────────────────
        composable(
            route     = Screen.ParentPortal.route,
            arguments = listOf(
                navArgument("studentId")  { type = NavType.StringType },
                navArgument("parentName") { type = NavType.StringType }
            )
        ) { back ->
            val studentId  = back.arguments?.getString("studentId")  ?: ""
            val parentName = back.arguments?.getString("parentName") ?: ""
            val vm = viewModel<ParentPortalViewModel>(
                key     = "parent_$studentId",
                factory = viewModelFactory {
                    initializer { ParentPortalViewModel(SyncRepository(context), studentId, parentName) }
                }
            )
            ParentPortalScreen(
                viewModel      = vm,
                onNavigateBack = { navController.navigateUp() }
            )
        }

        // ── Notification inbox ────────────────────────────────────────────
        composable(
            route     = Screen.NotificationInbox.route,
            arguments = listOf(navArgument("recipientName") { type = NavType.StringType })
        ) { back ->
            val recipient = back.arguments?.getString("recipientName") ?: ""
            val vm = viewModel<NotificationInboxViewModel>(
                key     = "inbox_$recipient",
                factory = viewModelFactory {
                    initializer { NotificationInboxViewModel(recipient) }
                }
            )
            NotificationInboxScreen(
                viewModel      = vm,
                onNavigateBack = { navController.navigateUp() }
            )
        }
    }
}
