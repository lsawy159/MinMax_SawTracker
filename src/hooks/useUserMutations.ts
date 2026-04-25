import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string | null }) => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase.from('users').update({ role_id: roleId }).eq('id', userId).select().single();

      if (error) {
        logger.error('Error updating user role:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
    onError: (error) => {
      logger.error('User role update failed:', error);
    },
  });
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Record<string, boolean> }) => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('users')
        .update({ permissions })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user permissions:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
    onError: (error) => {
      logger.error('User permissions update failed:', error);
    },
  });
}
