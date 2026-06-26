package com.eduadmin.pro.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class AiRemarkRequest(
    val studentName: String,
    val classLevel: String,
    val grades: Map<String, Number>,
    val attendance: Int,
    val behavior: String
)

object EduAdminAiService {

    private const val WORKER_BASE_URL = "https://eduadmin-ai-worker.aremashtech.workers.dev"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun generateRemark(request: AiRemarkRequest): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val gradesObj = JSONObject()
                request.grades.forEach { (k, v) -> gradesObj.put(k, v) }

                val payload = JSONObject().apply {
                    put("studentName", request.studentName)
                    put("classLevel", request.classLevel)
                    put("grades", gradesObj)
                    put("attendance", request.attendance)
                    put("behavior", request.behavior)
                }.toString()

                val httpRequest = Request.Builder()
                    .url("$WORKER_BASE_URL/generate-remarks")
                    .post(payload.toRequestBody("application/json".toMediaType()))
                    .build()

                val response = client.newCall(httpRequest).execute()
                check(response.isSuccessful) {
                    "AI Worker error ${response.code}: ${response.body?.string()}"
                }
                JSONObject(response.body?.string() ?: "{}").getString("remark")
            }
        }
}
