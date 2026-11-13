import { portalSession } from '../../../lib/portal-session';
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
let cachedModelName = "";

type HistoryItem = { role: "user" | "assistant"; content: string };

const tutorInstructions = `Anda ialah GURU DEKU AI — PLUS ULTRA TUTOR untuk murid sekolah rendah.
Gunakan Bahasa Melayu sebagai bahasa utama. Fahami dan jawab dalam bahasa Inggeris apabila murid menggunakan bahasa Inggeris.
Jawab dengan tepat, mesra, ringkas dan sesuai dengan umur murid. Untuk Matematik, tunjukkan langkah pengiraan dan jawapan akhir. Berikan contoh mudah apabila membantu.
Jika soalan kabur, minta murid menjelaskan. Jika tidak pasti, nyatakan ketidakpastian; jangan mereka fakta, sumber atau mendakwa anda melayari internet.
Untuk halaman Quiz, bantu menerangkan konsep tanpa mendedahkan jawapan soalan semasa kecuali murid menyatakan mereka sudah menjawab dan meminta penerangan.
Gunakan ungkapan seperti “Mari kita selesaikan bersama-sama, Wira!” atau “PLUS ULTRA!” secara sederhana.
Jangan minta atau menyimpan maklumat peribadi sensitif murid.`;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function isRateLimited(request: Request) {
  const key = request.headers.get("oai-authenticated-user-id")
    || request.headers.get("cf-connecting-ip")
    || "anonymous";
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function cleanHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).flatMap((item): HistoryItem[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { role?: unknown; content?: unknown };
    if (!["user", "assistant"].includes(String(candidate.role)) || typeof candidate.content !== "string") return [];
    const content = candidate.content.trim().slice(0, 2_000);
    return content ? [{ role: candidate.role as HistoryItem["role"], content }] : [];
  });
}

async function resolveModel(apiKey: string, configuredModel: string) {
  if (configuredModel && configuredModel !== "auto") {
    return configuredModel.startsWith("models/") ? configuredModel : `models/${configuredModel}`;
  }
  if (cachedModelName) return cachedModelName;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
    headers: { "x-goog-api-key": apiKey },
  });
  let payload: any = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    console.error("Guru Deku model discovery error", response.status, payload?.error?.status || "unknown");
    throw new Error("MODEL_DISCOVERY_FAILED");
  }

  const candidates = (Array.isArray(payload.models) ? payload.models : [])
    .filter((model: any) => typeof model?.name === "string"
      && model.name.includes("gemini")
      && Array.isArray(model.supportedGenerationMethods)
      && model.supportedGenerationMethods.includes("generateContent")
      && !/(image|tts|robotics|omni|embedding)/i.test(model.name));
  const rank = (name: string) => {
    let score = 0;
    if (/flash-lite-latest$/i.test(name)) score += 100;
    else if (/flash-latest$/i.test(name)) score += 90;
    else if (/flash-lite$/i.test(name)) score += 70;
    else if (/flash$/i.test(name)) score += 60;
    if (/preview|experimental|exp/i.test(name)) score -= 30;
    const version = name.match(/gemini-(\d+)\.(\d+)/i);
    if (version) score += Number(version[1]) * 10 + Number(version[2]);
    return score;
  };
  candidates.sort((a: any, b: any) => rank(b.name) - rank(a.name));
  cachedModelName = candidates[0]?.name || "";
  if (!cachedModelName) throw new Error("NO_SUPPORTED_MODEL");
  return cachedModelName;
}

export async function POST(request: Request) {
  try { const session = await portalSession(request.headers.get('cookie')); if (session.profile.role !== 'student') return json({error:'Akses murid diperlukan.'},403); }
  catch { return json({error:'Sila log masuk dahulu.'},401); }
  if (isRateLimited(request)) return json({ error: "Terlalu banyak soalan. Tunggu sebentar sebelum cuba lagi." }, 429);

  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL || "auto";
  if (!apiKey) return json({ error: "Sambungan Gemini belum dikonfigurasikan oleh pentadbir." }, 503);

  let body: { message?: unknown; history?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Format permintaan tidak sah." }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "Taip satu soalan dahulu, Wira." }, 400);
  if (message.length > 800) return json({ error: "Soalan terlalu panjang. Had maksimum ialah 800 aksara." }, 400);

  const context = typeof body.context === "string" ? body.context.trim().slice(0, 500) : "Tidak tersedia.";
  const history = cleanHistory(body.history);
  if (!history.length || history.at(-1)?.role !== "user" || history.at(-1)?.content !== message) {
    history.push({ role: "user", content: message });
  }

  let upstream: Response;
  try {
    const modelName = await resolveModel(apiKey, configuredModel);
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${tutorInstructions}\n\nKonteks halaman semasa: ${context}` }],
        },
        contents: history.map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
        generationConfig: { maxOutputTokens: 300, temperature: 0.35 },
      }),
    });
  } catch {
    return json({ error: "Tidak dapat menghubungi Gemini. Sila cuba lagi." }, 502);
  }

  let payload: any = {};
  try { payload = await upstream.json(); } catch { /* handled below */ }
  if (!upstream.ok) {
    console.error("Guru Deku Gemini error", upstream.status, payload?.error?.status || "unknown");
    return json({ error: upstream.status === 429
      ? "Had penggunaan Gemini telah dicapai. Sila cuba lagi kemudian."
      : "Gemini tidak dapat menjawab sekarang. Sila cuba lagi." }, 502);
  }

  const answer = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: unknown }) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
  if (!answer) return json({ error: "Jawapan Guru Deku tidak dapat dibaca. Sila cuba lagi." }, 502);
  return json({ answer });
}
