// config.js — サーバーの接続先と、ログインまわり。3ゲーム共通でここが読み込まれる。
//
// サーバー対戦は会員登録制。Googleでログインした人だけが影武者を置ける。
// ログイン状態は Cookie で保たれるので、このファイルがやることは3つだけ。
//
//   1. 接続先を各ゲームの入力欄に入れる
//   2. サーバーへの通信に資格情報（Cookie）を付ける
//   3. 画面の右上にログインボタンと自分の名前を出す

window.KAGEMUSHA_API = "https://kagemusha-api.onrender.com";

(function () {
  "use strict";

  // 動作確認用: URL に ?api=https://... を付けるとその場で切り替わる
  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q) window.KAGEMUSHA_API = q;
  } catch (e) {}

  var API = function () {
    var el = document.getElementById("apiBase");
    var v = (el && el.value) || window.KAGEMUSHA_API || "";
    return v.replace(/\/+$/, "");
  };

  // --- 2. サーバーへの通信にCookieを付ける ---------------------------------
  // ゲーム側のコードは普通に fetch を呼ぶだけなので、こちらで包んでおく。
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var base = window.KAGEMUSHA_API;
    if (base && url.indexOf(base) === 0 && !init.credentials) {
      init = Object.assign({}, init, { credentials: "include" });
    }
    return nativeFetch(input, init);
  };

  // --- 3. ログインの表示 ----------------------------------------------------

  var CSS = [
    ".kg-auth{position:fixed;top:10px;right:12px;z-index:10000;display:flex;align-items:center;gap:10px;",
    "font-family:'Zen Kaku Gothic New',system-ui,sans-serif;font-size:13px;color:#EFE7D8;",
    "background:rgba(20,18,16,.72);border:1px solid rgba(203,162,63,.35);border-radius:999px;",
    "padding:5px 12px 5px 8px;backdrop-filter:blur(6px)}",
    ".kg-auth img{width:22px;height:22px;border-radius:50%;display:block}",
    ".kg-auth button{font:inherit;color:#CBA23F;background:none;border:none;cursor:pointer;padding:2px 4px}",
    ".kg-auth button:hover{color:#EFE7D8;text-decoration:underline}",
    ".kg-auth .kg-name{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "@media(max-width:560px){.kg-auth{top:auto;bottom:10px;right:10px}}"
  ].join("");

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function login() {
    // 戻り先を覚えさせる。サーバー側の APP_ORIGIN に戻るので、そこから元のページへ。
    try { sessionStorage.setItem("kagemusha_return", location.pathname + location.search); } catch (e) {}
    location.href = API() + "/auth/google";
  }

  async function logout() {
    try {
      await fetch(API() + "/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {}
    window.KAGEMUSHA_USER = null;
    render(null);
  }

  var box = null;
  function render(user) {
    if (!box) return;
    box.innerHTML = "";
    if (user) {
      if (user.avatar) {
        var img = document.createElement("img");
        img.src = user.avatar;
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        box.appendChild(img);
      }
      box.appendChild(el("span", "kg-name", user.name));
      var out = el("button", null, "ログアウト");
      out.addEventListener("click", logout);
      box.appendChild(out);
    } else {
      var inb = el("button", null, "Googleでログイン");
      inb.addEventListener("click", login);
      box.appendChild(inb);
    }
  }

  async function refresh() {
    try {
      var r = await fetch(API() + "/api/me", { credentials: "include" });
      var j = await r.json();
      window.KAGEMUSHA_USER = j.user || null;
      window.KAGEMUSHA_MINE = j.kagemusha || [];
      render(j.user || null);
      document.dispatchEvent(new CustomEvent("kagemusha:auth", { detail: j }));
    } catch (e) {
      // サーバーが寝ている場合もここに来る。ブラウザ内の対戦には影響しない。
      render(null);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var input = document.getElementById("apiBase");
    if (input && !input.value && window.KAGEMUSHA_API) input.value = window.KAGEMUSHA_API;

    box = el("div", "kg-auth");
    document.body.appendChild(box);
    render(null);

    // ログインから戻ってきたら、元いたページへ戻す
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("login") === "ok") {
        var back = sessionStorage.getItem("kagemusha_return");
        sessionStorage.removeItem("kagemusha_return");
        if (back && back !== location.pathname + location.search) {
          location.replace(back);
          return;
        }
      } else if (p.get("login") === "banned") {
        alert("このアカウントは利用できません。");
      }
    } catch (e) {}

    refresh();
  });

  window.KAGEMUSHA_LOGIN = login;
  window.KAGEMUSHA_REFRESH = refresh;
})();
