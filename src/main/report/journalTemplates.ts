import type { JournalTemplateType } from "../../shared/types";

function dateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today(): string {
  return dateStr(new Date());
}

function monthLabel(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearLabel(): string {
  return String(new Date().getFullYear());
}

function weekLabel(): string {
  const date = new Date();
  const start = new Date(date);
  const day = (date.getDay() + 6) % 7;
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${dateStr(start)} ~ ${dateStr(end)}`;
}

export function templateLabel(type: JournalTemplateType): string {
  switch (type) {
    case "day": return "日复盘";
    case "week": return "周复盘";
    case "month": return "月复盘";
    case "year": return "年复盘";
  }
}

export function generateJournalTemplate(type: JournalTemplateType): string {
  switch (type) {
    case "day":
      return `# 日复盘 ${today()}

> 刻迹 KeTrace · 今日记录 · 用一句话收住今天

## 今日结论
- 一句话总结：
- 今天最值得保留的推进：
- 今天最需要调整的地方：

## 关键事件
- 上午：
- 下午：
- 晚上：

## 学术 / 项目 / 投稿
- 论文：
- 项目：
- 投稿：

## 时间与状态
- 高能时段：
- 分心来源：
- 情绪与身体：

## 明日三件事
- [ ] 
- [ ] 
- [ ] 
`;

    case "week":
      return `# 周复盘 ${weekLabel()}

> 刻迹 KeTrace · 周度复盘 · 先看主线，再定下周

## 本周主线
- 本周关键词：
- 核心推进：
- 主要阻力：

## 成果清单
- 完成：
- 新增：
- 延后但值得保留：

## 论文 / 投稿 / 项目
- 论文进度：
- 投稿动作：
- 项目节点：

## 下周重点
- [ ] 
- [ ] 
- [ ] 

## 一句话复盘

`;

    case "month":
      return `# 月复盘 ${monthLabel()}

> 刻迹 KeTrace · 月度复盘 · 看结构、看趋势、看取舍

## 月度结论
- 本月主题：
- 最重要成果：
- 最大风险：

## 时间结构
- 主要投入：
- 低效消耗：
- 值得继续的节奏：

## 论文 / 投稿 / 项目
- 论文：
- 投稿：
- 项目：

## 下月策略
- 

## 需要放下的事
- 
`;

    case "year":
      return `# 年复盘 ${yearLabel()}

> 刻迹 KeTrace · 年度复盘 · 留下证据，也留下方向

## 今年的主题
- 

## 最重要的成果
- 

## 关键转折
- 

## 学术 / 工作 / 生活
- 学术：
- 工作：
- 生活：

## 能力与习惯
- 变强的能力：
- 仍需修补的系统：
- 最想保留的习惯：

## 明年的三个方向
- [ ] 
- [ ] 
- [ ] 

## 写给未来自己的话

`;
  }
}
