import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Language } from './useI18n';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUser = session?.user;

      if (sessionUser) {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('preferred_language')
          .eq('id', sessionUser.id)
          .single();

        if (error) {
          await supabase
            .from('user_profiles')
            .insert({ id: sessionUser.id, preferred_language: 'en' });
        }

        setUser(sessionUser);
      }

      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            setUser(session.user);
          } else {
            setUser(null);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = () => supabase.auth.signOut();

  const getPreferredLanguage = async (): Promise<Language> => {
    if (!user) return 'en';
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('preferred_language')
      .eq('id', user.id)
      .single();
    return (profile?.preferred_language as Language) || 'en';
  };

  return { 
    user, 
    loading, 
    login, 
    signup, 
    logout, 
    getPreferredLanguage
  };
}
