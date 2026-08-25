package app.entheos.salud

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class BridgeConfig(
    val server: String,
    val connectionId: String,
    val token: String,
    val tokenExpiresAt: String,
    val accountDisplayName: String,
)

class SecureStore(context: Context) {
    private val preferences = context.getSharedPreferences("entheos_bridge_v1", Context.MODE_PRIVATE)
    private val alias = "entheos_bridge_token_v1"

    fun saveConfig(server: String, connectionId: String, token: String, tokenExpiresAt: String, accountDisplayName: String) {
        val changedAccount = preferences.getString("connection_id", null) != connectionId
        val accountScopedKeys = if (changedAccount) {
            preferences.all.keys.filter { key ->
                key == "last_sync_millis" ||
                    key == "history_cursor_millis" ||
                    key == "history_metric_index" ||
                    key == "metric_cursors_v1_initialized" ||
                    key == "granted_capabilities" ||
                    key.startsWith("metric_sync_") ||
                    key.startsWith("metric_history_")
            }
        } else emptyList()
        preferences.edit {
            putString("server", server.trimEnd('/'))
            putString("connection_id", connectionId)
            putString("token_encrypted", encrypt(token))
            putString("token_expires_at", tokenExpiresAt)
            putString("account_display_name", accountDisplayName)
            if (changedAccount) {
                accountScopedKeys.forEach(::remove)
            }
        }
    }

    fun loadConfig(): BridgeConfig? {
        val server = preferences.getString("server", null) ?: return null
        val connectionId = preferences.getString("connection_id", null) ?: return null
        val encryptedToken = preferences.getString("token_encrypted", null) ?: return null
        val tokenExpiresAt = preferences.getString("token_expires_at", "") ?: ""
        val accountDisplayName = preferences.getString("account_display_name", "Mi cuenta de Entheos") ?: "Mi cuenta de Entheos"
        return try {
            BridgeConfig(server, connectionId, decrypt(encryptedToken), tokenExpiresAt, accountDisplayName)
        } catch (_: Exception) {
            clear()
            null
        }
    }

    fun lastSyncMillis(): Long = preferences.getLong("last_sync_millis", 0L)

    fun saveLastSyncMillis(value: Long) {
        preferences.edit { putLong("last_sync_millis", value) }
    }

    fun historyCursorMillis(): Long = preferences.getLong("history_cursor_millis", 0L)

    fun saveHistoryCursorMillis(value: Long) {
        preferences.edit { putLong("history_cursor_millis", value) }
    }

    fun initializeMetricCursors(capabilities: Set<String>) {
        if (preferences.getBoolean("metric_cursors_v1_initialized", false)) return
        val legacyCursor = lastSyncMillis()
        preferences.edit {
            if (legacyCursor > 0L) {
                capabilities.forEach { capability -> putLong(metricSyncKey(capability), legacyCursor) }
            }
            putBoolean("metric_cursors_v1_initialized", true)
        }
    }

    fun metricSyncMillis(capability: String): Long = preferences.getLong(metricSyncKey(capability), 0L)

    fun saveMetricSyncMillis(capability: String, value: Long) {
        preferences.edit { putLong(metricSyncKey(capability), value) }
    }

    fun metricHistoryCursorMillis(capability: String): Long =
        preferences.getLong(metricHistoryKey(capability), 0L)

    fun saveMetricHistoryCursorMillis(capability: String, value: Long) {
        preferences.edit { putLong(metricHistoryKey(capability), value) }
    }

    fun historyMetricIndex(): Int = preferences.getInt("history_metric_index", 0)

    fun saveHistoryMetricIndex(value: Int) {
        preferences.edit { putInt("history_metric_index", value) }
    }

    fun cachedGrantedCapabilities(): Set<String> =
        preferences.getStringSet("granted_capabilities", emptySet())?.toSet() ?: emptySet()

    fun saveGrantedCapabilities(values: Set<String>) {
        preferences.edit { putStringSet("granted_capabilities", values.toSet()) }
    }

    fun clear() {
        preferences.edit { clear() }
    }

    private fun metricSyncKey(capability: String) = "metric_sync_${capability.replace(Regex("[^a-z0-9_]"), "_")}"

    private fun metricHistoryKey(capability: String) = "metric_history_${capability.replace(Regex("[^a-z0-9_]"), "_")}"

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val payload = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(value: String): String {
        val payload = Base64.decode(value, Base64.NO_WRAP)
        require(payload.size > 12) { "Invalid encrypted value" }
        val iv = payload.copyOfRange(0, 12)
        val ciphertext = payload.copyOfRange(12, payload.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }
}
