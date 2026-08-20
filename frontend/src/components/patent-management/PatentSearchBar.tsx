import React, { useState } from 'react';
import { Button, Input } from 'antd';
import { Filter, Search } from 'lucide-react';

interface PatentSearchBarProps {
  /** 검색 실행. 빈 문자열이면 필터 해제라는 뜻이다. 참조가 안정적이어야 한다. */
  onSearch: (value: string) => void;
}

/**
 * 관리 특허 목록 검색바. MainLayout 헤더(headerContent)에 얹혀 breadcrumb과 같은 줄에 선다.
 *
 * 입력값을 이 컴포넌트가 직접 들고 있는 이유가 있다. 예전에는 페이지가 값을 들고
 * 타이핑마다 `setHeaderContent(<Input value=... />)`로 헤더를 다시 심었는데, 그러면
 * store를 한 바퀴 돌아 렌더가 한 틱 늦게 오면서 한글 조합(IME) 중에 input.value를
 * 다시 쓰게 된다. 브라우저는 그 시점에 조합을 확정해버려서 "헤테" 대신 "ㅎㅔㅌㅔ"가
 * 남았다. 값을 지역 상태로 두면 타이핑이 이 컴포넌트 안에서만 리렌더되고 헤더는 한 번만
 * 심으면 되므로 조합이 끊기지 않는다.
 */
const PatentSearchBar: React.FC<PatentSearchBarProps> = ({ onSearch }) => {
  const [value, setValue] = useState('');

  const handleChange = (next: string) => {
    setValue(next);
    // 지우면(allowClear 포함) 검색 버튼을 또 누르지 않아도 전체 목록으로 돌아온다.
    if (next.trim() === '') onSearch('');
  };

  return (
    <span className="pm-search-bar pm-search-bar-header">
      <Input
        allowClear
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onPressEnter={() => onSearch(value)}
        placeholder="관리번호 · 출원번호 · 명칭 · 출원인 검색"
        aria-label="관리 특허 목록 검색"
        prefix={<Search size={16} />}
      />
      <Button type="primary" icon={<Filter size={14} />} onClick={() => onSearch(value)}>
        검색
      </Button>
    </span>
  );
};

export default PatentSearchBar;
