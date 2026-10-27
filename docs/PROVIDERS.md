# Providers: capabilities and limitations

Model names, free tiers, quotas and CORS rules change. **Nothing here is a promise.** DarsAI ships with *empty* model
fields on purpose: copy a model name from the provider dashboard, then press **Test connection**.

| Provider | Adapter | Text | Vision | Notes |
|---|---|---|---|---|
| Google Gemini | `generateContent` REST, `x-goog-api-key` header | yes (if the model supports it) | yes (inline JPEG) if the model is multimodal | 429 can mean per-minute rate limit or daily quota; we treat messages containing "PerDay/daily/billing" as quota. |
| OpenRouter | OpenAI-compatible `/chat/completions` | yes | only for models that accept images | Availability/pricing per model. |
| Groq | OpenAI-compatible `/chat/completions` | yes | only if you enter a vision-capable model | Strict rate limits on some models. |
| Hugging Face | **not implemented** | – | – | Inference endpoints vary per model and often lack browser CORS; needs a backend/proxy. |

Capability routing: a provider is eligible for **vision** only if its *vision model* field is non-empty. Image requests are
never sent to a provider without a configured vision model.

Error handling: `auth`, `quota`, `unsupported` → no retry, move to the next provider. `rate_limit`, `network`, `timeout`,
`server` → exponential backoff (800 ms, 1.6 s) then fallback. Browsers report CORS blocks and offline errors identically
(`network`), so a CORS-blocked provider shows up as a network error.

Privacy: images/text are sent **only** after a confirmation dialog, directly from your browser to the provider.
API keys stay in memory unless you tick "remember keys". They are not secret from anyone with access to the browser profile.
