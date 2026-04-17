import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Tracker, TrackerData } from '../trackers/Tracker';
import { Heatmap } from './Heatmap';
import { StatsPanel } from './StatsPanel';
import { computeStreaks, totalValue } from '../utils/streaks';

interface Props<TDetail> {
  tracker: Tracker<TDetail>;
  startExpanded?: boolean;
}

const Card = styled.section`
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 16px;
`;

const Header = styled.button`
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  margin-bottom: 4px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: baseline;
  color: inherit;
  cursor: pointer;
  text-align: left;
`;

const Label = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #c9d1d9;
`;

const Summary = styled.div`
  color: #8b949e;
  font-size: 13px;
`;

const Toggle = styled.span`
  color: #8b949e;
  font-size: 12px;
  user-select: none;
`;

const Body = styled.div`
  margin-top: 12px;
`;

const EmptyHint = styled.div`
  color: #8b949e;
  font-size: 13px;
  padding: 20px 0;

  code {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 2px 6px;
  }
`;

const Err = styled.div`
  color: #f85149;
  font-size: 13px;
  padding: 12px 0;
`;

function storageKey(id: string) {
  return `tracker.expanded.${id}`;
}

export function TrackerCard<TDetail>(props: Props<TDetail>): JSX.Element {
  const { tracker, startExpanded = false } = props;
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(storageKey(tracker.id));
      return v === null ? startExpanded : v === '1';
    } catch {
      return startExpanded;
    }
  });
  const [data, setData] = useState<TrackerData<TDetail> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tracker
      .loadData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [tracker]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(tracker.id), expanded ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [expanded, tracker.id]);

  const summary = useMemo(() => {
    if (!data) return null;
    const last365 = data.days.slice(-365);
    const total = totalValue(last365);
    const { current } = computeStreaks(data.days);
    return { total, current, hasData: data.days.some((d) => d.value > 0) };
  }, [data]);

  return (
    <Card>
      <Header onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
        <Label>{tracker.label}</Label>
        <Summary>
          {summary
            ? `${tracker.formatValue(summary.total)} · ${summary.current}-day streak`
            : error
            ? 'error'
            : 'loading…'}
        </Summary>
        <Toggle>{expanded ? '▾' : '▸'}</Toggle>
      </Header>

      {expanded && (
        <Body>
          {error && <Err>Failed to load: {error}</Err>}
          {!error && !data && <Summary>Loading…</Summary>}
          {!error && data && summary && !summary.hasData && (
            <EmptyHint>
              No data yet — run <code>yarn ingest --xml export.xml</code> to import
              your Apple Health history, then reload.
            </EmptyHint>
          )}
          {!error && data && summary && summary.hasData && (
            <>
              <StatsPanel
                days={data.days}
                unit={tracker.unit}
                formatValue={tracker.formatValue}
              />
              <Heatmap
                days={data.days}
                detailsByDate={data.detailsByDate}
                formatValue={tracker.formatValue}
                renderDayDetail={tracker.renderDayDetail}
              />
            </>
          )}
        </Body>
      )}
    </Card>
  );
}
