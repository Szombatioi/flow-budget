using DTO;

namespace FlowBudget.Client.Components.Helpers;


public static class TimeSeriesAggregator
{
    
    // Aggregates prices by days + fills empty with zero
    public static double[] AggregateByDay(IEnumerable<TimeSeriesItemDTO> items, IEnumerable<DateTime> days)
    {
        var lookup = items
            .GroupBy(x => x.Date.Date)
            .ToDictionary(g => g.Key, g => (double)g.Sum(x => x.Price));

        return days
            .Select(day => lookup.TryGetValue(day.Date, out var total) ? total : 0d)
            .ToArray();
    }
    

    //Aggregate categories with prices summed
    public static (string[] Labels, double[] Values) AggregateByCategory(
        IEnumerable<TimeSeriesItemDTO> items,
        string? uncategorizedLabel = null)
    {
        var groups = items
            .GroupBy(x => string.IsNullOrEmpty(x.Category) ? uncategorizedLabel : x.Category)
            .Select(g => (Label: g.Key, Value: (double)g.Sum(x => x.Price)))
            .OrderByDescending(x => x.Value)
            .ToList();

        return (
            groups.Select(g => g.Label ?? "").ToArray(),
            groups.Select(g => g.Value).ToArray()
        );
    }
    
    // CumulativeBudget: running total of the daily relative budget (the "expected" line)
    // CumulativeActual: running total of actual spending per day
    public static (double[] CumulativeBudget, double[] CumulativeActual) AggregateBurndown(
        IEnumerable<TimeSeriesItemDTO> expenditures,
        IEnumerable<DailyBudgetDTO> budgets,
        IEnumerable<DateTime> days)
    {
        var spendByDay = expenditures
            .GroupBy(x => x.Date.Date)
            .ToDictionary(g => g.Key, g => (double)g.Sum(x => x.Price));

        var budgetByDay = budgets
            .ToDictionary(b => b.Date.Date, b => (double)b.Amount);

        var dayList = days.Select(d => d.Date).OrderBy(d => d).ToList();
        var cumulativeBudget = new double[dayList.Count];
        var cumulativeActual = new double[dayList.Count];

        double runningBudget = 0;
        double runningActual = 0;

        for (int i = 0; i < dayList.Count; i++)
        {
            runningBudget += budgetByDay.TryGetValue(dayList[i], out var budget) ? budget : 0;
            runningActual += spendByDay.TryGetValue(dayList[i], out var spend) ? spend : 0;
            cumulativeBudget[i] = runningBudget;
            cumulativeActual[i] = runningActual;
        }

        return (cumulativeBudget, cumulativeActual);
    }
}
