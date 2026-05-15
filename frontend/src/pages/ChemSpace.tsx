import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Typography, Select, Space, Button, Input, Divider, Tooltip, Switch } from 'antd';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useTheme } from '../contexts/ThemeContext';
import ChemSpaceChart from '../components/charts/ChemSpaceChart';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  Info,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Box,
  Rotate3d,
  Move3d,
  Layers
} from 'lucide-react';
import ChemSpaceChart3D from '../components/charts/ChemSpaceChart3D';

const { Title, Text } = Typography;
const { Option } = Select;

const ChemSpace: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [xAxis, setXAxis] = useState('molLogP');
  const [yAxis, setYAxis] = useState('tpsa');
  const [colorBy, setColorBy] = useState('kinase');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isThreeChartMode, setIsThreeChartMode] = useState(false);
  const [is3DView, setIs3DView] = useState(false);
  const [zAxis, setZAxis] = useState('q');
  const [show3DAxes, setShow3DAxes] = useState(true);

  const chartConfigs = [
    { x: 'molLogP', y: 'tpsa', title: 'Lipophilicity vs Polar Surface Area' },
    { x: 'molWt', y: 'tpsa', title: 'Size vs Lipophilicity' },
    { x: 'maxAbsEStateIndex', y: 'molWt', title: 'Electronic Index vs Size' }
  ];

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

  // Removed redundant getOption and constants (now in ChemSpaceChart)

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
            className="v-search-input"
            style={{ width: 300 }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Button 
            type={is3DView ? "primary" : "default"}
            icon={is3DView ? <LayoutGrid size={16} /> : <Rotate3d size={16} />} 
            className="v-action-btn"
            onClick={() => setIs3DView(!is3DView)}
          >
            {is3DView ? '2D View' : '3D View'}
          </Button>
          <Button icon={<Download size={16} />} className="v-action-btn">Export</Button>
        </Space>
      </div>

      <Row gutter={[20, 20]} style={{ flex: 1, minHeight: 0 }}>
        <Col span={6}>
          <div className="v-table-card" style={{ height: '100%' }}>
            <div className="v-table-header">
              <Space><Filter size={16} /><span>Visual Controls</span></Space>
            </div>
            <div style={{ padding: '20px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: is3DView ? 0.5 : 1, pointerEvents: is3DView ? 'none' : 'auto' }}>
                <Space 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setIsThreeChartMode(!isThreeChartMode)}
                >
                  <LayoutGrid size={16} />
                  <Text strong>3Chart Mode</Text>
                </Space>
                <Switch checked={isThreeChartMode} onChange={setIsThreeChartMode} size="small" />
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div style={{ opacity: isThreeChartMode ? 0.5 : 1, pointerEvents: isThreeChartMode ? 'none' : 'auto' }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>X-Axis Property</Text>
                <Select value={xAxis} onChange={setXAxis} style={{ width: '100%' }}>
                  <Option value="molWt">Molecular Weight</Option>
                  <Option value="molLogP">MolLogP</Option>
                  <Option value="tpsa">TPSA</Option>
                  <Option value="maxAbsEStateIndex">MaxAbsEStateIndex</Option>
                </Select>
              </div>
              <div style={{ opacity: isThreeChartMode ? 0.5 : 1, pointerEvents: isThreeChartMode ? 'none' : 'auto' }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Y-Axis Property</Text>
                <Select value={yAxis} onChange={setYAxis} style={{ width: '100%' }}>
                  <Option value="molWt">Molecular Weight</Option>
                  <Option value="molLogP">MolLogP</Option>
                  <Option value="tpsa">TPSA</Option>
                  <Option value="maxAbsEStateIndex">MaxAbsEStateIndex</Option>
                </Select>
              </div>
              {is3DView && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Z-Axis Property (Color)</Text>
                  <Select value={zAxis} onChange={setZAxis} style={{ width: '100%' }}>
                    <Option value="q">QED</Option>
                    <Option value="molWt">Molecular Weight</Option>
                    <Option value="molLogP">MolLogP</Option>
                    <Option value="tpsa">TPSA</Option>
                    <Option value="maxAbsEStateIndex">MaxAbsEStateIndex</Option>
                  </Select>
                </div>
              )}
              <div style={{ opacity: is3DView ? 0.5 : 1, pointerEvents: is3DView ? 'none' : 'auto' }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Color By</Text>
                <Select value={colorBy} onChange={setColorBy} style={{ width: '100%' }}>
                  <Option value="kinase">Kinase Group</Option>
                  <Option value="egfr">EGFR Target Presence</Option>
                </Select>
              </div>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Legend</Text>
                {is3DView ? (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ 
                      height: 12, 
                      width: '100%', 
                      background: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
                      borderRadius: 4
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10 }}>Low QED</Text>
                      <Text style={{ fontSize: 10 }}>High QED</Text>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fde725', border: '1px solid #000' }} /> <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>EGFR Positive</Text></Space>
                  </Space>
                ) : (
                  colorBy === 'kinase' ? (
                  <Space direction="vertical" size={8}>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F87C63' }} /> <Text style={{ fontSize: '12px' }}>TK</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4ECDC4' }} /> <Text style={{ fontSize: '12px' }}>TKL</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FFD166' }} /> <Text style={{ fontSize: '12px' }}>STE</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#06D6A0' }} /> <Text style={{ fontSize: '12px' }}>CK1</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#118AB2' }} /> <Text style={{ fontSize: '12px' }}>AGC</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#073B4C' }} /> <Text style={{ fontSize: '12px' }}>CMGC</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#A29BFE' }} /> <Text style={{ fontSize: '12px' }}>CAMK</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8D99AE' }} /> <Text style={{ fontSize: '12px' }}>Other</Text></Space>
                    <Divider style={{ margin: '4px 0' }} />
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fde725', border: '1px solid #000' }} /> <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>EGFR Positive</Text></Space>
                  </Space>
                ) : (
                  <Space direction="vertical" size={8}>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fde725', border: '1px solid #000' }} /> <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>EGFR Positive</Text></Space>
                    <Space><div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#440154' }} /> <Text style={{ fontSize: '12px' }}>EGFR Negative</Text></Space>
                  </Space>
                ))}
              </div>
            </Space>
          </div>
        </div>
      </Col>

        <Col span={18}>
          <Card 
            loading={loading}
            style={{ height: '100%', position: 'relative' }}
            styles={{ body: { height: 'calc(100% - 56px)', padding: isThreeChartMode ? '8px' : '12px' } }}
            extra={
              <Space size={16}>
                {is3DView && (
                  <Space 
                    size={8} 
                    style={{ marginRight: 8, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setShow3DAxes(!show3DAxes)}
                  >
                    <Text style={{ fontSize: 12 }}>Show Axis</Text>
                    <Switch checked={show3DAxes} onChange={setShow3DAxes} size="small" />
                  </Space>
                )}
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
              <div style={{ height: '100%', overflowY: isThreeChartMode ? 'auto' : 'hidden', overflowX: 'hidden' }}>
                {isThreeChartMode ? (
                  <Row gutter={[12, 12]} style={{ width: '100%', margin: 0 }}>
                    {chartConfigs.map((config, idx) => (
                      <Col key={idx} span={idx === 2 ? 24 : 12} style={{ height: 400, marginBottom: 12 }}>
                        <Card 
                          size="small" 
                          title={<Text style={{ fontSize: 13, fontWeight: 600 }}>{config.title}</Text>}
                          style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                          styles={{ body: { height: 'calc(100% - 38px)', padding: 8 } }}
                        >
                          <ChemSpaceChart 
                            data={filteredData}
                            xAxis={config.x}
                            yAxis={config.y}
                            colorBy={colorBy as any}
                            isDarkMode={isDarkMode}
                          />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    {is3DView ? (
                      <ChemSpaceChart3D 
                        data={filteredData}
                        xAxis={xAxis}
                        yAxis={yAxis}
                        zAxis={zAxis}
                        isDarkMode={isDarkMode}
                        showAxes={show3DAxes}
                      />
                    ) : (
                      <>
                        <ChemSpaceChart 
                          data={filteredData}
                          xAxis={xAxis}
                          yAxis={yAxis}
                          colorBy={colorBy as any}
                          isDarkMode={isDarkMode}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          bottom: 12, 
                          right: 12, 
                          background: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)',
                          padding: '4px 10px',
                          borderRadius: 12,
                          backdropFilter: 'blur(4px)',
                          border: `1px solid ${isDarkMode ? '#434343' : '#d8dbe0'}`,
                          zIndex: 100
                        }}>
                          <Text style={{ fontSize: 11 }}>Showing <b>{filteredData.length}</b> compounds</Text>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
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
          <div className="v-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 12, padding: 24 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Title level={3} style={{ margin: 0 }}>Fullscreen View</Title>
            <Button icon={<Minimize2 size={16} />} onClick={() => setIsFullScreen(false)} className="v-action-btn">Exit</Button>
          </div>
          <div style={{ flex: 1 }}>
            {is3DView ? (
              <ChemSpaceChart3D 
                data={filteredData}
                xAxis={xAxis}
                yAxis={yAxis}
                zAxis={zAxis}
                isDarkMode={isDarkMode}
                showAxes={show3DAxes}
              />
            ) : (
              <ChemSpaceChart 
                data={filteredData}
                xAxis={xAxis}
                yAxis={yAxis}
                colorBy={colorBy as any}
                isDarkMode={isDarkMode}
              />
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChemSpace;
