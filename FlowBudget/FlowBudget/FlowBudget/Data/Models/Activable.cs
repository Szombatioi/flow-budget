namespace FlowBudget.Data.Models;

public abstract class Activable
{
    public DateTime ActiveFrom { get; set; } = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1); //First day of today's month
}