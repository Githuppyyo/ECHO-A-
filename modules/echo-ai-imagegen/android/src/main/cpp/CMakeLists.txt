cmake_minimum_required(VERSION 3.22.1)
project(echoai_imagegen LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)

# This build keeps the model out of the APK. Only the inference runtime ships here.
set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SD_WEBP OFF CACHE BOOL "" FORCE)
set(SD_WEBM OFF CACHE BOOL "" FORCE)
set(SD_VULKAN OFF CACHE BOOL "" FORCE)
set(SD_OPENCL OFF CACHE BOOL "" FORCE)
set(SD_BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(SD_BUILD_SHARED_GGML_LIB OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL OFF CACHE BOOL "" FORCE)

include(FetchContent)
FetchContent_Declare(stable_diffusion
  GIT_REPOSITORY https://github.com/leejet/stable-diffusion.cpp.git
  GIT_TAG 58bb3c1b1cd4749e94e39f537e9adfce295dcaee
  GIT_SUBMODULES ggml
  GIT_SUBMODULES_RECURSE FALSE
  GIT_PROGRESS TRUE
)
FetchContent_MakeAvailable(stable_diffusion)

add_library(echoai_imagegen SHARED echoai_imagegen_jni.cpp)
target_include_directories(echoai_imagegen PRIVATE "${stable_diffusion_SOURCE_DIR}/include")
find_library(android-lib android REQUIRED)
find_library(log-lib log REQUIRED)
target_link_libraries(echoai_imagegen PRIVATE stable-diffusion ${android-lib} ${log-lib})
target_link_options(stable-diffusion PRIVATE "-Wl,-z,max-page-size=16384")
target_link_options(echoai_imagegen PRIVATE "-Wl,-z,max-page-size=16384")
