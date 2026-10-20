# ECHO AI — Android Yerel AI Çalışma Alanı Planı

## Ürün kapsamı

ECHO AI yalnızca Android için geliştirilecek; iOS hedeflenmeyecek. Uygulamada **Sohbet**, **Kanvas** ve **Ayarlar** sekmeleri bulunacak. Kanvas düzenlenebilir metin/kod taslağı, yerel AI ile taslak üretimi ve cihaz üzerinde PDF çıktısı sağlayacak.

Kullanıcının arayüz kuralı: teknik model adı kullanıcıya dönük arayüzde, hata mesajında veya bildirimde gösterilmez; AI kendi altyapısını soran kullanıcıya yalnızca ECHO AI diye yanıt verir. Kurulum düğmesi tam olarak **“ECHO AI indir”** olur. İlk indirme 3,66 GB'tır; kullanıcı düğmeye basınca Android 13+ sistem bildirim izni istenir. İzin verilmezse bildirim ayarlarına yönlendirilir ve indirme başlamaz. Onaydan sonra Android'in sistem **DownloadManager** servisi kendi ağ/yeniden-deneme yaşam döngüsünde çalışır ve uygulama süreci kapanınca da sürer. Sistem bildiriminin başlığı **“ECHO AI kuruluyor...”** olur ve aktarım ilerlemesini gösterir. İndirme sürerken kullanıcı uygulamada diğer alanları kullanabilir; uygulama yeniden açıldığında saklanan veya DownloadManager kayıtlarından kurtarılan indirme kimliği sorgulanır. Tam boyut ve SHA-256 doğrulanmadan model yüklenmez. Dosya cihaza bir defa indikten sonra sohbet ve kanvas AI'si ağsız olarak cihazda işlenir. Android'in kullanıcı tarafından “Zorla durdur” edilmesi farklıdır ve indirmeyi engelleyebilir.

## Yerel AI ve dosya aktarımı

- Cihaz içi çıkarım `react-native-litert-lm` + `react-native-nitro-modules` ile yapılır; yaklaşık 3,66 GB ağırlık dosyası uygulamaya ilk kurulumda indirilir. Model/API anahtarı, uzaktaki çıkarım servisi, sohbet endpoint'i veya kanvas içeriğinin sunucuya gönderilmesi yoktur. İndirme URL'si immutable repository commit'ine sabitlenir; beklenen boyut **3.659.530.240 bayt**, SHA-256 `0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0` olarak native modülde denetlenir.
- `modules/echo-ai-downloader` altındaki Expo/Kotlin native modülü Android sistem DownloadManager'ı sarar. Modül HTTPS/izinli host URL'sini doğrular, dosyayı uygulamaya özel `externalFilesDir/Download` konumuna nötr `echoai-local-model.litertlm` adıyla indirir, sistem bildirimi için “ECHO AI kuruluyor...” başlık/açıklamasını ayarlar ve indirme kimliğini `SharedPreferences` içinde saklar. 3,66 GB'lık aktarım varsayılan olarak yalnızca tarifesiz ağda (genellikle Wi-Fi) başlar; mobil veri varsayılan olarak engellenir. DownloadManager kaydı, uygulama kimlik güncellemesini yazamadan kapanırsa dosya adıyla yeniden keşfedilir. JavaScript gerekli aralıklı sorgularla yüzde/durum/yolu alır; Android sistem servisi aktarımı JavaScript kapanınca da sürdürür. Başarılı tam indirme SHA-256 doğrulamasından sonra cihazda bir defa yüklenir.
- Android modeli desteklenmiyorsa/bellek yetersizse uygulama genel ve marka dilinde açıklama verir; uzak servise düşmez. Daha düşük KV önbellekli yerel konfigürasyon kullanılır ve kitaplığın bellek ön kontrolü korunur.
- Sohbet geçmişi konuşma başlığı, mesajlar ve son etkinlik zamanı ile `AsyncStorage` kullanılarak yalnızca cihazda saklanır; Sohbet ekranındaki yan panel kayıtlı konuşmaları listeler ve seçilen konuşmayı açar. “Yeni sohbet” önceki kaydı silmez; yeni bir oturum başlatır. Sohbet içeriği sunucuya yazılmaz.
- Android'de kullanıcı yerel fotoğraf seçicisinden bir görsel ekleyebilir. Görsel uygulamanın özel belge dizinine kopyalanır; UI/sohbet kaydında `file://` URI'si korunur, model girişinde varlığı doğrulanıp mutlak dosya yoluna dönüştürülür. Geçmiş konuşma yeniden açıldığında erişilebilir son iki görsel bağlamı multimodal olarak yeniden kurulur; görsel veya sohbet metni çevrim içi servise yüklenmez.
- Kullanıcı mesajları açık/koyu temaya uygun sade gri bir konuşma balonunda gösterilir; AI yanıtı geniş bir kart içine alınmadan okunaklı, açık bir akışta kalır. `ConversationHandle.executeWithEvents()` yalnızca yanıt-token olaylarını assistant mesajında geldikçe gösterir; gizli düşünme/tool-call olayları UI'ye yazılmaz ve her parçada ECHO AI marka filtresi uygulanır. Basit sohbetlerde gizli düşünme devre dışıdır; kod/PDF/görsel veya belirgin biçimde karmaşık isteklerde düşünme bütçesi 128 tokenla sınırlandırılır. Sistem istemi selamlaşma ve günlük sorularda tek cümlelik, doğrudan yanıtı tercih eder. İlk token gelmeden önce görev türüne göre “ECHO AI düşünüyor...”, “Kodu hazırlıyor...”, “PDF içeriğini hazırlıyor...” veya görsel eklendiğinde “Görüntüyü analiz ediyor...” durumu görünür. Kanvasın gerçek PDF dışa aktarımı sürerken “PDF oluşturuluyor...” görünür.
- Sohbet, Kanvas, Ayarlar, geçmiş paneli ve kurulum ekranındaki eylem düğmeleri ECHO AI monokrom paletiyle yüksek kontrastlı birincil/ikincil yüzey, belirgin kenarlık/dolgu ve en az 40 px dokunma alanı kullanır; yalnız simgeli eylemler de ayrı buton yüzeyinde gösterilir. Engelli kontroller soluklaşsa da seçilebilir eylemlerle karışmayacak biçimde görünür kalır.
- PDF, başlık ve düzenlenebilir kanvas içeriğinden `expo-print` ile cihazın geçici dosya alanında hazırlanır. HTML çıktısında kullanıcı içeriği escape edilir; kodun satır sonları/monospace görünümü korunur. `expo-sharing` Android paylaşım panelini açar; uygulama dosyayı kendiliğinden bir çevrim içi servise yüklemez.

## Android ve önizleme sınırları

- Sabit Expo Router / React Native / TypeScript / NativeWind başlangıcı korunur. `expo.platforms` yalnızca Android ve arayüz önizlemesi için Web olarak ayarlanır; iOS hedeflenmez.
- Yerel çıkarım/DownloadManager Expo Go'da doğrulanamaz; özel Android native derlemesi gerekir. Web önizlemesi üç sekmenin arayüzünü gösterebilir ancak cihaz içi AI ve Android indirme bildirimi çalıştırmaz. Android 13+ bildirim izin istemi kullanıcı indirme eylemiyle açılır. `softwareKeyboardLayoutMode: "resize"`, Android `KeyboardAvoidingView` ve klavye açıkken sekme çubuğunu gizleme sohbet/kanvas girişlerinin klavye üzerinde kalmasını sağlar. Gerçek bildirim/uygulama kapatma ve klavye davranışı fiziksel ARM64 Android cihazda doğrulanmalıdır.
- Native çalışma tabanı Android API 26+ ve `arm64-v8a`'dır. İndirilen ağırlıklar uygulamaya özel depolamadadır; uygulamanın kaldırılması veya verilerinin temizlenmesi yerel modeli ve taslağı siler, yeni kurulum gerekebilir.
- İlk indirme yaklaşık 3,65 GB'tır; kitaplığın E4B için önerdiği bellek tabanı 6 GB+ RAM'dir. Kullanıcıya boyut ve çevrimdışı kullanım indirmenin öncesinde gösterilir. Android sistem bildirimi “ECHO AI kuruluyor...” metnini ve transfer ilerlemesini taşır; `DownloadManager` bağlantı değişikliklerinde yeniden dener ve uzun transferi uygulama sürecinden bağımsız yönetir. Kullanıcı uygulamayı normal biçimde kapatırsa transfer korunur; sistem ayarlarından zorla durdurma ayrı bir sınırdır.

## Ekran akışları ve dosya yapısı

- `app/(tabs)/index.tsx`: Türkçe sohbet; gri kullanıcı balonları, yan panelden yerel sohbet geçmişi, görsel ekleme ve yerel analiz; belirgin tema uyumlu kontroller; token geldikçe açılan yanıt; ilk token öncesi görev durumu; klavyeden etkilenmeyen composer. İndirme sürerken diğer sekmeler kullanılabilir.
- `components/chat-history-drawer.tsx`: sohbet geçmişini seçme ve yeni sohbet başlatma için soldan açılan panel.
- `components/chat-activity-status.tsx`: sohbet ve Kanvas eylemlerinde kısa, erişilebilir üretim durumu göstergesi.
- `components/animated-pressable.tsx`, `components/screen-container.tsx` ve `components/haptic-tab.tsx`: ana eylemlerde hafif basma/ripple, ekran girişinde kısa fade-kayma ve alt sekme geri bildirimi.
- `lib/chat-history.ts`: konuşma kayıtlarının `AsyncStorage` ile yerel okunması/yazılması; sunucu depolaması yok.
- `lib/chat-images.native.ts` ve `.web.ts`: Android fotoğraf seçimi, cihaz özelindeki kalıcı görsel kopyası ve Web önizlemesinde güvenli platform ayrımı; `lib/chat-image-path.ts` file URI'sini native mutlak dosya yoluna çevirir.
- `app/(tabs)/canvas.tsx`: başlık, Metin/Kod seçimi, düzenlenebilir taslak, yerel AI isteği/sonucu, PDF dışa aktarım durumu, paylaşım akışı ve yerel taslak kaydı.
- `app/(tabs)/settings.tsx`: temel Türkçe ayarlar, kalıcı açık/koyu tema, sürüm ve yerel işleme/gizlilik açıklaması.
- `app/(tabs)/_layout.tsx`: Sohbet, Kanvas ve Ayarlar sekmeleri; klavye açıkken alt sekme çubuğunu gizleme.
- `components/echo-ai-provider.native.tsx` ve `.web.tsx`, `components/echo-ai-context.ts`: tek bir ortak yerel motor/indirme durumu; Android ve Web platform ayrımı.
- `modules/echo-ai-downloader/android/src/main/java/...`: DownloadManager çağrısı, SharedPreferences saklama ve durum sorgusu; `expo-module.config.json` ile yalnızca Android'de autolink.
- `assets/images/`: tam logo kare app/splash/favicon varlıkları; adaptive launcher foreground ve monochrome için şeffaf V işareti; adaptive background için düz siyah zemin.
- `lib/theme-provider.tsx`: NativeWind temasını `AsyncStorage` ile saklar.
- `app.config.ts`: mevcut `appSlug`, scheme ve Android package kimliğini korur; sabit CDN `logoUrl`, EAS project ID, yerel model eklentisi, Android minSdk/ABI, platform ve `softwareKeyboardLayoutMode: "resize"` ayarlarını tanımlar; iOS build platformu eklemez.
- `server/`: starter mobil runtime altyapısı korunur fakat uygulamanın AI, download ve PDF akışında sunucu endpoint'i kullanılmaz.

## Tasarım sistemi

- **Design Movement:** Kullanıcının ECHO AI logosuna dayalı monokrom teknoloji editoryal minimalizmi.
- **Core Principles:** Tek elle kullanım; okunabilir sohbet ve uzun kod; büyük indirmede şeffaflık; kullanıcı içeriğini cihazda tutma.
- **Color Philosophy:** Logo siyah zemin ve beyaz işarettir. Koyu görünüm gece siyahı/beyaz; açık görünüm kırık beyaz/siyah. Kullanıcının mesajları iki temada da okunabilir yumuşak gri tonlu balonda öne çıkar; birincil kontroller siyah/beyaz dolu yüzey, ikincil kontroller ayrılmış yüzey ve belirgin kenarlıkla gösterilir; yardımcı metin ve ayırıcılar daha sakin kalır.
- **Layout Paradigm:** Üç alt sekme; Sohbet dikey mesaj akışı, üstte geçmişi açan menü, soldan kayan geçmiş paneli ve altta tek elle erişilebilir mesaj alanı; Kanvas üstte belge başlığı/tür seçimi, ortada düzenleyici, altta üretim/PDF eylemleri; Ayarlar kısa gruplar halinde.
- **Signature Elements:** Kullanıcının açılı V işareti; siyah-beyaz kontrast; ince gri ayırıcılar.
- **Interaction Philosophy:** Kullanıcı “ECHO AI indir”e dokunmadan indirme başlamaz; Android bildirimi ilerlemeyi gösterir ve uygulama kapalıyken sistem indirmesi sürer. Sohbet geçmişi panelinden bir kaydı seçmek o konuşmayı açar; “Yeni sohbet” kayıtları korur. Yanıt metni ilk kullanılabilir tokenla sohbet içinde görünmeye başlar; kullanıcı tamamını beklemeden okumaya başlar. Taslak oluşturma ve PDF dışa aktarma açık kullanıcı eylemleridir.
- **Animation:** Ana ekranlar ilk açılışta yaklaşık 210 ms süren hafif fade/7 px yükselme ile belirir. Ana düğmeler kısa yaylanmayla yalnızca %1,5 küçülür ve Android'de yumuşak ripple geri bildirimi verir; alt sekmeler de küçük ölçek animasyonuyla yanıtlar. Geçmiş paneli soldan kayar; üretim göstergesi sakin kalır; animasyonlar kısa ve dikkat dağıtmayacak yoğunluktadır.
- **Typography System:** Yerel sans-serif; başlık 24–28 px, sohbet 15–17 px, yardımcı metin 12–14 px; Kod modunda monospace.
- **Brand Essence:** “Türkçe üreten, çevrimdışı da yanında kalan çalışma alanı.” Kişilik: berrak, güvenilir, üretken.
- **Brand Voice:** Kısa, sakin, jargonsuz; önce kısa ve doğrudan yanıt, gerekirse sonra ayrıntı. Örnek: “Aklındaki soruyu yaz.” / “ECHO AI kuruluyor; sen işlerine devam edebilirsin.”
- **Wordmark & Logo:** Kullanıcının en son gönderdiği açılı beyaz V ve ECHO AI yazısı tam kare app/splash simgesinde korunur; Android adaptive safe-zone için foreground/monochrome'da yalnız V işareti, background'da saf siyah ayrı tutulur. Logo dosyasının içine yuvarlatılmış köşe çizilmez.
- **Signature Brand Color:** Siyah `#050505` ve beyaz `#FFFFFF` monokrom kontrast.

## Teknik kaynaklar

- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — SDK 57'nin sistem fotoğraf seçicisi; Android'de galeri açılışı için ek medya izni istemeden yerel URI sağlar; kullanılmayan kamera ve mikrofon izinleri config plugin ile kapatılır.
- [Expo FileSystem legacy](https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/) — Android'de seçilmiş `content://` görsellerini uygulamanın `documentDirectory` alanına `copyAsync` ile kalıcı kopyalama.
- [React Native LiteRT-LM](https://github.com/hung-yueh/react-native-litert-lm) — model dosyası, native API 26+/arm64 sınırı, Expo config plugin ve cihaz belleği.
- [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager) ve [Request](https://developer.android.com/reference/android/app/DownloadManager.Request) — süreçten bağımsız uzun indirme, yeniden deneme, uygulamaya özel dosya yolu ve başlık/açıklamalı sistem bildirimi.
- [Android bildirim izni](https://developer.android.com/develop/ui/compose/notifications/notification-permission) ve [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) — Android 13+ POST_NOTIFICATIONS iznini ilk indirme düğmesi sırasında isteme; izin yokken aktarımı başlatmama.
- [Dağıtım artefaktı SHA/boyut kaydı](https://huggingface.co/api/models/litert-community/gemma-4-E4B-it-litert-lm?blobs=true) — 3.659.530.240 bayt ve SHA-256 özeti; URL, repository revision `2eee7ac325f20eb8c9ac1d0e972f7c84663062da` olarak sabitlenir.
- [Expo Native Modules API](https://docs.expo.dev/modules/native-module-tutorial/) ve [local module autolinking](https://docs.expo.dev/modules/autolinking/) — proje içi Kotlin köprüsü.
- [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/) ve [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) — Android'de cihaz içi PDF ve dosya paylaşımı.
