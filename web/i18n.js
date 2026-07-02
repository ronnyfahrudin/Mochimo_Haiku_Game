/**
 * i18n — UI translations for The Haiku Keepers.
 * Locales: en (default), id (Bahasa Indonesia), zh (简体中文), ja (日本語).
 *
 * NOTE: the 256-word haiku vocabulary itself is NOT translated — those words
 * are the network's consensus nonce dictionary and remain in English. Only
 * the interface, guidance, and messages are localized.
 *
 * Plain script (no modules) so it runs in the browser and in Node tests.
 */

(function (root) {
  'use strict';

  const T = {
    en: {
      tagline: 'a mochimo haiku game',
      nav_now: 'now', nav_forge: 'forge', nav_anthology: 'anthology',
      aeon: 'aeon', to_neo: '{0} blocks to neogenesis',
      season_spring: 'spring', season_summer: 'summer', season_autumn: 'autumn', season_winter: 'winter',
      listening: 'listening to the chain…',
      waiting: 'waiting for a standard block…',
      haiku_of_block: 'haiku of block',
      silent: 'the network is silent',
      reborn: 'the world is reborn',
      nonce: 'nonce',
      forge_title: 'The Haiku Forge',
      forge_sub: "Compose from the network's own 256 words (the vocabulary itself is English — it is part of consensus). The grammar you must satisfy is the one the chain enforces — a finished poem is a valid Mochimo mining nonce.",
      tab_a: 'haiku I', tab_b: 'haiku II',
      strip_hint: 'tap words below — tap a placed word to remove it and everything after',
      bank_open: 'words that may open the haiku',
      bank_next: 'words that may come next',
      bank_done: 'the haiku is complete',
      submit: 'Submit to the anthology', clear: 'Clear',
      badge_valid: '✓ this poem is a structurally valid mining nonce',
      badge_half: 'one haiku complete — finish the other to forge the nonce',
      submitted: 'Submitted to aeon {0} — good luck, Keeper.',
      anth_title: 'Anthology of the Aeon',
      anth_sub: 'Aeon {0} — voting closes at Neogenesis. Verified keepers get 5 votes.',
      anth_empty: 'No poems yet this aeon. The Forge awaits.',
      vote: '✦ vote', by: 'by',
      voted: 'Voted. {0} votes left this aeon.',
      login_title: 'Sign in with your Mochimo tag',
      login_note: 'Your account tag is the 20-byte number that never changes (shown in the Mochimo Wallet). No signature needed — WOTS+ keys are one-time, so ownership is proven with a tiny deposit instead.',
      tag_ph: '0x… (40 hex characters)',
      memo_note1: 'Send a micro-transaction (any amount) to the game address with this exact reference/memo:',
      memo_note2: 'Then press “I sent it”. Verification is only required for voting and claiming rewards — you can forge poems right away.',
      continue: 'Continue', close: 'Close', sent_check: 'I sent it — check now',
      welcome_back: 'Welcome back, verified Keeper.',
      verified_ok: 'Verified. Your votes are unlocked.',
      not_seen: 'Not seen on-chain yet — give it a block or two.',
      sign_in: 'sign in', keeper: 'keeper',
      foot_open: 'open source', foot_chain: 'running on the {0} post-quantum chain',
    },

    id: {
      tagline: 'game haiku mochimo',
      nav_now: 'kini', nav_forge: 'tempa', nav_anthology: 'antologi',
      aeon: 'aeon', to_neo: '{0} blok menuju neogenesis',
      season_spring: 'semi', season_summer: 'panas', season_autumn: 'gugur', season_winter: 'dingin',
      listening: 'mendengarkan rantai…',
      waiting: 'menunggu blok standar…',
      haiku_of_block: 'haiku dari blok',
      silent: 'jaringan sedang hening',
      reborn: 'dunia terlahir kembali',
      nonce: 'nonce',
      forge_title: 'Penempaan Haiku',
      forge_sub: 'Rangkai dari 256 kata milik jaringan (kosakatanya tetap bahasa Inggris — bagian dari konsensus). Tata bahasa yang harus kamu penuhi adalah yang ditegakkan rantai itu sendiri — puisi yang selesai adalah nonce penambangan Mochimo yang sah.',
      tab_a: 'haiku I', tab_b: 'haiku II',
      strip_hint: 'ketuk kata di bawah — ketuk kata terpasang untuk menghapusnya beserta yang setelahnya',
      bank_open: 'kata pembuka haiku',
      bank_next: 'kata yang boleh menyusul',
      bank_done: 'haiku telah utuh',
      submit: 'Kirim ke antologi', clear: 'Bersihkan',
      badge_valid: '✓ puisi ini adalah nonce penambangan yang sah secara struktur',
      badge_half: 'satu haiku selesai — rampungkan satunya untuk menempa nonce',
      submitted: 'Terkirim ke aeon {0} — semoga beruntung, Penjaga.',
      anth_title: 'Antologi Aeon',
      anth_sub: 'Aeon {0} — pemungutan suara ditutup saat Neogenesis. Penjaga terverifikasi mendapat 5 suara.',
      anth_empty: 'Belum ada puisi di aeon ini. Penempaan menanti.',
      vote: '✦ pilih', by: 'oleh',
      voted: 'Tersimpan. Sisa {0} suara di aeon ini.',
      login_title: 'Masuk dengan tag Mochimo-mu',
      login_note: 'Tag akunmu adalah bilangan 20-byte yang tidak pernah berubah (terlihat di Mochimo Wallet). Tanpa tanda tangan — kunci WOTS+ sekali pakai, jadi kepemilikan dibuktikan lewat setoran kecil.',
      tag_ph: '0x… (40 karakter heksadesimal)',
      memo_note1: 'Kirim transaksi mikro (nominal bebas) ke alamat game dengan referensi/memo persis ini:',
      memo_note2: 'Lalu tekan “Sudah kukirim”. Verifikasi hanya diperlukan untuk memilih dan mengklaim hadiah — menempa puisi bisa langsung.',
      continue: 'Lanjut', close: 'Tutup', sent_check: 'Sudah kukirim — periksa',
      welcome_back: 'Selamat datang kembali, Penjaga terverifikasi.',
      verified_ok: 'Terverifikasi. Hak suaramu terbuka.',
      not_seen: 'Belum terlihat di rantai — tunggu satu-dua blok.',
      sign_in: 'masuk', keeper: 'penjaga',
      foot_open: 'sumber terbuka', foot_chain: 'berjalan di rantai pasca-kuantum {0}',
    },

    zh: {
      tagline: 'mochimo 俳句游戏',
      nav_now: '此刻', nav_forge: '锻诗', nav_anthology: '诗集',
      aeon: '纪元', to_neo: '距新创世还有 {0} 个区块',
      season_spring: '春', season_summer: '夏', season_autumn: '秋', season_winter: '冬',
      listening: '正在聆听链上……',
      waiting: '等待标准区块……',
      haiku_of_block: '区块俳句',
      silent: '网络归于寂静',
      reborn: '世界重获新生',
      nonce: '随机数',
      forge_title: '俳句锻造坊',
      forge_sub: '用网络自身的 256 个词作诗（词库为英文——它是共识的一部分）。你要满足的语法正是链本身所执行的——一首完成的诗就是一个有效的 Mochimo 挖矿随机数。',
      tab_a: '俳句一', tab_b: '俳句二',
      strip_hint: '点击下方词语——点击已放置的词可删除它及其后的所有词',
      bank_open: '可作开篇的词',
      bank_next: '可以接续的词',
      bank_done: '俳句已完成',
      submit: '提交至诗集', clear: '清空',
      badge_valid: '✓ 这首诗在结构上是一个有效的挖矿随机数',
      badge_half: '一首俳句已完成——完成另一首即可锻成随机数',
      submitted: '已提交至纪元 {0} ——祝好运，守诗人。',
      anth_title: '纪元诗集',
      anth_sub: '纪元 {0} ——投票于新创世时截止。经验证的守诗人拥有 5 票。',
      anth_empty: '本纪元尚无诗作。锻造坊在等你。',
      vote: '✦ 投票', by: '作者',
      voted: '已投票。本纪元剩余 {0} 票。',
      login_title: '使用你的 Mochimo 标签登录',
      login_note: '账户标签是永不改变的 20 字节编号（可在 Mochimo 钱包中查看）。无需签名——WOTS+ 密钥一次性使用，因此以一笔极小的转账来证明所有权。',
      tag_ph: '0x…（40 个十六进制字符）',
      memo_note1: '向游戏地址发送一笔微交易（金额不限），并附上完全一致的备注/参考：',
      memo_note2: '然后点击"已发送"。仅投票与领奖需要验证——作诗可立即开始。',
      continue: '继续', close: '关闭', sent_check: '已发送——立即检查',
      welcome_back: '欢迎回来，已验证的守诗人。',
      verified_ok: '验证成功。你的投票权已解锁。',
      not_seen: '链上尚未发现——请再等一两个区块。',
      sign_in: '登录', keeper: '守诗人',
      foot_open: '开源', foot_chain: '运行于 {0} 抗量子链',
    },

    ja: {
      tagline: 'mochimo 俳句ゲーム',
      nav_now: 'いま', nav_forge: '句作', nav_anthology: '句集',
      aeon: 'アイオン', to_neo: 'ネオジェネシスまで {0} ブロック',
      season_spring: '春', season_summer: '夏', season_autumn: '秋', season_winter: '冬',
      listening: 'チェーンに耳を澄ませて…',
      waiting: '標準ブロックを待っています…',
      haiku_of_block: 'ブロックの俳句',
      silent: 'ネットワークは静寂の中に',
      reborn: '世界は生まれ変わる',
      nonce: 'ノンス',
      forge_title: '俳句の鍛冶場',
      forge_sub: 'ネットワーク自身の256語で詠む（語彙は英語のまま——コンセンサスの一部です）。満たすべき文法はチェーンそのものが強制するもの——完成した句は有効な Mochimo マイニング・ノンスです。',
      tab_a: '一句目', tab_b: '二句目',
      strip_hint: '下の語をタップ——置いた語をタップするとそれ以降が消えます',
      bank_open: '句を開ける語',
      bank_next: '次に続けられる語',
      bank_done: '句が完成しました',
      submit: '句集へ投稿', clear: 'クリア',
      badge_valid: '✓ この句は構造的に有効なマイニング・ノンスです',
      badge_half: '一句完成——もう一句でノンスが鍛え上がります',
      submitted: 'アイオン {0} に投稿しました——幸運を、守り人よ。',
      anth_title: 'アイオンの句集',
      anth_sub: 'アイオン {0} ——投票はネオジェネシスで締切。認証済みの守り人は5票。',
      anth_empty: 'このアイオンにはまだ句がありません。鍛冶場が待っています。',
      vote: '✦ 投票', by: '詠み手',
      voted: '投票しました。このアイオンの残りは {0} 票。',
      login_title: 'Mochimo タグでサインイン',
      login_note: 'アカウントタグは決して変わらない20バイトの番号です（Mochimo ウォレットに表示）。署名は不要——WOTS+ 鍵は一度きりのため、ごく小さな送金で所有を証明します。',
      tag_ph: '0x…（16進数40文字）',
      memo_note1: 'ゲームアドレスへ少額取引（金額自由）を、この参照/メモを正確に添えて送ってください：',
      memo_note2: 'その後「送りました」を押してください。認証が必要なのは投票と報酬の受取のみ——句作はすぐに始められます。',
      continue: '続行', close: '閉じる', sent_check: '送りました——確認する',
      welcome_back: 'おかえりなさい、認証済みの守り人。',
      verified_ok: '認証されました。投票が解放されました。',
      not_seen: 'まだチェーン上に見えません——あと1、2ブロックお待ちを。',
      sign_in: 'サインイン', keeper: '守り人',
      foot_open: 'オープンソース', foot_chain: '{0} 耐量子チェーン上で稼働',
    },
  };

  const LOCALES = [
    { code: 'en', label: 'EN' },
    { code: 'id', label: 'ID' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
  ];

  let current = 'en';

  function setLocale(code) { if (T[code]) current = code; return current; }
  function getLocale() { return current; }

  /** t('key', arg0, arg1…) with {0} {1} placeholders. Falls back to en. */
  function t(key) {
    const args = Array.prototype.slice.call(arguments, 1);
    let s = (T[current] && T[current][key]) || T.en[key] || key;
    args.forEach((a, i) => { s = s.split('{' + i + '}').join(String(a)); });
    return s;
  }

  const api = { t, setLocale, getLocale, LOCALES, T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof window !== 'undefined' ? window : globalThis);
