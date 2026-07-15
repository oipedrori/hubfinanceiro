import { NextResponse } from 'next/server';
import { deleteCustomerBySecretKey } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secretKey = body.secretKey;

    if (!secretKey) {
      return NextResponse.json({ success: false, message: 'Chave de segurança não informada.' }, { status: 400 });
    }

    const result = await deleteCustomerBySecretKey(secretKey);
    
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Conta excluída com sucesso.' });
    } else {
      return NextResponse.json({ success: false, message: result.reason || 'Erro ao excluir conta.' }, { status: 404 });
    }
  } catch (err: any) {
    console.error('Erro ao excluir conta:', err);
    return NextResponse.json({ success: false, message: 'Erro interno ao processar a exclusão.' }, { status: 500 });
  }
}
