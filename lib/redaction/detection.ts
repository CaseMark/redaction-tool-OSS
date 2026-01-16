import type { EntityType, DetectedEntity, DetectionMethod } from '@/types/redaction';
import { PII_PATTERNS, generateMaskedValue } from './patterns';

// Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Words commonly found in category labels/field names (not actual PII)
const LABEL_WORDS = new Set([
  // Field type indicators
  'number', 'no', 'num', '#',
  'name', 'names',
  'address', 'addr',
  'date', 'dob',
  'phone', 'tel', 'telephone', 'fax', 'mobile', 'cell',
  'email', 'e-mail', 'mail',
  'id', 'identification',
  'ssn', 'ein', 'tin',
  'account', 'acct', 'routing', 'aba', 'swift', 'iban',
  'card', 'credit', 'debit',
  'license', 'passport', 'visa',
  // Common prefixes for labels
  'home', 'work', 'office', 'business', 'personal', 'primary', 'secondary', 'alternate', 'alt',
  'billing', 'shipping', 'mailing', 'physical', 'legal', 'permanent', 'temporary',
  'first', 'last', 'middle', 'full', 'maiden', 'former', 'preferred', 'nick',
  'client', 'customer', 'patient', 'employee', 'employer', 'company', 'organization',
  'plaintiff', 'defendant', 'petitioner', 'respondent', 'applicant', 'beneficiary',
  'mother', 'father', 'spouse', 'emergency', 'contact', 'guardian', 'parent',
  'birth', 'expiration', 'issue', 'effective', 'start', 'end',
  'matter', 'case', 'file', 'reference', 'ref', 'docket', 'claim', 'policy',
  'driver', 'drivers', "driver's",
  'social', 'security',
  'street', 'city', 'state', 'zip', 'postal', 'country', 'county',
  // Financial category labels (NOT values)
  'estimated', 'net', 'worth', 'gross', 'annual', 'monthly', 'weekly', 'daily', 'yearly',
  'income', 'expenses', 'expense', 'salary', 'wages', 'earnings', 'revenue',
  'assets', 'asset', 'liabilities', 'liability', 'debts', 'debt',
  'balance', 'total', 'subtotal', 'amount', 'sum', 'value',
  'mortgage', 'loan', 'payment', 'payments', 'rent', 'utilities',
  'investment', 'investments', 'savings', 'checking', 'retirement',
  'outstanding', 'remaining', 'current', 'previous', 'average',
  'bank', 'accounts', 'financial', 'statement', 'summary',
]);

// Check if text looks like a category label (not actual PII data)
// This catches things like "Matter Number", "Home Phone", "Credit Card", etc.
function isCategoryLabel(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[:\-–—]/g, '');
  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return false;

  // If ALL words in the text are label words, it's a category label
  const allWordsAreLabels = words.every(word => LABEL_WORDS.has(word));
  if (allWordsAreLabels) return true;

  // Check for common two-word label patterns
  if (words.length === 2) {
    const [first, second] = words;
    // Patterns like "Home Phone", "Work Address", "First Name", etc.
    if (LABEL_WORDS.has(first) && LABEL_WORDS.has(second)) return true;
  }

  // Check for three-word patterns like "Social Security Number"
  if (words.length === 3) {
    if (words.every(w => LABEL_WORDS.has(w))) return true;
  }

  return false;
}

// Memory limit for regex detection
const MAX_REGEX_ENTITIES = 200;

// Skip context during detection to save memory - computed lazily later
function extractContext(): string {
  return ''; // Context computed lazily after detection
}

// Detect PII using regex patterns
export function detectWithRegex(
  text: string,
  entityTypes: EntityType[]
): DetectedEntity[] {
  const entities: DetectedEntity[] = [];

  for (const type of entityTypes) {
    // Stop if we hit entity limit
    if (entities.length >= MAX_REGEX_ENTITIES) break;

    if (type === 'custom') continue; // Skip custom type for regex detection

    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Stop if we hit entity limit
      if (entities.length >= MAX_REGEX_ENTITIES) break;

      const value = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + value.length;

      // Skip if this is a category label (e.g., "Matter Number", "Account Number")
      if (isCategoryLabel(value)) continue;

      // Validate the match (additional checks based on type)
      if (!validateMatch(type, value)) continue;

      entities.push({
        id: generateId(),
        type,
        value,
        maskedValue: generateMaskedValue(type, value),
        confidence: calculateRegexConfidence(type, value),
        method: 'regex',
        startIndex,
        endIndex,
        context: extractContext(),
        shouldRedact: true,
      });
    }
  }

  return entities;
}

// Validate matches based on entity type
function validateMatch(type: EntityType, value: string): boolean {
  switch (type) {
    case 'ssn': {
      // Validate SSN structure
      const digits = value.replace(/[-\s]/g, '');
      if (digits.length !== 9) return false;
      // Check for invalid SSN patterns
      if (digits.startsWith('000') || digits.startsWith('666')) return false;
      if (digits.substring(0, 3) >= '900') return false;
      return true;
    }
    case 'credit_card': {
      // Luhn algorithm validation
      const digits = value.replace(/[-\s]/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      return luhnCheck(digits);
    }
    case 'phone': {
      // Validate phone number length
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    }
    case 'email': {
      // Basic email validation
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
    case 'financial_amount': {
      // Validate financial amounts - must have a $ or meaningful number
      const normalized = value.replace(/[\s,]/g, '');
      // Must contain digits
      if (!/\d/.test(normalized)) return false;
      // If it has a $ sign, it's valid
      if (normalized.includes('$')) return true;
      // Otherwise, must be a substantial number (at least 3 digits or has decimal)
      const digits = normalized.replace(/[^\d.]/g, '');
      const numValue = parseFloat(digits);
      // Skip very small numbers that are likely not financial (like "1", "2")
      if (numValue < 100 && !normalized.includes('.')) return false;
      return true;
    }
    default:
      return true;
  }
}

// Luhn algorithm for credit card validation
function luhnCheck(digits: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Calculate confidence score for regex matches
function calculateRegexConfidence(type: EntityType, value: string): number {
  // Base confidence for regex matches
  let confidence = 0.85;

  switch (type) {
    case 'ssn':
      // Higher confidence for properly formatted SSN
      if (/^\d{3}-\d{2}-\d{4}$/.test(value)) confidence = 0.95;
      break;
    case 'credit_card':
      // Higher confidence for valid card numbers
      confidence = 0.90;
      break;
    case 'email':
      // Higher confidence for well-formed emails
      if (value.includes('.') && value.includes('@')) confidence = 0.92;
      break;
    case 'phone':
      // Higher confidence for formatted phone numbers
      if (/\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/.test(value)) confidence = 0.90;
      break;
    case 'name':
      // Names are less certain with regex
      confidence = 0.70;
      break;
    case 'address':
      // Addresses with complete structure
      confidence = 0.75;
      break;
    case 'financial_amount':
      // Higher confidence for properly formatted amounts with $
      if (/^\$[\d,]+(?:\.\d{2})?$/.test(value)) confidence = 0.92;
      // Good confidence for amounts with commas indicating thousands
      else if (/\d{1,3}(?:,\d{3})+/.test(value)) confidence = 0.88;
      else confidence = 0.75;
      break;
  }

  return confidence;
}

// Merge detection results, removing duplicates
export function mergeDetectionResults(
  ...resultSets: DetectedEntity[][]
): DetectedEntity[] {
  const merged: DetectedEntity[] = [];
  const seen = new Map<string, DetectedEntity>();

  for (const results of resultSets) {
    for (const entity of results) {
      // Create a key based on position and value
      const key = `${entity.startIndex}-${entity.endIndex}-${entity.value}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, entity);
        merged.push(entity);
      } else if (entity.confidence > existing.confidence) {
        // Replace with higher confidence detection
        const index = merged.indexOf(existing);
        if (index !== -1) {
          merged[index] = entity;
          seen.set(key, entity);
        }
      }
    }
  }

  // Sort by position in text
  return merged.sort((a, b) => a.startIndex - b.startIndex);
}

// Apply redactions to text
export function applyRedactions(text: string, entities: DetectedEntity[]): string {
  // Sort entities by position in reverse order to maintain indices
  const sortedEntities = [...entities]
    .filter(e => e.shouldRedact)
    .sort((a, b) => b.startIndex - a.startIndex);

  let redactedText = text;

  for (const entity of sortedEntities) {
    redactedText =
      redactedText.slice(0, entity.startIndex) +
      entity.maskedValue +
      redactedText.slice(entity.endIndex);
  }

  return redactedText;
}

// Create audit log from detection results
// IMPORTANT: Does NOT include original values to prevent metadata leakage
export function createAuditLog(
  documentName: string,
  entities: DetectedEntity[]
): {
  documentName: string;
  processedAt: string;
  totalEntities: number;
  redactedEntities: number;
  entityBreakdown: Record<string, number>;
  entries: Array<{
    timestamp: string;
    action: string;
    entityType: EntityType;
    position: { start: number; end: number };
    characterCount: number;
    detectionMethod: string;
  }>;
} {
  const entityBreakdown: Record<string, number> = {};
  const entries = [];

  for (const entity of entities) {
    // Count by type
    entityBreakdown[entity.type] = (entityBreakdown[entity.type] || 0) + 1;

    // Create entry WITHOUT original value - only metadata
    entries.push({
      timestamp: new Date().toISOString(),
      action: entity.shouldRedact ? 'redacted' : 'identified',
      entityType: entity.type,
      position: { start: entity.startIndex, end: entity.endIndex },
      characterCount: entity.value.length,
      detectionMethod: entity.method,
    });
  }

  return {
    documentName,
    processedAt: new Date().toISOString(),
    totalEntities: entities.length,
    redactedEntities: entities.filter(e => e.shouldRedact).length,
    entityBreakdown,
    entries,
  };
}
