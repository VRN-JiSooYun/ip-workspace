import React from 'react';
import ReactECharts from 'echarts-for-react';

interface ChemSpaceChartProps {
  data: any[];
  xAxis: string;
  yAxis: string;
  colorBy: 'kinase' | 'egfr';
  isDarkMode: boolean;
  height?: string | number;
}

const keyMap: Record<string, string> = {
  'molWt': 'mw',
  'molLogP': 'lp',
  'tpsa': 'tp',
  'maxAbsEStateIndex': 'ei'
};

const kinaseGroups = ['TK', 'TKL', 'STE', 'CK1', 'AGC', 'CMGC', 'CAMK', 'Other'];
const kinaseColors = ['#F87C63', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#A29BFE', '#8D99AE'];

const getKinaseGroup = (k: string) => {
  if (!k || k === 'Unknown') return 'Other';
  return kinaseGroups.includes(k) ? k : 'Other';
};

const ChemSpaceChart: React.FC<ChemSpaceChartProps> = ({ 
  data, 
  xAxis, 
  yAxis, 
  colorBy, 
  isDarkMode,
  height = '100%' 
}) => {
  const egfrData = data.filter(item => item.e === 1);
  const otherData = data.filter(item => item.e === 0);

  const getOption = () => {
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
        top: 40,
        left: 60,
        right: 40,
        bottom: 50
      },
      xAxis: {
        name: xAxis.toUpperCase(),
        nameLocation: 'middle',
        nameGap: 30,
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#333' : '#eee' } },
        axisLabel: { color: isDarkMode ? '#888' : '#666', fontSize: 10 },
        scale: true
      },
      yAxis: {
        name: yAxis.toUpperCase(),
        nameLocation: 'middle',
        nameGap: 40,
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#333' : '#eee' } },
        axisLabel: { color: isDarkMode ? '#888' : '#666', fontSize: 10 },
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
              colorBy === 'kinase' ? getKinaseGroup(item.k) : 'Negative'
            ],
            item: item
          })),
          itemStyle: {
            opacity: 0.3
          }
        },
        {
          name: 'EGFR Positive',
          type: 'scatter',
          symbolSize: 8,
          z: 10,
          zlevel: 1,
          data: egfrData.map(item => ({
            value: [
              item[keyMap[xAxis] as keyof typeof item], 
              item[keyMap[yAxis] as keyof typeof item],
              colorBy === 'kinase' ? getKinaseGroup(item.k) : 'Positive'
            ],
            item: item
          })),
          itemStyle: {
            color: '#fde725',
            borderColor: '#000',
            borderWidth: 1,
            opacity: 1,
            shadowBlur: 5,
            shadowColor: 'rgba(0,0,0,0.5)'
          }
        }
      ]
    };

    if (colorBy === 'kinase') {
      option.visualMap = {
        type: 'piecewise',
        categories: kinaseGroups,
        dimension: 2,
        show: false,
        inRange: {
          color: kinaseColors
        },
        seriesIndex: [0]
      };
    } else {
      option.visualMap = {
        type: 'piecewise',
        categories: ['Negative', 'Positive'],
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
    <ReactECharts 
      option={getOption()} 
      style={{ height, width: '100%' }}
      theme={isDarkMode ? 'dark' : ''}
    />
  );
};

export default ChemSpaceChart;
