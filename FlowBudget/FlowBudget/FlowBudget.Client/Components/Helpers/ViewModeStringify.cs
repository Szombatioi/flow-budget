using FlowBudget.Client.Components.Diagrams;
using Microsoft.Extensions.Localization;

namespace FlowBudget.Client.Components.Helpers;

public static class ViewModeStringify
{
    public static string ToTitle(this ChartViewMode mode, IStringLocalizer localizer)
    {
        return mode switch
        {
            ChartViewMode.Daily => localizer["view_mode_daily"],
            ChartViewMode.Weekly => localizer["view_mode_weekly"],
            ChartViewMode.Monthly => localizer["view_mode_monthly"],
            _ => mode.ToString()
        };
    }
}