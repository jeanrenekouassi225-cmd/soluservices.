// Couche de compatibilité : fait fonctionner le site avec Supabase.
(() => {
  if (!window.CONFIG) { alert("config.js introuvable : vérifiez qu'il est bien à la racine du dépôt GitHub."); return; }
  const C = window.CONFIG, FALLBACK = "https://omjzkidtkfdkcffweiet.supabase.co";
  const base = FALLBACK; // adresse du projet, volontairement fixe
  const key = String(C.SUPABASE_ANON_KEY || "").replace(/\s+/g, "");
  if (key.length < 40 || /COLLEZ|VOTRE/.test(key)) { alert("Clé anon absente ou incorrecte dans config.js : collez la clé publique de Supabase (Paramètres du projet > Clés API)."); }
  const sb = supabase.createClient(base, key);
  let user = null;
  const ready = (async () => {
    let { data: { session } } = await sb.auth.getSession();
    if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) alert("Connexion visiteur impossible : " + r.error.message + "\nActivez « Autoriser les connexions anonymes » dans Supabase > Authentification."); session = r.data.session; }
    user = session && session.user;
  })();
  const listeners = new Set(), bump = () => listeners.forEach(f => f());
  const cut = p => { const i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  const snap = r => ({ exists: !!r, data: () => (r ? r.data : undefined), id: r ? r.path.split("/").pop() : undefined });
  function doc(path) {
    const col = cut(path)[0];
    const get = async () => { await ready; const { data } = await sb.from("docs").select("path,data").eq("path", path).maybeSingle(); return snap(data); };
    const put = async d => { await ready; const { error } = await sb.from("docs").upsert({ path, col, data: d, updated_at: new Date().toISOString() }); if (error) { alert("Erreur d'enregistrement : " + error.message + "\n(chemin : " + path + ")"); throw error; } bump(); };
    return {
      get, set: put,
      async update(d) { const s = await get(); return put({ ...(s.exists ? s.data() : {}), ...d }); },
      async delete() { await ready; const { error } = await sb.from("docs").delete().eq("path", path); if (error) throw error; bump(); },
      onSnapshot(cb) { const run = async () => { try { cb(await get()); } catch (e) {} }; run(); listeners.add(run); setInterval(run, 8000); }
    };
  }
  function collection(col) {
    return {
      onSnapshot(cb, err) {
        const run = async () => {
          try {
            await ready;
            const { data, error } = await sb.from("docs").select("path,data").eq("col", col);
            if (error) throw error;
            cb({ docs: (data || []).map(r => ({ id: r.path.split("/").pop(), data: () => r.data })) });
          } catch (e) { err && err(e); }
        };
        run(); listeners.add(run); setInterval(run, 8000);
      }
    };
  }
  const DB = { doc, collection };
  const USER = { id: async () => { await ready; return user.id; }, isOwner: () => !!user && !user.is_anonymous && String(user.email||"").trim().toLowerCase() === String(C.ADMIN_EMAIL||"").trim().toLowerCase() };
  window.claude = { use: async n => { if (n === "db") return DB; if (n === "user") { await ready; return USER; } return null; } };
  window.adminLogin = async () => {
    const email = prompt("E-mail administrateur"); const pw = email && prompt("Mot de passe"); if (!pw) return;
    try {
      const h = await fetch(base + "/auth/v1/health", { headers: { apikey: key } });
      const tx = await h.text();
      alert("Test de la base (" + base + ") : statut " + h.status + "\n" + tx.slice(0, 200) + "\nClé : " + key.slice(0, 12) + "… (" + key.length + " caractères)");
    } catch (e) { alert("Impossible de joindre " + base + " : " + e.message); }
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { alert("Connexion refusée : " + error.message); return; }
    const ok = String(email).trim().toLowerCase() === String(C.ADMIN_EMAIL || "").trim().toLowerCase();
    alert("Connecté avec " + email + ". Administrateur reconnu : " + (ok ? "OUI" : "NON — ADMIN_EMAIL dans config.js vaut : " + C.ADMIN_EMAIL));
    location.reload();
  };
})();
