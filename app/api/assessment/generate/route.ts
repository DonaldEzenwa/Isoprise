import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';

export const dynamic = 'force-dynamic';

const questionSchema = z.object({
  questions: z.array(z.object({
    id: z.string().min(1).max(40),
    q: z.string().min(8).max(500),
    options: z.array(z.string().min(1).max(240)).length(4),
    correct: z.string().min(1).max(240),
    topic: z.string().min(1).max(80),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
  })).length(15),
});

type CareerLevel = 'beginner' | 'intermediate' | 'advanced';

function demoQuestions(career: string, level: CareerLevel) {
  const rows: Array<[string, string[], string, string]> = [
    ['When joining two datasets, which key should you prefer?', ['A stable shared identifier', 'A row number that changes', 'A random text field', 'The first column'], 'A stable shared identifier', 'data foundations'],
    ['What does a SQL LEFT JOIN preserve?', ['All rows from the left table', 'Only matching right rows', 'Only duplicate rows', 'No unmatched rows'], 'All rows from the left table', 'sql'],
    ['Why validate missing values before analysis?', ['To understand data quality and impact', 'To remove every row automatically', 'To make charts colorful', 'To hide small samples'], 'To understand data quality and impact', 'data quality'],
    ['Which chart is usually suited to a time trend?', ['Line chart', 'Pie chart', 'Tree map', 'Word cloud'], 'Line chart', 'visualization'],
    ['What is a useful first step when a metric changes unexpectedly?', ['Check its definition and source data', 'Change the dashboard color', 'Delete the outlier', 'Assume it is a growth signal'], 'Check its definition and source data', 'problem solving'],
    ['What does a train/test split help evaluate?', ['Generalization to unseen data', 'Database permissions', 'Font size', 'Network latency'], 'Generalization to unseen data', 'statistics'],
    ['What is a primary key?', ['A unique row identifier', 'A chart legend', 'An optional note', 'A report title'], 'A unique row identifier', 'sql'],
    ['What should a chart title communicate?', ['The key finding or metric and context', 'Only the project name', 'A technical code', 'Nothing beyond the color'], 'The key finding or metric and context', 'communication'],
    ['Why use version control on analysis work?', ['To track changes and collaborate safely', 'To make data private automatically', 'To replace documentation', 'To avoid testing'], 'To track changes and collaborate safely', 'tools'],
    ['What is a sensible way to share uncertain results?', ['State assumptions and limitations', 'Hide the uncertainty', 'Present a guess as fact', 'Remove the source'], 'State assumptions and limitations', 'communication'],
    ['What does a Python function support?', ['Reusable named behavior', 'A database backup only', 'A fixed chart color', 'A file permission'], 'Reusable named behavior', 'python'],
    ['Why compare a result with a baseline?', ['To understand change against a reference', 'To make all values equal', 'To remove context', 'To bypass data checks'], 'To understand change against a reference', 'analysis'],
    ['What is a useful dashboard filter?', ['A relevant dimension users need to compare', 'A random control', 'A hidden metric', 'A duplicate title'], 'A relevant dimension users need to compare', 'product thinking'],
    ['How should an analyst handle an unclear request?', ['Clarify the decision and success measure', 'Start with an unrelated chart', 'Skip stakeholder context', 'Pick the largest number'], 'Clarify the decision and success measure', 'communication'],
    ['What is a reproducible analysis?', ['A documented process that can be rerun', 'A result copied without sources', 'A screenshot without data', 'An undocumented spreadsheet'], 'A documented process that can be rerun', 'practice'],
  ];
  return rows.map(([q, options, correct, topic], index) => ({ id: `demo-${index + 1}`, q: String(q).replace(/data analyst/gi, career), options: options as string[], correct: String(correct), topic: String(topic), level }));
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const career = typeof body?.career === 'string' ? body.career.trim().slice(0, 120) : '';
  const level: CareerLevel = typeof body?.level === 'string' && ['beginner', 'intermediate', 'advanced'].includes(body.level) ? body.level as CareerLevel : 'beginner';
  if (!career) return NextResponse.json({ error: 'Career interest is required.' }, { status: 400 });

  const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: 'Apply the Supabase schema migration before generating assessments.' }, { status: 503 });
  if (!profile) return NextResponse.json({ error: 'Save your career profile before generating an assessment.' }, { status: 409 });

  let questions: z.infer<typeof questionSchema>['questions'];
  let demo = false;
  if (hasGroqKey()) {
    try {
      const generated = await generateObject({
        model: getGroqModel(),
        temperature: 0,
        maxRetries: 3,
        schema: questionSchema,
        prompt: `Create exactly 15 fair multiple-choice skills-assessment questions for the career track "${career}" at ${level} level. Balance practical technical knowledge, reasoning, communication and professional practice. Return only the requested JSON object: no reasoning, explanations, markdown, or extra keys. Each question must have exactly four plausible options and one correct answer that exactly matches one option. Use unique ids q1..q15, concise text, a topic, and level ${level}. Avoid trick questions.`,
      });
      questions = generated.object.questions;
    } catch (error) {
      console.error('Assessment generation failed:', error);
      return NextResponse.json({ error: 'Groq assessment generation failed. Check provider/model configuration and retry.' }, { status: 502 });
    }
  } else {
    questions = demoQuestions(career, level);
    demo = true;
  }

  const { data, error } = await supabase.from('assessments').insert({ user_id: user.id, career_track: career, questions, answers: [], score: null, topic_breakdown: {}, skill_gaps: [] }).select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Assessment could not be saved. Confirm the schema migration is applied.' }, { status: 503 });
  return NextResponse.json({ assessment_id: data.id, questions: questions.map(({ id, q, options, topic, level }) => ({ id, q, options, topic, level })), demo, ...(demo ? { label: 'DEMO DATA - Connect API keys for live results' } : {}) });
}
