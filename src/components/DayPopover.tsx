import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

interface Props {
  date: string;
  cellRect: DOMRect;
  containerRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}

const POPOVER_WIDTH = 280;

const Floating = styled.div<{ $top: number; $left: number }>`
  position: absolute;
  top: ${(p) => p.$top}px;
  left: ${(p) => p.$left}px;
  width: ${POPOVER_WIDTH}px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 10;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const DateText = styled.div`
  font-weight: 600;
  color: #c9d1d9;
  font-size: 14px;
`;

const Close = styled.button`
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
  line-height: 1;
  &:hover { color: #c9d1d9; }
`;

function prettyDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DayPopover(props: Props): JSX.Element {
  const { date, cellRect, containerRect, onClose, children } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({
    top: cellRect.bottom - containerRect.top + 6,
    left: Math.max(
      0,
      Math.min(
        cellRect.left - containerRect.left - POPOVER_WIDTH / 2 + cellRect.width / 2,
        containerRect.width - POPOVER_WIDTH
      )
    ),
  });

  useEffect(() => {
    setPos({
      top: cellRect.bottom - containerRect.top + 6,
      left: Math.max(
        0,
        Math.min(
          cellRect.left - containerRect.left - POPOVER_WIDTH / 2 + cellRect.width / 2,
          containerRect.width - POPOVER_WIDTH
        )
      ),
    });
  }, [cellRect, containerRect]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Floating ref={ref} $top={pos.top} $left={pos.left}>
      <Header>
        <DateText>{prettyDate(date)}</DateText>
        <Close onClick={onClose} aria-label="Close">×</Close>
      </Header>
      {children}
    </Floating>
  );
}
