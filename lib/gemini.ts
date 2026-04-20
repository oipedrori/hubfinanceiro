import { GoogleGenerativeAI } from '@google/generative-ai';

// Instância do Gemini com a sua chave que acabamos de colocar no Cofre!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function parseFinancialText(text: string) {
  // Vamos usar o modelo pro, pois queremos o máximo de capacidade de raciocínio.
  // generationConfig garante que o robô não converse, apenas devolva a estrutura exata de JSON que nosso código pede.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", 
    generationConfig: { responseMimeType: "application/json" } 
  });

  // Garante a data atual no formato YYYY-MM-DD no fuso brasileiro
  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // O Prompt Perfeito! (Baseado nas especificações que você me deu das tabelas)
  const prompt = `Você é um assistente financeiro ultra preciso atuando no backend do Hub Financeiro.
O usuário enviará um texto ou transcrição de áudio grosseira de uma transação financeira.
ATENÇÃO: A data de referência de 'HOJE' é ${dateBRT}. Use essa exata data quando o usuário disser 'hoje' ou não citar nenhuma referência de dia.

Sua primeira missão: Identifique se ela é "despesa" ou "receita".

Se você classificar como DESPESA devolva as propriedades:
- "intent": "despesa"
- "descricao": título resumido da compra (string)
- "valor": o valor financeiro limpo de moedas (numero)
- "data": a data citada no texto (YYYY-MM-DD). Se não falado, use a data de hoje.
- "tipo_despesa": escolha ESTRITAMENTE: "Móvel", "Recorrente", ou "Parcelada"
- "metodo_pagamento": escolha ESTRITAMENTE: "Crédito", "Pix", "Dinheiro", "Transferência", ou "Débito"
- "categoria": escolha ESTRITAMENTE: "Alimentação", "Comunicação", "Doação", "Educação", "Equipamentos", "Impostos", "Investimento", "Lazer", "Moradia", "Pet", "Saúde", "Seguro", "Transporte", "Vestuário", "Doações", "Indeterminado", "Higiene Pessoal", ou "Outros"
- "num_parcelas": numero inteiro (se for à vista ou não mencionado parcelas, mande 1).

Se você classificar como RECEITA devolva as propriedades:
- "intent": "receita"
- "descricao": título resumido (string)
- "valor": valor financeiro (numero)
- "data": a data em YYYY-MM-DD. Se não falado, use hoje.
- "tipo_receita": escolha ESTRITAMENTE: "Salário", "Empréstimo", "Reembolso", ou "Freela"

Use as strings com a exata capitalização exigida. Não retorne NADA ALÉM do objeto JSON.

TEXTO DO USUÁRIO A SER PROCESSADO:
"${text}"
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    // O texto retornado já será um objeto JSON pronto para o Notion graças ao mimeType
    const jsonString = response.text();
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("Erro Ocorreu no Gemini:", err);
    throw new Error('Deu ruim no contato com a IA do Gemini.');
  }
}
