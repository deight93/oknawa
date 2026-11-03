'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import styled from 'styled-components';
import { MapPin } from 'lucide-react';

import Address from '@/components/Address';
import useSearchForm from '@/hooks/form/search/useSearchForm';
import { bottomSheetState, SearchState } from '@/jotai/global/store';
import { getApiErrorMessage } from '@/api/errors';
import TravelModeSelector from './TravelModeSelector';

interface DepartureEditorProps {
  initialValue: SearchState;
  onSave: (value: SearchState) => void | Promise<void>;
  onCancel: () => void;
}

export default function DepartureEditor({
  initialValue,
  onSave,
  onCancel,
}: DepartureEditorProps) {
  const id = useId();
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useSearchForm(initialValue);
  const setBottomSheet = useSetAtom(bottomSheetState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const active = useRef(false);
  const addressSearch = useRef<ReactNode>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      setBottomSheet(previous =>
        addressSearch.current && previous.contents === addressSearch.current
          ? { ...previous, isOpen: false, contents: null }
          : previous,
      );
    };
  }, [setBottomSheet]);
  const address = watch('address');

  const save = async (value: SearchState) => {
    if (inFlight.current || !active.current) return;
    inFlight.current = true;
    setIsSaving(true);
    setError('');
    try {
      await onSave(value);
      if (active.current) onCancel();
    } catch (cause) {
      if (active.current)
        setError(
          getApiErrorMessage(
            cause,
            '출발지를 수정하지 못했어요. 다시 시도해주세요.',
          ),
        );
    } finally {
      if (active.current) {
        inFlight.current = false;
        setIsSaving(false);
      }
    }
  };

  return (
    <Form
      aria-label={`${initialValue.name} 출발지 수정`}
      onSubmit={handleSubmit(save)}
    >
      <Title>출발지 수정</Title>
      <Fields disabled={isSaving}>
        <label htmlFor={`${id}-name`}>이름</label>
        <NameInput
          id={`${id}-name`}
          aria-label="수정할 이름"
          type="text"
          maxLength={5}
          autoComplete="off"
          {...register('name')}
        />
        {errors.name && (
          <ErrorMessage role="alert">{errors.name.message}</ErrorMessage>
        )}
        <label>출발지</label>
        <AddressButton
          type="button"
          aria-label="수정할 출발지 검색"
          onClick={() => {
            addressSearch.current = <Address setValue={setValue} />;
            setBottomSheet(previous => ({
              ...previous,
              isOpen: true,
              isFullContents: true,
              contents: addressSearch.current,
            }));
          }}
        >
          <MapPin size={18} aria-hidden="true" />
          <span>
            {address.regionName}
            <small>{address.fullAddress}</small>
          </span>
          <span>변경</span>
        </AddressButton>
        <TravelModeSelector
          value={watch('travelMode') ?? 'transit'}
          onChange={mode => setValue('travelMode', mode, { shouldDirty: true })}
        />
        <Actions>
          <ActionButton type="button" onClick={onCancel}>
            취소
          </ActionButton>
          <SaveButton type="submit" aria-busy={isSaving}>
            {isSaving ? '저장 중…' : '수정 저장'}
          </SaveButton>
        </Actions>
      </Fields>
      {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
    </Form>
  );
}

const Form = styled.form`
  padding: 16px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--surface-raised);
  min-width: 0;
`;
const Title = styled.h2`
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
`;
const Fields = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  label {
    font-size: 14px;
    color: var(--text-secondary);
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.6;
  }
`;
const NameInput = styled.input`
  &[type='text'] {
    transform: none;
    width: 100%;
    min-width: 0;
    padding: 12px;
    font-size: 16px;
    color: var(--text-primary);
    background: var(--surface-muted);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
  }
`;
const AddressButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  min-height: 48px;
  text-align: left;
  background: var(--surface-muted);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  svg,
  > span:last-child {
    flex-shrink: 0;
  }
  > span:first-of-type {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
    color: var(--text-muted);
    margin-top: 4px;
  }
`;
const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;
const ActionButton = styled.button`
  min-height: 44px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  font-weight: 600;
`;
const SaveButton = styled(ActionButton)`
  background: var(--primary);
  color: var(--button-text-on-primary);
  border-color: var(--primary);
`;
const ErrorMessage = styled.p`
  margin-top: 8px;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
`;
