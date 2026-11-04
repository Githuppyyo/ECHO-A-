package expo.modules.echoaidownloader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.UUID

class EchoAIOfflineVoiceModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile private var destroyed = false
  // The bundled recognizer and Android TTS are owned on the main looper.
  private var bundledSpeechRecognizer: BundledTurkishSpeechRecognizer? = null
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
        promise.resolve(offlineSpeechRecognizerOrNull()?.isAvailable(languageTag) == true)
      }
    }

    AsyncFunction("startOfflineTranscription") { languageTag: String, promise: Promise ->
      onMain { beginOfflineTranscription(languageTag, promise) }
    }

    AsyncFunction("stopOfflineTranscription") { promise: Promise ->
      onMain { stopOfflineTranscription(promise) }
    }

    AsyncFunction("cancelOfflineTranscription") { promise: Promise ->
      onMain {
        bundledSpeechRecognizer?.cancel()
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

  private fun offlineSpeechRecognizerOrNull(): BundledTurkishSpeechRecognizer? {
    if (destroyed) return null
    val context = appContextOrNull() ?: return null
    return bundledSpeechRecognizer ?: BundledTurkishSpeechRecognizer(context).also {
      bundledSpeechRecognizer = it
    }
  }

  private fun beginOfflineTranscription(languageTag: String, promise: Promise) {
    if (destroyed) {
      promise.reject("E_MODULE_DESTROYED", "Offline voice module has been destroyed", null)
      return
    }
    val context = appContextOrNull()
    if (context == null) {
      promise.reject("E_OFFLINE_SPEECH_UNAVAILABLE", "Application context is unavailable", null)
      return
    }
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_RECORD_AUDIO_PERMISSION", "Microphone permission is required for offline transcription", null)
      return
    }
    if (!isTurkishTag(languageTag)) {
      promise.reject("E_OFFLINE_SPEECH_UNAVAILABLE", "Only Turkish offline speech recognition is bundled", null)
      return
    }
    val engine = offlineSpeechRecognizerOrNull()
    if (engine == null || !engine.isAvailable(languageTag)) {
      promise.reject("E_OFFLINE_SPEECH_UNAVAILABLE", "The bundled Turkish speech model is unavailable", null)
      return
    }

    engine.start { error ->
      if (error == null) {
        promise.resolve(null)
      } else {
        promise.reject("E_OFFLINE_SPEECH", "The bundled offline Turkish speech model could not start", error)
      }
    }
  }

  private fun stopOfflineTranscription(promise: Promise) {
    val engine = bundledSpeechRecognizer
    if (engine == null) {
      promise.reject("E_NO_ACTIVE_SPEECH", "No offline speech transcription is active", null)
      return
    }
    engine.stop { transcript, error ->
      if (error == null) {
        promise.resolve(transcript.orEmpty())
      } else {
        promise.reject("E_OFFLINE_SPEECH", "Offline Turkish speech could not be transcribed", error)
      }
    }
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

  private fun destroyResources() {
    bundledSpeechRecognizer?.close()
    bundledSpeechRecognizer = null
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

  private companion object {
    const val TURKISH_LANGUAGE_CODE = "tr"
  }
}
