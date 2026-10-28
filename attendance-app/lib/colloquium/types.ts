export type ColloquiumGroup = 'G1' | 'G2';
export interface ColloquiumQuestion {
  id: string;
  prompt: string;
  options: {
    id: string;
    text: string;
  }[];
}
export interface ColloquiumRoom {
  id: string;
  groupName: ColloquiumGroup;
  weekNumber: 7;
  state: 'lobby' | 'live' | 'finished';
  startedAt: string | null;
  deadline: string | null;
}
export interface ColloquiumResult {
  fullName: string;
  groupName: ColloquiumGroup;
  score: number;
}
export interface ColloquiumState {
  serverTime: string;
  room: ColloquiumRoom | null;
  authenticated: boolean;
  registered: boolean;
  attempt: null | {
    id: string;
    submitted: boolean;
    answers: Record<string, string | null>;
    revisions: Record<string, number>;
    revision: number;
  };
  questions: ColloquiumQuestion[];
  results: ColloquiumResult[];
  rooms: ColloquiumRoom[];
}
export interface ColloquiumStaffRoom extends ColloquiumRoom {
  token: string;
  joinedCount: number;
  participants: {
    fullName: string;
    submitted: boolean;
  }[];
}
export interface ColloquiumStaffState {
  serverTime: string;
  rooms: ColloquiumStaffRoom[];
}
export interface ColloquiumRegistrationInput {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  studentId: string;
}
export interface ColloquiumPreviewRun {
  private: true;
  studentId: string;
  serverTime: string;
  deadline: string;
  proof: string;
  questions: ColloquiumQuestion[];
}
export interface ColloquiumPreviewResult {
  private: true;
  studentId: string;
  score: number;
  maxScore: 10;
}
