/**
 * RTDB Metrics (Client-side instrumentation)
 *
 * @role Firebase RTDB 읽기/리스너 이벤트를 경로별로 계측합니다.
 * @note 네트워크 바이트는 SDK에서 직접 제공되지 않으므로 snapshot.val() 직렬화 크기로 추정합니다.
 *       계측은 기본적으로 DEV에서만 활성화되며, OFF일 때 오버헤드는 최소화됩니다.
 */

export type RtdbOp = 'get' | 'set' | 'onValue' | 'attach' | 'detach' | 'error';

export interface RtdbPathMetrics {
  path: string;
  attaches: number;
  detaches: number;
  events: number;
  readsEstimatedBytes: number;
  writesEstimatedBytes: number;
  errors: number;
  lastEventAt?: number;
}

const metricsByPath: Map<string, RtdbPathMetrics> = new Map();

function isDevEnv(): boolean {
  try {
    // Vite 환경
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export function isRtdbInstrumentationEnabled(): boolean {
  // 기본은 DEV에서만 (비용/성능 위험 최소화)
  return isDevEnv();
}

export function estimateJsonBytes(value: unknown): number {
  if (value === null || value === undefined) return 0;
  try {
    const json = JSON.stringify(value);
    if (!json) return 0;

    // 브라우저/일렉트론: TextEncoder로 바이트 추정
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    if (encoder) {
      return encoder.encode(json).byteLength;
    }

    // fallback: UTF-16 length 기반 근사
    return json.length * 2;
  } catch {
    return 0;
  }
}

function ensure(path: string): RtdbPathMetrics {
  const existing = metricsByPath.get(path);
  if (existing) return existing;

  const created: RtdbPathMetrics = {
    path,
    attaches: 0,
    detaches: 0,
    events: 0,
    readsEstimatedBytes: 0,
    writesEstimatedBytes: 0,
    errors: 0,
  };
  metricsByPath.set(path, created);
  return created;
}

export function recordRtdbAttach(path: string): void {
  const m = ensure(path);
  m.attaches += 1;
  m.lastEventAt = Date.now();
}

export function recordRtdbDetach(path: string): void {
  const m = ensure(path);
  m.detaches += 1;
  m.lastEventAt = Date.now();
}

export function recordRtdbOnValue(path: string, snapshotValue: unknown): number {
  const m = ensure(path);
  m.events += 1;
  m.lastEventAt = Date.now();

  if (!isRtdbInstrumentationEnabled()) return 0;
  const bytes = estimateJsonBytes(snapshotValue);
  m.readsEstimatedBytes += bytes;
  return bytes;
}

export function recordRtdbGet(path: string, snapshotValue: unknown): number {
  const m = ensure(path);
  m.lastEventAt = Date.now();

  if (!isRtdbInstrumentationEnabled()) return 0;
  const bytes = estimateJsonBytes(snapshotValue);
  m.readsEstimatedBytes += bytes;
  return bytes;
}

export function recordRtdbSet(path: string, payload: unknown): number {
  const m = ensure(path);
  m.lastEventAt = Date.now();

  if (!isRtdbInstrumentationEnabled()) return 0;
  const bytes = estimateJsonBytes(payload);
  m.writesEstimatedBytes += bytes;
  return bytes;
}

export function recordRtdbError(path: string): void {
  const m = ensure(path);
  m.errors += 1;
  m.lastEventAt = Date.now();
}

export function getRtdbMetricsSnapshot(): Record<string, RtdbPathMetrics> {
  const out: Record<string, RtdbPathMetrics> = {};
  for (const [path, m] of metricsByPath.entries()) {
    out[path] = { ...m };
  }
  return out;
}

export function resetRtdbMetrics(): void {
  metricsByPath.clear();
}
