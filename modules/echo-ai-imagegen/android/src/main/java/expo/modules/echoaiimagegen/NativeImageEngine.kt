package expo.modules.echoaiimagegen

internal fun interface NativeImageProgressListener {
  fun onProgress(step: Int, total: Int)
}

internal object NativeImageEngine {
  @Volatile private var loaded = false
  private val lock = Any()

  fun ensureLoaded(): Boolean {
    if (loaded) return true
    synchronized(lock) {
      if (loaded) return true
      return try {
        System.loadLibrary("echoai_imagegen")
        loaded = true
        true
      } catch (_: UnsatisfiedLinkError) {
        false
      } catch (_: SecurityException) {
        false
      }
    }
  }

  external fun generateNative(
    prompt: String,
    modelPath: String,
    taesdPath: String,
    progressListener: NativeImageProgressListener,
  ): ByteArray?

  external fun cancelNative()

  external fun releaseNative()
}
