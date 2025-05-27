import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = 'asst_dM00wxbljKGbhpc6kfj7X1E6';

const openaiHeaders = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'OpenAI-Beta': 'assistants=v2'
};

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  try {
    const thread = await axios.post('https://api.openai.com/v1/threads', {}, {
      headers: openaiHeaders
    });

    await axios.post(`https://api.openai.com/v1/threads/${thread.data.id}/messages`, {
      role: "user",
      content: userMessage
    }, {
      headers: openaiHeaders
    });

    const run = await axios.post(`https://api.openai.com/v1/threads/${thread.data.id}/runs`, {
      assistant_id: ASSISTANT_ID
    }, {
      headers: openaiHeaders
    });

    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await axios.get(`https://api.openai.com/v1/threads/${thread.data.id}/runs/${run.data.id}`, {
        headers: openaiHeaders
      });
    } while (runStatus.data.status !== 'completed');

    const messages = await axios.get(`https://api.openai.com/v1/threads/${thread.data.id}/messages`, {
      headers: openaiHeaders
    });

    const assistantMessage = messages.data.data.find(msg => msg.role === 'assistant');
    const assistantResponse = assistantMessage?.content?.[0]?.text?.value || "No hubo respuesta del asistente.";

    console.log("🟢 Respuesta del asistente:", assistantResponse);
    res.json({ response: assistantResponse });
  } catch (error) {
    console.error("🔴 Error al contactar OpenAI:");
    if (error.response) {
      console.error("🔸 Status:", error.response.status);
      console.error("🔸 Data:", error.response.data);
      res.status(500).json({
        error: "Fallo con OpenAI",
        status: error.response.status,
        details: error.response.data,
      });
    } else {
      console.error("🔸 Error sin respuesta:", error.message);
      res.status(500).json({
        error: "Fallo inesperado",
        message: error.message
      });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});