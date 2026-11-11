import styled from 'styled-components';

export const Disclosure = styled.details`
  width: 100%;
  min-width: 0;
  max-width: 100%;
  border-top: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--font-body);
  line-height: 1.6;
  word-break: keep-all;
  overflow-wrap: anywhere;

  summary {
    min-height: 44px;
    padding: 10px 0;
    font-weight: 600;
    cursor: pointer;
  }

  summary:focus-visible,
  select:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
    border-radius: 4px;
  }

  .route-details-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 4px 0 12px;
  }

  label {
    color: var(--text-secondary);
    font-size: var(--font-label);
    font-weight: 500;
  }

  select {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--text-primary);
    font: inherit;
    cursor: pointer;
  }

  ol {
    display: grid;
    gap: 16px;
    margin: 4px 0;
    padding-inline-start: 1.75em;
    list-style: decimal;
  }

  li {
    min-width: 0;
    padding-inline-start: 4px;
  }

  li::marker {
    color: var(--text-secondary);
    font-weight: 600;
  }

  h3 {
    font-size: var(--font-body);
    font-weight: 600;
  }

  p {
    color: var(--text-secondary);
  }

  li p {
    margin-top: 4px;
  }

  .route-details-notes {
    display: grid;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-size: var(--font-caption);
  }
`;
