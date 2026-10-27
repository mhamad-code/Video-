import { ProviderError, fetchWithTimeout } from './errors';
import type { CompleteArgs, ProviderAdapter, ProviderId } from './types';

const TIMEOUT_MS = 45_000;

function openAICompatible(id: ProviderId, name: string, url: string, extra: Record<string, string> = {}): ProviderAdapter {
  return {
    id,
    name,
    async complete(a: CompleteArgs) {
      const userContent = a.images?.length
        ? [
            { type: 'text', text: a.prompt },
            ...a.images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })),
          ]
        : a.prompt;
      const messages = [...(a.system ? [{ role: 'system', content: a.system }] : []), { role: 'user', content: userContent }];
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.apiKey}`, ...extra },
          body: JSON.stringify({ model: a.model, messages, temperature: 0.2 }),
        },
        TIMEOUT_MS,
        a.signal,
      );
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new ProviderError('unknown', 'Empty response');
      return text;
    },
  };
}

export const openrouter = openAICompatible('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', {
  'X-Title': 'DarsAI',
});
export const groq = openAICompatible('groq', 'Groq', 'https://api.groq.com/openai/v1/chat/completions');

export const gemini: ProviderAdapter = {
  id: 'gemini',
  name: 'Google Gemini',
  async complete(a) {
    const parts: unknown[] = [{ text: a.prompt }, ...(a.images ?? []).map((d) => ({ inline_data: { mime_type: 'image/jpeg', data: d } }))];
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': a.apiKey },
        body: JSON.stringify({
          ...(a.system ? { systemInstruction: { parts: [{ text: a.system }] } } : {}),
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2 },
        }),
      },
      TIMEOUT_MS,
      a.signal,
    );
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    if (!text.trim()) throw new ProviderError('unknown', 'Empty response (possibly blocked by safety filters)');
    return text;
  },
};

export const ADAPTERS: ProviderAdapter[] = [gemini, openrouter, groq];
