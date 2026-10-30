# URETIM NOTU: sampiyon gorus yaricapi (championSightRangeU)

`world.js #nadirlikAgro` (BILINCLI SAPMA, RECETE b - bulgu_nadirlik_agro_2026-09-04.json)
pasif tabanli + `combat.championTacticsId > 0` olan moblarin champion/giant
varyantina agresiflik verir. Yaricap icin okuma sirasi:

1. `mobs.json` def `combat.championSightRangeU`  <- BU ALAN HENUZ URETILMIYOR
2. `spawns.json` yuva `sightRangeU` (taban taktik gorusu x 0.15; Mangyang 115 -> 17.3u)

vSRO'da sampiyonun KENDI taktiginin gorusu taban taktikten farklidir
(Mangyang: taban taktik 2 sight 115, sampiyon taktigi 1 sight 130 -> 130 x 0.15
= 19.5u). Sampiyon taktik id'leri hicbir yuvada taban taktik olarak gecmedigi
icin (31/31 cozulmuyor) bu deger gemideki JSON'lardan turetilemiyor; kosum
sirasinda sayi uydurmamak icin 2. adimdaki yuva gorusu kullaniliyor.

TAM vSRO degeri istenirse mob uretim hattina (mobs.json'i ureten adim) su alan
eklenmeli - world.js degisikligi GEREKMEZ, alan varsa otomatik oncelik kazanir:

    combat.championSightRangeU =
      Tab_RefTactics[dwTacticsID = combat.championTacticsId].nSightRange * 0.15

Kaynak tablo: SRO_VT_SHARD..Tab_RefTactics (dwTacticsID, nSightRange).
Olcek 0.15 = spawns.json sightRangeU ile ayni dunya olcegi (115 -> 17.3 dogrulandi).
