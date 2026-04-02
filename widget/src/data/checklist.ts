export type Severity = 'Critical' | 'High';
export type Platform = 'All' | 'Web' | 'iOS' | 'Android';

export interface ChecklistItem {
  id: string;
  text: string;
  severity?: Severity;
  platforms: Platform[];
  link?: { label: string; url: string };
}

export interface ChecklistSection {
  id: string;
  title: string;
  optional: boolean;
  toggleKey?: string;
  items: ChecklistItem[];
}

export const DESIGN_SECTIONS: ChecklistSection[] = [
  {
    id: 'plugin-audit',
    title: 'Plugin audit and annotations',
    optional: false,
    items: [
      {
        id: 'plugin-1',
        text: 'Stark (or similar plugin) checks don\'t flag any violations',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'plugin-2',
        text: 'Annotate alt attributes on every image element',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'plugin-3',
        text: 'Annotate focus order (keyboard navigation)',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'plugin-4',
        text: 'Annotate specific semantics/ARIA if custom elements used',
        severity: 'Critical',
        platforms: ['Web'],
      },
      {
        id: 'plugin-5',
        text: 'Annotate present landmarks (header, nav, main, footer, etc.)',
        severity: 'Critical',
        platforms: ['Web'],
      },
      {
        id: 'plugin-6',
        text: 'Specify input roles via "Accessibility notes"',
        severity: 'Critical',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'color-contrast',
    title: 'Color & Contrast',
    optional: false,
    items: [
      {
        id: 'color-1',
        text: 'Color is not the only way information is conveyed',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'links-buttons',
    title: 'Links & Buttons',
    optional: false,
    items: [
      {
        id: 'links-1',
        text: 'Descriptive link/button texts (no "click here")',
        platforms: ['All'],
      },
      {
        id: 'links-2',
        text: 'Links are distinguishable (underline or another cue, not color-only)',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'keyboard-focus',
    title: 'Keyboard & Focus',
    optional: false,
    items: [
      {
        id: 'keyboard-1',
        text: 'All elements can be used with keyboard only (Tab, Enter, Space, Esc)',
        platforms: ['All'],
      },
      {
        id: 'keyboard-2',
        text: 'Logical tab/focus order matches the visual layout',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'multimedia',
    title: 'Multimedia, Video & Audio',
    optional: true,
    toggleKey: 'showMedia',
    items: [
      {
        id: 'media-1',
        text: 'All videos with audio have accurate captions',
        severity: 'High',
        platforms: ['All'],
      },
      {
        id: 'media-2',
        text: 'All audio-only content has a text transcript',
        severity: 'High',
        platforms: ['All'],
      },
      {
        id: 'media-3',
        text: 'Videos with meaningful visuals have an audio description or descriptive transcript',
        severity: 'High',
        platforms: ['All'],
      },
      {
        id: 'media-4',
        text: 'No content is auto-played',
        severity: 'Critical',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'animations',
    title: 'Animations & Motion',
    optional: true,
    toggleKey: 'showMotion',
    items: [
      {
        id: 'motion-1',
        text: 'Users can pause, stop, or hide all animations/carousels/background videos, unless they stop after 5s or less',
        severity: 'High',
        platforms: ['All'],
      },
      {
        id: 'motion-2',
        text: 'No content flashes more than 3 times per second or with saturated colors',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'motion-3',
        text: 'All content is viewable with enough time, without unskippable timeouts',
        severity: 'High',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'typography',
    title: 'Text & Typography',
    optional: true,
    toggleKey: 'showTypography',
    items: [
      {
        id: 'typo-1',
        text: 'Legible, sans-serif fonts used',
        severity: 'High',
        platforms: ['All'],
      },
      {
        id: 'typo-2',
        text: 'No long blocks in all-caps or italics',
        platforms: ['All'],
      },
      {
        id: 'typo-3',
        text: 'No text is embedded into images that cause scaling issues',
        platforms: ['All'],
      },
    ],
  },
  {
    id: 'forms',
    title: 'Forms',
    optional: true,
    toggleKey: 'showForms',
    items: [
      {
        id: 'forms-1',
        text: 'All fields have visible, properly associated labels',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'forms-2',
        text: 'Error messages are specific and accessible (screen reader-friendly)',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'forms-3',
        text: 'Required fields indicated visually and in HTML',
        severity: 'Critical',
        platforms: ['All'],
      },
      {
        id: 'forms-4',
        text: 'Use of autocomplete attribute for personal data fields',
        platforms: ['All'],
      },
      {
        id: 'forms-5',
        text: 'Logical grouping and spacing of fields (fieldsets/legends as needed)',
        platforms: ['All'],
      },
    ],
  },
];

export const CONTENT_SECTIONS: ChecklistSection[] = [
  {
    id: 'content-accessibility',
    title: 'Accessibility & Inclusivity for Content',
    optional: false,
    items: [
      {
        id: 'content-1',
        text: 'Follow WCAG (Web Content Accessibility Guidelines)',
        platforms: ['All'],
      },
      {
        id: 'content-2',
        text: 'Write in non-gendered form',
        platforms: ['All'],
      },
      {
        id: 'content-3',
        text: 'Use alt text for images & icons when they are not decorative. Annotate in layers as well.',
        platforms: ['All'],
      },
      {
        id: 'content-4',
        text: 'Check decision tree',
        platforms: ['All'],
        link: {
          label: 'decision tree',
          url: 'https://www.figma.com/design/PtPpQSLO8rAjzS8fCNmCOM/Handoff-toolkit?node-id=3802-1516&t=8MzJqJggyZtykAU1-11',
        },
      },
      {
        id: 'content-5',
        text: 'Use short, common words = Write in plain language',
        platforms: ['All'],
      },
      {
        id: 'content-6',
        text: "Don't use special characters like @ * to represent inclusive write",
        platforms: ['All'],
      },
      {
        id: 'content-7',
        text: "Don't use middle dot. Screen readers might misinterpret them.",
        platforms: ['All'],
      },
      {
        id: 'content-8',
        text: 'Annotate verbose actions when required for voice over hints',
        platforms: ['All'],
        link: {
          label: 'voice over hints',
          url: 'https://support.apple.com/en-gb/guide/voiceover/cpvouverbhint/mac',
        },
      },
    ],
  },
  {
    id: 'localization',
    title: 'Accessibility & Inclusivity for Localization',
    optional: false,
    items: [
      {
        id: 'loc-1',
        text: 'Did I check the length? Count +30% increase from base language English',
        platforms: ['All'],
      },
      {
        id: 'loc-2',
        text: 'Polysemy - check glossary',
        platforms: ['All'],
      },
      {
        id: 'loc-3',
        text: "Cultural context - ensure this can't be misinterpreted",
        platforms: ['All'],
      },
    ],
  },
];
