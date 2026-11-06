# ECHO AI — Çevrimdışı PNG Görsel Üretimi Fizibilitesi

## Bulgular

Android'de cihaz üzerinde metinden görsel üretmek teknik olarak mümkün. Google'ın resmi MediaPipe Image Generator belgesi bu görevin **artık deprecated olduğunu ve aktif olarak sürdürülmediğini** belirtiyor. Görev Android'de yerel üretim yapabiliyor, ancak model dizini olarak indirilen ve dönüştürülmüş ağırlıkları bekliyor; desteklenen temel modellerin Stable Diffusion 1.5 mimarisiyle tam eşleşmesi gerekiyor. Ham checkpoint'i indirip doğrudan çalıştırmak yeterli değil; belge, modelin dönüştürülmesini istiyor. [1]

Google'ın 27 Mart 2026 tarihli Android codelab'i bu görevi hâlâ deneysel olarak gösteriyor ve test için en az 8 GB RAM'li fiziksel Android cihaz öneriyor. Codelab'deki üretim çağrısı eşzamanlı çalıştığı için UI'yi dondurmamak üzere arka plan iş parçacığında yürütülmeli. İlk sürüm için 512×512 PNG hedefi makul; hız cihaz donanımına bağlı olacak. [2]

MediaPipe belgesinin referans verdiği Stable Diffusion 1.5 EMA-only checkpoint'i Hugging Face'te 4,27 GB olarak listeleniyor. Model kartı CreativeML OpenRAIL-M lisansını gösteriyor; bu nedenle ağırlıkların indirilmesi ücretsiz olsa da lisans koşulları ve yasaklı kullanım kuralları geçerli. Bu 4,27 GB, ham checkpoint boyutudur; MediaPipe için dönüştürülmüş paketin gerçek boyutu ayrıca ölçülmelidir. [3] [4]

Google'ın MobileDiffusion araştırma yazısı 520 milyon parametre ve üst sınıf Android/iOS cihazlarında 512×512 çıktı için yarım saniyeye kadar sonuç bildiriyor. Ancak yazı araştırma ve performans sonuçlarını anlatıyor; uygulamada indirilebilir bir ağırlık paketi veya entegrasyon kılavuzu sunmuyor. Bu nedenle MobileDiffusion şu an ECHO AI'ye doğrudan eklenebilir bir dağıtım seçeneği olarak kabul edilmemeli. [5]

## Önerilen plan

- Mevcut metin/kod/PDF Kanvası korunur. **Görsel Kanvası** ayrı bir ekran olarak açılır; yeni görsel akışında SVG üretilmez ve kullanıcıya teknik model adı gösterilmez.
- Görsel ağırlıkları APK'ya gömülmez. Kullanıcı görsel alanında açıkça **“ECHO AI görsel modelini indir”** eylemini başlatır. İndirme; boyut, boş alan, lisans ve cihaz uyumluluğu bilgisi gösterildikten sonra başlar. Mevcut 3,66 GB metin modelinin tekrar indirilmesi gerekmez.
- İndirmeden sonra prompt'tan PNG üretimi tamamen cihazda yapılır. Üretilen dosya yerel önizleme, Android paylaşım/kaydetme akışı ve yerel geçmiş ile sunulur; prompt veya resim çevrimiçi servise gönderilmez.
- Android uygulamasında ayrı bir Expo/Kotlin modülü; bağımsız DownloadManager kimliği, model yolu, tam boyut/SHA-256 doğrulaması ve arka plan çıkarımını yönetir. Ayrı `app/image-studio.tsx` ekranı mevcut üç ana sekmeye yeni bir sekme eklemeden kullanılır.
- İlk doğrulama kapısı; MediaPipe'a dönüştürülmüş dağıtılabilir model paketini üretmek, dönüştürülmüş boyutunu ve SHA-256 değerini sabitlemek, lisansı doğrulamak ve sabit HTTPS barındırma kaynağını belirlemektir. Bu kapı geçilmeden uygulamada tamamlanmış, indirilebilir bir model varmış gibi gösterilmez.
- Model görevi deprecated ve deneysel olduğundan önce küçük bir yerel prototip yapılır. En az 8 GB RAM'li gerçek Android cihazda üretim, süre, bellek, ısınma ve uygulama kararlılığı görülmeden genel cihaz desteği veya fotoğraf gerçekçiliği garanti edilmez. 512×512 ilk kapsamdır.

Bu araştırma bir fizibilite/uygulama planıdır; henüz uygulama kodu, yeni native bağımlılık veya model indirme altyapısı değiştirilmedi.

## Kaynaklar

[1]: https://developers.google.com/edge/mediapipe/solutions/vision/image_generator "Google AI Edge MediaPipe Image Generator guide"
[2]: https://codelabs.developers.google.com/mp-image-generation-basic-android "Google Codelab on Android on-device image generation"
[3]: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5 "Stable Diffusion v1.5 model card and license"
[4]: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/blob/main/v1-5-pruned-emaonly.ckpt "Stable Diffusion v1.5 checkpoint file metadata"
[5]: https://research.google/blog/mobilediffusion-rapid-text-to-image-generation-on-device/ "Google Research MobileDiffusion results"


## Android delivery follow-up — 2026-11-05

### Bonsai Image 4B: quality is promising, but the Android port is not a shippable general-phone option

PrismML's official announcement describes the 1-bit and ternary 4B variants as open weights/code under Apache 2.0. The ternary diffusion transformer is 1.21 GB, while the full Apple deployment is 3.88 GB. The official demo repository currently documents Apple Silicon/MLX and NVIDIA CUDA/Gemlite paths, not a supported Android SDK. A separate Apache-2.0 Android prototype from Duration AI did generate 512×512 images fully on-device, but only on a Galaxy S25+ / Snapdragon 8 Elite using a proprietary Qualcomm NPU SDK; its bundle is about 10.7 GB, peak RAM about 5 GB, and generation about 126–138 seconds. Its author explicitly says it did not reach a shippable Android app. This is useful research but unsuitable as the default ECHO AI model for ordinary Android devices.

### MobileDiffusion: excellent device fit, but no downloadable package established

Google's research report describes a 520M-parameter model that generated 512×512 images in roughly half a second on tested premium Android/iOS devices. The report does not supply downloadable weights, conversion scripts, or an app-ready model artifact. Without a public model package, it cannot satisfy the user's separate-download requirement at this time.

### SD-Turbo ONNX package: practical separate-download candidate, with limitations

A public Hugging Face asset repository provides an ONNX conversion of the official SD-Turbo model for text-to-image, not only image-to-image. Its model card lists a 512×512-only package of approximately 2.5 GB, with separate text encoder, UNet, VAE decoder, tokenizer and runtime assets. The card documents the upstream Stability AI Community License, which is free for research/non-commercial and limited commercial use subject to the threshold/terms; conversion does not grant additional rights. The upstream SD-Turbo card describes 0.9B parameters and one-step 512×512 generation, but explicitly says photorealism is imperfect and faces/text can be weak. This is the clearest presently located package for an in-app user-initiated model download, but the supported Android runtime path and WebGPU device coverage still need checking. Pin the artifact revision and calculate exact lengths/SHA-256 before it is exposed in the app.

### Android MediaPipe path: native but deprecated

The official MediaPipe Android Image Generator can load a model directory downloaded at runtime, accepts SD 1.5 EMA-only-format checkpoints after conversion, and recommends devices with at least 8 GB RAM. Its current Android documentation marks the task deprecated/no longer actively maintained. It is a possible low-effort native prototype but is a maintenance risk for the release path. The guide also requires the app developer to satisfy the upstream model license and generative-use policy.

### Sources

6. PrismML, *Introducing 1-bit and Ternary Bonsai Image 4B*, https://prismml.com/news/bonsai-image-4b — official model sizes, local-inference claims, and Apache 2.0 terms.
7. Duration AI, Android Bonsai prototype, https://github.com/duration-ai/bonsai-image-android and https://www.duration.ai/blog/generating-images-with-a-2025-android — exact NPU/device requirement, 10.7 GB bundle, latency, and non-shippable prototype status.
8. PrismML official demo, https://github.com/PrismML-Eng/Bonsai-Image-Demo — published Apple Silicon and NVIDIA CUDA deployment paths.
9. Google Research, *MobileDiffusion*, https://research.google/blog/mobilediffusion-rapid-text-to-image-generation-on-device/ — 520M model and mobile latency claim; no downloadable weights identified in the page.
10. SD-Turbo upstream card and files: https://huggingface.co/stabilityai/sd-turbo and https://huggingface.co/stabilityai/sd-turbo/tree/main — upstream limitations, 5.21 GB fp32 checkpoint, model card and license terms.
11. Public ONNX conversion: https://huggingface.co/johannes-kaindl/local-image-generator-models — approx. 2.5 GB SD-Turbo package, 512×512, component files, conversion provenance and license.
12. Official Android MediaPipe Image Generator guide: https://developers.google.com/edge/mediapipe/solutions/vision/image_generator/android and codelab https://codelabs.developers.google.com/mp-image-generation-basic-android — runtime-loaded model directory, SD 1.5 conversion, ≥8 GB RAM recommendation, deprecated status.
13. Stable Diffusion.cpp, https://github.com/leejet/stable-diffusion.cpp — MIT C/C++ runtime with Android support through Termux/Local Diffusion and .safetensors/.gguf formats; native in-app integration path still requires a focused build/device proof.
14. ShiftHackZ SDAI project, https://github.com/ShiftHackZ/Stable-Diffusion-KMP — public documentation of experimental Android local diffusion providers; app is AGPL-3.0-only, so no code should be copied into ECHO AI unless its licensing obligations are intentionally accepted.


## 2026-11-05 — mobile-ready model and native runtime selection

The strongest practical candidate located for this Android MVP is the public `NishQ1/vora-create-sd15` GGUF repository, pinned to revision `990b82c686c3c047df2f1926460b4915773d64c5`. Its current model is a Q8_0 DreamShaper 8 LCM fine-tune, about 0.9B parameters. The model card says it is already used for on-device, offline image generation in an Android app. Its exact file is 1,802,206,336 bytes with SHA-256 `dd06826d1eca711efa38190395a5ee949d0427fc6422c39433358a815e5b066c`; a 9,793,292-byte TAESD decoder is also required, SHA-256 `db169d69145ec4ff064e49d99c95fa05d3eb04ee453de35824a6d0f325513549`. The card recommends the LCM sampler, 4 steps, CFG 1, and 512×512; it reports improved people/faces/scenes over base SD 1.5, but does not guarantee photographic realism. A fresh HTTP HEAD to both pinned `resolve/<revision>/...` URLs returned 200, exact `Content-Length`, and byte-range support, so the app can show the real combined download size and use a resumable downloader. [15] [16]

The proposed runtime is `stable-diffusion.cpp`, pinned to commit `58bb3c1b1cd4749e94e39f537e9adfce295dcaee`. Its MIT C/C++ implementation accepts GGUF, exposes a C API for context creation, progress, generation and cleanup, and has an Android NDK build path. The open-source Android project Local Diffusion demonstrates on-device `stable-diffusion.cpp` use and its README provides 512×512 SD 1.5 memory figures around 2.1 GB for Q8_0; the same README cautions that Vulkan can be slower than CPU and OpenCL acceleration is currently limited to Adreno 7xx. This means the APK should target `arm64-v8a`, use a background native worker and keep a CPU fallback, while hardware speed remains device-dependent. [17] [18]

The GGUF repository is under CreativeML Open RAIL-M. Its redistribution terms require an enforceable agreement that passes the use-based restrictions to end users, a copy of the license and preserved attribution notices. TAESD is MIT-licensed; the inference runtime is also MIT. Therefore ECHO AI's ordinary image screen and notifications can remain branded only as ECHO AI, but the app must include an accessible legal-notices view and a clear acceptance step before distributing/downloading the weights. The license and notices must be retained with the APK and model download. [16] [19]

This replaces the earlier MediaPipe proposal: the new candidate is already converted to the runtime's GGUF format, has stable public URLs and checksums, and avoids a deprecated image-generation task. The larger remaining engineering risk is compiling and exercising the pinned C++ library through an Android Expo native module; no image model has been added to the APK, and no real Android device has been tested yet.

[15]: https://huggingface.co/NishQ1/vora-create-sd15/resolve/990b82c686c3c047df2f1926460b4915773d64c5/README.md "Pinned on-device model card, size, checksum, and recommended settings"
[16]: https://huggingface.co/NishQ1/vora-create-sd15/resolve/990b82c686c3c047df2f1926460b4915773d64c5/LICENSE.txt "CreativeML Open RAIL-M model license"
[17]: https://github.com/leejet/stable-diffusion.cpp/tree/58bb3c1b1cd4749e94e39f537e9adfce295dcaee "Pinned stable-diffusion.cpp source, Android support and C API"
[18]: https://github.com/rmatif/Local-Diffusion "Android local diffusion implementation and device memory/performance guidance"
[19]: https://huggingface.co/NishQ1/vora-create-sd15/tree/990b82c686c3c047df2f1926460b4915773d64c5 "Pinned model repository files and license manifest"
