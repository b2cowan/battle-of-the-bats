import { SECURITY_DIAGRAM_ALT, SECURITY_DIAGRAM_CAPTION, type SecurityDiagramKey } from '@/lib/security-page-words';
import styles from './SecurityPage.module.css';

/**
 * "WHERE YOUR INFORMATION LIVES" — the checked diagram, as inline SVG in real text at true size (Security page S2 ruling 2,
 * 2026-11-21). Two forms, both copied coordinate for coordinate from the drawing's `diagD()` / `diagP()`
 * (`docs/projects/active/BOARD_READY_SECURITY_PAGE_DRAWINGS.html`): never re-laid out here. The desktop form (680 × 492) shows from
 * 768px up and in print; the phone form (310 × 966) below 768px. The hidden one is `display: none`, so only one is ever in the
 * accessibility tree, and each carries the brief's accessible description word for word.
 *
 * Every label is a line of `SECURITY_DIAGRAM_LABELS` (review rows 1–10) broken differently; `tests/unit/security-page.test.ts`
 * joins each `<g data-k>` group back up and holds it to those words. Inks are `--home-*` tokens only, arrowheads included.
 */

type Cls = 'h' | 'm' | 'l';
type Anchor = 'middle' | 'start' | 'end';
/** One line of text: x, y, class (h = a box's name, m = its detail, l = a line's label), the words, the anchor (middle). */
type Line = [x: number, y: number, cls: Cls, text: string, anchor?: Anchor];
type Group = { k: SecurityDiagramKey; lines: Line[] };
type Shape =
  | { rect: [x: number, y: number, w: number, h: number]; core?: boolean }
  | { path: string; dash?: boolean; arrow?: boolean };

interface Form { id: 'desktop' | 'phone'; w: number; h: number; shapes: Shape[]; groups: Group[] }

const DESKTOP: Form = {
  id: 'desktop', w: 680, h: 492,
  shapes: [
    { path: 'M90,62 C90,14 590,14 590,60', dash: true, arrow: true },
    { rect: [1, 64, 178, 110] },
    { rect: [252, 64, 176, 110], core: true },
    { rect: [501, 64, 178, 110] },
    { path: 'M182,119 L249,119', arrow: true },
    { path: 'M431,119 L498,119', arrow: true },
    { path: 'M340,252 L106,361', arrow: true },
    { path: 'M340,252 L340,361', arrow: true },
    { path: 'M340,252 L574,361', arrow: true },
    { rect: [1, 364, 209, 124] },
    { rect: [235, 364, 210, 124] },
    { rect: [470, 364, 209, 124] },
  ],
  groups: [
    { k: 'direct', lines: [[340, 16, 'l', 'sign-in and live score updates']] },
    { k: 'people', lines: [[90, 92, 'h', 'Board, coaches, families'], [90, 114, 'm', 'a phone or a computer'], [90, 133, 'm', 'two-step sign-in'], [90, 151, 'm', 'for every account']] },
    { k: 'app', lines: [[340, 102, 'h', 'FieldLogicHQ app'], [340, 124, 'm', 'Amazon Web Services'], [340, 143, 'm', 'Ohio, United States']] },
    { k: 'database', lines: [[590, 102, 'h', 'Database, sign-in, files'], [590, 124, 'm', 'Supabase on AWS'], [590, 143, 'm', 'Ohio, United States']] },
    { k: 'encrypted', lines: [[215.5, 109, 'l', 'encrypted']] },
    { k: 'checked', lines: [[464.5, 109, 'l', 'checked']] },
    { k: 'underApp', lines: [[340, 200, 'm', 'Every request: signed in,'], [340, 218, 'm', 'second step where on, belongs'], [340, 236, 'm', 'to this club, allowed for this role']] },
    { k: 'underDatabase', lines: [[590, 200, 'm', 'Encrypted at rest by the host'], [590, 224, 'm', 'Database backed up daily,'], [590, 242, 'm', 'kept 7 days'], [590, 266, 'm', 'Player documents open'], [590, 284, 'm', 'by 1-hour links']] },
    // ⚠ The one coordinate moved from the drawing (/design on the build, 2026-11-21): at x 208 the label's last letters crossed its
    // own arrow. 192 mirrors "sends an alert" (488) about the app's centre (340), as the drawing's other labels are mirrored.
    { k: 'emailArrow', lines: [[192, 316, 'l', 'sends email', 'end']] },
    { k: 'paymentsArrow', lines: [[348, 344, 'l', 'hands off checkout', 'start']] },
    { k: 'alertsArrow', lines: [[488, 316, 'l', 'sends an alert', 'start']] },
    { k: 'email', lines: [[105.5, 392, 'h', 'Email delivery'], [105.5, 414, 'm', 'Resend, United States'], [105.5, 437, 'm', 'Receives: names, addresses,'], [105.5, 455, 'm', 'the message itself']] },
    { k: 'payments', lines: [[340, 392, 'h', 'Payments'], [340, 414, 'm', 'Stripe'], [340, 437, 'm', 'Card numbers are typed on'], [340, 455, 'm', "Stripe's own page and"], [340, 473, 'm', 'never reach us']] },
    { k: 'alerts', lines: [[574.5, 392, 'h', 'Phone alerts'], [574.5, 414, 'm', "the browser's own push service"], [574.5, 437, 'm', 'Receives: a device address,'], [574.5, 455, 'm', 'and the alert, sealed'], [574.5, 473, 'm', 'for that device']] },
  ],
};

const PHONE: Form = {
  id: 'phone', w: 310, h: 966,
  shapes: [
    { rect: [20, 1, 270, 91] },
    { path: 'M291,46 H304 V418 H293', dash: true, arrow: true },
    { path: 'M155,94 L155,154', arrow: true },
    { rect: [20, 156, 270, 92], core: true },
    { path: 'M155,318 L155,370', arrow: true },
    { rect: [20, 372, 270, 92] },
    { path: 'M19,202 H6 V910 H18', arrow: true },
    { path: 'M6,623 H18', arrow: true },
    { path: 'M6,766 H18', arrow: true },
    { rect: [20, 572, 270, 102] },
    { rect: [20, 714, 270, 104] },
    { rect: [20, 858, 270, 104] },
  ],
  groups: [
    { k: 'people', lines: [[155, 28, 'h', 'Board, coaches, families'], [155, 50, 'm', 'a phone or a computer'], [155, 70, 'm', 'two-step sign-in for every account']] },
    { k: 'direct', lines: [[298, 118, 'l', 'sign-in and live', 'end'], [298, 136, 'l', 'score updates', 'end']] },
    { k: 'encrypted', lines: [[145, 128, 'l', 'encrypted', 'end']] },
    { k: 'app', lines: [[155, 183, 'h', 'FieldLogicHQ app'], [155, 205, 'm', 'Amazon Web Services'], [155, 225, 'm', 'Ohio, United States']] },
    { k: 'underApp', lines: [[155, 272, 'm', 'Every request: signed in, second step'], [155, 290, 'm', 'where on, belongs to this club,'], [155, 308, 'm', 'allowed for this role']] },
    { k: 'checked', lines: [[145, 349, 'l', 'checked', 'end']] },
    { k: 'database', lines: [[155, 399, 'h', 'Database, sign-in, files'], [155, 421, 'm', 'Supabase on AWS'], [155, 441, 'm', 'Ohio, United States']] },
    { k: 'underDatabase', lines: [[155, 488, 'm', 'Encrypted at rest by the host'], [155, 506, 'm', 'Database backed up daily, kept 7 days'], [155, 524, 'm', 'Player documents open by 1-hour links']] },
    { k: 'emailArrow', lines: [[24, 561, 'l', 'sends email', 'start']] },
    { k: 'email', lines: [[155, 599, 'h', 'Email delivery'], [155, 621, 'm', 'Resend, United States'], [155, 641, 'm', 'Receives: names, addresses,'], [155, 659, 'm', 'the message itself']] },
    { k: 'paymentsArrow', lines: [[24, 703, 'l', 'hands off checkout', 'start']] },
    { k: 'payments', lines: [[155, 741, 'h', 'Payments'], [155, 763, 'm', 'Stripe'], [155, 783, 'm', "Card numbers are typed on Stripe's"], [155, 801, 'm', 'own page and never reach us']] },
    { k: 'alertsArrow', lines: [[24, 847, 'l', 'sends an alert', 'start']] },
    { k: 'alerts', lines: [[155, 885, 'h', 'Phone alerts'], [155, 907, 'm', "the browser's own push service"], [155, 927, 'm', 'Receives: a device address, and'], [155, 945, 'm', 'the alert, sealed for that device']] },
  ],
};

export const SECURITY_DIAGRAM_FORMS = { desktop: DESKTOP, phone: PHONE } as const;

const TEXT_CLASS: Record<Cls, string> = { h: styles.dgName, m: styles.dgDetail, l: styles.dgLabel };

function DiagramForm({ form }: { form: Form }) {
  // Each form owns its arrowhead: a marker inside a `display: none` SVG does not paint for another SVG that points at it.
  const arrow = `security-arrow-${form.id}`;
  return (
    <svg
      className={`${styles.dg} ${form.id === 'desktop' ? styles.dgDesktop : styles.dgPhone}`}
      viewBox={`0 0 ${form.w} ${form.h}`}
      role="img"
      aria-label={SECURITY_DIAGRAM_ALT}
      data-form={form.id}
    >
      <defs>
        <marker id={arrow} markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.dgHead} />
        </marker>
      </defs>
      {form.shapes.map((s, i) => ('rect' in s
        ? <rect key={i} className={s.core ? styles.dgCore : styles.dgBox} x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx="9" />
        : <path key={i} className={`${styles.dgLine} ${s.dash ? styles.dgDash : ''}`} d={s.path} markerEnd={s.arrow ? `url(#${arrow})` : undefined} />))}
      {form.groups.map(g => (
        <g key={g.k} data-k={g.k}>
          {g.lines.map(([x, y, cls, text, anchor = 'middle'], i) => (
            <text key={i} className={TEXT_CLASS[cls]} x={x} y={y} textAnchor={anchor}>{text}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** The figure: a white panel holding both forms (CSS shows one), and the caption under it as visible text. */
export default function SecurityDiagram() {
  return (
    <figure className={styles.figure}>
      <div className={styles.panel}>
        <DiagramForm form={DESKTOP} />
        <DiagramForm form={PHONE} />
      </div>
      <figcaption className={styles.caption}>{SECURITY_DIAGRAM_CAPTION}</figcaption>
    </figure>
  );
}
