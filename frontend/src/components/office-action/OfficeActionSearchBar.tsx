import React, { useState } from 'react';
import { Button, Dropdown, Input, Select, Tag, Tooltip, Typography } from 'antd';
import { ChevronDown, Plus, Search } from 'lucide-react';
import {
  PATENT_SEARCH_KEYWORD_TARGET_LABELS,
  PATENT_SEARCH_KEYWORD_TARGETS,
  type PatentSearchKeywordTarget,
  type PatentSearchUsableKeywordOperator,
} from '../../services/patentSearchApi';
import {
  groupOfficeActionKeywordConditions,
  officeActionKeywordDescription,
  officeActionKeywordLabel,
  type OfficeActionKeywordCondition,
} from './officeActionKeywords';

const { Text } = Typography;

const KEYWORD_OPERATOR_MENU_ITEMS = [
  { label: 'AND', key: 'AND' },
  { label: 'OR', key: 'OR' },
  { label: 'EXCLUDE', key: 'NOT' },
];

type Props = {
  conditions: OfficeActionKeywordCondition[];
  onConditionsChange: React.Dispatch<React.SetStateAction<OfficeActionKeywordCondition[]>>;
  onSearch: () => void;
  loading?: boolean;
};

/**
 * 문서 본문 전문(full-text) 조건 빌더.
 *
 * 첫 조건은 포함 조건으로 바로 추가하고, 후속 조건은 추가 시 AND/OR/EXCLUDE를 고른다.
 * OR로 이어진 조건은 같은 괄호 그룹, AND는 다음 그룹, EXCLUDE는 전역 제외로 표시한다.
 * 상세는 `docs/patent_search_api.md` 참고.
 */
const OfficeActionSearchBar: React.FC<Props> = ({
  conditions,
  onConditionsChange,
  onSearch,
  loading = false,
}) => {
  const [draft, setDraft] = useState<OfficeActionKeywordCondition>({
    query: '',
    target: 'officeAction',
    operator: 'AND',
  });

  const addCondition = (operator: PatentSearchUsableKeywordOperator = 'AND') => {
    const query = draft.query.trim();
    if (!query) return;

    const condition = { ...draft, query, operator };
    const label = officeActionKeywordLabel(condition);
    onConditionsChange((previous) => (
      previous.some((item) => officeActionKeywordLabel(item) === label)
        ? previous
        : [...previous, condition]
    ));
    // 같은 문서로 여러 검색어를 연달아 넣기 쉽도록 검색어만 비운다.
    setDraft((previous) => ({ ...previous, query: '' }));
  };

  const searchWithDraft = () => {
    // 첫 조건은 묵시적으로 포함(AND)이다. 기존 조건이 있으면 아래 버튼에서 연산자를 먼저
    // 골라야 하므로 이 함수에는 미확정 draft가 들어오지 않는다.
    if (conditions.length === 0) addCondition();
    // 검색 버튼만 Search API를 실행한다. 부모는 다음 render에서 검색하므로 방금 추가한
    // draft 조건까지 요청에 포함된다.
    onSearch();
  };

  const hasIncludeCondition = conditions.some((condition) => condition.operator !== 'NOT');
  const hasDraft = Boolean(draft.query.trim());
  const draftWillInclude = hasDraft;
  const hasOnlyExcludeSearch =
    (conditions.length > 0 || Boolean(draft.query.trim()))
    && !hasIncludeCondition
    && !draftWillInclude;
  const groupedConditions = groupOfficeActionKeywordConditions(conditions);
  const removeCondition = (condition: OfficeActionKeywordCondition) => {
    const label = officeActionKeywordLabel(condition);
    onConditionsChange((previous) =>
      previous.filter((item) => officeActionKeywordLabel(item) !== label),
    );
  };
  /**
   * 조건 chip.
   *
   * 문구는 검색어 길이만큼 길어질 수 있어 폭을 컨테이너까지로 묶고 말줄임한다. 묶지 않으면
   * 긴 chip이 카드 밖으로 흘러 **닫기(×)가 잘려 나가고, 그 조건을 지울 방법이 없어진다.**
   * 잘린 부분은 tooltip으로 읽는다.
   */
  const renderConditionTag = (condition: OfficeActionKeywordCondition) => {
    const description = officeActionKeywordDescription(condition);
    return (
      <Tooltip title={description}>
        <Tag
          closable
          className={`oa-condition-tag${
            condition.operator === 'NOT' ? ' oa-condition-tag-not' : ''
          }`}
          onClose={() => removeCondition(condition)}
        >
          {/* 말줄임은 이 span이 한다. Tag의 직계 텍스트 노드는 익명 flex item이라
              text-overflow가 걸리지 않는다. */}
          <span className="oa-condition-tag-label">{description}</span>
        </Tag>
      </Tooltip>
    );
  };

  return (
    <div className="oa-card oa-searchbar">
      <div className="oa-searchbar-row">
        <Select
          size="large"
          className="oa-searchbar-target"
          aria-label="검색 대상 문서"
          value={draft.target}
          onChange={(target: PatentSearchKeywordTarget) =>
            setDraft((previous) => ({ ...previous, target }))
          }
          options={PATENT_SEARCH_KEYWORD_TARGETS.map((target) => ({
            label: PATENT_SEARCH_KEYWORD_TARGET_LABELS[target],
            value: target,
          }))}
        />
        <Input
          allowClear
          size="large"
          className="oa-searchbar-input"
          value={draft.query}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, query: event.target.value }))
          }
          onPressEnter={(event) => {
            if (event.nativeEvent.isComposing || hasOnlyExcludeSearch) return;
            // Enter는 조합 조건만 확정한다. 새 기준 목록은 명시적인 '검색' 클릭으로만 받는다.
            addCondition('AND');
          }}
          placeholder={`${PATENT_SEARCH_KEYWORD_TARGET_LABELS[draft.target]} 본문 키워드`}
          prefix={<Search size={18} className="oa-searchbar-icon" />}
        />
        {conditions.length > 0 ? (
          <Dropdown
            trigger={['click']}
            placement="bottomLeft"
            menu={{
              items: KEYWORD_OPERATOR_MENU_ITEMS,
              onClick: ({ key }) =>
                addCondition(key as PatentSearchUsableKeywordOperator),
            }}
          >
            <Button
              size="large"
              disabled={!hasDraft}
              icon={<Plus size={18} />}
              className="oa-searchbar-add-button oa-condition-add-dropdown"
            >
              조건 추가
              <ChevronDown size={13} />
            </Button>
          </Dropdown>
        ) : (
          <Button
            size="large"
            disabled={!hasDraft}
            onClick={() => addCondition()}
            icon={<Plus size={18} />}
            className="oa-searchbar-add-button"
          >
            조건 추가
          </Button>
        )}
        <Button
          type="primary"
          size="large"
          loading={loading}
          disabled={hasOnlyExcludeSearch || (conditions.length > 0 && hasDraft)}
          title={conditions.length > 0 && hasDraft
            ? '새 키워드의 AND/OR/EXCLUDE 관계를 먼저 선택해 주세요.'
            : undefined}
          onClick={searchWithDraft}
          icon={<Search size={18} />}
          className="oa-searchbar-button"
        >
          검색
        </Button>
      </div>

      {conditions.length > 0 && (
        <div className="oa-searchbar-conditions" aria-label="조합된 키워드 조건">
          {groupedConditions.includeGroups.map((group, groupIndex) => (
            <React.Fragment key={group.map(officeActionKeywordLabel).join('|')}>
              {groupIndex > 0 && <span className="oa-condition-join">AND</span>}
              <span className="oa-condition-group">
                {group.length > 1 && (
                  <span className="oa-condition-parenthesis" aria-hidden="true">(</span>
                )}
                {group.map((condition, conditionIndex) => (
                  <React.Fragment key={officeActionKeywordLabel(condition)}>
                    {conditionIndex > 0 && (
                      <span className="oa-condition-join">OR</span>
                    )}
                    {renderConditionTag(condition)}
                  </React.Fragment>
                ))}
                {group.length > 1 && (
                  <span className="oa-condition-parenthesis" aria-hidden="true">)</span>
                )}
              </span>
            </React.Fragment>
          ))}
          {groupedConditions.excludes.map((condition) => (
            <React.Fragment key={officeActionKeywordLabel(condition)}>
              <span className="oa-condition-join oa-condition-join-exclude">
                EXCLUDE
              </span>
              {renderConditionTag(condition)}
            </React.Fragment>
          ))}
        </div>
      )}

      {conditions.length > 0 && !hasIncludeCondition && (
        <Text type="warning" className="oa-keyword-warning">
          제외 조건만으로는 검색할 수 없습니다. 포함 조건을 하나 이상 추가해 주세요.
        </Text>
      )}
    </div>
  );
};

export default OfficeActionSearchBar;
