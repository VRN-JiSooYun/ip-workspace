import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Typography, Select, Space, Button, Input, Divider, Tooltip } from 'antd';
import { 
  Search, 
  Filter, 
  Download, 
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { chemSpaceData } from '../mocks/chemSpaceData';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;
const { Option } = Select;

const ChemSpace: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [xAxis, setXAxis] = useState('molLogP');
  const [yAxis, setYAxis] = useState('tpsa');
  const [colorBy, setColorBy] = useState('kinase');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: 'Compounds' }, { label: 'Chemical Space' }]} />);
    
    // Fetch data from public directory
    fetch('/data/chemSpaceData.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load chem space data:', err);
        setLoading(false);
      });

    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.s.toLowerCase().includes(term) ||
      item.n.toLowerCase().includes(term)
    );
  }, [searchTerm, data]);

  const keyMap: Record<string, string> = {
    'molWt': 'mw',
    'molLogP': 'lp',
    'tpsa': 'tp',
    'maxAbsEStateIndex': 'ei'
  };

  const getOption = () => {
    const kinaseGroups = ['TK', 'TKL', 'STE', 'CK1', 'AGC', 'CMGC', 'Other'];
    const kinaseColors = ['#F87C63', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#8D99AE'];
    
    const kinaseToIdx = (k: string) => {
      const idx = kinaseGroups.indexOf(k);
      return idx === -1 ? 6 : idx;
    };

    const egfrData = filteredData.filter(item => item.e === 1);
    const otherData = filteredData.filter(item => item.e === 0);

    const option: any = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data?.item;
          if (!d) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${d.n || 'Unknown'}</div>
              <div style="font-size: 12px; color: #666;">Kinase: ${d.k || 'Unknown'}</div>
              <div style="font-size: 11px; font-family: monospace; margin: 4px 0; max-width: 200px; word-break: break-all;">${d.s || ''}</div>
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <span style="font-size: 11px;">MW: ${typeof d.mw === 'number' ? d.mw.toFixed(2) : '-'}</span>
                <span style="font-size: 11px;">LogP: ${typeof d.lp === 'number' ? d.lp.toFixed(2) : '-'}</span>
                <span style="font-size: 11px;">TPSA: ${typeof d.tp === 'number' ? d.tp.toFixed(2) : '-'}</span>
              </div>
              ${d.e ? '<div style="margin-top: 4px; color: #fde725; font-weight: bold; font-size: 11px;">★ EGFR Positive</div>' : ''}
            </div>
          `;
        },
        backgroundColor: isDarkMode ? '#1f1f1f' : '#fff',
        borderColor: isDarkMode ? '#303030' : '#f0f0f0',
        textStyle: { color: isDarkMode ? '#e8e8e8' : '#333' }
      },
      grid: {
        top: 60,
        left: 80,
        right: 80,
        bottom: 80
      },
      xAxis: {
        name: xAxis.toUpperCase(),
        nameLocation: 'middle',
        nameGap: 40,
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#333' : '#eee' } },
        axisLabel: { color: isDarkMode ? '#888' : '#666' },
        scale: true
      },
      yAxis: {
        name: yAxis.toUpperCase(),
        nameLocation: 'middle',
        nameGap: 50,
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#333' : '#eee' } },
        axisLabel: { color: isDarkMode ? '#888' : '#666' },
        scale: true
      },
      series: [
        {
          name: 'Other Compounds',
          type: 'scatter',
          symbolSize: 2,
          large: true,
          largeThreshold: 2000,
          data: otherData.map(item => ({
            value: [
              item[keyMap[xAxis] as keyof typeof item], 
              item[keyMap[yAxis] as keyof typeof item],
              colorBy === 'kinase' ? kinaseToIdx(item.k) : 0
            ],
            item: item
          })),
          itemStyle: {
            opacity: 0.6
          }
        },
        {
          name: 'EGFR Positive',
          type: 'scatter',
          symbolSize: 6,
          z: 10,
          data: egfrData.map(item => ({
            value: [
              item[keyMap[xAxis] as keyof typeof item], 
              item[keyMap[yAxis] as keyof typeof item],
              colorBy === 'kinase' ? kinaseToIdx(item.k) : 1
            ],
            item: item
          })),
          itemStyle: {
            color: '#fde725', // Always yellow for EGFR in highlight series
            borderColor: '#000',
            borderWidth: 0.5,
            opacity: 1
          },
          emphasis: {
            itemStyle: {
              symbolSize: 10,
              borderWidth: 2,
              borderColor: '#fff'
            }
          }
        }
      ]
    };

    if (colorBy === 'kinase') {
      option.visualMap = {
        type: 'piecewise',
        categories: kinaseGroups,
        dimension: 2,
        show: false, // We use the manual legend
        inRange: {
          color: kinaseColors
        },
        seriesIndex: [0] // Only apply visualMap to the background series
      };
    } else {
      // EGFR mode
      option.visualMap = {
        min: 0,
        max: 1,
        dimension: 2,
        show: false,
        inRange: {
          color: ['#440154', '#fde725']
        },
        seriesIndex: [0]
      };
    }

    return option;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Chemical Space Analysis</Title>
          <Text type="secondary">Explore structural diversity and property distribution across target space.</Text>
        </div>
        <Space size={12}>
          <Input 
            prefix={<Search size={16} />} 
            placeholder="Search SMILES or Target..." 
            style={{ width: 300, borderRadius: 8 }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Button icon={<Download size={16} />}>Export</Button>
        </Space>
      </div>

      <Row gutter={[20, 20]} style={{ flex: 1, minHeight: 0 }}>
        <Col span={6}>
          <Card 
            title={<Space><Filter size={16} /><span>Visual Controls</span></Space>}
            style={{ height: '100%', borderRadius: 12 }}
            styles={{ body: { padding: '20px' } }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>X-Axis Property</Text>
                <Select value={xAxis} onChange={setXAxis} style={{ width: '100%' }}>
                  <Option value="molWt">Molecular Weight</Option>
                  <Option value="molLogP">MolLogP</Option>
                  <Option value="tpsa">TPSA</Option>
                  <Option value="maxAbsEStateIndex">MaxAbsEStateIndex</Option>
                </Select>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Y-Axis Property</Text>
                <Select value={yAxis} onChange={setYAxis} style={{ width: '100%' }}>
                  <Option value="molWt">Molecular Weight</Option>
                  <Option value="molLogP">MolLogP</Option>
                  <Option value="tpsa">TPSA</Option>
                  <Option value="maxAbsEStateIndex">MaxAbsEStateIndex</Option>
                </Select>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Color By</Text>
                <Select value={colorBy} onChange={setColorBy} style={{ width: '100%' }}>
                  <Option value="kinase">Kinase Group</Option>
                  <Option value="egfr">EGFR Target Presence</Option>
                </Select>
              </div>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Legend</Text>
                {colorBy === 'kinase' ? (
                  <Space direction="vertical" size={8}>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F87C63' }} /> <Text style={{ fontSize: '12px' }}>TK</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4ECDC4' }} /> <Text style={{ fontSize: '12px' }}>TKL</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FFD166' }} /> <Text style={{ fontSize: '12px' }}>STE</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#06D6A0' }} /> <Text style={{ fontSize: '12px' }}>CK1</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#118AB2' }} /> <Text style={{ fontSize: '12px' }}>AGC</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#073B4C' }} /> <Text style={{ fontSize: '12px' }}>CMGC</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8D99AE' }} /> <Text style={{ fontSize: '12px' }}>Other</Text></Space>
                    <Divider style={{ margin: '4px 0' }} />
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fde725', border: '1px solid #000' }} /> <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>EGFR Positive</Text></Space>
                  </Space>
                ) : (
                  <Space direction="vertical" size={8}>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fde725', border: '1px solid #000' }} /> <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>EGFR Positive</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#440154' }} /> <Text style={{ fontSize: '12px' }}>EGFR Negative</Text></Space>
                  </Space>
                )}
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={18}>
          <Card 
            loading={loading}
            style={{ height: '100%', borderRadius: 12, position: 'relative' }}
            styles={{ body: { height: '100%', padding: '12px' } }}
            extra={
              <Space>
                <Tooltip title="Information">
                  <Button type="text" icon={<Info size={16} />} />
                </Tooltip>
                <Tooltip title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}>
                  <Button type="text" icon={isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} onClick={() => setIsFullScreen(!isFullScreen)} />
                </Tooltip>
              </Space>
            }
          >
            {!loading && (
              <>
                <ReactECharts 
                  option={getOption()} 
                  style={{ height: '100%', width: '100%' }}
                  theme={isDarkMode ? 'dark' : ''}
                />
                <div style={{ 
                  position: 'absolute', 
                  bottom: 24, 
                  right: 24, 
                  background: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backdropFilter: 'blur(4px)',
                  border: `1px solid ${isDarkMode ? '#333' : '#eee'}`
                }}>
                  <Text style={{ fontSize: 12 }}>Showing <b>{filteredData.length}</b> compounds</Text>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {isFullScreen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: isDarkMode ? '#141414' : '#fff',
          padding: 40,
          display: 'flex',
          flexDirection: 'column'
        }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Title level={3} style={{ margin: 0 }}>Fullscreen View</Title>
            <Button icon={<Minimize2 size={16} />} onClick={() => setIsFullScreen(false)}>Exit</Button>
          </div>
          <div style={{ flex: 1 }}>
            <ReactECharts 
              option={getOption()} 
              style={{ height: '100%', width: '100%' }}
              theme={isDarkMode ? 'dark' : ''}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChemSpace;
