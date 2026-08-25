package app.entheos.salud

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.net.toUri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var store: SecureStore
    private lateinit var repository: HealthConnectRepository
    private val api = EntheosApi()
    private lateinit var accountText: TextView
    private lateinit var statusText: TextView
    private lateinit var primaryButton: Button
    private lateinit var manageButton: Button
    private lateinit var manualBox: LinearLayout
    private lateinit var codeInput: EditText
    private var busy = false

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { _ ->
        lifecycleScope.launch {
            val config = store.loadConfig()
            if (config == null) {
                showStatus("La cuenta todavía no está vinculada. Volvé a iniciar la conexión.", false)
                refreshState()
                return@launch
            }
            val capabilitiesResult = if (repository.sdkAvailable()) {
                runCatching { repository.grantedCapabilities() }
            } else {
                Result.success(emptySet())
            }
            if (capabilitiesResult.isFailure) {
                val error = requireNotNull(capabilitiesResult.exceptionOrNull())
                val cached = store.cachedGrantedCapabilities()
                runCatching {
                    api.reportStatus(config, "interrupted", cached, repository.failureCode(error), repository.failureMessage(error))
                }
                showStatus(repository.failureMessage(error), false)
                refreshState(keepMessage = true)
                return@launch
            }
            val capabilities = capabilitiesResult.getOrThrow()
            store.saveGrantedCapabilities(capabilities)
            if (capabilities.isEmpty()) {
                runCatching { api.reportStatus(config, "pending_permissions", capabilities) }
                showStatus("No se concedieron permisos de lectura. Podés elegirlos nuevamente cuando quieras.", false)
                refreshState()
            } else {
                SyncWorker.schedule(this@MainActivity)
                showStatus("Permisos concedidos. Iniciando la primera actualización…", true)
                synchronizeNow()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SecureStore(this)
        repository = HealthConnectRepository(this)
        buildInterface()
        handleIntent(intent)
        refreshState()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (::primaryButton.isInitialized && !busy) refreshState()
    }

    private fun buildInterface() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(26), dp(22), dp(40))
            setBackgroundColor(Color.rgb(243, 246, 242))
        }
        val scroll = ScrollView(this).apply { addView(root) }
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.entheos_mark)
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        root.addView(logo, LinearLayout.LayoutParams(dp(72), dp(72)).apply { gravity = Gravity.CENTER_HORIZONTAL })
        root.addView(title("Entheos", 28f).apply { gravity = Gravity.CENTER; setPadding(0, dp(12), 0, 0) })
        root.addView(body("Conectá una vez. Entheos leerá desde Health Connect únicamente las categorías que autorices y conservará la fuente original de cada dato.").apply { gravity = Gravity.CENTER; textAlignment = View.TEXT_ALIGNMENT_CENTER })
        root.addView(flowRow(), marginParams(top = 22))

        accountText = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.rgb(29, 55, 46))
            setBackgroundColor(Color.WHITE)
            setPadding(dp(15), dp(13), dp(15), dp(13))
        }
        root.addView(accountText, marginParams(top = 20))

        statusText = TextView(this).apply {
            textSize = 15f
            setTextColor(Color.rgb(35, 72, 58))
            setBackgroundColor(Color.rgb(224, 237, 226))
            setPadding(dp(15), dp(14), dp(15), dp(14))
        }
        root.addView(statusText, marginParams(top = 10))

        primaryButton = action("Conectar con mi cuenta de Entheos") { openEntheosConnect() }
        root.addView(primaryButton)
        manageButton = secondaryAction("Administrar permisos de Health Connect") { openHealthConnectSettings() }
        root.addView(manageButton)
        root.addView(body("Zepp seguirá enviando sus datos a Health Connect. Entheos solicita un permiso propio de sólo lectura; no modifica ni elimina información de Zepp."), marginParams(top = 16))

        val helpButton = secondaryAction("¿La apertura automática no funcionó?") {
            manualBox.visibility = if (manualBox.visibility == View.GONE) View.VISIBLE else View.GONE
        }
        root.addView(helpButton, marginParams(top = 24))
        manualBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setPadding(dp(14), dp(12), dp(14), dp(14))
            setBackgroundColor(Color.rgb(234, 240, 246))
        }
        manualBox.addView(body("Recurso técnico: ingresá el código temporal que aparece dentro de “Ayuda técnica” en Entheos web. No es tu contraseña."))
        codeInput = input("Código XXXX-XXXX").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        }
        manualBox.addView(codeInput)
        manualBox.addView(action("Usar código temporal") { pairCode(codeInput.text.toString()) })
        root.addView(manualBox, marginParams(top = 8))
        root.addView(secondaryAction("Abrir mi espacio web") { openEntheosSpace() }, marginParams(top = 18))
        setContentView(scroll)
    }

    private fun flowRow(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        setPadding(dp(8), dp(12), dp(8), dp(12))
        setBackgroundColor(Color.WHITE)
        addView(flowNode("Z", "Zepp"), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        addView(flowArrow())
        addView(flowNode("♥", "Health Connect"), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.35f))
        addView(flowArrow())
        addView(flowNode("E", "Entheos"), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    }

    private fun flowNode(symbol: String, label: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        addView(TextView(this@MainActivity).apply {
            text = symbol
            textSize = 19f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(40, 122, 91))
        }, LinearLayout.LayoutParams(dp(34), dp(32)))
        addView(TextView(this@MainActivity).apply {
            text = label
            textSize = 11f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(57, 74, 67))
        })
    }

    private fun flowArrow() = TextView(this).apply {
        text = "→"
        textSize = 17f
        setTextColor(Color.rgb(151, 165, 158))
    }

    private fun handleIntent(value: Intent?) {
        if (value?.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE") {
            showStatus(getString(R.string.health_permissions_rationale), true)
            return
        }
        val uri = value?.data ?: return
        val host = uri.host.orEmpty()
        val code = uri.getQueryParameter("code")
        val mode = uri.getQueryParameter("mode")
        when {
            !code.isNullOrBlank() && (host == "pair" || uri.path == "/connect/health-connect") -> pairCode(code)
            host == "sync" || mode == "sync" -> synchronizeNow()
            host == "permissions" || mode == "permissions" -> requestHealthPermissions()
        }
    }

    private fun pairCode(rawCode: String) {
        val code = rawCode.trim().uppercase()
        if (code.replace("-", "").length != 8) {
            showStatus("Ese acceso temporal no es válido. Volvé a Entheos web y tocá “Conectar en este teléfono”.", false)
            return
        }
        if (busy) return
        setBusy(true)
        showStatus("Reconociendo tu cuenta de Entheos…", true)
        lifecycleScope.launch {
            runCatching { api.pair(BuildConfig.ENTHEOS_BASE_URL, code) }
                .onSuccess { result ->
                    store.saveConfig(BuildConfig.ENTHEOS_BASE_URL, result.connectionId, result.token, result.tokenExpiresAt, result.accountDisplayName)
                    accountText.text = "Cuenta: ${result.accountDisplayName}"
                    showStatus("Cuenta reconocida. Ahora elegí los datos que Entheos puede leer.", true)
                    setBusy(false)
                    requestHealthPermissions()
                }
                .onFailure { error ->
                    showStatus(error.message ?: "No pudimos completar la conexión. Volvé a intentarlo desde Entheos web.", false)
                    setBusy(false)
                    refreshState()
                }
        }
    }

    private fun openEntheosConnect() {
        startActivity(Intent(Intent.ACTION_VIEW, "${BuildConfig.ENTHEOS_BASE_URL}/app?connect=health-connect".toUri()))
    }

    private fun openEntheosSpace() {
        startActivity(Intent(Intent.ACTION_VIEW, "${BuildConfig.ENTHEOS_BASE_URL}/app".toUri()))
    }

    private fun requestHealthPermissions() {
        if (store.loadConfig() == null) {
            showStatus("Primero tocá “Conectar con mi cuenta de Entheos”. No necesitás buscar ninguna clave.", false)
            return
        }
        when (repository.sdkStatus()) {
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                showStatus("Health Connect necesita una actualización antes de continuar.", false)
                openHealthConnectSettings()
                return
            }
            HealthConnectClient.SDK_UNAVAILABLE -> {
                showStatus("Health Connect no está disponible en este teléfono.", false)
                return
            }
        }
        lifecycleScope.launch {
            runCatching { repository.requestablePermissions() }
                .onSuccess { permissionLauncher.launch(it) }
                .onFailure { showStatus(it.message ?: "No pudimos abrir los permisos de Health Connect.", false) }
        }
    }

    private fun synchronizeNow() {
        val config = store.loadConfig()
        if (config == null) {
            showStatus("Este teléfono todavía no está conectado con tu cuenta de Entheos.", false)
            return
        }
        if (busy) return
        setBusy(true)
        showStatus("Preparando la conexión con Health Connect…", true)
        lifecycleScope.launch {
            val capabilitiesResult = runCatching { repository.grantedCapabilities() }
            if (capabilitiesResult.isFailure) {
                val error = requireNotNull(capabilitiesResult.exceptionOrNull())
                val cached = store.cachedGrantedCapabilities()
                runCatching {
                    api.reportStatus(config, "interrupted", cached, repository.failureCode(error), repository.failureMessage(error))
                }
                showStatus(repository.failureMessage(error), false)
                setBusy(false)
                refreshState(keepMessage = true)
                return@launch
            }
            val capabilities = capabilitiesResult.getOrThrow()
            store.saveGrantedCapabilities(capabilities)
            if (capabilities.isEmpty()) {
                runCatching { api.reportStatus(config, "pending_permissions", capabilities) }
                showStatus("Falta autorizar la lectura. Android abrirá el selector oficial de Health Connect.", true)
                setBusy(false)
                requestHealthPermissions()
                return@launch
            }
            val initialSync = store.lastSyncMillis() <= 0L
            showStatus(
                if (initialSync) "Comprobando cada categoría de Health Connect…" else "Actualizando cada categoría por separado…",
                true,
            )
            runCatching { repository.synchronize(config, store, api) }
                .onSuccess { outcome ->
                    SyncWorker.schedule(this@MainActivity)
                    val retryNote = if (outcome.failedCapabilities.isNotEmpty()) {
                        val pending = outcome.failedCapabilities.take(3)
                            .joinToString(", ") { repository.capabilityLabel(it) }
                        " Quedaron pendientes: $pending; Entheos las reintentará sin bloquear el resto."
                    } else ""
                    val message = if (outcome.records > 0) {
                        val history = if (outcome.historicalRecords > 0) " · ${outcome.historicalRecords} históricas" else ""
                        "Se integraron ${outcome.recentRecords} mediciones recientes$history en ${outcome.succeededCapabilities.size} categorías. Fuentes detectadas: ${outcome.dataOrigins.size}.$retryNote"
                    } else {
                        "Entheos pudo leer ${outcome.succeededCapabilities.size} categorías, pero no encontró mediciones en los intervalos iniciales.$retryNote"
                    }
                    showStatus(message, true)
                }
                .onFailure { error ->
                    val knownCapabilities = runCatching {
                        repository.grantedCapabilities().also(store::saveGrantedCapabilities)
                    }.getOrDefault(store.cachedGrantedCapabilities())
                    runCatching {
                        api.reportStatus(
                            config,
                            "interrupted",
                            knownCapabilities,
                            repository.failureCode(error),
                            repository.failureMessage(error),
                        )
                    }
                    showStatus(repository.failureMessage(error), false)
                }
            setBusy(false)
            refreshState(keepMessage = true)
        }
    }

    private fun refreshState(keepMessage: Boolean = false) {
        if (!::primaryButton.isInitialized || busy) return
        val config = store.loadConfig()
        accountText.text = if (config == null) "Cuenta: todavía no vinculada" else "Cuenta: ${config.accountDisplayName}"
        when (repository.sdkStatus()) {
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                configurePrimary("Actualizar Health Connect") { openHealthConnectSettings() }
                if (!keepMessage) showStatus("Health Connect está instalado, pero necesita actualizarse.", false)
            }
            HealthConnectClient.SDK_UNAVAILABLE -> {
                configurePrimary("Health Connect no disponible") { openHealthConnectSettings() }
                if (!keepMessage) showStatus("Este teléfono no ofrece una versión compatible de Health Connect.", false)
            }
            else -> {
                manageButton.isEnabled = true
                if (config == null) {
                    configurePrimary("Conectar con mi cuenta de Entheos") { openEntheosConnect() }
                    if (!keepMessage) showStatus("Listo para conectar. No necesitás copiar ni inventar ninguna clave.", true)
                } else lifecycleScope.launch {
                    runCatching { repository.grantedCapabilities() }
                        .onSuccess { capabilities ->
                            store.saveGrantedCapabilities(capabilities)
                            if (capabilities.isEmpty()) {
                                configurePrimary("Autorizar Health Connect") { requestHealthPermissions() }
                                if (!keepMessage) showStatus("Cuenta vinculada. Falta elegir los permisos de lectura de Health Connect.", true)
                            } else {
                                configurePrimary("Sincronizar ahora") { synchronizeNow() }
                                if (!keepMessage) showStatus("Conexión activa · ${capabilities.size} categorías autorizadas.", true)
                            }
                        }
                        .onFailure { error ->
                            configurePrimary("Reintentar conexión") { synchronizeNow() }
                            if (!keepMessage) showStatus(repository.failureMessage(error), false)
                        }
                }
            }
        }
    }

    private fun configurePrimary(label: String, onClick: () -> Unit) {
        primaryButton.text = label
        primaryButton.isEnabled = !busy
        primaryButton.setOnClickListener { onClick() }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        if (::primaryButton.isInitialized) primaryButton.isEnabled = !value
        if (::manageButton.isInitialized) manageButton.isEnabled = !value
    }

    private fun openHealthConnectSettings() {
        val primary = when (repository.sdkStatus()) {
            HealthConnectClient.SDK_AVAILABLE -> HealthConnectClient.getHealthConnectManageDataIntent(this)
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> Intent(Intent.ACTION_VIEW, "market://details?id=com.google.android.apps.healthdata".toUri())
            else -> Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata".toUri())
        }
        try {
            startActivity(primary)
        } catch (_: ActivityNotFoundException) {
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata".toUri())) }
                .onFailure { showStatus("No pudimos abrir Health Connect desde este teléfono.", false) }
        }
    }

    private fun showStatus(message: String, positive: Boolean) {
        if (!::statusText.isInitialized) return
        statusText.text = message
        statusText.setBackgroundColor(if (positive) Color.rgb(224, 237, 226) else Color.rgb(249, 226, 213))
        statusText.setTextColor(if (positive) Color.rgb(35, 72, 58) else Color.rgb(132, 68, 38))
    }

    private fun title(text: String, size: Float) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(Color.rgb(29, 55, 46))
    }

    private fun body(text: String) = TextView(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.rgb(91, 110, 102))
        setLineSpacing(0f, 1.25f)
        layoutParams = marginParams(top = 10)
    }

    private fun input(hintValue: String) = EditText(this).apply {
        hint = hintValue
        textSize = 16f
        setSingleLine(true)
        setPadding(dp(14), dp(12), dp(14), dp(12))
        layoutParams = marginParams(top = 9)
    }

    private fun action(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 16f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(40, 122, 91))
        setOnClickListener { onClick() }
        layoutParams = marginParams(top = 11, height = 54)
    }

    private fun secondaryAction(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 14f
        setTextColor(Color.rgb(40, 122, 91))
        setBackgroundColor(Color.WHITE)
        setOnClickListener { onClick() }
        layoutParams = marginParams(top = 9, height = 50)
    }

    private fun marginParams(top: Int = 0, height: Int = ViewGroup.LayoutParams.WRAP_CONTENT) =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, if (height == ViewGroup.LayoutParams.WRAP_CONTENT) height else dp(height)).apply {
            topMargin = dp(top)
        }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
