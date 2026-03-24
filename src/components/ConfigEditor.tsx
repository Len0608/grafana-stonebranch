import React, { ChangeEvent, useState } from 'react';
import {
  InlineField,
  InlineFieldRow,
  Input,
  SecretInput,
  RadioButtonGroup,
  Stack,
  FieldSet,
} from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { UACDataSourceOptions, UACSecureJsonData, AuthType } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<UACDataSourceOptions, UACSecureJsonData> {}

const AUTH_OPTIONS: Array<SelectableValue<AuthType>> = [
  { label: 'Basic Auth', value: 'basic' },
  { label: 'PAT Token', value: 'pat' },
];

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData, secureJsonFields } = options;
  const authType: AuthType = jsonData.authType ?? 'basic';
  const isAuthConfigured = Boolean(secureJsonFields.authorizationHeader);

  // Local write-only credential state (never readable back from server)
  const [password, setPassword] = useState('');
  const [patToken, setPatToken] = useState('');

  function patchJsonData(patch: Partial<UACDataSourceOptions>) {
    onOptionsChange({ ...options, jsonData: { ...jsonData, ...patch } });
  }

  function setAuthHeader(header: string) {
    onOptionsChange({
      ...options,
      jsonData,
      secureJsonData: { authorizationHeader: header },
    });
  }

  function resetAuth() {
    setPassword('');
    setPatToken('');
    onOptionsChange({
      ...options,
      jsonData,
      secureJsonFields: { ...options.secureJsonFields, authorizationHeader: false },
      secureJsonData: { authorizationHeader: '' },
    });
  }

  function handleAuthTypeChange(value: AuthType) {
    resetAuth();
    patchJsonData({ authType: value });
  }

  function handleUsernameChange(e: ChangeEvent<HTMLInputElement>) {
    // Recompute auth header if password is already entered in this session
    patchJsonData({ username: e.target.value });
    if (password) {
      setAuthHeader('Basic ' + btoa(`${e.target.value}:${password}`));
    }
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    const pw = e.target.value;
    setPassword(pw);
    setAuthHeader('Basic ' + btoa(`${jsonData.username ?? ''}:${pw}`));
  }

  function handlePatChange(e: ChangeEvent<HTMLInputElement>) {
    const token = e.target.value;
    setPatToken(token);
    setAuthHeader('Bearer ' + token);
  }

  return (
    <Stack direction="column" gap={3}>
      <FieldSet label="Connection">
        <InlineFieldRow>
          <InlineField
            label="URL"
            labelWidth={16}
            tooltip="Universal Controller base URL, e.g. https://mycontroller.example.com"
          >
            <Input
              value={jsonData.url ?? ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                // Set both options.url (required for instanceSettings.url / proxy URL)
                // and jsonData.url (used in plugin.json route template)
                onOptionsChange({
                  ...options,
                  url: e.target.value,
                  jsonData: { ...jsonData, url: e.target.value },
                });
              }}
              placeholder="https://mycontroller.example.com"
              width={40}
            />
          </InlineField>
        </InlineFieldRow>
      </FieldSet>

      <FieldSet label="Authentication">
        <InlineFieldRow>
          <InlineField label="Auth Type" labelWidth={16}>
            <RadioButtonGroup<AuthType>
              options={AUTH_OPTIONS}
              value={authType}
              onChange={handleAuthTypeChange}
            />
          </InlineField>
        </InlineFieldRow>

        {authType === 'basic' && (
          <>
            <InlineFieldRow>
              <InlineField label="Username" labelWidth={16}>
                <Input
                  value={jsonData.username ?? ''}
                  onChange={handleUsernameChange}
                  placeholder="username"
                  width={24}
                  autoComplete="off"
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField
                label="Password"
                labelWidth={16}
                tooltip={
                  isAuthConfigured && !password
                    ? 'Password is saved. Re-enter to change, or click Reset to clear.'
                    : 'Enter the UAC user password'
                }
              >
                <SecretInput
                  isConfigured={isAuthConfigured}
                  value={password}
                  onChange={handlePasswordChange}
                  onReset={resetAuth}
                  placeholder="password"
                  width={24}
                  autoComplete="new-password"
                />
              </InlineField>
            </InlineFieldRow>
          </>
        )}

        {authType === 'pat' && (
          <InlineFieldRow>
            <InlineField
              label="PAT Token"
              labelWidth={16}
              tooltip="Personal Access Token from Universal Controller"
            >
              <SecretInput
                isConfigured={isAuthConfigured}
                value={patToken}
                onChange={handlePatChange}
                onReset={resetAuth}
                placeholder="Paste your PAT token"
                width={40}
                autoComplete="off"
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </FieldSet>
    </Stack>
  );
}
