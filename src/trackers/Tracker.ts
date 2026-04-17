import React from 'react';

export interface DayAggregate {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface TrackerData<TDetail> {
  days: DayAggregate[];
  detailsByDate: Record<string, TDetail[]>;
}

export interface Tracker<TDetail> {
  id: string;
  label: string;
  unit: string;
  description: string;
  formatValue: (value: number) => string;
  loadData: () => Promise<TrackerData<TDetail>>;
  renderDayDetail: (date: string, details: TDetail[] | undefined) => React.ReactNode;
}
