const canonicalHost = 'luquisound.com';
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const contentSecurityPolicy = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "script-src 'self'", "style-src 'self' 'sha256-tVhPjph7qMo1hPF94qNd+HSuirEXRpfd7f1Ze5YKUoY='",
  "img-src 'self'", "font-src 'self'", "media-src 'self'", "connect-src 'none'",
  "frame-src 'none'", "form-action 'self'",
].join('; ');

export const STATIC_ASSET_HEADERS = Object.freeze({
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
});

function secureResponse(response, url) {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(STATIC_ASSET_HEADERS)) {
    if (name !== 'Strict-Transport-Security' || url.protocol === 'https:') result.headers.set(name, value);
  }
  if (result.headers.get('Content-Type')?.startsWith('text/html')) {
    // Prevent zone-level analytics injection into the approved static pages.
    const cacheControl = result.headers.get('Cache-Control') ?? 'public, max-age=0, must-revalidate';
    if (!cacheControl.split(',').some((directive) => directive.trim().toLowerCase() === 'no-transform')) {
      result.headers.set('Cache-Control', `${cacheControl}, no-transform`);
    }
  }
  return result;
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  const start = first === null ? Math.max(0, size - last) : first;
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  return start < size && start <= end && !(first === null && last === 0) ? { start, end } : null;
}

function sliceStream(body, start, length) {
  const reader = body.getReader();
  let offset = 0;
  let remaining = length;
  return new ReadableStream({
    async pull(controller) {
      try {
        while (remaining > 0) {
          const { value, done } = await reader.read();
          if (done) throw new Error('Asset ended before the requested byte range.');
          const skip = Math.max(0, start - offset);
          offset += value.byteLength;
          if (skip >= value.byteLength) continue;
          const bytes = value.subarray(skip, skip + remaining);
          remaining -= bytes.byteLength;
          controller.enqueue(bytes);
          if (remaining === 0) {
            controller.close();
            void reader.cancel().catch(() => {});
          }
          return;
        }
      } catch (error) {
        controller.error(error);
        void reader.cancel(error).catch(() => {});
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

function videoResponse(request, response, videoLengths) {
  const length = response.headers.get('Content-Length');
  // ASSETS omits Content-Length internally, so the build supplies exact MP4 sizes.
  const size = length === null ? videoLengths?.[new URL(request.url).pathname]
    : /^\d+$/.test(length) ? Number(length) : NaN;
  if (response.status !== 200 || !response.headers.get('Content-Type')?.startsWith('video/')
    || !Number.isSafeInteger(size) || size < 0
    || response.headers.get('Content-Encoding')) return response;
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(size));
  const range = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  const etag = headers.get('ETag');
  // Static Assets currently ignores Range. Stream only the selected video bytes.
  // Multiple ranges and nonmatching/weak/date validators use the full response.
  if (request.method !== 'GET' || range === null || range.includes(',') || !response.body
    || (ifRange !== null && (!etag?.startsWith('"') || ifRange !== etag))) {
    return new Response(response.body, { status: 200, statusText: response.statusText, headers });
  }
  const selected = parseRange(range, size);
  if (selected === null) {
    void response.body.cancel().catch(() => {});
    headers.set('Content-Range', `bytes */${size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  const selectedLength = selected.end - selected.start + 1;
  headers.set('Content-Range', `bytes ${selected.start}-${selected.end}/${size}`);
  headers.set('Content-Length', String(selectedLength));
  // Full-file ranges can reuse the native asset stream without JavaScript reads.
  if (selected.start === 0 && selectedLength === size) return new Response(response.body, { status: 206, headers });
  let body = sliceStream(response.body, selected.start, selectedLength);
  if (typeof FixedLengthStream === 'function') {
    const fixed = new FixedLengthStream(selectedLength);
    void body.pipeTo(fixed.writable).catch(() => {});
    body = fixed.readable;
  }
  return new Response(body, { status: 206, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const respond = (response) => secureResponse(response, url);
    if (!localHosts.has(url.hostname) && url.hostname !== canonicalHost && url.hostname !== `www.${canonicalHost}`) {
      return respond(new Response(null, { status: 404 }));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return respond(new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } }));
    }
    const destination = new URL(url);
    if (!localHosts.has(url.hostname)) {
      destination.protocol = 'https:';
      destination.hostname = canonicalHost;
      destination.port = '';
    }
    if (destination.pathname === '/index.html') destination.pathname = '/';
    if (destination.href !== url.href) {
      return respond(new Response(null, { status: 308, headers: { Location: destination.href } }));
    }
    let assetRequest = request;
    if (url.pathname === '/') {
      const assetUrl = new URL(url);
      assetUrl.pathname = '/index.html';
      assetRequest = new Request(assetUrl, request);
    }
    return respond(videoResponse(assetRequest, await env.ASSETS.fetch(assetRequest), env.VIDEO_LENGTHS));
  },
};
