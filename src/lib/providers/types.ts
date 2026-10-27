export type ProviderId = 'gemini' | 'openrouter' | 'groq';
export type Capability = 'text' | 'vision';

export interface CompleteArgs {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  /** base64 JPEG payloads (no data: prefix) */
  images?: string[];
  signal?: AbortSignal;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  complete(args: CompleteArgs): Promise<string>;
}

export interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  textModel: string;
  /** empty string = this provider is not used for vision */
  visionModel: string;
  priority: number;
}

export interface Settings {
  preferred: 'auto' | ProviderId;
  persistKeys: boolean;
  providers: Record<ProviderId, ProviderConfig>;
}
