import axios from "axios";
import fs from "fs";
import path from "path";

export interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
}

export interface ChartData {
  type: "bar" | "pie" | "line" | "horizontalBar" | "doughnut";
  title: string;
  labels: string[];
  data?: number[];
  data2?: number[]; // 보조 데이터셋 지원 (v5.1)
  datasets?: ChartDataset[]; // 직접 데이터셋 지원 (v5.1)
}

export class ChartService {
  private readonly baseUrl = "https://quickchart.io/chart";

  /**
   * 차트 데이터를 이미지 파일로 저장합니다.
   */
  async generateChartImage(chartData: ChartData, outputDir: string): Promise<string | null> {
    try {
      const isMultiColor = chartData.type === 'pie' || chartData.type === 'doughnut';
      const isHorizontal = chartData.type === 'horizontalBar';
      
      // ✅ 1. 데이터셋 통합 처리 (data, data2, datasets 지원)
      let finalDatasets: any[] = [];
      
      if (chartData.datasets && chartData.datasets.length > 0) {
        // 이미 datasets 형식이면 그대로 사용하되 스타일 보완
        finalDatasets = chartData.datasets.map((ds, idx) => ({
          label: ds.label || `데이터 ${idx + 1}`,
          data: ds.data,
          backgroundColor: ds.backgroundColor || (isMultiColor 
            ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF']
            : (idx === 0 ? '#42A5F5' : '#66BB6A'))
        }));
      } else if (chartData.data) {
        // 단일 data 처리
        finalDatasets.push({
          label: chartData.title || "값",
          data: chartData.data,
          backgroundColor: isMultiColor
            ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF']
            : '#36A2EB'
        });
        
        // data2가 있으면 추가
        if (chartData.data2) {
          finalDatasets.push({
            label: "비교값",
            data: chartData.data2,
            backgroundColor: '#FF6384'
          });
        }
      }

      if (finalDatasets.length === 0) return null;

      // 0부터 시작하도록 강제하고 상단 여백 확보를 위한 최대값 계산
      const allValues = finalDatasets.flatMap(ds => ds.data);
      const maxVal = Math.max(...allValues);
      const suggestedMax = maxVal > 0 ? maxVal * 1.25 : 10; // 25% 여유 공간

      const chartConfig = {
        type: chartData.type === 'horizontalBar' ? 'horizontalBar' : chartData.type,
        data: {
          labels: chartData.labels,
          datasets: finalDatasets
        },
        options: {
          title: {
            display: true,
            text: chartData.title,
            fontSize: 22,
            fontColor: '#333',
            padding: 20
          },
          legend: {
            display: finalDatasets.length > 1 || isMultiColor,
            position: 'bottom',
            labels: { fontSize: 13 }
          },
          scales: isMultiColor ? {} : {
            [isHorizontal ? 'xAxes' : 'yAxes']: [{
              ticks: {
                beginAtZero: true,
                suggestedMax: suggestedMax,
                fontSize: 12
              },
              gridLines: { color: '#eee' }
            }],
            [isHorizontal ? 'yAxes' : 'xAxes']: [{
              ticks: { fontSize: 12 },
              gridLines: { display: false }
            }]
          },
          plugins: {
            datalabels: {
              display: true,
              anchor: 'end',
              align: isHorizontal ? 'right' : 'top',
              color: '#333',
              font: { weight: 'bold', size: 12 },
              formatter: (value: number) => value.toLocaleString(),
              offset: 4
            }
          }
        }
      };

      const url = `${this.baseUrl}?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=450&format=png&backgroundColor=white`;
      
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      
      const fileName = `chart_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(filePath, response.data);
      return filePath;
    } catch (error) {
      console.error("❌ 차트 이미지 생성 실패:", error);
      return null;
    }
  }
}
