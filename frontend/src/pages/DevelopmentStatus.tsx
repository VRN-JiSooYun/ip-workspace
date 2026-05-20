import React, { useEffect, useMemo, useState } from 'react';
import { Button, Progress, Space, Tag, Typography, theme } from 'antd';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ExternalLink,
  PauseCircle,
  Users,
} from 'lucide-react';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useUIStore } from '../store/useUIStore';

const { Text, Title } = Typography;

type ProjectStatus = '개발중' | '검토중' | '완료' | '보류';

interface DevelopmentProject {
  id: string;
  name: string;
  owner: string;
  category: string;
  targetDate: string;
  status: ProjectStatus;
  progress: number;
  currentStage: string;
  summary: string;
  updates: string[];
  nextActions: string[];
  blockers?: string[];
}

const phases = ['요구사항', '설계', 'UI/UX', '개발', '테스트', '배포', '운영'];

const projects: DevelopmentProject[] = [
  {
    id: 'my-workspace',
    name: 'My Workspace',
    owner: '개똥이',
    category: 'Frontend, Backend',
    targetDate: '2026.05.24',
    status: '개발중',
    progress: 30,
    currentStage: 'UI/UX',
    summary: '화이트보드 캔버스 기반 구조 편집, 이미지 삽입, ChemDraw 연동 UX를 정리하고 있습니다.',
    updates: ['ChemDraw 붙여넣기 후 확인 추가 플로우 반영', '이미지 삽입 파일 선택 연결', '선택 삭제/전체 삭제 확인 UX 공통화'],
    nextActions: ['캔버스 undo/redo 안정화', 'SVG 다크 모드 변환 케이스 추가 점검'],
  },
  {
    id: 'patent-analysis',
    name: '특허 분석',
    owner: '문서/AI 파트',
    category: 'Documents',
    targetDate: '2026.05.31',
    status: '개발중',
    progress: 75,
    currentStage: 'GroupWare 1차 배포중',
    summary: '특허 PDF, 원본 추출 데이터, 정제 데이터, 테이블 이미지를 한 화면에서 검토하는 분석 워크플로우입니다.',
    updates: ['PDF JBig2 WASM 경로 설정', 'Raw/Clean table 조건부 y축 스크롤 적용', 'ChemDraw 호출 아이콘 통일'],
    nextActions: ['PDF 페이지 이동 안정화', '분석 결과 필터 조건 저장'],
    blockers: ['일부 스캔 PDF의 이미지 디코딩 warning 지속 확인 필요'],
  },
  {
    id: 'vora',
    name: 'VORA',
    owner: '홍길동',
    category: '단백질/리간드 구조',
    targetDate: '2026.05.20',
    status: '완료',
    progress: 100,
    currentStage: '운영중',
    summary: '2.1.5 버전 배포 준비중이며, 내부 VRN과 연동하여 단백질/리간드 구조 시각화와 분석 기능을 제공합니다.',
    updates: ['내부 compound 연동(VRN)', '버그, 수정  사항 처리'],
    nextActions: ['내부 protein 구조 연동', '모바일 밀도 점검'],
  },
  {
    id: 'chem-space',
    name: 'Chemical Space 3D',
    owner: '분석 시각화',
    category: 'Visualization',
    targetDate: '2026.06.07',
    status: '개발중',
    progress: 62,
    currentStage: '개발',
    summary: '화합물 속성 기반 2D/3D 분포 시각화와 chart interaction UX를 개선하고 있습니다.',
    updates: ['3D chart mouseover grid line 비표시 처리', 'Axis 표시 toggle UX 통일'],
    nextActions: ['선택 compound 상세 패널 연결', '범례/필터 연동'],
  },
  {
    id: 'synthesis-board',
    name: '합성 보드',
    owner: '합성 관리',
    category: 'Operations',
    targetDate: '2026.06.14',
    status: '검토중',
    progress: 55,
    currentStage: 'UI/UX',
    summary: '합성 요청, 담당자 배정, 완료 현황을 한 화면에서 관리하는 운영 보드입니다.',
    updates: ['필터 toggle UX 통일', '그룹/상세 split layout 유지'],
    nextActions: ['담당자별 상태 집계 추가', '합성 요청 상세 modal 설계'],
  },
  {
    id: 'backend-api',
    name: 'Backend API Scaffold',
    owner: 'Platform',
    category: 'Infra',
    targetDate: '미정',
    status: '보류',
    progress: 18,
    currentStage: '요구사항',
    summary: 'NestJS/Prisma 기반 API 서버는 현재 프론트엔드 mock 데이터 개발 이후로 보류되어 있습니다.',
    updates: ['프론트엔드 mock 기반 화면 우선 구현'],
    nextActions: ['API 우선순위 확정', '도메인별 schema 초안 작성'],
    blockers: ['백엔드 구현 범위 미확정'],
  },
  {
    id: 'toggle-ux',
    name: 'Common Toggle UX',
    owner: 'Frontend',
    category: 'Design System',
    targetDate: '2026.05.18',
    status: '완료',
    progress: 100,
    currentStage: '운영',
    summary: 'Switch 기반 선택 UX를 Recent Projects와 동일한 ToggleTag 형태로 통일했습니다.',
    updates: ['전체 페이지 Switch 제거', '체크 해제 outline UX 적용', '간격 축소'],
    nextActions: ['실사용 피드백 기반 색상/밀도 조정'],
  },
];

const statusMeta: Record<ProjectStatus, { color: string; icon: React.ReactNode }> = {
  개발중: { color: 'processing', icon: <CircleDot size={14} /> },
  검토중: { color: 'warning', icon: <Clock3 size={14} /> },
  완료: { color: 'success', icon: <CheckCircle2 size={14} /> },
  보류: { color: 'default', icon: <PauseCircle size={14} /> },
};

const DevelopmentStatus: React.FC = () => {
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();
  const [expandedId, setExpandedId] = useState<string>(projects[1]?.id ?? projects[0]?.id);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '수리응용2팀 서비스 개발 진행 현황' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const summaryItems = useMemo(() => {
    const inProgress = projects.filter((project) => project.status === '개발중').length;
    const reviewing = projects.filter((project) => project.status === '검토중').length;
    const done = projects.filter((project) => project.status === '완료').length;
    const paused = projects.filter((project) => project.status === '보류').length;
    const averageProgress = Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length);

    return [
      { label: '전체 서비스', value: projects.length, tone: token.colorText },
      { label: '개발중', value: inProgress, tone: token.colorPrimary },
      { label: '검토중', value: reviewing, tone: token.colorWarning },
      { label: '완료', value: done, tone: token.colorSuccess },
      { label: '보류', value: paused, tone: token.colorTextTertiary },
      { label: '평균 진행률', value: `${averageProgress}%`, tone: token.colorPrimary },
    ];
  }, [token]);

  const expandedProject = projects.find((project) => project.id === expandedId);

  return (
    <div
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>현재 프로젝트 현황</Title>
            <Text type="secondary">서비스 개발 단계와 최근 작업 내역을 프로젝트 단위로 추적합니다.</Text>
          </div>
          <Space wrap>
            <Tag color="blue">2026.05 기준</Tag>
            <Tag>Mock data</Tag>
          </Space>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="v-table-card"
              style={{
                padding: 16,
                background: token.colorBgContainer,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
              <div style={{ marginTop: 6, color: item.tone, fontSize: 24, fontWeight: 800 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="v-table-card" style={{ background: token.colorBgContainer, overflow: 'hidden' }}>
          <div className="v-table-header" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color={token.colorPrimary} />
              <Text strong>수리응용2팀 서비스 개발 파이프라인</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>행을 클릭하면 상세 현황이 펼쳐집니다.</Text>
          </div>

          <div style={{ padding: 20, overflowX: 'auto' }}>
            <div style={{ minWidth: 1080 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '320px repeat(7, 1fr) 52px',
                  alignItems: 'center',
                  padding: '0 16px 10px',
                  columnGap: 0,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700 }}>Service</Text>
                {phases.map((phase) => (
                  <Text key={phase} type="secondary" style={{ textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                    {phase}
                  </Text>
                ))}
                <span />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projects.map((project) => {
                  const isExpanded = expandedId === project.id;
                  const meta = statusMeta[project.status];

                  return (
                    <div
                      key={project.id}
                      style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 18,
                        overflow: 'hidden',
                        background: token.colorBgElevated,
                        boxShadow: isExpanded ? '0 8px 24px rgba(0, 0, 0, 0.06)' : 'none',
                        transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? '' : project.id)}
                        style={{
                          width: '100%',
                          border: 0,
                          outline: 'none',
                          background: isExpanded ? token.colorFillAlter : 'transparent',
                          padding: '16px',
                          cursor: 'pointer',
                          display: 'grid',
                          gridTemplateColumns: '320px 1fr 52px',
                          alignItems: 'center',
                          textAlign: 'left',
                          color: token.colorText,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text strong style={{ fontSize: 16 }}>{project.name}</Text>
                            <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginInlineEnd: 0 }}>
                              {meta.icon}
                              {project.status}
                            </Tag>
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {project.category} · {project.owner} · 목표 {project.targetDate}
                          </Text>
                        </div>

                        <div style={{ position: 'relative', height: 46, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                          <div
                            style={{
                              position: 'absolute',
                              inset: '6px 12px',
                              display: 'grid',
                              gridTemplateColumns: `repeat(${phases.length}, 1fr)`,
                              pointerEvents: 'none',
                            }}
                          >
                            {phases.map((phase) => (
                              <div key={phase} style={{ borderLeft: `1px solid ${token.colorBorderSecondary}` }} />
                            ))}
                          </div>
                          <div
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: 16,
                              borderRadius: 999,
                              background: token.colorFillSecondary,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${project.progress}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: project.status === '완료'
                                  ? token.colorSuccess
                                  : `linear-gradient(90deg, ${token.colorPrimaryBg}, ${token.colorPrimary}, #ff6a2a)`,
                              }}
                            />
                          </div>
                          <Text
                            style={{
                              position: 'absolute',
                              left: `calc(${project.progress}% - 14px)`,
                              top: -2,
                              transform: 'translateX(-50%)',
                              fontSize: 11,
                              fontWeight: 700,
                              color: isExpanded ? token.colorPrimary : token.colorTextSecondary,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {project.currentStage}
                          </Text>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: token.colorPrimary }}>
                          <ChevronDown size={22} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            padding: '22px 24px 24px',
                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                            background: token.colorBgContainer,
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 20 }}>
                            <div>
                              <Text strong>프로젝트 요약</Text>
                              <p style={{ margin: '8px 0 0', color: token.colorTextSecondary, lineHeight: 1.7 }}>{project.summary}</p>
                              <div style={{ marginTop: 16 }}>
                                <Progress percent={project.progress} strokeColor={token.colorPrimary} trailColor={token.colorFillSecondary} />
                              </div>
                            </div>

                            <div>
                              <Text strong>최근 업데이트</Text>
                              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {project.updates.map((update) => (
                                  <Text key={update} style={{ fontSize: 13 }}>
                                    <CheckCircle2 size={13} color={token.colorSuccess} style={{ marginRight: 6, verticalAlign: -2 }} />
                                    {update}
                                  </Text>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Text strong>다음 액션</Text>
                              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {project.nextActions.map((action) => (
                                  <Text key={action} style={{ fontSize: 13 }}>
                                    <ArrowRight size={13} color={token.colorPrimary} style={{ marginRight: 6, verticalAlign: -2 }} />
                                    {action}
                                  </Text>
                                ))}
                              </div>
                            </div>
                          </div>

                          {project.blockers && project.blockers.length > 0 && (
                            <div
                              style={{
                                marginTop: 18,
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: token.colorWarningBg,
                                color: token.colorWarningText,
                              }}
                            >
                              <AlertCircle size={15} style={{ marginRight: 6, verticalAlign: -3 }} />
                              {project.blockers.join(', ')}
                            </div>
                          )}

                          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button size="small" icon={<ExternalLink size={14} />}>작업 로그 보기</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {expandedProject && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: token.colorTextSecondary, fontSize: 12 }}>
            <CircleDot size={12} color={token.colorPrimary} />
            현재 선택: {expandedProject.name} · {expandedProject.progress}% · {expandedProject.currentStage}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevelopmentStatus;
