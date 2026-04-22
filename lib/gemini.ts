import { GoogleGenerativeAI } from '@google/generative-ai';

// Instância do Gemini com a sua chave que acabamos de colocar no Cofre!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function parseFinancialText(text: string) {
  // generationConfig garante que o robô não converse, apenas devolva a estrutura exata de JSON que nosso código pede.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", 
    generationConfig: { responseMimeType: "application/json" } 
  });

  // Garante a data atual no formato YYYY-MM-DD no fuso brasileiro
  const dateBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // Prompt enxuto — faz APENAS a classificação
  const prompt = `Você é um assistente financeiro ultra preciso atuando no backend do Hub Financeiro.
O usuário enviará um texto ou transcrição de áudio grosseira de uma transação financeira ou de uma pergunta/consulta contábil.
ATENÇÃO: A data de referência de 'HOJE' é ${dateBRT}. Use essa exata data quando o usuário disser 'hoje' ou não citar nenhuma referência de dia.

Sua primeira missão: Identifique se ela é "despesa", "receita", ou "consulta".

Se você classificar como DESPESA devolva as propriedades:
- "intent": "despesa"
- "descricao": título resumido da compra (string)
- "valor": o valor financeiro limpo de moedas (numero)
- "data": a data citada no texto (YYYY-MM-DD). Se não falado, use a data de hoje.
- "tipo_despesa": escolha ESTRITAMENTE entre:
    • "Móvel" = compras variáveis do dia a dia (mercado, restaurante, farmácia, loja, combustível, etc.)
    • "Recorrente" = contas fixas mensais com valor igual ou muito parecido todo mês (aluguel, assinatura, plano de celular, internet, academia, etc.)
    • "Parcelada" = compras divididas em parcelas no cartão (o usuário mencionará parcelas explicitamente)
    NA DÚVIDA, USE "Móvel".
- "metodo_pagamento": escolha ESTRITAMENTE: "Crédito", "Pix", "Dinheiro", "Transferência", ou "Débito". SE NÃO MENCIONADO NO TEXTO, USE O PADRÃO: "Crédito".
- "categoria": escolha ESTRITAMENTE: "Alimentação", "Comunicação", "Doação", "Educação", "Equipamentos", "Impostos", "Investimento", "Lazer", "Moradia", "Pet", "Saúde", "Seguro", "Transporte", "Vestuário", "Doações", "Indeterminado", "Higiene Pessoal", ou "Outros"
- "num_parcelas": numero inteiro (se for à vista ou não mencionado parcelas, mande 1).

Se você classificar como RECEITA devolva as propriedades:
- "intent": "receita"
- "descricao": título resumido (string)
- "valor": valor financeiro (numero)
- "data": a data em YYYY-MM-DD. Se não falado, use hoje.
- "tipo_receita": escolha ESTRITAMENTE: "Salário", "Empréstimo", "Reembolso", ou "Freela"

Se você classificar como CONSULTA (ex: perguntas sobre saúde financeira, saldos ou conselhos):
- "intent": "consulta"
- "pergunta": texto transcrito do usuário contendo a pergunta ou pedido (string)

Use as strings com a exata capitalização exigida. Não retorne NADA ALÉM do objeto JSON.

TEXTO DO USUÁRIO A SER PROCESSADO:
"${text}"
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const jsonString = response.text();
    const parsed = JSON.parse(jsonString);
    
    // Captura os tokens consumidos nessa chamada
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    
    return { ...parsed, _tokensUsed: tokensUsed };
  } catch (err) {
    console.error("Erro Ocorreu no Gemini:", err);
    throw new Error('Deu ruim no contato com a IA do Gemini.');
  }
}

export async function generateFinancialAdvice(pergunta: string, balancetesData: string, firstName: string) {
  // Para a resposta livre falada, NÃO limitamos o JSON. O robô está livre para gerar texto normal.
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const dateBRT = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric', day: '2-digit' });
  const currentYear = new Date().getFullYear();

  const prompt = `Conselheiro financeiro amigável e pontual. Data atual: ${dateBRT}. Ano vigente: ${currentYear}. 
Dados Balancete: ${balancetesData}
Pergunta do ${firstName}: "${pergunta}"

Missão:
- COMECE SEMPRE COM: "Oi ${firstName}! 😊"
- Use emojis relevantes ao longo de toda a resposta.
- Analise o fluxo de caixa do Mês Atual (identifique pelo número inicial do mês, ex: 04 para Abril) apenas para o ano de ${currentYear}.
- ATENÇÃO: NÃO inverta os valores. Entradas são dinheiro que GANHOU. Saídas são dinheiro que GASTOU.
- Se o mês atual (${dateBRT}) NÃO possuir dados no balancete enviado, diga claramente que ainda não há registros para este mês e use os dados dos meses anteriores apenas como referência comparativa (identificando-os pelo ano).
- Cite valores reais (R$) e projete o fechamento do mês (azul ou vermelho). 
- Use 2-3 parágrafos curtos. Máximo 6 frases. Linguagem pessoal e educada. 
- Sem asteriscos ou negritos.`;

  try {
    const result = await model.generateContent(prompt);
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
    return { text: result.response.text(), tokensUsed };
  } catch (err) {
    console.error("Erro no conselheiro Gemini:", err);
    throw new Error('O Consultor não conseguiu gerar a recomendação.');
  }
}
