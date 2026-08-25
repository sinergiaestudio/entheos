package app.entheos.salud

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class SyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val store = SecureStore(applicationContext)
        val config = store.loadConfig() ?: return Result.success()
        val repository = HealthConnectRepository(applicationContext)
        val api = EntheosApi()
        return try {
            if (!repository.sdkAvailable()) {
                api.reportStatus(config, "interrupted", store.cachedGrantedCapabilities(), "health_connect_unavailable", "Health Connect no está disponible.")
                Result.success()
            } else {
                val capabilities = repository.grantedCapabilities()
                store.saveGrantedCapabilities(capabilities)
                if (!repository.canReadInBackground()) {
                    api.reportStatus(config, "pending_permissions", capabilities)
                    Result.success()
                } else {
                    repository.synchronize(config, store, api)
                    Result.success()
                }
            }
        } catch (error: Exception) {
            runCatching {
                val capabilities = runCatching {
                    repository.grantedCapabilities().also(store::saveGrantedCapabilities)
                }.getOrDefault(store.cachedGrantedCapabilities())
                api.reportStatus(
                    config,
                    "interrupted",
                    capabilities,
                    repository.failureCode(error),
                    repository.failureMessage(error),
                )
            }
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK = "entheos-health-connect-sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }
    }
}
