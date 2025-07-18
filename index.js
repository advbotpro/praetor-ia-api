const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfparse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURAÇÃO DA IA ---
const API_KEY = 'AIzaSyCJns5JfhcVa6wepwcUCaVnkhnD-JFxP4U'; // Sua chave de API real
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
// -------------------------

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Praetor IA v5.1 - Produção Final (Ajustada).');
});

// ===================================================================
// ESPECIALISTA 1: ANÁLISE DE PETIÇÃO (PROMPT À PROVA DE FALHAS)
// ===================================================================
async function analisarPeticao(textoDoDocumento) {
  const prompt = `
    Sua tarefa é analisar um documento jurídico e retornar um objeto JSON. Siga estes 5 passos OBRIGATORIAMENTE e em ordem:
    1.  LEITURA E VEREDITO: Leia o documento e determine o resultado para o autor (sucesso, fracasso, parcial).
    2.  EXTRAÇÃO DE TESES: Identifique as 3 teses jurídicas principais que levaram ao veredito.
    3.  EXTRAÇÃO DE DADOS: Encontre os seguintes dados específicos no texto: "valorDaCausa", "valorDaCondenacao", "dataAudiencia", e qualquer "prazoProcessual" (em dias, horas, etc.).
    4.  EXTRAÇÃO DE PRECEDENTES: Encontre 1 ou 2 resumos de jurisprudência ou Súmulas citadas no texto que foram usadas para fundamentar a decisão.
    5.  MONTAGEM DO JSON: APENAS APÓS executar os 4 passos anteriores, monte um objeto JSON com os dados que você encontrou. A chave "pontuacao" DEVE ser consistente com o veredito. Se algum dado específico (como "valorDaCausa" ou "dataAudiencia") não for encontrado, o valor do campo correspondente deve ser a string "Não especificado". O campo "precedentes" NUNCA deve ser 'undefined'; se nada for encontrado, retorne um array vazio [].

    Texto para análise: """${textoDoDocumento.substring(0, 8000)}"""
    Responda APENAS com o objeto JSON final.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro no especialista de Petição:", error);
    return { pontuacao: 0, teses: ["Erro na análise de IA."], precedentes: [] };
  }
}

// ===================================================================
// ESPECIALISTA 2: ANÁLISE DE CONTESTAÇÃO (ESTÁVEL)
// ===================================================================
async function analisarContestacao(textoDoDocumento) {
  const prompt = `Analise a peça de contestação a seguir. Identifique os 2 principais argumentos de defesa e 1 possível ponto fraco. Retorne sua análise como um objeto JSON com as chaves "tipoDePeca", "tesesDaDefesa", e "pontosFracosDaDefesa". Texto para análise: """${textoDoDocumento.substring(0, 8000)}""" Responda APENAS com o objeto JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro no especialista de Contestação:", error);
    return { tipoDePeca: "Erro", tesesDaDefesa: ["Erro na análise de IA."] };
  }
}

// --- Endpoints ---
app.post('/v1/analise/peticao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    const analise = await analisarPeticao(data.text);
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});

app.post('/v1/analise/contestacao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    const analise = await analisarContestacao(data.text);
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});

app.listen(3000, () => {
  console.log('Servidor Praetor IA v5.1 (Produção Final) está rodando!');
});
