import { useCallback } from "react";
import { supabase, isSimulationMode } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

interface IdentityInfo {
  fullName: string;
  username: string;
  socialLink: string;
  keywords: string;
  faceImage: string | null;
  email: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  // 1. Unified Session Query (The source of truth for auth)
  const { data: user, isLoading: loading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // 2. Identity Query (Fetch PII from Database, not LocalStorage)
  const { data: identity, isLoading: loadingIdentity } = useQuery({
    queryKey: ["identity", user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (isSimulationMode) {
         const local = localStorage.getItem(`evara-identity-${user.id}`);
         return local ? JSON.parse(local) : null;
      }
      
      const { data, error } = await supabase
        .from('monitored_identities' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? {
        fullName: data.full_name,
        username: data.identity_value_encrypted, // Simplified mapping for the refactor
        email: data.identity_value_encrypted,
        socialLink: "",
        keywords: "",
        faceImage: null
      } : null;
    },
    enabled: !!user,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, pass }: any) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
      return data.user;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData(["auth-user"], newUser);
      toast.success("Login Successful");
    },
  });

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.setQueryData(["auth-user"], null);
    queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    toast.success("Session Terminated");
  }, [queryClient]);

  const saveIdentity = useCallback(async (info: IdentityInfo) => {
    if (!user) return;
    
    if (isSimulationMode) {
       localStorage.setItem(`evara-identity-${user.id}`, JSON.stringify(info));
    } else {
       // Persist to Postgres
       await supabase.from('monitored_identities' as any).upsert({
         user_id: user.id,
         identity_type: 'email',
         identity_value_encrypted: info.email,
         identity_hash: info.email, // Should be actual hash, handled in form
         full_name: info.fullName,
         is_active: true
       } as any);
    }
    
    queryClient.invalidateQueries({ queryKey: ["identity", user.id] });
  }, [user, queryClient]);

  return { 
    user, 
    identity,
    loading: loading || loadingIdentity, 
    login: (e: string, p: string) => loginMutation.mutateAsync({ email: e, pass: p }),
    register: (e: string, p: string) => supabase.auth.signUp({ email: e, password: p }),
    logout, 
    saveIdentity 
  };
}
