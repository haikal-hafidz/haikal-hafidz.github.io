/**
 * Utility functions, schema validators, sample templates, and atomic importers
 * for Mini Games CMS JSON Import.
 */

// Helper: Safely count phrase occurrences in text
function countPhraseOccurrences(text = '', phrase = '') {
  if (!phrase) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(phrase, cursor)) !== -1) {
    count += 1;
    cursor += phrase.length;
  }
  return count;
}

/**
 * Returns copyable sample JSON templates for each game type / slot.
 */
export function getSampleTemplate(gameType) {
  switch (gameType) {
    case 'hangman':
      return JSON.stringify(
        [
          {
            word: 'LUGAS',
            clue: 'Jelas, langsung, dan tidak berbelit-belit.',
            enabled: true
          },
          {
            word: 'TATA BAHASA',
            clue: 'Kaidah penyusunan kata dan kalimat.',
            enabled: true
          }
        ],
        null,
        2
      );

    case 'plagiarismPolice':
      return JSON.stringify(
        [
          {
            label: 'Integrity Case 1',
            difficulty: 'Dasar',
            source: 'Tidur yang cukup membantu konsolidasi ingatan manusia.',
            writerText: 'Menurut riset, istirahat malam yang cukup mendukung proses penguatan memori.',
            correctVerdict: 'ethical',
            correctEvidenceTypes: ['idea', 'attribution'],
            chunks: [
              { id: 'c1', text: 'Menurut riset,' },
              { id: 'c2', text: 'istirahat malam yang cukup' },
              { id: 'c3', text: 'mendukung proses penguatan memori.' }
            ],
            correctChunkIds: [],
            reasonOptions: [
              { id: 'r1', text: 'Struktur penyampaian telah diolah secara independen.' },
              { id: 'r2', text: 'Penggunaan sumber memiliki atribusi yang memadai.' }
            ],
            correctReasonIds: ['r1', 'r2'],
            report: 'Gagasan diolah ulang dengan konstruksi kalimat baru dan atribusi sumber yang jelas.'
          }
        ],
        null,
        2
      );

    case 'headlineHook':
      return JSON.stringify(
        [
          {
            label: 'Brief Headline Baru',
            contentType: 'Artikel Populer',
            audience: 'Pembaca Muda',
            goal: 'Menarik minat baca tanpa berlebihan',
            options: [
              {
                id: 'h1',
                text: 'Mengapa Tidur Cukup Penting bagi Fokus Kerja',
                clarity: 35,
                relevance: 35,
                hook: 25,
                risks: []
              },
              {
                id: 'h2',
                text: 'Rahasia Sukses yang Disembunyikan Semua Orang',
                clarity: 15,
                relevance: 12,
                hook: 30,
                risks: ['Sensational']
              },
              {
                id: 'h3',
                text: 'Tidur Lebih Banyak, Gaji Langsung Naik 100%',
                clarity: 10,
                relevance: 10,
                hook: 28,
                risks: ['Overpromise']
              },
              {
                id: 'h4',
                text: 'Dampak Kurang Tidur Terhadap Perhatian',
                clarity: 35,
                relevance: 30,
                hook: 20,
                risks: []
              }
            ]
          }
        ],
        null,
        2
      );

    case 'toneSwitcher':
      return JSON.stringify(
        [
          {
            label: 'Situasi Permintaan Revisi',
            channel: 'Email Kerja',
            audience: 'Atasan',
            targetTone: 'Profesional',
            source: 'Tolong revisi bagian pembuka ini sebelum jam tiga.',
            options: [
              {
                id: 't1',
                text: 'Bagian pembukanya perlu disesuaikan. Mohon revisinya sebelum pukul tiga.',
                toneFit: 38,
                audienceFit: 34,
                clarity: 28
              },
              {
                id: 't2',
                text: 'Bro, pembukanya aneh banget. Tolong benerin sebelum jam tiga ya.',
                toneFit: 15,
                audienceFit: 12,
                clarity: 20
              },
              {
                id: 't3',
                text: 'Dengan hormat, kami memohon kesediaan Bapak/Ibu untuk merevisi pembuka.',
                toneFit: 25,
                audienceFit: 25,
                clarity: 20
              },
              {
                id: 't4',
                text: 'Pembukanya salah. Revisi sekarang juga.',
                toneFit: 10,
                audienceFit: 10,
                clarity: 15
              }
            ]
          }
        ],
        null,
        2
      );

    case 'logicalLeap':
      return JSON.stringify(
        [
          {
            label: 'Analisis Korelasi dan Kausalitas',
            statement: 'Penjualan es krim dan angka kasus terbakar sinar matahari meningkat bersamaan di musim panas.',
            context: 'Pengamatan musiman di kota pantai.',
            question: 'Apakah penjualan es krim menyebabkan kulit terbakar?',
            options: [
              {
                id: 'l1',
                text: 'Tidak. Kedua hal tersebut dipicu oleh faktor ketiga yang sama, yaitu cuaca terik musim panas.',
                logic: 40,
                evidence: 35,
                precision: 25
              },
              {
                id: 'l2',
                text: 'Ya. Makan es krim membuat kulit lebih sensitif terhadap sinar matahari.',
                logic: 10,
                evidence: 5,
                precision: 10
              },
              {
                id: 'l3',
                text: 'Tidak dapat disimpulkan sama sekali dari data yang ada.',
                logic: 20,
                evidence: 20,
                precision: 15
              },
              {
                id: 'l4',
                text: 'Ya. Korelasi statistik otomatis membuktikan hubungan sebab-akibat.',
                logic: 5,
                evidence: 0,
                precision: 5
              }
            ]
          }
        ],
        null,
        2
      );

    case 'redPen':
    default:
      return JSON.stringify(
        [
          {
            label: 'Draft Pemanasan',
            enabled: true,
            passage: 'Tim kami berkolaborasi bersama untuk menyusun panduan penggunaan aplikasi.',
            issues: [
              {
                phrase: 'berkolaborasi bersama',
                replacement: 'berkolaborasi',
                explanation: 'Kata "berkolaborasi" sudah mengandung makna bekerja bersama; kata "bersama" menjadi redundan.'
              }
            ]
          }
        ],
        null,
        2
      );
  }
}

/**
 * Validates parsed JSON content against the specific game type schema.
 * Returns { valid: boolean, errors: string[], summary: string, items: Array }
 */
export function validateGameJson(rawJsonString, gameType) {
  const errors = [];
  if (!rawJsonString || !rawJsonString.trim()) {
    return { valid: false, errors: ['JSON text input is empty.'], summary: '', items: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch (err) {
    return {
      valid: false,
      errors: [`JSON syntax error: ${err.message}`],
      summary: '',
      items: []
    };
  }

  // Handle case where JSON wraps items in a root object property like { "drafts": [...] } or { "cases": [...] }
  let items = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    if (Array.isArray(parsed.drafts)) items = parsed.drafts;
    else if (Array.isArray(parsed.cases)) items = parsed.cases;
    else if (Array.isArray(parsed.items)) items = parsed.items;
    else if (Array.isArray(parsed.words)) items = parsed.words;
    else {
      // Single object item
      items = [parsed];
    }
  } else {
    return { valid: false, errors: ['Root JSON must be an Array or an Object with content array.'], summary: '', items: [] };
  }

  if (items.length === 0) {
    return { valid: false, errors: ['No valid items found in JSON payload.'], summary: '', items: [] };
  }

  const seenIds = new Set();

  switch (gameType) {
    case 'hangman': {
      items.forEach((item, idx) => {
        const itemPrefix = `[Word #${idx + 1}]`;
        if (!item || typeof item !== 'object') {
          errors.push(`${itemPrefix} Must be an object.`);
          return;
        }

        const word = String(item.word || item.label || '').trim();
        const clue = String(item.clue || item.passage || '').trim();

        if (!word) {
          errors.push(`${itemPrefix} Missing required field "word" (or "label").`);
        } else {
          const cleanLetters = word.replace(/[^A-Za-z]/g, '');
          if (cleanLetters.length < 2) {
            errors.push(`${itemPrefix} "word" ("${word}") must contain at least 2 alphabetic characters.`);
          }
        }

        if (!clue) {
          errors.push(`${itemPrefix} Missing required field "clue" (or "passage").`);
        }

        if (item.id) {
          if (seenIds.has(item.id)) {
            errors.push(`${itemPrefix} Duplicate item ID "${item.id}".`);
          } else {
            seenIds.add(item.id);
          }
        }
      });
      break;
    }

    case 'plagiarismPolice': {
      const allowedVerdicts = new Set(['original', 'ethical', 'close', 'plagiarism']);
      const allowedEvidence = new Set(['wording', 'structure', 'idea', 'attribution']);

      items.forEach((item, idx) => {
        const itemPrefix = `[Case #${idx + 1}]`;
        if (!item || typeof item !== 'object') {
          errors.push(`${itemPrefix} Must be an object.`);
          return;
        }

        if (!String(item.label || '').trim()) {
          errors.push(`${itemPrefix} Missing required field "label".`);
        }
        if (!String(item.source || '').trim()) {
          errors.push(`${itemPrefix} Missing required field "source".`);
        }
        if (!String(item.writerText || '').trim()) {
          errors.push(`${itemPrefix} Missing required field "writerText".`);
        }
        if (!item.correctVerdict || !allowedVerdicts.has(item.correctVerdict)) {
          errors.push(`${itemPrefix} Invalid or missing "correctVerdict". Allowed: original, ethical, close, plagiarism.`);
        }
        if (!Array.isArray(item.correctEvidenceTypes)) {
          errors.push(`${itemPrefix} "correctEvidenceTypes" must be an array of evidence types.`);
        } else {
          item.correctEvidenceTypes.forEach((ev) => {
            if (!allowedEvidence.has(ev)) {
              errors.push(`${itemPrefix} Unknown evidence type "${ev}". Allowed: wording, structure, idea, attribution.`);
            }
          });
        }

        if (item.chunks && !Array.isArray(item.chunks)) {
          errors.push(`${itemPrefix} "chunks" must be an array of objects if provided.`);
        }
        if (item.reasonOptions && !Array.isArray(item.reasonOptions)) {
          errors.push(`${itemPrefix} "reasonOptions" must be an array of objects if provided.`);
        }
        if (!String(item.report || '').trim()) {
          errors.push(`${itemPrefix} Missing required field "report".`);
        }

        if (item.id) {
          if (seenIds.has(item.id)) {
            errors.push(`${itemPrefix} Duplicate case ID "${item.id}".`);
          } else {
            seenIds.add(item.id);
          }
        }
      });
      break;
    }

    case 'headlineHook':
    case 'toneSwitcher':
    case 'logicalLeap': {
      items.forEach((item, idx) => {
        const itemPrefix = `[Case #${idx + 1}]`;
        if (!item || typeof item !== 'object') {
          errors.push(`${itemPrefix} Must be an object.`);
          return;
        }

        if (!String(item.label || '').trim()) {
          errors.push(`${itemPrefix} Missing required field "label".`);
        }

        if (gameType === 'headlineHook') {
          if (!String(item.contentType || '').trim()) errors.push(`${itemPrefix} Missing required field "contentType".`);
          if (!String(item.audience || '').trim()) errors.push(`${itemPrefix} Missing required field "audience".`);
          if (!String(item.goal || '').trim()) errors.push(`${itemPrefix} Missing required field "goal".`);
        } else if (gameType === 'toneSwitcher') {
          if (!String(item.channel || '').trim()) errors.push(`${itemPrefix} Missing required field "channel".`);
          if (!String(item.audience || '').trim()) errors.push(`${itemPrefix} Missing required field "audience".`);
          if (!String(item.targetTone || '').trim()) errors.push(`${itemPrefix} Missing required field "targetTone".`);
          if (!String(item.source || '').trim()) errors.push(`${itemPrefix} Missing required field "source".`);
        } else if (gameType === 'logicalLeap') {
          if (!String(item.statement || '').trim()) errors.push(`${itemPrefix} Missing required field "statement".`);
          if (!String(item.context || '').trim()) errors.push(`${itemPrefix} Missing required field "context".`);
          if (!String(item.question || '').trim()) errors.push(`${itemPrefix} Missing required field "question".`);
        }

        if (!Array.isArray(item.options) || item.options.length !== 4) {
          errors.push(`${itemPrefix} Field "options" must be an array of exactly 4 option objects.`);
        } else {
          item.options.forEach((opt, optIdx) => {
            const optPrefix = `${itemPrefix} [Option #${optIdx + 1}]`;
            if (!opt || typeof opt !== 'object') {
              errors.push(`${optPrefix} Must be an object.`);
              return;
            }
            if (!String(opt.text || '').trim()) {
              errors.push(`${optPrefix} Missing option text.`);
            }
          });
        }

        if (item.id) {
          if (seenIds.has(item.id)) {
            errors.push(`${itemPrefix} Duplicate case ID "${item.id}".`);
          } else {
            seenIds.add(item.id);
          }
        }
      });
      break;
    }

    case 'redPen':
    default: {
      items.forEach((item, idx) => {
        const itemPrefix = `[Draft #${idx + 1}]`;
        if (!item || typeof item !== 'object') {
          errors.push(`${itemPrefix} Must be an object.`);
          return;
        }

        const label = String(item.label || item.title || '').trim();
        const passage = String(item.passage || item.text || '').trim();

        if (!label) {
          errors.push(`${itemPrefix} Missing required field "label".`);
        }
        if (!passage) {
          errors.push(`${itemPrefix} Missing required field "passage".`);
        }

        if (!Array.isArray(item.issues) || item.issues.length === 0) {
          errors.push(`${itemPrefix} Field "issues" must be a non-empty array of editorial correction objects.`);
        } else {
          item.issues.forEach((issue, issueIdx) => {
            const issuePrefix = `${itemPrefix} [Correction #${issueIdx + 1}]`;
            if (!issue || typeof issue !== 'object') {
              errors.push(`${issuePrefix} Must be an object.`);
              return;
            }

            const phrase = String(issue.phrase || '').trim();
            const replacement = String(issue.replacement || '').trim();
            const explanation = String(issue.explanation || '').trim();

            if (!phrase) {
              errors.push(`${issuePrefix} Missing required field "phrase".`);
            } else if (passage) {
              const count = countPhraseOccurrences(passage, phrase);
              if (count === 0) {
                errors.push(`${issuePrefix} Phrase "${phrase}" was not found verbatim in passage.`);
              } else if (count > 1) {
                errors.push(`${issuePrefix} Phrase "${phrase}" occurs ${count} times in passage; must be unique.`);
              }
            }

            if (!replacement) {
              errors.push(`${issuePrefix} Missing required field "replacement".`);
            }
            if (!explanation) {
              errors.push(`${issuePrefix} Missing required field "explanation".`);
            }
          });
        }

        if (item.id) {
          if (seenIds.has(item.id)) {
            errors.push(`${itemPrefix} Duplicate draft ID "${item.id}".`);
          } else {
            seenIds.add(item.id);
          }
        }
      });
      break;
    }
  }

  const valid = errors.length === 0;
  const targetLabel = (gameType === 'hangman' ? 'words' : (gameType === 'redPen' ? 'drafts' : 'cases'));
  const summary = valid ? `Successfully validated ${items.length} ${targetLabel}.` : '';

  return { valid, errors, summary, items };
}

/**
 * Normalizes validated imported items into the expected internal schema for the game slot.
 */
export function normalizeImportedItems(rawItems, gameType, idPrefix = 'import') {
  return rawItems.map((item, index) => {
    const timestamp = Date.now();
    const itemId = item.id || `${idPrefix}-${timestamp}-${index + 1}`;

    switch (gameType) {
      case 'hangman': {
        const word = String(item.word || item.label || '').replace(/[^A-Za-z]/g, '').toUpperCase();
        const clue = String(item.clue || item.passage || '').trim();
        return {
          id: itemId,
          label: word,
          passage: clue,
          enabled: item.enabled !== false,
          issues: []
        };
      }

      case 'plagiarismPolice': {
        return {
          id: itemId,
          label: String(item.label || `Kasus ${index + 1}`).trim(),
          enabled: item.enabled !== false,
          difficulty: String(item.difficulty || 'Dasar').trim(),
          source: String(item.source || '').trim(),
          writerText: String(item.writerText || '').trim(),
          correctVerdict: item.correctVerdict || 'original',
          correctEvidenceTypes: Array.isArray(item.correctEvidenceTypes) ? item.correctEvidenceTypes : [],
          chunks: Array.isArray(item.chunks) ? item.chunks : [],
          correctChunkIds: Array.isArray(item.correctChunkIds) ? item.correctChunkIds : [],
          reasonOptions: Array.isArray(item.reasonOptions) ? item.reasonOptions : [],
          correctReasonIds: Array.isArray(item.correctReasonIds) ? item.correctReasonIds : [],
          report: String(item.report || '').trim()
        };
      }

      case 'headlineHook':
      case 'toneSwitcher':
      case 'logicalLeap': {
        return {
          ...item,
          id: itemId,
          enabled: item.enabled !== false,
          options: (Array.isArray(item.options) ? item.options : []).map((opt, optIdx) => ({
            ...opt,
            id: opt.id || `opt-${itemId}-${optIdx + 1}`
          }))
        };
      }

      case 'redPen':
      default: {
        return {
          id: itemId,
          label: String(item.label || item.title || `Draft ${index + 1}`).trim(),
          enabled: item.enabled !== false,
          passage: String(item.passage || item.text || '').trim(),
          issues: (Array.isArray(item.issues) ? item.issues : []).map((issue, issueIdx) => ({
            id: issue.id || `issue-${itemId}-${issueIdx + 1}`,
            phrase: String(issue.phrase || '').trim(),
            replacement: String(issue.replacement || '').trim(),
            explanation: String(issue.explanation || '').trim()
          }))
        };
      }
    }
  });
}
