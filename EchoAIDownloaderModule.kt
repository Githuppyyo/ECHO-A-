package expo.modules.echoaidownloader

import android.app.DownloadManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Environment
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

class EchoAIDownloaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchoAIDownloader")

    AsyncFunction("getState") {
      readState()
    }

    AsyncFunction("startDownload") { url: String ->
      enqueueDownload(url)
    }
  }

  private fun appContextOrThrow(): Context =
    appContext.reactContext ?: throw IllegalStateException("Application context is unavailable")

  private fun downloadManager(context: Context): DownloadManager =
    context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  private fun preferences(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun modelFile(context: Context): File? =
    context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.let { File(it, MODEL_FILE_NAME) }

  private fun enqueueDownload(url: String): Map<String, Any?> {
    val context = appContextOrThrow()
    val manager = downloadManager(context)
    val prefs = preferences(context)
    val existing = readState()
    val existingPhase = existing["phase"] as? String
    if (existingPhase == "pending" || existingPhase == "running" ||
      existingPhase == "paused" || existingPhase == "complete") {
      return existing
    }

    val uri = Uri.parse(url)
    if (!uri.scheme.equals("https", ignoreCase = true) ||
      !uri.host.equals(ALLOWED_HOST, ignoreCase = true)) {
      return snapshot("failed", reason = INVALID_URL_REASON)
    }

    val oldId = prefs.getLong(PREFERENCE_DOWNLOAD_ID, NO_DOWNLOAD_ID)
    if (oldId != NO_DOWNLOAD_ID) manager.remove(oldId)
    prefs.edit()
      .remove(PREFERENCE_DOWNLOAD_ID)
      .remove(PREFERENCE_VERIFIED_SHA256)
      .commit()

    return try {
      val request = DownloadManager.Request(uri)
        .setTitle("ECHO AI kuruluyor...")
        .setDescription("İndirme sürüyor; uygulamayı kullanmaya devam edebilirsin.")
        .setMimeType("application/octet-stream")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setAllowedOverMetered(false)
        .setAllowedOverRoaming(false)
        .setVisibleInDownloadsUi(true)
        .setDestinationInExternalFilesDir(
          context,
          Environment.DIRECTORY_DOWNLOADS,
          MODEL_FILE_NAME,
        )

      val id = manager.enqueue(request)
      // commit() narrows the process-death window; readState() can also recover
      // the DownloadManager ID by its unique app-private destination filename.
      prefs.edit().putLong(PREFERENCE_DOWNLOAD_ID, id).commit()
      readState()
    } catch (_: Exception) {
      snapshot("failed", reason = START_FAILED_REASON)
    }
  }

  private fun readState(): Map<String, Any?> {
    val context = appContextOrThrow()
    val manager = downloadManager(context)
    val prefs = preferences(context)
    var id = prefs.getLong(PREFERENCE_DOWNLOAD_ID, NO_DOWNLOAD_ID)

    if (id == NO_DOWNLOAD_ID) {
      id = findExistingDownloadId(manager) ?: NO_DOWNLOAD_ID
      if (id != NO_DOWNLOAD_ID) prefs.edit().putLong(PREFERENCE_DOWNLOAD_ID, id).commit()
    }

    if (id == NO_DOWNLOAD_ID) {
      val file = modelFile(context)
      if (file != null && validateModelFile(file, prefs)) {
        return snapshot("complete", 100, file.length(), file.length(), file.absolutePath)
      }
      if (file?.exists() == true) file.delete()
      return snapshot("none")
    }

    val cursor = try {
      manager.query(DownloadManager.Query().setFilterById(id))
    } catch (_: Exception) {
      null
    } ?: return snapshot("failed", reason = QUERY_FAILED_REASON)

    cursor.use {
      if (!it.moveToFirst()) {
        prefs.edit().remove(PREFERENCE_DOWNLOAD_ID).commit()
        return snapshot("none")
      }

      val statusIndex = it.getColumnIndex(DownloadManager.COLUMN_STATUS)
      val downloadedIndex = it.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
      val totalIndex = it.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
      val reasonIndex = it.getColumnIndex(DownloadManager.COLUMN_REASON)
      val status = if (statusIndex >= 0) it.getInt(statusIndex) else -1
      val downloaded = if (downloadedIndex >= 0) it.getLong(downloadedIndex) else 0L
      val total = if (totalIndex >= 0) it.getLong(totalIndex) else -1L
      val reason = if (reasonIndex >= 0) it.getInt(reasonIndex) else null
      val progress = if (total > 0L) ((downloaded * 100L) / total).toInt().coerceIn(0, 100) else 0

      return when (status) {
        DownloadManager.STATUS_PENDING -> snapshot("pending", progress, downloaded, total, reason = reason)
        DownloadManager.STATUS_RUNNING -> snapshot("running", progress, downloaded, total, reason = reason)
        DownloadManager.STATUS_PAUSED -> snapshot("paused", progress, downloaded, total, reason = reason)
        DownloadManager.STATUS_SUCCESSFUL -> {
          val file = modelFile(context)
          if (file == null || !validateModelFile(file, prefs)) {
            manager.remove(id)
            file?.delete()
            prefs.edit()
              .remove(PREFERENCE_DOWNLOAD_ID)
              .remove(PREFERENCE_VERIFIED_SHA256)
              .commit()
            snapshot("failed", progress, downloaded, total, reason = INVALID_FILE_REASON)
          } else {
            snapshot("complete", 100, file.length(), file.length(), file.absolutePath)
          }
        }
        DownloadManager.STATUS_FAILED -> snapshot("failed", progress, downloaded, total, reason = reason)
        else -> snapshot("failed", progress, downloaded, total, reason = UNKNOWN_STATUS_REASON)
      }
    }
  }

  /** DownloadManager queries are scoped to this app's requests; the fixed private filename
   * recovers an enqueued job if Android killed the app before its ID reached SharedPreferences. */
  private fun findExistingDownloadId(manager: DownloadManager): Long? {
    val cursor = try {
      manager.query(DownloadManager.Query())
    } catch (_: Exception) {
      null
    } ?: return null

    cursor.use {
      val idIndex = it.getColumnIndex(DownloadManager.COLUMN_ID)
      val uriIndex = it.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
      if (idIndex < 0 || uriIndex < 0) return null

      var newestId: Long? = null
      while (it.moveToNext()) {
        val localUri = it.getString(uriIndex) ?: continue
        val name = try {
          Uri.parse(localUri).lastPathSegment
        } catch (_: Exception) {
          null
        }
        if (name != MODEL_FILE_NAME) continue

        val candidateId = it.getLong(idIndex)
        if (newestId == null || candidateId > newestId) newestId = candidateId
      }
      return newestId
    }
  }

  /** Verify the exact repository artifact once; app-private cache records avoid rehashing on launch. */
  private fun validateModelFile(file: File, prefs: SharedPreferences): Boolean {
    if (!file.isFile || file.length() != EXPECTED_MODEL_FILE_BYTES) return false
    if (prefs.getString(PREFERENCE_VERIFIED_SHA256, null) == EXPECTED_MODEL_SHA256) return true

    val actual = try {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().buffered(HASH_BUFFER_BYTES).use { input ->
        val buffer = ByteArray(HASH_BUFFER_BYTES)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          digest.update(buffer, 0, count)
        }
      }
      digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    } catch (_: Exception) {
      return false
    }

    if (actual != EXPECTED_MODEL_SHA256) return false
    prefs.edit().putString(PREFERENCE_VERIFIED_SHA256, EXPECTED_MODEL_SHA256).commit()
    return true
  }

  private fun snapshot(
    phase: String,
    progress: Int = 0,
    downloadedBytes: Long = 0L,
    totalBytes: Long = 0L,
    localPath: String? = null,
    reason: Int? = null,
  ): Map<String, Any?> = mapOf(
    "phase" to phase,
    "progress" to progress.coerceIn(0, 100),
    "downloadedBytes" to downloadedBytes,
    "totalBytes" to totalBytes,
    "localPath" to localPath,
    "reason" to reason,
  )

  private companion object {
    const val PREFERENCES_NAME = "echo_ai_downloader"
    const val PREFERENCE_DOWNLOAD_ID = "download_id"
    const val PREFERENCE_VERIFIED_SHA256 = "verified_sha256"
    const val NO_DOWNLOAD_ID = -1L
    const val MODEL_FILE_NAME = "echoai-local-model.litertlm"
    const val ALLOWED_HOST = "huggingface.co"
    const val EXPECTED_MODEL_FILE_BYTES = 3_659_530_240L
    const val EXPECTED_MODEL_SHA256 = "0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0"
    const val HASH_BUFFER_BYTES = 1024 * 1024
    const val INVALID_URL_REASON = -1001
    const val START_FAILED_REASON = -1002
    const val QUERY_FAILED_REASON = -1003
    const val INVALID_FILE_REASON = -1004
    const val UNKNOWN_STATUS_REASON = -1005
  }
}
