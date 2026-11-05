import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpenseEntry } from '../types';

// Fake pdfmake: capture the document definition instead of rendering a PDF
const open = vi.fn();
const download = vi.fn();
const createPdf = vi.fn(() => ({ open, download }));

vi.mock('pdfmake/build/pdfmake', () => ({ default: { createPdf } }));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: { 'Roboto-Regular.ttf': 'AAA' } }));

const { downloadPdf, previewPdf } = await import('./pdf');

const entries: ExpenseEntry[] = [
  { id: 2, bookId: 1, date: new Date(2026, 10, 2), time: '18:00', amount: 300, category: 'Food', paymode: 'Cash Out', party: null, remarks: 'Dinner', balance: 700 },
  { id: 1, bookId: 1, date: new Date(2026, 10, 1), time: '', amount: 1000, category: null, paymode: 'Cash In', party: null, remarks: null, balance: 1000 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastDoc = (): any => (createPdf.mock.calls.at(-1) as unknown[])[0];

describe('PDF report', () => {
  beforeEach(() => {
    createPdf.mockClear();
    open.mockClear();
    download.mockClear();
  });

  it('downloads a file named after the book', async () => {
    await downloadPdf('Household', entries);
    expect(download).toHaveBeenCalledWith('Household-report.pdf');
  });

  it('puts the totals and entry count in the document', async () => {
    await downloadPdf('Household', entries);
    const doc = lastDoc();
    expect(doc.content[0].text).toBe('Household');

    const boxes = doc.content[2].table.body[0];
    const values = boxes.map((b: { stack: { text: string }[] }) => b.stack[1].text);
    expect(values).toEqual(['1,000', '300', '700']);

    expect(doc.content[3].text).toBe('Total No. of entries: 2');
  });

  it('builds one table row per entry plus the header, with in/out in the right column', async () => {
    await downloadPdf('Household', entries);
    const rows = lastDoc().content[4].table.body;
    expect(rows).toHaveLength(3);
    const [, outRow, inRow] = rows;
    expect(outRow[4]).toBe(''); // Cash In column empty
    expect(outRow[5].text).toBe('300');
    expect(inRow[4].text).toBe('1,000');
    expect(inRow[1]).toBe('-'); // missing remarks
  });

  it('shows a negative net balance in red', async () => {
    await downloadPdf('B', [{ ...entries[0], balance: -300 }]);
    expect(lastDoc().content[2].table.body[0][2].stack[1].color).toBe('#dc2626');
  });

  it('opens the preview in a new tab', async () => {
    const win = {} as Window;
    vi.spyOn(window, 'open').mockReturnValue(win);
    await previewPdf('Household', entries);
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(open).toHaveBeenCalledWith({}, win);
  });

  it('has page numbers and an alternating table layout', async () => {
    await downloadPdf('Household', entries);
    const doc = lastDoc();
    expect(doc.footer(2, 5).text).toBe('Page 2 of 5');
    const layout = doc.content[4].layout;
    expect(layout.fillColor(0)).toBe('#123b65');
    expect(layout.fillColor(2)).toBe('#f8fafc');
    expect(layout.fillColor(1)).toBeNull();
  });
});
