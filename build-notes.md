# Android APK Build Notları

## Seçilen yol

- Expo EAS Build `preview` profili doğrudan yüklenebilir APK üretmek üzere yapılandırılmıştır; Google Play'e yayın yapmaz.
- ECHO AI'nin mevcut tasarımında uygulama APK'sı hafiftir; model ağırlıkları ilk çalıştırmada Android DownloadManager ile **bir defa** indirilir ve bundan sonra cihazda, çevrimdışı kullanılır. Sohbet metni bir çıkarım API'sine gönderilmez.
- Model dosyası tek başına yaklaşık **3,66 GB** olduğundan pakete gömmek APK'yı çok büyütür. Google Play dağıtımında imzalı APK için sıkıştırılmış indirme sınırı 100 MB'tır; daha büyük içerik Play Asset Delivery benzeri ayrı varlık dağıtımı gerektirir. Doğrudan sideload APK için bu Play kuralı geçerli olmasa da kullanıcıya indirme/kurulum ve cihaz depolama gereksinimi yine çok yüksektir.
- İlk EAS build (`0fbd4a09-40ec-4fa6-ae90-5261ac92c79a`) Gradle'da durdu: özel `expo-echo-ai-downloader` modülünde `android.defaultConfig.versionName` tanımlı değildi. Bu değer `project.version` alanından türetilecek şekilde düzeltildi.
- İkinci EAS build (`aa0b5c9b-8900-4800-8102-8edbbc954acd`) `FINISHED` durumuyla tamamlandı. APK 73,610,032 byte (70.2 MiB); ZIP/CRC kontrolü geçti ve `AndroidManifest.xml` ile DEX dosyaları mevcut. SHA-256: `a6aea41650ff538657b61c97b5abaad4884f71115226fac099dbb3ff5eedf0f2`. Dosya `/home/ubuntu/ECHO-AI-preview.apk` konumuna indirildi. [Başarılı EAS build kaydı](https://expo.dev/accounts/echo-verses-team/projects/echoai/builds/aa0b5c9b-8900-4800-8102-8edbbc954acd)
- EAS projesi `@echo-verses-team/echoai` oluşturulup `extra.eas.projectId` ile bağlandı. Build'i başlatan token `echo-verse` Owner hesabına aittir ve sohbet içinde paylaşılmıştır; güvenlik için Expo'da şimdi iptal edilip yeni bir tokenla değiştirilmelidir.

## Sonraki arayüz düzeltmesi

- Kullanıcı önceki APK'da düğmelerin görünmediğini, sohbet yanıtının tamamı bitene kadar beklettiğini ve Android klavyesinin giriş alanını kapattığını bildirdi. Görünürlük nedeninin `AnimatedPressable` içindeki Pressable style callback'inin Animated bileşene çözülmeden aktarılması olduğu belirlendi; artık basılı durum stili önce hesaplanıp animasyonlu bileşene normal stil dizisi verilir. Ana/ikincil eylemler ayrıca temaya uygun dolgulu veya çerçeveli yüzey kullanır.
- Sohbet yanıtı `executeWithEvents()` ile yalnızca `token` olaylarında mesaj balonuna parça parça eklenir; `thinking`/`toolCall` olayları gösterilmez ve her birikmiş parçada ECHO AI marka filtresi uygulanır. Basit sohbetlerde düşünme devre dışıdır; kod/PDF/görsel veya belirgin karmaşık görevlerde bütçe 128 token, görsel analizinde 64 tokendır. İlk token öncesinde yalnız görev durumu görünür; sistem yönergesi kısa ve doğrudan ilk yanıtı tercih eder. Modelin varsayılan düşünme bütçesi de 128 tokenla sınırlıdır.
- Android klavye için Expo `softwareKeyboardLayoutMode: "resize"`, Sohbet ve Kanvas'ta Android `KeyboardAvoidingView behavior="height"` ve açık klavyede tab çubuğunu gizleme kullanılır. Android `versionCode` sonraki kurulumun önceki APK'yı güncelleyebilmesi için `2` olarak yükseltildi.
- Doğrulama: `pnpm test` (35 geçti, 1 önceden atlanan test), `pnpm check`, `pnpm lint`, Android ve Web Expo export başarılı; önizleme ekranında gönder düğmesi ve üst eylem düğmeleri görünür. Expo config Android `versionCode: 2` ve keyboard `resize` değerlerini raporladı. Gerçek Android klavye/yerel çıkarım fiziksel cihazda henüz denenmedi.
- Bu düzeltmeler için yeni APK henüz üretilmedi. Önceki Owner tokenı sohbette açığa çıktığı için kullanılmamalı; yeni EAS build için Expo'da eski tokenı iptal edip yalnız build amacıyla Developer rolündeki `ECHO AI Build` robotundan yeni token oluşturun ve bunu sadece güvenli input kartına girin.

## Token paylaşmadan build seçeneği (2026-10-11)

- EAS CLI/CI build akışı kimlik doğrulaması gerektirir; Expo'nun CI rehberi `EXPO_TOKEN` kullanılmasını tarif eder. Sandbox'taki `eas build` bu nedenle token olmadan çalıştırılamaz.
- Expo web paneli `Build from GitHub` seçeneği sunar; bu yol Expo GitHub App'i kurup Expo projesine GitHub deposu bağlamayı gerektirir. ECHO AI projesinin GitHub ayarlarında şu anda “Connect your GitHub account” görünür ve kaynak deposu bağlı değildir.
- Expo dokümanına göre Expo organizasyon projeleri yalnızca **GitHub organizasyon depolarına** bağlanabilir; kişisel hesap deposu uygun değildir. Ayrıca Expo organizasyonunda Owner/Admin yetkisi, bağlı GitHub hesabı ve Expo GitHub App izinlerinin onaylanması gerekir. Şu an bağlı GitHub hesabında görünür organizasyon veya ECHO AI/ECHO VERSE eşleşen depo bulunmadığından, uygun organizasyon deposu seçilmeden repo oluşturulamaz.
- Repo bağlantısı, uygulama kaynak kodunu GitHub/Expo GitHub App üzerinden erişilebilir hâle getirir; kullanıcı açıkça yetki vermeden bağlanmamalıdır. Mevcut pratik yol, doğru takım projesine erişimi olan döndürülmüş Developer robot tokenını güvenli kartta kullanmaktır.

## Resmî kaynaklar

- [Expo — Programmatic access](https://docs.expo.dev/accounts/programmatic-access/)
- [Expo — Trigger builds from CI](https://docs.expo.dev/build/building-on-ci/)
- [Expo — Trigger builds from GitHub App](https://docs.expo.dev/build/building-from-github/)
- [Expo — APK build profilleri](https://docs.expo.dev/build-reference/apk/)
- [Expo — EAS Build sınırlamaları](https://docs.expo.dev/build-reference/limitations/)
- [Expo — Uygulama boyutu ve APK/AAB farkı](https://docs.expo.dev/distribution/app-size/)
- [Android Developers — APK yapısı ve mağaza indirme sınırları](https://developer.android.com/topic/performance/reduce-apk-size)
- [Manus — Mobile App Publishing](https://manus.im/docs/website-builder/app-publishing) (Android yayın akışı AAB/Google Play içindir; doğrudan APK üretim profili yerine kullanılmamıştır.)
