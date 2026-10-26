/**
 * Serialised, pre-compressed JSON bodies for the response cache.
 *
 * A cache hit then costs almost nothing: no validation, no JSON.stringify and no
 * compression. Each encoding is produced at most once per cached body, and an
 * ETag lets browsers revalidate with a 304 instead of downloading again.
 */
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ResponseCache } from './cache';

export interface CachedBody {
  json: Buffer;
  etag: string;
  br?: Buffer;
  gzip?: Buffer;
}

const MIN_COMPRESS_BYTES = 1024;

export function toCachedBody(value: unknown): CachedBody {
  const json = Buffer.from(JSON.stringify(value));
  const etag = `"${createHash('sha1').update(json).digest('base64url').slice(0, 22)}"`;
  return { json, etag };
}

function pickEncoding(header: string | undefined): 'br' | 'gzip' | null {
  if (!header) return null;
  const accepted = header
    .toLowerCase()
    .split(',')
    .map((part) => part.trim().split(';'))
    .filter(([, q]) => !q || Number(q.trim().replace(/^q=/, '')) > 0)
    .map(([name]) => name!.trim());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip') || accepted.includes('*')) return 'gzip';
  return null;
}

export function sendCachedBody(
  request: FastifyRequest,
  reply: FastifyReply,
  body: CachedBody,
): FastifyReply {
  reply.header('etag', body.etag).header('vary', 'accept-encoding');
  if (request.headers['if-none-match'] === body.etag) {
    return reply.code(304).send();
  }
  reply.type('application/json; charset=utf-8');
  const encoding =
    body.json.length >= MIN_COMPRESS_BYTES
      ? pickEncoding(request.headers['accept-encoding'])
      : null;
  if (encoding === 'br') {
    body.br ??= zlib.brotliCompressSync(body.json, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
    });
    return reply.header('content-encoding', 'br').send(body.br);
  }
  if (encoding === 'gzip') {
    body.gzip ??= zlib.gzipSync(body.json, { level: 6 });
    return reply.header('content-encoding', 'gzip').send(body.gzip);
  }
  return reply.send(body.json);
}

/**
 * Answers a GET from the response cache, computing and caching it on a miss.
 * `compute` returning null means "not found": `notFound()` is thrown (and the
 * miss is cached too, so repeated requests for a missing slug stay cheap).
 */
export async function respondCached(
  cache: ResponseCache,
  request: FastifyRequest,
  reply: FastifyReply,
  key: string,
  compute: () => Promise<unknown>,
  notFound?: () => Error,
): Promise<FastifyReply> {
  const body = await cache.wrap(key, async () => {
    const value = await compute();
    return value === null ? null : toCachedBody(value);
  });
  if (!body) throw notFound ? notFound() : new Error(`No value for ${key}`);
  return sendCachedBody(request, reply, body);
}
