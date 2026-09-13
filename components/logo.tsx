import { Table2 } from 'lucide-react'

export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm ${className}`}
    >
      <Table2 className="h-[55%] w-[55%]" strokeWidth={2.4} />
    </span>
  )
}
