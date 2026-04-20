// Supabase Edge Function: firma-proxy
// Incolla questo codice in Supabase > Edge Functions > New Function > "firma-proxy"

const OA_KEY = 'gyrhaliixidv9eq3au8zcjicgxwn8oq9';
const OA_URL = 'https://test.esign.openapi.com'; // sandbox

Deno.serve(async (req) => {
  // CORS headers per GitHub Pages
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pdfBase64, nome, cognome, email, telefono, numero } = body;

    if (!pdfBase64 || !email || !telefono) {
      return new Response(
        JSON.stringify({ error: 'Parametri mancanti: pdfBase64, email, telefono' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizza telefono
    let phone = telefono.replace(/\s/g, '');
    if (!phone.startsWith('+')) phone = '+39' + phone.replace(/^0/, '');

    const payload = {
      document: {
        sourceType: 'base64',
        source: pdfBase64,
        fileName: `Contratto_B4C_${numero || '001'}.pdf`
      },
      signers: [{
        name: nome || 'Cliente',
        surname: cognome || 'B4C',
        email: email,
        mobile: phone,
        authentication: ['otp_sms'],
        message: `Gentile ${nome || 'Cliente'}, Le inviamo il contratto B4C S.r.l. da firmare con codice OTP via SMS.`,
        signatures: [{
          page: 1,
          x: 40,
          y: 680,
          width: 150,
          height: 50
        }]
      }],
      options: {
        notificationEmail: true,
        signatureType: 'pades',
        completionRedirectUrl: 'https://veteex-cloud.github.io/vepa',
        branding: {
          companyName: 'B4C S.r.l.',
          primaryColor: '#E85D14'
        }
      }
    };

    const resp = await fetch(`${OA_URL}/EU-SES`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OA_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, data }),
      {
        status: resp.ok ? 200 : resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
