export interface Document {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorPresence {
  userId: string;
  username: string;
  color: string;
}
