package app.entheos.salud

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration

data class PairingResult(
    val token: String,
    val connectionId: String,
    val tokenExpiresAt: String,
    val accountDisplayName: String,
)

data class SyncRecord(
    val externalId: String,
    val code: String,
    val value: Double,
    val effectiveAt: String,
    val recordedAt: String,
    val endAt: String? = null,
    val dataOrigin: String? = null,
    val device: String? = null,
    val clientRecordVersion: Long? = null,
) {
    fun toJson() = JSONObject()
        .put("externalId", externalId)
        .put("code", code)
        .put("value", value)
        .put("effectiveAt", effectiveAt)
        .put("recordedAt", recordedAt)
        .apply {
            endAt?.let { put("endAt", it) }
            dataOrigin?.let { put("dataOrigin", it) }
            device?.let { put("device", it) }
            clientRecordVersion?.let { put("clientRecordVersion", it) }
        }
}

class EntheosApi {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(Duration.ofSeconds(20))
        .readTimeout(Duration.ofSeconds(45))
        .writeTimeout(Duration.ofSeconds(45))
        .build()

    suspend fun pair(server: String, code: String): PairingResult = withContext(Dispatchers.IO) {
        val base = verifiedServer(server)
        val body = JSONObject()
            .put("code", code)
            .put("deviceLabel", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            .put("deviceModel", Build.MODEL)
            .put("appVersion", BuildConfig.VERSION_NAME)
        val response = execute(base, "/api/health/connectors/pair", body, null)
        PairingResult(
            token = response.getString("token"),
            connectionId = response.getString("connectionId"),
            tokenExpiresAt = response.optString("tokenExpiresAt"),
            accountDisplayName = response.optString("accountDisplayName", "Mi cuenta de Entheos"),
        )
    }

    suspend fun reportStatus(
        config: BridgeConfig,
        status: String,
        capabilities: Set<String>,
        errorCode: String? = null,
        errorMessage: String? = null,
    ) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("status", status)
            .put("capabilities", JSONArray(capabilities.toList()))
        errorCode?.let { body.put("errorCode", it) }
        errorMessage?.let { body.put("errorMessage", it.take(220)) }
        execute(config.server, "/api/health/connectors/health-connect/status", body, config.token)
        Unit
    }

    suspend fun syncBatch(config: BridgeConfig, batchId: String, records: List<SyncRecord>) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("batchId", batchId)
            .put("records", JSONArray(records.map { it.toJson() }))
            .put("deletions", JSONArray())
        execute(config.server, "/api/health/connectors/health-connect/sync", body, config.token)
        Unit
    }

    private fun execute(server: String, path: String, body: JSONObject, token: String?): JSONObject {
        val request = Request.Builder()
            .url("${verifiedServer(server)}$path")
            .post(body.toString().toRequestBody(jsonType))
            .header("accept", "application/json")
            .apply { token?.let { header("authorization", "Bearer $it") } }
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
            if (!response.isSuccessful) throw IllegalStateException(json.optString("error", "Error HTTP ${response.code}"))
            return json
        }
    }

    private fun verifiedServer(value: String): String {
        val canonical = BuildConfig.ENTHEOS_BASE_URL.trimEnd('/')
        val candidate = value.trim().trimEnd('/')
        require(candidate == canonical) { "La conexión sólo puede enviar datos al servidor oficial de Entheos." }
        return canonical
    }
}
