import React, { useMemo } from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Plus } from 'lucide-react';

type Props = {
  /** 이 화면이 가진 패널 타입 전부. */
  allTabs: readonly string[];
  /** 지금 트리에 올라와 있는 탭. 이미 열린 것은 고를 수 없다. */
  mountedTabs: string[];
  titleOf: (tabId: string) => string;
  onPick: (tabId: string) => void;
  disabled?: boolean;
};

/**
 * 패널 탭 스트립의 '+' 버튼.
 *
 * 같은 패널 타입을 두 번 열 수 있게 하면 어느 쪽이 어떤 상태인지가 모호해지고
 * (둘 다 같은 컨텍스트를 보므로 화면도 똑같다) 저장된 트리를 정규화할 때 중복 처리도
 * 필요해진다. 그래서 타입당 하나로 제한하고 이미 열린 것은 비활성으로 보여 준다.
 */
const AddPanelMenu: React.FC<Props> = ({ allTabs, mountedTabs, titleOf, onPick, disabled }) => {
  const items = useMemo<MenuProps['items']>(() => {
    const mounted = new Set(mountedTabs);
    return allTabs.map((tabId) => ({
      key: tabId,
      label: titleOf(tabId),
      disabled: mounted.has(tabId),
    }));
  }, [allTabs, mountedTabs, titleOf]);

  const allMounted = mountedTabs.length >= allTabs.length;

  return (
    <Dropdown
      trigger={['click']}
      disabled={disabled || allMounted}
      menu={{ items, onClick: ({ key }) => onPick(key) }}
    >
      <Tooltip title={allMounted ? '추가할 패널이 없습니다' : '패널 추가'}>
        <Button
          type="text"
          size="small"
          className="lt-tab-add"
          disabled={disabled || allMounted}
          aria-label="패널 추가"
          icon={<Plus size={14} />}
        />
      </Tooltip>
    </Dropdown>
  );
};

export default AddPanelMenu;
