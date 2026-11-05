import type { ExpenseEntry } from '../types';
import { formatDate, formatTime, totals } from './format';

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** pdfmake is large, so it is loaded only when a report is requested */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfMake(): Promise<any> {
  const [pdfMakeMod, fontsMod] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake: any = (pdfMakeMod as any).default ?? pdfMakeMod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f: any = fontsMod;
  pdfMake.vfs = f.default?.pdfMake?.vfs ?? f.default ?? f.pdfMake?.vfs ?? f;
  return pdfMake;
}

function buildReport(bookName: string, data: ExpenseEntry[]) {
  const { cashIn, cashOut, net } = totals(data);
  const box = (label: string, value: string, color: string) => ({
    stack: [
      { text: label, fontSize: 9, color: '#64748b', margin: [0, 0, 0, 4] },
      { text: value, fontSize: 15, bold: true, color },
    ],
    margin: [10, 10, 10, 10],
  });

  return {
    pageMargins: [36, 40, 36, 40],
    footer: (page: number, count: number) => ({
      text: `Page ${page} of ${count}`,
      alignment: 'center',
      fontSize: 8,
      color: '#94a3b8',
    }),
    content: [
      { text: bookName, style: 'header' },
      {
        text: `Generated on ${new Date().toLocaleString('en-GB')}`,
        fontSize: 9,
        color: '#64748b',
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              box('Total Cash In', fmt(cashIn), '#059669'),
              box('Total Cash Out', fmt(cashOut), '#dc2626'),
              box('Net Balance', fmt(net), net >= 0 ? '#123b65' : '#dc2626'),
            ],
          ],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
      },
      { text: `Total No. of entries: ${data.length}`, margin: [0, 14, 0, 8], fontSize: 10, color: '#334155' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['Date', 'Remarks', 'Category', 'Mode', 'Cash In', 'Cash Out', 'Balance'].map((t) => ({
              text: t,
              style: 'th',
            })),
            ...data.map((e) => [
              { text: `${formatDate(e.date)}\n${formatTime(e.time)}`, fontSize: 8 },
              e.remarks ?? '-',
              e.category ?? '-',
              e.paymode,
              e.paymode === 'Cash In' ? { text: fmt(e.amount), color: '#059669', alignment: 'right' } : '',
              e.paymode === 'Cash Out' ? { text: fmt(e.amount), color: '#dc2626', alignment: 'right' } : '',
              { text: fmt(e.balance ?? 0), alignment: 'right', bold: true },
            ]),
          ],
        },
        layout: {
          fillColor: (row: number) => (row === 0 ? '#123b65' : row % 2 === 0 ? '#f8fafc' : null),
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        fontSize: 9,
      },
    ],
    styles: {
      header: { fontSize: 20, bold: true, color: '#123b65' },
      th: { bold: true, color: '#ffffff', fontSize: 9 },
    },
  };
}

export async function previewPdf(bookName: string, data: ExpenseEntry[]) {
  // Open the tab synchronously-ish so pop-up blockers are less likely to stop it
  const win = window.open('', '_blank');
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(buildReport(bookName, data)).open({}, win);
}

export async function downloadPdf(bookName: string, data: ExpenseEntry[]) {
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(buildReport(bookName, data)).download(`${bookName}-report.pdf`);
}
