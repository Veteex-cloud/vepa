// SignNow firma proxy per B4C S.r.l.
const SN_BASIC = 'YTBiZjhhOTQ0ZjhiMmI1NzBlODBkZGY5Yjk0MWM4ZWJjMjJkNmVjZjg1OTU2OGRkZDlkZTIxOTVjNGI5NzNhMzphMGJmOGE5NDRmOGIyYjU3MGU4MGRkZjliOTQxYzhlYmMyMmQ2ZWNmODU5NTY4ZGRkOWRlMjE5NWM0Yjk3M2Ez';
const SN_EMAIL = 'giovannimaria.crabuzza@b4csrl.it';
const SN_PASS  = 'Bisera365***';
const SN_BASE  = 'https://api-eval.signnow.com'; // sandbox

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getToken(): Promise<string> {
  const r = await fetch(`${SN_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${SN_BASIC}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: SN_EMAIL,
      password: SN_PASS,
      scope: '*'
    }).toString()
  });
  if (!r.ok) throw new Error('Auth SignNow fallita: ' + await r.text());
  const d = await r.json();
  return d.access_token;
}

async function uploadDocument(token: string, pdfBase64: string, filename: string): Promise<string> {
  // Converte base64 in Uint8Array
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
  
  const r = await fetch(`${SN_BASE}/document`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  if (!r.ok) throw new Error('Upload documento fallito: ' + await r.text());
  const d = await r.json();
  return d.id;
}

async function sendInvite(token: string, docId: string, nome: string, cognome: string, email: string): Promise<string> {
  const payload = {
    to: [{
      email: email,
      role: 'Signer 1',
      order: 1,
      authentication_type: 'email',
      expiration_days: 30,
      reminder: 3,
      subject: `Contratto B4C S.r.l. - Firma richiesta`,
      message: `Gentile ${nome} ${cognome}, Le inviamo il contratto B4C S.r.l. da firmare. Clicchi sul link per visualizzare e firmare il documento.`
    }],
    from: SN_EMAIL,
    subject: `Contratto B4C S.r.l. - Firma richiesta`,
    message: `Gentile ${nome} ${cognome}, La preghiamo di firmare il contratto allegato.`
  };

  const r = await fetch(`${SN_BASE}/document/${docId}/invite`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Invio firma fallito: ' + await r.text());
  return docId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { pdfBase64, nome, cognome, email, telefono, numero } = body;

    if (!email || !pdfBase64) {
      return new Response(JSON.stringify({ error: 'email e pdfBase64 obbligatori' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // 1. Ottieni token SignNow
    const token = await getToken();

    // 2. Carica il PDF
    const filename = `Contratto_B4C_${numero || '001'}.pdf`;
    const docId = await uploadDocument(token, pdfBase64, filename);

    // 3. Invia invito firma via email
    await sendInvite(token, docId, nome || 'Cliente', cognome || '', email);

    return new Response(JSON.stringify({ ok: true, docId, message: 'Invito firma inviato via email' }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
