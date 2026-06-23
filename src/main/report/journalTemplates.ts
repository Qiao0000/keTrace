import type { JournalTemplateType } from "../../shared/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(): string {
  return new Date().toISOString().slice(0, 7);
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
  return `${start.toISOString().slice(0, 10)} ~ ${end.toISOString().slice(0, 10)}`;
}

export function templateLabel(type: JournalTemplateType): string {
  switch (type) {
    case "day": return "日记";
    case "week": return "周记";
    case "month": return "月记";
    case "year": return "年记";
  }
}

export function generateJournalTemplate(type: JournalTemplateType): string {
  switch (type) {
    case "day":
      return `# 日记 ${today()}

## 今天最重要的事
- 

## 发生了什么
- 

## 学习 / 工作推进
- 

## 情绪与身体
- 

## 明天只做三件事
- [ ] 
- [ ] 
- [ ] 
`;

    case "week":
      return `# 周记 ${weekLabel()}

## 本周关键词
- 

## 完成了什么
- 

## 没完成但值得保留的事
- 

## 论文 / 投稿推进
- 

## 下周重点
- [ ] 
- [ ] 
- [ ] 

## 一句话复盘

`;

    case "month":
      return `# 月记 ${monthLabel()}

## 本月主线
- 

## 重要成果
- 

## 时间花在哪里
- 

## 论文 / 投稿 / 项目
- 

## 下月策略
- 

## 需要放下的事
- 
`;

    case "year":
      return `# 年记 ${yearLabel()}

## 今年的主题
- 

## 最重要的成果
- 

## 关键转折
- 

## 学术 / 工作 / 生活复盘
- 学术：
- 工作：
- 生活：

## 明年的三个方向
- [ ] 
- [ ] 
- [ ] 

## 写给未来自己的话

`;
  }
}
