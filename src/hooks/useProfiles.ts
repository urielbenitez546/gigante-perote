import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppRole, Profile } from "../types";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setProfiles((data as unknown as Profile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profiles, loading, error, reload };
}

export interface UpdateProfileInput {
  fullName?: string;
  role?: AppRole;
  active?: boolean;
}

export async function updateProfile(profileId: string, input: UpdateProfileInput) {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.role !== undefined) patch.role = input.role;
  if (input.active !== undefined) patch.active = input.active;

  const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
  return { error: error?.message ?? null };
}
