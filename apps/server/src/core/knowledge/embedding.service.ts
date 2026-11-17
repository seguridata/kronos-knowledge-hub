import { Injectable, Logger } from '@nestjs/common';
import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { EnvironmentService } from '../../integrations/environment/environment.service';

export const DEFAULT_EMBEDDING_DIMENSION = 1536;

/**
 * Embeddings determinísticos y SIN semántica (hash de palabras) solo para
 * pruebas del pipeline. Nunca se habilita en producción.
 */
export function testEmbedding(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]{3,}/g);
  for (const token of tokens ?? []) {
    const stem = token.slice(0, 5);
    let h = 0x811c9dc5;
    for (let i = 0; i < stem.length; i++) {
      h ^= stem.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    vec[h % dim] += h & 0x100 ? 1 : -1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private cachedModel: any;

  constructor(private readonly env: EnvironmentService) {}

  get driver(): string | undefined {
    return this.env.getAiDriver()?.toLowerCase();
  }

  get dimension(): number {
    const d = this.env.getAiEmbeddingDimension();
    return Number.isFinite(d) && d > 0 ? d : DEFAULT_EMBEDDING_DIMENSION;
  }

  /** Identificador guardado junto a cada vector: cambia de modelo => reindexa. */
  get modelName(): string {
    return `${this.driver}:${this.env.getAiEmbeddingModel() ?? 'default'}:${this.dimension}`;
  }

  isEnabled(): boolean {
    const driver = this.driver;
    if (!driver) return false;
    if (driver === 'test') return process.env.NODE_ENV !== 'production';
    if (!this.env.getAiEmbeddingModel()) return false;
    switch (driver) {
      case 'openai':
        return !!this.env.getOpenAiApiKey();
      case 'openai-compatible':
        return !!this.env.getOpenAiApiUrl();
      case 'gemini':
        return !!this.env.getGeminiApiKey();
      case 'ollama':
        return true;
      default:
        return false;
    }
  }

  private getModel() {
    if (this.cachedModel) return this.cachedModel;
    const modelId = this.env.getAiEmbeddingModel();
    switch (this.driver) {
      case 'openai':
        this.cachedModel = createOpenAI({
          apiKey: this.env.getOpenAiApiKey(),
          baseURL: this.env.getOpenAiApiUrl() || undefined,
        }).embedding(modelId);
        break;
      case 'openai-compatible':
        this.cachedModel = createOpenAICompatible({
          name: 'custom',
          apiKey: this.env.getOpenAiApiKey(),
          baseURL: this.env.getOpenAiApiUrl(),
        }).embeddingModel(modelId);
        break;
      case 'gemini':
        this.cachedModel = createGoogleGenerativeAI({
          apiKey: this.env.getGeminiApiKey(),
        }).embedding(modelId as any);
        break;
      case 'ollama':
        this.cachedModel = createOpenAICompatible({
          name: 'ollama',
          baseURL: `${this.env.getOllamaApiUrl().replace(/\/$/, '')}/v1`,
        }).embeddingModel(modelId);
        break;
      default:
        throw new Error(`AI_DRIVER no soportado para embeddings: ${this.driver}`);
    }
    return this.cachedModel;
  }

  private providerOptions() {
    const dimensions = this.dimension;
    const mrl = this.env.getAiEmbeddingSupportsMrl();
    return {
      google: { outputDimensionality: dimensions },
      ...(mrl
        ? { openai: { dimensions }, openaiCompatible: { dimensions } }
        : {}),
    };
  }

  private assertDimension(vectors: number[][]) {
    for (const v of vectors) {
      if (v.length !== this.dimension) {
        throw new Error(
          `El modelo devolvió ${v.length} dimensiones pero AI_EMBEDDING_DIMENSION=${this.dimension}. ` +
            'Ajusta AI_EMBEDDING_DIMENSION (y AI_EMBEDDING_SUPPORTS_MRL si el modelo admite truncado).',
        );
      }
    }
  }

  async embedTexts(values: string[]): Promise<number[][]> {
    if (values.length === 0) return [];
    if (this.driver === 'test') {
      return values.map((v) => testEmbedding(v, this.dimension));
    }
    const { embeddings } = await embedMany({
      model: this.getModel(),
      values,
      providerOptions: this.providerOptions() as any,
      maxRetries: 2,
    });
    this.assertDimension(embeddings);
    return embeddings;
  }

  async embedQuery(query: string): Promise<number[]> {
    if (this.driver === 'test') return testEmbedding(query, this.dimension);
    const { embedding } = await embed({
      model: this.getModel(),
      value: query,
      providerOptions: this.providerOptions() as any,
      maxRetries: 2,
    });
    this.assertDimension([embedding]);
    return embedding;
  }
}
