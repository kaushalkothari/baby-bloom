import { useState } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type GrowthChartKey = 'weight' | 'height' | 'head';

export default function Growth() {
  const { selectedChild, visits } = useApp();
  const [focusedChart, setFocusedChart] = useState<GrowthChartKey | null>(null);
  const { t } = useTranslation();

  const chartCardClass = (key: GrowthChartKey, extra?: string) =>
    cn(
      extra,
      'cursor-pointer transition-[box-shadow,transform] duration-200',
      focusedChart === key && 'relative z-10 scale-[1.01] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
    );

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">{t('empty.selectChildFirst')}</p>;

  const growthData = visits
    .filter(
      (v) =>
        v.childId === selectedChild.id &&
        (v.weight || v.height || v.headCircumference),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(v => ({
      date: format(new Date(v.date), 'MMM dd'),
      fullDate: format(new Date(v.date), 'PPP'),
      weight: v.weight || null,
      height: v.height || null,
      headCircumference: v.headCircumference || null,
    }));

  const chartConfig = {
    weight: { label: t('growth.labels.weightKg'), color: 'hsl(var(--primary))' },
    height: { label: t('growth.labels.heightCm'), color: 'hsl(var(--info))' },
    headCircumference: { label: t('growth.labels.headCm'), color: 'hsl(var(--success))' },
  };

  if (growthData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">{t('pages.growth.title')}</h1>
        <div className="text-center py-20">
          <TrendingUp className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('growth.noGrowthData')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">{t('pages.growth.title')} — {selectedChild.name}</h1>

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upper half: weight (full width, same prominence as former head-circumference row) */}
        <Card
          className={chartCardClass('weight', 'lg:col-span-2')}
          onClick={() => setFocusedChart((c) => (c === 'weight' ? null : 'weight'))}
        >
          <CardHeader>
            <CardTitle className="font-display">{t('growth.weightOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-[min(42vh,380px)] w-full [&_.recharts-responsive-container]:!aspect-auto"
            >
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-weight)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bottom: height and head circumference */}
        <Card
          className={chartCardClass('height')}
          onClick={() => setFocusedChart((c) => (c === 'height' ? null : 'height'))}
        >
          <CardHeader>
            <CardTitle className="font-display">{t('growth.heightOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-[300px] w-full [&_.recharts-responsive-container]:!aspect-auto"
            >
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="height"
                  stroke="var(--color-height)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card
          className={chartCardClass('head')}
          onClick={() => setFocusedChart((c) => (c === 'head' ? null : 'head'))}
        >
          <CardHeader>
            <CardTitle className="font-display">{t('growth.headOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-[300px] w-full [&_.recharts-responsive-container]:!aspect-auto"
            >
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="headCircumference"
                  stroke="var(--color-headCircumference)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
