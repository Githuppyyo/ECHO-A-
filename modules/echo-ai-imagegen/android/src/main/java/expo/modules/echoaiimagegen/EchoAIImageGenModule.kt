package expo.modules.echoaiimagegen

import android.app.ActivityManager
import android.app.DownloadManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class EchoAIImageGenModule : Module() {
  private val executor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "echo-ai-imagegen").apply { isDaemon = true }
  }
  private val destroyed = AtomicBoolean(false)
  private val generationStep = AtomicInteger(0)
  private val generationTotal = AtomicInteger(4)
  private val generationCancelled = AtomicBoolean(false)

  override fun definition() = ModuleDefinition {
    Name("EchoAIImageGen")

    AsyncFunction("getState") { promise: Promise ->
      runBackground(promise) { stateSnapshot() }
    }

    AsyncFunction("acceptModelLicense") { promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_IMAGE_CONTEXT", "ECHO AI uygulama alanına erişilemiyor.", null)
      } else {
        preferences(context).edit().putString(PREF_LICENSE_ACCEPTED, LICENSE_ID).commit()
        promise.resolve(true)
      }
    }

    AsyncFunction("startModelDownload") { wifiOnly: Boolean, promise: Promise ->
      runBackground(promise) { startModelDownload(wifiOnly) }
    }

    AsyncFunction("cancelModelDownload") { promise: Promise ->
      runBackground(promise) { cancelModelDownload() }
    }

    AsyncFunction("generatePng") { prompt: String, promise: Promise ->
      runBackground(promise) { generatePng(prompt) }
    }

    Function("getGenerationProgress") {
      mapOf(
        "step" to generationStep.get(),
        "total" to generationTotal.get(),
        "cancelled" to generationCancelled.get(),
      )
    }

    Function("cancelGeneration") {
      generationCancelled.set(true)
      if (NativeImageEngine.ensureLoaded()) {
        try {
          NativeImageEngine.cancelNative()
        } catch (_: UnsatisfiedLinkError) {
          // The Android runtime is optional until the user opens the image workspace.
        }
      }
    }

    AsyncFunction("releaseModelContext") { promise: Promise ->
      runBackground(promise) {
        if (NativeImageEngine.ensureLoaded()) NativeImageEngine.releaseNative()
        null
      }
    }

    OnDestroy {
      destroyed.set(true)
      try {
        executor.execute {
          if (NativeImageEngine.ensureLoaded()) NativeImageEngine.releaseNative()
        }
        executor.shutdown()
      } catch (_: Exception) {
        // The process is already shutting down; Android will release native memory.
      }
    }
  }

  private fun runBackground(promise: Promise, operation: () -> Any?) {
    if (destroyed.get()) {
      promise.reject("E_IMAGE_MODULE_DESTROYED", "ECHO AI görsel modülü kapatıldı.", null)
      return
    }
    try {
      executor.execute {
        try {
          promise.resolve(operation())
        } catch (error: ImageGenException) {
          promise.reject(error.code, error.message, error.cause)
        } catch (error: OutOfMemoryError) {
          promise.reject("E_IMAGE_MEMORY", "Bu cihazda görsel üretimi için yeterli bellek yok.", error)
        } catch (error: Throwable) {
          promise.reject("E_IMAGE_OPERATION", "ECHO AI görsel işlemi tamamlanamadı.", error)
        }
      }
    } catch (error: Exception) {
      promise.reject("E_IMAGE_EXECUTOR", "ECHO AI görsel işlemi başlatılamadı.", error)
    }
  }

  private fun appContextOrThrow(): Context =
    appContext.reactContext?.applicationContext
      ?: throw ImageGenException("E_IMAGE_CONTEXT", "ECHO AI uygulama alanına erişilemiyor.")

  private fun preferences(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun modelDirectory(context: Context): File =
    context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: throw ImageGenException("E_IMAGE_STORAGE", "İndirilecek dosyalar için cihaz alanı bulunamadı.")

  private fun modelFile(context: Context): File = File(modelDirectory(context), MODEL_FILE_NAME)
  private fun taesdFile(context: Context): File = File(modelDirectory(context), TAESD_FILE_NAME)

  private fun startModelDownload(wifiOnly: Boolean): Map<String, Any?> {
    val context = appContextOrThrow()
    val prefs = preferences(context)
    ensureLicenseAccepted(prefs)
    if (totalRamBytes(context) < MINIMUM_RAM_BYTES) {
      throw ImageGenException("E_IMAGE_DEVICE_UNSUPPORTED", "Bu cihaz görsel üretimi için en az 6 GB RAM gerektiriyor.")
    }
    if (!NativeImageEngine.ensureLoaded()) {
      throw ImageGenException("E_IMAGE_RUNTIME_MISSING", "ECHO AI görsel motoru bu Android cihazında kullanılamıyor.")
    }
    val directory = modelDirectory(context)
    directory.mkdirs()
    val freeBytes = StatFs(directory.absolutePath).availableBytes
    if (freeBytes < REQUIRED_FREE_BYTES) {
      throw ImageGenException("E_IMAGE_STORAGE_LOW", "Görsel modelini indirmek için en az 2,08 GB boş alan gerekli.")
    }

    prefs.edit().remove(PREF_ERROR).commit()
    val manager = downloadManager(context)
    ensurePartDownload(context, manager, prefs, MODEL_URL, MODEL_FILE_NAME, MODEL_BYTES, MODEL_SHA256, PREF_MODEL_ID, PREF_MODEL_HASH, wifiOnly)
    ensurePartDownload(context, manager, prefs, TAESD_URL, TAESD_FILE_NAME, TAESD_BYTES, TAESD_SHA256, PREF_TAESD_ID, PREF_TAESD_HASH, wifiOnly)
    return stateSnapshot()
  }

  private fun cancelModelDownload(): Map<String, Any?> {
    val context = appContextOrThrow()
    val manager = downloadManager(context)
    val prefs = preferences(context)
    listOf(PREF_MODEL_ID, PREF_TAESD_ID).forEach { key ->
      val id = prefs.getLong(key, NO_DOWNLOAD_ID)
      if (id != NO_DOWNLOAD_ID) {
        try { manager.remove(id) } catch (_: Exception) { }
      }
    }
    listOf(modelFile(context), taesdFile(context)).forEach { file ->
      if (file.exists() && file.length() > 0L) file.delete()
    }
    prefs.edit()
      .remove(PREF_MODEL_ID)
      .remove(PREF_TAESD_ID)
      .remove(PREF_MODEL_HASH)
      .remove(PREF_TAESD_HASH)
      .remove(PREF_ERROR)
      .commit()
    return stateSnapshot()
  }

  private fun stateSnapshot(): Map<String, Any?> {
    val context = appContextOrThrow()
    val prefs = preferences(context)
    val accepted = prefs.getString(PREF_LICENSE_ACCEPTED, null) == LICENSE_ID
    val directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
    val availableBytes = try { directory?.let { StatFs(it.absolutePath).availableBytes } ?: 0L } catch (_: Exception) { 0L }
    val manager = downloadManager(context)
    val modelPart = readPart(context, manager, prefs, MODEL_FILE_NAME, MODEL_BYTES, MODEL_SHA256, PREF_MODEL_ID, PREF_MODEL_HASH)
    val taesdPart = readPart(context, manager, prefs, TAESD_FILE_NAME, TAESD_BYTES, TAESD_SHA256, PREF_TAESD_ID, PREF_TAESD_HASH)
    val totalDownloaded = (modelPart.downloadedBytes + taesdPart.downloadedBytes).coerceAtMost(TOTAL_MODEL_BYTES)
    val phase = when {
      modelPart.phase == PHASE_COMPLETE && taesdPart.phase == PHASE_COMPLETE -> PHASE_COMPLETE
      modelPart.phase == PHASE_RUNNING || taesdPart.phase == PHASE_RUNNING -> PHASE_RUNNING
      modelPart.phase == PHASE_PENDING || taesdPart.phase == PHASE_PENDING -> PHASE_PENDING
      modelPart.phase == PHASE_PAUSED || taesdPart.phase == PHASE_PAUSED -> PHASE_PAUSED
      modelPart.phase == PHASE_FAILED || taesdPart.phase == PHASE_FAILED -> PHASE_FAILED
      else -> PHASE_NONE
    }
    if (phase == PHASE_COMPLETE) prefs.edit().remove(PREF_ERROR).commit()
    val ramBytes = totalRamBytes(context)
    val runtimeAvailable = NativeImageEngine.ensureLoaded()
    val errorCode = prefs.getString(PREF_ERROR, null)
      ?: if (phase == PHASE_FAILED) "download-or-integrity" else null
    return mapOf(
      "phase" to phase,
      "progress" to if (TOTAL_MODEL_BYTES > 0L) ((totalDownloaded * 100L) / TOTAL_MODEL_BYTES).toInt().coerceIn(0, 100) else 0,
      "downloadedBytes" to totalDownloaded,
      "totalBytes" to TOTAL_MODEL_BYTES,
      "availableBytes" to availableBytes,
      "requiredFreeBytes" to REQUIRED_FREE_BYTES,
      "deviceRamBytes" to ramBytes,
      "licenseAccepted" to accepted,
      "runtimeAvailable" to runtimeAvailable,
      "canGenerate" to (accepted && phase == PHASE_COMPLETE && runtimeAvailable && ramBytes >= MINIMUM_RAM_BYTES),
      "error" to errorCode,
    )
  }

  private fun ensurePartDownload(
    context: Context,
    manager: DownloadManager,
    prefs: SharedPreferences,
    url: String,
    fileName: String,
    expectedBytes: Long,
    expectedHash: String,
    idKey: String,
    hashKey: String,
    wifiOnly: Boolean,
  ) {
    val part = readPart(context, manager, prefs, fileName, expectedBytes, expectedHash, idKey, hashKey)
    if (part.phase == PHASE_COMPLETE || part.phase == PHASE_RUNNING || part.phase == PHASE_PENDING || part.phase == PHASE_PAUSED) return
    val oldId = prefs.getLong(idKey, NO_DOWNLOAD_ID)
    if (oldId != NO_DOWNLOAD_ID) {
      try { manager.remove(oldId) } catch (_: Exception) { }
    }
    val file = File(modelDirectory(context), fileName)
    if (file.exists()) file.delete()
    prefs.edit().remove(idKey).remove(hashKey).commit()

    val uri = Uri.parse(url)
    if (!uri.scheme.equals("https", ignoreCase = true) || !uri.host.equals(ALLOWED_HOST, ignoreCase = true)) {
      throw ImageGenException("E_IMAGE_MODEL_URL", "ECHO AI görsel modeli için güvenli indirme bağlantısı kullanılamıyor.")
    }
    try {
      val allowedNetworks = if (wifiOnly) DownloadManager.Request.NETWORK_WIFI
      else DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
      val request = DownloadManager.Request(uri)
        .setTitle("ECHO AI görsel modeli")
        .setDescription("İndirme tamamlanınca PNG görsellerini çevrimdışı oluşturabilirsin.")
        .setMimeType("application/octet-stream")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setAllowedNetworkTypes(allowedNetworks)
        .setAllowedOverMetered(!wifiOnly)
        .setAllowedOverRoaming(false)
        .setVisibleInDownloadsUi(true)
        .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
      val id = manager.enqueue(request)
      prefs.edit().putLong(idKey, id).commit()
    } catch (error: Exception) {
      prefs.edit().putString(PREF_ERROR, "download-start-failed").commit()
      throw ImageGenException("E_IMAGE_DOWNLOAD_START", "ECHO AI görsel modeli indirilemedi. Yeniden deneyebilirsin.", error)
    }
  }

  private fun readPart(
    context: Context,
    manager: DownloadManager,
    prefs: SharedPreferences,
    fileName: String,
    expectedBytes: Long,
    expectedHash: String,
    idKey: String,
    hashKey: String,
  ): PartState {
    val file = File(modelDirectory(context), fileName)
    var id = prefs.getLong(idKey, NO_DOWNLOAD_ID)
    if (id == NO_DOWNLOAD_ID) {
      id = findExistingDownloadId(manager, fileName) ?: NO_DOWNLOAD_ID
      if (id != NO_DOWNLOAD_ID) prefs.edit().putLong(idKey, id).commit()
    }

    if (file.isFile && file.length() == expectedBytes) {
      if (validateModelPart(file, prefs, expectedBytes, expectedHash, hashKey)) {
        return PartState(PHASE_COMPLETE, expectedBytes, expectedBytes)
      }
      if (id != NO_DOWNLOAD_ID) try { manager.remove(id) } catch (_: Exception) { }
      file.delete()
      prefs.edit().remove(idKey).remove(hashKey).putString(PREF_ERROR, "integrity-check-failed").commit()
      return PartState(PHASE_FAILED, 0L, expectedBytes)
    }

    if (id == NO_DOWNLOAD_ID) {
      if (file.exists()) file.delete()
      return PartState(PHASE_NONE, 0L, expectedBytes)
    }

    val cursor = try { manager.query(DownloadManager.Query().setFilterById(id)) } catch (_: Exception) { null }
      ?: return PartState(PHASE_FAILED, 0L, expectedBytes)
    cursor.use {
      if (!it.moveToFirst()) {
        prefs.edit().remove(idKey).commit()
        return PartState(PHASE_NONE, 0L, expectedBytes)
      }
      val statusIndex = it.getColumnIndex(DownloadManager.COLUMN_STATUS)
      val bytesIndex = it.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
      val reasonIndex = it.getColumnIndex(DownloadManager.COLUMN_REASON)
      val status = if (statusIndex >= 0) it.getInt(statusIndex) else -1
      val downloaded = if (bytesIndex >= 0) it.getLong(bytesIndex).coerceAtLeast(0L) else 0L
      val reason = if (reasonIndex >= 0) it.getInt(reasonIndex) else -1
      return when (status) {
        DownloadManager.STATUS_PENDING -> PartState(PHASE_PENDING, downloaded, expectedBytes, reason)
        DownloadManager.STATUS_RUNNING -> PartState(PHASE_RUNNING, downloaded, expectedBytes, reason)
        DownloadManager.STATUS_PAUSED -> PartState(PHASE_PAUSED, downloaded, expectedBytes, reason)
        DownloadManager.STATUS_SUCCESSFUL -> {
          if (file.isFile && file.length() == expectedBytes && validateModelPart(file, prefs, expectedBytes, expectedHash, hashKey)) {
            PartState(PHASE_COMPLETE, expectedBytes, expectedBytes)
          } else {
            try { manager.remove(id) } catch (_: Exception) { }
            if (file.exists()) file.delete()
            prefs.edit().remove(idKey).remove(hashKey).putString(PREF_ERROR, "integrity-check-failed").commit()
            PartState(PHASE_FAILED, 0L, expectedBytes, INVALID_FILE_REASON)
          }
        }
        DownloadManager.STATUS_FAILED -> PartState(PHASE_FAILED, downloaded, expectedBytes, reason)
        else -> PartState(PHASE_FAILED, downloaded, expectedBytes, reason)
      }
    }
  }

  private fun findExistingDownloadId(manager: DownloadManager, fileName: String): Long? {
    val cursor = try { manager.query(DownloadManager.Query()) } catch (_: Exception) { null } ?: return null
    cursor.use {
      val idIndex = it.getColumnIndex(DownloadManager.COLUMN_ID)
      val uriIndex = it.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
      if (idIndex < 0 || uriIndex < 0) return null
      var newest: Long? = null
      while (it.moveToNext()) {
        val localUri = it.getString(uriIndex) ?: continue
        val name = try { Uri.parse(localUri).lastPathSegment } catch (_: Exception) { null }
        if (name != fileName) continue
        val candidate = it.getLong(idIndex)
        if (newest == null || candidate > newest) newest = candidate
      }
      return newest
    }
  }

  private fun validateModelPart(file: File, prefs: SharedPreferences, expectedBytes: Long, expectedHash: String, hashKey: String): Boolean {
    if (!file.isFile || file.length() != expectedBytes) return false
    val verified = prefs.getString(hashKey, null) == expectedHash
    val verifiedModified = prefs.getLong("${hashKey}_mtime", -1L) == file.lastModified()
    if (verified && verifiedModified) return true
    val actual = try { sha256(file) } catch (_: Exception) { return false }
    if (actual != expectedHash) return false
    prefs.edit().putString(hashKey, expectedHash).putLong("${hashKey}_mtime", file.lastModified()).commit()
    return true
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered(HASH_BUFFER_BYTES).use { input ->
      val buffer = ByteArray(HASH_BUFFER_BYTES)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
  }

  private fun generatePng(rawPrompt: String): String {
    val context = appContextOrThrow()
    val prefs = preferences(context)
    ensureLicenseAccepted(prefs)
    val prompt = rawPrompt.trim()
    if (prompt.isEmpty() || prompt.length > MAX_PROMPT_CHARS) {
      throw ImageGenException("E_IMAGE_PROMPT", "Görsel tarifi 1–500 karakter arasında olmalı.")
    }
    if (totalRamBytes(context) < MINIMUM_RAM_BYTES) {
      throw ImageGenException("E_IMAGE_DEVICE_UNSUPPORTED", "Bu cihazın belleği ilk sürüm için yetersiz.")
    }
    val model = modelFile(context)
    val taesd = taesdFile(context)
    if (!validateModelPart(model, prefs, MODEL_BYTES, MODEL_SHA256, PREF_MODEL_HASH) ||
      !validateModelPart(taesd, prefs, TAESD_BYTES, TAESD_SHA256, PREF_TAESD_HASH)) {
      throw ImageGenException("E_IMAGE_MODEL_NOT_READY", "Görsel modeli eksik veya doğrulanmamış. İndirmeyi tamamla.")
    }
    if (!NativeImageEngine.ensureLoaded()) {
      throw ImageGenException("E_IMAGE_RUNTIME_MISSING", "ECHO AI görsel motoru bu cihazda başlatılamadı.")
    }

    generationCancelled.set(false)
    generationStep.set(0)
    generationTotal.set(4)
    val rgba = try {
      NativeImageEngine.generateNative(prompt, model.absolutePath, taesd.absolutePath) { step, total ->
        generationStep.set(step.coerceAtLeast(0))
        generationTotal.set(total.coerceAtLeast(1))
      }
    } catch (error: UnsatisfiedLinkError) {
      throw ImageGenException("E_IMAGE_RUNTIME_MISSING", "ECHO AI görsel motoru bu cihazda başlatılamadı.", error)
    }
    if (generationCancelled.get()) throw ImageGenException("E_IMAGE_CANCELLED", "Görsel üretimi durduruldu.")
    if (rgba == null || rgba.size != IMAGE_WIDTH * IMAGE_HEIGHT * 4) {
      throw ImageGenException("E_IMAGE_GENERATION", "ECHO AI görseli oluşturamadı. Farklı bir tarif deneyebilirsin.")
    }

    val pixels = IntArray(IMAGE_WIDTH * IMAGE_HEIGHT)
    for (index in pixels.indices) {
      val offset = index * 4
      val red = rgba[offset].toInt() and 0xff
      val green = rgba[offset + 1].toInt() and 0xff
      val blue = rgba[offset + 2].toInt() and 0xff
      val alpha = rgba[offset + 3].toInt() and 0xff
      pixels[index] = Color.argb(alpha, red, green, blue)
    }
    val bitmap = Bitmap.createBitmap(pixels, IMAGE_WIDTH, IMAGE_HEIGHT, Bitmap.Config.ARGB_8888)
    val outputDirectory = File(context.filesDir, "generated-images")
    if (!outputDirectory.exists() && !outputDirectory.mkdirs()) {
      bitmap.recycle()
      throw ImageGenException("E_IMAGE_SAVE", "PNG için cihazda dosya alanı açılamadı.")
    }
    val outputFile = File(outputDirectory, "echo-ai-${System.currentTimeMillis()}.png")
    try {
      FileOutputStream(outputFile).use { stream ->
        if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
          throw ImageGenException("E_IMAGE_SAVE", "PNG dosyası kaydedilemedi.")
        }
      }
    } catch (error: Exception) {
      outputFile.delete()
      if (error is ImageGenException) throw error
      throw ImageGenException("E_IMAGE_SAVE", "PNG dosyası kaydedilemedi.", error)
    } finally {
      bitmap.recycle()
    }
    return Uri.fromFile(outputFile).toString()
  }

  private fun ensureLicenseAccepted(prefs: SharedPreferences) {
    if (prefs.getString(PREF_LICENSE_ACCEPTED, null) != LICENSE_ID) {
      throw ImageGenException("E_IMAGE_LICENSE_REQUIRED", "Görsel modelini kullanmadan önce lisans koşullarını kabul etmelisin.")
    }
  }

  private fun totalRamBytes(context: Context): Long {
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return 0L
    val info = ActivityManager.MemoryInfo()
    manager.getMemoryInfo(info)
    return info.totalMem
  }

  private fun downloadManager(context: Context): DownloadManager =
    context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  private data class PartState(
    val phase: String,
    val downloadedBytes: Long,
    val totalBytes: Long,
    val reason: Int? = null,
  )

  private class ImageGenException(
    val code: String,
    override val message: String,
    override val cause: Throwable? = null,
  ) : Exception(message, cause)

  private companion object {
    const val PREFERENCES_NAME = "echo_ai_imagegen"
    const val PREF_LICENSE_ACCEPTED = "accepted_model_license"
    const val PREF_MODEL_ID = "model_download_id"
    const val PREF_TAESD_ID = "taesd_download_id"
    const val PREF_MODEL_HASH = "model_verified_sha256"
    const val PREF_TAESD_HASH = "taesd_verified_sha256"
    const val PREF_ERROR = "last_error"
    const val LICENSE_ID = "creative-ml-open-rail-m-2022-08-22-v1"
    const val NO_DOWNLOAD_ID = -1L
    const val ALLOWED_HOST = "huggingface.co"
    const val MODEL_FILE_NAME = "echo-ai-image-model.gguf"
    const val TAESD_FILE_NAME = "echo-ai-image-decoder.safetensors"
    const val MODEL_BYTES = 1_802_206_336L
    const val TAESD_BYTES = 9_793_292L
    const val TOTAL_MODEL_BYTES = MODEL_BYTES + TAESD_BYTES
    const val STORAGE_HEADROOM_BYTES = 268_435_456L
    const val REQUIRED_FREE_BYTES = TOTAL_MODEL_BYTES + STORAGE_HEADROOM_BYTES
    const val MINIMUM_RAM_BYTES = 6_442_450_944L
    const val MAX_PROMPT_CHARS = 500
    const val IMAGE_WIDTH = 512
    const val IMAGE_HEIGHT = 512
    const val HASH_BUFFER_BYTES = 1024 * 1024
    const val PHASE_NONE = "none"
    const val PHASE_PENDING = "pending"
    const val PHASE_RUNNING = "running"
    const val PHASE_PAUSED = "paused"
    const val PHASE_COMPLETE = "complete"
    const val PHASE_FAILED = "failed"
    const val INVALID_FILE_REASON = -1101
    const val MODEL_URL = "https://huggingface.co/NishQ1/vora-create-sd15/resolve/990b82c686c3c047df2f1926460b4915773d64c5/vora-create-dreamshaper8-lcm-q8_0.gguf?download=true"
    const val TAESD_URL = "https://huggingface.co/NishQ1/vora-create-sd15/resolve/990b82c686c3c047df2f1926460b4915773d64c5/taesd.safetensors?download=true"
    const val MODEL_SHA256 = "dd06826d1eca711efa38190395a5ee949d0427fc6422c39433358a815e5b066c"
    const val TAESD_SHA256 = "db169d69145ec4ff064e49d99c95fa05d3eb04ee453de35824a6d0f325513549"
  }
}
