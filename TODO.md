# ECHO AI — Teslim Maddeleri

## 1. Android-only kurulum, arka plan indirmesi ve yerel AI

- ECHO AI Android için yapılır; iOS uygulaması sunulmaz.
- Kullanıcıya dönük arayüz ve sistem bildiriminde teknik model/AI sağlayıcısı adı gösterilmez; sohbet/kanvas AI çıktısı da arayüze aktarılmadan önce seçili motor adını temizler; AI sorulursa yalnızca ECHO AI olarak tanıtılır.
- Yerel kurulum yoksa kurulum düğmesinin metni tam olarak **“ECHO AI indir”** olur.
- Düğmeye basılmadan yaklaşık 3,66 GB'lık indirme başlamaz; boyut ve tamamlandıktan sonra AI özelliklerinin çevrimdışı çalışacağı önceden bildirilir. Android 13+ için sistem bildirim izni istenir; izin verilmezse indirme başlatılmaz ve bildirim ayarlarına yönlendirme sunulur. Beklenmedik veri maliyetini önlemek için indirme varsayılan olarak tarifeli/mobil ağda çalışmaz.
- Kullanıcının dokunuşundan sonra Android sistem indirme hizmeti modeli cihaza bir defa indirir. Üst sistem bildiriminin başlığı tam olarak **“ECHO AI kuruluyor...”** olur ve aktarım ilerlemesi görünür.
- İndirme sırasında kullanıcı uygulamanın Sohbet, Kanvas ve Ayarlar alanlarında çalışmaya devam edebilir; uygulama normal biçimde kapansa veya süreç sonlansa da Android sistem indirmesi sürer ve uygulama yeniden açıldığında durumu/yüzdesi kurtarılır.
- İndirme kimliği süreç sonlanması/enqueue aralığında kaybolursa DownloadManager kayıtlarından kurtarılır; dosyanın beklenen tam boyutu ve SHA-256 özeti doğrulanmadan model yüklenmez. Başarılı indirmeden sonra sonraki açılışlarda tekrar indirme yapılmadan cihazdaki ağırlıklar kullanılır. Uygulama verileri kaldırılırsa yeniden kurulum gerekebilir.
- Sohbet ve Kanvas AI'si cihazda yerel çalışır; model API anahtarı, bulut çıkarımı, sohbet endpoint'i ve kullanıcı metninin sunucuya gönderilmesi yoktur.
- Model/cihaz belleği/indirme hatasında teknik adları göstermeden genel durum ve tekrar deneme eylemi sunulur; buluta geçiş yapılmaz.
- “Yeni sohbet” yeni bir konuşma başlatır; kayıtlı eski sohbetleri silmez. Sohbet geçmişi cihazda `AsyncStorage` ile saklanır ve yan panelden tekrar açılabilir; sunucuya kaydedilmez.
- Gerçek yerel AI ve bildirim özel native Android derlemede çalışır; Expo Go ve Web önizlemesi AI indirmesini/çıkarımını yapmaz ve sınırı açıklar.

## 2. Kanvas, kod/metin üretimi ve PDF

- Uygulamada Türkçe **Kanvas** sekmesi bulunur.
- Kullanıcı kanvas başlığı ve içeriğini düzenleyebilir; **Metin** ve **Kod** arasında seçim yapabilir; kod görünümü monospace'tir ve satır sonlarını korur.
- Kullanıcı istediği metin/kod taslağını yerel AI ile oluşturabilir; taslak düzenlenebilir kanvas içeriğine aktarılır ve istek cihaz dışına gönderilmez.
- Kanvas başlığı, türü ve taslak içeriği cihazda yerel saklanır ve yeniden açıldığında geri yüklenir.
- **“PDF oluştur”** eylemi mevcut başlık ve taslaktan cihazda PDF üretir; kullanıcı Android paylaşım panelinden kaydedebilir/paylaşabilir; uygulama dosyayı kendiliğinden bir servise yüklemez.

## 3. Temel ayarlar ve logo

- Türkçe Ayarlar sekmesinde açık/koyu görünüm seçilebilir; tercih cihazda saklanır ve yeniden açılışta uygulanır.
- Ayarlarda ECHO AI adı/sürümü ve yerel işleme/gizlilik açıklaması gösterilir; teknik model/sağlayıcı adı gösterilmez.
- Kullanıcının son gönderdiği ECHO AI logosu tam biçimiyle uygulama simgesi/splash/favicon'de; açılı V işareti Android adaptive foreground ve monochrome katmanında, siyah zemin ayrı background katmanında kullanılır. Launcher maskesi logoyu kesmez ve simge görselinin içine yuvarlak köşe maskesi çizilmez.
- `assets/images/icon.png`, `assets/images/splash-icon.png`, `assets/images/favicon.png`, şeffaf V işaretli `assets/images/android-icon-foreground.png`, siyah `assets/images/android-icon-background.png` ve tek renkli `assets/images/android-icon-monochrome.png` logo varlıkları korunur.
- `app.config.ts` mevcut uygulama slug'ı, Android package kimliği ve scheme'i korur; proje logo URL'si, Android runtime plugin/minimum SDK/ABI ve sistem bildirimli Android indirmesi için gereken yapılandırma tanımlanır; iOS platformu eklenmez.

## 4. [x] Sohbet arayüzü, etkinlik durumu ve geçmiş

- Kullanıcının yazdığı mesaj sade ve düzenli gri bir konuşma balonunda görünür; balon aşırı büyük veya belirgin biçimde kabarık görünmez.
- Sohbet, Kanvas, Ayarlar, geçmiş paneli ve kurulum ekranındaki önemli eylem düğmeleri ECHO AI açık/koyu temasına uygun, yeterli kontrastlı dolu/çerçeveli yüzeylerde görünür; yalnız simgeli eylemler de ayrı ve fark edilir dokunma alanına sahiptir. Etkisiz/disabled düğmeler görünür kalır fakat etkin eylem gibi görünmez.
- Ana ekranlar kısa ve yumuşak giriş animasyonuyla açılır; Sohbet, Kanvas, Ayarlar, kurulum ve geçmiş panelindeki eylem düğmeleri dokunmada hafif ölçek/ripple geri bildirimi verir; alt sekmeler de kısa ölçek animasyonuyla yanıtlar.
- Assistant yanıtı tümü tamamlanana kadar gizlenmez: yanıt tokenları geldikçe sohbet içindeki ECHO AI mesajında sırayla görünür. İlk token gelene kadar yalnız kısa görev durumu görünür; token akışı başlayınca metin canlı güncellenir. Basit sohbetlerde gizli düşünme devre dışıdır; karmaşık kod/PDF/görsel isteklerinde düşünme en fazla 128 tokenla sınırlanır. Gizli düşünme/tool-call akışı ekranda gösterilmez ve her yanıt parçasında ECHO AI marka filtresi korunur.
- Android klavyesi açıldığında sohbet mesaj alanı ve gönder düğmesi klavyenin üzerinde kalır, içerik yeniden boyutlanır ve alt sekmeler klavye açıkken gizlenir. Kanvas metin/kod alanları da Android klavyesiyle aynı resize davranışını kullanır.
- ECHO AI yanıt hazırlarken yaptığı işe uygun kısa durum göstergesi görünür: genel yanıt için “ECHO AI düşünüyor...”, kod isteği için “Kodu hazırlıyor...”, sohbette PDF isteği için “PDF içeriğini hazırlıyor...”, görsel eklendiğinde “Görüntüyü analiz ediyor...”; Kanvas'ta gerçek PDF dışa aktarılırken “PDF oluşturuluyor...” görünür.
- Kullanıcı Android fotoğraf seçicisinden bir görsel ekleyip yerel AI ile analiz ettirebilir; görsel cihazın uygulamaya özel alanında tutulur, kayıtlı konuşma yeniden açıldığında görsel bağlamı geri kurulur ve hiçbir metin/görsel sunucuya gönderilmez.
- Sohbet başlığı, mesajları ve son etkinlik zamanı cihazda yerel saklanır. Sohbet geçmişi yan panelde listelenir; bir kayıt seçilince ilgili konuşma açılır; yeni sohbet başlatmak eski kayıtları korur.

## 5. [x] Native Android preview APK derlemesi

- EAS `preview` profiliyle Android APK başarıyla üretildi: build `aa0b5c9b-8900-4800-8102-8edbbc954acd`, 70.2 MiB. APK'nın arşiv bütünlüğü, Android manifesti ve DEX dosyaları doğrulandı.
- Bu APK, buton görünürlüğü, token-token sohbet yanıtı ve klavye düzeni düzeltmelerinden önceki commit'ten üretildi; aşağıdaki güncel APK maddesinin yerine geçmez.

## 6. [ ] Güncel arayüzü içeren Android preview APK

- Güncel kaynakta Android `versionCode: 2`, görünür tema butonları, sohbet yanıt akışı ve klavye resize düzeni vardır. Bu değişiklikleri içeren yeni APK henüz üretilmedi. EAS CLI/CI için Expo tokenı gerekir; Expo takım projesindeki `Build from GitHub` yolu da yalnızca GitHub organizasyon reposunu kabul eder ve Expo GitHub App bağlantısı ister. Bağlı GitHub hesabında şu an görünür organizasyon/depo adayı yok; kişisel hesapta repo oluşturmak bu Expo takım projesine bağlanmayacağı için yapılmaz. Derleme ya doğru, döndürülmüş Developer robot tokenı güvenli kartta sağlandıktan sonra ya da kullanıcı erişilebilir GitHub organizasyonunu bildirip Expo GitHub App bağlantısına açıkça onay verdikten sonra başlatılabilir.

## 7. [ ] Native Android gerçek cihaz yürütmesi

- Sandbox'ta Android SDK ve test cihazı olmadığından APK fiziksel cihazda açılmadı. Android 13+ izin istemi, uygulama kapalıyken DownloadManager devamı, tek seferlik indirme/dosya doğrulaması, çevrimdışı AI, PDF paylaşım paneli ve launcher ikonu cihazda çalıştırılmadı; kaynak kodu/önizleme bu davranışların gerçek cihazda kanıtı değildir.

## 8. [ ] Comfortaa, sohbet kartları ve klavye UX güncellemesi

- Uygulamanın genelinde Comfortaa fontunu entegre et. Tüm metin stillerinin (başlıklar, paragraflar, butonlar) bu fonta uyumlu olmasını sağla. Yazıların ekranda net ve okunabilir görünmesini garantile.
- Mobil klavye açıldığında ekranın sıkışmasını, içeriğin alt alta binmesini veya taşmasını önlemek için dinamik/duyarlı bir yapı kur (örneğin Android için `adjustResize` veya ilgili platforma uygun ekran yüksekliği yönetimi); sohbet ekranında yazılan metin ve gönderme alanı klavyenin üstünde görünür kalsın.
- Karmaşık tablolar yerine modern ve mobil uyumlu Kart Yapısını (Card Layout) kullan. Tablodaki her bir satırı yuvarlatılmış köşeli (`border-radius: 12px`), hafif gölgeli ve temiz boşluklara sahip ayrı karta dönüştür.
- Her kartın sol üstünde ana başlık, sağ üstünde durum/kategori bilgisini gösteren renkli etiket (badge) yer alsın. Detay verileri kart içinde düzenli grid veya alt alta etiket-değer (Key-Value) biçiminde gösterilsin.
- Genel arayüzde boşlukları (`padding`/`margin`), renk uyumunu ve öğe hizalamalarını güncel mobil tasarım ilkelerine göre optimize et.
