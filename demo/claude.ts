/* Acesso aos recursos da página publicada no claude.ai (window.claude). */

type Usar = (nome: string) => Promise<unknown>;

export function usar<T>(nome: string): Promise<T | null> {
  const c = (globalThis as unknown as { claude?: { use?: Usar } }).claude;
  if (!c?.use) return Promise.resolve(null);
  return c.use(nome).then((x) => (x ?? null) as T | null).catch(() => null);
}

export interface Sample {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number } }>;
}

export interface Ditado {
  start(opts?: { language?: string }): Promise<void>;
  stop(): Promise<void>;
  onPartial(fn: (e: { text: string }) => void): () => void;
  onFinal(fn: (e: { text: string }) => void): () => void;
  onState(fn: (e: { state: string; reason?: string }) => void): () => void;
}

export interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}
export interface Db {
  doc(path: string): DocRef;
}
export interface Usuario {
  id(): Promise<string | null>;
}

export const sampleP = usar<Sample>("sample");
export const ditadoP = usar<Ditado>("dictation");
