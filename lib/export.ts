/**
 * Client-side export utilities for StudyAI.
 *
 * Goals:
 * - Zero new runtime dependencies (browser APIs only).
 * - Anki: emit a tab-separated file Anki can import directly via "File → Import"
 *   with field-separator = Tab. (.apkg requires SQLite — out of scope client-side.)
 * - PDF: use the browser's native print pipeline against a hidden iframe so users
 *   can pick "Save as PDF" without us shipping a PDF lib.
 */

export interface FlashcardLike {
  front?: string;
  back?: string;
  question?: string;
  answer?: string;
  tags?: string[] | string;
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick — Safari needs the URL alive when click fires.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const sanitizeFilename = (name: string): string =>
  (name || 'export').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'export';

const csvEscape = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const normalizeCard = (c: FlashcardLike) => ({
  front: c.front ?? c.question ?? '',
  back: c.back ?? c.answer ?? '',
  tags: Array.isArray(c.tags) ? c.tags.join(' ') : (c.tags ?? '')
});

// ---------- Flashcards ----------

export function exportFlashcardsCSV(cards: FlashcardLike[], baseName: string) {
  const rows = ['front,back,tags'];
  for (const raw of cards) {
    const c = normalizeCard(raw);
    rows.push([csvEscape(c.front), csvEscape(c.back), csvEscape(c.tags)].join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}-flashcards.csv`);
}

/**
 * Anki-importable TSV.
 * Anki: File → Import → set "Fields separated by: Tab" → map column 1 → Front, column 2 → Back, column 3 → Tags.
 * Newlines inside a field are written as <br> so Anki preserves them.
 */
export function exportFlashcardsAnki(cards: FlashcardLike[], baseName: string) {
  const escapeField = (s: string) =>
    s.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const rows: string[] = [];
  for (const raw of cards) {
    const c = normalizeCard(raw);
    rows.push([escapeField(c.front), escapeField(c.back), escapeField(c.tags)].join('\t'));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}-anki.tsv`);
}

export function exportFlashcardsMarkdown(cards: FlashcardLike[], baseName: string) {
  const lines: string[] = [`# Flashcards — ${baseName}`, ''];
  cards.forEach((raw, i) => {
    const c = normalizeCard(raw);
    lines.push(`## ${i + 1}. ${c.front}`);
    lines.push('');
    lines.push(c.back);
    if (c.tags) lines.push(`\n*Tags: ${c.tags}*`);
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}-flashcards.md`);
}

// ---------- Summary ----------

export function exportSummaryMarkdown(summary: unknown, baseName: string) {
  let body = '';
  if (typeof summary === 'string') {
    body = summary;
  } else if (summary && typeof summary === 'object') {
    const s = summary as any;
    if (typeof s.content === 'string') body = s.content;
    else if (typeof s.summary === 'string') body = s.summary;
    else if (Array.isArray(s.points)) body = s.points.map((p: any) => `- ${p}`).join('\n');
    else body = '```json\n' + JSON.stringify(summary, null, 2) + '\n```';
  }
  const md = `# Summary — ${baseName}\n\n${body}\n`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}-summary.md`);
}

// ---------- Quiz ----------

export interface QuizQuestionLike {
  question?: string;
  options?: string[];
  correct_answer?: number | string;
  correctAnswer?: number | string;
  explanation?: string;
}

export function exportQuizMarkdown(
  quiz: { questions?: QuizQuestionLike[] } | QuizQuestionLike[] | undefined,
  baseName: string,
  { withAnswers = true }: { withAnswers?: boolean } = {}
) {
  const questions: QuizQuestionLike[] = Array.isArray(quiz)
    ? quiz
    : (quiz?.questions || []);
  const lines: string[] = [`# Quiz — ${baseName}`, ''];
  questions.forEach((q, i) => {
    lines.push(`## ${i + 1}. ${q.question || ''}`);
    (q.options || []).forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      lines.push(`- **${letter}.** ${opt}`);
    });
    if (withAnswers) {
      const correct = q.correct_answer ?? q.correctAnswer;
      if (correct != null) {
        const letter = typeof correct === 'number'
          ? String.fromCharCode(65 + correct)
          : String(correct);
        lines.push('');
        lines.push(`**Answer:** ${letter}`);
        if (q.explanation) lines.push(`**Why:** ${q.explanation}`);
      }
    }
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const suffix = withAnswers ? '-with-answers' : '';
  triggerDownload(blob, `${sanitizeFilename(baseName)}-quiz${suffix}.md`);
}

/**
 * Render printable HTML in a hidden iframe and trigger the browser's print dialog.
 * Users can choose "Save as PDF" — works in Chrome, Edge, Firefox, Safari.
 */
export function printAsPdf(htmlBody: string, title: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; padding: 24px; line-height: 1.5; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 18px; }
  ol.q-list { padding-left: 20px; }
  ol.q-list > li { margin-bottom: 14px; page-break-inside: avoid; }
  .opts { list-style: upper-alpha; padding-left: 22px; margin: 4px 0 0; }
  .answer { margin-top: 4px; color: #1d4ed8; font-size: 0.9em; }
  hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${htmlBody}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  // Wait for layout, then print.
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
  // Some browsers fire load before onload assignment when content is inline; retry.
  setTimeout(() => {
    if (iframe.contentDocument?.readyState === 'complete') {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      cleanup();
    }
  }, 50);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function exportQuizPDF(
  quiz: { questions?: QuizQuestionLike[] } | QuizQuestionLike[] | undefined,
  baseName: string,
  { withAnswers = true }: { withAnswers?: boolean } = {}
) {
  const questions: QuizQuestionLike[] = Array.isArray(quiz) ? quiz : (quiz?.questions || []);
  const items = questions.map((q) => {
    const opts = (q.options || [])
      .map(o => `<li>${escapeHtml(String(o))}</li>`)
      .join('');
    let answerBlock = '';
    if (withAnswers) {
      const c = q.correct_answer ?? q.correctAnswer;
      if (c != null) {
        const letter = typeof c === 'number' ? String.fromCharCode(65 + c) : String(c);
        answerBlock = `<div class="answer"><strong>Answer:</strong> ${escapeHtml(letter)}${
          q.explanation ? ` — ${escapeHtml(q.explanation)}` : ''
        }</div>`;
      }
    }
    return `<li><div>${escapeHtml(q.question || '')}</div><ol class="opts">${opts}</ol>${answerBlock}</li>`;
  }).join('');

  const html = `<h1>Quiz — ${escapeHtml(baseName)}</h1>
<hr/>
<ol class="q-list">${items}</ol>`;
  printAsPdf(html, `Quiz — ${baseName}`);
}
