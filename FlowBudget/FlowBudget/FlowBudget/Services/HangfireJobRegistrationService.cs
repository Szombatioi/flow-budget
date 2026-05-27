using Hangfire;

namespace FlowBudget.Services;

public class HangfireJobRegistrationService(ILogger<HangfireJobRegistrationService> logger) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Registering Email job for Hangfire");
        RecurringJob.AddOrUpdate<EmailService>(
            "email-notification-job",
            service => service.NotifyUsers(),
            Cron.Daily(22, 0),
            new RecurringJobOptions
            {
                //Remember: hangfire uses UTC time zone :D
                //22:00 here -> 20:00 there
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time")
            }
        );

        logger.LogInformation("Registering Wishlist move job for Hangfire");
        RecurringJob.AddOrUpdate<WishlistService>(
            "wishlist-sweep-job",
            service => service.MoveRemainingMoneyToWishlist(),
            Cron.Daily(23, 59),
            new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time")
            }
        );

        return Task.CompletedTask;
    }
}
