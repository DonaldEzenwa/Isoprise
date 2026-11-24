import { createGroq } from '@ai-sdk/groq';

export function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function getGroqModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
  const groq = createGroq({ apiKey });
  return groq(process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b');
}
