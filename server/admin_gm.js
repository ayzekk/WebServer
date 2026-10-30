/**
 * GM PANELI - "GM KOMUTLARI" SEKMESI (GET /api/v1/admin/gm-komutlari)
 *
 * KAYNAK: gm.js `buildCommands()` kayit defteri GERCEGIN KAYNAGIDIR - komut
 * adi ve `kullanim` satiri oradan gelir; burada yalnizca KODDAN OKUNAN
 * davranis (parametre anlami, sinirlar, etkisi) uc dilde belgelenir.
 * Belgesi olmayan bir komut kayit defterinde varsa yine listelenir
 * (`belgesiz: true`, yalniz TR aciklama) - test_admin_panel.mjs bunu kirmizi
 * yakar ki komut eklenince belge de eklensin.
 *
 * YETKI (gm.js isGm): TB_User.sec_primary = 1 VE sec_content = 1. Her komut
 * SRO_WEB_GAME.dbo.WebGmLog'a yazilir (server.js gmBaglami().logGm).
 * Komutlar OYUN ICI SOHBETE yazilir ("/gm ..."); panelden calistirilmaz.
 *
 * Sayilar UYDURULMADI: hepsi gm.js'teki gercek sinirlardir (spawn <= 20,
 * dummy <= 10 / 1000 HP, peace varsayilan 300 sn / en fazla 86400, item plus
 * <= 22, find en fazla 15 sonuc, notice 200 karakter, level 1..255,
 * stat 0..32767, str/int 1..32767, kick close(4002)).
 */

const YETKI = {
  tr: 'GM (TB_User.sec_primary = 1 ve sec_content = 1); her çağrı WebGmLog’a yazılır',
  en: 'GM (TB_User.sec_primary = 1 and sec_content = 1); every call is written to WebGmLog',
  de: 'GM (TB_User.sec_primary = 1 und sec_content = 1); jeder Aufruf wird in WebGmLog protokolliert',
};

const P = (ad, tr, en, de, zorunlu = true) => ({ ad, zorunlu, aciklama: { tr, en, de } });
const OYUNCU = (zorunlu = false) => P('oyuncu',
  'Hedef karakter adı; boş bırakılırsa komutu yazan GM’in kendisi', 'Target character name; when omitted the GM who typed the command',
  'Ziel-Charaktername; ohne Angabe der GM selbst', zorunlu);

/**
 * PANEL grubu (2026-09-07): panelde suzgec icin komut GRUBU. gm.js'teki bolum
 * basliklariyla ayni ayrim (KARAKTER / ESYA / KONUM / AYARLAR) + bilgi/dunya.
 * Kayit defterindeki her komutun burada bir grubu OLMALI (test_admin_panel bunu denetler).
 */
export const GM_GRUPLARI = {
  bilgi:    { tr: 'Bilgi', en: 'Info', de: 'Info' },
  konum:    { tr: 'Konum', en: 'Position', de: 'Position' },
  karakter: { tr: 'Karakter', en: 'Character', de: 'Charakter' },
  esya:     { tr: 'Eşya', en: 'Items', de: 'Gegenstände' },
  dunya:    { tr: 'Dünya / canavar', en: 'World / monsters', de: 'Welt / Monster' },
  sunucu:   { tr: 'Sunucu', en: 'Server', de: 'Server' },
};
const GRUP = {
  help: 'bilgi', where: 'bilgi', node: 'bilgi', who: 'bilgi', pos: 'bilgi',
  gotonpc: 'konum', tp: 'konum', goto: 'konum', summon: 'konum', zone: 'konum',
  level: 'karakter', gold: 'karakter', sp: 'karakter', stat: 'karakter', str: 'karakter', int: 'karakter',
  kill: 'karakter', revive: 'karakter', peace: 'karakter', heal: 'karakter', save: 'karakter',
  item: 'esya', find: 'esya', clearbag: 'esya',
  dummy: 'dunya', spawn: 'dunya', clear: 'dunya',
  notice: 'sunucu', kick: 'sunucu', reloadcombat: 'sunucu', rate: 'sunucu',
};

/** ad -> belge. `aciklama` = kisa is; `etki` = kodun tam olarak yaptigi. */
export const GM_BELGELERI = {
  help: {
    aciklama: { tr: 'Komut listesi', en: 'Command list', de: 'Befehlsliste' },
    etki: { tr: 'Kayıtlı bütün komutları kullanım satırı ve açıklamasıyla sohbete yazar.',
      en: 'Prints every registered command with its usage line and description to chat.',
      de: 'Gibt alle registrierten Befehle mit Syntax und Beschreibung im Chat aus.' },
    parametreler: [], ornek: '/gm help',
  },
  where: {
    aciklama: { tr: 'Bulunduğun konum', en: 'Your current position', de: 'Deine aktuelle Position' },
    etki: { tr: 'Bölge kimliği ile x / z / y koordinatlarını yazar.', en: 'Prints the zone id and your x / z / y coordinates.', de: 'Gibt die Zonen-ID und deine x-/z-/y-Koordinaten aus.' },
    parametreler: [], ornek: '/gm where',
  },
  gotonpc: {
    aciklama: { tr: 'NPC yanına ışınlan', en: 'Teleport next to an NPC', de: 'Zu einem NPC teleportieren' },
    etki: { tr: 'Bulunduğun bölgedeki NPC’ler arasında adı (büyük/küçük harf duyarsız, içerme) eşleşen ilkine ışınlar; bulunamazsa hata verir.',
      en: 'Teleports you to the first NPC in your current zone whose name contains the text (case-insensitive); errors if none matches.',
      de: 'Teleportiert dich zum ersten NPC in deiner Zone, dessen Name den Text enthält (Groß-/Kleinschreibung egal); Fehler, wenn keiner passt.' },
    parametreler: [P('npcAdi', 'NPC adının bir parçası (örn. storage, jangan)', 'Part of the NPC name (e.g. storage, jangan)', 'Teil des NPC-Namens (z. B. storage, jangan)')],
    ornek: '/gm gotonpc storage',
  },
  node: {
    aciklama: { tr: 'Bulunduğun noktanın zemin verisi', en: 'Ground data at your position', de: 'Bodendaten an deiner Position' },
    etki: { tr: 'Sunucu yükseklik haritasından bulunduğun x/z için zemin y değerini yazar (gömülme/süzülme teşhisi).',
      en: 'Prints the server heightmap ground y for your x/z (for sinking/floating diagnosis).',
      de: 'Gibt die Boden-y des Server-Höhenfelds für dein x/z aus (Diagnose von Einsinken/Schweben).' },
    parametreler: [], ornek: '/gm node',
  },
  dummy: {
    aciklama: { tr: 'Test hedefi oluştur', en: 'Spawn test dummies', de: 'Test-Ziele erzeugen' },
    etki: { tr: 'Çevrende 8 birim yarıçaplı halkada pasif kuklalar doğurur: 1000 HP, saldırmaz, hareket etmez, ölünce yeniden doğmaz. /gm clear ile silinir.',
      en: 'Spawns passive dummies on an 8-unit ring around you: 1000 HP, never attack or move, do not respawn. Removed with /gm clear.',
      de: 'Erzeugt passive Puppen auf einem 8-Einheiten-Ring um dich: 1000 HP, greifen nie an, bewegen sich nicht, respawnen nicht. Entfernen mit /gm clear.' },
    parametreler: [P('sayi', 'Adet, 1–10 (varsayılan 1)', 'Count, 1–10 (default 1)', 'Anzahl, 1–10 (Standard 1)', false)],
    ornek: '/gm dummy 3',
  },
  spawn: {
    aciklama: { tr: 'Katalogdan canavar doğur', en: 'Spawn monsters from the catalog', de: 'Monster aus dem Katalog erzeugen' },
    etki: { tr: 'data/mobs.json kataloğundaki canavarı (id ya da modelKey) gerçek seviye/HP/agro/ödül tanımıyla, çevrende 20 birimlik alanda doğurur; ölünce yeniden doğmaz. Katalogda olmayan ad reddedilir ve benzer adlar önerilir.',
      en: 'Spawns a monster from data/mobs.json (id or modelKey) with its real level/HP/aggro/reward definition within 20 units around you; it does not respawn. Unknown names are rejected with suggestions.',
      de: 'Erzeugt ein Monster aus data/mobs.json (id oder modelKey) mit echter Stufe/HP/Aggro/Belohnung im Umkreis von 20 Einheiten; kein Respawn. Unbekannte Namen werden mit Vorschlägen abgelehnt.' },
    parametreler: [P('modelKey', 'Katalog anahtarı (örn. mob_mangyang, mob_stoneghost)', 'Catalog key (e.g. mob_mangyang, mob_stoneghost)', 'Katalogschlüssel (z. B. mob_mangyang, mob_stoneghost)'),
      P('sayi', 'Adet, 1–20 (varsayılan 1)', 'Count, 1–20 (default 1)', 'Anzahl, 1–20 (Standard 1)', false)],
    ornek: '/gm spawn mob_stoneghost 2',
  },
  clear: {
    aciklama: { tr: 'Oluşturulan geçici varlıkları sil', en: 'Remove spawned temporary entities', de: 'Erzeugte temporäre Objekte entfernen' },
    etki: { tr: 'Bulunduğun bölgede /gm spawn ve /gm dummy ile üretilmiş bütün varlıkları kaldırır (doğal yuvalar etkilenmez).',
      en: 'Removes every entity created by /gm spawn and /gm dummy in your zone (natural nests are untouched).',
      de: 'Entfernt alle mit /gm spawn und /gm dummy erzeugten Objekte in deiner Zone (natürliche Nester bleiben).' },
    parametreler: [], ornek: '/gm clear',
  },
  heal: {
    aciklama: { tr: 'Canını doldur', en: 'Refill your HP/MP', de: 'HP/MP auffüllen' },
    etki: { tr: 'HP ve MP’yi türetilmiş üst değere çeker; kendine vitals.update, çevreye entity.hp yollar.',
      en: 'Sets HP and MP to their derived maximum; sends vitals.update to you and entity.hp to nearby players.',
      de: 'Setzt HP und MP auf das abgeleitete Maximum; sendet vitals.update an dich und entity.hp an Spieler in der Nähe.' },
    parametreler: [], ornek: '/gm heal',
  },
  notice: {
    aciklama: { tr: 'Tüm sunucuya duyuru', en: 'Server-wide notice', de: 'Serverweite Durchsage' },
    etki: { tr: 'Metni (en fazla 200 karakter) bütün bölgelere sistem kanalında, gönderen "DUYURU" olarak yollar.',
      en: 'Broadcasts the text (max 200 characters) to every zone on the system channel with sender "DUYURU".',
      de: 'Sendet den Text (max. 200 Zeichen) an alle Zonen im Systemkanal mit Absender "DUYURU".' },
    parametreler: [P('mesaj', 'Duyuru metni', 'Notice text', 'Text der Durchsage')],
    ornek: { tr: '/gm notice Sunucu 5 dakika sonra yeniden başlatılacak', en: '/gm notice Server restart in 5 minutes', de: '/gm notice Serverneustart in 5 Minuten' },
  },
  who: {
    aciklama: { tr: 'Çevrimiçi oyuncular', en: 'Online players', de: 'Online-Spieler' },
    etki: { tr: 'Çevrimiçi oyuncu sayısını ve her birinin adı, seviyesi, bölgesi ve konumunu listeler.',
      en: 'Lists the online player count and each player’s name, level, zone and position.',
      de: 'Listet die Anzahl der Online-Spieler sowie Name, Stufe, Zone und Position jedes Spielers.' },
    parametreler: [], ornek: '/gm who',
  },
  kick: {
    aciklama: { tr: 'Oyuncuyu at', en: 'Kick a player', de: 'Spieler kicken' },
    etki: { tr: 'Oyuncuya kick{reason:gm} karesi yollar ve 200 ms sonra soketi (4002) kapatır; istemci yeniden bağlanma denemez.',
      en: 'Sends the player a kick{reason:gm} frame and closes the socket (4002) after 200 ms; the client does not try to resume.',
      de: 'Sendet dem Spieler ein kick{reason:gm}-Frame und schließt den Socket (4002) nach 200 ms; der Client versucht keinen Resume.' },
    parametreler: [P('ad', 'Karakter adı', 'Character name', 'Charaktername')],
    ornek: '/gm kick Oyuncu1',
  },
  reloadcombat: {
    aciklama: { tr: 'Savaş ayarlarını yeniden yükle', en: 'Reload combat configuration', de: 'Kampfkonfiguration neu laden' },
    etki: { tr: 'combat.json ve bağlı veri dosyalarını diskten yeniden okur; kaç dosyanın yüklendiğini yazar.',
      en: 'Re-reads combat.json and related data files from disk; reports how many files were loaded.',
      de: 'Liest combat.json und zugehörige Datendateien neu von der Festplatte; meldet die Anzahl geladener Dateien.' },
    parametreler: [], ornek: '/gm reloadcombat',
  },
  level: {
    aciklama: { tr: 'Seviye ayarla', en: 'Set level', de: 'Stufe setzen' },
    etki: { tr: 'Seviyeyi 1–255 arası değere çeker, kalan deneyimi sıfırlar, progress.levelUp + stats/progress karelerini yollar ve görev kataloğunu yeniler.',
      en: 'Sets the level (1–255), resets remaining XP to 0, sends progress.levelUp plus stats/progress frames and refreshes the quest catalog.',
      de: 'Setzt die Stufe (1–255), setzt die Rest-XP auf 0, sendet progress.levelUp sowie Stats-/Progress-Frames und aktualisiert den Questkatalog.' },
    parametreler: [P('sv', 'Yeni seviye, 1–255', 'New level, 1–255', 'Neue Stufe, 1–255'), OYUNCU()],
    ornek: '/gm level 40',
  },
  gold: {
    aciklama: { tr: 'Altın ayarla', en: 'Set gold', de: 'Gold setzen' },
    etki: { tr: 'Karakterin altınını verilen değere EŞİTLER (ekleme değil) ve envanter karesini yeniler.',
      en: 'SETS the character’s gold to the value (not added) and resends the inventory frame.',
      de: 'SETZT das Gold des Charakters auf den Wert (keine Addition) und sendet das Inventar-Frame erneut.' },
    parametreler: [P('miktar', 'Altın, 0 veya üzeri', 'Gold, 0 or more', 'Gold, 0 oder mehr'), OYUNCU()],
    ornek: '/gm gold 1000000',
  },
  sp: {
    aciklama: { tr: 'Beceri puanı ayarla', en: 'Set skill points', de: 'Skillpunkte setzen' },
    etki: { tr: 'SP’yi verilen değere eşitler ve progress.update karesiyle ekrana yansıtır.',
      en: 'Sets SP to the value and reflects it on screen via progress.update.',
      de: 'Setzt die SP auf den Wert und zeigt sie über progress.update an.' },
    parametreler: [P('miktar', 'SP, 0 veya üzeri', 'SP, 0 or more', 'SP, 0 oder mehr'), OYUNCU()],
    ornek: '/gm sp 5000',
  },
  stat: {
    aciklama: { tr: 'Dağıtılmamış stat puanı', en: 'Unspent stat points', de: 'Nicht verteilte Statuspunkte' },
    etki: { tr: 'Dağıtılmamış stat puanını 0–32767 arası değere eşitler ve stats.update yollar.',
      en: 'Sets unspent stat points to 0–32767 and sends stats.update.',
      de: 'Setzt die nicht verteilten Statuspunkte auf 0–32767 und sendet stats.update.' },
    parametreler: [P('puan', 'Puan, 0–32767', 'Points, 0–32767', 'Punkte, 0–32767'), OYUNCU()],
    ornek: '/gm stat 50',
  },
  str: {
    aciklama: { tr: 'Güç ayarla', en: 'Set STR', de: 'STR setzen' },
    etki: { tr: 'STR’yi 1–32767 arası değere eşitler; HP/MP yeni tavana kırpılır, stats.update yollanır.',
      en: 'Sets STR to 1–32767; HP/MP are clamped to the new maximum and stats.update is sent.',
      de: 'Setzt STR auf 1–32767; HP/MP werden auf das neue Maximum begrenzt, stats.update wird gesendet.' },
    parametreler: [P('deger', 'STR, 1–32767', 'STR, 1–32767', 'STR, 1–32767'), OYUNCU()],
    ornek: '/gm str 120',
  },
  int: {
    aciklama: { tr: 'Zekâ ayarla', en: 'Set INT', de: 'INT setzen' },
    etki: { tr: 'INT’i 1–32767 arası değere eşitler; HP/MP yeni tavana kırpılır, stats.update yollanır.',
      en: 'Sets INT to 1–32767; HP/MP are clamped to the new maximum and stats.update is sent.',
      de: 'Setzt INT auf 1–32767; HP/MP werden auf das neue Maximum begrenzt, stats.update wird gesendet.' },
    parametreler: [P('deger', 'INT, 1–32767', 'INT, 1–32767', 'INT, 1–32767'), OYUNCU()],
    ornek: '/gm int 120',
  },
  kill: {
    aciklama: { tr: 'Öldür', en: 'Kill', de: 'Töten' },
    etki: { tr: 'Hedefin HP’sini 0 yapar, ölü işaretler, savaş/hedef/yürüyüşünü keser; combat.death kendisine ve bölgeye yayınlanır.',
      en: 'Sets the target’s HP to 0, marks it dead, cancels combat/target/walking; combat.death is sent to the target and the zone.',
      de: 'Setzt die HP des Ziels auf 0, markiert es als tot, bricht Kampf/Ziel/Laufen ab; combat.death geht an das Ziel und die Zone.' },
    parametreler: [OYUNCU()], ornek: '/gm kill',
  },
  revive: {
    aciklama: { tr: 'Olduğu yerde tam canla dirilt', en: 'Revive in place with full HP', de: 'An Ort und Stelle mit vollen HP wiederbeleben' },
    etki: { tr: 'Yalnız ölü karakterde işler: ölü bayrağını kaldırır, HP/MP’yi doldurur, revive.result’ı kendisine ve bölgeye yayınlar.',
      en: 'Works only on a dead character: clears the dead flag, refills HP/MP and broadcasts revive.result to the target and the zone.',
      de: 'Wirkt nur bei totem Charakter: entfernt das Tot-Flag, füllt HP/MP und sendet revive.result an Ziel und Zone.' },
    parametreler: [OYUNCU()], ornek: '/gm revive Oyuncu1',
  },
  peace: {
    aciklama: { tr: 'Doğuş koruması ver (saldırılamaz)', en: 'Grant spawn protection (untargetable)', de: 'Spawnschutz geben (nicht angreifbar)' },
    etki: { tr: 'safeUntil’i ayarlar: koruma süresince canavarlar ve oyuncular sana saldıramaz, SEN DE saldıramazsın (çift yönlü). Varsayılan 300 sn, en fazla 86400; 0 = kaldır.',
      en: 'Sets safeUntil: while it lasts monsters and players cannot attack you and YOU cannot attack either (two-way). Default 300 s, max 86400; 0 = remove.',
      de: 'Setzt safeUntil: solange es gilt, können Monster und Spieler dich nicht angreifen und DU ebenfalls nicht (beidseitig). Standard 300 s, max. 86400; 0 = aufheben.' },
    parametreler: [P('saniye', 'Süre saniye, 0–86400 (varsayılan 300)', 'Duration in seconds, 0–86400 (default 300)', 'Dauer in Sekunden, 0–86400 (Standard 300)', false)],
    ornek: '/gm peace 600',
  },
  item: {
    aciklama: { tr: 'Çantaya eşya koy', en: 'Put an item in your bag', de: 'Gegenstand in die Tasche legen' },
    etki: { tr: 'Katalogdaki eşyayı ilk boş çanta yuvasına koyar; adet stackMax ile sınırlanır, plus en fazla +22, dayanıklılık üst değerle dolu gelir. Çanta doluysa hata.',
      en: 'Places the catalog item in the first empty bag slot; quantity is capped at stackMax, plus at +22, durability arrives at its maximum. Fails if the bag is full.',
      de: 'Legt den Kataloggegenstand in den ersten freien Taschenplatz; Menge bis stackMax, Plus bis +22, Haltbarkeit voll. Fehler bei voller Tasche.' },
    parametreler: [P('kimlik', 'Eşya kimliği (örn. hp_potion_01, sword01) — /gm find ile ara', 'Item id (e.g. hp_potion_01, sword01) — search with /gm find', 'Gegenstands-ID (z. B. hp_potion_01, sword01) — Suche mit /gm find'),
      P('adet', 'Adet (varsayılan 1, en fazla stackMax)', 'Quantity (default 1, at most stackMax)', 'Menge (Standard 1, höchstens stackMax)', false),
      P('plus', 'Güçlendirme +0…+22', 'Enhancement +0…+22', 'Verstärkung +0…+22', false)],
    ornek: '/gm item sword01 1 5',
  },
  find: {
    aciklama: { tr: 'Eşya kataloğunda ara', en: 'Search the item catalog', de: 'Im Gegenstandskatalog suchen' },
    etki: { tr: 'Kimlik ya da adında bütün kelimeleri içeren eşyaları listeler (en fazla 15 sonuç).',
      en: 'Lists items whose id or name contains every given word (max 15 results).',
      de: 'Listet Gegenstände, deren ID oder Name alle Wörter enthält (max. 15 Treffer).' },
    parametreler: [P('metin', 'Bir ya da daha çok arama kelimesi', 'One or more search words', 'Ein oder mehrere Suchwörter')],
    ornek: '/gm find hp potion',
  },
  clearbag: {
    aciklama: { tr: 'Çantayı boşalt', en: 'Empty your bag', de: 'Tasche leeren' },
    etki: { tr: 'Çantadaki bütün eşyaları siler (kuşam ve depo dokunulmaz) ve envanter karesini yeniler.',
      en: 'Deletes every item in the bag (equipment and storage untouched) and resends the inventory frame.',
      de: 'Löscht alle Gegenstände in der Tasche (Ausrüstung und Lager bleiben) und sendet das Inventar-Frame erneut.' },
    parametreler: [], ornek: '/gm clearbag',
  },
  tp: {
    aciklama: { tr: 'Konuma ışınlan', en: 'Teleport to coordinates', de: 'Zu Koordinaten teleportieren' },
    etki: { tr: 'Bulunduğun bölgede x/z’ye ışınlar, y zemine oturtulur, yürüyüş ve savaş kesilir; entity.teleport kendine ve bölgeye yayınlanır.',
      en: 'Teleports you to x/z in your current zone, y snapped to the ground, walking and combat cancelled; entity.teleport goes to you and the zone.',
      de: 'Teleportiert dich in der aktuellen Zone zu x/z, y auf den Boden gesetzt, Laufen und Kampf abgebrochen; entity.teleport geht an dich und die Zone.' },
    parametreler: [P('x', 'Dünya x koordinatı', 'World x coordinate', 'Welt-x-Koordinate'), P('z', 'Dünya z koordinatı', 'World z coordinate', 'Welt-z-Koordinate')],
    ornek: '/gm tp 10548 550',
  },
  goto: {
    aciklama: { tr: 'Oyuncunun ya da NPC’nin yanına git', en: 'Go to a player or NPC', de: 'Zu Spieler oder NPC gehen' },
    etki: { tr: 'Önce çevrimiçi oyuncu adı aranır (aynı bölgede olmalı; değilse /gm zone önerilir), bulunamazsa bölgedeki NPC adı/kimliği; hedefin 2 birim yanına ışınlar.',
      en: 'Looks for an online player first (must be in the same zone, otherwise /gm zone is suggested), then an NPC name/id in the zone; teleports 2 units beside the target.',
      de: 'Sucht zuerst einen Online-Spieler (gleiche Zone nötig, sonst wird /gm zone empfohlen), dann NPC-Name/-ID in der Zone; teleportiert 2 Einheiten neben das Ziel.' },
    parametreler: [P('oyuncu|npcAdi', 'Karakter adı ya da NPC adı/kimliği', 'Character name or NPC name/id', 'Charaktername oder NPC-Name/-ID')],
    ornek: '/gm goto Oyuncu1',
  },
  summon: {
    aciklama: { tr: 'Oyuncuyu yanına çağır', en: 'Summon a player to you', de: 'Spieler zu dir rufen' },
    etki: { tr: 'Aynı bölgedeki oyuncuyu 2 birim yanına ışınlar ve ona sistem mesajı yollar; başka bölgedeyse hata.',
      en: 'Teleports a player in the same zone to 2 units beside you and sends them a system message; fails if they are in another zone.',
      de: 'Teleportiert einen Spieler derselben Zone 2 Einheiten neben dich und sendet ihm eine Systemnachricht; Fehler bei anderer Zone.' },
    parametreler: [P('oyuncu', 'Karakter adı', 'Character name', 'Charaktername')],
    ornek: '/gm summon Oyuncu1',
  },
  zone: {
    aciklama: { tr: 'Bölge listesi / bölge değiştir', en: 'List zones / change zone', de: 'Zonenliste / Zone wechseln' },
    etki: { tr: 'Parametresiz bölge kimliklerini listeler; bölge verilirse o bölgenin oyuncu doğuş noktasına normal bölge geçişiyle (zone.init) taşır.',
      en: 'Without a parameter lists zone ids; with a zone it moves you to that zone’s player spawn via the normal zone transfer (zone.init).',
      de: 'Ohne Parameter Liste der Zonen-IDs; mit Zone Wechsel zum Spieler-Spawn dieser Zone per normalem Zonenwechsel (zone.init).' },
    parametreler: [P('bolge', 'Bölge kimliği (örn. jangan_province, europe_province)', 'Zone id (e.g. jangan_province, europe_province)', 'Zonen-ID (z. B. jangan_province, europe_province)', false)],
    ornek: '/gm zone europe_province',
  },
  rate: {
    aciklama: { tr: 'Sunucu ayarlarını canlı değiştir', en: 'Change server settings live', de: 'Servereinstellungen live ändern' },
    etki: { tr: 'Parametresiz bütün ayarları listeler; yalnız ad verilirse değerini ve varsayılanını gösterir; ad + değer verilirse Ayarlar sekmesiyle aynı doğrulamadan geçirip data/sunucu-ayarlari.json’a yazar ve anında uygular.',
      en: 'Without parameters lists all settings; with only a name shows its value and default; with name + value validates like the Settings tab, writes data/sunucu-ayarlari.json and applies immediately.',
      de: 'Ohne Parameter Liste aller Einstellungen; nur mit Name Wert und Standard; mit Name + Wert Validierung wie im Tab Einstellungen, Schreiben nach data/sunucu-ayarlari.json und sofortige Anwendung.' },
    parametreler: [P('ad', 'Ayar anahtarı (örn. xpRate, goldRate)', 'Setting key (e.g. xpRate, goldRate)', 'Einstellungsschlüssel (z. B. xpRate, goldRate)', false),
      P('deger', 'Yeni değer (alanın min–max sınırı içinde)', 'New value (within the field’s min–max)', 'Neuer Wert (innerhalb von min–max des Felds)', false)],
    ornek: '/gm rate xpRate 50',
  },
  save: {
    aciklama: { tr: 'Karakteri hemen kaydet', en: 'Save the character now', de: 'Charakter sofort speichern' },
    etki: { tr: 'Kalıcılık döngüsünü beklemeden konumunu ve durumunu veritabanına yazar.',
      en: 'Writes your position and state to the database without waiting for the persistence cycle.',
      de: 'Schreibt Position und Zustand sofort in die Datenbank, ohne den Persistenzzyklus abzuwarten.' },
    parametreler: [], ornek: '/gm save',
  },
  pos: {
    aciklama: { tr: 'Oyuncunun konumu', en: 'A player’s position', de: 'Position eines Spielers' },
    etki: { tr: 'Çevrimiçi oyuncunun bölgesini, x/z konumunu ve seviyesini yazar.',
      en: 'Prints an online player’s zone, x/z position and level.',
      de: 'Gibt Zone, x/z-Position und Stufe eines Online-Spielers aus.' },
    parametreler: [P('oyuncu', 'Karakter adı', 'Character name', 'Charaktername')],
    ornek: '/gm pos Oyuncu1',
  },
};

/**
 * Kayit defteri (gm.js Map) + belgeler -> panel listesi.
 * Komut adi ve `kullanim` HER ZAMAN kayit defterinden gelir; TR aciklama da
 * oradan (belge aciklama.tr onu yalnizca tamamlar).
 */
export function gmKomutListesi(komutlar) {
  const liste = [];
  for (const k of komutlar.values()) {
    const b = GM_BELGELERI[k.ad];
    liste.push({
      ad: k.ad,
      kullanim: k.kullanim,
      aciklama: { tr: k.aciklama, en: b?.aciklama?.en ?? k.aciklama, de: b?.aciklama?.de ?? k.aciklama },
      etki: b?.etki ?? { tr: k.aciklama, en: k.aciklama, de: k.aciklama },
      parametreler: b?.parametreler ?? [],
      /* ornek: dize (her dilde ayni) ya da {tr,en,de} (metin iceren komutlarda dil bazli) */
      ornek: b?.ornek ?? k.kullanim,
      yetki: YETKI,
      grup: GRUP[k.ad] ?? null,
      belgesiz: !b,
    });
  }
  return { komutlar: liste, toplam: liste.length, belgesiz: liste.filter(x => x.belgesiz).map(x => x.ad), yetki: YETKI, gruplar: GM_GRUPLARI };
}
