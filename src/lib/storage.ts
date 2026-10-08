import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Extrai o caminho (path) de um comprovante a partir do valor salvo em
 * `attachment_url`. Suporta:
 *  - path bruto: "receipts/<family_id>/<arquivo>"
 *  - URL pública antiga: ".../storage/v1/object/public/attachments/receipts/..."
 */
export function extractAttachmentPath(value: string): string | null {
  if (!value) return null;
  const clean = value.split('?')[0];
  const marker = '/object/public/attachments/';
  const idx = clean.indexOf(marker);
  if (idx !== -1) return clean.slice(idx + marker.length) || null;
  if (clean.startsWith('receipts/')) return clean;
  return null;
}

// Cache em memória das URLs assinadas (válidas por 1h no Supabase).
// Guardamos com folga de segurança para não renovar a cada clique.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Gera uma URL assinada (signed URL) para um comprovante. Requer bucket PRIVADO.
 * Retorna null se o caminho for inválido ou a geração falhar.
 */
export async function getSignedAttachmentUrl(
  value: string,
  ttlSeconds = 3600,
): Promise<string | null> {
  const path = extractAttachmentPath(value);
  if (!path) return null;

  const cached = signedUrlCache.get(path);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  });
  return data.signedUrl;
}

/**
 * Hook que resolve a URL assinada de um comprovante. Retorna null enquanto
 * carrega ou quando não há comprovante.
 */
export function useSignedAttachmentUrl(value?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!value) return;
    getSignedAttachmentUrl(value).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [value]);

  return url;
}
