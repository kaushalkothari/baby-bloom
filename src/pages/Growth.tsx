import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
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

  if (growthData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">Growth Charts</h1>
        <div className="text-center py-20">
          <TrendingUp className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No growth data yet. Add weight/height during hospital visits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Growth Charts — {selectedChild.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-display">Weight Over Time</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full [&_.recharts-responsive-container]:!aspect-auto">
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Height Over Time</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full [&_.recharts-responsive-container]:!aspect-auto">
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="height" stroke="var(--color-height)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Head Circumference</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full [&_.recharts-responsive-container]:!aspect-auto">
              <LineChart data={growthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="headCircumference" stroke="var(--color-headCircumference)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
