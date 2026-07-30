import { Button, Card, Result, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthSessionProvider } from '../../contexts/AuthSessionContext';
import {
  AccessContextProvider,
  useAccessContext,
} from '../../contexts/AccessContext';
import { AUTH_REQUIRED_EVENT, authApi, type AuthSession } from '../../services/authApi';

type RuntimeWindow = Window & { _env_?: { VITE_GROUPWARE_ORIGIN?: string } };

const runtimeGroupwareOrigin = typeof window !== 'undefined'
  ? (window as RuntimeWindow)._env_?.VITE_GROUPWARE_ORIGIN
  : undefined;
const configuredGroupwareOrigin = runtimeGroupwareOrigin || import.meta.env.VITE_GROUPWARE_ORIGIN;
const GROUPWARE_ORIGIN = !configuredGroupwareOrigin || configuredGroupwareOrigin.includes('${')
  ? 'https://voronoi.app'
  : configuredGroupwareOrigin.replace(/\/$/, '');
const GROUPWARE_LOADING_URL = new URL('/loading', GROUPWARE_ORIGIN).toString();
const REQUEST_TIMEOUT_MS = 30000;

type AuthState = 'checking' | 'required' | 'waiting' | 'exchanging' | 'authenticated' | 'error';
type GroupwareQueryAuth =
  | { type: 'none' }
  | { type: 'invalid' }
  | { type: 'valid'; email: string; loginToken: string };

const decodeQueryValue = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const readGroupwareQueryAuth = (search: string): GroupwareQueryAuth => {
  const values = new Map<string, Array<string | null>>();
  for (const part of search.replace(/^\?/, '').split('&')) {
    if (!part) continue;
    const separatorIndex = part.indexOf('=');
    const rawKey = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
    const rawValue = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : '';
    const key = decodeQueryValue(rawKey.replace(/\+/g, ' '));
    if (key !== 'id' && key !== 'token') continue;
    const currentValues = values.get(key) ?? [];
    // Token의 인코딩되지 않은 `+`도 기존 Groupware URL과 호환되도록 그대로 보존한다.
    currentValues.push(decodeQueryValue(rawValue));
    values.set(key, currentValues);
  }

  const ids = values.get('id') ?? [];
  const tokens = values.get('token') ?? [];
  if (ids.length === 0 && tokens.length === 0) return { type: 'none' };
  const rawEmail = ids[0];
  const rawLoginToken = tokens[0];
  if (ids.length !== 1 || tokens.length !== 1 ||
    typeof rawEmail !== 'string' || typeof rawLoginToken !== 'string') {
    return { type: 'invalid' };
  }

  const email = rawEmail.trim().toLowerCase();
  const loginToken = rawLoginToken.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !loginToken) {
    return { type: 'invalid' };
  }
  return { type: 'valid', email, loginToken };
};

const removeGroupwareQueryAuth = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('id');
  url.searchParams.delete('token');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const RouteSessionValidator: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const { refresh } = useAccessContext();
  const initialPathRef = useRef(location.pathname);

  useEffect(() => {
    if (initialPathRef.current === location.pathname) return;
    initialPathRef.current = location.pathname;

    let active = true;
    const validateSession = async () => {
      try {
        const currentSession = await authApi.getSession();
        if (active) {
          if (!currentSession) {
            window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
          } else {
            await refresh();
          }
        }
      } catch {
        // 일시적인 통신 오류는 각 보호 API의 인증 처리에 맡기고 현재 화면을 유지한다.
      }
    };

    void validateSession();
    return () => {
      active = false;
    };
  }, [location.pathname, refresh]);

  return children;
};

const AuthGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>('checking');
  const [error, setError] = useState('');
  const [session, setSession] = useState<AuthSession | null>(null);
  const sourceRef = useRef<Window | null>(null);
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);

  const cleanup = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    intervalRef.current = undefined;
    timeoutRef.current = undefined;
  }, []);

  const requestToken = useCallback((source: Window) => {
    cleanup();
    sourceRef.current = source;
    setState('waiting');
    const send = () => {
      if (source.closed) {
        cleanup();
        setState('required');
        return;
      }
      source.postMessage({ type: 'LOGIN_TOKEN' }, GROUPWARE_ORIGIN);
    };
    send();
    intervalRef.current = window.setInterval(send, 1000);
    timeoutRef.current = window.setTimeout(() => {
      cleanup();
      setError('30초 안에 Groupware 로그인 정보를 확인하지 못했습니다.');
      setState('error');
    }, REQUEST_TIMEOUT_MS);
  }, [cleanup]);

  useEffect(() => {
    let active = true;
    const queryAuth = readGroupwareQueryAuth(window.location.search);
    if (queryAuth.type !== 'none') removeGroupwareQueryAuth();

    const bootstrap = async () => {
      if (queryAuth.type === 'invalid') {
        setError('Groupware 자동 로그인 주소의 사용자 ID 또는 Token이 올바르지 않습니다.');
        setState('error');
        return;
      }

      if (queryAuth.type === 'valid') {
        let loginToken = queryAuth.loginToken;
        setState('exchanging');
        try {
          const value = await authApi.exchange(loginToken, queryAuth.email);
          if (!active) return;
          setSession(value);
          setState('authenticated');
        } catch (exchangeError) {
          if (!active) return;
          setError(exchangeError instanceof Error ? exchangeError.message : '인증에 실패했습니다.');
          setState('error');
        } finally {
          loginToken = '';
          queryAuth.loginToken = '';
        }
        return;
      }

      try {
        const value = await authApi.getSession();
        if (!active) return;
        if (value) {
          setSession(value);
          setState('authenticated');
        } else if (window.opener && !window.opener.closed) {
          requestToken(window.opener);
        } else {
          setState('required');
        }
      } catch {
        if (active) setState('required');
      }
    };

    void bootstrap();
    return () => {
      active = false;
      cleanup();
    };
  }, [cleanup, requestToken]);

  useEffect(() => {
    const handleAuthRequired = () => {
      cleanup();
      setSession(null);
      setError('로그인 세션이 만료되었습니다. Groupware 인증을 다시 확인해주세요.');
      setState('error');
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [cleanup]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== GROUPWARE_ORIGIN || event.source !== sourceRef.current) return;
      if (event.data?.type === 'LOGIN_TOKEN_ERROR') {
        cleanup();
        setError('Groupware 로그인 Token을 가져오지 못했습니다.');
        setState('error');
        return;
      }
      if (event.data?.type !== 'LOGIN_TOKEN_SUCCESS' || typeof event.data.payload !== 'string') return;
      cleanup();
      setState('exchanging');
      try {
        const value = await authApi.exchange(event.data.payload);
        setSession(value);
        setState('authenticated');
        popupRef.current?.close();
      } catch (exchangeError) {
        setError(exchangeError instanceof Error ? exchangeError.message : '인증에 실패했습니다.');
        setState('error');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [cleanup]);

  const openGroupware = () => {
    setError('');
    const popup = window.open(
      GROUPWARE_LOADING_URL,
      'medichem-groupware-auth',
      'popup,width=400,height=400',
    );
    if (!popup) {
      setError('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해주세요.');
      setState('error');
      return;
    }
    popupRef.current = popup;
    requestToken(popup);
  };

  if (state === 'authenticated' && session) {
    return (
      <AuthSessionProvider session={session}>
        <AccessContextProvider>
          <RouteSessionValidator>{children}</RouteSessionValidator>
        </AccessContextProvider>
      </AuthSessionProvider>
    );
  }

  const loading = state === 'checking' || state === 'waiting' || state === 'exchanging';
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card style={{ width: 'min(440px, 100%)', textAlign: 'center' }}>
        {loading ? (
          <Spin tip={state === 'exchanging' ? 'Medichem session 생성 중' : 'Groupware 인증 확인 중'} size="large">
            <div style={{ minHeight: 160 }} />
          </Spin>
        ) : state === 'error' ? (
          <Result status="warning" title="로그인 확인 실패" subTitle={error} extra={<Button type="primary" onClick={openGroupware}>다시 확인</Button>} />
        ) : (
          <>
            <Typography.Title level={3}>Medichem Workspace</Typography.Title>
            <Typography.Paragraph type="secondary">Groupware 로그인 정보를 확인해야 사용할 수 있습니다.</Typography.Paragraph>
            <Button type="primary" onClick={openGroupware}>Groupware 인증 확인</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default AuthGate;
