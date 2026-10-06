import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared skeleton building blocks. Import what you need:
//   import { Bone, ListPageSkeleton } from '../../components/shared/Skeletons';
// ─────────────────────────────────────────────────────────────────────────────

export function Bone({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.16] ${className}`} />;
}

const times = (n) => Array.from({ length: n }, (_, i) => i);

// ── Pieces ───────────────────────────────────────────────────────────────────

export function HeaderSkeleton({ withAction = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-64 max-w-full" />
      </div>
      {withAction && <Bone className="h-10 w-28 shrink-0" />}
    </div>
  );
}

export function FilterPillsSkeleton({ count = 4 }) {
  return (
    <div className="flex gap-2 overflow-hidden">
      {times(count).map(i => <Bone key={i} className="h-8 w-20 rounded-lg shrink-0" />)}
    </div>
  );
}

export function StatsRowSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {times(count).map(i => (
        <div key={i} className="card space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

// A list of cards with icon + two text lines + badge (events, requests, quotations…)
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {times(rows).map(i => (
        <div key={i} className="card flex items-center gap-3">
          <Bone className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3 w-3/4" />
          </div>
          <Bone className="h-6 w-20 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Grid of profile-style cards (freelancers, homepage projects…)
export function CardGridSkeleton({ cards = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" aria-busy="true" aria-label="Loading">
      {times(cards).map(i => (
        <div key={i} className="card flex items-start gap-3">
          <Bone className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="flex gap-4 pb-3 border-b border-white/10">
        {times(cols).map(i => <Bone key={i} className="h-3 flex-1" />)}
      </div>
      <div className="space-y-4 pt-4">
        {times(rows).map(r => (
          <div key={r} className="flex items-center gap-4">
            {times(cols).map(c => <Bone key={c} className="h-4 flex-1" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full-page skeletons (include the header) ─────────────────────────────────

export function ListPageSkeleton({ rows = 5, filters = true, action = false }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton withAction={action} />
      {filters && <FilterPillsSkeleton />}
      <ListSkeleton rows={rows} />
    </div>
  );
}

export function CardGridPageSkeleton({ cards = 6 }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton withAction />
      <FilterPillsSkeleton />
      <CardGridSkeleton cards={cards} />
    </div>
  );
}

export function TablePageSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton withAction />
      <FilterPillsSkeleton />
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

// Header + stat cards + list (payroll, finance-style pages)
export function StatsListPageSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton withAction />
      <StatsRowSkeleton />
      <FilterPillsSkeleton />
      <ListSkeleton rows={rows} />
    </div>
  );
}

// Header + tabs + card grid (equipment inventory)
export function TabbedGridPageSkeleton({ tabs = 3, cards = 6 }) {
  return (
    <div className="space-y-5">
      <HeaderSkeleton withAction />
      <div className="flex gap-4 border-b border-white/10 pb-2.5">
        {times(tabs).map(i => <Bone key={i} className="h-5 w-24" />)}
      </div>
      <CardGridSkeleton cards={cards} />
    </div>
  );
}

// Reports: date filters + stat cards + chart + table
export function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex flex-col sm:flex-row gap-3">
        <Bone className="h-10 w-full sm:w-44" />
        <Bone className="h-10 w-full sm:w-44" />
        <Bone className="h-10 w-full sm:w-24" />
      </div>
      <StatsRowSkeleton />
      <div className="card">
        <Bone className="h-5 w-40 mb-4" />
        <Bone className="h-[260px] w-full" />
      </div>
      <div className="card">
        <Bone className="h-5 w-36 mb-4" />
        <TableSkeleton rows={4} cols={6} />
      </div>
    </div>
  );
}

// Event detail: back button + title + status, tab bar, two-column cards
export function DetailPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Bone className="h-9 w-9 shrink-0" />
        <div className="flex-1 space-y-2">
          <Bone className="h-7 w-64 max-w-full" />
          <Bone className="h-4 w-48 max-w-full" />
        </div>
        <Bone className="h-7 w-24 rounded-full shrink-0" />
      </div>
      <div className="flex gap-4 border-b border-white/10 pb-2.5 overflow-hidden">
        {times(5).map(i => <Bone key={i} className="h-5 w-20 shrink-0" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card lg:col-span-2 space-y-4">
          <Bone className="h-5 w-40" />
          {times(5).map(i => (
            <div key={i} className="flex gap-4">
              <Bone className="h-4 w-28 shrink-0" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {times(2).map(i => (
            <div key={i} className="card space-y-3">
              <Bone className="h-5 w-32" />
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Form-style page (create quotation)
export function FormPageSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Bone className="h-9 w-9 shrink-0" />
        <div className="space-y-2">
          <Bone className="h-7 w-52" />
          <Bone className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <div className="card"><Bone className="h-16 w-full" /></div>
      <div className="card space-y-4">
        <Bone className="h-5 w-40" />
        {times(4).map(i => (
          <div key={i} className="flex gap-3">
            <Bone className="h-10 flex-1" />
            <Bone className="h-10 w-24" />
            <Bone className="h-10 w-28" />
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        <Bone className="h-5 w-32" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-2/3" />
      </div>
    </div>
  );
}

// Settings page: heading + one toggle card
export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      <div className="card flex items-start justify-between gap-4">
        <div className="flex gap-3 flex-1">
          <Bone className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-64 max-w-full" />
            <Bone className="h-3 w-full max-w-md" />
            <Bone className="h-3 w-2/3 max-w-md" />
          </div>
        </div>
        <Bone className="h-6 w-12 rounded-full shrink-0" />
      </div>
    </div>
  );
}

// ── Client-side additions ────────────────────────────────────────────────────

// Stat cards with an icon block (same look as <StatCard />)
export function StatCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {times(count).map(i => (
        <div key={i} className="card flex items-center gap-3">
          <Bone className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-6 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Rows that sit inside a card (no card of their own)
export function InnerRowsSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {times(rows).map(i => (
        <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5">
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3 w-2/3" />
          </div>
          <Bone className="h-6 w-20 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Client dashboard: greeting, 4 stat cards, "My Projects" card
export function ClientDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-3.5 w-64 max-w-full" />
      </div>
      <StatCardsSkeleton />
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <Bone className="h-5 w-32" />
          <Bone className="h-4 w-16" />
        </div>
        <InnerRowsSkeleton rows={4} />
      </div>
    </div>
  );
}

// Meetings: header + button, section title, 2-column meeting cards
export function MeetingsPageSkeleton({ sectionTitle = true }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction />
      <div>
        {sectionTitle && <Bone className="h-5 w-44 mb-4" />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {times(4).map(i => (
            <div key={i} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <Bone className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-4 w-2/3" />
                    <Bone className="h-3 w-1/3" />
                  </div>
                </div>
                <Bone className="h-6 w-20 rounded-full shrink-0" />
              </div>
              <div className="flex gap-3">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3.5 w-16" />
              </div>
              <Bone className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Freelancer-side additions ────────────────────────────────────────────────

// Payroll: hero banner + payslip cards, sidebar with overview + filters
export function PayrollSkeleton() {
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6" aria-busy="true" aria-label="Loading payroll">
      <div className="space-y-6 min-w-0">
        <div className="card flex items-center gap-3 p-6">
          <Bone className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Bone className="h-6 w-36" />
            <Bone className="h-3.5 w-52 max-w-full" />
          </div>
        </div>
        <div className="space-y-4">
          {times(3).map(i => (
            <div key={i} className="card space-y-4">
              <div className="flex justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Bone className="h-3 w-32" />
                  <Bone className="h-5 w-2/3" />
                  <Bone className="h-3 w-24" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <Bone className="h-3 w-14" />
                  <Bone className="h-7 w-28" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {times(3).map(j => <Bone key={j} className="h-12" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-3">
          <Bone className="h-3 w-20" />
          {times(3).map(i => (
            <div key={i} className="flex justify-between">
              <Bone className="h-4 w-24" />
              <Bone className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="card hidden lg:block space-y-2">
          <Bone className="h-3 w-12 mb-1" />
          {times(4).map(i => <Bone key={i} className="h-9 w-full" />)}
        </div>
      </div>
    </div>
  );
}

// Schedule: heading, calendar card (7-col grid), sidebar with upcoming cards
export function ScheduleSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading schedule">
      <div className="space-y-2">
        <Bone className="h-8 w-44" />
        <Bone className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <Bone className="h-9 w-9" />
            <Bone className="h-6 w-40" />
            <Bone className="h-9 w-9" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {times(7).map(i => <Bone key={`h${i}`} className="h-4 w-8 mx-auto mb-1" />)}
            {times(35).map(i => <Bone key={i} className="aspect-square rounded-xl opacity-60" />)}
          </div>
        </div>
        <div className="card space-y-3">
          <Bone className="h-5 w-40 mb-1" />
          {times(3).map(i => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/5">
              <Bone className="w-[46px] h-14 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Damage reports: heading, 4 small counters, filter pills, report rows
export function DamageReportsSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" aria-busy="true" aria-label="Loading reports">
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {times(4).map(i => (
          <div key={i} className="card flex flex-col items-center gap-2 !p-3">
            <Bone className="h-7 w-10" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
      <FilterPillsSkeleton />
      <div className="space-y-3">
        {times(3).map(i => (
          <div key={i} className="card flex items-start gap-4">
            <Bone className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-1/2" />
              <Bone className="h-3 w-3/4" />
            </div>
            <Bone className="h-4 w-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Freelancer profile: hero card, then 2/3 info cards + 1/3 side cards
export function ProfileSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl" aria-busy="true" aria-label="Loading profile">
      <div className="card flex items-start gap-4">
        <Bone className="w-16 h-16 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Bone className="h-6 w-48" />
          <Bone className="h-3.5 w-56 max-w-full" />
          <div className="flex gap-2">
            <Bone className="h-6 w-24 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <Bone className="h-9 w-24 shrink-0" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <Bone className="h-5 w-44 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {times(6).map(i => (
                <div key={i} className="space-y-1.5">
                  <Bone className="h-3 w-16" />
                  <Bone className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <Bone className="h-5 w-40 mb-3" />
            <div className="flex flex-wrap gap-2">
              {times(5).map(i => <Bone key={i} className="h-7 w-20 rounded-full" />)}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="card">
            <Bone className="h-5 w-32 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {times(4).map(i => <Bone key={i} className="h-10" />)}
            </div>
          </div>
          <div className="card space-y-3">
            <Bone className="h-5 w-24" />
            <Bone className="h-8 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}