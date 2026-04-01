import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

export default function Growth() {
  const { selectedChild, visits } = useApp();

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const growthData = visits
    .filter(v => v.childId === selectedChild.id && (v.weight || v.height))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(v => ({
      date: format(new Date(v.date), 'MMM dd'),
      fullDate: format(new Date(v.date), 'PPP'),
      weight: v.weight || null,
      height: v.height || null,
      headCircumference: v.headCircumference || null,
    }));

  const chartConfig = {
    weight: { label: 'Weight (kg)', color: 'hsl(var(--primary))' },
    height: { label: 'Height (cm)', color: 'hsl(var(--info))' },
    headCircumference: { label: 'Head Circ. (cm)', color: 'hsl(var(--success))' },
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Growth Charts</h1>
            <p className="text-xs text-muted-foreground">{selectedChild.name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {growthData.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No growth data yet. Add weight/height during visits.</p>
          </div>
        ) : (
          <>
            <Card className="rounded-xl">
              <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="font-display text-sm">Weight (kg)</CardTitle></CardHeader>
              <CardContent className="px-2 pb-4">
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="font-display text-sm">Height (cm)</CardTitle></CardHeader>
              <CardContent className="px-2 pb-4">
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="height" stroke="var(--color-height)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="font-display text-sm">Head Circumference (cm)</CardTitle></CardHeader>
              <CardContent className="px-2 pb-4">
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="headCircumference" stroke="var(--color-headCircumference)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
