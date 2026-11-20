// Couche de compatibilité : fait fonctionner le site avec Supabase.
(() => {
  const C = window.CONFIG, sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  let user = null;
  const ready = (async () => {
    let { data: { session } } = await sb.auth.getSession();
    if (!session) { const r = await sb.auth.signInAnonymously(); session = r.data.session; }
    user = session && session.user;
  })();
  const listeners = new Set(), bump = () => listeners.forEach(f => f());
  const cut = p => { const i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  const snap = r => ({ exists: !!r, data: () => (r ? r.data : undefined), id: r ? r.path.split("/").pop() : undefined });
  function doc(path) {
    const col = cut(path)[0];
    const get = async () => { await ready; const { data } = await sb.from("docs").select("path,data").eq("path", path).maybeSingle(); return snap(data); };
    const put = async d => { await ready; const { error } = await sb.from("docs").upsert({ path, col, data: d, updated_at: new Date().toISOString() }); if (error) throw error; bump(); };
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
  window.claude = { use: async n => (n === "db" ? DB : n === "user" ? USER : null) };
  window.adminLogin = async () => {
    const email = prompt("E-mail administrateur"); const pw = email && prompt("Mot de passe"); if (!pw) return;
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { alert("Connexion refusée"); return; } location.reload();
  };
})();
