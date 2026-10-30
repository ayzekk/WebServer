/**
 * GM PANELI - DENETIM KUTUGU (SRO_WEB_GAME.dbo.WebGmLog)
 *
 * TEK YAZICI: hem oyun ici sohbet "/gm ..." komutlari (server.js gmBaglami().logGm)
 * hem de panelden yapilan yazma islemleri (POST/DELETE /api/v1/admin/*) buradan
 * WebGmLog'a duser. Okuma ucu: GET /api/v1/admin/kutuk (panel "Denetim Kaydi").
 *
 * Tablo (setup_web_schema.mjs): id bigint IDENTITY, JID int, charName varchar(64),
 *   command nvarchar(400), ok bit, at datetime DEFAULT GETDATE().
 * Yordam (setup_procs.mjs): WebLogGmAction(@JID int, @CharName varchar(64),
 *   @Command nvarchar(400), @Ok bit)  -> yordam parametresi 400 karakter; daha
 *   uzun komut SESSIZCE kirpilirdi, burada acikca 400'e kirpilir.
 *
 * Kimlik ayrimi (uydurma degil, tek kolonla): panel kayitlarinda charName =
 * 'panel:<kullanici adi>' (TB_User.StrUserID), sohbet kayitlarinda karakter adi.
 * Boylece ayni tabloda "kaynak" suzgeci (panel | sohbet) mumkun olur.
 *
 * Panel govdeleri kutuge yazilirken sifre alanlari maskelenir (sifre/password),
 * buyuk govdeler (mall tabs) ozetlenir; hicbir sey yazilamazsa (havuz yok) yalniz
 * sunucu gunlugune duser - islem yine yapilir (kutuk islemi engellemez).
 */

const PANEL_ONEK = 'panel:';
const KOMUT_TAVAN = 400;
const GIZLI_ALANLAR = ['sifre', 'password', 'pw', 'sifreYeni', 'newPassword'];

/** Panel govdesini kutuk satirina uygun tek satirlik ozete cevirir. */
export function govdeOzeti(uc, govde) {
  if (govde === undefined || govde === null) return '';
  if (typeof govde !== 'object') return String(govde).slice(0, 120);
  const g = Array.isArray(govde) ? govde.slice() : { ...govde };
  if (!Array.isArray(g)) {
    for (const a of GIZLI_ALANLAR) if (a in g) g[a] = '***';
    /* mall: tabs dizisi yuzlerce kalem tasiyabilir - sekme/kalem sayisi + ilk kalemler */
    if (Array.isArray(g.tabs)) {
      const n = g.tabs.reduce((t, x) => t + ((x && Array.isArray(x.items)) ? x.items.length : 0), 0);
      g.tabs = `${g.tabs.length} sekme / ${n} kalem`;
    }
    /* karakter yuva/sayisal govdeleri kucuk - oldugu gibi; ekran goruntusu gibi
       dev alanlar admin uclarinda yok ama ihtiyaten uzun dizeler kirpilir */
    for (const [k, v] of Object.entries(g)) if (typeof v === 'string' && v.length > 120) g[k] = v.slice(0, 117) + '...';
  }
  let s;
  try { s = JSON.stringify(g); } catch { s = '[ozetlenemedi]'; }
  return s;
}

export function createKutuk({ havuz, sqlAl, log = () => {} }) {
  const pool = () => { try { return havuz?.() ?? null; } catch { return null; } };
  const sql = () => { try { return sqlAl?.() ?? null; } catch { return null; } };

  /** Tek satir yaz. Donus: true = veritabanina gonderildi (asenkron), false = yalniz gunluk. */
  function yaz({ JID, kim, komut, ok }) {
    const metin = String(komut ?? '').slice(0, KOMUT_TAVAN);
    const kimS = String(kim ?? '?').slice(0, 64);
    log(`[gm] ${kimS} : ${metin} -> ${ok ? 'ok' : 'HATA'}`);
    const p = pool(), S = sql();
    const jid = Number(JID);
    if (!p || !S || !Number.isInteger(jid)) return false;
    try {
      p.request()
        .input('JID', S.Int, jid)
        .input('CharName', S.VarChar(64), kimS)
        .input('Command', S.NVarChar(KOMUT_TAVAN), metin)
        .input('Ok', S.Bit, ok ? 1 : 0)
        .execute('WebLogGmAction')
        .catch((e) => log('WebGmLog yazilamadi:', String(e?.message ?? e).slice(0, 120)));
      return true;
    } catch (e) { log('WebGmLog yazilamadi:', String(e?.message ?? e).slice(0, 120)); return false; }
  }

  /** Panel islemi: acc = {JID, userId}; uc = kisa uc adi ('hesap', 'karakter'...). */
  function panel(acc, uc, govde, sonucKodu) {
    const kod = Number(sonucKodu);
    return yaz({
      JID: acc?.JID,
      kim: PANEL_ONEK + String(acc?.userId ?? acc?.JID ?? '?'),
      komut: `panel ${uc} ${govdeOzeti(uc, govde)}`.trim(),
      ok: !(Number.isFinite(kod) && kod >= 400),
    });
  }

  const sinirla = (v, vars, tavan) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1) return vars;
    return Math.min(Math.trunc(n), tavan);
  };
  const tarih = (v) => {
    if (!v) return null;
    const t = Date.parse(String(v));
    return Number.isFinite(t) ? new Date(t) : null;
  };

  /**
   * GET /api/v1/admin/kutuk?q=&kaynak=panel|sohbet&ok=1|0&jid=&bas=YYYY-MM-DD&bit=YYYY-MM-DD&sayfa=&adet=
   * Donus: { satirlar:[{id,JID,kim,kaynak,komut,ok,at}], toplam, sayfa, adet }  |  { yok, satirlar:[], toplam:0 }
   */
  async function listele(q = {}) {
    const p = pool(), S = sql();
    const adet = sinirla(q.adet, 50, 500), sayfa = sinirla(q.sayfa, 1, 100000);
    if (!p || !S) return { yok: 'veritabani yok', satirlar: [], toplam: 0, sayfa, adet };
    const kosul = []; const girdi = [];
    const metin = String(q.q ?? '').trim().slice(0, 100);
    if (metin) { kosul.push('(command LIKE @q OR charName LIKE @q OR CAST(JID AS varchar(20)) LIKE @q)'); girdi.push(['q', S.NVarChar(120), `%${metin}%`]); }
    if (q.kaynak === 'panel') { kosul.push("charName LIKE 'panel:%'"); }
    else if (q.kaynak === 'sohbet') { kosul.push("(charName IS NULL OR charName NOT LIKE 'panel:%')"); }
    if (q.ok === '1' || q.ok === 1 || q.ok === true) { kosul.push('ok = 1'); }
    else if (q.ok === '0' || q.ok === 0 || q.ok === false) { kosul.push('ok = 0'); }
    const jid = Number(q.jid);
    if (Number.isInteger(jid) && jid > 0) { kosul.push('JID = @jid'); girdi.push(['jid', S.Int, jid]); }
    const bas = tarih(q.bas), bit = tarih(q.bit);
    if (bas) { kosul.push('at >= @bas'); girdi.push(['bas', S.DateTime, bas]); }
    if (bit) { kosul.push('at < DATEADD(day, 1, @bit)'); girdi.push(['bit', S.DateTime, bit]); }
    const where = kosul.length ? ' WHERE ' + kosul.join(' AND ') : '';
    const kur = (r) => { for (const [n, t, v] of girdi) r.input(n, t, v); return r; };
    try {
      const say = await kur(p.request()).query(`SELECT COUNT(*) AS n FROM dbo.WebGmLog${where}`);
      const r = await kur(p.request())
        .input('atla', S.Int, (sayfa - 1) * adet).input('adet', S.Int, adet)
        .query(`SELECT id, JID, charName, command, ok, at FROM dbo.WebGmLog${where}
                ORDER BY id DESC OFFSET @atla ROWS FETCH NEXT @adet ROWS ONLY`);
      return {
        toplam: Number(say.recordset?.[0]?.n ?? 0), sayfa, adet,
        satirlar: (r.recordset ?? []).map(x => {
          const kim = x.charName == null ? null : String(x.charName);
          const panelMi = !!kim && kim.startsWith(PANEL_ONEK);
          return {
            id: Number(x.id), JID: x.JID, kim: panelMi ? kim.slice(PANEL_ONEK.length) : kim,
            kaynak: panelMi ? 'panel' : 'sohbet',
            komut: String(x.command ?? ''), ok: !!x.ok,
            at: x.at instanceof Date ? x.at.toISOString() : (x.at ?? null),
          };
        }),
      };
    } catch (e) { return { yok: String(e?.message ?? e).slice(0, 200), satirlar: [], toplam: 0, sayfa, adet }; }
  }

  return { PANEL_ONEK, KOMUT_TAVAN, yaz, panel, listele, govdeOzeti };
}
