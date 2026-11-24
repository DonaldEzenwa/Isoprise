import React from 'react';
import { Document as WordDocument, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { Document as PdfDocument, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

export type CVContent = {
  full_name: string;
  contact: string[];
  summary: string;
  experience: { role: string; company?: string; start_date?: string; end_date?: string; description?: string; achievements?: string[] }[];
  education: { title: string; issuer?: string; date?: string; credential_id?: string }[];
  skills: string[];
  projects: { title: string; description?: string; technologies?: string[]; achievements?: string[] }[];
  certificates: { title: string; issuing_org?: string; issue_date?: string; credential_id?: string }[];
  relevant_keywords: string[];
};

function compact(content: CVContent): CVContent {
  return {
    ...content,
    summary: content.summary.slice(0, 700),
    experience: content.experience.slice(0, 4).map((item) => ({ ...item, description: item.description?.slice(0, 320), achievements: item.achievements?.slice(0, 3) })),
    education: content.education.slice(0, 4),
    skills: content.skills.slice(0, 24),
    projects: content.projects.slice(0, 3).map((item) => ({ ...item, description: item.description?.slice(0, 240), achievements: item.achievements?.slice(0, 2), technologies: item.technologies?.slice(0, 8) })),
    certificates: content.certificates.slice(0, 6),
    relevant_keywords: content.relevant_keywords.slice(0, 12),
  };
}

function section(title: string, lines: string[]) {
  return [new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 140, after: 40 } }), ...lines.filter(Boolean).map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 19 })], spacing: { after: 25 } }))];
}

export async function buildDocx(input: CVContent) {
  const content = compact(input);
  const children: Paragraph[] = [
    new Paragraph({ text: content.full_name || 'Professional Profile', heading: HeadingLevel.TITLE, spacing: { after: 40 } }),
    new Paragraph({ children: [new TextRun({ text: content.contact.join(' | '), size: 18 })], spacing: { after: 80 } }),
    ...section('Summary', [content.summary]),
    ...section('Experience', content.experience.flatMap((item) => [`${item.role}${item.company ? ` · ${item.company}` : ''}${item.start_date ? ` · ${item.start_date}–${item.end_date || 'Present'}` : ''}`, item.description || '', ...(item.achievements || []).map((achievement) => `• ${achievement}`)])),
    ...section('Education', content.education.map((item) => `${item.title}${item.issuer ? ` · ${item.issuer}` : ''}${item.date ? ` · ${item.date}` : ''}`)),
    ...section('Skills', [content.skills.join(' · ')]),
    ...section('Projects', content.projects.flatMap((item) => [`${item.title}${item.technologies?.length ? ` · ${item.technologies.join(', ')}` : ''}`, item.description || '', ...(item.achievements || []).map((achievement) => `• ${achievement}`)])),
    ...section('Certificates', content.certificates.map((item) => `${item.title}${item.issuing_org ? ` · ${item.issuing_org}` : ''}${item.issue_date ? ` · ${item.issue_date}` : ''}${item.credential_id ? ` · Credential ID: ${item.credential_id}` : ''}`)),
  ];
  const document = new WordDocument({ sections: [{ properties: { page: { margin: { top: 540, bottom: 540, left: 620, right: 620 } } }, children }] });
  return Packer.toBuffer(document);
}

const styles = StyleSheet.create({ page: { paddingTop: 32, paddingBottom: 34, paddingHorizontal: 42, fontFamily: 'Helvetica', fontSize: 9, color: '#13231b', lineHeight: 1.28 }, name: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 3 }, contact: { color: '#536158', fontSize: 8, marginBottom: 7 }, heading: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#45248f', marginTop: 7, marginBottom: 2, textTransform: 'uppercase' }, body: { marginBottom: 2 }, itemTitle: { fontFamily: 'Helvetica-Bold', marginTop: 2 }, bullet: { marginLeft: 8, marginBottom: 1 }, keyword: { color: '#536158', fontSize: 8 } });

function PdfSection({ title, lines }: { title: string; lines: string[] }) {
  return <View><Text style={styles.heading}>{title}</Text>{lines.filter(Boolean).map((line, index) => <Text style={line.startsWith('• ') ? styles.bullet : styles.body} key={`${title}-${index}`}>{line}</Text>)}</View>;
}

export async function buildPdf(input: CVContent) {
  const content = compact(input);
  const experience = content.experience.flatMap((item) => [`${item.role}${item.company ? ` · ${item.company}` : ''}${item.start_date ? ` · ${item.start_date}–${item.end_date || 'Present'}` : ''}`, item.description || '', ...(item.achievements || []).map((achievement) => `• ${achievement}`)]);
  const projects = content.projects.flatMap((item) => [`${item.title}${item.technologies?.length ? ` · ${item.technologies.join(', ')}` : ''}`, item.description || '', ...(item.achievements || []).map((achievement) => `• ${achievement}`)]);
  const element = <PdfDocument title={`${content.full_name || 'Professional'} CV`} author={content.full_name || 'Isoprise'}><Page size="A4" style={styles.page} wrap>
    <Text style={styles.name}>{content.full_name || 'Professional Profile'}</Text>
    <Text style={styles.contact}>{content.contact.join(' | ')}</Text>
    <PdfSection title="Summary" lines={[content.summary]} />
    <PdfSection title="Experience" lines={experience} />
    <PdfSection title="Education" lines={content.education.map((item) => `${item.title}${item.issuer ? ` · ${item.issuer}` : ''}${item.date ? ` · ${item.date}` : ''}`)} />
    <PdfSection title="Skills" lines={[content.skills.join(' · ')]} />
    <PdfSection title="Projects" lines={projects} />
    <PdfSection title="Certificates" lines={content.certificates.map((item) => `${item.title}${item.issuing_org ? ` · ${item.issuing_org}` : ''}${item.issue_date ? ` · ${item.issue_date}` : ''}${item.credential_id ? ` · Credential ID: ${item.credential_id}` : ''}`)} />
  </Page></PdfDocument>;
  return renderToBuffer(element);
}
