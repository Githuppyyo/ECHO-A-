# ECHO AI — Android

ECHO AI; sohbet, metin/kod Kanvası ve cihazda PDF üretimi sunan **Android-only** bir uygulama prototipidir. iOS hedefi yoktur.

## Çalıştırma

- `pnpm dev`: Web önizlemesini (`8081`) ve başlangıç şablonunun kullanılmayan API sunucusunu (`3000`) başlatır.
- `pnpm run android`: Android SDK ve bağlı/emülatör cihazla özel yerel derlemeyi başlatır.
- Yerel AI çıkarımı ve Android sistem indirme bildirimi **Web Preview veya Expo Go'da çalışmaz**. Gerçek cihaz denemesi için özel Android derlemesi gerekir; Dashboard üzerinden APK/AAB oluşturulabilir.
- Bu Sandbox ortamında Android SDK/cihaz bulunmadığı için burada APK/AAB üretilmedi; indirme bildirimi, uygulama kapanınca devam, yerel inference ve PDF paylaşımı fiziksel Android'de henüz doğrulanmadı.

## İlk kurulum

- **“ECHO AI indir”** düğmesine dokununca Android 13+ bildirim izni istenir. İzin verildiğinde cihaz yaklaşık **3,66 GB** dosyayı Android sistem indirme hizmetiyle alır; başlık “ECHO AI kuruluyor...” olur. Dosya yüklenmeden önce boyut ve SHA-256 doğrulanır.
- Android uygulama süreci normal biçimde kapatılsa da sistem indirmesi devam eder. Android ayarlarından **Zorla durdur** işlemi farklıdır ve aktarımı etkileyebilir.
- Veri maliyetini önlemek için indirme varsayılan olarak tarifeli/mobil ağda kapalıdır. 6 GB veya üzeri RAM önerilir. Bildirim izni reddedilirse indirme başlamaz; Android ayarlarından ECHO AI bildirimlerini açıp yeniden deneyebilirsin.
- Sohbet ve Kanvas üretimi cihazda çalışır. Kanvas taslağı ve tema tercihi cihazda saklanır. PDF cihazda hazırlanır; kullanıcı Android paylaşım panelinden kaydedebilir veya paylaşabilir.
- Uygulamayı kaldırmak ya da uygulama verilerini temizlemek indirilen dosyayı ve yerel taslağı silebilir.
