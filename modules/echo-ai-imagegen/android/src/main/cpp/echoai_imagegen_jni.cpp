#include <jni.h>
#include <android/log.h>

#include <algorithm>
#include <mutex>
#include <string>
#include <vector>

#include "stable-diffusion.h"

namespace {
std::mutex g_generation_mutex;
sd_ctx_t* g_context = nullptr;
std::string g_loaded_model_path;
std::string g_loaded_taesd_path;

struct ProgressState {
  JavaVM* vm = nullptr;
  jobject listener = nullptr;
  jmethodID callback = nullptr;
};

void ignore_log(sd_log_level_t, const char*, void*) {}

void report_progress(int step, int steps, float, void* user_data) {
  auto* state = static_cast<ProgressState*>(user_data);
  if (state == nullptr || state->vm == nullptr || state->listener == nullptr || state->callback == nullptr) return;

  JNIEnv* env = nullptr;
  bool attached = false;
  const jint status = state->vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
  if (status == JNI_EDETACHED) {
    if (state->vm->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
    attached = true;
  } else if (status != JNI_OK) {
    return;
  }

  env->CallVoidMethod(state->listener, state->callback, static_cast<jint>(step), static_cast<jint>(steps));
  if (env->ExceptionCheck()) env->ExceptionClear();
  if (attached) state->vm->DetachCurrentThread();
}

std::string from_java(JNIEnv* env, jstring value) {
  if (value == nullptr) return {};
  const char* chars = env->GetStringUTFChars(value, nullptr);
  if (chars == nullptr) return {};
  std::string result(chars);
  env->ReleaseStringUTFChars(value, chars);
  return result;
}

void throw_state_error(JNIEnv* env, const char* message) {
  jclass exception_class = env->FindClass("java/lang/IllegalStateException");
  if (exception_class != nullptr) env->ThrowNew(exception_class, message);
}
}  // namespace

extern "C" JNIEXPORT jbyteArray JNICALL
Java_expo_modules_echoaiimagegen_NativeImageEngine_generateNative(
    JNIEnv* env,
    jobject,
    jstring prompt_value,
    jstring model_path_value,
    jstring taesd_path_value,
    jobject progress_listener) {
  const std::string prompt = from_java(env, prompt_value);
  const std::string model_path = from_java(env, model_path_value);
  const std::string taesd_path = from_java(env, taesd_path_value);
  if (prompt.empty() || model_path.empty() || taesd_path.empty()) {
    throw_state_error(env, "image-generation-input-invalid");
    return nullptr;
  }

  std::lock_guard<std::mutex> lock(g_generation_mutex);
  if (g_context != nullptr && (g_loaded_model_path != model_path || g_loaded_taesd_path != taesd_path)) {
    free_sd_ctx(g_context);
    g_context = nullptr;
    g_loaded_model_path.clear();
    g_loaded_taesd_path.clear();
  }

  if (g_context == nullptr) {
    sd_ctx_params_t context_params;
    sd_ctx_params_init(&context_params);
    context_params.model_path = model_path.c_str();
    context_params.taesd_path = taesd_path.c_str();
    context_params.n_threads = std::max(1, std::min(4, sd_get_num_physical_cores()));
    context_params.rng_type = CPU_RNG;
    context_params.sampler_rng_type = CPU_RNG;
    context_params.enable_mmap = true;
    context_params.diffusion_flash_attn = true;
    context_params.backend = "cpu";
    context_params.params_backend = "cpu";

    sd_set_log_callback(ignore_log, nullptr);
    g_context = new_sd_ctx(&context_params);
    if (g_context == nullptr || !sd_ctx_supports_image_generation(g_context)) {
      if (g_context != nullptr) free_sd_ctx(g_context);
      g_context = nullptr;
      throw_state_error(env, "image-model-load-failed");
      return nullptr;
    }
    g_loaded_model_path = model_path;
    g_loaded_taesd_path = taesd_path;
  }

  sd_cancel_generation(g_context, SD_CANCEL_RESET);

  ProgressState progress;
  progress.vm = nullptr;
  if (env->GetJavaVM(&progress.vm) != JNI_OK) {
    throw_state_error(env, "image-progress-unavailable");
    return nullptr;
  }
  if (progress_listener != nullptr) {
    progress.listener = env->NewGlobalRef(progress_listener);
    jclass listener_class = env->GetObjectClass(progress_listener);
    if (listener_class != nullptr) {
      progress.callback = env->GetMethodID(listener_class, "onProgress", "(II)V");
    }
  }
  sd_set_progress_callback(report_progress, &progress);

  sd_img_gen_params_t generation_params;
  sd_img_gen_params_init(&generation_params);
  generation_params.prompt = prompt.c_str();
  generation_params.negative_prompt = "";
  generation_params.width = 512;
  generation_params.height = 512;
  generation_params.batch_count = 1;
  generation_params.seed = -1;
  generation_params.sample_params.sample_method = LCM_SAMPLE_METHOD;
  generation_params.sample_params.scheduler = LCM_SCHEDULER;
  generation_params.sample_params.sample_steps = 4;
  generation_params.sample_params.guidance.txt_cfg = 1.0f;

  sd_image_generation_result_t* result = nullptr;
  const bool generated = generate_image(g_context, &generation_params, &result);
  sd_set_progress_callback(nullptr, nullptr);
  if (progress.listener != nullptr) env->DeleteGlobalRef(progress.listener);
  sd_cancel_generation(g_context, SD_CANCEL_RESET);

  if (!generated || result == nullptr || result->count < 1 || result->items == nullptr) {
    if (result != nullptr) free_sd_image_generation_result(result);
    return nullptr;
  }

  const sd_image_t image = result->items[0].image;
  if (image.data == nullptr || image.width != 512 || image.height != 512 || (image.channel != 3 && image.channel != 4)) {
    free_sd_image_generation_result(result);
    return nullptr;
  }

  constexpr size_t kPixelCount = 512U * 512U;
  constexpr size_t kRgbaBytes = kPixelCount * 4U;
  std::vector<jbyte> rgba(kRgbaBytes);
  for (size_t i = 0; i < kPixelCount; ++i) {
    const size_t source = i * static_cast<size_t>(image.channel);
    const size_t target = i * 4U;
    rgba[target] = static_cast<jbyte>(image.data[source]);
    rgba[target + 1U] = static_cast<jbyte>(image.data[source + 1U]);
    rgba[target + 2U] = static_cast<jbyte>(image.data[source + 2U]);
    rgba[target + 3U] = image.channel == 4 ? static_cast<jbyte>(image.data[source + 3U]) : static_cast<jbyte>(255);
  }
  free_sd_image_generation_result(result);

  jbyteArray output = env->NewByteArray(static_cast<jsize>(rgba.size()));
  if (output == nullptr) return nullptr;
  env->SetByteArrayRegion(output, 0, static_cast<jsize>(rgba.size()), rgba.data());
  if (env->ExceptionCheck()) return nullptr;
  return output;
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_echoaiimagegen_NativeImageEngine_cancelNative(JNIEnv*, jobject) {
  if (g_context != nullptr) sd_cancel_generation(g_context, SD_CANCEL_ALL);
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_echoaiimagegen_NativeImageEngine_releaseNative(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(g_generation_mutex);
  if (g_context != nullptr) free_sd_ctx(g_context);
  g_context = nullptr;
  g_loaded_model_path.clear();
  g_loaded_taesd_path.clear();
}
