export interface Project {
  id: string;
  title: string;
  subject: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  videoName?: string;
  youtubeUrl?: string;
}

export interface Frame {
  id: string;
  projectId: string;
  order: number;
  /** seconds from the start of the video */
  time: number;
  image: Blob;
  text: string;
  /** OCR confidence 0..100 when known */
  confidence?: number;
  uncertain: boolean;
  source: 'auto' | 'manual' | 'import';
}
