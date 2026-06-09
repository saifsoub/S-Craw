import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Document } from '../types';

export function useDocuments() {
  const { user } = useAuthStore();
  return useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Document[];
    },
    enabled: !!user,
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as Document;
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  return useMutation<Document, Error, string | undefined>({
    mutationFn: async (title) => {
      const { data, error } = await supabase
        .from('documents')
        .insert({ owner_id: user!.id, title: title ?? 'Untitled Document' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Document;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocumentTitle() {
  const qc = useQueryClient();
  return useMutation<Document, Error, { id: string; title: string }>({
    mutationFn: async ({ id, title }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Document;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['documents', vars.id] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { message: 'Document deleted' };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useAddCollaborator() {
  return useMutation<
    { message: string },
    Error,
    { documentId: string; email: string; permission: 'view' | 'edit' }
  >({
    mutationFn: async ({ documentId, email, permission }) => {
      const { data: userId, error: lookupError } = await supabase
        .rpc('find_user_id_by_email', { email_input: email });
      if (lookupError || !userId) throw new Error('No user found with that email');

      const { error } = await supabase
        .from('document_collaborators')
        .upsert({ document_id: documentId, user_id: userId, permission });
      if (error) throw new Error('Not authorized to manage collaborators');

      return { message: 'Collaborator added' };
    },
  });
}
