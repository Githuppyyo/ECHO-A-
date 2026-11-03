package expo.modules.echoaidownloader

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executor

class EchoAIOfflineVoiceModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val mainExecutor = Executor { command -> mainHandler.post(command) }

  @Volatile private var destroyed = false
  // Voice and speech APIs are owned and accessed only on the main looper.
  private var transcription: TranscriptionSession? = null
  private var textToSpeech: TextToSpeech? = null
  private var ttsInitializationStarted = false
  private var ttsInitializationStatus: Int? = null
  private val ttsInitializationCallbacks = mutableListOf<(TextToSpeech?) -> Unit>()
  private var activeTtsUtteranceId: String? = null
  private var activeTtsPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("EchoAIOfflineVoice")

    AsyncFunction("isOfflineSpeechAvailable") { languageTag: String, promise: Promise ->
      onMain {
        if (destroyed) {
          promise.resolve(false)
        } else {
          checkTurkishSpeechSupport(languageTag) { available -> promise.resolve(available) }
        }
      }
    }

    AsyncFunction("startOfflineTranscription") { languageTag: String, promise: Promise ->
      onMain { beginOfflineTranscription(languageTag, promise) }
    }

    AsyncFunction("stopOfflineTranscription") { promise: Promise ->
      onMain {
        val session = transcription
        if (session == null) {
          promise.reject("E_NO_ACTIVE_SPEECH", "No offline speech transcription is active")
        } else if (session.stopPromise != null) {
          promise.reject("E_SPEECH_BUSY", "Offline speech recognition is already stopping")
        } else {
          session.stopPromise = promise
          when {
            session.transcript != null -> finishTranscriptionSuccess(session, session.transcript.orEmpty())
            session.errorMessage != null -> finishTranscriptionError(session, session.errorMessage.orEmpty())
            else -> {
              session.resultTimeout = Runnable {
                finishTranscriptionError(session, "On-device speech recognition returned no result")
              }.also { mainHandler.postDelayed(it, STOP_RESULT_TIMEOUT_MS) }
              requestRecognitionStop(session)
            }
          }
        }
      }
    }

    AsyncFunction("cancelOfflineTranscription") { promise: Promise ->
      onMain {
        cancelTranscription("Offline speech transcription was cancelled")
        promise.resolve(null)
      }
    }

    AsyncFunction("getOfflineVoice") { languageTag: String, promise: Promise ->
      onMain {
        if (destroyed) {
          promise.resolve(mapOf("available" to false))
        } else {
          ensureTextToSpeech { engine ->
            val voice = engine?.let { selectOfflineVoice(it, languageTag) }
            if (voice == null) {
              promise.resolve(mapOf("available" to false))
            } else {
              promise.resolve(
                mapOf(
                  "available" to true,
                  "name" to voice.name,
                  "language" to voice.locale.toLanguageTag(),
                ),
              )
            }
          }
        }
      }
    }

    AsyncFunction("speakOffline") { text: String, languageTag: String, promise: Promise ->
      onMain { beginOfflineSpeech(text, languageTag, promise) }
    }

    Function("stopSpeaking") {
      onMain {
        try {
          textToSpeech?.stop()
        } catch (_: Exception) {
          settleTts(false)
        }
      }
    }

    OnDestroy {
      destroyed = true
      onMain { destroyResources() }
    }
  }

  private fun appContextOrNull(): Context? = appContext.reactContext?.applicationContext

  private fun onMain(action: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) action() else mainHandler.post(action)
  }

  /** API 33 support data is required so we can prove Turkish is already installed, never download it. */
  private fun checkTurkishSpeechSupport(languageTag: String, callback: (Boolean) -> Unit) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      callback(false)
      return
    }
    val context = appContextOrNull()
    if (context == null || !isTurkishTag(languageTag) ||
      !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
      callback(false)
      return
    }

    try {
      val intent = recognitionIntent()
      SpeechRecognizer.createOnDeviceSpeechRecognizer(context).let { probe ->
        try {
          probe.checkRecognitionSupport(intent, mainExecutor, object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) {
              val installed = support.installedOnDeviceLanguages
              val available = installed.any { isInstalledTurkishTag(it) }
              try {
                probe.destroy()
              } catch (_: Exception) {
                // Probe teardown is best-effort.
              }
              callback(available)
            }

            override fun onError(error: Int) {
              try {
                probe.destroy()
              } catch (_: Exception) {
                // Probe teardown is best-effort.
              }
              callback(false)
            }
          })
        } catch (_: Exception) {
          probe.destroy()
          callback(false)
        }
      }
    } catch (_: Exception) {
      callback(false)
    }
  }

  private fun beginOfflineTranscription(languageTag: String, promise: Promise) {
    if (destroyed) {
      promise.reject("E_MODULE_DESTROYED", "Offline voice module has been destroyed")
      return
    }
    if (transcription != null) {
      promise.reject("E_SPEECH_BUSY", "Offline speech transcription is already in progress")
      return
    }
    val context = appContextOrNull()
    if (context == null) {
      promise.reject("E_OFFLINE_SPEECH_UNAVAILABLE", "Application context is unavailable")
      return
    }
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_RECORD_AUDIO_PERMISSION", "Microphone permission is required for offline transcription")
      return
    }

    checkTurkishSpeechSupport(languageTag) { available ->
      if (destroyed) {
        promise.reject("E_MODULE_DESTROYED", "Offline voice module has been destroyed")
      } else if (!available) {
        promise.reject(
          "E_OFFLINE_SPEECH_UNAVAILABLE",
          "On-device Turkish speech recognition is unavailable; install the Turkish offline language pack in Android settings",
        )
      } else {
        startRecognizer(context, promise)
      }
    }
  }

  private fun startRecognizer(context: Context, promise: Promise) {
    if (transcription != null) {
      promise.reject("E_SPEECH_BUSY", "Offline speech transcription is already in progress")
      return
    }
    val recognizer = try {
      SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
    } catch (error: Exception) {
      promise.reject("E_OFFLINE_SPEECH_UNAVAILABLE", "Unable to create the on-device speech recognizer", error)
      return
    }

    val session = TranscriptionSession(recognizer)
    transcription = session
    recognizer.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: android.os.Bundle?) = Unit
      override fun onBeginningOfSpeech() = Unit
      override fun onRmsChanged(rmsdB: Float) = Unit
      override fun onBufferReceived(buffer: ByteArray?) = Unit
      override fun onEndOfSpeech() = Unit
      override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

      override fun onError(error: Int) {
        onMain {
          session.errorMessage = speechErrorMessage(error)
          if (session.stopPromise != null) finishTranscriptionError(session, session.errorMessage.orEmpty())
        }
      }

      override fun onResults(results: android.os.Bundle?) {
        onMain {
          val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()?.trim().orEmpty()
          if (text.isEmpty()) {
            session.errorMessage = "On-device speech recognition returned no transcription"
            if (session.stopPromise != null) finishTranscriptionError(session, session.errorMessage.orEmpty())
          } else {
            session.transcript = text
            if (session.stopPromise != null) finishTranscriptionSuccess(session, text)
          }
        }
      }

      override fun onPartialResults(partialResults: android.os.Bundle?) = Unit
    })

    session.timeout = Runnable { requestRecognitionStop(session) }
      .also { mainHandler.postDelayed(it, MAX_TRANSCRIPTION_DURATION_MS) }

    try {
      recognizer.startListening(recognitionIntent())
      promise.resolve(null)
    } catch (error: Exception) {
      session.settled = true
      cleanupTranscription(session)
      promise.reject("E_OFFLINE_SPEECH", "Unable to start on-device speech recognition", error)
    }
  }

  private fun requestRecognitionStop(session: TranscriptionSession) {
    if (transcription !== session || session.settled || session.stopRequested) return
    session.stopRequested = true
    session.timeout?.let(mainHandler::removeCallbacks)
    session.timeout = null
    try {
      session.recognizer.stopListening()
    } catch (error: Exception) {
      session.errorMessage = "Unable to stop on-device speech recognition"
      if (session.stopPromise != null) finishTranscriptionError(session, session.errorMessage.orEmpty(), error)
    }
  }

  private fun finishTranscriptionSuccess(session: TranscriptionSession, text: String) {
    val promise = session.stopPromise ?: return
    if (transcription !== session || session.settled) return
    session.settled = true
    cleanupTranscription(session)
    promise.resolve(text)
  }

  private fun finishTranscriptionError(session: TranscriptionSession, message: String, cause: Throwable? = null) {
    val promise = session.stopPromise ?: run {
      session.errorMessage = message
      return
    }
    if (transcription !== session || session.settled) return
    session.settled = true
    cleanupTranscription(session)
    promise.reject("E_OFFLINE_SPEECH", message, cause)
  }

  private fun cancelTranscription(message: String) {
    val session = transcription ?: return
    if (session.settled) return
    if (session.stopPromise != null) {
      finishTranscriptionError(session, message)
    } else {
      session.settled = true
      cleanupTranscription(session)
    }
  }

  private fun cleanupTranscription(session: TranscriptionSession) {
    if (transcription === session) transcription = null
    session.timeout?.let(mainHandler::removeCallbacks)
    session.timeout = null
    session.resultTimeout?.let(mainHandler::removeCallbacks)
    session.resultTimeout = null
    try {
      session.recognizer.cancel()
    } catch (_: Exception) {
      // Recognition may already have ended or the service may have disconnected.
    }
    try {
      session.recognizer.destroy()
    } catch (_: Exception) {
      // Always make teardown best-effort after settling the call.
    }
  }

  private fun recognitionIntent(): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    putExtra(RecognizerIntent.EXTRA_LANGUAGE, TURKISH_LANGUAGE_TAG)
    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, TURKISH_LANGUAGE_TAG)
    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
  }

  private fun speechErrorMessage(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_AUDIO -> "The on-device recognizer reported an audio error"
    SpeechRecognizer.ERROR_CLIENT -> "The on-device recognizer reported a client error"
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required for offline transcription"
    SpeechRecognizer.ERROR_NETWORK,
    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "The on-device recognizer could not complete offline recognition"
    SpeechRecognizer.ERROR_NO_MATCH -> "No Turkish speech was recognized"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "The on-device recognizer is busy"
    SpeechRecognizer.ERROR_SERVER -> "The on-device recognizer service failed"
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech was detected"
    else -> "The on-device recognizer failed (error $error)"
  }

  private fun beginOfflineSpeech(text: String, languageTag: String, promise: Promise) {
    if (destroyed) {
      promise.resolve(false)
      return
    }
    if (text.isBlank() || !isTurkishTag(languageTag)) {
      promise.resolve(false)
      return
    }
    ensureTextToSpeech { engine ->
      val voice = engine?.let { selectOfflineVoice(it, languageTag) }
      if (engine == null || voice == null || destroyed) {
        promise.resolve(false)
        return@ensureTextToSpeech
      }

      settleTts(false)
      val utteranceId = "echo-offline-${UUID.randomUUID()}"
      activeTtsUtteranceId = utteranceId
      activeTtsPromise = promise
      try {
        engine.voice = voice
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) = Unit

          override fun onDone(id: String?) {
            onMain { if (id == activeTtsUtteranceId) settleTts(true) }
          }

          override fun onError(id: String?) {
            onMain { if (id == activeTtsUtteranceId) settleTts(false) }
          }

          override fun onError(id: String?, errorCode: Int) {
            onMain { if (id == activeTtsUtteranceId) settleTts(false) }
          }

          override fun onStop(id: String?, interrupted: Boolean) {
            onMain { if (id == activeTtsUtteranceId) settleTts(false) }
          }
        })
        if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId) != TextToSpeech.SUCCESS) {
          settleTts(false)
        }
      } catch (_: Exception) {
        settleTts(false)
      }
    }
  }

  private fun settleTts(success: Boolean) {
    val promise = activeTtsPromise ?: return
    activeTtsPromise = null
    activeTtsUtteranceId = null
    promise.resolve(success)
  }

  private fun ensureTextToSpeech(callback: (TextToSpeech?) -> Unit) {
    if (destroyed) {
      callback(null)
      return
    }
    val existing = textToSpeech
    if (existing != null && ttsInitializationStatus == TextToSpeech.SUCCESS) {
      callback(existing)
      return
    }
    if (ttsInitializationStatus == TextToSpeech.ERROR) {
      callback(null)
      return
    }
    ttsInitializationCallbacks.add(callback)
    if (ttsInitializationStarted) return

    val context = appContextOrNull()
    if (context == null) {
      completeTtsInitialization(null, TextToSpeech.ERROR)
      return
    }
    ttsInitializationStarted = true
    try {
      val engine = TextToSpeech(context) { status ->
        // Deferring guarantees the engine reference has been assigned before callbacks run.
        mainHandler.post {
          completeTtsInitialization(textToSpeech, status)
        }
      }
      textToSpeech = engine
    } catch (_: Exception) {
      completeTtsInitialization(null, TextToSpeech.ERROR)
    }
  }

  private fun completeTtsInitialization(engine: TextToSpeech?, status: Int) {
    if (destroyed) {
      engine?.shutdown()
      flushTtsInitializationCallbacks(null)
      return
    }
    ttsInitializationStatus = status
    flushTtsInitializationCallbacks(if (status == TextToSpeech.SUCCESS) engine else null)
  }

  private fun flushTtsInitializationCallbacks(engine: TextToSpeech?) {
    val callbacks = ttsInitializationCallbacks.toList()
    ttsInitializationCallbacks.clear()
    callbacks.forEach { it(engine) }
  }

  private fun selectOfflineVoice(engine: TextToSpeech, languageTag: String): Voice? {
    val requested = Locale.forLanguageTag(languageTag.trim())
    if (requested.language != TURKISH_LANGUAGE_CODE) return null
    return try {
      engine.voices
        ?.asSequence()
        ?.filter { voice ->
          !voice.isNetworkConnectionRequired &&
            voice.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true &&
            voice.locale.language.equals(TURKISH_LANGUAGE_CODE, ignoreCase = true)
        }
        ?.sortedWith(
          compareByDescending<Voice> {
            it.locale.toLanguageTag().equals(requested.toLanguageTag(), ignoreCase = true)
          }.thenByDescending { it.quality },
        )
        ?.firstOrNull()
    } catch (_: Exception) {
      null
    }
  }

  private fun isTurkishTag(languageTag: String): Boolean =
    Locale.forLanguageTag(languageTag.trim()).language.equals(TURKISH_LANGUAGE_CODE, ignoreCase = true)

  private fun isInstalledTurkishTag(tag: String): Boolean {
    val normalized = Locale.forLanguageTag(tag.trim()).toLanguageTag()
    return normalized.equals("tr", ignoreCase = true) || normalized.equals("tr-TR", ignoreCase = true)
  }

  private fun destroyResources() {
    if (transcription != null) cancelTranscription("Offline voice module was destroyed")
    settleTts(false)
    flushTtsInitializationCallbacks(null)
    val engine = textToSpeech
    textToSpeech = null
    try {
      engine?.stop()
    } catch (_: Exception) {
      // Best-effort shutdown during module destruction.
    }
    try {
      engine?.shutdown()
    } catch (_: Exception) {
      // Best-effort shutdown during module destruction.
    }
  }

  private class TranscriptionSession(
    val recognizer: SpeechRecognizer,
    var stopPromise: Promise? = null,
    var transcript: String? = null,
    var errorMessage: String? = null,
    var timeout: Runnable? = null,
    var resultTimeout: Runnable? = null,
    var stopRequested: Boolean = false,
    var settled: Boolean = false,
  )

  private companion object {
    const val TURKISH_LANGUAGE_CODE = "tr"
    const val TURKISH_LANGUAGE_TAG = "tr-TR"
    const val MAX_TRANSCRIPTION_DURATION_MS = 45_000L
    const val STOP_RESULT_TIMEOUT_MS = 5_000L
  }
}
