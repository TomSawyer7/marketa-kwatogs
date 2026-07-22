import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE = new Map<string, { url: string; exp: number }>();

export function useSignedUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const key = `${bucket}/${path}`;
    const cached = CACHE.get(key);
    if (cached && cached.exp > Date.now() + 60_000) {
      setUrl(cached.url);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        CACHE.set(key, { url: data.signedUrl, exp: Date.now() + expiresIn * 1000 });
        setUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [bucket, path, expiresIn]);

  return url;
}
