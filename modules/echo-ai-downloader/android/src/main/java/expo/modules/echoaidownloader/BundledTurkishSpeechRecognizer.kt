package expo.modules.echoaidownloader

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.SequenceInputStream
import java.util.Collections
import java.util.Locale
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.zip.ZipInputStream

/** Offline Turkish speech-to-text backed by the model bundled in this Android library's assets. */
internal class BundledTurkishSpeechRecognizer(context: Context) {
  private val appContext = context.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private val modelExecutor = Executors.newSingleThreadExecutor()
  @Volatile private var destroyed = false

  // All fields below, except `destroyed`, are read and written on the main looper.
  private var model: Model? = null
  private var modelLoading = false
  private val modelCallbacks = mutableListOf<(Model?, Throwable?) -> Unit>()
  private var startAttempt = 0L
  private var pendingStartCallback: ((Throwable?) -> Unit)? = null
  private var session: Session? = null

  fun isAvailable(languageTag: String): Boolean {
    if (destroyed || !isTurkishTag(languageTag)) return false
    return try {
      val names = appContext.assets.list("")?.toSet().orEmpty()
      MODEL_ARCHIVE_ASSETS.all { it in names }
    } catch (_: Exception) {
      false
    }
  }

  fun start(onStarted: (Throwable?) -> Unit) = onMain {
    if (destroyed) {
      onStarted(IllegalStateException("Offline speech module has been destroyed"))
      return@onMain
    }
    if (session != null || pendingStartCallback != null) {
      onStarted(IllegalStateException("Offline speech recognition is already active"))
      return@onMain
    }

    val attempt = ++startAttempt
    pendingStartCallback = onStarted
    ensureModelLoaded { loadedModel, error ->
      if (destroyed) return@ensureModelLoaded
      if (attempt != startAttempt) {
        unloadModelIfIdle()
        return@ensureModelLoaded
      }
      if (error != null || loadedModel == null) {
        finishStartCallback(error ?: IllegalStateException("Bundled Turkish speech model is unavailable"))
        return@ensureModelLoaded
      }

      var recognizer: Recognizer? = null
      var speechService: SpeechService? = null
      try {
        recognizer = Recognizer(loadedModel, SAMPLE_RATE_HZ.toFloat())
        speechService = SpeechService(recognizer, SAMPLE_RATE_HZ.toFloat())
        val activeSession = Session(recognizer, speechService)
        session = activeSession
        if (!speechService.startListening(createListener(activeSession))) {
          throw IllegalStateException("Offline speech recording did not start")
        }
        activeSession.maxDuration = Runnable {
          if (session === activeSession && !activeSession.completed) requestStop(activeSession)
        }.also { mainHandler.postDelayed(it, MAX_DURATION_MS) }
        finishStartCallback(null)
      } catch (error: Throwable) {
        speechService?.let { runCatching { it.shutdown() } }
        recognizer?.let { runCatching { it.close() } }
        session = null
        finishStartCallback(error)
      }
    }
  }

  fun stop(onCompleted: (String?, Throwable?) -> Unit) = onMain {
    val activeSession = session
    if (activeSession == null) {
      onCompleted(null, IllegalStateException("No offline speech transcription is active"))
      return@onMain
    }
    if (activeSession.stopCallback != null) {
      onCompleted(null, IllegalStateException("Offline speech recognition is already stopping"))
      return@onMain
    }
    activeSession.stopCallback = onCompleted
    if (activeSession.completed) {
      deliverCompletedSession(activeSession)
    } else if (!activeSession.stopRequested) {
      requestStop(activeSession)
    }
  }

  fun cancel() = onMain {
    startAttempt += 1
    finishStartCallback(CancellationException("Offline speech transcription was cancelled"))

    val activeSession = session ?: return@onMain
    session = null
    activeSession.maxDuration?.let(mainHandler::removeCallbacks)
    activeSession.resultTimeout?.let(mainHandler::removeCallbacks)
    activeSession.stopCallback?.invoke(null, CancellationException("Offline speech transcription was cancelled"))
    activeSession.stopCallback = null
    if (!activeSession.resourcesReleased) {
      runCatching { activeSession.speechService.cancel() }
      releaseResources(activeSession)
    }
  }

  fun close() = onMain {
    if (destroyed) return@onMain
    destroyed = true
    cancel()
    modelExecutor.shutdownNow()
    val loadedModel = model
    model = null
    runCatching { loadedModel?.close() }
    val callbacks = modelCallbacks.toList()
    modelCallbacks.clear()
    callbacks.forEach { it(null, CancellationException("Offline speech module was destroyed")) }
  }

  private fun ensureModelLoaded(callback: (Model?, Throwable?) -> Unit) {
    model?.let {
      callback(it, null)
      return
    }
    modelCallbacks += callback
    if (modelLoading) return
    modelLoading = true

    try {
      modelExecutor.execute {
        var loadedModel: Model? = null
        var failure: Throwable? = null
        try {
          loadedModel = Model(unpackBundledModel().absolutePath)
        } catch (error: Throwable) {
          failure = error
        }
        mainHandler.post {
          modelLoading = false
          if (destroyed) {
            runCatching { loadedModel?.close() }
            failure = failure ?: CancellationException("Offline speech module was destroyed")
          } else if (loadedModel != null && failure == null) {
            model = loadedModel
          }
          val resultModel = if (destroyed) null else model
          val waiting = modelCallbacks.toList()
          modelCallbacks.clear()
          waiting.forEach { it(resultModel, failure) }
        }
      }
    } catch (error: Throwable) {
      modelLoading = false
      val waiting = modelCallbacks.toList()
      modelCallbacks.clear()
      waiting.forEach { it(null, error) }
    }
  }

  private fun unpackBundledModel(): File {
    val root = File(appContext.filesDir, MODEL_STORAGE_DIRECTORY)
    val target = File(root, MODEL_DIRECTORY_NAME)
    val marker = File(root, MODEL_READY_MARKER)
    if (marker.isFile && runCatching { marker.readText() }.getOrNull() == MODEL_VERSION && isModelDirectoryReady(target)) {
      return target
    }

    if (!root.exists() && !root.mkdirs()) throw IOException("Unable to prepare private speech model storage")
    val staging = File(root, "$MODEL_DIRECTORY_NAME.extracting")
    staging.deleteRecursively()
    if (!staging.mkdirs()) throw IOException("Unable to prepare temporary speech model storage")

    var expandedBytes = 0L
    var entryCount = 0
    var foundModelRoot = false
    val rootPrefix = "$MODEL_DIRECTORY_NAME/"
    try {
      ZipInputStream(BufferedInputStream(openBundledModelArchiveStream())).use { zip ->
        var entry = zip.nextEntry
        val buffer = ByteArray(COPY_BUFFER_BYTES)
        while (entry != null) {
          entryCount += 1
          if (entryCount > MAX_MODEL_ENTRIES) throw IOException("Speech model archive has too many entries")
          val normalizedName = entry.name.replace('\\', '/')
          if (normalizedName.startsWith('/') || normalizedName.split('/').any { it == ".." || it == "." }) {
            throw IOException("Speech model archive contains an unsafe path")
          }
          if (normalizedName == MODEL_DIRECTORY_NAME || normalizedName == "$MODEL_DIRECTORY_NAME/") {
            foundModelRoot = true
            zip.closeEntry()
            entry = zip.nextEntry
            continue
          }
          if (!normalizedName.startsWith(rootPrefix)) throw IOException("Speech model archive has an unexpected folder")
          foundModelRoot = true
          val relativeName = normalizedName.removePrefix(rootPrefix).trimEnd('/')
          if (relativeName.isBlank()) {
            zip.closeEntry()
            entry = zip.nextEntry
            continue
          }
          val output = File(staging, relativeName)
          val stagingCanonicalPath = staging.canonicalPath + File.separator
          if (!output.canonicalPath.startsWith(stagingCanonicalPath)) throw IOException("Speech model archive path escaped private storage")

          if (entry.isDirectory) {
            if (!output.exists() && !output.mkdirs()) throw IOException("Unable to create speech model directory")
          } else {
            val parent = output.parentFile ?: throw IOException("Speech model file has no parent directory")
            if (!parent.exists() && !parent.mkdirs()) throw IOException("Unable to create speech model directory")
            BufferedOutputStream(FileOutputStream(output)).use { destination ->
              while (true) {
                val count = zip.read(buffer)
                if (count < 0) break
                expandedBytes += count
                if (expandedBytes > MAX_EXPANDED_MODEL_BYTES) throw IOException("Speech model archive is larger than the supported limit")
                destination.write(buffer, 0, count)
              }
            }
          }
          zip.closeEntry()
          entry = zip.nextEntry
        }
      }

      if (!foundModelRoot || !isModelDirectoryReady(staging)) {
        throw IOException("Bundled Turkish speech model is incomplete")
      }
      if (target.exists() && !target.deleteRecursively()) throw IOException("Unable to replace the previous speech model")
      if (!staging.renameTo(target)) throw IOException("Unable to finalize the bundled speech model")
      marker.writeText(MODEL_VERSION)
      return target
    } catch (error: Throwable) {
      staging.deleteRecursively()
      throw error
    }
  }

  private fun isModelDirectoryReady(directory: File): Boolean {
    val hasAcousticModel = File(directory, "am/final.mdl").isFile || File(directory, "final.mdl").isFile
    val hasConfiguration = File(directory, "conf").isDirectory || File(directory, "mfcc.conf").isFile
    return directory.isDirectory && hasAcousticModel && hasConfiguration
  }

  private fun openBundledModelArchiveStream(): InputStream {
    val parts = MODEL_ARCHIVE_ASSETS.map { appContext.assets.open(it) }
    return SequenceInputStream(Collections.enumeration(parts))
  }

  private fun createListener(activeSession: Session) = object : RecognitionListener {
    override fun onPartialResult(hypothesis: String?) = Unit

    override fun onResult(hypothesis: String?) {
      onMain {
        if (session !== activeSession || activeSession.completed) return@onMain
        parseResultText(hypothesis).takeIf { it.isNotBlank() }?.let(activeSession.transcriptParts::add)
      }
    }

    override fun onFinalResult(hypothesis: String?) {
      onMain {
        if (session !== activeSession || activeSession.completed) return@onMain
        parseResultText(hypothesis).takeIf { it.isNotBlank() }?.let(activeSession.transcriptParts::add)
        completeSession(activeSession, null)
      }
    }

    override fun onError(error: Exception?) {
      onMain {
        if (session !== activeSession || activeSession.completed) return@onMain
        completeSession(activeSession, error ?: IOException("Offline Turkish speech recognition failed"))
      }
    }

    override fun onTimeout() {
      onMain {
        if (session === activeSession && !activeSession.completed) requestStop(activeSession)
      }
    }
  }

  private fun requestStop(activeSession: Session) {
    if (session !== activeSession || activeSession.completed || activeSession.stopRequested) return
    activeSession.stopRequested = true
    activeSession.maxDuration?.let(mainHandler::removeCallbacks)
    activeSession.maxDuration = null
    activeSession.resultTimeout = Runnable {
      if (session === activeSession && !activeSession.completed) {
        completeSession(activeSession, IOException("Offline speech recognition returned no final result"))
      }
    }.also { mainHandler.postDelayed(it, STOP_RESULT_TIMEOUT_MS) }

    try {
      val stopped = activeSession.speechService.stop()
      val fallbackText = if (!stopped && !activeSession.completed) {
        parseResultText(activeSession.recognizer.finalResult)
      } else {
        ""
      }
      releaseResources(activeSession)
      if (!stopped && !activeSession.completed) {
        fallbackText.takeIf { it.isNotBlank() }?.let(activeSession.transcriptParts::add)
        completeSession(activeSession, null)
      }
    } catch (error: Throwable) {
      runCatching { activeSession.speechService.cancel() }
      releaseResources(activeSession)
      completeSession(activeSession, error)
    }
  }

  private fun completeSession(activeSession: Session, error: Throwable?) {
    if (session !== activeSession || activeSession.completed) return
    activeSession.completed = true
    activeSession.failure = error
    activeSession.finalTranscript = activeSession.transcriptParts.joinToString(" ").trim()
    activeSession.maxDuration?.let(mainHandler::removeCallbacks)
    activeSession.maxDuration = null
    activeSession.resultTimeout?.let(mainHandler::removeCallbacks)
    activeSession.resultTimeout = null
    if (error != null && !activeSession.resourcesReleased) {
      runCatching { activeSession.speechService.cancel() }
    }
    releaseResources(activeSession)
    if (activeSession.stopCallback != null) deliverCompletedSession(activeSession)
  }

  private fun deliverCompletedSession(activeSession: Session) {
    if (session !== activeSession) return
    val callback = activeSession.stopCallback ?: return
    val result = activeSession.finalTranscript
    val error = activeSession.failure
    activeSession.stopCallback = null
    session = null
    callback(result, error)
  }

  private fun releaseResources(activeSession: Session) {
    if (activeSession.resourcesReleased) return
    activeSession.resourcesReleased = true
    runCatching { activeSession.speechService.shutdown() }
    runCatching { activeSession.recognizer.close() }
    val loadedModel = model
    model = null
    runCatching { loadedModel?.close() }
  }

  private fun finishStartCallback(error: Throwable?) {
    val callback = pendingStartCallback ?: return
    pendingStartCallback = null
    callback(error)
  }

  private fun unloadModelIfIdle() {
    if (session != null || pendingStartCallback != null || modelLoading) return
    val loadedModel = model ?: return
    model = null
    runCatching { loadedModel.close() }
  }

  private fun parseResultText(result: String?): String = try {
    if (result.isNullOrBlank()) "" else JSONObject(result).optString("text", "").trim()
  } catch (_: Exception) {
    ""
  }

  private fun isTurkishTag(languageTag: String): Boolean =
    Locale.forLanguageTag(languageTag.trim()).language.equals(TURKISH_LANGUAGE_CODE, ignoreCase = true)

  private fun onMain(action: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) action() else mainHandler.post(action)
  }

  private class Session(
    val recognizer: Recognizer,
    val speechService: SpeechService,
    val transcriptParts: MutableList<String> = mutableListOf(),
    var stopCallback: ((String?, Throwable?) -> Unit)? = null,
    var finalTranscript: String = "",
    var failure: Throwable? = null,
    var maxDuration: Runnable? = null,
    var resultTimeout: Runnable? = null,
    var stopRequested: Boolean = false,
    var completed: Boolean = false,
    var resourcesReleased: Boolean = false,
  )

  private companion object {
    const val TURKISH_LANGUAGE_CODE = "tr"
    const val SAMPLE_RATE_HZ = 16_000
    const val MAX_DURATION_MS = 45_000L
    const val STOP_RESULT_TIMEOUT_MS = 5_000L
    const val MODEL_DIRECTORY_NAME = "vosk-model-small-tr-0.3"
    const val MODEL_STORAGE_DIRECTORY = "echoai/offline-speech"
    const val MODEL_READY_MARKER = ".turkish-model-ready"
    const val MODEL_VERSION = "turkish-small-0.3-8c8d07cec1bce31add14967c16891c84152cdf76d391e33c08278119b9ea96e5"
    val MODEL_ARCHIVE_ASSETS = listOf("offline-tr-model.zip.part-00", "offline-tr-model.zip.part-01")
    const val MAX_MODEL_ENTRIES = 20_000
    const val MAX_EXPANDED_MODEL_BYTES = 256L * 1024L * 1024L
    const val COPY_BUFFER_BYTES = 8_192
  }
}
