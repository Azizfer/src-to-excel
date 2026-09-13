import { ArrowRight, MousePointerClick } from 'lucide-react'

const SCREENSHOT_ROWS = [
  ['Region', 'Units', 'Revenue', 'Growth'],
  ['North', '1,240', '$22,320.00', '+12.4%'],
  ['South', '995', '$17,910.00', '+8.9%'],
  ['EMEA', '2,010', '$33,165.00', '+21.0%'],
  ['APAC', '1,480', '$24,420.00', '+17.3%'],
]

/**
 * Static, dependency-free "before / after" illustration: a screenshot of a
 * table on the left, the editable spreadsheet it becomes on the right.
 */
export function ExamplePair() {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
      <figure className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
        <figcaption className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </span>
          <span className="ml-1 truncate font-mono text-[11px] text-slate-500">q3-dashboard.png</span>
          <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">PNG</span>
        </figcaption>
        <div className="select-none p-3" aria-hidden="true">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {SCREENSHOT_ROWS.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={`border border-slate-300 px-2.5 py-1.5 ${
                        rowIndex === 0 ? 'bg-slate-200 font-semibold text-slate-700' : 'text-slate-600'
                      } ${colIndex > 0 ? 'text-right' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>

      <div className="flex items-center justify-center" aria-hidden="true">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>

      <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ring-1 ring-brand-200">
        <figcaption className="flex items-center gap-2 border-b border-slate-200 bg-brand-50 px-3 py-2 text-[11px] font-semibold text-brand-800">
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" /> editable spreadsheet
        </figcaption>
        <div className="p-3" aria-hidden="true">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="w-8 border border-slate-200 bg-slate-100 px-1 py-1 text-[10px] font-medium text-slate-400" />
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <th key={letter} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-slate-500">
                    {letter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCREENSHOT_ROWS.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="border border-slate-200 bg-slate-100 px-1 py-1.5 text-[10px] font-medium text-slate-400">
                    {rowIndex + 1}
                  </th>
                  {row.map((cell, colIndex) => {
                    const flagged = rowIndex === 3 && colIndex === 2
                    const editing = rowIndex === 1 && colIndex === 1
                    return (
                      <td
                        key={colIndex}
                        className={`border px-2.5 py-1.5 ${
                          rowIndex === 0
                            ? 'border-slate-300 bg-slate-50 font-semibold text-slate-800'
                            : flagged
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : editing
                                ? 'border-brand-500 bg-white text-slate-900 ring-2 ring-inset ring-brand-400'
                                : 'border-slate-200 text-slate-700'
                        } ${colIndex > 0 ? 'text-right' : ''}`}
                      >
                        {editing ? (
                          <span className="inline-flex items-center">
                            1,24<span className="animate-pulse text-brand-600">|</span>0
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            Amber = low OCR confidence, flagged for review instead of silently guessed.
          </p>
        </div>
      </figure>
    </div>
  )
}
