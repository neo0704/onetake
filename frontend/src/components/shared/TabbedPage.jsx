import React from 'react';
import { useSearchParams } from 'react-router-dom';

// Shows one tab bar and renders the selected tab's component.
// The selected tab is kept in the URL (?tab=users) so refresh and links keep it.
// tabs = [{ key: 'freelancers', label: 'Freelancers', component: Freelancers }, ...]
export default function TabbedPage({ tabs }) {
  const [params, setParams] = useSearchParams();
  const current = tabs.find(t => t.key === params.get('tab')) || tabs[0];
  const Active = current.component;

  return (
    <div>
      <div className="flex gap-1 border-b border-white/10 mb-6" role="tablist">
        {tabs.map(t => (
          <button key={t.key} role="tab" aria-selected={t.key === current.key}
            onClick={() => setParams({ tab: t.key })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              t.key === current.key
                ? 'border-primary text-white'
                : 'border-transparent text-white/50 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}