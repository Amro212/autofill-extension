export const APP_VERSION = '0.1.0';
export const APP_NAME = 'Job Copilot';

export const STORAGE_KEYS = {
  SETTINGS: 'jc:settings',
  PROFILE: 'jc:profile',
  SECRETS: 'jc:secrets',
  DEBUG: 'jc:debug',
  VERSION: 'jc:version',
};

export const DEFAULT_SETTINGS = {
  model: 'google/gemini-2.0-flash',
  autofillEnabled: true,
  autoContinue: true,
  autoSubmit: false,
  autopilot: false,
};

export const DEFAULT_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  github: '',
  portfolio: '',
  resumeContext: '',
  applicantNotes: '',
};

export const POPULAR_MODELS = [
  'google/gemini-2.0-flash',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
];

export const UI_IDS = {
  CONTAINER: 'job-copilot-root',
};
