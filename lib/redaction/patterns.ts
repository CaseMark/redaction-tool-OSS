import type { EntityType, EntityConfig, RedactionPreset } from '@/types/redaction';

// Regex patterns for different PII types
export const PII_PATTERNS: Record<EntityType, RegExp> = {
  ssn: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
  account_number: /\b(?:\d{4}[-\s]?){2,4}\d{0,4}\b/g,
  credit_card: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  name: /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
  address: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s*)+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\s*(?:#?\s*\d+[A-Za-z]?)?\b/gi,
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  date_of_birth: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)?\d{2}\b/g,
  custom: /(?:)/g, // Empty pattern for custom - handled separately
};

// Entity configuration with labels and descriptions
export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  ssn: {
    type: 'ssn',
    label: 'Social Security Numbers',
    description: 'US Social Security Numbers (XXX-XX-XXXX)',
    pattern: PII_PATTERNS.ssn,
    examples: ['123-45-6789', '123 45 6789'],
  },
  account_number: {
    type: 'account_number',
    label: 'Account Numbers',
    description: 'Bank account and financial account numbers',
    pattern: PII_PATTERNS.account_number,
    examples: ['1234-5678-9012', '1234567890123456'],
  },
  credit_card: {
    type: 'credit_card',
    label: 'Credit Card Numbers',
    description: 'Visa, Mastercard, Amex, and Discover card numbers',
    pattern: PII_PATTERNS.credit_card,
    examples: ['4111111111111111', '5500000000000004'],
  },
  name: {
    type: 'name',
    label: 'Personal Names',
    description: 'Full names with first and last name',
    pattern: PII_PATTERNS.name,
    examples: ['John Smith', 'Jane Doe'],
  },
  address: {
    type: 'address',
    label: 'Addresses',
    description: 'Street addresses with numbers and street types',
    pattern: PII_PATTERNS.address,
    examples: ['123 Main Street', '456 Oak Ave #5'],
  },
  phone: {
    type: 'phone',
    label: 'Phone Numbers',
    description: 'US phone numbers in various formats',
    pattern: PII_PATTERNS.phone,
    examples: ['(555) 123-4567', '555-123-4567'],
  },
  email: {
    type: 'email',
    label: 'Email Addresses',
    description: 'Email addresses in standard format',
    pattern: PII_PATTERNS.email,
    examples: ['john@example.com', 'jane.doe@company.org'],
  },
  date_of_birth: {
    type: 'date_of_birth',
    label: 'Dates of Birth',
    description: 'Birth dates in MM/DD/YYYY or similar formats',
    pattern: PII_PATTERNS.date_of_birth,
    examples: ['01/15/1990', '12-25-1985'],
  },
  custom: {
    type: 'custom',
    label: 'Custom Pattern',
    description: 'User-defined custom redaction patterns',
    examples: [],
  },
};

// Predefined redaction presets
export const REDACTION_PRESETS: RedactionPreset[] = [
  {
    id: 'financial',
    label: 'Financial Information',
    description: 'Redact all financial identifiers and account numbers',
    entityTypes: ['ssn', 'account_number', 'credit_card'],
  },
  {
    id: 'personal',
    label: 'Personal Identity',
    description: 'Redact personal identifiers like names and contact info',
    entityTypes: ['name', 'phone', 'email', 'address', 'date_of_birth'],
  },
  {
    id: 'all-pii',
    label: 'All PII',
    description: 'Comprehensive redaction of all personally identifiable information',
    entityTypes: ['ssn', 'account_number', 'credit_card', 'name', 'address', 'phone', 'email', 'date_of_birth'],
  },
  {
    id: 'hipaa',
    label: 'HIPAA Compliance',
    description: 'Redact PHI as required by HIPAA Safe Harbor',
    entityTypes: ['name', 'address', 'phone', 'email', 'date_of_birth', 'ssn'],
  },
  {
    id: 'minimal',
    label: 'Minimal (SSN Only)',
    description: 'Only redact Social Security Numbers',
    entityTypes: ['ssn'],
  },
];

// Semantic search queries for vault-enhanced detection
export const PII_SEMANTIC_QUERIES: Record<EntityType, string[]> = {
  ssn: [
    'social security number',
    'SSN',
    'social security',
    'tax identification number',
  ],
  account_number: [
    'bank account number',
    'account number',
    'routing number',
    'checking account',
    'savings account',
  ],
  credit_card: [
    'credit card number',
    'card number',
    'payment card',
    'debit card number',
  ],
  name: [
    'full name',
    'legal name',
    'person name',
    'client name',
    'party name',
  ],
  address: [
    'home address',
    'mailing address',
    'residential address',
    'street address',
  ],
  phone: [
    'phone number',
    'telephone number',
    'mobile number',
    'contact number',
  ],
  email: [
    'email address',
    'electronic mail',
    'e-mail',
  ],
  date_of_birth: [
    'date of birth',
    'birth date',
    'DOB',
    'birthday',
  ],
  custom: [],
};

// Generate masked value based on entity type
// Uses asterisks matching the length of the original value
export function generateMaskedValue(type: EntityType, originalValue: string): string {
  return '*'.repeat(originalValue.length);
}

// Get entity type label
export function getEntityTypeLabel(type: EntityType): string {
  return ENTITY_CONFIG[type]?.label || type;
}

// Validate entity type
export function isValidEntityType(type: string): type is EntityType {
  return type in ENTITY_CONFIG;
}
