import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Typography, theme } from 'antd';

const { Text } = Typography;

interface ChemSpaceChart3DProps {
  data: any[];
  xAxis: string;
  yAxis: string;
  zAxis: string;
  isDarkMode: boolean;
  showAxes: boolean;
}

const ChemSpaceChart3D: React.FC<ChemSpaceChart3DProps> = ({ data, xAxis, yAxis, zAxis, isDarkMode, showAxes }) => {
  const { token } = theme.useToken();
  const getAxisName = (key: string) => {
    const names: Record<string, string> = {
      molWt: 'MW',
      molLogP: 'LogP',
      tpsa: 'TPSA',
      maxAbsEStateIndex: 'Electronic',
      q: 'QED',
      lp: 'LogP',
      tp: 'TPSA',
      mw: 'MW',
      ei: 'Electronic'
    };
    return names[key] || key;
  };

  const getAxisKey = (key: string) => {
    const map: Record<string, string> = {
      molWt: 'mw',
      molLogP: 'lp',
      tpsa: 'tp',
      maxAbsEStateIndex: 'ei',
      q: 'q'
    };
    return map[key] || key;
  };

  const xKey = getAxisKey(xAxis);
  const yKey = getAxisKey(yAxis);
  const zKey = getAxisKey(zAxis);

  const getOption = () => {
    const egfrData = data.filter(item => item.e === 1);
    const otherData = data.filter(item => item.e === 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data?.[3];
          if (!d) return '';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${d.n || 'Unknown'}</div>
              <div style="font-size: 11px; color: #666;">Kinase: ${d.k || 'Unknown'}</div>
              <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
                <span style="font-size: 11px;">${getAxisName(xAxis)}: ${d[xKey]?.toFixed(2)}</span>
                <span style="font-size: 11px;">${getAxisName(yAxis)}: ${d[yKey]?.toFixed(2)}</span>
                <span style="font-size: 11px;">${getAxisName(zAxis)}: ${d[zKey]?.toFixed(3)}</span>
              </div>
            </div>
          `;
        },
        backgroundColor: isDarkMode ? '#1f1f1f' : '#fff',
        borderColor: token.colorBorderSecondary,
        textStyle: { color: isDarkMode ? '#e8e8e8' : '#333' }
      },
      visualMap: {
        show: true,
        min: 0,
        max: 1,
        dimension: 2, // Color by Z-axis
        inRange: {
          color: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']
        },
        right: 10,
        bottom: 40,
        text: [`High ${getAxisName(zAxis)}`, `Low ${getAxisName(zAxis)}`],
        textStyle: { color: isDarkMode ? '#888' : '#666' }
      },
      xAxis3D: {
        show: true,
        name: showAxes ? getAxisName(xAxis) : '',
        type: 'value',
        nameGap: 40,
        nameTextStyle: {
          color: showAxes ? (isDarkMode ? '#aaa' : '#444') : 'transparent',
          fontSize: 20,
          fontWeight: 'bold'
        },
        axisLabel: {
          show: true,
          textStyle: {
            color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)') : 'transparent',
            width: 1
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? '#777' : '#999') : 'transparent',
            width: 2
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
            width: 1
          }
        }
      },
      yAxis3D: {
        show: true,
        name: showAxes ? getAxisName(yAxis) : '',
        type: 'value',
        nameGap: 40,
        nameTextStyle: {
          color: showAxes ? (isDarkMode ? '#aaa' : '#444') : 'transparent',
          fontSize: 20,
          fontWeight: 'bold'
        },
        axisLabel: {
          show: true,
          textStyle: {
            color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)') : 'transparent',
            width: 1
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? '#777' : '#999') : 'transparent',
            width: 2
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
            width: 1
          }
        }
      },
      zAxis3D: {
        show: true,
        name: showAxes ? getAxisName(zAxis) : '',
        type: 'value',
        nameGap: 40,
        nameTextStyle: {
          color: showAxes ? (isDarkMode ? '#aaa' : '#444') : 'transparent',
          fontSize: 20,
          fontWeight: 'bold'
        },
        axisLabel: {
          show: true,
          textStyle: {
            color: showAxes ? (isDarkMode ? '#888' : '#666') : 'transparent',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)') : 'transparent',
            width: 1
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? '#777' : '#999') : 'transparent',
            width: 2
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: showAxes ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
            width: 1
          }
        }
      },
      grid3D: {
        boxWidth: 100,
        boxHeight: 70, // Slightly lower height to fit better
        boxDepth: 100,
        left: 'center',
        top: 'center',
        width: '90%',
        height: '90%',
        axisPointer: {
          show: false
        },
        viewControl: {
          autoRotate: false,
          distance: 220, // Increased distance slightly to fit everything
          alpha: 20,
          beta: 40,
          rotateSensitivity: 1,
          zoomSensitivity: 1,
          panSensitivity: 1,
          damping: 0.8
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
          data: otherData.map(item => [item[xKey], item[yKey], item[zKey], item]),
          symbolSize: 2.5,
          itemStyle: {
            opacity: 0.7
          }
        },
        {
          name: 'EGFR Positive',
          type: 'scatter3D',
          data: egfrData.map(item => [item[xKey], item[yKey], item[zKey], item]),
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
    <div style={{ width: '100%', height: '100%', padding: '24px', boxSizing: 'border-box' }}>
      <ReactECharts 
        option={getOption()} 
        style={{ height: '100%', width: '100%' }}
        theme={isDarkMode ? 'dark' : ''}
        notMerge={true}
      />
    </div>
  );
};

export default ChemSpaceChart3D;
