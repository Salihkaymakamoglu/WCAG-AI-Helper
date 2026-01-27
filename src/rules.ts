export interface Rules {
  id: string;
  description: string;
  wcagRef: string;
}

export const RULES: Rules[] = [
  {
    id: 'R1_IMG_ALT',
    description: 'Images must have non-empty, meaningful alt text.',
    wcagRef: 'WCAG 2.2 - 1.1.1 Non-text Content'
  },
  {
    id: 'R2_LABEL',
    description: 'Form controls must have an accessible name (label or aria-label).',
    wcagRef: 'WCAG 2.2 - 3.3.2, 4.1.2'
  },
  {
    id: 'R3_BUTTON',
    description: 'Buttons must have visible text or an accessible name.',
    wcagRef: 'WCAG 2.2 - 4.1.2 Name, Role, Value'
  },
  {
    id: 'R4_LINK',
    description: 'Links should have descriptive text, not just “click here” or similar.',
    wcagRef: 'WCAG 2.2 - 2.4.4 Link Purpose'
  },
  {
    id: 'R5_H1',
    description: 'Each document should contain exactly one <h1> element.',
    wcagRef: 'WCAG 2.2 - 1.3.1 Info and Relationships'
  },
  {
    id: 'R6_TABINDEX',
    description: 'Avoid positive tabindex values; rely on natural focus order.',
    wcagRef: 'WCAG 2.2 - 2.4.3 Focus Order'
  },
  {
    id: 'R7_ROLE_BUTTON',
    description: 'Elements with role="button" must be keyboard operable.',
    wcagRef: 'WCAG 2.2 - 2.1.1 Keyboard'
  }
];