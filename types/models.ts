export type Profile = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    bio?: string | null;
    rating?: number | null;
    role?: string | null;
};

export type ProjectStatus = 'pending' | 'in_progress' | 'completed' | string;

export type Project = {
    id: string;
    owner_id: string;
    assigned_provider_id: string | null;
    title: string;
    city: string;
    status: ProjectStatus;
    image_url: string | null;
    created_at: string;
    budget?: number | null;
    description?: string | null;
    category?: string | null;
};

export type Review = {
    id: string;
    project_id: string;
    provider_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
};

export type ProjectApplication = {
    id: string;
    project_id: string;
    provider_id: string;
    status: string;
    created_at: string;
    provider?: Profile | null;
};

export type Message = {
    id: string;
    project_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    image_url?: string | null;
    audio_url?: string | null;
    transcription_text?: string | null;
    translation_text?: string | null;
    translation_lang?: string | null;
};

export type Notification = {
    id: string;
    user_id?: string | null;
    title: string | null;
    message: string | null;
    type: string | null;
    is_read: boolean | null;
    created_at: string;
    link?: string | null;
    route?: string | null;
    project_id?: string | null;
    chat_id?: string | null;
};

export type ProjectUpdate = {
    id: string;
    title: string;
    image_url: string | null;
    created_at: string;
};

export type PortfolioItem = {
    id: string;
    image_url: string;
    created_at: string;
};

export type EarningsEntry = {
    id: string;
    amount: number;
    type: string;
    created_at: string;
    description?: string | null;
};

export type ProjectObserver = {
    id: string;
    project_id: string;
    user_id: string | null;
    invite_token: string;
    email?: string | null;
    created_at: string;
};

export type ProjectContract = {
    id: string;
    project_id: string;
    pdf_url: string | null;
    client_signed_at: string | null;
    provider_signed_at: string | null;
    client_signature_url: string | null;
    provider_signature_url: string | null;
    created_at: string;
    updated_at: string;
};

export type ProjectDispute = {
    id: string;
    project_id: string;
    milestone_id: string;
    opened_by: string | null;
    resolved_by: string | null;
    resolution: string | null;
    status: 'open' | 'resolved';
    created_at: string;
    resolved_at: string | null;
};

export type ProjectAccessRole = 'owner' | 'provider' | 'observer' | null;
