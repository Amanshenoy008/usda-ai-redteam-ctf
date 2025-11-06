// API utility functions for backend communication
// 🔐 ENV PLACEHOLDER — API URL must be configured in environment variables
// Configure VITE_API_BASE_URL in your .env file (see README.md)

// Safely access environment variables with fallback
const getApiBaseUrl = (): string => {
  try {
    // Production: Set VITE_API_BASE_URL in deployment platform (Netlify/Vercel)
    // Development: Set in .env file or use default backend port
    const env = (import.meta as any).env;
    return env?.VITE_API_BASE_URL || 'http://localhost:5100';
  } catch (error) {
    return 'http://localhost:5100';
  }
};

const API_BASE_URL = getApiBaseUrl();

// Get stored JWT token
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('usda_token');
};

// Set stored JWT token
export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('usda_token', token);
};

// Clear stored JWT token
export const clearAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('usda_token');
};

// Generic fetch wrapper with auth headers
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      throw new Error('Unauthorized - please log in again');
    }

    // Handle other non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.statusText}`);
    }

    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error - please check your connection');
  }
}

// ============================================
// Authentication API
// ============================================

export interface SignupPayload {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
}

export interface SigninPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
  };
  token: string;
  message?: string;
}

/**
 * Email/Password Signup
 */
export async function signup(
  payload: SignupPayload
): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Store JWT token
  if (response.token) {
    setAuthToken(response.token);
  }

  // Store user data
  if (response.user) {
    localStorage.setItem('userData', JSON.stringify({
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
    }));
  }

  return response;
}

/**
 * Email/Password Signin
 */
export async function signin(
  payload: SigninPayload
): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Store JWT token
  if (response.token) {
    setAuthToken(response.token);
  }

  // Store user data
  if (response.user) {
    localStorage.setItem('userData', JSON.stringify({
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
    }));
  }

  return response;
}

/**
 * Verify if current token is valid
 */
export async function verifyToken(): Promise<boolean> {
  try {
    await apiFetch('/auth/verify', { method: 'GET' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<AuthResponse['user']> {
  const response = await apiFetch<{ user: AuthResponse['user'] }>('/auth/profile', {
    method: 'GET',
  });
  return response.user;
}

/**
 * Logout - clears authentication token and user data
 * Note: JWT tokens are stateless, so logout is client-side only
 */
export async function logout(): Promise<void> {
  // Clear token and user data from localStorage
  clearAuthToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userData');
  }
}

// ============================================
// Leaderboard API
// ============================================

export interface LeaderboardEntry {
  id: string | number;
  name: string;
  score: number;
  rank?: number;
  avatar?: string;
}

/**
 * Fetch leaderboard data
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>('/leaderboard', {
    method: 'GET',
  });
}

/**
 * Update user score on leaderboard
 * Note: userId is automatically extracted from the JWT token by the backend
 */
export async function updateLeaderboardScore(
  userId: number | string,
  points: number
): Promise<{ success: boolean; newScore?: number }> {
  return apiFetch<{ success: boolean; newScore?: number }>(
    '/leaderboard/update',
    {
      method: 'POST',
      body: JSON.stringify({ points }),
    }
  );
}

// ============================================
// User Progress API (Optional - for syncing)
// ============================================

export interface UserProgressData {
  userId: number;
  completedModules: number[];
  totalScore: number;
  moduleProgress: Record<number, any>;
}

/**
 * Sync user progress to backend
 */
export async function syncUserProgress(
  progressData: UserProgressData
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/progress/sync', {
    method: 'POST',
    body: JSON.stringify(progressData),
  });
}

/**
 * Fetch user progress from backend
 */
export async function fetchUserProgress(
  userId: number
): Promise<UserProgressData> {
  return apiFetch<UserProgressData>(`/progress/${userId}`, {
    method: 'GET',
  });
}

// ============================================
// Challenge API
// ============================================

export interface ChallengeRequest {
  userId: string;
  level: number;
  message?: string;
  submittedFlag?: string;
}

export interface ChallengeMetadata {
  status: 'ready';
  sessionKey: string;
  challenge: {
    slug: string;
    title: string;
  };
  level: {
    index: number;
    title: string;
    difficulty: string;
    description: string;
  };
}

export interface ChallengeChatResponse {
  sessionKey: string;
  challengeSlug: string;
  level: number;
  reply: string;
}

export interface ChallengeFlagResponse {
  status: 'passed' | 'incorrect';
  sessionKey: string;
  challengeSlug?: string;
  level?: number;
  xpAwarded?: number;
  message?: string;
}

export type ChallengeResponse = ChallengeMetadata | ChallengeChatResponse | ChallengeFlagResponse;

/**
 * Map vulnerability ID to challenge endpoint slug
 */
function getChallengeEndpoint(vulnerabilityId: number): string {
  const mapping: Record<number, string> = {
    1: 'challenge1', // prompt-injection
    2: 'challenge4', // improper-output-handling
    3: 'challenge3', // sensitive-information-disclosure (or could be 6)
    4: 'challenge2', // misinformation (approximate mapping)
  };
  return mapping[vulnerabilityId] || 'challenge1';
}

/**
 * Get challenge metadata or initialize challenge session
 */
export async function getChallengeMetadata(
  vulnerabilityId: number,
  level: number,
  userId: string
): Promise<ChallengeMetadata> {
  const endpoint = getChallengeEndpoint(vulnerabilityId);
  const response = await apiFetch<ChallengeMetadata>(`/api/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      level,
    }),
  });
  return response;
}

/**
 * Send a chat message to the challenge AI
 */
export async function sendChallengeMessage(
  vulnerabilityId: number,
  level: number,
  userId: string,
  message: string
): Promise<ChallengeChatResponse> {
  const endpoint = getChallengeEndpoint(vulnerabilityId);
  const response = await apiFetch<ChallengeChatResponse>(`/api/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      level,
      message,
    }),
  });
  return response;
}

/**
 * Submit a flag for a challenge
 */
export async function submitChallengeFlag(
  vulnerabilityId: number,
  level: number,
  userId: string,
  flag: string
): Promise<ChallengeFlagResponse> {
  const endpoint = getChallengeEndpoint(vulnerabilityId);
  const response = await apiFetch<ChallengeFlagResponse>(`/api/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      level,
      submittedFlag: flag,
    }),
  });
  return response;
}

// ============================================
// Health Check
// ============================================

/**
 * Check if backend API is reachable
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}
