namespace FlowBudget.Client.Components.Helpers;

public static class DateFormatter
{
    public static string FormatDate(this DateTime date)
    {
        return $"{date.Year:0000}-{date.Month:00}-{date.Day:00}";
    }
}