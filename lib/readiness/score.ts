export type MatchStatus = 'matched' | 'partial' | 'gap';
export type ReadinessBreakdown = { requirement: string; profile_evidence: string; status: MatchStatus };

const stop = new Set(['with','from','that','this','will','your','have','using','ability','strong','good','work','team','years','year','role','must','should','required','experience','knowledge','skills','skill','and','the','for','to','of','in','on','a','an','or','is','are','be','as','by','we','our','you','at','it','their','such','including']);
const knownSkills = ['python','sql','excel','power bi','tableau','machine learning','data analysis','data visualization','statistics','communication','project management','javascript','typescript','react','node.js','cloud','aws','azure','google cloud','git','html','css','tensorflow','pytorch','scikit-learn','api','leadership','research','writing','customer service','financial modelling','figma','product design','cybersecurity','linux','docker','kubernetes','salesforce','marketing analytics'];

export function parseRequirements(jobDescription: string): string[] {
  const raw = jobDescription.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•▪]|\d+[.)])\s*/, '').trim()).filter((line) => line.length >= 4 && line.length <= 240);
  let lines = raw.filter((line) => /\b(require|must|need|experience|proficien|familiar|knowledge|skill|ability|responsibilit|qualification|work with|strong)\b/i.test(line));
  if (lines.length < 3) lines = [...new Set([...lines, ...raw.filter((line) => line.length >= 10)])];
  if (lines.length < 3) {
    const lower = jobDescription.toLowerCase();
    const detected = knownSkills.filter((skill) => lower.includes(skill));
    lines = [...lines, ...detected.map((skill) => `Experience with ${skill}`)];
  }
  if (lines.length < 3) {
    const sentences = jobDescription.split(/[.!?;]+/).map((part) => part.trim()).filter((part) => part.length > 15 && part.length < 240);
    lines = [...lines, ...sentences];
  }
  return [...new Set(lines)].slice(0, 15);
}

function tokens(text: string) {
  return new Set((text.toLowerCase().match(/[a-z0-9+#.]+/g) || []).filter((token) => token.length > 1 && !stop.has(token)));
}

function evidenceFor(requirement: string, evidence: string) {
  const lower = evidence.toLowerCase();
  const phrase = requirement.toLowerCase().replace(/^(experience with|proficiency in|knowledge of)\s+/, '').trim();
  if (phrase.length > 2 && lower.includes(phrase)) {
    const index = lower.indexOf(phrase);
    return evidence.slice(Math.max(0, index - 48), Math.min(evidence.length, index + phrase.length + 100)).trim();
  }
  const reqWords = [...tokens(requirement)].filter((word) => word.length > 2);
  const matches = reqWords.filter((word) => lower.includes(word));
  if (matches.length === 0) return '';
  const sample = evidence.split(/[.!?\n]+/).find((sentence) => matches.some((word) => sentence.toLowerCase().includes(word)));
  return sample?.trim().slice(0, 160) || matches.join(', ');
}

export function readinessLabel(score: number) {
  if (score < 40) return 'Needs Development';
  if (score < 70) return 'Partially Ready';
  if (score < 85) return 'Ready';
  return 'Strong Match';
}

export function calculateReadiness(jobDescription: string, profileEvidence: string) {
  const requirements = parseRequirements(jobDescription);
  if (requirements.length === 0) return { readiness_score: 0, readiness_label: 'Needs Development', breakdown: [] as ReadinessBreakdown[], recommendations: ['Add specific role requirements or responsibilities to the job description.'], matched_required: 0, partial: 0, total_required: 0 };
  const profileTokens = tokens(profileEvidence);
  const breakdown = requirements.map((requirement) => {
    const evidence = evidenceFor(requirement, profileEvidence);
    const reqTokens = [...tokens(requirement)];
    const matchedTokens = reqTokens.filter((token) => profileTokens.has(token));
    const ratio = reqTokens.length ? matchedTokens.length / reqTokens.length : 0;
    const status: MatchStatus = evidence && ratio >= 0.62 ? 'matched' : evidence || ratio >= 0.25 ? 'partial' : 'gap';
    return { requirement, profile_evidence: evidence || 'No matching evidence in your saved profile.', status };
  });
  const matched_required = breakdown.filter((row) => row.status === 'matched').length;
  const partial = breakdown.filter((row) => row.status === 'partial').length;
  const total_required = breakdown.length;
  const readiness_score = Math.round(((matched_required * 1 + partial * 0.5) / total_required) * 100);
  const recommendations = breakdown.filter((row) => row.status !== 'matched').slice(0, 5).map((row) => row.status === 'partial' ? `Add a specific project or quantified example demonstrating ${row.requirement}.` : `Build and document evidence for ${row.requirement}.`);
  return { readiness_score, readiness_label: readinessLabel(readiness_score), breakdown, recommendations, matched_required, partial, total_required };
}
