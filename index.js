const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfparse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js'); // Importa o Supabase

// --- CONFIGURAÇÃO DA IA E DO BANCO DE DADOS ---
const GEMINI_API_KEY = 'SUA_CHAVE_DE_API_DO_GOOGLE_CLOUD'; // Substitua pela sua chave do Gemini
const SUPABASE_URL = 'URL_DO_SEU_PROJETO_SUPABASE'; // Substitua pela URL do seu projeto Supabase
const SUPABASE_ANON_KEY = 'CHAVE_ANON_DO_SEU_PROJETO_SUPABASE'; // Substitua pela chave Anon (pública)

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

async function analisarPeticao(textoDoDocumento, userId = 'default_user', caseName = 'Nome Padrão') {
    const prompt = `Analise o documento jurídico e retorne um objeto JSON com "pontuacao", "teses", e "precedentes". A pontuação reflete a chance de sucesso. As teses resumem os argumentos. Precedentes devem ser relevantes. Texto: """${textoDoDocumento.substring(0, 8000)}""" Responda APENAS com o objeto JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
        const analiseResult = JSON.parse(jsonMatch[0]);

        // --- SALVANDO NO SUPABASE ---
        console.log('Salvando resultado no Supabase...');
        const { data, error } = await supabase
            .from('analyses')
            .insert([
                {
                    user_id: userId,
                    case_name: caseName,
                    status: 'Concluída',
                    result_json: analiseResult // Salva o JSON completo do resultado
                },
            ]);

        if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            // Mesmo se falhar ao salvar, retorna a análise para o usuário
        } else {
            console.log('Análise salva com sucesso no Supabase:', data);
        }
        // --------------------------

        return analiseResult;

    } catch (error) {
        console.error("Erro no especialista de Petição:", error);
        return { pontuacao: 0, teses: ["Erro na análise de IA."], precedentes: [] };
    }
}


// Endpoint de Análise (agora salva no DB)
// OBS: Para ser completo, precisaríamos receber o userId e caseName do front-end.
// Por enquanto, usaremos valores padrão.
app.post('/v1/analise/peticao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    // Aqui receberíamos o nome do caso e o id do usuário do front-end
    const analise = await analisarPeticao(data.text, 'id_do_usuario_logado', 'Nome do Caso Enviado');
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});


app.listen(3000, () => {
  console.log('Servidor Praetor IA (com Conexão Supabase) está rodando!');
});
