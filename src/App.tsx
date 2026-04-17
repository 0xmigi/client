import React from 'react';
import styled from 'styled-components';
import { TrackerCard } from './components/TrackerCard';
import { trackers } from './trackers/registry';

const Page = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px 80px 20px;
`;

const Title = styled.h1`
  margin: 0 0 4px 0;
  font-size: 22px;
  color: #c9d1d9;
`;

const Subtitle = styled.p`
  margin: 0 0 24px 0;
  color: #8b949e;
  font-size: 13px;
`;

export function App(): JSX.Element {
  return (
    <Page>
      <Title>Life Heatmap</Title>
      <Subtitle>Personal tracking dashboard · {trackers.length} tracker{trackers.length === 1 ? '' : 's'}</Subtitle>
      {trackers.map((t, i) => (
        <TrackerCard key={t.id} tracker={t} startExpanded={i === 0} />
      ))}
    </Page>
  );
}
