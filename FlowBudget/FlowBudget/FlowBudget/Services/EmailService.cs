using System.Net;
using System.Net.Mail;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.EntityFrameworkCore;
using NuGet.Protocol.Plugins;

namespace FlowBudget.Services;

public class EmailService(ApplicationDbContext db, IConfiguration configuration, ILogger<EmailService> logger)
{
    public async Task NotifyUsers()
    {
        logger.LogInformation("Notifying users who have no records for today set");

        //Check if we have the env variables
        var host = configuration["EmailSettings:Host"];
        var portStr = configuration["EmailSettings:Port"];
        var senderEmail = configuration["EmailSettings:SenderEmail"];
        var senderName = configuration["EmailSettings:SenderName"];
        var password = configuration["EmailSettings:Password"];

        if (host is null || portStr is null || senderEmail is null || senderName is null || password is null)
        {
            logger.LogError("Email settings not configured");
            throw new Exception("Email settings not configured");
        }

        var port = int.Parse(portStr);

        //Get users who enabled notifications
        var users = await db.Users
            // .Include(u => u.Accounts)
            // .ThenInclude(a => a.DivisionPlans)
            // .ThenInclude(dp => dp.Pockets)
            // .ThenInclude(p => p.DailyExpenses)
            .Where(u => u.NotificationsEnabled)
            .ToListAsync();

        foreach (var user in users)
        {
            logger.LogInformation($"Sending email for: {user.Email}");
            //Check if the user has any accounts that has any [...]
            //  that has no expenses for today on that DE
            var dailyExpensesWithNoExpense = await db.DailyExpenses
                .Include(de => de.Expenditures)
                .Include(de => de.Pocket)
                .ThenInclude(p => p.DivisionPlan)
                .ThenInclude(dp => dp.Account)
                .Where(de => de.Date == DateTime.Today.Date &&
                             de.Expenditures.Count == 0 &&
                             de.Pocket.DivisionPlan.Account.UserId == user.Id)
                .ToListAsync();
            if (dailyExpensesWithNoExpense.Count == 0) continue;
            
            var email = new MailMessage()
            {
                From = new MailAddress(senderEmail),
                Subject = "Flow Budget Notification",
                Body = await BuildBody(user.UserName, DateTime.Today.ToString("MM.dd"), dailyExpensesWithNoExpense),
                IsBodyHtml = true,
            };
            email.To.Add(new MailAddress(user.Email));

            var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(senderEmail, password),
                EnableSsl = true
            };

            await client.SendMailAsync(email);
        }
    }

    private async Task<string> BuildBody(string userName, string date, List<DailyExpense> dailyExpenses)
    {
        var template = await File.ReadAllTextAsync("Data/EmailNotificationTemplate.html");
        
        var gridText = "";
        foreach (var expense in dailyExpenses)
        {
            gridText += BuildGrid(expense.Pocket.DivisionPlan.Account.Name, expense.Pocket.Name,
                expense.Date.ToString("MM.dd")) + "\n";
        }

        return template
            .Replace("{{UserName}}", userName)
            .Replace("{{Date}}", date)
            .Replace("{{PlaceGridsHere}}", gridText)
            .Replace("{{LogExpenseUrl}}", configuration["EmailSettings:LogExpenseUrl"]);
    }

    private string BuildGrid(string accountName, string pocketName, string date)
    {
        return $"""
                <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                  <tr>
                    <th style="text-align:left; padding:4px 12px; color:#666; font-size:12px; font-weight:normal; border-bottom:1px solid #eee;">Account</th>
                    <th style="text-align:left; padding:4px 12px; color:#666; font-size:12px; font-weight:normal; border-bottom:1px solid #eee;">Pocket</th>
                    <th style="text-align:left; padding:4px 12px; color:#666; font-size:12px; font-weight:normal; border-bottom:1px solid #eee;">Date</th>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;">{accountName}</td>
                    <td style="padding:8px 12px;">{pocketName}</td>
                    <td style="padding:8px 12px;">{date}</td>
                  </tr>
                </table>
                """;
    }
}