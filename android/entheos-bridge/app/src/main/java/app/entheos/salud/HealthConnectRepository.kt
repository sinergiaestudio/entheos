package app.entheos.salud

import android.content.Context
import android.os.DeadObjectException
import android.os.RemoteException
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import kotlin.reflect.KClass

data class SyncOutcome(
    val recentRecords: Int,
    val historicalRecords: Int,
    val from: Instant,
    val to: Instant,
    val capabilities: Set<String>,
    val succeededCapabilities: Set<String>,
    val dataOrigins: Set<String>,
    val failedCapabilities: Set<String>,
    val historicalBackfillAttempted: Boolean,
    val historicalBackfillSucceeded: Boolean,
) {
    val records: Int get() = recentRecords + historicalRecords
}

private class ProgressiveReadException(
    val capability: String,
    cause: Throwable,
) : IllegalStateException("Health Connect no respondió al leer $capability.", cause)

class HealthConnectRepository(private val context: Context) {
    private var activeClient: HealthConnectClient? = null

    val metricPermissions = linkedMapOf(
        "steps" to HealthPermission.getReadPermission(StepsRecord::class),
        "heart_rate_bpm" to HealthPermission.getReadPermission(HeartRateRecord::class),
        "resting_heart_rate_bpm" to HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        "spo2_percent" to HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        "respiratory_rate" to HealthPermission.getReadPermission(RespiratoryRateRecord::class),
        "sleep_duration_minutes" to HealthPermission.getReadPermission(SleepSessionRecord::class),
        "weight_kg" to HealthPermission.getReadPermission(WeightRecord::class),
        "distance_km" to HealthPermission.getReadPermission(DistanceRecord::class),
        "active_calories_kcal" to HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        "total_calories_kcal" to HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        "exercise_duration_minutes" to HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        "vo2max" to HealthPermission.getReadPermission(Vo2MaxRecord::class),
    )

    private val progressiveOrder = listOf(
        "weight_kg",
        "resting_heart_rate_bpm",
        "spo2_percent",
        "respiratory_rate",
        "vo2max",
        "sleep_duration_minutes",
        "exercise_duration_minutes",
        "steps",
        "distance_km",
        "active_calories_kcal",
        "total_calories_kcal",
        "heart_rate_bpm",
    )

    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context)

    fun sdkAvailable(): Boolean = sdkStatus() == HealthConnectClient.SDK_AVAILABLE

    suspend fun historySupported(): Boolean = withClientRecovery { client ->
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    }

    suspend fun backgroundSupported(): Boolean = withClientRecovery { client ->
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    }

    suspend fun requestablePermissions(): Set<String> {
        val result = metricPermissions.values.toMutableSet()
        if (historySupported()) result += HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY
        if (backgroundSupported()) result += HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
        return result
    }

    suspend fun grantedPermissions(): Set<String> = withClientRecovery { client ->
        client.permissionController.getGrantedPermissions()
    }

    suspend fun grantedCapabilities(): Set<String> {
        val granted = grantedPermissions()
        return metricPermissions.filterValues { it in granted }.keys
    }

    suspend fun canReadInBackground(): Boolean {
        if (!backgroundSupported()) return false
        return HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in grantedPermissions()
    }

    suspend fun synchronize(config: BridgeConfig, store: SecureStore, api: EntheosApi): SyncOutcome {
        check(sdkAvailable()) { "Health Connect no está disponible en este teléfono." }
        val granted = grantedPermissions()
        val capabilities = metricPermissions.filterValues { it in granted }.keys
        check(capabilities.isNotEmpty()) { "Todavía no hay permisos de lectura concedidos." }
        store.saveGrantedCapabilities(capabilities)
        store.initializeMetricCursors(capabilities)

        val end = Instant.now()
        val wasInitialSync = store.lastSyncMillis() <= 0L
        val succeeded = linkedSetOf<String>()
        val failures = linkedMapOf<String, Throwable>()
        val recentRecords = mutableListOf<SyncRecord>()
        var earliestStart = end
        var consecutiveBinderFailures = 0

        for (capability in progressiveOrder.filter { it in capabilities }) {
            val previousCursor = store.metricSyncMillis(capability)
            val start = if (previousCursor > 0L) {
                val incremental = Instant.ofEpochMilli(previousCursor).minus(Duration.ofMinutes(15))
                val floor = end.minus(Duration.ofDays(7))
                if (incremental.isAfter(floor)) incremental else floor
            } else {
                end.minus(initialLookback(capability))
            }
            if (start.isBefore(earliestStart)) earliestStart = start

            val records = try {
                readMetric(capability, start, end)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                failures[capability] = error
                consecutiveBinderFailures = if (isBinderFailure(error)) consecutiveBinderFailures + 1 else 0
                if (consecutiveBinderFailures >= 3) break
                continue
            }

            consecutiveBinderFailures = 0
            uploadRecords(config, api, "recent-$capability", start, end, records)
            store.saveMetricSyncMillis(capability, end.toEpochMilli())
            if (store.metricHistoryCursorMillis(capability) <= 0L) {
                store.saveMetricHistoryCursorMillis(capability, start.toEpochMilli())
            }
            succeeded += capability
            recentRecords += records
            delay(METRIC_PAUSE_MILLIS)
        }

        if (succeeded.isEmpty()) {
            val lastFailure = failures.entries.lastOrNull()
                ?: throw IllegalStateException("Health Connect no devolvió ninguna categoría autorizada.")
            throw ProgressiveReadException(lastFailure.key, lastFailure.value)
        }

        var historicalRecords = emptyList<SyncRecord>()
        var historicalBackfillAttempted = false
        var historicalBackfillSucceeded = false
        if (!wasInitialSync && HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY in granted) {
            val hasHistory = runCatching { historySupported() }.getOrDefault(false)
            if (hasHistory) {
                val candidates = progressiveOrder.filter { it in succeeded }
                if (candidates.isNotEmpty()) {
                    val index = store.historyMetricIndex().mod(candidates.size)
                    val capability = candidates[index]
                    store.saveHistoryMetricIndex(index + 1)
                    val historyEndMillis = store.metricHistoryCursorMillis(capability)
                    if (historyEndMillis > 0L) {
                        val historyEnd = Instant.ofEpochMilli(historyEndMillis)
                        val historyStart = historyEnd.minus(historyChunk(capability))
                        historicalBackfillAttempted = true
                        runCatching {
                            val records = readMetric(capability, historyStart, historyEnd)
                            uploadRecords(config, api, "history-$capability", historyStart, historyEnd, records)
                            store.saveMetricHistoryCursorMillis(capability, historyStart.toEpochMilli())
                            historicalRecords = records
                            historicalBackfillSucceeded = true
                        }.onFailure { error ->
                            if (error is CancellationException) throw error
                            failures[capability] = error
                        }
                    }
                }
            }
        }

        store.saveLastSyncMillis(end.toEpochMilli())
        val failedCapabilities = failures.keys - succeeded
        if (failedCapabilities.isEmpty()) {
            api.reportStatus(config, "active", capabilities)
        } else {
            val labels = failedCapabilities.take(3).joinToString(", ") { capabilityLabel(it) }
            api.reportStatus(
                config,
                "degraded",
                capabilities,
                "partial_read:${failedCapabilities.first()}",
                "Se actualizaron ${succeeded.size} categorías. Quedaron pendientes: $labels.",
            )
        }

        return SyncOutcome(
            recentRecords = recentRecords.size,
            historicalRecords = historicalRecords.size,
            from = earliestStart,
            to = end,
            capabilities = capabilities,
            succeededCapabilities = succeeded,
            dataOrigins = (recentRecords + historicalRecords).mapNotNull { it.dataOrigin }.toSet(),
            failedCapabilities = failedCapabilities,
            historicalBackfillAttempted = historicalBackfillAttempted,
            historicalBackfillSucceeded = historicalBackfillSucceeded,
        )
    }

    private fun initialLookback(capability: String): Duration = when (capability) {
        "heart_rate_bpm" -> Duration.ofMinutes(30)
        "steps" -> Duration.ofHours(1)
        "distance_km", "active_calories_kcal", "total_calories_kcal" -> Duration.ofHours(6)
        "weight_kg", "vo2max" -> Duration.ofDays(30)
        else -> Duration.ofHours(36)
    }

    private fun historyChunk(capability: String): Duration = when (capability) {
        "heart_rate_bpm" -> Duration.ofHours(1)
        "steps", "distance_km", "active_calories_kcal", "total_calories_kcal" -> Duration.ofDays(1)
        else -> Duration.ofDays(7)
    }

    private suspend fun uploadRecords(
        config: BridgeConfig,
        api: EntheosApi,
        window: String,
        start: Instant,
        end: Instant,
        records: List<SyncRecord>,
    ) {
        records.chunked(100).forEachIndexed { index, batch ->
            api.syncBatch(config, "android-$window-${start.toEpochMilli()}-${end.toEpochMilli()}-$index", batch)
        }
    }

    private suspend fun readMetric(capability: String, start: Instant, end: Instant): List<SyncRecord> {
        val output = mutableListOf<SyncRecord>()
        when (capability) {
            "steps" -> readAll(StepsRecord::class, start, end).forEach { record ->
                output += record.asSync("steps", record.count.toDouble(), record.startTime, record.endTime)
            }
            "heart_rate_bpm" -> readAll(HeartRateRecord::class, start, end).forEach { record ->
                record.samples.forEach { sample ->
                    output += record.asSync(
                        "heart_rate_bpm",
                        sample.beatsPerMinute.toDouble(),
                        sample.time,
                        null,
                        "${record.metadata.id}:${sample.time.toEpochMilli()}",
                    )
                }
            }
            "resting_heart_rate_bpm" -> readAll(RestingHeartRateRecord::class, start, end).forEach { record ->
                output += record.asSync("resting_heart_rate_bpm", record.beatsPerMinute.toDouble(), record.time)
            }
            "spo2_percent" -> readAll(OxygenSaturationRecord::class, start, end).forEach { record ->
                output += record.asSync("spo2_percent", record.percentage.value, record.time)
            }
            "respiratory_rate" -> readAll(RespiratoryRateRecord::class, start, end).forEach { record ->
                output += record.asSync("respiratory_rate", record.rate, record.time)
            }
            "sleep_duration_minutes" -> readAll(SleepSessionRecord::class, start, end).forEach { record ->
                output += record.asSync("sleep_duration_minutes", minutes(record.startTime, record.endTime), record.startTime, record.endTime)
            }
            "weight_kg" -> readAll(WeightRecord::class, start, end).forEach { record ->
                output += record.asSync("weight_kg", record.weight.inKilograms, record.time)
            }
            "distance_km" -> readAll(DistanceRecord::class, start, end).forEach { record ->
                output += record.asSync("distance_km", record.distance.inKilometers, record.startTime, record.endTime)
            }
            "active_calories_kcal" -> readAll(ActiveCaloriesBurnedRecord::class, start, end).forEach { record ->
                output += record.asSync("active_calories_kcal", record.energy.inKilocalories, record.startTime, record.endTime)
            }
            "total_calories_kcal" -> readAll(TotalCaloriesBurnedRecord::class, start, end).forEach { record ->
                output += record.asSync("total_calories_kcal", record.energy.inKilocalories, record.startTime, record.endTime)
            }
            "exercise_duration_minutes" -> readAll(ExerciseSessionRecord::class, start, end).forEach { record ->
                output += record.asSync("exercise_duration_minutes", minutes(record.startTime, record.endTime), record.startTime, record.endTime)
            }
            "vo2max" -> readAll(Vo2MaxRecord::class, start, end).forEach { record ->
                output += record.asSync("vo2max", record.vo2MillilitersPerMinuteKilogram, record.time)
            }
        }
        return output.sortedBy { it.effectiveAt }
    }

    private suspend fun <T : Record> readAll(type: KClass<T>, start: Instant, end: Instant): List<T> {
        return withClientRecovery { client ->
            val output = mutableListOf<T>()
            var pageToken: String? = null
            do {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = type,
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                        ascendingOrder = true,
                        pageSize = READ_PAGE_SIZE,
                        pageToken = pageToken,
                    )
                )
                output += response.records
                pageToken = response.pageToken
            } while (pageToken != null)
            output
        }
    }

    fun failureCode(error: Throwable): String = when {
        isBinderFailure(error) -> "health_connect_service_restarted"
        error is SecurityException || error.cause is SecurityException -> "health_connect_permissions_changed"
        else -> "health_connect_read_failed"
    }

    fun failureMessage(error: Throwable): String = when {
        isBinderFailure(error) -> {
            val capability = (error as? ProgressiveReadException)?.capability
            val detail = capability?.let { " al consultar ${capabilityLabel(it)}" }.orEmpty()
            "Health Connect no respondió ni a una lectura mínima$detail. Los permisos siguen concedidos. Actualizá Health Connect, reiniciá el teléfono y volvé a sincronizar."
        }
        error is SecurityException || error.cause is SecurityException ->
            "Android cambió los permisos de Health Connect. Revisalos y volvé a sincronizar."
        else -> error.message?.takeIf { it.isNotBlank() } ?: "No pudimos completar la lectura de Health Connect."
    }

    fun capabilityLabel(value: String): String = when (value) {
        "steps" -> "pasos"
        "heart_rate_bpm" -> "frecuencia cardíaca"
        "resting_heart_rate_bpm" -> "frecuencia en reposo"
        "spo2_percent" -> "oxígeno en sangre"
        "respiratory_rate" -> "frecuencia respiratoria"
        "sleep_duration_minutes" -> "sueño"
        "weight_kg" -> "peso"
        "distance_km" -> "distancia"
        "active_calories_kcal" -> "calorías activas"
        "total_calories_kcal" -> "calorías totales"
        "exercise_duration_minutes" -> "actividad física"
        "vo2max" -> "VO₂ máx."
        else -> value
    }

    private fun healthClient(): HealthConnectClient = activeClient
        ?: HealthConnectClient.getOrCreate(context.applicationContext).also { activeClient = it }

    private fun resetClient() {
        activeClient = null
    }

    private suspend fun <T> withClientRecovery(block: suspend (HealthConnectClient) -> T): T {
        return try {
            block(healthClient())
        } catch (first: Exception) {
            if (!isBinderFailure(first)) throw first
            resetClient()
            delay(FIRST_RECOVERY_MILLIS)
            try {
                block(healthClient())
            } catch (second: Exception) {
                if (isBinderFailure(second)) {
                    resetClient()
                    delay(SECOND_RECOVERY_MILLIS)
                }
                throw second
            }
        }
    }

    private fun isBinderFailure(error: Throwable): Boolean {
        var current: Throwable? = error
        while (current != null) {
            val message = current.message.orEmpty().lowercase()
            if (current is DeadObjectException || current is RemoteException ||
                "binder died" in message || "binder has died" in message || "deadobject" in message
            ) return true
            current = current.cause
        }
        return false
    }

    private fun Record.asSync(
        code: String,
        value: Double,
        effectiveAt: Instant,
        endAt: Instant? = null,
        externalId: String = metadata.id,
    ): SyncRecord {
        val device = metadata.device?.let { listOfNotNull(it.manufacturer, it.model).joinToString(" ").ifBlank { null } }
        return SyncRecord(
            externalId = externalId,
            code = code,
            value = value,
            effectiveAt = effectiveAt.toString(),
            recordedAt = metadata.lastModifiedTime.toString(),
            endAt = endAt?.toString(),
            dataOrigin = metadata.dataOrigin.packageName,
            device = device,
            clientRecordVersion = metadata.clientRecordVersion,
        )
    }

    private fun minutes(start: Instant, end: Instant): Double = Duration.between(start, end).toMillis() / 60_000.0

    private companion object {
        const val READ_PAGE_SIZE = 50
        const val METRIC_PAUSE_MILLIS = 180L
        const val FIRST_RECOVERY_MILLIS = 1_600L
        const val SECOND_RECOVERY_MILLIS = 2_200L
    }
}
