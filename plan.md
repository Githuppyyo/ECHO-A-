# ECHO AI — Android Yerel AI Çalışma Alanı Planı

## Ürün kapsamı

ECHO AI yalnızca Android için geliştirilecek; iOS hedeflenmeyecek. Uygulamada **Sohbet**, **Kanvas** ve **Ayarlar** sekmeleri bulunacak. Kanvas düzenlenebilir metin/kod taslağı, yerel AI ile taslak üretimi ve cihaz üzerinde PDF çıktısı sağlayacak.

Kullanıcının arayüz kuralı: teknik model adı kullanıcıya dönük arayüzde, hata mesajında veya bildirimde gösterilmez; AI kendi altyapısını soran kullanıcıya yalnızca ECHO AI diye yanıt verir. Kurulum düğmesi tam olarak **“ECHO AI indir”** olur. İlk indirme 3,66 GB'tır; kullanıcı düğmeye basınca Android 13+ sistem bildirim izni istenir. İzin verilmezse bildirim ayarlarına yönlendirilir ve indirme başlamaz. Onaydan sonra Android'in sistem **DownloadManager** servisi kendi ağ/yeniden-deneme yaşam döngüsünde çalışır ve uygulama süreci kapanınca da sürer. Sistem bildiriminin başlığı **“ECHO AI kuruluyor...”** olur ve aktarım ilerlemesini gösterir. İndirme sürerken kullanıcı uygulamada diğer alanları kullanabilir; uygulama yeniden açıldığında saklanan veya DownloadManager kayıtlarından kurtarılan indirme kimliği sorgulanır. Tam boyut ve SHA-256 doğrulanmadan model yüklenmez. Dosya cihaza bir defa indikten sonra sohbet ve kanvas AI'si ağsız olarak cihazda işlenir. Android'in kullanıcı tarafından “Zorla durdur” edilmesi farklıdır ve indirmeyi engelleyebilir.

## Yerel AI ve dosya aktarımı

- Cihaz içi çıkarım `react-native-litert-lm` + `react-native-nitro-modules` ile yapılır; yaklaşık 3,66 GB ağırlık dosyası uygulamaya ilk kurulumda indirilir. Model/API anahtarı, uzaktaki çıkarım servisi, sohbet endpoint'i veya kanvas içeriğinin sunucuya gönderilmesi yoktur. İndirme URL'si immutable repository commit'ine sabitlenir; beklenen boyut **3.659.530.240 bayt**, SHA-256 `0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0` olarak native modülde denetlenir.
- `modules/echo-ai-downloader` altındaki Expo/Kotlin native modülü Android sistem DownloadManager'ı sarar. Modül HTTPS/izinli host URL'sini doğrular, dosyayı uygulamaya özel `externalFilesDir/Download` konumuna nötr `echoai-local-model.litertlm` adıyla indirir, sistem bildirimi için “ECHO AI kuruluyor...” başlık/açıklamasını ayarlar ve indirme kimliğini `SharedPreferences` içinde saklar. 3,66 GB'lık aktarım varsayılan olarak yalnızca tarifesiz ağda (genellikle Wi-Fi) başlar; mobil veri varsayılan olarak engellenir. DownloadManager kaydı, uygulama kimlik güncellemesini yazamadan kapanırsa dosya adıyla yeniden keşfedilir. JavaScript gerekli aralıklı sorgularla yüzde/durum/yolu alır; Android sistem servisi aktarımı JavaScript kapanınca da sürdürür. Başarılı tam indirme SHA-256 doğrulamasından sonra cihazda bir defa yüklenir.
- Android modeli desteklenmiyorsa/bellek yetersizse uygulama genel ve marka dilinde açıklama verir; uzak servise düşmez. Daha düşük KV önbellekli yerel konfigürasyon kullanılır ve kitaplığın bellek ön kontrolü korunur.
- Sohbet geçmişi konuşma başlığı, mesajlar ve son etkinlik zamanı ile `AsyncStorage` kullanılarak yalnızca cihazda saklanır; Sohbet ekranındaki yan panel kayıtlı konuşmaları listeler ve seçilen konuşmayı açar. “Yeni sohbet” önceki kaydı silmez; yeni bir oturum başlatır. Sohbet içeriği sunucuya yazılmaz.
- Android'de kullanıcı yerel fotoğraf seçicisinden aynı sohbete yeni mesaj başına en fazla dört görsel ekleyebilir. Görseller uygulamanın özel belge dizinine kopyalanır; UI/sohbet kaydında `file://` URI'leri korunur, model girişinde varlığı doğrulanıp mutlak dosya yoluna dönüştürülür. Görsel yolları geçmişte korunur ve eski `imageUri`/`imageName` kayıtları açılır; geçmiş model bağlamı yeniden kurulduğunda bellek sınırı nedeniyle önceki görsellerden en fazla ikisi yeniden eklenir. Görsel veya sohbet metni çevrim içi servise yüklenmez.
- Kullanıcı mesajları açık/koyu temaya uygun sade gri bir konuşma balonunda gösterilir; AI yanıtı geniş bir kart içine alınmadan okunaklı, açık bir akışta kalır. `ConversationHandle.executeWithEvents()` yalnızca yanıt-token olaylarını assistant mesajında geldikçe gösterir; gizli düşünme/tool-call olayları UI'ye yazılmaz ve her parçada ECHO AI marka filtresi uygulanır. Basit sohbetlerde gizli düşünme devre dışıdır; kod/PDF/görsel veya belirgin biçimde karmaşık isteklerde düşünme bütçesi 128 tokenla sınırlandırılır. Sistem istemi selamlaşma ve günlük sorularda tek cümlelik, doğrudan yanıtı tercih eder. İlk token gelmeden önce görev türüne göre “ECHO AI düşünüyor...”, “Kodu hazırlıyor...”, “PDF içeriğini hazırlıyor...” veya görsel eklendiğinde “Görüntüyü analiz ediyor...” durumu görünür. Kanvasın gerçek PDF dışa aktarımı sürerken “PDF oluşturuluyor...” görünür.
- Sohbet, Kanvas, Ayarlar, geçmiş paneli ve kurulum ekranındaki eylem düğmeleri ECHO AI monokrom paletiyle yüksek kontrastlı birincil/ikincil yüzey, belirgin kenarlık/dolgu ve en az 40 px dokunma alanı kullanır; yalnız simgeli eylemler de ayrı buton yüzeyinde gösterilir. Engelli kontroller soluklaşsa da seçilebilir eylemlerle karışmayacak biçimde görünür kalır.
- PDF, başlık ve düzenlenebilir kanvas içeriğinden `expo-print` ile cihazın geçici dosya alanında hazırlanır. HTML çıktısında kullanıcı içeriği escape edilir; kodun satır sonları/monospace görünümü korunur. `expo-sharing` Android paylaşım panelini açar; uygulama dosyayı kendiliğinden bir çevrim içi servise yüklemez.

## Android ve önizleme sınırları

- Sabit Expo Router / React Native / TypeScript / NativeWind başlangıcı korunur. `expo.platforms` yalnızca Android ve arayüz önizlemesi için Web olarak ayarlanır; iOS hedeflenmez.
- Yerel çıkarım/DownloadManager Expo Go'da doğrulanamaz; özel Android native derlemesi gerekir. Web önizlemesi üç sekmenin arayüzünü gösterebilir ancak cihaz içi AI ve Android indirme bildirimi çalıştırmaz. Android 13+ bildirim izin istemi kullanıcı indirme eylemiyle açılır. `softwareKeyboardLayoutMode: "resize"`, Android `KeyboardAvoidingView`, klavye açıkken gizlenen sekme çubuğu ve composer'ın normal klavye üstü konumuna göre toplam yaklaşık 28 dp yukarı taşınması sohbet/kanvas girişlerinin görünür kalmasını sağlar. Gerçek bildirim/uygulama kapatma, çevrimdışı ses, çoklu görsel, SVG paylaşımı ve klavye davranışı fiziksel ARM64 Android cihazda doğrulanmalıdır.
- Native çalışma tabanı Android API 26+ ve `arm64-v8a`'dır. İndirilen ağırlıklar uygulamaya özel depolamadadır; uygulamanın kaldırılması veya verilerinin temizlenmesi yerel modeli ve taslağı siler, yeni kurulum gerekebilir.
- İlk indirme yaklaşık 3,65 GB'tır; kitaplığın E4B için önerdiği bellek tabanı 6 GB+ RAM'dir. Kullanıcıya boyut ve çevrimdışı kullanım indirmenin öncesinde gösterilir. Android sistem bildirimi “ECHO AI kuruluyor...” metnini ve transfer ilerlemesini taşır; `DownloadManager` bağlantı değişikliklerinde yeniden dener ve uzun transferi uygulama sürecinden bağımsız yönetir. Kullanıcı uygulamayı normal biçimde kapatırsa transfer korunur; sistem ayarlarından zorla durdurma ayrı bir sınırdır.

## Ekran akışları ve dosya yapısı

- `app/(tabs)/index.tsx`: Türkçe sohbet; gri kullanıcı balonları, yan panelden yerel sohbet geçmişi, en fazla dört görselin eklenmesi/önizlemesi/tek tek kaldırılması ve yerel analiz; Android'de yerel mikrofon kaydı ve yalnız çevrimdışı Türkçe sesle yanıt; token geldikçe açılan yanıt; klavye görünürken normal klavye üstü konumuna göre toplam yaklaşık 28 dp yukarı taşınan composer. İndirme sürerken diğer sekmeler kullanılabilir.
- `components/chat-history-drawer.tsx`: sohbet geçmişini seçme ve yeni sohbet başlatma için soldan açılan panel.
- `components/chat-activity-status.tsx`: sohbet ve Kanvas eylemlerinde kısa, erişilebilir üretim durumu göstergesi.
- `components/animated-pressable.tsx`, `components/screen-container.tsx` ve `components/haptic-tab.tsx`: ana eylemlerde hafif basma/ripple, ekran girişinde kısa fade-kayma ve alt sekme geri bildirimi.
- `lib/chat-history.ts`: konuşma kayıtlarının `AsyncStorage` ile yerel okunması/yazılması; sunucu depolaması yok.
- `lib/chat-images.native.ts` ve `.web.ts`: dört görsele kadar Android fotoğraf seçimi, cihaz özelindeki kalıcı görsel kopyası ve Web önizlemesinde güvenli platform ayrımı; `lib/chat-image-path.ts` file URI'sini native mutlak dosya yoluna çevirir. `lib/chat-history.ts` çoklu görsel yol adlarını saklar ve eski tek-görsel kayıtlarını açar.
- `app/(tabs)/canvas.tsx`: başlık, Metin/Kod/Görsel seçimi, düzenlenebilir metin/kod taslağı, yerel AI üretimi, PDF dışa aktarımı ve yerel taslak kaydı. `components/offline-image-generator.tsx` JSON çizim sahnesini önizler ve cihazda SVG dosyasına çevirip paylaşır; `lib/offline-image-art.ts` şekil/renk sınırlarını doğrular ve güvenli SVG üretir.
- `app/(tabs)/settings.tsx`: temel Türkçe ayarlar, kalıcı açık/koyu tema, sürüm ve yerel işleme/gizlilik açıklaması.
- `app/(tabs)/_layout.tsx`: Sohbet, Kanvas ve Ayarlar sekmeleri; klavye açıkken alt sekme çubuğunu gizleme.
- `components/echo-ai-provider.native.tsx` ve `.web.tsx`, `components/echo-ai-context.ts`: tek bir ortak yerel motor/indirme durumu; Android ve Web platform ayrımı.
- `modules/echo-ai-downloader/android/src/main/java/...`: DownloadManager çağrısı, SharedPreferences saklama ve durum sorgusuna ek olarak, versionCode 6 hedefinde APK içindeki Türkçe konuşma tanıma modelini Android mikrofon akışında çalıştıran, en fazla 45 saniyelik yerel STT köprüsü. Sıkıştırılmış 36.855.784 baytlık ZIP GitHub web yükleme sınırları için iki ardışık asset parçası halinde tutulur; Kotlin `SequenceInputStream` ile tek ZIP akışı gibi açar, modeli ilk kullanımda uygulamanın özel depolamasına çıkarıp sonraki kullanımlar için saklar. Ayrı Android sistem dil paketi veya ağ gerekmez; ham ses kaydedilmez. Ağ gerektirmeyen mevcut Android TTS ayrı tutulur. `expo-module.config.json` ile yalnızca Android'de autolink.
- `assets/images/`: tam logo kare app/splash/favicon varlıkları; adaptive launcher foreground ve monochrome için şeffaf V işareti; adaptive background için düz siyah zemin.
- `lib/theme-provider.tsx`: NativeWind temasını `AsyncStorage` ile saklar.
- `app.config.ts`: mevcut `appSlug`, scheme ve Android package kimliğini korur; sabit CDN `logoUrl`, EAS project ID, yerel model eklentisi, Android minSdk/ABI, yalnız Android için mikrofon izni ve `softwareKeyboardLayoutMode: "resize"` ayarlarını tanımlar; iOS build platformu eklemez.
- `server/`: starter mobil runtime altyapısı korunur fakat uygulamanın AI, download ve PDF akışında sunucu endpoint'i kullanılmaz.

## Tasarım sistemi

- **Design Movement:** Kullanıcının ECHO AI logosuna dayalı monokrom teknoloji editoryal minimalizmi.
- **Core Principles:** Tek elle kullanım; okunabilir sohbet ve uzun kod; büyük indirmede şeffaflık; kullanıcı içeriğini cihazda tutma.
- **Color Philosophy:** Logo siyah zemin ve beyaz işarettir. Koyu görünüm gece siyahı/beyaz; açık görünüm kırık beyaz/siyah. Kullanıcının mesajları iki temada da okunabilir yumuşak gri tonlu balonda öne çıkar; birincil kontroller siyah/beyaz dolu yüzey, ikincil kontroller ayrılmış yüzey ve belirgin kenarlıkla gösterilir; yardımcı metin ve ayırıcılar daha sakin kalır.
- **Layout Paradigm:** Üç alt sekme; Sohbet dikey mesaj akışı, üstte geçmişi açan menü, soldan kayan geçmiş paneli ve altta tek elle erişilebilir mesaj alanı; Kanvas üstte belge başlığı/tür seçimi, ortada düzenleyici, altta üretim/PDF eylemleri; Ayarlar kısa gruplar halinde.
- **Signature Elements:** Kullanıcının açılı V işareti; siyah-beyaz kontrast; ince gri ayırıcılar.
- **Interaction Philosophy:** Kullanıcı “ECHO AI indir”e dokunmadan indirme başlamaz; Android bildirimi ilerlemeyi gösterir ve uygulama kapalıyken sistem indirmesi sürer. Sohbet geçmişi panelinden bir kaydı seçmek o konuşmayı açar; “Yeni sohbet” kayıtları korur. Yanıt metni ilk kullanılabilir tokenla sohbet içinde görünmeye başlar; kullanıcı tamamını beklemeden okumaya başlar. Taslak oluşturma ve PDF dışa aktarma açık kullanıcı eylemleridir.
- **Animation:** Ana ekranlar ilk açılışta yaklaşık 210 ms süren hafif fade/7 px yükselme ile belirir. Ana düğmeler kısa yaylanmayla yalnızca %1,5 küçülür ve Android'de yumuşak ripple geri bildirimi verir; alt sekmeler de küçük ölçek animasyonuyla yanıtlar. Geçmiş paneli soldan kayar; üretim göstergesi sakin kalır; animasyonlar kısa ve dikkat dağıtmayacak yoğunluktadır.
- **Typography System:** Comfortaa; gövde 15–17 px, başlık 24–28 px, yardımcı metin 12–14 px. Comfortaa metin, etiket ve butonlarda kullanılır; kod editörü ve kod blokları monospace kalır. Satır aralığı uzun sohbetlerde netliği korur.
- **Brand Essence:** “Türkçe üreten, çevrimdışı da yanında kalan çalışma alanı.” Kişilik: berrak, güvenilir, üretken.
- **Brand Voice:** Kısa, sakin, jargonsuz; önce kısa ve doğrudan yanıt, gerekirse sonra ayrıntı. Örnek: “Aklındaki soruyu yaz.” / “ECHO AI kuruluyor; sen işlerine devam edebilirsin.”
- **Wordmark & Logo:** Kullanıcının en son gönderdiği açılı beyaz V ve ECHO AI yazısı tam kare app/splash simgesinde korunur; Android adaptive safe-zone için foreground/monochrome'da yalnız V işareti, background'da saf siyah ayrı tutulur. Logo dosyasının içine yuvarlatılmış köşe çizilmez.
- **Signature Brand Color:** Siyah `#050505` ve beyaz `#FFFFFF` monokrom kontrast.

## Güncel UX değişiklikleri

- Ekrandaki başlık, paragraf, buton ve etiket metinleri uygulama başlangıcında yüklenen Comfortaa fontunu kullanır; kod editörü/kod blokları okunabilir monospace kalır.
- Android sohbet ve Kanvas girişlerinde `adjustResize` ile birlikte doğru `KeyboardAvoidingView` yüksekliği uygulanır; klavye görünürken mesajlar ve yazılan metin erişilebilir kalır. Composer sıkı/kompakt yükseklikte kalır; uygulama işletim sistemi klavyesinin kendisini küçültmeye çalışmaz.
- Sohbet yanıtlarının Markdown kod çitleri seçilebilir, monospace, yüzey içinde gösterilir. Markdown tabloları satır başına mobil uyumlu karta çevrilir: 12 px köşe yarıçapı, hafif yükselti/kenarlık, sol üstte ana başlık, sağ üstte kategori/durum rozeti ve kalan alanlarda etiket-değer detayları.
- Planlanan yeni parçalar: `components/echo-text.tsx` (fontlu metin/giriş sarmalayıcıları), `components/chat-message-content.tsx` (mesaj bloklarının görünümü) ve `lib/chat-markdown.ts` (Markdown blok ayrıştırma).

## Teknik kaynaklar

- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — SDK 57'nin sistem fotoğraf seçicisi; Android'de galeri açılışı için ek medya izni istemeden yerel URI sağlar; kullanılmayan kamera izni kapatılır, yerel konuşma çözümlemesi için mikrofon izni yalnızca kullanıcı sesli mesajı başlatınca istenir.
- [Expo FileSystem legacy](https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/) — Android'de seçilmiş `content://` görsellerini uygulamanın `documentDirectory` alanına `copyAsync` ile kalıcı kopyalama.
- [React Native LiteRT-LM](https://github.com/hung-yueh/react-native-litert-lm) — model dosyası, native API 26+/arm64 sınırı, Expo config plugin ve cihaz belleği.
- [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager) ve [Request](https://developer.android.com/reference/android/app/DownloadManager.Request) — süreçten bağımsız uzun indirme, yeniden deneme, uygulamaya özel dosya yolu ve başlık/açıklamalı sistem bildirimi.
- [Android bildirim izni](https://developer.android.com/develop/ui/compose/notifications/notification-permission) ve [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) — Android 13+ POST_NOTIFICATIONS iznini ilk indirme düğmesi sırasında isteme; izin yokken aktarımı başlatmama.
- [Dağıtım artefaktı SHA/boyut kaydı](https://huggingface.co/api/models/litert-community/gemma-4-E4B-it-litert-lm?blobs=true) — 3.659.530.240 bayt ve SHA-256 özeti; URL, repository revision `2eee7ac325f20eb8c9ac1d0e972f7c84663062da` olarak sabitlenir.
- [Android SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer) ve [RecognitionSupport](https://developer.android.com/reference/android/speech/RecognitionSupport) — versionCode 5 sistem hizmeti yaklaşımının tarihsel teknik kaynağı; APK’ye Türkçe model eklenen versionCode 6 STT sürümü bu sistem dil paketine bağlı değildir.
- [Vosk Android entegrasyonu](https://alphacephei.com/vosk/android), [Android kurulum yönergesi](https://alphacephei.com/vosk/install) ve [Türkçe model kataloğu](https://alphacephei.com/vosk/models) — APK varlığından çalışan Android tanıma kitaplığı, 35M boyutundaki hafif Türkçe model ve Apache 2.0 lisansı.
- [Vosk Android kitaplığı kaynak kodu](https://github.com/alphacep/vosk-api/tree/master/android) — `SpeechService` microphone capture/stop lifecycle; gömülü model arşivinin SHA-256 değeri `8c8d07cec1bce31add14967c16891c84152cdf76d391e33c08278119b9ea96e5`, modelin açılmış boyutu 58.767.995 bayt.
- [Expo Native Modules API](https://docs.expo.dev/modules/native-module-tutorial/) ve [local module autolinking](https://docs.expo.dev/modules/autolinking/) — proje içi Kotlin köprüsü; indirme, çevrimdışı konuşma yazıya çevirme ve TTS.
- [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/) ve [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) — Android'de cihaz içi PDF ve SVG dosyası paylaşımı.


## Sürüm 1.0.0 (versionCode 5) — uygulanmış kapsam

- **Çevrimdışı sesli sohbet:** Android 13+ üzerinde yalnız `createOnDeviceSpeechRecognizer` kullanılır ve `checkRecognitionSupport` ile Türkçe çevrimdışı dili kurulu değilse özellik başlatılmaz; yeni dil paketi indirilmez. En fazla 45 saniyelik konuşma cihazda metne çevrilir, ham ses dosyası kalıcılaştırılmaz ve yalnız bu metin mevcut yerel E4B metin modeline verilir. Yanıt yalnızca kurulu, ağ gerektirmeyen Türkçe TTS sesiyle seslendirilir; çevrimiçi yedek yoktur.
- **Çoklu görsel:** Sohbet başına istekte en çok dört resim; Android seçicisinde önizleme/kaldırma; cihaz özel klasörüne kalıcı yerel kopya; model girişinde tek multimodal istekte dördü de kullanılır. Eski `imageUri` geçmiş kayıtları geriye dönük desteklenir.
- **Çevrimdışı görsel oluşturma:** Kanvas'a Görsel modu eklenir; yerel model güvenli, sınırlı JSON çizim komutları üretir; uygulama bunları SVG vektör illüstrasyona çevirip gösterir ve paylaşım/kaydetme seçeneği sunar. Şimdiki model fotoğraf-gerçekçi raster görüntü üretmediğinden bu özellik açıkça “vektör illüstrasyon” olarak etiketlenir; ek büyük model indirilmez.
- **Klavye alanı:** Sohbet klavyesi görünürken giriş alanı normal konumundan 16 dp yukarı alınır; yazı ve gönderme düğmesi görünür kalır.
- **Android sürümü:** Mevcut paket ve scheme korunur; yeni APK için `versionCode` 5 olur. Yalnız Android EAS `preview` APK hedeflenir.

Bu özellik kapsamı ve bağımsız kabul ölçütleri `TODO.md`'ye kaydedildi; uygulama koduna eklendi. Mevcut Comfortaa, koyu/açık tema, kart düzeni, üç alt sekme ve animasyon dili korunur. Kurulu Türkçe çevrimdışı ses paketi, gerçek ses kaydı/çözümleme ve cihaz davranışları yalnız fiziksel Android testinde doğrulanabilir. VersionCode 6 Android `preview` APK'si üretildi ve teslim edildi; bu küçük v7 güncellemesinde mevcut 16 dp composer yükseltmesine yaklaşık 12 dp daha eklenerek toplam yaklaşık 28 dp hedeflenir. Klavye davranışı fiziksel Android cihazda ayrıca doğrulanmalıdır.

## Sürüm 1.0.0 (versionCode 6) — APK içinde Türkçe konuşma tanıma

- Mikrofonun Türkçe konuşmayı yazıya çevirmesi için gereken çevrimdışı model ve Android çalışma kitaplığı APK içine dahil edilir; kullanıcı Android sistem ayarlarından ek dil paketi indirmek zorunda kalmaz. Model ilk kullanımda cihazdaki uygulama özel alanına çıkarılır ve sonraki kullanımlarda tekrar indirme/çıkarma yapılmadan kullanılır.
- Mikrofon izni yalnızca kullanıcı mikrofona dokunduğunda istenir; kayıt en fazla 45 saniye sürer. Ses geçici olarak cihaz içi tanımaya aktarılır, ham ses dosyası kaydedilmez ve ağ servisine gönderilmez. Tanınan metin mevcut cihaz içi ECHO AI modeline verilir.
- Mevcut çevrimdışı TTS ayrı kalır; cihazda kurulu çevrimdışı Türkçe TTS sesi yoksa metin yanıtı korunur ve kullanıcıya seslendirme desteğinin STT modelinden bağımsız olduğu bildirilir.
- Android `versionCode` 6 olur; mevcut package/scheme ve diğer çevrimdışı sohbet özellikleri korunur. Yalnızca Android `preview` APK üretilir. APK boyutu, gömülü Türkçe model nedeniyle v5'e göre en az yaklaşık 35 MB artar.


## Sürüm 8 planı — ayrı, çevrimdışı PNG Görsel Kanvası

### Ürün akışı

v7'deki Metin/Kod/PDF Kanvası korunur. Mevcut Kanvas ekranındaki Görsel seçeneği SVG çizim sahnesi yerine ayrı bir **Görsel Kanvası** ekranını açar; ana sekme sayısı üç olarak kalır. Görsel alanı, ECHO AI markalı ayrı bir model-indirme kartı, Türkçe prompt alanı, üretim durumu ve PNG önizleme/kaydetme/paylaşma akışı içerir. Yeni görsel özelliğinin çıktısı PNG olur; kullanıcıya SVG üretildiği söylenmez. Comfortaa, monokrom tema, mevcut kart düzeni ve hafif animasyon dili sürdürülür. Kullanıcı arayüzü ve sistem bildirimi hiçbir teknik model/sağlayıcı adı göstermez.

Görsel üretim modeli APK içine gömülmez. Uygulama kurulduktan sonra kullanıcı Görsel Kanvası'nda model indirmeyi kendisi başlatır; indirme boyutu ve gereken depolama alanı önceden gösterilir. Görsel modeli, mevcut çevrimdışı sohbet modelinden ayrı dosya, yol, durum ve doğrulama kaydına sahiptir; kurulu sohbet modeli tekrar indirilmez. Görsel modeli başarıyla indirildikten ve bütünlüğü doğrulandıktan sonra prompt ve resim çıkarımı internet erişmeden Android cihazda çalışır. İlk kapsam 512×512 PNG üretimi ve Android sistem paylaşım/kaydetme akışıdır.

### Uygulama yaklaşımı ve proje yapısı

- `app/(tabs)/canvas.tsx` mevcut Metin/Kod/PDF görevlerini sürdürür; Görsel seçeneği ayrı ekrana yönlendirir. `app/_layout.tsx` içinde `image-studio` bir Stack ekranı olarak tanımlanır; `app/(tabs)/_layout.tsx` üç ana sekmeyi korur.
- Yeni `app/image-studio.tsx` ayrı, tek-elle kullanılabilir görsel alanını taşır. `components/image-model-card.tsx` indir/durum/ilerleme/hata ve depolama bilgisini; `components/image-canvas-preview.tsx` yerel PNG önizleme ve paylaşma/kaydetme eylemlerini sağlar. Mevcut `components/offline-image-generator.tsx` ve `lib/offline-image-art.ts` v7 SVG akışına aittir; yeni PNG akışı bu çizim-sahnesi yolunu kullanmaz.
- Yeni `modules/echo-ai-imagegen/` Android Expo/Kotlin modülü görsel modelinin ayrı DownloadManager görevini, uygulama özel depolamasını, boyut/SHA-256 doğrulamasını ve cihaz içi çıkarım köprüsünü yönetir. Mevcut `modules/echo-ai-downloader` sohbet modeline ait sabit dosya adı, tek indirme kimliği, boyut ve hash içerdiğinden iki büyük modelin durumunu birbirine karıştırmamak için bağımsız modül tercih edilir.
- Çıkarım eşzamanlı MediaPipe API'sinin UI'yi dondurmaması için tek bir Android arka plan yürütücüsünde çalışır; iptal/kaynak bırakma akışı tanımlanır. Mevcut `expo-file-system`/`expo-sharing` çözümleri uygunsa PNG dosyasını yerelde tutup Android paylaşım paneline verir; yeni bağımlılık ve native Gradle uyumluluğu ancak prototipte doğrulandıktan sonra sabitlenir.

### Model ve dağıtım sınırları

İlk prototip adayı, Android'de çevrimdışı metinden görsel üreten MediaPipe Image Generator ile uyumlu, fotoğraf-gerçekçiliği hedefleyen SD 1.5 tabanlı ağırlıklardır. Ancak resmi görev sayfası Image Generator'ı deprecated/aktif bakımı olmayan ve üst seviye cihazlara yönelik olarak işaretliyor. Resmi Android codelab'i en az 8 GB RAM'li fiziksel cihazı öneriyor. Referans ham checkpoint 4,27 GB ve CreativeML OpenRAIL-M lisanslıdır; bu checkpoint MediaPipe'a doğrudan yüklenmez, dönüştürülmesi gerekir. Dönüştürülmüş dağıtım paketinin boyutu henüz ölçülmemiştir ve sabit, indirilebilir bir hazır paket/hosting kaynağı bulunamamıştır. Bu nedenle v8 arayüzünde gerçek boyut ancak dönüştürülmüş paket hazırlandıktan sonra gösterilir; geçerli HTTPS indirme adresi, sabit revision, ölçülmüş bayt sayısı, SHA-256 ve lisans incelemesi olmadan özellik tamamlanmış sayılmaz. Ayrıntılı kaynaklar `research-offline-png-feasibility.md` dosyasındadır.

Google'ın MobileDiffusion araştırması daha hızlı bir yön gösterse de yayınlanan resmî yazıda uygulamaya indirilebilir ağırlık paketi veya entegrasyon yolu yoktur; bu yüzden ilk teslimat modeli olarak seçilmez. Fotoğraf-gerçekçiliği hedefi garanti değildir: v8 kapsamı 512×512 ile sınırlıdır; üretim hızı, bellek, ısınma ve sonuç kalitesi 8 GB+ RAM'li gerçek ARM64 Android cihazlarda görülmeden daha geniş cihaz desteği veya kesin süre vaadi verilmez. Lisans/uygulama koşulları kullanıcıya uygun biçimde gösterilir; ücretsiz model erişimi lisans koşullarını ortadan kaldırmaz.

İlk doğrulama aşaması yalnızca dönüştürülmüş ağırlıkların dağıtımı ve gerçek cihazda bir PNG üretilebildiğini kanıtlayan teknik prototiptir. Bu prototip başarıya ulaşmadan büyük model indirme altyapısı ve tam Görsel Kanvası arayüzü v8 APK'sına eklenmez. v8 dağıtımı Android-only `preview` APK olur; mevcut uygulama kimliği/scheme korunur ve `versionCode` 7'den 8'e yükseltilir. Hiçbir görüntü üretimi ücretli API'ye veya bulut yedeğine düşmez.

## V8 uygulama kararı — önceki MediaPipe önerisinin yerini alır

Önceki MediaPipe seçimi yalnızca fizibilite adayıydı; uygulama yolu olarak kullanılmayacaktır. Kullanıcı, ayrı indirilen çevrimdışı görsel modelini ve yeni Android APK'yı başlatmayı onayladı. Önceki “yalnızca prototip” bekleme koşulu bu kapsam için kaldırılmıştır: ayrı görsel ekranı, model indiricisi ve yerel üretim şimdi uygulanacaktır. Gerçek cihazda PNG üretimi doğrulanmadan başarı/uyumluluk iddiası yapılmayacaktır.

### Model, çalışma motoru ve lisans akışı

- Model deposu `NishQ1/vora-create-sd15`, değişmez revizyon `990b82c686c3c047df2f1926460b4915773d64c5` olarak sabitlenir. Q8_0 GGUF dosyası 1.802.206.336 bayt, SHA-256 `dd06826d1eca711efa38190395a5ee949d0427fc6422c39433358a815e5b066c`; TAESD tamamlayıcı dosyası 9.793.292 bayt, SHA-256 `db169d69145ec4ff064e49d99c95fa05d3eb04ee453de35824a6d0f325513549`. Birlikte indirme yaklaşık 1,812 GB'tır. Model ücretsiz indirilebilir; lisans koşulları kabul edilmeden indirme ve üretim açılmaz.
- Çıkarım motoru `stable-diffusion.cpp` commit `58bb3c1b1cd4749e94e39f537e9adfce295dcaee` olup Android `arm64-v8a` için derlenir. JNI köprüsü 512×512 çözünürlük, LCM örnekleyici, dört adım ve CFG 1 ayarlarıyla tek PNG üretir. İşlem arka planda yürür; iptal, hata ve ekran kapanışı durumlarında native bağlam ve görüntü belleği serbest bırakılır. Başka bir Flutter uygulamasının arayüz/kodu kopyalanmaz.
- `modules/echo-ai-imagegen/` mevcut sohbet-modeli indiricisinden ayrı kalır. Android DownloadManager ile kullanıcı başlatmalı, Wi‑Fi varsayılanlı ve uygulama kapandıktan sonra sürebilen indirme; indirilen iki dosya için tam boyut/SHA‑256 doğrulaması; yerel üretim köprüsü bu modülde tutulur. Model APK'ya gömülmez.
- İlk indirmeden önce model lisansının tam metni ve gerekli açık kaynak bildirimleri uygulama içi hukuki bilgilendirme ekranında gösterilir ve açık kullanıcı kabulü alınır. Normal görsel ekranı, indirme bildirimi ve olağan hata mesajlarında teknik model/sağlayıcı adı gösterilmez; ECHO AI markası korunur. Hukuki metinlerde gerekli kaynak/isim bildirimleri bulunur.
- İlk model indirmesi dışında ağ kullanılmaz. Prompt ve sonuç görseli cihazda kalır; bulut servisi, ücretli API veya çevrimiçi yedekleme yolu eklenmez. Bütünlük doğrulaması geçmeyen model çalıştırılmaz.

### Ekran ve proje yapısı

`app/(tabs)/canvas.tsx` metin, kod ve PDF akışlarını korur; Görsel seçeneği ayrı `app/image-studio.tsx` ekranını açar ve üç ana sekme değişmez. `components/image-model-card.tsx` ECHO AI indirme/lisans/durum, boyut, boş alan ve ilerleme bilgilerini; `components/image-canvas-preview.tsx` PNG önizleme ve Android paylaşım/kaydetme akışını sunar. `lib/imagegen.ts` ekranın kullandığı tipli köprü olur. `modules/echo-ai-imagegen/android/` DownloadManager, lisans kabulü, Kotlin Expo modülü ve C++/JNI çıkarımını kapsar. Eski SVG bileşeni ve yardımcıları PNG üretim yolunda kullanılmaz.

### Cihaz ve teslim sınırları

İlk sürüm 512×512 PNG üretir. Model kartındaki kalite beyanı fotogerçekçilik garantisi değildir; hız ve kalite cihaza bağlıdır. İlk fiziksel kontroller en az 8 GB RAM'li ARM64 Android cihazda yapılır; alt bellekli cihazlara destek sözü verilmez. İndirmeden önce tam boyut ve kullanılabilir alan gösterilir; bozuk/kesilmiş dosya yeniden indirilmeden model hazır görünmez. Android package/scheme korunur, `versionCode` 7'den 8'e yükseltilir ve yalnızca mağazaya gönderilmeyen EAS `preview` APK hazırlanır.

Ayrıntılı teknik kaynaklar, SHA değerleri ve lisans URL'leri `research-offline-png-feasibility.md` içindedir.
