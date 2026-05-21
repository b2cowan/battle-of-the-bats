'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import styles from './overview.module.css';

type TabId = 'subscription' | 'growth' | 'usage' | 'notes';

type Props = {
  subscription: ReactNode;
  growth: ReactNode;
  usage: ReactNode;
  notes: ReactNode;
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'subscription', label: 'Subscription' },
  { id: 'growth', label: 'Growth' },
  { id: 'usage', label: 'Usage' },
  { id: 'notes', label: 'Metric Notes' },
];

export default function OverviewTabs({ subscription, growth, usage, notes }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('subscription');
  const panels: Record<TabId, ReactNode> = { subscription, growth, usage, notes };

  return (
    <section className={styles.tabsShell} aria-label="Overview sections">
      <nav className={styles.tabBar} role="tablist" aria-label="Overview metric groups">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`overview-tab-${tab.id}`}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`overview-panel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        id={`overview-panel-${activeTab}`}
        className={styles.tabPanel}
        role="tabpanel"
        aria-labelledby={`overview-tab-${activeTab}`}
      >
        {panels[activeTab]}
      </div>
    </section>
  );
}
