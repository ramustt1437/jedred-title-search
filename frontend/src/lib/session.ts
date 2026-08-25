import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { User } from "@/lib/types";

export function useSession() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await apiGet<User>("/auth/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return async () => {
    try {
      await apiPost("/auth/logout");
    } finally {
      qc.clear();
    }
  };
}

/** Streams a protected file/blob response to the browser as a download. */
export async function downloadBlob(path: string, filename: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { detail?: string } | null)?.detail || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const can = (perms: string[] | undefined, perm: string) => !!perms?.includes(perm);
