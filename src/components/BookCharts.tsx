import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChartColumn, Table2 } from 'lucide-react';
import { formatDate, formatMoney, toIsoDate } from '../lib/format';
import type { ExpenseEntry } from '../types';

// Series colours are CSS variables (index.css) so they switch with the light/dark theme.
const IN = 'var(--chart-in)';
const OUT = 'var(--chart-out)';
const LINE = 'var(--chart-line)';

const MONTH_LIMIT = 12;
const VIEW_KEY = 'chartsView';

type View = 'chart' | 'table';

// ---------------------------------------------------------------------------
// Data shaping (exported for tests)

export interface MonthTotal {
  key: string; // 'YYYY-MM'
  label: string; // 'Nov 26'
  cashIn: number;
  cashOut: number;
}

export interface CategoryTotal {
  name: string;
  amount: number;
  share: number; // 0..1 of all Cash Out
  filterable: boolean; // a real category name the table can be filtered by
}

export interface BalancePoint {
  date: Date;
  balance: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Cash In / Cash Out per month, oldest first, with empty months filled in */
export function monthlyTotals(entries: ExpenseEntry[]): MonthTotal[] {
  if (!entries.length) return [];
  const sums = new Map<string, { cashIn: number; cashOut: number }>();
  let first = entries[0].date;
  let last = entries[0].date;
  for (const e of entries) {
    const k = monthKey(e.date);
    const s = sums.get(k) ?? { cashIn: 0, cashOut: 0 };
    if (e.paymode === 'Cash In') s.cashIn += e.amount;
    else s.cashOut += e.amount;
    sums.set(k, s);
    if (e.date < first) first = e.date;
    if (e.date > last) last = e.date;
  }
  const out: MonthTotal[] = [];
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const s = sums.get(monthKey(d));
    out.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      cashIn: r2(s?.cashIn ?? 0),
      cashOut: r2(s?.cashOut ?? 0),
    });
  }
  return out;
}

/** Cash Out per category, largest first; the tail folds into "Other" */
export function categoryTotals(entries: ExpenseEntry[], top = 6): CategoryTotal[] {
  const sums = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    if (e.paymode !== 'Cash Out') continue;
    const k = e.category?.trim() || '';
    sums.set(k, (sums.get(k) ?? 0) + e.amount);
    total += e.amount;
  }
  const sorted = [...sums].sort((a, b) => b[1] - a[1]);
  const head = sorted.length > top ? sorted.slice(0, top - 1) : sorted;
  const rest = sorted.length > top ? sorted.slice(top - 1) : [];
  const rows: CategoryTotal[] = head.map(([k, v]) => ({
    name: k || 'Uncategorised',
    amount: r2(v),
    share: total ? v / total : 0,
    filterable: !!k,
  }));
  if (rest.length) {
    const v = rest.reduce((a, [, x]) => a + x, 0);
    rows.push({ name: `Other (${rest.length})`, amount: r2(v), share: total ? v / total : 0, filterable: false });
  }
  return rows;
}

/** Closing balance of each day, oldest first. Expects entries newest first with balances. */
export function balancePoints(entries: ExpenseEntry[]): BalancePoint[] {
  const byDay = new Map<string, BalancePoint>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    byDay.set(toIsoDate(e.date), { date: e.date, balance: e.balance ?? 0 });
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------------------
// Helpers

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const shortMoney = (n: number) => `${n < 0 ? '-' : ''}₹${compact.format(Math.abs(n))}`;
const pct = (share: number) => (share > 0 && share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`);

/** Round axis ticks covering [min, max] */
function ticks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** Bar with 4px rounded top corners, square at the baseline */
function barPath(x: number, y: number, w: number, h: number, radius = 4): string {
  const r = Math.max(0, Math.min(radius, w / 2, h));
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 600);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'chart';
  } catch {
    return 'chart';
  }
}

// ---------------------------------------------------------------------------

export default function BookCharts({
  entries,
  subtitle,
  emptyText = 'No entries in the selected dates.',
  onCategory,
}: {
  /** Entries to chart (newest first, with running balances) */
  entries: ExpenseEntry[];
  subtitle: string;
  emptyText?: string;
  /** Called when a category bar is clicked; bars aren't clickable without it */
  onCategory?: (category: string) => void;
}) {
  const [view, setView] = useState<View>(loadView);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable: the choice just isn't remembered */
    }
  };

  const allMonths = useMemo(() => monthlyTotals(entries), [entries]);
  const months = allMonths.slice(-MONTH_LIMIT);
  const cats = useMemo(() => categoryTotals(entries), [entries]);
  const points = useMemo(() => balancePoints(entries), [entries]);
  const asTable = view === 'table';
  const lastBalance = points.length ? points[points.length - 1].balance : 0;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <ChartColumn size={20} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Charts</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['chart', 'table'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                aria-pressed={view === v}
                className={clsx(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  view === v ? 'bg-surface-raised text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {v === 'chart' ? <ChartColumn size={15} /> : <Table2 size={15} />}
                {v === 'chart' ? 'Charts' : 'Table'}
              </button>
            ))}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
          <p className="border-t border-slate-100 px-6 py-10 text-center text-sm text-slate-500">
            {emptyText}
          </p>
        ) : (
          <div className="grid gap-4 border-t border-slate-100 p-4 sm:p-5 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Cash In vs Cash Out"
              sub={allMonths.length > MONTH_LIMIT ? `Per month, last ${MONTH_LIMIT} months` : 'Per month'}
            >
              {asTable ? (
                <DataTable
                  head={['Month', 'Cash In', 'Cash Out', 'Net']}
                  rows={[...months].reverse().map((m) => [
                    m.label,
                    formatMoney(m.cashIn),
                    formatMoney(m.cashOut),
                    formatMoney(r2(m.cashIn - m.cashOut)),
                  ])}
                />
              ) : (
                <MonthlyChart months={months} />
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Cash Out by category"
              sub={onCategory && cats.some((c) => c.filterable) ? 'Click a category to see its entries' : undefined}
            >
              {cats.length === 0 ? (
                <Empty text="No Cash Out entries yet." />
              ) : asTable ? (
                <DataTable
                  head={['Category', 'Amount', 'Share']}
                  rows={cats.map((c) => [c.name, formatMoney(c.amount), pct(c.share)])}
                />
              ) : (
                <CategoryBars rows={cats} onSelect={onCategory} />
              )}
            </Panel>

            <Panel className="lg:col-span-5" title="Balance over time" sub={`Closing balance ${formatMoney(lastBalance)}`}>
              {points.length < 2 ? (
                <Empty text="Add entries on at least two different days to see the trend." />
              ) : asTable ? (
                <DataTable
                  head={['Date', 'Balance']}
                  rows={[...points].reverse().map((p) => [formatDate(p.date), formatMoney(p.balance)])}
                />
              ) : (
                <BalanceChart points={points} />
              )}
            </Panel>
          </div>
        )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Charts

function MonthlyChart({ months }: { months: MonthTotal[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const H = 220;
  const M = { t: 10, r: 4, b: 26, l: 52 };
  const plotW = Math.max(0, width - M.l - M.r);
  const plotH = H - M.t - M.b;
  const yt = ticks(0, Math.max(1, ...months.flatMap((m) => [m.cashIn, m.cashOut])));
  const yMax = yt[yt.length - 1];
  const y = (v: number) => M.t + plotH - (v / yMax) * plotH;
  const band = months.length ? plotW / months.length : 0;
  const barW = Math.max(3, Math.min(22, (band * 0.72 - 2) / 2));
  const labelEvery = Math.max(1, Math.ceil((months.length * 46) / Math.max(plotW, 1)));

  const totalIn = r2(months.reduce((a, m) => a + m.cashIn, 0));
  const totalOut = r2(months.reduce((a, m) => a + m.cashOut, 0));
  const hm = hover !== null ? months[hover] : null;

  return (
    <div>
      <Legend
        items={[
          { color: IN, label: 'Cash In', value: formatMoney(totalIn) },
          { color: OUT, label: 'Cash Out', value: formatMoney(totalOut) },
        ]}
      />
      <div ref={ref} className="relative mt-3" onPointerLeave={() => setHover(null)}>
        {width > 0 && (
          <svg
            width="100%"
            height={H}
            role="img"
            aria-label={`Cash in and cash out per month: ${formatMoney(totalIn)} in, ${formatMoney(totalOut)} out`}
            className="block"
          >
            {yt.map((t) => (
              <g key={t}>
                <line
                  x1={M.l}
                  x2={width - M.r}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? 'stroke-slate-300' : 'stroke-slate-100'}
                />
                <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                  {shortMoney(t)}
                </text>
              </g>
            ))}
            {months.map((m, i) => {
              const cx = M.l + band * i + band / 2;
              return (
                <g key={m.key}>
                  {hover === i && (
                    <rect x={M.l + band * i + 1} y={M.t} width={Math.max(0, band - 2)} height={plotH} rx={6} className="fill-slate-100" />
                  )}
                  {m.cashIn > 0 && <path d={barPath(cx - barW - 1, y(m.cashIn), barW, y(0) - y(m.cashIn))} fill={IN} />}
                  {m.cashOut > 0 && <path d={barPath(cx + 1, y(m.cashOut), barW, y(0) - y(m.cashOut))} fill={OUT} />}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                      {m.label}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Hit areas: the whole month column, bigger than the bars */}
            {months.map((m, i) => (
              <rect
                key={m.key}
                x={M.l + band * i}
                y={M.t}
                width={band}
                height={plotH + M.b}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
              />
            ))}
          </svg>
        )}
        {hm && hover !== null && (
          <Tooltip
            x={M.l + band * hover + band / 2}
            gap={band / 2}
            width={width}
            title={hm.label}
            rows={[
              { color: IN, label: 'Cash In', value: formatMoney(hm.cashIn) },
              { color: OUT, label: 'Cash Out', value: formatMoney(hm.cashOut) },
              { label: 'Net', value: formatMoney(r2(hm.cashIn - hm.cashOut)), strong: true },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function BalanceChart({ points }: { points: BalancePoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const H = 220;
  const M = { t: 10, r: 12, b: 26, l: 52 };
  const plotW = Math.max(0, width - M.l - M.r);
  const plotH = H - M.t - M.b;
  const values = points.map((p) => p.balance);
  const yt = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const [lo, hi] = [yt[0], yt[yt.length - 1]];
  const t0 = points[0].date.getTime();
  const t1 = points[points.length - 1].date.getTime();
  const x = (d: Date) => M.l + (t1 === t0 ? plotW / 2 : ((d.getTime() - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => M.t + plotH - ((v - lo) / (hi - lo)) * plotH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.balance).toFixed(1)}`).join('');
  const area = `${line}L${x(points[points.length - 1].date).toFixed(1)},${y(0)}L${x(points[0].date).toFixed(1)},${y(0)}Z`;

  const spanDays = (t1 - t0) / 864e5;
  const tickLabel = (d: Date) =>
    d.toLocaleDateString('en-GB', spanDays > 330 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });
  const xCount = Math.max(2, Math.min(6, Math.floor(plotW / 90)));
  const xTicks = Array.from({ length: xCount }, (_, i) => new Date(t0 + ((t1 - t0) * i) / (xCount - 1)));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const px = e.clientX - svg.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width="100%"
          height={H}
          role="img"
          aria-label={`Balance from ${formatDate(points[0].date)} to ${formatDate(points[points.length - 1].date)}, now ${formatMoney(values[values.length - 1])}`}
          className="block"
        >
          {yt.map((t) => (
            <g key={t}>
              <line
                x1={M.l}
                x2={width - M.r}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'stroke-slate-300' : 'stroke-slate-100'}
              />
              <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                {shortMoney(t)}
              </text>
            </g>
          ))}
          {xTicks.map((d, i) => (
            <text
              key={i}
              x={x(d)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === xCount - 1 ? 'end' : 'middle'}
              className="fill-slate-400 text-[11px]"
            >
              {tickLabel(d)}
            </text>
          ))}
          <path d={area} fill={LINE} opacity={0.08} />
          <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <>
              <line x1={x(hp.date)} x2={x(hp.date)} y1={M.t} y2={M.t + plotH} className="stroke-slate-300" strokeDasharray="3 3" />
              <circle cx={x(hp.date)} cy={y(hp.balance)} r={5} fill={LINE} stroke="var(--color-surface)" strokeWidth={2} />
            </>
          )}
          <rect
            x={M.l}
            y={M.t}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
          />
        </svg>
      )}
      {hp && (
        <Tooltip
          x={x(hp.date)}
          gap={12}
          width={width}
          title={formatDate(hp.date)}
          rows={[{ color: LINE, label: 'Balance', value: formatMoney(hp.balance), strong: true }]}
        />
      )}
    </div>
  );
}

function CategoryBars({ rows, onSelect }: { rows: CategoryTotal[]; onSelect?: (c: string) => void }) {
  const max = Math.max(...rows.map((r) => r.amount));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-slate-700">{r.name}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold text-slate-800">{formatMoney(r.amount)}</span>{' '}
                <span className="text-xs text-slate-400">{pct(r.share)}</span>
              </span>
            </div>
            <div
              className="mt-1.5 h-2.5 rounded-r-[4px]"
              style={{ width: `${Math.max(1, (r.amount / max) * 100)}%`, background: OUT }}
            />
          </>
        );
        return (
          <li key={r.name}>
            {onSelect && r.filterable ? (
              <button
                onClick={() => onSelect?.(r.name)}
                title={`Show ${r.name} entries`}
                className="block w-full cursor-pointer rounded-lg p-2 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {body}
              </button>
            ) : (
              <div className="p-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Pieces

function Panel({
  title,
  sub,
  className,
  children,
}: {
  title: string;
  sub?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx('min-w-0 rounded-2xl border border-slate-100 p-4', className)}>
      <h3 className="font-bold text-slate-800">{title}</h3>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-sm">
          <span className="size-3 rounded-[3px]" style={{ background: i.color }} />
          <span className="text-slate-500">{i.label}</span>
          <span className="font-bold text-slate-800 tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

const TOOLTIP_W = 176;

function Tooltip({
  x,
  gap,
  width,
  title,
  rows,
}: {
  x: number;
  gap: number;
  width: number;
  title: string;
  rows: { color?: string; label: string; value: string; strong?: boolean }[];
}) {
  // Beside the hovered mark, never on top of it; flips left near the right edge
  let left = x + gap + 6;
  if (left + TOOLTIP_W > width) left = x - gap - 6 - TOOLTIP_W;
  left = Math.max(0, left);
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-xl border border-slate-200 bg-surface p-3 text-xs shadow-lg"
      style={{ left, width: TOOLTIP_W }}
    >
      <p className="mb-1.5 font-bold text-slate-800">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            {r.color && <span className="size-2.5 rounded-[3px]" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className={clsx('tabular-nums', r.strong ? 'font-bold text-slate-800' : 'font-semibold text-slate-700')}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={clsx('px-3 py-2', i ? 'text-right' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={clsx('px-3 py-2', ci ? 'text-right text-slate-700 tabular-nums' : 'font-semibold text-slate-700')}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="py-10 text-center text-sm text-slate-400">{text}</p>;
