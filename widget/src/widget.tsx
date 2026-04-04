// Wa11y Accessibility Checklist Widget
// Figma Widget — uses figma.widget primitives (not React DOM)

const { widget } = figma;
const {
  AutoLayout,
  Text,
  Frame,
  Rectangle,
  SVG,
  useSyncedState,
  usePropertyMenu,
} = widget;

import {
  DESIGN_SECTIONS,
  CONTENT_SECTIONS,
  type ChecklistItem,
  type ChecklistSection,
  type Platform,
} from './data/checklist';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'design' | 'content';
type FilterPlatform = 'All' | 'Web' | 'iOS' | 'Android';

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 560;
const COLORS = {
  bg:            '#FFFFFF',
  bgSecondary:   '#F5F5F5',
  bgHover:       '#EFEFEF',
  border:        '#E5E7EB',
  text:          '#1C1C1E',
  textMuted:     '#6B7280',
  textLight:     '#9CA3AF',
  primary:       '#3B82F6',
  critical:      '#EF4444',
  criticalLight: '#FEE2E2',
  high:          '#F59E0B',
  highLight:     '#FEF3C7',
  success:       '#10B981',
  successLight:  '#ECFDF5',
  tabActive:     '#1C1C1E',
  tabInactive:   '#F3F4F6',
  sectionToggle: '#F3F4F6',
};

// ─── SVG assets ──────────────────────────────────────────────────────────────

const SVG_CHECK = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
  <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SVG_CHEVRON_DOWN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
  <path d="M3 4.5L6 7.5L9 4.5" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SVG_CHEVRON_RIGHT = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
  <path d="M4.5 3L7.5 6L4.5 9" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SVG_LINK = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
  <path d="M4.5 2H2.5C1.67 2 1 2.67 1 3.5V7.5C1 8.33 1.67 9 2.5 9H6.5C7.33 9 8 8.33 8 7.5V5.5M6 1H9M9 1V4M9 1L4.5 5.5" stroke="#3B82F6" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SVG_BADGE = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
  <circle cx="9" cy="9" r="8" fill="#EFF6FF"/>
  <path d="M6 9L8 11L12 7" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ─── Helper: item is visible for current platform filter ─────────────────────

function isItemVisible(item: ChecklistItem, platform: FilterPlatform): boolean {
  if (platform === 'All') return true;
  return item.platforms.includes('All') || item.platforms.includes(platform as Platform);
}

// ─── Helper: count checked vs total visible in a section ─────────────────────

function sectionProgress(
  section: ChecklistSection,
  checked: Record<string, boolean>,
  platform: FilterPlatform,
): { done: number; total: number } {
  const visible = section.items.filter((i) => isItemVisible(i, platform));
  return {
    done:  visible.filter((i) => checked[i.id]).length,
    total: visible.length,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Frame
      width={20}
      height={20}
      cornerRadius={5}
      fill={checked ? COLORS.primary : COLORS.bg}
      stroke={checked ? COLORS.primary : '#CBD5E1'}
      strokeWidth={1.5}
      onClick={onToggle}
    >
      {checked && (
        <SVG src={SVG_CHECK} width={12} height={12} x={4} y={4} />
      )}
    </Frame>
  );
}

function SeverityBadge({ severity }: { severity: 'Critical' | 'High' }) {
  const bg   = severity === 'Critical' ? COLORS.critical : COLORS.high;
  return (
    <AutoLayout
      padding={{ vertical: 3, horizontal: 8 }}
      cornerRadius={4}
      fill={bg}
      verticalAlignItems="center"
    >
      <Text fontSize={10} fontWeight={700} fill="#FFFFFF" lineHeight={14}>
        {severity}
      </Text>
    </AutoLayout>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <AutoLayout
      padding={{ vertical: 3, horizontal: 8 }}
      cornerRadius={4}
      fill={COLORS.bgSecondary}
      verticalAlignItems="center"
    >
      <Text fontSize={10} fill={COLORS.textMuted} lineHeight={14}>
        {platform}
      </Text>
    </AutoLayout>
  );
}

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const nonAllPlatforms = item.platforms.filter((p) => p !== 'All');

  return (
    <AutoLayout
      direction="horizontal"
      spacing={10}
      padding={{ vertical: 10, left: 0, right: 0 }}
      width={W - 48}
      verticalAlignItems="center"
    >
      <Checkbox checked={checked} onToggle={onToggle} />

      {/* Text + badges */}
      <AutoLayout
        direction="vertical"
        spacing={5}
        width="fill-parent"
      >
        <Text
          fontSize={13}
          fill={checked ? COLORS.textLight : COLORS.text}
          width="fill-parent"
          lineHeight={20}
          textDecoration={checked ? 'strikethrough' : 'none'}
        >
          {item.text}
          {item.link && (
            <Text fill={COLORS.primary}> ↗</Text>
          )}
        </Text>

        {/* Badges row */}
        {(item.severity || nonAllPlatforms.length > 0) && (
          <AutoLayout direction="horizontal" spacing={4}>
            {item.severity && <SeverityBadge severity={item.severity} />}
            {nonAllPlatforms.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </AutoLayout>
        )}
      </AutoLayout>

      {/* External link button */}
      {item.link && (
        <Frame
          width={22}
          height={22}
          cornerRadius={6}
          fill={COLORS.bgSecondary}
          onClick={() => figma.openExternal(item.link!.url)}
        >
          <SVG src={SVG_LINK} width={10} height={10} x={6} y={6} />
        </Frame>
      )}
    </AutoLayout>
  );
}

function SectionBlock({
  section,
  checked,
  onToggleItem,
  platform,
  isCollapsed,
  onToggleCollapse,
}: {
  section: ChecklistSection;
  checked: Record<string, boolean>;
  onToggleItem: (id: string) => void;
  platform: FilterPlatform;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const visibleItems = section.items.filter((i) => isItemVisible(i, platform));
  if (visibleItems.length === 0) return null;

  const { done, total } = sectionProgress(section, checked, platform);
  const allDone = done === total && total > 0;

  return (
    <AutoLayout
      direction="vertical"
      spacing={0}
      width={W - 48}
    >
      {/* Section header */}
      <AutoLayout
        direction="horizontal"
        spacing={8}
        padding={{ vertical: 12, horizontal: 0 }}
        width="fill-parent"
        verticalAlignItems="center"
        onClick={onToggleCollapse}
      >
        <SVG
          src={isCollapsed ? SVG_CHEVRON_RIGHT : SVG_CHEVRON_DOWN}
          width={12}
          height={12}
        />
        <Text
          fontSize={13}
          fontWeight={700}
          fill={allDone ? COLORS.success : COLORS.text}
          width="fill-parent"
          lineHeight={20}
        >
          {section.title}
        </Text>
        <Text fontSize={11} fill={COLORS.textMuted} lineHeight={20}>
          {done}/{total}
        </Text>
      </AutoLayout>

      {/* Divider */}
      <Rectangle width="fill-parent" height={1} fill={COLORS.border} />

      {/* Items */}
      {!isCollapsed && (
        <AutoLayout
          direction="vertical"
          spacing={0}
          width="fill-parent"
          padding={{ left: 0 }}
        >
          {visibleItems.map((item, idx) => (
            <AutoLayout
              key={item.id}
              direction="vertical"
              width="fill-parent"
              spacing={0}
            >
              <ItemRow
                item={item}
                checked={!!checked[item.id]}
                onToggle={() => onToggleItem(item.id)}
              />
              {idx < visibleItems.length - 1 && (
                <Rectangle width="fill-parent" height={1} fill="#F3F4F6" />
              )}
            </AutoLayout>
          ))}
        </AutoLayout>
      )}
    </AutoLayout>
  );
}

// ─── Optional section toggle ─────────────────────────────────────────────────

function OptionalSectionToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <AutoLayout
      direction="horizontal"
      spacing={8}
      padding={{ vertical: 7, horizontal: 12 }}
      cornerRadius={8}
      fill={enabled ? '#EFF6FF' : COLORS.bgSecondary}
      stroke={COLORS.primary}
      strokeWidth={enabled ? 1 : 0}
      verticalAlignItems="center"
      onClick={onToggle}
    >
      <Frame
        width={16}
        height={16}
        cornerRadius={4}
        fill={enabled ? COLORS.primary : COLORS.border}
      >
        {enabled && <SVG src={SVG_CHECK} width={10} height={10} x={3} y={3} />}
      </Frame>
      <Text fontSize={12} fill={enabled ? COLORS.primary : COLORS.textMuted} fontWeight={enabled ? 700 : 400}>
        {label}
      </Text>
    </AutoLayout>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

function Wa11yChecklist() {
  // Persistent state synced across all collaborators
  const [tab,               setTab]               = useSyncedState<Tab>('tab', 'design');
  const [platform,          setPlatform]          = useSyncedState<FilterPlatform>('platform', 'All');
  const [checked,           setChecked]           = useSyncedState<Record<string, boolean>>('checked', {});
  const [collapsed,         setCollapsed]         = useSyncedState<Record<string, boolean>>('collapsed', {});
  const [optionalSections,  setOptionalSections]  = useSyncedState<Record<string, boolean>>('optional', {
    showMedia:      false,
    showMotion:     false,
    showTypography: false,
    showForms:      false,
  });
  const [signedOff,         setSignedOff]         = useSyncedState<boolean>('signedOff', false);
  const [signedOffBy,       setSignedOffBy]       = useSyncedState<string>('signedOffBy', '');

  // Property menu: reset action
  usePropertyMenu(
    [
      { itemType: 'action', propertyName: 'reset', tooltip: 'Reset checklist' },
      { itemType: 'separator' },
      { itemType: 'action', propertyName: 'signoff', tooltip: signedOff ? 'Remove sign-off' : 'Sign off checklist' },
    ],
    ({ propertyName }) => {
      if (propertyName === 'reset') {
        setChecked({});
        setSignedOff(false);
        setSignedOffBy('');
      }
      if (propertyName === 'signoff') {
        if (signedOff) {
          setSignedOff(false);
          setSignedOffBy('');
        } else {
          setSignedOff(true);
          setSignedOffBy(figma.currentUser?.name ?? 'Designer');
        }
      }
    },
  );

  const toggleItem = (id: string) => {
    setChecked({ ...checked, [id]: !checked[id] });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed({ ...collapsed, [id]: !collapsed[id] });
  };

  const toggleOptional = (key: string) => {
    setOptionalSections({ ...optionalSections, [key]: !optionalSections[key] });
  };

  // Overall progress
  const allSections = tab === 'design' ? DESIGN_SECTIONS : CONTENT_SECTIONS;
  const activeSections = allSections.filter(
    (s) => !s.optional || (s.toggleKey && optionalSections[s.toggleKey]),
  );
  const totalItems  = activeSections.flatMap((s) => s.items).filter((i) => isItemVisible(i, platform)).length;
  const checkedCount = activeSections.flatMap((s) => s.items).filter(
    (i) => isItemVisible(i, platform) && checked[i.id],
  ).length;
  const progressPct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Optional sections for Design tab
  const optionalMeta = [
    { key: 'showMedia',      label: 'Multimedia & Video' },
    { key: 'showMotion',     label: 'Animations & Motion' },
    { key: 'showTypography', label: 'Text & Typography' },
    { key: 'showForms',      label: 'Forms' },
  ];

  return (
    <AutoLayout
      direction="vertical"
      spacing={0}
      padding={24}
      cornerRadius={16}
      fill={COLORS.bg}
      stroke={COLORS.border}
      strokeWidth={1}
      width={W}
      effect={[
        {
          type: 'drop-shadow',
          color: { r: 0, g: 0, b: 0, a: 0.08 },
          offset: { x: 0, y: 4 },
          blur: 16,
          spread: 0,
        },
      ]}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <AutoLayout
        direction="horizontal"
        spacing={10}
        width="fill-parent"
        verticalAlignItems="center"
        padding={{ bottom: 16 }}
      >
        {/* Icon */}
        <Frame
          width={32}
          height={32}
          cornerRadius={8}
          fill={COLORS.text}
        >
          <Text fontSize={16} fill="#FFFFFF" x={7} y={6}>♿</Text>
        </Frame>

        <AutoLayout direction="vertical" spacing={2} width="fill-parent">
          <Text fontSize={17} fontWeight={700} fill={COLORS.text}>
            Wa11y Accessibility Checklist
          </Text>
          {signedOff && (
            <AutoLayout direction="horizontal" spacing={4} verticalAlignItems="center">
              <SVG src={SVG_BADGE} width={18} height={18} />
              <Text fontSize={11} fill={COLORS.success}>
                Signed off by {signedOffBy}
              </Text>
            </AutoLayout>
          )}
        </AutoLayout>
      </AutoLayout>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      <AutoLayout direction="vertical" spacing={6} width="fill-parent" padding={{ bottom: 16 }}>
        <AutoLayout direction="horizontal" width="fill-parent" verticalAlignItems="center" spacing={8}>
          <Text fontSize={12} fill={COLORS.textMuted} width="fill-parent">
            {checkedCount} of {totalItems} complete
          </Text>
          <Text fontSize={12} fontWeight={700} fill={progressPct === 100 ? COLORS.success : COLORS.primary}>
            {progressPct}%
          </Text>
        </AutoLayout>
        {/* Track */}
        <Frame width={W - 48} height={6} cornerRadius={3} fill="#E5E7EB">
          {/* Fill */}
          {progressPct > 0 && (
            <Frame
              width={Math.max(6, Math.round((W - 48) * progressPct / 100))}
              height={6}
              cornerRadius={3}
              fill={progressPct === 100 ? COLORS.success : COLORS.primary}
              x={0}
              y={0}
            />
          )}
        </Frame>
      </AutoLayout>

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <AutoLayout
        direction="horizontal"
        spacing={4}
        padding={4}
        cornerRadius={10}
        fill={COLORS.bgSecondary}
        width="fill-parent"
      >
        {(['design', 'content'] as Tab[]).map((t) => (
          <AutoLayout
            key={t}
            padding={{ vertical: 7, horizontal: 16 }}
            cornerRadius={7}
            fill={tab === t ? COLORS.tabActive : 'transparent'}
            width="fill-parent"
            horizontalAlignItems="center"
            onClick={() => setTab(t)}
          >
            <Text
              fontSize={13}
              fontWeight={tab === t ? 700 : 400}
              fill={tab === t ? '#FFFFFF' : COLORS.textMuted}
            >
              {t === 'design' ? 'Design' : 'Content'}
            </Text>
          </AutoLayout>
        ))}
      </AutoLayout>

      {/* ── Platform filter (Design tab only) ──────────────────────── */}
      {tab === 'design' && (
        <AutoLayout
          direction="horizontal"
          spacing={4}
          padding={{ top: 16, bottom: 4 }}
          width="fill-parent"
          verticalAlignItems="center"
        >
          <Text fontSize={11} fill={COLORS.textMuted} width={64}>Platform:</Text>
          {(['All', 'Web', 'iOS', 'Android'] as FilterPlatform[]).map((p) => (
            <AutoLayout
              key={p}
              padding={{ vertical: 5, horizontal: 12 }}
              cornerRadius={6}
              fill={platform === p ? COLORS.text : COLORS.bgSecondary}
              onClick={() => setPlatform(p)}
            >
              <Text
                fontSize={11}
                fontWeight={platform === p ? 700 : 400}
                fill={platform === p ? '#FFFFFF' : COLORS.textMuted}
              >
                {p}
              </Text>
            </AutoLayout>
          ))}
        </AutoLayout>
      )}

      {/* ── Optional sections toggles (Design tab) ─────────────────── */}
      {tab === 'design' && (
        <AutoLayout
          direction="vertical"
          spacing={6}
          width="fill-parent"
          padding={{ top: 16, bottom: 8 }}
        >
          <Text fontSize={11} fill={COLORS.textMuted}>Optional sections:</Text>
          <AutoLayout direction="horizontal" spacing={6} width="fill-parent">
            {optionalMeta.map((om) => (
              <OptionalSectionToggle
                key={om.key}
                label={om.label}
                enabled={!!optionalSections[om.key]}
                onToggle={() => toggleOptional(om.key)}
              />
            ))}
          </AutoLayout>
        </AutoLayout>
      )}

      {/* ── Divider ────────────────────────────────────────────────── */}
      <Rectangle width="fill-parent" height={1} fill={COLORS.border} />

      {/* ── Sections ───────────────────────────────────────────────── */}
      <AutoLayout
        direction="vertical"
        spacing={0}
        width="fill-parent"
        padding={{ top: 8 }}
      >
        {allSections
          .filter((s) => !s.optional || (s.toggleKey && optionalSections[s.toggleKey]))
          .map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              checked={checked}
              onToggleItem={toggleItem}
              platform={platform}
              isCollapsed={!!collapsed[section.id]}
              onToggleCollapse={() => toggleCollapse(section.id)}
            />
          ))}
      </AutoLayout>

      {/* ── Sign-off banner ────────────────────────────────────────── */}
      {progressPct === 100 && !signedOff && (
        <AutoLayout
          direction="horizontal"
          spacing={10}
          padding={14}
          cornerRadius={10}
          fill={COLORS.successLight}
          stroke="#A7F3D0"
          strokeWidth={1}
          width="fill-parent"
          verticalAlignItems="center"
          onClick={() => {
            setSignedOff(true);
            setSignedOffBy(figma.currentUser?.name ?? 'Designer');
          }}
        >
          <Text fontSize={18}>✓</Text>
          <AutoLayout direction="vertical" spacing={2} width="fill-parent">
            <Text fontSize={13} fontWeight={700} fill="#065F46">
              All done — sign off?
            </Text>
            <Text fontSize={11} fill="#047857">
              Tap to mark this checklist as reviewed
            </Text>
          </AutoLayout>
        </AutoLayout>
      )}

      {signedOff && (
        <AutoLayout
          direction="horizontal"
          spacing={10}
          padding={14}
          cornerRadius={10}
          fill={COLORS.successLight}
          stroke="#A7F3D0"
          strokeWidth={1}
          width="fill-parent"
          verticalAlignItems="center"
        >
          <SVG src={SVG_BADGE} width={24} height={24} />
          <AutoLayout direction="vertical" spacing={2} width="fill-parent">
            <Text fontSize={13} fontWeight={700} fill="#065F46">
              Checklist signed off
            </Text>
            <Text fontSize={11} fill="#047857">
              Reviewed by {signedOffBy}
            </Text>
          </AutoLayout>
        </AutoLayout>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <AutoLayout
        padding={{ top: 16 }}
        width="fill-parent"
        horizontalAlignItems="center"
      >
        <Text fontSize={11} fill={COLORS.textLight}>
          Missing heuristics? Share feedback with your team.
        </Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(Wa11yChecklist);
