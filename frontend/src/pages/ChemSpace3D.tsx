import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Typography, Select, Space, Button, Input, Divider, Tooltip, Spin } from 'antd';
import { 
  Search, 
  Filter, 
  Download, 
  Info,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Rotate3d
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import ToggleTag from '../components/common/ToggleTag';

const { Title, Text } = Typography;
const { Option } = Select;

const ChemSpace3D: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAxes, setShowAxes] = useState(true);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: 'Compounds' }, { label: 'Chemical Space 3D' }]} />);
    
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
      (item.s && item.s.toLowerCase().includes(term)) ||
      (item.n && item.n.toLowerCase().includes(term))
    );
  }, [searchTerm, data]);

  const getOption = () => {
    const egfrData = filteredData.filter(item => item.e === 1);
    const otherData = filteredData.filter(item => item.e === 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data?.[3]; // We store the item at index 3
          if (!d) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${d.n || 'Unknown'}</div>
              <div style="font-size: 11px; color: #666;">Kinase: ${d.k || 'Unknown'}</div>
              <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
                <span style="font-size: 11px;">LogP: ${d.lp?.toFixed(2)}</span>
                <span style="font-size: 11px;">TPSA: ${d.tp?.toFixed(2)}</span>
                <span style="font-size: 11px;">QED: ${d.q?.toFixed(3)}</span>
              </div>
            </div>
          `;
        },
        backgroundColor: isDarkMode ? '#1f1f1f' : '#fff',
        borderColor: isDarkMode ? '#303030' : '#f0f0f0',
        textStyle: { color: isDarkMode ? '#e8e8e8' : '#333' }
      },
      visualMap: {
        show: true,
        min: 0,
        max: 1,
        dimension: 2, // Color by QED (z-axis)
        inRange: {
          color: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']
        },
        text: ['High QED', 'Low QED'],
        textStyle: { color: isDarkMode ? '#888' : '#666' }
      },
      xAxis3D: { 
        show: true,
        name: showAxes ? 'LogP' : '',
        type: 'value',
        nameTextStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' },
        axisLabel: { 
          show: true, 
          textStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' } 
        },
        axisLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : 'transparent' } 
        },
        axisTick: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? '#555' : '#ccc') : 'transparent' } 
        },
        splitLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent' } 
        }
      },
      yAxis3D: { 
        show: true,
        name: showAxes ? 'TPSA' : '',
        type: 'value',
        nameTextStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' },
        axisLabel: { 
          show: true, 
          textStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' } 
        },
        axisLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : 'transparent' } 
        },
        axisTick: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? '#555' : '#ccc') : 'transparent' } 
        },
        splitLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent' } 
        }
      },
      zAxis3D: { 
        show: true,
        name: showAxes ? 'QED' : '',
        type: 'value',
        nameTextStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' },
        axisLabel: { 
          show: true, 
          textStyle: { color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent' } 
        },
        axisLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : 'transparent' } 
        },
        axisTick: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? '#555' : '#ccc') : 'transparent' } 
        },
        splitLine: { 
          show: true, 
          lineStyle: { color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent' } 
        }
      },
      grid3D: {
        boxWidth: 100,
        boxHeight: 80,
        boxDepth: 100,
        axisPointer: {
          show: false
        },
        viewControl: {
          autoRotate: false,
          distance: 200,
          alpha: 20, // Initial vertical angle
          beta: 40,  // Initial horizontal angle
          rotateSensitivity: 1, // Rotation speed
          zoomSensitivity: 1,   // Zoom speed (mouse wheel)
          panSensitivity: 1,    // Pan speed (right click drag)
          damping: 0.8          // Smooth movement
        },
        postEffect: {
          enable: true
        },
        light: {
          main: {
            intensity: 1.2,
            shadow: true
          },
          ambient: {
            intensity: 0.3
          }
        }
      },
      series: [
        {
          name: 'Other Compounds',
          type: 'scatter3D',
          data: otherData.map(item => [item.lp, item.tp, item.q, item]),
          symbolSize: 2.5,
          itemStyle: {
            opacity: 0.7
          }
        },
        {
          name: 'EGFR Positive',
          type: 'scatter3D',
          data: egfrData.map(item => [item.lp, item.tp, item.q, item]),
          symbolSize: 8,
          itemStyle: {
            color: '#fde725',
            borderColor: '#000',
            borderWidth: 0.5,
            opacity: 1
          },
          emphasis: {
            itemStyle: {
              symbolSize: 12
            }
          }
        }
      ]
    };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <Space size={16} style={{ minWidth: 0 }}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/chem-space')}>Back to 2D</Button>
          <div style={{ minWidth: 0 }}>
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>3D Chemical Space Explorer</Title>
            <Text type="secondary">Z-Axis: QED (Quantitative Estimate of Drug-likeness)</Text>
          </div>
        </Space>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            flex: '1 1 320px',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <div>
            <ToggleTag checked={showAxes} onChange={setShowAxes} style={{ marginInlineEnd: 0, fontSize: 12 }}>
              Show Axis
            </ToggleTag>
          </div>
          <Input 
            prefix={<Search size={16} />} 
            placeholder="Search SMILES or Target..." 
            style={{ flex: '1 1 240px', minWidth: 180, maxWidth: 300, borderRadius: 8 }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card 
        loading={loading}
        style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
        styles={{ body: { height: '100%', padding: 0 } }}
      >
        {!loading ? (
          <ReactECharts 
            option={getOption()} 
            style={{ height: '100%', width: '100%' }}
            theme={isDarkMode ? 'dark' : ''}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" tip="Loading 3D Data..." />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChemSpace3D;
