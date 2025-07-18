const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfparse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURAÇÕES CRUCIAIS (COM SUAS CHAVES REAIS) ---
const GEMINI_API_KEY = 'AIzaSyCJns5JfhcVa6wepwcUCaVnkhnD-JFxP4U';
const SUPABASE_URL = 'https://bfxkxmonebnnxyvvhgkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGt4bW9uZWJubnh5dnZoZ2tuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NjEzNTMsImV4cCI6MjA2ODIzNzM1M30.HPApBppy21WMhoN6UGoE1GROCctnAnAOPdUo4a5Tlfo';
// ----------------------------------------------------

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ---------------------------------------------

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Praetor IA - Servidor de Produção com Banco de Dados Ativo.');
});

async function analisarEsalvarPeticao(textoDoDocumento, userId = 'default_user', caseName = 'Nome Padrão') {
  const prompt = `Analise o documento jurídico e retorne um objeto JSON com "pontuacao", "teses", e "precedentes". A pontuação reflete a chance de sucesso. As teses resumem os argumentos. Precedentes devem ser relevantes. Texto: """${textoDoDocumento.substring(0, 8000)}""" Responda APENAS com o objeto JSON.`;

  try {
    // 1. Análise pela IA do Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
    const analiseResult = JSON.parse(jsonMatch[0]);

    // 2. Salvamento no Banco de Dados Supabase
    console.log('Salvando resultado no Supabase...');
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('analyses')
      .insert([
        {
          user_id: userId,
          case_name: caseName,
          status: 'Concluída',
          result_json: analiseResult
        },
      ]);

    if (supabaseError) {
      console.error('Erro ao salvar no Supabase:', supabaseError);
    } else {
      console.log('Análise salva com sucesso no Supabase:', supabaseData);
    }

    return analiseResult;

  } catch (error) {
    console.error("Erro no especialista de Petição:", error);
    return { pontuacao: 0, teses: ["Erro na análise de IA."], precedentes: [] };
  }
}

// (Manter a função analisarContestacao e seu endpoint aqui se desejar)

// --- Endpoint de Análise de Petição ---
app.post('/v1/analise/peticao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    const analise = await analisarEsalvarPeticao(data.text);
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});

app.listen(3000, () => {
  console.log('Servidor Praetor IA (Final com Supabase) está rodando!');
});
