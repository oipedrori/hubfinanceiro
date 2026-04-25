import { NextResponse } from 'next/server';
import { createNewCustomer } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const redirectUri = `${new URL(request.url).origin}/api/auth/callback/notion`;

  try {
    // 1. Trocar o CODE pelo Access Token real
    const auth64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth64}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Erro na troca de token Notion:', errText);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const data = await res.json();
    const { access_token, workspace_id, owner, duplicated_template_id } = data;

    // 2. Registrar no nosso Banco de Dados de Admin
    const userName = owner?.user?.name || 'Novo Usuário Zimbroo';
    const userEmail = owner?.user?.person?.email || null;
    
    // O workspace_id do Notion as vezes vem sem hífens, mas nosso sistema gosta deles.
    // Vamos salvar o ID puro, o notionAdmin.ts já sabe tratar no get.
    const { secretKey } = await createNewCustomer({
      name: userName,
      email: userEmail,
      notionAccessToken: access_token,
      workspaceId: workspace_id
    });

    // 3. Sucesso! Redirecionar para a home com a chave e template_id
    return NextResponse.redirect(new URL(`/?success=true&key=${secretKey}&name=${encodeURIComponent(userName)}&template_id=${duplicated_template_id || ''}`, request.url));

  } catch (err) {
    console.error('Erro no fluxo OAuth:', err);
    return NextResponse.redirect(new URL('/?error=internal_error', request.url));
  }
}
