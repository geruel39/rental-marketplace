"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

interface UseUserState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useUser(): UseUserState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      setLoading(true);
      setError(null);

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle<Profile>();

      if (profileError) {
        setError(profileError.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setLoading(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading, error };
}
