import axios from "axios";
import fs from "fs";
import path from "path";

export interface ChartData {
  type: "bar" | "pie" | "line" | "horizontalBar" | "doughnut";
  title: string;
  labels: string[];
  data: number[];
}

export class ChartService {
  private readonly baseUrl = "https://quickchart.io/chart";

  /**
   * 차트 데이터를 이미지 파일로 저장합니다.
   */
  async generateChartImage(chartData: ChartData, outputDir: string): Promise<string | null> {
    try {
      const isMultiColor = chartData.type === 'pie' || chartData.type === 'doughnut';
      const chartConfig = {
        type: chartData.type,
        data: {
          labels: chartData.labels,
          datasets: [{
            label: chartData.title,
            data: chartData.data,
            backgroundColor: isMultiColor
              ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'] 
              : '#36A2EB',
          }]
        },
        options: {
          title: {
            display: true,
            text: chartData.title,
            fontSize: 20
          },
          plugins: {
            datalabels: {
              display: true,
              anchor: 'end',
              align: 'top',
              color: '#444',
              font: { weight: 'bold' }
            }
          }
        }
      };

      const url = `${this.baseUrl}?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400&format=png&backgroundColor=white`;
      
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
