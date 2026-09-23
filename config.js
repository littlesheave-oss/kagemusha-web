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

  // いま開いているゲーム（ファイル名から判断する）
  var GAME = (function () {
    var f = (location.pathname.split("/").pop() || "").toLowerCase();
    var known = ["reversi", "chess", "shogi", "mahjong", "blackjack", "poker"];
    for (var i = 0; i < known.length; i++) if (f.indexOf(known[i]) === 0) return known[i];
    return "reversi";
  })();

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
    var isCreate = base && (init.method || "GET").toUpperCase() === "POST" &&
      url.replace(/\?.*$/, "") === base.replace(/\/+$/, "") + "/api/kagemusha";
    var p = nativeFetch(input, init);
    if (!isCreate) return p;

    // 影武者を置ける数は決まっている（無料は1体）。上限に当たったときは、
    // 黙って諦めるのではなく「いまの影武者を書き換えますか？」と聞いてから書き換える。
    return p.then(function (res) {
      if (res.status !== 403) { refresh(); return res; }
      return res.clone().json().then(function (j) {
        if (!j || j.error_code !== "limit_reached" || !j.replaceable) return res;
        var sent = {};
        try { sent = JSON.parse(init.body || "{}"); } catch (e) {}
        var ok = window.confirm(
          j.plan === "paid"
            ? "影武者は " + j.limit + " 体までです。\nいま使っている「" + j.replaceable.name + "」をこの内容で書き換えますか？"
            : "無料プランで持てる影武者は " + j.limit + " 体です。\nいま使っている「" + j.replaceable.name +
              "」をこの内容で書き換えますか？\n（レートと戦績はそのまま引き継がれます）"
        );
        if (!ok) return res;
        return nativeFetch(API() + "/api/kagemusha/" + j.replaceable.id, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: sent.code, name: sent.name }),
        }).then(function (r2) { refresh(); return r2; });
      }).catch(function () { return res; });
    });
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
    ".kg-auth .kg-use{color:#CBA23F;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".kg-auth .kg-use-sel{font:inherit;color:#CBA23F;background:rgba(0,0,0,.35);border:1px solid rgba(203,162,63,.4);",
    "border-radius:999px;padding:2px 6px;max-width:170px}",
    ".kg-auth .kg-plan{opacity:.6;font-size:11px}",
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
  function render(user, info) {
    if (!box) return;
    info = info || {};
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

      // このゲームの影武者。使うのは常に1体で、ランキングに出るのも挑戦に行くのもその1体。
      var mine = (info.kagemusha || []).filter(function (k) { return k.game === GAME; });
      if (mine.length === 1) {
        box.appendChild(el("span", "kg-use", "影武者：" + mine[0].name));
      } else if (mine.length > 1) {
        var sel = document.createElement("select");
        sel.className = "kg-use-sel";
        sel.title = "使う影武者（ランキングに出るのも、挑戦に行くのもこの1体）";
        mine.forEach(function (k) {
          var o = document.createElement("option");
          o.value = k.id;
          o.textContent = k.name + "（" + Math.round(k.rating) + "）";
          if (k.in_use) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () {
          sel.disabled = true;
          fetch(API() + "/api/kagemusha/" + sel.value + "/use", { method: "POST", credentials: "include" })
            .then(refresh).catch(function () { sel.disabled = false; });
        });
        box.appendChild(sel);
      }
      if (info.plan === "free" && mine.length) {
        box.appendChild(el("span", "kg-plan", "無料 " + (info.limit || 1) + "体"));
      }

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
      window.KAGEMUSHA_PLAN = j.plan || "free";
      var inUse = (j.kagemusha || []).filter(function (k) { return k.game === GAME && k.in_use; })[0];
      // ゲーム側が挑戦のときに使うID。サーバーも同じ1体を使うので、ずれることはない。
      if (inUse) window.__myId = inUse.id;
      render(j.user || null, j);
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
