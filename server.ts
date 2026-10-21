import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface SuggestionRequestItem {
  id: string;
  description: string;
  amount: number;
  supplier: string;
  ddtNumber?: string;
  ddtDate?: string;
}

interface CantiereCandidate {
  id: string;
  name: string;
  client: string;
  city: string;
  year: number;
  notes?: string;
}

// Smart heuristic matcher used when API key is missing or model temporarily busy
function buildSmartHeuristicSuggestions(
  items: SuggestionRequestItem[],
  cantieri: CantiereCandidate[]
) {
  return items.map((item) => {
    const descLower = (item.description || '').toLowerCase();
    let matched = cantieri[0];
    let confidence = 70;
    let reasoning = `Abbinamento predefinito a "${cantieri[0].name}".`;

    for (const c of cantieri) {
      const cName = (c.name || '').toLowerCase();
      const cCity = (c.city || '').toLowerCase();
      const cClient = (c.client || '').toLowerCase();
      const cNotes = (c.notes || '').toLowerCase();

      if (cCity && (descLower.includes(cCity) || (item.supplier && item.supplier.toLowerCase().includes(cCity)))) {
        matched = c;
        confidence = 88;
        reasoning = `Rilevata corrispondenza con la città/zona (${c.city}).`;
        break;
      }
      if (cClient && descLower.includes(cClient)) {
        matched = c;
        confidence = 94;
        reasoning = `Riferimento diretto al committente "${c.client}".`;
        break;
      }
      if (
        cName.includes('elettric') &&
        (descLower.includes('cavo') ||
          descLower.includes('interruttor') ||
          descLower.includes('quadro') ||
          descLower.includes('bticino') ||
          descLower.includes('vimar') ||
          descLower.includes('domot') ||
          descLower.includes('faretto') ||
          descLower.includes('led'))
      ) {
        matched = c;
        confidence = 94;
        reasoning = `Materiale elettrico/domotico congruente con "${c.name}".`;
        break;
      }
      if (
        cName.includes('idraul') &&
        (descLower.includes('tubo') ||
          descLower.includes('raccord') ||
          descLower.includes('caldaia') ||
          descLower.includes('valvol') ||
          descLower.includes('sanitar') ||
          descLower.includes('geberit') ||
          descLower.includes('grohe') ||
          descLower.includes('scaric') ||
          descLower.includes('baxi'))
      ) {
        matched = c;
        confidence = 95;
        reasoning = `Fornitura termosanitaria congruente con il cantiere idraulico "${c.name}".`;
        break;
      }
      if (
        cName.includes('edil') &&
        (descLower.includes('malta') ||
          descLower.includes('cemento') ||
          descLower.includes('tassell') ||
          descLower.includes('silicon') ||
          descLower.includes('disco') ||
          descLower.includes('cartongess') ||
          descLower.includes('guaina'))
      ) {
        matched = c;
        confidence = 91;
        reasoning = `Materiali di consumo edili affini a "${c.name}".`;
        break;
      }
      if (cNotes && descLower.split(' ').some((w) => w.length > 4 && cNotes.includes(w))) {
        matched = c;
        confidence = 82;
        reasoning = `Parole chiave congruenti con la descrizione del cantiere "${c.name}".`;
        break;
      }
    }

    return {
      itemId: item.id,
      suggestedCantiereId: matched.id,
      confidence,
      reasoning,
    };
  });
}

// API: Suggest cantiere allocation using Gemini 3.8 Flash
app.post('/api/gemini/suggest-cantiere', async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, cantieri } = req.body as {
      items: SuggestionRequestItem[];
      cantieri: CantiereCandidate[];
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Nessun articolo fornito per l'analisi" });
      return;
    }

    if (!cantieri || !Array.isArray(cantieri) || cantieri.length === 0) {
      res.status(400).json({ error: "Nessun cantiere disponibile per l'abbinamento" });
      return;
    }

    // Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      const fallbackSuggestions = buildSmartHeuristicSuggestions(items, cantieri);
      res.json({ suggestions: fallbackSuggestions, source: 'smart-heuristic-local' });
      return;
    }

    try {
      const cantieriContext = cantieri
        .map(
          (c) =>
            `- ID: "${c.id}" | Nome: "${c.name}" | Cliente: "${c.client}" | Città: "${c.city}" | Note: "${c.notes || 'N/A'}"`
        )
        .join('\n');

      const itemsContext = items
        .map(
          (it) =>
            `- ItemID: "${it.id}" | Fornitore: "${it.supplier}" | DDT: "${it.ddtNumber || 'N/A'}" | Descrizione: "${it.description}" | Importo: €${it.amount}`
        )
        .join('\n');

      const prompt = `Sei un assistente esperto in contabilità di cantiere per artigiani (elettricisti, idraulici, edili).
Devi analizzare le righe di acquisto / DDT tratte da una fattura fornitore e associarle al cantiere più probabile tra quelli aperti.

CANTIERI APERTI:
${cantieriContext}

RIGHE DA ASSEGNARE:
${itemsContext}

Per ciascun ItemID, seleziona il cantiere più idoneo ("suggestedCantiereId"), assegna un grado di confidenza da 1 a 100 ("confidence"), e scrivi una breve spiegazione in italiano ("reasoning") del perché il materiale appartiene a quel cantiere.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    suggestedCantiereId: { type: Type.STRING },
                    confidence: { type: Type.INTEGER },
                    reasoning: { type: Type.STRING },
                  },
                  required: ['itemId', 'suggestedCantiereId', 'confidence', 'reasoning'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({ suggestions: parsed.suggestions || [], source: 'gemini-3.8-flash' });
    } catch (aiError: any) {
      console.warn(
        'Gemini API upstream busy or unavailable, falling back to smart heuristic:',
        aiError?.message || aiError
      );
      const fallbackSuggestions = buildSmartHeuristicSuggestions(items, cantieri);
      res.json({ suggestions: fallbackSuggestions, source: 'smart-heuristic-backup' });
    }
  } catch (error: any) {
    console.error('API suggest-cantiere general error:', error);
    res.status(500).json({
      error: "Errore durante l'analisi con Gemini AI",
      details: error?.message || 'Errore sconosciuto',
    });
  }
});

// Setup Vite middlewares in development or serve dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(port, () => {
    console.log(`Server avviato su http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} already in use, waiting 1s before retrying...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {}
        server.listen(port);
      }, 1000);
    } else {
      console.error('Server listen error:', err);
    }
  });

  process.on('SIGTERM', () => {
    try { server.close(); } catch {}
  });
  process.on('SIGINT', () => {
    try { server.close(); } catch {}
  });
}

startServer();
