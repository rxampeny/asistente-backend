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

// 🧠 Memoria: thread_id por sesión (simple en memoria)
const threads = {};

app.post('/chat', async (req, res) => {
  const { message, session_id } = req.body;
  if (!message || !session_id) {
    return res.status(400).json({ error: "Faltan 'message' o 'session_id'." });
  }

  try {
    let thread_id = threads[session_id];

    // Si no hay thread todavía, lo creamos
    if (!thread_id) {
      const thread = await axios.post('https://api.openai.com/v1/threads', {}, {
        headers: openaiHeaders
      });
      thread_id = thread.data.id;
      threads[session_id] = thread_id;
    }

    // Añadir el mensaje al thread
    await axios.post(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      role: "user",
      content: message
    }, { headers: openaiHeaders });

    // Lanzar el asistente
    const run = await axios.post(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
      assistant_id: ASSISTANT_ID
    }, { headers: openaiHeaders });

    // Esperar a que se complete
    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await axios.get(`https://api.openai.com/v1/threads/${thread_id}/runs/${run.data.id}`, {
        headers: openaiHeaders
      });
    } while (runStatus.data.status !== 'completed');

    // Obtener la respuesta del asistente
    const messages = await axios.get(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      headers: openaiHeaders
    });

    const assistantMessage = messages.data.data.find(msg => msg.role === 'assistant');
    const assistantResponse = assistantMessage?.content?.[0]?.text?.value || "No hubo respuesta del asistente.";

    console.log("🟢 Respuesta:", assistantResponse);
    res.json({ response: assistantResponse });
  } catch (error) {
    console.error("🔴 Error:");
    if (error.response) {
      console.error("🔸 Status:", error.response.status);
      console.error("🔸 Data:", error.response.data);
      res.status(500).json({
        error: error.response.data
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Ruta para limpiar la memoria (thread_id) de una sesión
app.post('/clear', (req, res) => {
  const { session_id } = req.body;
  if (session_id && threads[session_id]) {
    delete threads[session_id];
    console.log(`🧠 Memoria borrada para sesión: ${session_id}`);
  }
  res.json({ status: "ok" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
