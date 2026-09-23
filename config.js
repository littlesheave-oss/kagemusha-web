// config.js — サーバー対戦の接続先。ここ1か所だけ変えれば3ゲームすべてに反映される。
//
// サーバーをまだ立てていない間は空文字にしておく。その場合、各ゲームの「サーバー対戦」タブは
// 接続先の入力欄が空のまま開くだけで、ブラウザ内の対戦（サンプル戦略・自作コード）は普通に動く。
window.KAGEMUSHA_API = "";

// URL に ?api=https://... を付けるとその場で切り替えられる（動作確認用）。
(function () {
  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q) window.KAGEMUSHA_API = q;
  } catch (e) {}
  document.addEventListener("DOMContentLoaded", function () {
    var el = document.getElementById("apiBase");
    if (el && !el.value && window.KAGEMUSHA_API) el.value = window.KAGEMUSHA_API;
  });
})();
