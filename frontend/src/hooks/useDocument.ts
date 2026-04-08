import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Document } from '../types';

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => api.get<Document[]>('/documents'),
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ['documents', id],
    queryFn: () => api.get<Document>(`/documents/${id}`),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation<Document, Error, string | undefined>({
    mutationFn: (title) => api.post<Document>('/documents', { title: title ?? 'Untitled Document' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocumentTitle() {
  const qc = useQueryClient();
  return useMutation<Document, Error, { id: string; title: string }>({
    mutationFn: ({ id, title }) => api.patch<Document>(`/documents/${id}/title`, { title }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['documents', vars.id] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete<{ message: string }>(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useAddCollaborator() {
  return useMutation<
    { message: string },
    Error,
    { documentId: string; email: string; permission: 'view' | 'edit' }
  >({
    mutationFn: ({ documentId, email, permission }) =>
      api.post(`/documents/${documentId}/collaborators`, { email, permission }),
  });
}
